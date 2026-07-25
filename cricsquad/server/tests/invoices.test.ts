import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { api, createAdmin, createCharge, createPlayer, prisma, resetDb } from './helpers.js';
import { toDecimal } from '../src/lib/money.js';

/** Features 4 & 5 — invoice register, status transitions, audit, summary. */
describe('invoice status transitions', () => {
  beforeEach(resetDb);
  afterAll(() => prisma.$disconnect());

  async function tournament() {
    return prisma.tournament.create({
      data: {
        name: 'Invoice League',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
      },
    });
  }

  async function createInvoiceViaApi(token: string, tournamentId: string, overrides = {}) {
    return api()
      .post(`/api/tournaments/${tournamentId}/invoices`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        invoiceNumber: 'SCA-001',
        vendorName: 'Ground Hire Pte Ltd',
        amount: '1635.00',
        gstAmount: '135.00',
        dueDate: '2026-04-30',
        ...overrides,
      });
  }

  it('creates an UNPAID invoice and logs the CREATED audit entry', async () => {
    const { token, user } = await createAdmin();
    const t = await tournament();

    const res = await createInvoiceViaApi(token, t.id);

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('UNPAID');
    expect(res.body.amount).toBe('1635.00');
    expect(res.body.gstAmount).toBe('135.00');
    expect(res.body.audits).toHaveLength(1);
    expect(res.body.audits[0].action).toBe('CREATED');
    expect(res.body.audits[0].by.id).toBe(user.id);
  });

  it('requires a transaction reference to mark an invoice paid', async () => {
    const { token } = await createAdmin();
    const t = await tournament();
    const created = await createInvoiceViaApi(token, t.id);

    const res = await api()
      .post(`/api/invoices/${created.body.id}/mark-paid`)
      .set('Authorization', `Bearer ${token}`)
      .send({ paymentMode: 'PAYNOW' });

    expect(res.status).toBe(422);
    expect(res.body.fieldErrors.txnReference).toBeDefined();

    const unchanged = await prisma.invoice.findUniqueOrThrow({ where: { id: created.body.id } });
    expect(unchanged.status).toBe('UNPAID');
  });

  it('flips UNPAID → PAID and records reference, mode and date', async () => {
    const { token } = await createAdmin();
    const t = await tournament();
    const created = await createInvoiceViaApi(token, t.id);

    const res = await api()
      .post(`/api/invoices/${created.body.id}/mark-paid`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        txnReference: 'PAYNOW-20260315-771',
        paymentMode: 'BANK_TRANSFER',
        paidDate: '2026-03-15',
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('PAID');
    expect(res.body.txnReference).toBe('PAYNOW-20260315-771');
    expect(res.body.paymentMode).toBe('BANK_TRANSFER');
    expect(res.body.paidDate.slice(0, 10)).toBe('2026-03-15');
    expect(res.body.isOverdue).toBe(false);

    const actions = res.body.audits.map((a: { action: string }) => a.action);
    expect(actions).toContain('MARKED_PAID');
  });

  it('makes a paid invoice immutable until it is reopened', async () => {
    const { token } = await createAdmin();
    const t = await tournament();
    const created = await createInvoiceViaApi(token, t.id);

    await api()
      .post(`/api/invoices/${created.body.id}/mark-paid`)
      .set('Authorization', `Bearer ${token}`)
      .send({ txnReference: 'REF-1', paymentMode: 'PAYNOW' });

    const edit = await api()
      .patch(`/api/invoices/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: '2000.00' });
    expect(edit.status).toBe(400);
    expect(edit.body.message).toContain('Reopen it first');

    const payAgain = await api()
      .post(`/api/invoices/${created.body.id}/mark-paid`)
      .set('Authorization', `Bearer ${token}`)
      .send({ txnReference: 'REF-2', paymentMode: 'CASH' });
    expect(payAgain.status).toBe(400);
    expect(payAgain.body.message).toContain('already marked as paid');
  });

  it('reopening clears the payment fields and logs who did it', async () => {
    const { token, user } = await createAdmin();
    const t = await tournament();
    const created = await createInvoiceViaApi(token, t.id);

    await api()
      .post(`/api/invoices/${created.body.id}/mark-paid`)
      .set('Authorization', `Bearer ${token}`)
      .send({ txnReference: 'REF-1', paymentMode: 'PAYNOW', paidDate: '2026-03-15' });

    const res = await api()
      .post(`/api/invoices/${created.body.id}/reopen`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'Paid against the wrong invoice' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('UNPAID');
    expect(res.body.txnReference).toBeNull();
    expect(res.body.paymentMode).toBeNull();
    expect(res.body.paidDate).toBeNull();

    const reopened = res.body.audits.find((a: { action: string }) => a.action === 'REOPENED');
    expect(reopened.by.id).toBe(user.id);
    expect(reopened.detail).toContain('Paid against the wrong invoice');
    expect(reopened.detail).toContain('REF-1'); // the cleared values are preserved in the log
    expect(reopened.at).toBeTruthy();

    // Editing works again once reopened.
    const edit = await api()
      .patch(`/api/invoices/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: '2000.00' });
    expect(edit.status).toBe(200);
    expect(edit.body.amount).toBe('2000.00');
    expect(edit.body.audits.some((a: { action: string }) => a.action === 'EDITED')).toBe(true);
  });

  it('refuses to reopen an invoice that was never paid', async () => {
    const { token } = await createAdmin();
    const t = await tournament();
    const created = await createInvoiceViaApi(token, t.id);

    const res = await api()
      .post(`/api/invoices/${created.body.id}/reopen`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Only a paid invoice');
  });

  it('rejects a duplicate invoice number within the same tournament', async () => {
    const { token } = await createAdmin();
    const t = await tournament();
    await createInvoiceViaApi(token, t.id);

    const res = await createInvoiceViaApi(token, t.id);
    expect(res.status).toBe(409);
    expect(res.body.fieldErrors.invoiceNumber).toBeDefined();
  });

  it('rejects GST larger than the invoice total', async () => {
    const { token } = await createAdmin();
    const t = await tournament();

    const res = await createInvoiceViaApi(token, t.id, { amount: '100.00', gstAmount: '150.00' });
    expect(res.status).toBe(400);
    expect(res.body.fieldErrors.gstAmount).toBeDefined();
  });

  it('marks an unpaid invoice past its due date as overdue', async () => {
    const { token } = await createAdmin();
    const t = await tournament();
    const created = await createInvoiceViaApi(token, t.id, { dueDate: '2020-01-01' });
    expect(created.body.isOverdue).toBe(true);
  });

  it('reports whether the tournament is cash-positive', async () => {
    const { token } = await createAdmin();
    const t = await tournament();

    // Vendor side: 1635.00 invoiced, of which 1000.00 has been paid out.
    // Both due well in the future so the overdue count is date-independent.
    await createInvoiceViaApi(token, t.id, { dueDate: '2099-12-31' });
    const paid = await createInvoiceViaApi(token, t.id, {
      invoiceNumber: 'SCA-002',
      amount: '1000.00',
      gstAmount: '0',
      dueDate: '2099-12-31',
    });
    await api()
      .post(`/api/invoices/${paid.body.id}/mark-paid`)
      .set('Authorization', `Bearer ${token}`)
      .send({ txnReference: 'REF-9', paymentMode: 'PAYNOW' });

    // Player side: two players charged 45.00 each for a match in this
    // tournament; one has paid.
    const match = await prisma.match.create({
      data: {
        tournamentId: t.id,
        opponent: 'Someone',
        matchDate: new Date('2026-03-01'),
        matchFee: toDecimal(4500),
      },
    });
    const payer = await createPlayer({ name: 'Payer' });
    const owing = await createPlayer({ name: 'Owing' });
    for (const p of [payer, owing]) {
      await prisma.charge.create({
        data: {
          playerId: p.id,
          type: 'MATCH_FEE',
          amount: toDecimal(4500),
          description: 'Match fee',
          matchId: match.id,
          status: 'PENDING',
          createdAt: new Date('2026-03-01'),
        },
      });
    }
    // An ad-hoc charge must NOT count toward tournament figures. Dated after
    // the match fee so FIFO applies the payment to the match fee first —
    // allocation is club-wide and does not respect tournament boundaries.
    await createCharge(payer.id, 6000, new Date('2026-06-01'), 'Club registration');

    const { applyPaymentFifo } = await import('../src/services/allocation.js');
    await prisma.$transaction((tx) =>
      applyPaymentFifo(tx, { playerId: payer.id, amountCents: 4500, mode: 'PAYNOW' }),
    );

    const res = await api()
      .get(`/api/tournaments/${t.id}/financials`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.invoices.totalInvoiced).toBe('2635.00');
    expect(res.body.invoices.totalPaid).toBe('1000.00');
    expect(res.body.invoices.totalOutstanding).toBe('1635.00');
    expect(res.body.invoices.overdueCount).toBe(0);

    // 90.00 charged for the tournament's match, 45.00 collected — the 60.00
    // ad-hoc charge is club-wide and excluded.
    expect(res.body.playerDues.totalCharged).toBe('90.00');
    expect(res.body.playerDues.totalCollected).toBe('45.00');
    expect(res.body.playerDues.totalPending).toBe('45.00');

    // 45.00 in from players minus 1000.00 out to vendors.
    expect(res.body.netPosition).toBe('-955.00');
    expect(res.body.isCashPositive).toBe(false);
  });

  it('lets a non-admin nowhere near the invoice register', async () => {
    const t = await tournament();
    const player = await createPlayer({ name: 'Nosy' });
    const { createPlayerUser } = await import('./helpers.js');
    const playerToken = await createPlayerUser(player.id, 'nosy@test.example');

    const res = await api()
      .get(`/api/tournaments/${t.id}/invoices`)
      .set('Authorization', `Bearer ${playerToken}`);

    expect(res.status).toBe(403);
  });
});

describe('invoice extraction', () => {
  beforeEach(resetDb);
  afterAll(() => prisma.$disconnect());

  it('returns editable fields from an upload without creating the invoice', async () => {
    const { token } = await createAdmin();
    // A tiny valid PNG; the mock extractor is deterministic on its bytes.
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    );

    const res = await api()
      .post('/api/invoices/extract')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', png, { filename: 'INV-2026-0042.png', contentType: 'image/png' });

    expect(res.status).toBe(200);
    expect(res.body.extracted.succeeded).toBe(true);
    expect(res.body.extracted.provider).toBe('mock');
    expect(res.body.extracted.invoiceNumber).toBe('INV-2026-0042');
    expect(res.body.file.url).toMatch(/^\/api\/files\/invoices\//);

    // Extraction stages fields for review; it does not save an invoice.
    expect(await prisma.invoice.count()).toBe(0);
  });

  it('rejects a file type it cannot read', async () => {
    const { token } = await createAdmin();
    const res = await api()
      .post('/api/invoices/extract')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('nope'), {
        filename: 'notes.txt',
        contentType: 'text/plain',
      });

    expect(res.status).toBe(400);
    expect(res.body.fieldErrors.file).toBeDefined();
  });
});
