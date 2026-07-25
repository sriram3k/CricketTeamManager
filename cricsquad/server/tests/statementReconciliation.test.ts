import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { api, createAdmin, createCharge, createPlayer, prisma, resetDb } from './helpers.js';
import {
  completeReconciliation,
  confirmAllAutoMatched,
  uploadStatement,
} from '../src/services/statement/reconciliation.js';
import { hashLine, parseStatement } from '../src/services/statement/parser.js';
import { getPendingTotalCents } from '../src/services/allocation.js';

const SAMPLE_CSV = path.resolve('sample-data/dbs-statement-sample.csv');

function csv(rows: string[]): Buffer {
  return Buffer.from(
    [
      'Account Details For:,',
      'Account No.:,072-901234-5',
      ',',
      'Transaction Date,Reference,Debit Amount,Credit Amount,Transaction Ref1,Transaction Ref2,Transaction Ref3',
      ...rows,
    ].join('\n'),
    'utf8',
  );
}

describe('DBS statement parsing', () => {
  beforeEach(resetDb);
  afterAll(() => prisma.$disconnect());

  it('skips the account preamble and reads only credit lines', () => {
    const buffer = fs.readFileSync(SAMPLE_CSV);
    const result = parseStatement(buffer, { fileName: 'dbs-statement-sample.csv' });

    // 10 credits in the sample; the 2 debits and the summary rows are skipped.
    expect(result.lines).toHaveLength(10);
    expect(result.lines.every((l) => l.amountCents > 0)).toBe(true);
    expect(
      result.skipped.some((s) => s.reason.includes('only incoming credits')),
    ).toBe(true);

    expect(result.periodFrom.toISOString().slice(0, 10)).toBe('2026-03-02');
    expect(result.periodTo.toISOString().slice(0, 10)).toBe('2026-03-14');

    // "02 Mar 2026" parsed day-first, and the three Ref columns joined up.
    const first = result.lines[0];
    expect(first.txnDate.toISOString().slice(0, 10)).toBe('2026-03-02');
    expect(first.amountCents).toBe(4500);
    expect(first.description).toContain('TAN WEI MING');
  });

  it('reads Singapore dates day-first', () => {
    const result = parseStatement(csv(['05/03/2026,ITR,,45.00,PAYNOW,FROM: X,OTHR']), {
      fileName: 'x.csv',
    });
    // 05/03 is 5 March in Singapore, never 3 May.
    expect(result.lines[0].txnDate.toISOString().slice(0, 10)).toBe('2026-03-05');
  });
});

describe('statement duplicate detection', () => {
  beforeEach(resetDb);
  afterAll(() => prisma.$disconnect());

  it('hashes a line on date, amount and normalised description', () => {
    const date = new Date('2026-03-02T00:00:00Z');
    expect(hashLine(date, 4500, 'PAYNOW  FROM: TAN')).toBe(
      hashLine(date, 4500, 'paynow from: tan'),
    );
    expect(hashLine(date, 4500, 'PAYNOW FROM: TAN')).not.toBe(
      hashLine(date, 4600, 'PAYNOW FROM: TAN'),
    );
  });

  it('flags a line already processed in a completed prior upload', async () => {
    const player = await createPlayer({ name: 'Tan Wei Ming', mobile: '+65 9123 4567' });
    await createCharge(player.id, 4500, new Date('2026-02-01'));

    const rows = ['02 Mar 2026,ITR,,45.00,PAYNOW TRANSFER,FROM: TAN WEI MING,OTHR'];

    const first = await uploadStatement({ buffer: csv(rows), fileName: 'march-1.csv' });
    expect(first.duplicateCount).toBe(0);
    expect(first.autoMatchedCount).toBe(1);

    await confirmAllAutoMatched(first.statementUploadId);
    await completeReconciliation(first.statementUploadId);

    // Same line re-uploaded — must be caught and defaulted to IGNORED so the
    // player cannot be credited twice.
    const second = await uploadStatement({ buffer: csv(rows), fileName: 'march-1-again.csv' });
    expect(second.duplicateCount).toBe(1);
    expect(second.autoMatchedCount).toBe(0);

    const lines = await prisma.statementLine.findMany({
      where: { statementUploadId: second.statementUploadId },
    });
    expect(lines[0].matchStatus).toBe('IGNORED');
    expect(lines[0].duplicateOfLineId).not.toBeNull();
    expect(lines[0].matchReason).toContain('Already processed');

    // The re-upload cannot be completed, so the balance stays where it was.
    await expect(completeReconciliation(second.statementUploadId)).rejects.toThrow(
      'No lines are matched',
    );
    expect(await getPendingTotalCents(prisma, player.id)).toBe(0);
    expect(await prisma.payment.count()).toBe(1);
  });

  it('does not flag a duplicate against an upload that was never completed', async () => {
    const player = await createPlayer({ name: 'Tan Wei Ming' });
    await createCharge(player.id, 4500, new Date('2026-02-01'));
    const rows = ['02 Mar 2026,ITR,,45.00,PAYNOW TRANSFER,FROM: TAN WEI MING,OTHR'];

    await uploadStatement({ buffer: csv(rows), fileName: 'abandoned.csv' });
    const second = await uploadStatement({ buffer: csv(rows), fileName: 'retry.csv' });

    expect(second.duplicateCount).toBe(0);
    expect(second.autoMatchedCount).toBe(1);
  });

  it('flags a line repeated within the same statement file', async () => {
    const player = await createPlayer({ name: 'Tan Wei Ming' });
    await createCharge(player.id, 9000, new Date('2026-02-01'));

    const row = '02 Mar 2026,ITR,,45.00,PAYNOW TRANSFER,FROM: TAN WEI MING,OTHR';
    const result = await uploadStatement({ buffer: csv([row, row]), fileName: 'dupes.csv' });

    expect(result.duplicateCount).toBe(1);
    expect(result.autoMatchedCount).toBe(1);
  });
});

describe('auto-matching and reconciliation', () => {
  beforeEach(resetDb);
  afterAll(() => prisma.$disconnect());

  it('matches by exact amount, by name, and by mobile in the description', async () => {
    const byAmount = await createPlayer({ name: 'Amount Only' });
    const byName = await createPlayer({ name: 'Priya Nair' });
    const byMobile = await createPlayer({ name: 'Zzz Unmatchable', mobile: '+65 9111 2222' });

    await createCharge(byAmount.id, 12345, new Date('2026-01-01'));
    await createCharge(byName.id, 9000, new Date('2026-01-01'));
    await createCharge(byMobile.id, 7000, new Date('2026-01-01'));

    const result = await uploadStatement({
      buffer: csv([
        '02 Mar 2026,ITR,,123.45,INWARD CREDIT,REF 998,OTHR',
        '03 Mar 2026,ITR,,90.00,PAYNOW TRANSFER,FROM: PRIYA NAIR,OTHR',
        '04 Mar 2026,ITR,,70.00,PAYNOW TRANSFER,FROM 91112222,OTHR',
        '05 Mar 2026,ITR,,200.00,PAYNOW TRANSFER,FROM: SPONSOR PTE LTD,OTHR',
      ]),
      fileName: 'mixed.csv',
    });

    expect(result.autoMatchedCount).toBe(3);
    expect(result.unmatchedCount).toBe(1);

    const lines = await prisma.statementLine.findMany({
      where: { statementUploadId: result.statementUploadId },
      orderBy: { txnDate: 'asc' },
    });
    expect(lines[0].matchedPlayerId).toBe(byAmount.id);
    expect(lines[1].matchedPlayerId).toBe(byName.id);
    expect(lines[2].matchedPlayerId).toBe(byMobile.id);
    expect(lines[3].matchStatus).toBe('UNMATCHED');
  });

  it('leaves an ambiguous amount unmatched rather than guessing', async () => {
    const one = await createPlayer({ name: 'Aaa Bbb' });
    const two = await createPlayer({ name: 'Ccc Ddd' });
    await createCharge(one.id, 4500, new Date('2026-01-01'));
    await createCharge(two.id, 4500, new Date('2026-01-01'));

    const result = await uploadStatement({
      buffer: csv(['02 Mar 2026,ITR,,45.00,INWARD CREDIT,NO NAME,OTHR']),
      fileName: 'ambiguous.csv',
    });

    expect(result.autoMatchedCount).toBe(0);
    expect(result.unmatchedCount).toBe(1);
  });

  it('creates no payments until the reconciliation is completed', async () => {
    const player = await createPlayer({ name: 'Priya Nair' });
    await createCharge(player.id, 9000, new Date('2026-01-01'));

    const upload = await uploadStatement({
      buffer: csv(['03 Mar 2026,ITR,,90.00,PAYNOW TRANSFER,FROM: PRIYA NAIR,OTHR']),
      fileName: 'staged.csv',
    });

    // Staged only — the balance is untouched.
    expect(await prisma.payment.count()).toBe(0);
    expect(await getPendingTotalCents(prisma, player.id)).toBe(9000);

    const summary = await completeReconciliation(upload.statementUploadId);

    expect(summary.totalReceived).toBe('90.00');
    expect(summary.paymentsCreated).toBe(1);
    expect(summary.chargesCleared).toBe(1);
    expect(summary.playersFullySettled).toBe(1);
    expect(await getPendingTotalCents(prisma, player.id)).toBe(0);

    const payment = await prisma.payment.findFirstOrThrow();
    expect(payment.source).toBe('STATEMENT');
    expect(payment.mode).toBe('PAYNOW');
    expect(payment.statementUploadId).toBe(upload.statementUploadId);
  });

  it('lets an admin assign an unmatched line and ignore a non-player credit', async () => {
    const { token } = await createAdmin();
    const player = await createPlayer({ name: 'Zzz Nomatch' });
    await createCharge(player.id, 3000, new Date('2026-01-01'));
    // A second player owing the same 30.00 makes the amount ambiguous, so the
    // 30.00 credit reaches the Unmatched tab instead of tier-1 auto-matching.
    const decoy = await createPlayer({ name: 'Yyy Decoy' });
    await createCharge(decoy.id, 3000, new Date('2026-01-01'));

    const upload = await uploadStatement({
      buffer: csv([
        '02 Mar 2026,ITR,,30.00,INWARD CREDIT,MYSTERY SENDER,OTHR',
        '03 Mar 2026,ITR,,500.00,INWARD CREDIT,SPONSOR PTE LTD,OTHR',
      ]),
      fileName: 'manual.csv',
    });

    const review = await api()
      .get(`/api/statements/${upload.statementUploadId}/review`)
      .set('Authorization', `Bearer ${token}`);
    expect(review.status).toBe(200);
    expect(review.body.unmatched).toHaveLength(2);

    const [mystery, sponsor] = review.body.unmatched;

    await api()
      .patch(`/api/statements/lines/${mystery.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ playerId: player.id });

    await api()
      .patch(`/api/statements/lines/${sponsor.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ ignore: true });

    const complete = await api()
      .post(`/api/statements/${upload.statementUploadId}/complete`)
      .set('Authorization', `Bearer ${token}`);

    expect(complete.status).toBe(200);
    expect(complete.body.totalReceived).toBe('30.00');
    expect(complete.body.linesIgnored).toBe(1);
    expect(await getPendingTotalCents(prisma, player.id)).toBe(0);
    // The ignored sponsor credit must not touch anyone's balance.
    expect(await getPendingTotalCents(prisma, decoy.id)).toBe(3000);
  });

  it('refuses to complete the same reconciliation twice', async () => {
    const player = await createPlayer({ name: 'Priya Nair' });
    await createCharge(player.id, 9000, new Date('2026-01-01'));
    const upload = await uploadStatement({
      buffer: csv(['03 Mar 2026,ITR,,90.00,PAYNOW TRANSFER,FROM: PRIYA NAIR,OTHR']),
      fileName: 'once.csv',
    });

    await completeReconciliation(upload.statementUploadId);
    await expect(completeReconciliation(upload.statementUploadId)).rejects.toThrow(
      'already been completed',
    );
    expect(await prisma.payment.count()).toBe(1);
  });

  it('remembers the column mapping after the first upload', async () => {
    await createPlayer({ name: 'Anyone' });
    await uploadStatement({
      buffer: csv(['02 Mar 2026,ITR,,45.00,INWARD CREDIT,X,OTHR']),
      fileName: 'first.csv',
    });

    const mapping = await prisma.columnMapping.findUnique({ where: { bankName: 'DBS' } });
    expect(mapping?.creditColumn).toBe('Credit Amount');
    expect(mapping?.headerRowIndex).toBe(3);
  });
});
