import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { parseMoneyInput } from '../lib/money.js';
import {
  commitBulkPayment,
  getUndoableBulkAction,
  listPlayersWithPending,
  previewBulkPayment,
  undoBulkAction,
} from '../services/bulkPayments.js';

export const paymentsRouter = Router();
paymentsRouter.use(authenticate, requireAdmin);

/** The bulk screen's list: everyone with something outstanding. */
paymentsRouter.get(
  '/pending',
  asyncHandler(async (req, res) => {
    const rows = await listPlayersWithPending(prisma);
    const search = String(req.query.search ?? '').trim().toLowerCase();
    const sort = String(req.query.sort ?? 'amount');

    let filtered = search ? rows.filter((r) => r.name.toLowerCase().includes(search)) : rows;

    if (sort === 'name') {
      filtered = [...filtered].sort((a, b) => a.name.localeCompare(b.name));
    } else if (sort === 'oldest') {
      filtered = [...filtered].sort((a, b) =>
        (a.oldestChargeDate ?? '').localeCompare(b.oldestChargeDate ?? ''),
      );
    }

    res.json(filtered);
  }),
);

const bulkTargetsSchema = z.object({
  targets: z
    .array(
      z.object({
        playerId: z.string().uuid('Unknown player'),
        /** Omit to settle whatever the player currently owes. */
        amount: z.union([z.string(), z.number()]).optional(),
      }),
    )
    .min(1, 'Select at least one player'),
});

const bulkCommitSchema = bulkTargetsSchema.extend({
  mode: z.enum(['PAYNOW', 'BANK_TRANSFER', 'CASH'], {
    errorMap: () => ({ message: 'Choose a payment mode' }),
  }),
  reference: z.string().max(200).optional(),
  receivedDate: z.coerce.date().optional(),
});

function toTargets(raw: z.infer<typeof bulkTargetsSchema>['targets']) {
  return raw.map((t) => ({
    playerId: t.playerId,
    amountCents: t.amount === undefined ? undefined : parseMoneyInput(t.amount, 'amount'),
  }));
}

/** Dry run — this is exactly what the confirmation screen shows. */
paymentsRouter.post(
  '/bulk/preview',
  asyncHandler(async (req, res) => {
    const body = bulkTargetsSchema.parse(req.body);
    res.json(await previewBulkPayment(prisma, { targets: toTargets(body.targets) }));
  }),
);

paymentsRouter.post(
  '/bulk',
  asyncHandler(async (req, res) => {
    const body = bulkCommitSchema.parse(req.body);
    const result = await commitBulkPayment({
      targets: toTargets(body.targets),
      mode: body.mode,
      reference: body.reference ?? null,
      receivedDate: body.receivedDate,
      performedByUserId: req.user!.id,
    });
    res.status(201).json({
      ...result,
      message: `Recorded ${result.totalAmount} from ${result.playerCount} player(s); ${result.chargesCleared} charge(s) cleared.`,
    });
  }),
);

/** The most recent bulk action still inside its 24-hour undo window. */
paymentsRouter.get(
  '/bulk/undoable',
  asyncHandler(async (_req, res) => {
    res.json(await getUndoableBulkAction(prisma));
  }),
);

paymentsRouter.post(
  '/bulk/:bulkActionId/undo',
  asyncHandler(async (req, res) => {
    const result = await undoBulkAction(req.params.bulkActionId);
    res.json({
      ...result,
      message: `Reversed ${result.paymentsReversed} payment(s); ${result.chargesReopened} charge(s) reopened.`,
    });
  }),
);

paymentsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const payments = await prisma.payment.findMany({
      include: { player: true, allocations: true },
      orderBy: [{ receivedDate: 'desc' }, { createdAt: 'desc' }],
      take: 200,
    });
    res.json(
      payments.map((p) => ({
        id: p.id,
        amount: p.amount.toFixed(2),
        mode: p.mode,
        source: p.source,
        reference: p.reference,
        receivedDate: p.receivedDate.toISOString(),
        allocationCount: p.allocations.length,
        player: { id: p.player.id, name: p.player.name },
      })),
    );
  }),
);
