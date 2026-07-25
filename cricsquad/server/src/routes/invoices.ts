import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { badRequest } from '../lib/errors.js';
import { parseMoneyInput } from '../lib/money.js';
import { storageService } from '../services/storage/index.js';
import { extractionService } from '../services/extraction/index.js';
import {
  createInvoice,
  getInvoice,
  listInvoices,
  markInvoicePaid,
  reopenInvoice,
  updateInvoice,
} from '../services/invoices.js';

export const invoicesRouter = Router();
invoicesRouter.use(authenticate, requireAdmin);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

const ACCEPTED_INVOICE_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
];

/**
 * Upload an invoice file and return the extracted fields for review. The
 * invoice is NOT created here — the admin confirms the form first, then POSTs
 * to /tournaments/:id/invoices with the returned fileUrl.
 */
invoicesRouter.post(
  '/extract',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw badRequest('Attach an invoice file', { file: 'Choose a PDF or image to upload' });
    }
    if (!ACCEPTED_INVOICE_TYPES.includes(req.file.mimetype)) {
      throw badRequest('Only PDF and image files can be uploaded', {
        file: `${req.file.mimetype} is not supported`,
      });
    }

    const stored = await storageService.save({
      buffer: req.file.buffer,
      originalName: req.file.originalname,
      contentType: req.file.mimetype,
      prefix: 'invoices',
    });

    const extracted = await extractionService.extract({
      buffer: req.file.buffer,
      contentType: req.file.mimetype,
      fileName: req.file.originalname,
    });

    res.json({
      file: { url: stored.url, key: stored.key, name: stored.originalName, size: stored.size },
      extracted,
      // Extraction failure is not an error — the admin just types the fields in.
      message: extracted.succeeded
        ? 'Check the extracted fields before saving.'
        : `Could not read the invoice automatically (${extracted.errorMessage}). Enter the details manually.`,
    });
  }),
);

const invoiceBodySchema = z.object({
  invoiceNumber: z.string().min(1, 'Enter the invoice number'),
  vendorName: z.string().min(1, 'Enter the vendor name'),
  amount: z.union([z.string(), z.number()]),
  gstAmount: z.union([z.string(), z.number()]).optional(),
  dueDate: z.coerce.date({ errorMap: () => ({ message: 'Enter a valid due date' }) }),
  fileUrl: z.string().optional().nullable(),
  source: z.enum(['UPLOADED', 'MANUAL']).optional(),
});

function parseGst(input: unknown): number {
  if (input === undefined || input === null || input === '') return 0;
  const asString = String(input).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(asString)) {
    throw badRequest('GST must be a number with at most 2 decimal places', {
      gstAmount: 'Enter a valid GST amount',
    });
  }
  return Math.round(Number(asString) * 100);
}

export const tournamentInvoicesRouter = Router({ mergeParams: true });
tournamentInvoicesRouter.use(authenticate, requireAdmin);

tournamentInvoicesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const rows = await listInvoices(prisma, req.params.tournamentId);
    const search = String(req.query.search ?? '').trim().toLowerCase();
    const status = req.query.status as string | undefined;

    let filtered = rows;
    if (search) {
      filtered = filtered.filter(
        (r) =>
          r.vendorName.toLowerCase().includes(search) ||
          r.invoiceNumber.toLowerCase().includes(search),
      );
    }
    if (status) filtered = filtered.filter((r) => r.status === status);

    res.json(filtered);
  }),
);

tournamentInvoicesRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = invoiceBodySchema.parse(req.body);
    const invoice = await createInvoice({
      tournamentId: req.params.tournamentId,
      invoiceNumber: body.invoiceNumber,
      vendorName: body.vendorName,
      amountCents: parseMoneyInput(body.amount, 'amount'),
      gstAmountCents: parseGst(body.gstAmount),
      dueDate: body.dueDate,
      fileUrl: body.fileUrl ?? null,
      source: body.source ?? (body.fileUrl ? 'UPLOADED' : 'MANUAL'),
      userId: req.user!.id,
    });
    res.status(201).json(await getInvoice(prisma, invoice.id));
  }),
);

invoicesRouter.get(
  '/:invoiceId',
  asyncHandler(async (req, res) => {
    res.json(await getInvoice(prisma, req.params.invoiceId));
  }),
);

invoicesRouter.patch(
  '/:invoiceId',
  asyncHandler(async (req, res) => {
    const body = invoiceBodySchema.partial().parse(req.body);
    await updateInvoice({
      invoiceId: req.params.invoiceId,
      userId: req.user!.id,
      invoiceNumber: body.invoiceNumber,
      vendorName: body.vendorName,
      amountCents: body.amount !== undefined ? parseMoneyInput(body.amount, 'amount') : undefined,
      gstAmountCents: body.gstAmount !== undefined ? parseGst(body.gstAmount) : undefined,
      dueDate: body.dueDate,
      fileUrl: body.fileUrl,
    });
    res.json(await getInvoice(prisma, req.params.invoiceId));
  }),
);

const markPaidSchema = z.object({
  txnReference: z.string().min(1, 'Enter the transaction reference'),
  paymentMode: z.enum(['PAYNOW', 'BANK_TRANSFER', 'CHEQUE', 'CARD', 'CASH'], {
    errorMap: () => ({ message: 'Choose a payment mode' }),
  }),
  paidDate: z.coerce.date().optional(),
});

invoicesRouter.post(
  '/:invoiceId/mark-paid',
  asyncHandler(async (req, res) => {
    const body = markPaidSchema.parse(req.body);
    await markInvoicePaid({
      invoiceId: req.params.invoiceId,
      txnReference: body.txnReference,
      paymentMode: body.paymentMode,
      paidDate: body.paidDate ?? new Date(),
      userId: req.user!.id,
    });
    res.json(await getInvoice(prisma, req.params.invoiceId));
  }),
);

invoicesRouter.post(
  '/:invoiceId/reopen',
  asyncHandler(async (req, res) => {
    const reason = typeof req.body?.reason === 'string' ? req.body.reason : undefined;
    await reopenInvoice(req.params.invoiceId, req.user!.id, reason);
    res.json(await getInvoice(prisma, req.params.invoiceId));
  }),
);
