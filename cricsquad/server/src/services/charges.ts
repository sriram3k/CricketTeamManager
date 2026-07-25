import type { ChargeType } from '@prisma/client';
import { prisma, type Db } from '../prisma.js';
import { badRequest, notFound } from '../lib/errors.js';
import { type Cents, centsToString, toCents, toDecimal } from '../lib/money.js';
import { getOpenCharges } from './allocation.js';

/**
 * Ad-hoc charges and the per-player dues view (Feature 1).
 */

export type AdhocChargeType = Extract<
  ChargeType,
  'REGISTRATION_FEE' | 'JERSEY_FEE' | 'ADHOC'
>;

export interface RaiseAdhocInput {
  type: AdhocChargeType;
  amountCents: Cents;
  description: string;
  dueDate?: Date | null;
  /** Explicit list of players, or every active player when target is 'ALL'. */
  target: { kind: 'PLAYERS'; playerIds: string[] } | { kind: 'ALL_ACTIVE' };
}

export interface RaiseAdhocResult {
  chargesCreated: number;
  playerCount: number;
  totalCents: Cents;
  playerIds: string[];
}

/**
 * Raise the same charge against one player, a selected set, or every active
 * player, in a single transaction.
 */
export async function raiseAdhocCharges(input: RaiseAdhocInput): Promise<RaiseAdhocResult> {
  if (!input.description.trim()) {
    throw badRequest('Description is required', { description: 'Enter a description' });
  }

  return prisma.$transaction(async (tx) => {
    let playerIds: string[];

    if (input.target.kind === 'ALL_ACTIVE') {
      const players = await tx.player.findMany({
        where: { active: true },
        select: { id: true },
        orderBy: { name: 'asc' },
      });
      playerIds = players.map((p) => p.id);
    } else {
      playerIds = [...new Set(input.target.playerIds)];
      if (playerIds.length === 0) {
        throw badRequest('Select at least one player', { players: 'Select at least one player' });
      }
      const found = await tx.player.findMany({
        where: { id: { in: playerIds } },
        select: { id: true, active: true, name: true },
      });
      if (found.length !== playerIds.length) {
        throw badRequest('One or more selected players no longer exist', {
          players: 'Selection contains an unknown player',
        });
      }
      const inactive = found.filter((p) => !p.active);
      if (inactive.length > 0) {
        throw badRequest(
          `Cannot charge inactive players: ${inactive.map((p) => p.name).join(', ')}`,
          { players: `Inactive: ${inactive.map((p) => p.name).join(', ')}` },
        );
      }
    }

    if (playerIds.length === 0) {
      throw badRequest('There are no active players to charge', {
        players: 'No active players',
      });
    }

    // Ad-hoc charges have no matchId, so the (playerId, matchId, type) unique
    // constraint does not apply — the same fee can legitimately be raised twice.
    await tx.charge.createMany({
      data: playerIds.map((playerId) => ({
        playerId,
        type: input.type,
        amount: toDecimal(input.amountCents),
        description: input.description.trim(),
        dueDate: input.dueDate ?? null,
        status: 'PENDING' as const,
      })),
    });

    return {
      chargesCreated: playerIds.length,
      playerCount: playerIds.length,
      totalCents: playerIds.length * input.amountCents,
      playerIds,
    };
  });
}

export interface PlayerDues {
  player: { id: string; name: string; jerseyNumber: number | null; mobile: string | null; active: boolean };
  totalPending: string;
  totalPendingCents: Cents;
  matchFeesPending: string;
  adhocPending: string;
  charges: Array<{
    id: string;
    type: ChargeType;
    amount: string;
    allocated: string;
    balance: string;
    description: string;
    status: string;
    matchId: string | null;
    dueDate: string | null;
    createdAt: string;
    paidAt: string | null;
  }>;
  payments: Array<{
    id: string;
    amount: string;
    mode: string;
    reference: string | null;
    receivedDate: string;
    source: string;
    allocations: Array<{ chargeId: string; amount: string; description: string }>;
  }>;
}

/** Per-player dues screen: totals, itemised charges, and payment history. */
export async function getPlayerDues(db: Db, playerId: string): Promise<PlayerDues> {
  const player = await db.player.findUnique({ where: { id: playerId } });
  if (!player) throw notFound('Player not found');

  const charges = await db.charge.findMany({
    where: { playerId },
    include: { allocations: true },
    orderBy: [{ createdAt: 'desc' }],
  });

  const payments = await db.payment.findMany({
    where: { playerId },
    include: { allocations: { include: { charge: true } } },
    orderBy: [{ receivedDate: 'desc' }, { createdAt: 'desc' }],
  });

  let matchFeesPending = 0;
  let adhocPending = 0;

  const chargeRows = charges.map((c) => {
    const amountCents = toCents(c.amount);
    const allocatedCents = c.allocations.reduce((s, a) => s + toCents(a.amountAllocated), 0);
    const balanceCents = amountCents - allocatedCents;

    if (c.status === 'PENDING' && balanceCents > 0) {
      if (c.type === 'MATCH_FEE') matchFeesPending += balanceCents;
      else adhocPending += balanceCents;
    }

    return {
      id: c.id,
      type: c.type,
      amount: centsToString(amountCents),
      allocated: centsToString(allocatedCents),
      balance: centsToString(balanceCents),
      description: c.description,
      status: c.status,
      matchId: c.matchId,
      dueDate: c.dueDate?.toISOString() ?? null,
      createdAt: c.createdAt.toISOString(),
      paidAt: c.paidAt?.toISOString() ?? null,
    };
  });

  const totalPendingCents = matchFeesPending + adhocPending;

  return {
    player: {
      id: player.id,
      name: player.name,
      jerseyNumber: player.jerseyNumber,
      mobile: player.mobile,
      active: player.active,
    },
    totalPending: centsToString(totalPendingCents),
    totalPendingCents,
    matchFeesPending: centsToString(matchFeesPending),
    adhocPending: centsToString(adhocPending),
    charges: chargeRows,
    payments: payments.map((p) => ({
      id: p.id,
      amount: centsToString(toCents(p.amount)),
      mode: p.mode,
      reference: p.reference,
      receivedDate: p.receivedDate.toISOString(),
      source: p.source,
      allocations: p.allocations.map((a) => ({
        chargeId: a.chargeId,
        amount: centsToString(toCents(a.amountAllocated)),
        description: a.charge.description,
      })),
    })),
  };
}

/** Waive an outstanding charge — an admin decision, not a payment. */
export async function waiveCharge(chargeId: string) {
  return prisma.$transaction(async (tx) => {
    const charge = await tx.charge.findUnique({
      where: { id: chargeId },
      include: { allocations: true },
    });
    if (!charge) throw notFound('Charge not found');
    if (charge.status === 'PAID') {
      throw badRequest('A paid charge cannot be waived');
    }
    if (charge.allocations.length > 0) {
      throw badRequest('This charge has payments against it and cannot be waived');
    }
    return tx.charge.update({ where: { id: chargeId }, data: { status: 'WAIVED' } });
  });
}

export { getOpenCharges };
