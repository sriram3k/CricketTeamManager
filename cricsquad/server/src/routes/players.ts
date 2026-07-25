import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { authenticate, requireAdmin, requireSelfOrAdmin } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { getPendingSummaries } from '../services/allocation.js';
import { getPlayerDues } from '../services/charges.js';
import { centsToString } from '../lib/money.js';
import { notFound } from '../lib/errors.js';

export const playersRouter = Router();
playersRouter.use(authenticate);

const playerSchema = z.object({
  name: z.string().min(1, 'Enter the player name'),
  mobile: z
    .string()
    .regex(/^[+\d][\d\s-]{6,19}$/, 'Enter a valid mobile number')
    .optional()
    .or(z.literal('')),
  email: z.string().email('Enter a valid email address').optional().or(z.literal('')),
  jerseyNumber: z.coerce.number().int().min(0).max(999).optional(),
  active: z.boolean().optional(),
});

/** Roster list with each player's outstanding balance. */
playersRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const search = String(req.query.search ?? '').trim();
    const includeInactive = req.query.includeInactive === 'true';

    const players = await prisma.player.findMany({
      where: {
        ...(includeInactive ? {} : { active: true }),
        ...(search ? { name: { contains: search, mode: 'insensitive' as const } } : {}),
      },
      orderBy: [{ name: 'asc' }],
    });

    const summaries = await getPendingSummaries(
      prisma,
      players.map((p) => p.id),
    );

    res.json(
      players.map((p) => ({
        id: p.id,
        name: p.name,
        mobile: p.mobile,
        email: p.email,
        jerseyNumber: p.jerseyNumber,
        active: p.active,
        totalPending: centsToString(summaries.get(p.id)?.pendingCents ?? 0),
        oldestChargeDate: summaries.get(p.id)?.oldestChargeDate?.toISOString() ?? null,
      })),
    );
  }),
);

playersRouter.post(
  '/',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const body = playerSchema.parse(req.body);
    const player = await prisma.player.create({
      data: {
        name: body.name.trim(),
        mobile: body.mobile || null,
        email: body.email || null,
        jerseyNumber: body.jerseyNumber ?? null,
        active: body.active ?? true,
      },
    });
    res.status(201).json(player);
  }),
);

playersRouter.patch(
  '/:playerId',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const body = playerSchema.partial().parse(req.body);
    const existing = await prisma.player.findUnique({ where: { id: req.params.playerId } });
    if (!existing) throw notFound('Player not found');

    const player = await prisma.player.update({
      where: { id: req.params.playerId },
      data: {
        ...(body.name !== undefined ? { name: body.name.trim() } : {}),
        ...(body.mobile !== undefined ? { mobile: body.mobile || null } : {}),
        ...(body.email !== undefined ? { email: body.email || null } : {}),
        ...(body.jerseyNumber !== undefined ? { jerseyNumber: body.jerseyNumber } : {}),
        ...(body.active !== undefined ? { active: body.active } : {}),
      },
    });
    res.json(player);
  }),
);

/** A PLAYER may read only their own dues; an ADMIN may read anyone's. */
playersRouter.get(
  '/:playerId/dues',
  requireSelfOrAdmin('playerId'),
  asyncHandler(async (req, res) => {
    res.json(await getPlayerDues(prisma, req.params.playerId));
  }),
);
