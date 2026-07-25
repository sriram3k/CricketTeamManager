import type { SquadRole } from '@prisma/client';
import { prisma, type Db } from '../prisma.js';
import { badRequest, notFound } from '../lib/errors.js';
import { toCents, toDecimal } from '../lib/money.js';

/**
 * Feature 1 — playing XI selection and the match-fee charges that follow it.
 */

export const MAX_PLAYING_XI = 11;
export const MAX_SUBS = 4;

export interface SquadSelection {
  playerId: string;
  role: SquadRole;
}

export interface ConfirmSquadResult {
  matchId: string;
  squadSize: number;
  playingXi: number;
  subs: number;
  chargesCreated: number;
  chargesSkipped: number;
  totalChargedCents: number;
}

function validateSelection(selections: SquadSelection[]) {
  if (selections.length === 0) {
    throw badRequest('Select at least one player for the squad', {
      players: 'Select at least one player',
    });
  }

  const seen = new Set<string>();
  for (const s of selections) {
    if (seen.has(s.playerId)) {
      throw badRequest('A player can only appear once in a squad', {
        players: 'Duplicate player in selection',
      });
    }
    seen.add(s.playerId);
  }

  const subs = selections.filter((s) => s.role === 'SUB');
  const playing = selections.filter((s) => s.role !== 'SUB');

  if (playing.length > MAX_PLAYING_XI) {
    throw badRequest(`The playing XI can hold at most ${MAX_PLAYING_XI} players`, {
      players: `${playing.length} selected — maximum is ${MAX_PLAYING_XI}`,
    });
  }
  if (subs.length > MAX_SUBS) {
    throw badRequest(`At most ${MAX_SUBS} substitutes are allowed`, {
      players: `${subs.length} substitutes selected — maximum is ${MAX_SUBS}`,
    });
  }
  if (selections.filter((s) => s.role === 'CAPTAIN').length > 1) {
    throw badRequest('Only one captain can be named', { players: 'Only one captain allowed' });
  }
  if (selections.filter((s) => s.role === 'KEEPER').length > 1) {
    throw badRequest('Only one wicket-keeper can be named', {
      players: 'Only one wicket-keeper allowed',
    });
  }

  return { playing: playing.length, subs: subs.length };
}

/** Human-readable description stored on each MATCH_FEE charge. */
export function buildMatchFeeDescription(match: {
  opponent: string;
  matchDate: Date;
  tournament: { name: string };
}): string {
  const date = match.matchDate.toISOString().slice(0, 10);
  return `Match fee — vs ${match.opponent} on ${date} (${match.tournament.name})`;
}

/**
 * Save the squad and auto-generate a PENDING MATCH_FEE charge for every player
 * in it. Re-confirming a squad reconciles rather than duplicating: players
 * dropped from the squad have their unpaid match-fee charge removed, and
 * players already charged are left alone.
 *
 * Runs as a single transaction.
 */
export async function confirmSquad(
  matchId: string,
  selections: SquadSelection[],
): Promise<ConfirmSquadResult> {
  const counts = validateSelection(selections);

  return prisma.$transaction(async (tx) => {
    const match = await tx.match.findUnique({
      where: { id: matchId },
      include: { tournament: true },
    });
    if (!match) throw notFound('Match not found');

    const playerIds = selections.map((s) => s.playerId);
    const players = await tx.player.findMany({ where: { id: { in: playerIds } } });
    if (players.length !== playerIds.length) {
      throw badRequest('One or more selected players no longer exist', {
        players: 'Selection contains an unknown player',
      });
    }
    const inactive = players.filter((p) => !p.active);
    if (inactive.length > 0) {
      throw badRequest(`Inactive players cannot be selected: ${inactive.map((p) => p.name).join(', ')}`, {
        players: `Inactive: ${inactive.map((p) => p.name).join(', ')}`,
      });
    }

    // Replace the squad wholesale — simplest correct semantics for re-selection.
    await tx.matchSquad.deleteMany({ where: { matchId } });
    await tx.matchSquad.createMany({
      data: selections.map((s) => ({ matchId, playerId: s.playerId, role: s.role })),
    });

    // Drop match-fee charges for players no longer in the squad, but only where
    // nothing has been paid against them — a charge with money on it is history.
    const staleCharges = await tx.charge.findMany({
      where: {
        matchId,
        type: 'MATCH_FEE',
        playerId: { notIn: playerIds },
        status: 'PENDING',
      },
      include: { allocations: true },
    });
    const removableIds = staleCharges.filter((c) => c.allocations.length === 0).map((c) => c.id);
    if (removableIds.length > 0) {
      await tx.charge.deleteMany({ where: { id: { in: removableIds } } });
    }

    const existing = await tx.charge.findMany({
      where: { matchId, type: 'MATCH_FEE', playerId: { in: playerIds } },
      select: { playerId: true },
    });
    const alreadyCharged = new Set(existing.map((c) => c.playerId));

    const feeCents = toCents(match.matchFee);
    const toCreate = playerIds.filter((id) => !alreadyCharged.has(id));

    if (toCreate.length > 0) {
      await tx.charge.createMany({
        data: toCreate.map((playerId) => ({
          playerId,
          type: 'MATCH_FEE' as const,
          amount: toDecimal(feeCents),
          description: buildMatchFeeDescription(match),
          matchId,
          status: 'PENDING' as const,
        })),
      });
    }

    await tx.match.update({
      where: { id: matchId },
      data: { squadConfirmedAt: new Date() },
    });

    return {
      matchId,
      squadSize: selections.length,
      playingXi: counts.playing,
      subs: counts.subs,
      chargesCreated: toCreate.length,
      chargesSkipped: alreadyCharged.size,
      totalChargedCents: toCreate.length * feeCents,
    };
  });
}

/**
 * The squad from the most recent earlier match in the same tournament, offered
 * as a starting point for the next selection.
 */
export async function getPreviousSquad(db: Db, matchId: string): Promise<SquadSelection[]> {
  const match = await db.match.findUnique({ where: { id: matchId } });
  if (!match) throw notFound('Match not found');

  const previous = await db.match.findFirst({
    where: {
      tournamentId: match.tournamentId,
      matchDate: { lt: match.matchDate },
      squad: { some: {} },
    },
    orderBy: { matchDate: 'desc' },
    include: { squad: { include: { player: true } } },
  });

  if (!previous) return [];

  // Anyone since deactivated is dropped rather than carried forward.
  return previous.squad
    .filter((s) => s.player.active)
    .map((s) => ({ playerId: s.playerId, role: s.role }));
}
