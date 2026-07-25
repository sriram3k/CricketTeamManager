import { Prisma, type PaymentMode, type PaymentSource } from '@prisma/client';
import type { Db } from '../prisma.js';
import { type Cents, toCents, toDecimal } from '../lib/money.js';

/**
 * FIFO allocation — the single place money is applied to charges.
 *
 * Both bulk mark-as-paid (Feature 2) and statement reconciliation (Feature 3)
 * go through here so the two paths can never drift apart. Every function takes
 * a `Db`, which is either the PrismaClient or a transaction client; callers are
 * expected to pass a transaction.
 */

export interface OpenCharge {
  id: string;
  createdAt: Date;
  amountCents: Cents;
  allocatedCents: Cents;
  /** amount - already allocated */
  balanceCents: Cents;
  type: string;
  description: string;
  dueDate: Date | null;
}

/**
 * Every PENDING charge for a player, oldest first, with the balance still owed
 * after any earlier partial allocations.
 */
export async function getOpenCharges(db: Db, playerId: string): Promise<OpenCharge[]> {
  const charges = await db.charge.findMany({
    where: { playerId, status: 'PENDING' },
    include: { allocations: true },
    // FIFO: oldest charge first. id breaks ties so ordering is deterministic
    // when several charges are generated in the same transaction.
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });

  return charges.map((c) => {
    const amountCents = toCents(c.amount);
    const allocatedCents = c.allocations.reduce((sum, a) => sum + toCents(a.amountAllocated), 0);
    return {
      id: c.id,
      createdAt: c.createdAt,
      amountCents,
      allocatedCents,
      balanceCents: amountCents - allocatedCents,
      type: c.type,
      description: c.description,
      dueDate: c.dueDate,
    };
  });
}

/** Total still owed by a player across all PENDING charges. */
export async function getPendingTotalCents(db: Db, playerId: string): Promise<Cents> {
  const charges = await getOpenCharges(db, playerId);
  return charges.reduce((sum, c) => sum + c.balanceCents, 0);
}

export interface PlannedAllocation {
  chargeId: string;
  amountCents: Cents;
  /** True when this allocation closes the charge out entirely. */
  clearsCharge: boolean;
}

export interface AllocationPlan {
  allocations: PlannedAllocation[];
  allocatedCents: Cents;
  /** Money left over after every open charge is settled (an overpayment). */
  unallocatedCents: Cents;
  chargesCleared: number;
}

/**
 * Work out how `amountCents` lands across the open charges, oldest first.
 * Pure — makes no writes — so it can back both the confirmation preview and
 * the committing write, guaranteeing the preview matches what happens.
 */
export function planFifoAllocation(openCharges: OpenCharge[], amountCents: Cents): AllocationPlan {
  const allocations: PlannedAllocation[] = [];
  let remaining = amountCents;
  let chargesCleared = 0;

  for (const charge of openCharges) {
    if (remaining <= 0) break;
    if (charge.balanceCents <= 0) continue;

    const applied = Math.min(remaining, charge.balanceCents);
    const clearsCharge = applied === charge.balanceCents;

    allocations.push({ chargeId: charge.id, amountCents: applied, clearsCharge });
    if (clearsCharge) chargesCleared += 1;
    remaining -= applied;
  }

  return {
    allocations,
    allocatedCents: amountCents - remaining,
    unallocatedCents: remaining,
    chargesCleared,
  };
}

export interface ApplyPaymentInput {
  playerId: string;
  amountCents: Cents;
  mode: PaymentMode;
  reference?: string | null;
  receivedDate?: Date;
  source?: PaymentSource;
  statementUploadId?: string | null;
  bulkActionId?: string | null;
}

export interface ApplyPaymentResult {
  paymentId: string;
  allocatedCents: Cents;
  unallocatedCents: Cents;
  chargesCleared: number;
  /** True when the player has nothing outstanding after this payment. */
  fullySettled: boolean;
}

/**
 * Create a Payment and allocate it FIFO against the player's open charges,
 * flipping any fully-covered charge to PAID. Partial allocations deliberately
 * leave the charge PENDING with a reduced balance.
 *
 * Must be called inside a transaction.
 */
export async function applyPaymentFifo(
  db: Db,
  input: ApplyPaymentInput,
): Promise<ApplyPaymentResult> {
  const openCharges = await getOpenCharges(db, input.playerId);
  const plan = planFifoAllocation(openCharges, input.amountCents);

  const payment = await db.payment.create({
    data: {
      playerId: input.playerId,
      amount: toDecimal(input.amountCents),
      mode: input.mode,
      reference: input.reference ?? null,
      receivedDate: input.receivedDate ?? new Date(),
      source: input.source ?? 'MANUAL',
      statementUploadId: input.statementUploadId ?? null,
      bulkActionId: input.bulkActionId ?? null,
    },
  });

  if (plan.allocations.length > 0) {
    await db.paymentAllocation.createMany({
      data: plan.allocations.map((a) => ({
        paymentId: payment.id,
        chargeId: a.chargeId,
        amountAllocated: toDecimal(a.amountCents),
      })),
    });

    const clearedIds = plan.allocations.filter((a) => a.clearsCharge).map((a) => a.chargeId);
    if (clearedIds.length > 0) {
      await db.charge.updateMany({
        where: { id: { in: clearedIds } },
        data: { status: 'PAID', paidAt: input.receivedDate ?? new Date() },
      });
    }
  }

  const totalOpenAfter = openCharges.reduce((sum, c) => sum + c.balanceCents, 0) - plan.allocatedCents;

  return {
    paymentId: payment.id,
    allocatedCents: plan.allocatedCents,
    unallocatedCents: plan.unallocatedCents,
    chargesCleared: plan.chargesCleared,
    fullySettled: totalOpenAfter <= 0,
  };
}

/**
 * Reverse a set of payments: drop their allocations and reopen any charge that
 * is no longer fully covered. Used by bulk-action undo.
 *
 * Must be called inside a transaction.
 */
export async function reversePayments(db: Db, paymentIds: string[]): Promise<{ chargesReopened: number }> {
  if (paymentIds.length === 0) return { chargesReopened: 0 };

  const allocations = await db.paymentAllocation.findMany({
    where: { paymentId: { in: paymentIds } },
    select: { chargeId: true },
  });
  const affectedChargeIds = [...new Set(allocations.map((a) => a.chargeId))];

  await db.paymentAllocation.deleteMany({ where: { paymentId: { in: paymentIds } } });
  await db.payment.deleteMany({ where: { id: { in: paymentIds } } });

  let chargesReopened = 0;
  for (const chargeId of affectedChargeIds) {
    const charge = await db.charge.findUnique({
      where: { id: chargeId },
      include: { allocations: true },
    });
    if (!charge) continue;
    // A WAIVED charge is an admin decision, not a payment outcome — leave it be.
    if (charge.status === 'WAIVED') continue;

    const stillAllocated = charge.allocations.reduce((s, a) => s + toCents(a.amountAllocated), 0);
    const isCovered = stillAllocated >= toCents(charge.amount);

    if (!isCovered && charge.status === 'PAID') {
      await db.charge.update({
        where: { id: chargeId },
        data: { status: 'PENDING', paidAt: null },
      });
      chargesReopened += 1;
    }
  }

  return { chargesReopened };
}

/** Convenience for list screens: pending totals for many players in one pass. */
export async function getPendingSummaries(
  db: Db,
  playerIds?: string[],
): Promise<Map<string, { pendingCents: Cents; oldestChargeDate: Date | null; chargeCount: number }>> {
  const charges = await db.charge.findMany({
    where: {
      status: 'PENDING',
      ...(playerIds ? { playerId: { in: playerIds } } : {}),
    },
    include: { allocations: true },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });

  const map = new Map<string, { pendingCents: Cents; oldestChargeDate: Date | null; chargeCount: number }>();
  for (const c of charges) {
    const balance = toCents(c.amount) - c.allocations.reduce((s, a) => s + toCents(a.amountAllocated), 0);
    if (balance <= 0) continue;

    const existing = map.get(c.playerId);
    if (existing) {
      existing.pendingCents += balance;
      existing.chargeCount += 1;
    } else {
      // Charges arrive oldest-first, so the first one seen is the oldest.
      map.set(c.playerId, {
        pendingCents: balance,
        oldestChargeDate: c.createdAt,
        chargeCount: 1,
      });
    }
  }
  return map;
}

export { Prisma };
