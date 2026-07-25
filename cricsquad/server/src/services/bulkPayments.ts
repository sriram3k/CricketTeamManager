import type { PaymentMode } from '@prisma/client';
import { prisma, type Db } from '../prisma.js';
import { badRequest, forbidden, notFound } from '../lib/errors.js';
import { type Cents, centsToString, toCents, toDecimal } from '../lib/money.js';
import {
  applyPaymentFifo,
  getOpenCharges,
  getPendingSummaries,
  planFifoAllocation,
  reversePayments,
} from './allocation.js';

/**
 * Feature 2 — bulk mark-as-paid.
 *
 * Two shapes of request share one code path:
 *   - mark the full pending balance paid for each selected player
 *   - pay a specific amount per player, allocated FIFO (partials allowed)
 *
 * The whole run is one transaction, and it is reversible for 24 hours.
 */

export const UNDO_WINDOW_HOURS = 24;

export interface BulkPaymentTarget {
  playerId: string;
  /** Omitted means "settle whatever is outstanding". */
  amountCents?: Cents;
}

export interface BulkPaymentInput {
  targets: BulkPaymentTarget[];
  mode: PaymentMode;
  reference?: string | null;
  receivedDate?: Date;
  performedByUserId: string;
}

export interface BulkPreviewRow {
  playerId: string;
  playerName: string;
  pendingBefore: string;
  amountToPay: string;
  chargesCleared: number;
  chargesPartiallyPaid: number;
  pendingAfter: string;
  unallocated: string;
  fullySettled: boolean;
  warning?: string;
}

export interface BulkPreview {
  rows: BulkPreviewRow[];
  playerCount: number;
  totalAmount: string;
  totalAmountCents: Cents;
  totalChargesCleared: number;
  playersFullySettled: number;
  totalUnallocated: string;
}

async function loadTargets(db: Db, targets: BulkPaymentTarget[]) {
  if (targets.length === 0) {
    throw badRequest('Select at least one player', { players: 'Select at least one player' });
  }

  const ids = targets.map((t) => t.playerId);
  if (new Set(ids).size !== ids.length) {
    throw badRequest('A player appears more than once in the selection', {
      players: 'Duplicate player in selection',
    });
  }

  const players = await db.player.findMany({ where: { id: { in: ids } } });
  const byId = new Map(players.map((p) => [p.id, p]));
  const missing = ids.filter((id) => !byId.has(id));
  if (missing.length > 0) {
    throw badRequest('One or more selected players no longer exist', {
      players: 'Selection contains an unknown player',
    });
  }
  return byId;
}

/**
 * Dry run of a bulk action — this is what the confirmation screen shows.
 * Uses exactly the same planner as the commit, so the numbers cannot diverge.
 */
export async function previewBulkPayment(
  db: Db,
  input: Pick<BulkPaymentInput, 'targets'>,
): Promise<BulkPreview> {
  const byId = await loadTargets(db, input.targets);

  const rows: BulkPreviewRow[] = [];
  let totalAmountCents = 0;
  let totalChargesCleared = 0;
  let playersFullySettled = 0;
  let totalUnallocated = 0;

  for (const target of input.targets) {
    const player = byId.get(target.playerId)!;
    const openCharges = await getOpenCharges(db, target.playerId);
    const pendingBefore = openCharges.reduce((s, c) => s + c.balanceCents, 0);

    const amountCents = target.amountCents ?? pendingBefore;
    const plan = planFifoAllocation(openCharges, amountCents);
    const pendingAfter = pendingBefore - plan.allocatedCents;

    let warning: string | undefined;
    if (pendingBefore === 0) {
      warning = 'This player has nothing outstanding';
    } else if (plan.unallocatedCents > 0) {
      warning = `${centsToString(plan.unallocatedCents)} exceeds what is owed and will not be allocated`;
    }

    const chargesPartiallyPaid = plan.allocations.filter((a) => !a.clearsCharge).length;

    rows.push({
      playerId: player.id,
      playerName: player.name,
      pendingBefore: centsToString(pendingBefore),
      amountToPay: centsToString(amountCents),
      chargesCleared: plan.chargesCleared,
      chargesPartiallyPaid,
      pendingAfter: centsToString(pendingAfter),
      unallocated: centsToString(plan.unallocatedCents),
      fullySettled: pendingAfter <= 0 && pendingBefore > 0,
      ...(warning ? { warning } : {}),
    });

    totalAmountCents += amountCents;
    totalChargesCleared += plan.chargesCleared;
    totalUnallocated += plan.unallocatedCents;
    if (pendingAfter <= 0 && pendingBefore > 0) playersFullySettled += 1;
  }

  return {
    rows,
    playerCount: rows.length,
    totalAmount: centsToString(totalAmountCents),
    totalAmountCents,
    totalChargesCleared,
    playersFullySettled,
    totalUnallocated: centsToString(totalUnallocated),
  };
}

export interface BulkPaymentResult {
  bulkActionId: string;
  playerCount: number;
  totalAmount: string;
  chargesCleared: number;
  playersFullySettled: number;
  paymentsCreated: number;
  undoAvailableUntil: string;
}

/** Commit a bulk mark-as-paid. Everything below happens in one transaction. */
export async function commitBulkPayment(input: BulkPaymentInput): Promise<BulkPaymentResult> {
  return prisma.$transaction(async (tx) => {
    const byId = await loadTargets(tx, input.targets);
    const receivedDate = input.receivedDate ?? new Date();

    const bulkAction = await tx.bulkAction.create({
      data: {
        performedById: input.performedByUserId,
        playerCount: input.targets.length,
        totalAmount: toDecimal(0), // rewritten below once amounts are known
        chargesCleared: 0,
        mode: input.mode,
        reference: input.reference ?? null,
      },
    });

    let totalCents = 0;
    let chargesCleared = 0;
    let playersFullySettled = 0;
    let paymentsCreated = 0;

    for (const target of input.targets) {
      // Resolve "pay everything outstanding" inside the transaction, so the
      // amount reflects the state at commit rather than at preview.
      const openCharges = await getOpenCharges(tx, target.playerId);
      const pendingBefore = openCharges.reduce((s, c) => s + c.balanceCents, 0);
      const amountCents = target.amountCents ?? pendingBefore;

      if (amountCents <= 0) {
        // Nothing owed and nothing specified — skip rather than record a zero payment.
        continue;
      }

      const result = await applyPaymentFifo(tx, {
        playerId: target.playerId,
        amountCents,
        mode: input.mode,
        reference: input.reference ?? null,
        receivedDate,
        source: 'MANUAL',
        bulkActionId: bulkAction.id,
      });

      totalCents += amountCents;
      chargesCleared += result.chargesCleared;
      paymentsCreated += 1;
      if (result.fullySettled && pendingBefore > 0) playersFullySettled += 1;
    }

    if (paymentsCreated === 0) {
      throw badRequest('None of the selected players have anything outstanding', {
        players: 'Nothing to pay for this selection',
      });
    }

    const updated = await tx.bulkAction.update({
      where: { id: bulkAction.id },
      data: {
        totalAmount: toDecimal(totalCents),
        chargesCleared,
        playerCount: paymentsCreated,
      },
    });

    // Referenced so the unused-variable check stays honest about byId usage.
    void byId;

    const undoUntil = new Date(updated.createdAt.getTime() + UNDO_WINDOW_HOURS * 3600_000);

    return {
      bulkActionId: bulkAction.id,
      playerCount: paymentsCreated,
      totalAmount: centsToString(totalCents),
      chargesCleared,
      playersFullySettled,
      paymentsCreated,
      undoAvailableUntil: undoUntil.toISOString(),
    };
  });
}

/** The most recent bulk action that is still inside its undo window. */
export async function getUndoableBulkAction(db: Db) {
  const cutoff = new Date(Date.now() - UNDO_WINDOW_HOURS * 3600_000);
  const action = await db.bulkAction.findFirst({
    where: { undoneAt: null, createdAt: { gte: cutoff } },
    orderBy: { createdAt: 'desc' },
    include: { performedBy: { select: { id: true, name: true, email: true } } },
  });
  if (!action) return null;

  return {
    id: action.id,
    playerCount: action.playerCount,
    totalAmount: centsToString(toCents(action.totalAmount)),
    chargesCleared: action.chargesCleared,
    mode: action.mode,
    reference: action.reference,
    createdAt: action.createdAt.toISOString(),
    performedBy: action.performedBy,
    undoAvailableUntil: new Date(
      action.createdAt.getTime() + UNDO_WINDOW_HOURS * 3600_000,
    ).toISOString(),
  };
}

export interface UndoResult {
  bulkActionId: string;
  paymentsReversed: number;
  chargesReopened: number;
}

/**
 * Undo a bulk action within 24 hours: delete its payments and allocations, and
 * reopen every charge that is no longer covered.
 */
export async function undoBulkAction(bulkActionId: string): Promise<UndoResult> {
  return prisma.$transaction(async (tx) => {
    const action = await tx.bulkAction.findUnique({
      where: { id: bulkActionId },
      include: { payments: { select: { id: true } } },
    });
    if (!action) throw notFound('Bulk action not found');
    if (action.undoneAt) throw badRequest('This bulk action has already been undone');

    const ageHours = (Date.now() - action.createdAt.getTime()) / 3600_000;
    if (ageHours > UNDO_WINDOW_HOURS) {
      throw forbidden(`Bulk actions can only be undone within ${UNDO_WINDOW_HOURS} hours`);
    }

    // Only the latest un-undone action may be reversed; undoing an older one
    // out of order would silently discard the effects layered on top of it.
    const latest = await tx.bulkAction.findFirst({
      where: { undoneAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (latest && latest.id !== bulkActionId) {
      throw badRequest('Only the most recent bulk action can be undone');
    }

    const paymentIds = action.payments.map((p) => p.id);
    const { chargesReopened } = await reversePayments(tx, paymentIds);

    await tx.bulkAction.update({
      where: { id: bulkActionId },
      data: { undoneAt: new Date() },
    });

    return {
      bulkActionId,
      paymentsReversed: paymentIds.length,
      chargesReopened,
    };
  });
}

export interface PendingPlayerRow {
  playerId: string;
  name: string;
  jerseyNumber: number | null;
  mobile: string | null;
  totalPending: string;
  totalPendingCents: Cents;
  oldestChargeDate: string | null;
  chargeCount: number;
}

/** The bulk screen's list: every player with something outstanding. */
export async function listPlayersWithPending(db: Db): Promise<PendingPlayerRow[]> {
  const summaries = await getPendingSummaries(db);
  if (summaries.size === 0) return [];

  const players = await db.player.findMany({
    where: { id: { in: [...summaries.keys()] } },
  });

  return players
    .map((p) => {
      const s = summaries.get(p.id)!;
      return {
        playerId: p.id,
        name: p.name,
        jerseyNumber: p.jerseyNumber,
        mobile: p.mobile,
        totalPending: centsToString(s.pendingCents),
        totalPendingCents: s.pendingCents,
        oldestChargeDate: s.oldestChargeDate?.toISOString() ?? null,
        chargeCount: s.chargeCount,
      };
    })
    .sort((a, b) => b.totalPendingCents - a.totalPendingCents);
}
