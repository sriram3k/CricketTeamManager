import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { parseMoneyInput, centsToString, toCents, toDecimal } from '../lib/money.js';
import { confirmSquad, getPreviousSquad } from '../services/squad.js';
import { getTournamentFinancials } from '../services/invoices.js';
import { notFound } from '../lib/errors.js';

export const tournamentsRouter = Router();
tournamentsRouter.use(authenticate);

const tournamentSchema = z.object({
  name: z.string().min(1, 'Enter the tournament name'),
  organiser: z.string().optional(),
  startDate: z.coerce.date({ errorMap: () => ({ message: 'Enter a valid start date' }) }),
  endDate: z.coerce.date({ errorMap: () => ({ message: 'Enter a valid end date' }) }),
  venue: z.string().optional(),
});

tournamentsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const tournaments = await prisma.tournament.findMany({
      orderBy: { startDate: 'desc' },
      include: { _count: { select: { matches: true, invoices: true } } },
    });
    res.json(
      tournaments.map((t) => ({
        id: t.id,
        name: t.name,
        organiser: t.organiser,
        startDate: t.startDate.toISOString(),
        endDate: t.endDate.toISOString(),
        venue: t.venue,
        matchCount: t._count.matches,
        invoiceCount: t._count.invoices,
      })),
    );
  }),
);

tournamentsRouter.post(
  '/',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const body = tournamentSchema.parse(req.body);
    if (body.endDate < body.startDate) {
      return res.status(422).json({
        message: 'Please correct the highlighted fields',
        code: 'validation_error',
        fieldErrors: { endDate: 'End date cannot be before the start date' },
      });
    }
    const tournament = await prisma.tournament.create({ data: body });
    res.status(201).json(tournament);
  }),
);

tournamentsRouter.get(
  '/:tournamentId/financials',
  requireAdmin,
  asyncHandler(async (req, res) => {
    res.json(await getTournamentFinancials(prisma, req.params.tournamentId));
  }),
);

// --- Matches within a tournament -------------------------------------------

const matchSchema = z.object({
  opponent: z.string().min(1, 'Enter the opponent name'),
  matchDate: z.coerce.date({ errorMap: () => ({ message: 'Enter a valid match date' }) }),
  venue: z.string().optional(),
  matchFee: z.union([z.string(), z.number()]),
});

tournamentsRouter.get(
  '/:tournamentId/matches',
  asyncHandler(async (req, res) => {
    const matches = await prisma.match.findMany({
      where: { tournamentId: req.params.tournamentId },
      orderBy: { matchDate: 'asc' },
      include: { _count: { select: { squad: true, charges: true } } },
    });
    res.json(
      matches.map((m) => ({
        id: m.id,
        opponent: m.opponent,
        matchDate: m.matchDate.toISOString(),
        venue: m.venue,
        matchFee: centsToString(toCents(m.matchFee)),
        squadConfirmedAt: m.squadConfirmedAt?.toISOString() ?? null,
        squadSize: m._count.squad,
        chargeCount: m._count.charges,
      })),
    );
  }),
);

tournamentsRouter.post(
  '/:tournamentId/matches',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const body = matchSchema.parse(req.body);
    const tournament = await prisma.tournament.findUnique({
      where: { id: req.params.tournamentId },
    });
    if (!tournament) throw notFound('Tournament not found');

    const feeCents = parseMoneyInput(body.matchFee, 'matchFee');
    const match = await prisma.match.create({
      data: {
        tournamentId: req.params.tournamentId,
        opponent: body.opponent.trim(),
        matchDate: body.matchDate,
        venue: body.venue ?? null,
        matchFee: toDecimal(feeCents),
      },
    });
    res.status(201).json({ ...match, matchFee: centsToString(feeCents) });
  }),
);

// --- Squad selection --------------------------------------------------------

export const matchesRouter = Router();
matchesRouter.use(authenticate);

matchesRouter.get(
  '/:matchId',
  asyncHandler(async (req, res) => {
    const match = await prisma.match.findUnique({
      where: { id: req.params.matchId },
      include: { tournament: true, squad: { include: { player: true } } },
    });
    if (!match) throw notFound('Match not found');

    res.json({
      id: match.id,
      opponent: match.opponent,
      matchDate: match.matchDate.toISOString(),
      venue: match.venue,
      matchFee: centsToString(toCents(match.matchFee)),
      squadConfirmedAt: match.squadConfirmedAt?.toISOString() ?? null,
      tournament: { id: match.tournament.id, name: match.tournament.name },
      squad: match.squad.map((s) => ({
        playerId: s.playerId,
        name: s.player.name,
        jerseyNumber: s.player.jerseyNumber,
        role: s.role,
      })),
    });
  }),
);

const squadSchema = z.object({
  selections: z
    .array(
      z.object({
        playerId: z.string().uuid('Unknown player'),
        role: z.enum(['CAPTAIN', 'KEEPER', 'PLAYER', 'SUB']).default('PLAYER'),
      }),
    )
    .min(1, 'Select at least one player'),
});

/** Confirming the squad is what generates the match-fee charges. */
matchesRouter.post(
  '/:matchId/squad',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const body = squadSchema.parse(req.body);
    const result = await confirmSquad(req.params.matchId, body.selections);
    res.json({
      ...result,
      totalCharged: centsToString(result.totalChargedCents),
      message:
        result.chargesCreated > 0
          ? `Squad confirmed. ${result.chargesCreated} match fee charge(s) raised.`
          : 'Squad confirmed. All selected players were already charged for this match.',
    });
  }),
);

/** The previous match's squad, offered as a starting point. */
matchesRouter.get(
  '/:matchId/previous-squad',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const selections = await getPreviousSquad(prisma, req.params.matchId);
    if (selections.length === 0) {
      return res.json({ selections: [], players: [], message: 'No earlier squad in this tournament' });
    }
    const players = await prisma.player.findMany({
      where: { id: { in: selections.map((s) => s.playerId) } },
    });
    const byId = new Map(players.map((p) => [p.id, p]));
    res.json({
      selections,
      players: selections.map((s) => ({
        playerId: s.playerId,
        role: s.role,
        name: byId.get(s.playerId)?.name ?? 'Unknown',
        jerseyNumber: byId.get(s.playerId)?.jerseyNumber ?? null,
      })),
    });
  }),
);
