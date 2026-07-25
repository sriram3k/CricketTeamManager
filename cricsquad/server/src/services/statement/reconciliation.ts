import type { LineMatchStatus } from '@prisma/client';
import { prisma, type Db } from '../../prisma.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { centsToString, toCents, toDecimal } from '../../lib/money.js';
import { applyPaymentFifo, getOpenCharges } from '../allocation.js';
import { DBS_BANK_NAME, DBS_DEFAULT_MAPPING, parseStatement, type ColumnMappingSpec } from './parser.js';
import { proposeMatch, type MatchCandidate } from './matcher.js';

/**
 * Feature 3 — upload, review, and commit a fortnightly bank statement.
 *
 * Nothing touches a player's balance at upload time: lines are staged with a
 * proposed match, the admin reviews them, and only "Complete reconciliation"
 * writes payments — in one transaction.
 */

/** Every active player with something outstanding, shaped for the matcher. */
async function loadCandidates(db: Db): Promise<MatchCandidate[]> {
  const players = await db.player.findMany({ where: { active: true } });

  const candidates: MatchCandidate[] = [];
  for (const player of players) {
    const open = await getOpenCharges(db, player.id);
    candidates.push({
      playerId: player.id,
      name: player.name,
      mobile: player.mobile,
      pendingCents: open.reduce((s, c) => s + c.balanceCents, 0),
      openChargeAmounts: open.map((c) => c.balanceCents),
    });
  }
  return candidates;
}

export async function getColumnMapping(
  db: Db,
  bankName = DBS_BANK_NAME,
): Promise<ColumnMappingSpec | null> {
  const stored = await db.columnMapping.findUnique({ where: { bankName } });
  if (!stored) return null;
  return {
    dateColumn: stored.dateColumn,
    descriptionColumn: stored.descriptionColumn,
    creditColumn: stored.creditColumn,
    debitColumn: stored.debitColumn,
    extraDescriptionColumns: stored.extraDescriptionColumns,
    dateFormat: stored.dateFormat,
    headerRowIndex: stored.headerRowIndex,
  };
}

/** Remember a mapping so this bank's export is only mapped once. */
export async function saveColumnMapping(
  spec: ColumnMappingSpec,
  bankName = DBS_BANK_NAME,
): Promise<void> {
  const data = {
    dateColumn: spec.dateColumn,
    descriptionColumn: spec.descriptionColumn,
    creditColumn: spec.creditColumn,
    debitColumn: spec.debitColumn ?? null,
    extraDescriptionColumns: spec.extraDescriptionColumns,
    dateFormat: spec.dateFormat,
    headerRowIndex: spec.headerRowIndex,
  };
  await prisma.columnMapping.upsert({
    where: { bankName },
    create: { bankName, ...data },
    update: data,
  });
}

export interface UploadStatementInput {
  buffer: Buffer;
  fileName: string;
  storageKey?: string | null;
  bankName?: string;
  /** Overrides the stored mapping for this upload, then becomes the stored one. */
  mapping?: Partial<ColumnMappingSpec> | null;
}

export interface UploadStatementResult {
  statementUploadId: string;
  fileName: string;
  periodFrom: string;
  periodTo: string;
  totalLines: number;
  autoMatchedCount: number;
  unmatchedCount: number;
  duplicateCount: number;
  skipped: Array<{ rowNumber: number; reason: string }>;
  detectedHeaders: string[];
  mapping: ColumnMappingSpec;
}

/**
 * Parse a statement and stage its lines with proposed matches. Creates no
 * payments — a line only becomes money at reconciliation.
 */
export async function uploadStatement(
  input: UploadStatementInput,
): Promise<UploadStatementResult> {
  const bankName = input.bankName ?? DBS_BANK_NAME;
  const stored = await getColumnMapping(prisma, bankName);
  const parsed = parseStatement(input.buffer, {
    fileName: input.fileName,
    mapping: input.mapping ?? stored ?? DBS_DEFAULT_MAPPING,
  });

  await saveColumnMapping(parsed.mapping, bankName);

  const candidates = await loadCandidates(prisma);

  // Any line hash already committed in a prior upload is a duplicate. Lines from
  // uploads that were never completed do not count.
  const hashes = parsed.lines.map((l) => l.lineHash);
  const priorLines = await prisma.statementLine.findMany({
    where: {
      lineHash: { in: hashes },
      matchStatus: { in: ['AUTO_MATCHED', 'MANUALLY_MATCHED'] },
      statementUpload: { status: 'COMPLETED' },
    },
    select: { id: true, lineHash: true },
  });
  const priorByHash = new Map(priorLines.map((l) => [l.lineHash, l.id]));

  // A statement can also repeat a line within itself; only the first is live.
  const seenInFile = new Set<string>();

  return prisma.$transaction(async (tx) => {
    const upload = await tx.statementUpload.create({
      data: {
        fileName: input.fileName,
        storageKey: input.storageKey ?? null,
        periodFrom: parsed.periodFrom,
        periodTo: parsed.periodTo,
        status: 'PROCESSING',
      },
    });

    let autoMatchedCount = 0;
    let unmatchedCount = 0;
    let duplicateCount = 0;

    for (const line of parsed.lines) {
      const duplicateOf = priorByHash.get(line.lineHash) ?? null;
      const repeatedInFile = seenInFile.has(line.lineHash);
      seenInFile.add(line.lineHash);

      let matchStatus: LineMatchStatus = 'UNMATCHED';
      let matchedPlayerId: string | null = null;
      let matchReason: string | null = null;
      let matchConfidence: number | null = null;

      if (duplicateOf || repeatedInFile) {
        // Default a duplicate to IGNORED so completing the reconciliation
        // cannot double-charge; the admin can still flip it back on review.
        matchStatus = 'IGNORED';
        matchReason = duplicateOf
          ? 'Already processed in an earlier statement upload'
          : 'Repeated line within this statement';
        duplicateCount += 1;
      } else {
        const proposal = proposeMatch(line, candidates);
        if (proposal.playerId) {
          matchStatus = 'AUTO_MATCHED';
          matchedPlayerId = proposal.playerId;
          autoMatchedCount += 1;
        } else {
          unmatchedCount += 1;
        }
        matchReason = proposal.reason;
        matchConfidence = Math.round(proposal.confidence * 100);
      }

      await tx.statementLine.create({
        data: {
          statementUploadId: upload.id,
          txnDate: line.txnDate,
          description: line.description,
          amount: toDecimal(line.amountCents),
          matchStatus,
          matchedPlayerId,
          matchReason,
          matchConfidence,
          lineHash: line.lineHash,
          duplicateOfLineId: duplicateOf,
        },
      });
    }

    await tx.statementUpload.update({
      where: { id: upload.id },
      data: { status: 'REVIEWED', matchedCount: autoMatchedCount, unmatchedCount },
    });

    return {
      statementUploadId: upload.id,
      fileName: upload.fileName,
      periodFrom: parsed.periodFrom.toISOString(),
      periodTo: parsed.periodTo.toISOString(),
      totalLines: parsed.lines.length,
      autoMatchedCount,
      unmatchedCount,
      duplicateCount,
      skipped: parsed.skipped,
      detectedHeaders: parsed.detectedHeaders,
      mapping: parsed.mapping,
    };
  });
}

export interface ReviewLine {
  id: string;
  txnDate: string;
  description: string;
  amount: string;
  matchStatus: LineMatchStatus;
  matchReason: string | null;
  matchConfidence: number | null;
  isDuplicate: boolean;
  proposedPlayer: { id: string; name: string; jerseyNumber: number | null } | null;
  /** What the player still owes — shown so partial payments are obvious. */
  playerPending: string | null;
}

export interface ReviewScreen {
  upload: {
    id: string;
    fileName: string;
    periodFrom: string;
    periodTo: string;
    status: string;
    uploadedAt: string;
  };
  autoMatched: ReviewLine[];
  unmatched: ReviewLine[];
  ignored: ReviewLine[];
  totals: { received: string; autoMatched: string; unmatched: string; ignored: string };
}

/** The three-tab review screen. */
export async function getReviewScreen(db: Db, uploadId: string): Promise<ReviewScreen> {
  const upload = await db.statementUpload.findUnique({
    where: { id: uploadId },
    include: {
      lines: {
        include: { matchedPlayer: true },
        orderBy: [{ txnDate: 'asc' }, { id: 'asc' }],
      },
    },
  });
  if (!upload) throw notFound('Statement upload not found');

  const pendingByPlayer = new Map<string, number>();
  for (const line of upload.lines) {
    if (line.matchedPlayerId && !pendingByPlayer.has(line.matchedPlayerId)) {
      const open = await getOpenCharges(db, line.matchedPlayerId);
      pendingByPlayer.set(
        line.matchedPlayerId,
        open.reduce((s, c) => s + c.balanceCents, 0),
      );
    }
  }

  const toReviewLine = (line: (typeof upload.lines)[number]): ReviewLine => ({
    id: line.id,
    txnDate: line.txnDate.toISOString(),
    description: line.description,
    amount: centsToString(toCents(line.amount)),
    matchStatus: line.matchStatus,
    matchReason: line.matchReason,
    matchConfidence: line.matchConfidence,
    isDuplicate: line.duplicateOfLineId !== null,
    proposedPlayer: line.matchedPlayer
      ? {
          id: line.matchedPlayer.id,
          name: line.matchedPlayer.name,
          jerseyNumber: line.matchedPlayer.jerseyNumber,
        }
      : null,
    playerPending: line.matchedPlayerId
      ? centsToString(pendingByPlayer.get(line.matchedPlayerId) ?? 0)
      : null,
  });

  const rows = upload.lines.map(toReviewLine);
  const sum = (list: ReviewLine[]) =>
    centsToString(list.reduce((s, l) => s + toCents(l.amount), 0));

  const autoMatched = rows.filter(
    (l) => l.matchStatus === 'AUTO_MATCHED' || l.matchStatus === 'MANUALLY_MATCHED',
  );
  const unmatched = rows.filter((l) => l.matchStatus === 'UNMATCHED');
  const ignored = rows.filter((l) => l.matchStatus === 'IGNORED');

  return {
    upload: {
      id: upload.id,
      fileName: upload.fileName,
      periodFrom: upload.periodFrom.toISOString(),
      periodTo: upload.periodTo.toISOString(),
      status: upload.status,
      uploadedAt: upload.uploadedAt.toISOString(),
    },
    autoMatched,
    unmatched,
    ignored,
    totals: {
      received: sum(rows),
      autoMatched: sum(autoMatched),
      unmatched: sum(unmatched),
      ignored: sum(ignored),
    },
  };
}

/** Assign a player to a line, or mark it ignored (a non-player credit). */
export async function updateLine(
  lineId: string,
  update: { playerId?: string | null; ignore?: boolean },
) {
  return prisma.$transaction(async (tx) => {
    const line = await tx.statementLine.findUnique({
      where: { id: lineId },
      include: { statementUpload: true },
    });
    if (!line) throw notFound('Statement line not found');
    if (line.statementUpload.status === 'COMPLETED') {
      throw badRequest('This reconciliation is already complete and cannot be changed');
    }

    if (update.ignore) {
      return tx.statementLine.update({
        where: { id: lineId },
        data: { matchStatus: 'IGNORED', matchedPlayerId: null, matchReason: 'Ignored by admin' },
      });
    }

    if (update.playerId === null) {
      return tx.statementLine.update({
        where: { id: lineId },
        data: { matchStatus: 'UNMATCHED', matchedPlayerId: null, matchReason: 'Cleared by admin' },
      });
    }

    if (update.playerId) {
      const player = await tx.player.findUnique({ where: { id: update.playerId } });
      if (!player) throw badRequest('That player no longer exists', { playerId: 'Unknown player' });

      return tx.statementLine.update({
        where: { id: lineId },
        data: {
          matchStatus: 'MANUALLY_MATCHED',
          matchedPlayerId: update.playerId,
          matchReason: `Assigned to ${player.name} by admin`,
          matchConfidence: 100,
        },
      });
    }

    throw badRequest('Specify a player to assign, or mark the line as ignored');
  });
}

/** Confirm every auto-matched line at once. */
export async function confirmAllAutoMatched(uploadId: string): Promise<{ confirmed: number }> {
  const result = await prisma.statementLine.updateMany({
    where: { statementUploadId: uploadId, matchStatus: 'AUTO_MATCHED' },
    data: { matchStatus: 'MANUALLY_MATCHED' },
  });
  return { confirmed: result.count };
}

export interface ReconciliationSummary {
  statementUploadId: string;
  totalReceived: string;
  paymentsCreated: number;
  chargesCleared: number;
  playersFullySettled: number;
  linesIgnored: number;
  linesUnmatched: number;
  unallocated: string;
  playerBreakdown: Array<{
    playerId: string;
    playerName: string;
    received: string;
    chargesCleared: number;
    stillPending: string;
    fullySettled: boolean;
  }>;
}

/**
 * Commit the reconciliation: every matched line becomes a STATEMENT payment,
 * allocated FIFO. One transaction — either the whole statement lands or none
 * of it does.
 */
export async function completeReconciliation(uploadId: string): Promise<ReconciliationSummary> {
  return prisma.$transaction(async (tx) => {
    const upload = await tx.statementUpload.findUnique({
      where: { id: uploadId },
      include: { lines: { include: { matchedPlayer: true } } },
    });
    if (!upload) throw notFound('Statement upload not found');
    if (upload.status === 'COMPLETED') {
      throw badRequest('This reconciliation has already been completed');
    }

    const matchedLines = upload.lines.filter(
      (l) =>
        (l.matchStatus === 'AUTO_MATCHED' || l.matchStatus === 'MANUALLY_MATCHED') &&
        l.matchedPlayerId,
    );

    if (matchedLines.length === 0) {
      throw badRequest('No lines are matched to a player yet', {
        lines: 'Match at least one line before completing',
      });
    }

    let totalReceived = 0;
    let chargesCleared = 0;
    let unallocated = 0;
    const perPlayer = new Map<
      string,
      { name: string; received: number; chargesCleared: number; fullySettled: boolean }
    >();

    for (const line of matchedLines) {
      const playerId = line.matchedPlayerId!;
      const amountCents = toCents(line.amount);

      const result = await applyPaymentFifo(tx, {
        playerId,
        amountCents,
        // A bank credit is a transfer unless the narrative says otherwise.
        mode: /paynow/i.test(line.description) ? 'PAYNOW' : 'BANK_TRANSFER',
        reference: line.description.slice(0, 200),
        receivedDate: line.txnDate,
        source: 'STATEMENT',
        statementUploadId: upload.id,
      });

      await tx.statementLine.update({
        where: { id: line.id },
        data: { paymentId: result.paymentId },
      });

      totalReceived += amountCents;
      chargesCleared += result.chargesCleared;
      unallocated += result.unallocatedCents;

      const existing = perPlayer.get(playerId);
      if (existing) {
        existing.received += amountCents;
        existing.chargesCleared += result.chargesCleared;
        existing.fullySettled = result.fullySettled;
      } else {
        perPlayer.set(playerId, {
          name: line.matchedPlayer?.name ?? 'Unknown',
          received: amountCents,
          chargesCleared: result.chargesCleared,
          fullySettled: result.fullySettled,
        });
      }
    }

    const breakdown = [];
    for (const [playerId, data] of perPlayer) {
      const open = await getOpenCharges(tx, playerId);
      breakdown.push({
        playerId,
        playerName: data.name,
        received: centsToString(data.received),
        chargesCleared: data.chargesCleared,
        stillPending: centsToString(open.reduce((s, c) => s + c.balanceCents, 0)),
        fullySettled: data.fullySettled,
      });
    }

    const linesIgnored = upload.lines.filter((l) => l.matchStatus === 'IGNORED').length;
    const linesUnmatched = upload.lines.filter((l) => l.matchStatus === 'UNMATCHED').length;

    await tx.statementUpload.update({
      where: { id: uploadId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        matchedCount: matchedLines.length,
        unmatchedCount: linesUnmatched,
      },
    });

    return {
      statementUploadId: uploadId,
      totalReceived: centsToString(totalReceived),
      paymentsCreated: matchedLines.length,
      chargesCleared,
      playersFullySettled: breakdown.filter((b) => b.fullySettled).length,
      linesIgnored,
      linesUnmatched,
      unallocated: centsToString(unallocated),
      playerBreakdown: breakdown.sort((a, b) => a.playerName.localeCompare(b.playerName)),
    };
  });
}

export async function listStatementUploads(db: Db) {
  const uploads = await db.statementUpload.findMany({ orderBy: { uploadedAt: 'desc' } });
  return uploads.map((u) => ({
    id: u.id,
    fileName: u.fileName,
    uploadedAt: u.uploadedAt.toISOString(),
    periodFrom: u.periodFrom.toISOString(),
    periodTo: u.periodTo.toISOString(),
    status: u.status,
    matchedCount: u.matchedCount,
    unmatchedCount: u.unmatchedCount,
    completedAt: u.completedAt?.toISOString() ?? null,
  }));
}
