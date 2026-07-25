import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { badRequest } from '../lib/errors.js';
import { storageService } from '../services/storage/index.js';
import {
  completeReconciliation,
  confirmAllAutoMatched,
  getColumnMapping,
  getReviewScreen,
  listStatementUploads,
  saveColumnMapping,
  updateLine,
  uploadStatement,
} from '../services/statement/reconciliation.js';
import { DBS_BANK_NAME, DBS_DEFAULT_MAPPING } from '../services/statement/parser.js';

export const statementsRouter = Router();
statementsRouter.use(authenticate, requireAdmin);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const ACCEPTED_EXTENSIONS = /\.(csv|xlsx|xls)$/i;

const mappingSchema = z.object({
  dateColumn: z.string().min(1),
  descriptionColumn: z.string().min(1),
  creditColumn: z.string().min(1),
  debitColumn: z.string().optional().nullable(),
  extraDescriptionColumns: z.array(z.string()).default([]),
  dateFormat: z.string().default('DD MMM YYYY'),
  headerRowIndex: z.coerce.number().int().default(-1),
});

/** The remembered mapping for a bank, so the admin maps a layout only once. */
statementsRouter.get(
  '/mapping',
  asyncHandler(async (req, res) => {
    const bankName = String(req.query.bank ?? DBS_BANK_NAME);
    const stored = await getColumnMapping(prisma, bankName);
    res.json({ bankName, mapping: stored ?? DBS_DEFAULT_MAPPING, isDefault: !stored });
  }),
);

statementsRouter.put(
  '/mapping',
  asyncHandler(async (req, res) => {
    const bankName = String(req.body?.bankName ?? DBS_BANK_NAME);
    const mapping = mappingSchema.parse(req.body?.mapping ?? req.body);
    await saveColumnMapping(mapping, bankName);
    res.json({ bankName, mapping });
  }),
);

statementsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(await listStatementUploads(prisma));
  }),
);

/** Upload and stage a statement. Creates no payments — review comes first. */
statementsRouter.post(
  '/',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw badRequest('Attach a statement file', { file: 'Choose a CSV or XLSX export' });
    }
    if (!ACCEPTED_EXTENSIONS.test(req.file.originalname)) {
      throw badRequest('Upload a CSV or XLSX bank statement', {
        file: `${req.file.originalname} is not a CSV or XLSX file`,
      });
    }

    const stored = await storageService.save({
      buffer: req.file.buffer,
      originalName: req.file.originalname,
      contentType: req.file.mimetype,
      prefix: 'statements',
    });

    const mapping = req.body?.mapping
      ? mappingSchema.partial().parse(JSON.parse(req.body.mapping))
      : null;

    const result = await uploadStatement({
      buffer: req.file.buffer,
      fileName: req.file.originalname,
      storageKey: stored.key,
      bankName: req.body?.bankName ?? DBS_BANK_NAME,
      mapping,
    });

    res.status(201).json({
      ...result,
      message:
        result.duplicateCount > 0
          ? `${result.totalLines} credit line(s) read. ${result.duplicateCount} were already processed in an earlier upload and have been set to Ignored.`
          : `${result.totalLines} credit line(s) read: ${result.autoMatchedCount} auto-matched, ${result.unmatchedCount} need review.`,
    });
  }),
);

statementsRouter.get(
  '/:uploadId/review',
  asyncHandler(async (req, res) => {
    res.json(await getReviewScreen(prisma, req.params.uploadId));
  }),
);

const lineUpdateSchema = z
  .object({
    playerId: z.string().uuid('Unknown player').nullable().optional(),
    ignore: z.boolean().optional(),
  })
  .refine((v) => v.ignore !== undefined || v.playerId !== undefined, {
    message: 'Assign a player or mark the line as ignored',
    path: ['playerId'],
  });

statementsRouter.patch(
  '/lines/:lineId',
  asyncHandler(async (req, res) => {
    const body = lineUpdateSchema.parse(req.body);
    const line = await updateLine(req.params.lineId, body);
    res.json({ id: line.id, matchStatus: line.matchStatus, matchedPlayerId: line.matchedPlayerId });
  }),
);

statementsRouter.post(
  '/:uploadId/confirm-all',
  asyncHandler(async (req, res) => {
    const result = await confirmAllAutoMatched(req.params.uploadId);
    res.json({ ...result, message: `Confirmed ${result.confirmed} auto-matched line(s).` });
  }),
);

/** Commit every confirmed match in one transaction. */
statementsRouter.post(
  '/:uploadId/complete',
  asyncHandler(async (req, res) => {
    const summary = await completeReconciliation(req.params.uploadId);
    res.json({
      ...summary,
      message: `Reconciled ${summary.totalReceived} across ${summary.paymentsCreated} payment(s). ${summary.chargesCleared} charge(s) cleared, ${summary.playersFullySettled} player(s) fully settled.`,
    });
  }),
);
