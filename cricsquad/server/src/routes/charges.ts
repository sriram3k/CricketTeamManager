import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { parseMoneyInput, centsToString, toCents } from '../lib/money.js';
import { raiseAdhocCharges, waiveCharge } from '../services/charges.js';

export const chargesRouter = Router();
chargesRouter.use(authenticate);

const adhocSchema = z
  .object({
    type: z.enum(['REGISTRATION_FEE', 'JERSEY_FEE', 'ADHOC']),
    amount: z.union([z.string(), z.number()]),
    description: z.string().min(1, 'Enter a description'),
    dueDate: z.coerce.date().optional(),
    /** ALL_ACTIVE charges every active player; PLAYERS charges the listed ids. */
    target: z.enum(['PLAYERS', 'ALL_ACTIVE']),
    playerIds: z.array(z.string().uuid()).optional(),
  })
  .refine((v) => v.target === 'ALL_ACTIVE' || (v.playerIds && v.playerIds.length > 0), {
    message: 'Select at least one player',
    path: ['playerIds'],
  });

/** Raise a charge against one player, a selected set, or everyone active. */
chargesRouter.post(
  '/adhoc',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const body = adhocSchema.parse(req.body);
    const amountCents = parseMoneyInput(body.amount, 'amount');

    const result = await raiseAdhocCharges({
      type: body.type,
      amountCents,
      description: body.description,
      dueDate: body.dueDate ?? null,
      target:
        body.target === 'ALL_ACTIVE'
          ? { kind: 'ALL_ACTIVE' }
          : { kind: 'PLAYERS', playerIds: body.playerIds! },
    });

    res.status(201).json({
      ...result,
      total: centsToString(result.totalCents),
      message: `Raised ${result.chargesCreated} charge(s) totalling ${centsToString(result.totalCents)}`,
    });
  }),
);

chargesRouter.post(
  '/:chargeId/waive',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const charge = await waiveCharge(req.params.chargeId);
    res.json({ id: charge.id, status: charge.status });
  }),
);

/** Every charge across the club, for the admin's charges list. */
chargesRouter.get(
  '/',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const status = req.query.status as string | undefined;
    const type = req.query.type as string | undefined;

    const charges = await prisma.charge.findMany({
      where: {
        ...(status ? { status: status as 'PENDING' | 'PAID' | 'WAIVED' } : {}),
        ...(type ? { type: type as 'MATCH_FEE' | 'REGISTRATION_FEE' | 'JERSEY_FEE' | 'ADHOC' } : {}),
      },
      include: { player: true, allocations: true },
      orderBy: [{ createdAt: 'desc' }],
      take: 500,
    });

    res.json(
      charges.map((c) => {
        const amountCents = toCents(c.amount);
        const allocatedCents = c.allocations.reduce((s, a) => s + toCents(a.amountAllocated), 0);
        return {
          id: c.id,
          type: c.type,
          description: c.description,
          status: c.status,
          amount: centsToString(amountCents),
          balance: centsToString(amountCents - allocatedCents),
          createdAt: c.createdAt.toISOString(),
          dueDate: c.dueDate?.toISOString() ?? null,
          player: { id: c.player.id, name: c.player.name, jerseyNumber: c.player.jerseyNumber },
        };
      }),
    );
  }),
);
