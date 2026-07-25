import type { InvoicePaymentMode, InvoiceSource, Prisma } from '@prisma/client';
import { prisma, type Db } from '../prisma.js';
import { badRequest, conflict, notFound } from '../lib/errors.js';
import { type Cents, centsToString, toCents, toDecimal } from '../lib/money.js';

/**
 * Features 4 & 5 — the tournament invoice register, its payment status
 * transitions, and the audit trail behind both.
 */

export interface CreateInvoiceInput {
  tournamentId: string;
  invoiceNumber: string;
  vendorName: string;
  amountCents: Cents;
  gstAmountCents: Cents;
  dueDate: Date;
  fileUrl?: string | null;
  source?: InvoiceSource;
  userId: string;
}

function assertGstWithinAmount(amountCents: Cents, gstCents: Cents) {
  if (gstCents < 0) {
    throw badRequest('GST cannot be negative', { gstAmount: 'GST cannot be negative' });
  }
  if (gstCents > amountCents) {
    throw badRequest('GST cannot exceed the invoice total', {
      gstAmount: 'GST cannot be more than the total amount',
    });
  }
}

export async function createInvoice(input: CreateInvoiceInput) {
  assertGstWithinAmount(input.amountCents, input.gstAmountCents);

  return prisma.$transaction(async (tx) => {
    const tournament = await tx.tournament.findUnique({ where: { id: input.tournamentId } });
    if (!tournament) throw notFound('Tournament not found');

    const duplicate = await tx.invoice.findFirst({
      where: { tournamentId: input.tournamentId, invoiceNumber: input.invoiceNumber.trim() },
    });
    if (duplicate) {
      throw conflict('That invoice number already exists for this tournament', {
        invoiceNumber: 'Already used in this tournament',
      });
    }

    const invoice = await tx.invoice.create({
      data: {
        tournamentId: input.tournamentId,
        invoiceNumber: input.invoiceNumber.trim(),
        vendorName: input.vendorName.trim(),
        amount: toDecimal(input.amountCents),
        gstAmount: toDecimal(input.gstAmountCents),
        dueDate: input.dueDate,
        fileUrl: input.fileUrl ?? null,
        source: input.source ?? 'MANUAL',
        status: 'UNPAID',
      },
    });

    await tx.invoiceAudit.create({
      data: {
        invoiceId: invoice.id,
        action: 'CREATED',
        userId: input.userId,
        detail: `Created from ${invoice.source === 'UPLOADED' ? 'an uploaded file' : 'manual entry'}`,
      },
    });

    return invoice;
  });
}

export interface UpdateInvoiceInput {
  invoiceId: string;
  userId: string;
  invoiceNumber?: string;
  vendorName?: string;
  amountCents?: Cents;
  gstAmountCents?: Cents;
  dueDate?: Date;
  fileUrl?: string | null;
}

export async function updateInvoice(input: UpdateInvoiceInput) {
  return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({ where: { id: input.invoiceId } });
    if (!invoice) throw notFound('Invoice not found');

    // A paid invoice is immutable — reopening it is the only way back.
    if (invoice.status === 'PAID') {
      throw badRequest('A paid invoice cannot be edited. Reopen it first.');
    }

    const amountCents = input.amountCents ?? toCents(invoice.amount);
    const gstCents = input.gstAmountCents ?? toCents(invoice.gstAmount);
    assertGstWithinAmount(amountCents, gstCents);

    if (input.invoiceNumber && input.invoiceNumber.trim() !== invoice.invoiceNumber) {
      const duplicate = await tx.invoice.findFirst({
        where: {
          tournamentId: invoice.tournamentId,
          invoiceNumber: input.invoiceNumber.trim(),
          id: { not: invoice.id },
        },
      });
      if (duplicate) {
        throw conflict('That invoice number already exists for this tournament', {
          invoiceNumber: 'Already used in this tournament',
        });
      }
    }

    const changes: string[] = [];
    if (input.invoiceNumber && input.invoiceNumber.trim() !== invoice.invoiceNumber) {
      changes.push(`number ${invoice.invoiceNumber} → ${input.invoiceNumber.trim()}`);
    }
    if (input.vendorName && input.vendorName.trim() !== invoice.vendorName) {
      changes.push(`vendor ${invoice.vendorName} → ${input.vendorName.trim()}`);
    }
    if (input.amountCents !== undefined && input.amountCents !== toCents(invoice.amount)) {
      changes.push(
        `amount ${centsToString(toCents(invoice.amount))} → ${centsToString(input.amountCents)}`,
      );
    }
    if (input.gstAmountCents !== undefined && input.gstAmountCents !== toCents(invoice.gstAmount)) {
      changes.push(
        `GST ${centsToString(toCents(invoice.gstAmount))} → ${centsToString(input.gstAmountCents)}`,
      );
    }
    if (input.dueDate && input.dueDate.getTime() !== invoice.dueDate.getTime()) {
      changes.push(`due date → ${input.dueDate.toISOString().slice(0, 10)}`);
    }

    const updated = await tx.invoice.update({
      where: { id: input.invoiceId },
      data: {
        ...(input.invoiceNumber ? { invoiceNumber: input.invoiceNumber.trim() } : {}),
        ...(input.vendorName ? { vendorName: input.vendorName.trim() } : {}),
        ...(input.amountCents !== undefined ? { amount: toDecimal(input.amountCents) } : {}),
        ...(input.gstAmountCents !== undefined
          ? { gstAmount: toDecimal(input.gstAmountCents) }
          : {}),
        ...(input.dueDate ? { dueDate: input.dueDate } : {}),
        ...(input.fileUrl !== undefined ? { fileUrl: input.fileUrl } : {}),
      },
    });

    if (changes.length > 0) {
      await tx.invoiceAudit.create({
        data: {
          invoiceId: invoice.id,
          action: 'EDITED',
          userId: input.userId,
          detail: changes.join('; '),
        },
      });
    }

    return updated;
  });
}

export interface MarkPaidInput {
  invoiceId: string;
  txnReference: string;
  paymentMode: InvoicePaymentMode;
  paidDate: Date;
  userId: string;
}

/** Feature 5 — flip an invoice to PAID. Reference is mandatory. */
export async function markInvoicePaid(input: MarkPaidInput) {
  if (!input.txnReference.trim()) {
    throw badRequest('Transaction reference is required', {
      txnReference: 'Enter the transaction reference',
    });
  }

  return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({ where: { id: input.invoiceId } });
    if (!invoice) throw notFound('Invoice not found');
    if (invoice.status === 'PAID') {
      throw badRequest('This invoice is already marked as paid');
    }

    const updated = await tx.invoice.update({
      where: { id: input.invoiceId },
      data: {
        status: 'PAID',
        txnReference: input.txnReference.trim(),
        paymentMode: input.paymentMode,
        paidDate: input.paidDate,
      },
    });

    await tx.invoiceAudit.create({
      data: {
        invoiceId: invoice.id,
        action: 'MARKED_PAID',
        userId: input.userId,
        detail: `${input.paymentMode} · ref ${input.txnReference.trim()} · ${input.paidDate
          .toISOString()
          .slice(0, 10)}`,
      },
    });

    return updated;
  });
}

/** Reopen a paid invoice, clearing the payment fields and logging who did it. */
export async function reopenInvoice(invoiceId: string, userId: string, reason?: string) {
  return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) throw notFound('Invoice not found');
    if (invoice.status !== 'PAID') {
      throw badRequest('Only a paid invoice can be reopened');
    }

    const previous = `was ${invoice.paymentMode} · ref ${invoice.txnReference} · ${invoice.paidDate
      ?.toISOString()
      .slice(0, 10)}`;

    const updated = await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        status: 'UNPAID',
        txnReference: null,
        paymentMode: null,
        paidDate: null,
      },
    });

    await tx.invoiceAudit.create({
      data: {
        invoiceId,
        action: 'REOPENED',
        userId,
        detail: reason ? `${reason} (${previous})` : previous,
      },
    });

    return updated;
  });
}

export interface InvoiceRow {
  id: string;
  invoiceNumber: string;
  vendorName: string;
  amount: string;
  gstAmount: string;
  dueDate: string;
  status: string;
  source: string;
  fileUrl: string | null;
  txnReference: string | null;
  paymentMode: string | null;
  paidDate: string | null;
  isOverdue: boolean;
  createdAt: string;
}

function toRow(invoice: {
  id: string;
  invoiceNumber: string;
  vendorName: string;
  amount: Prisma.Decimal;
  gstAmount: Prisma.Decimal;
  dueDate: Date;
  status: string;
  source: string;
  fileUrl: string | null;
  txnReference: string | null;
  paymentMode: string | null;
  paidDate: Date | null;
  createdAt: Date;
}): InvoiceRow {
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    vendorName: invoice.vendorName,
    amount: centsToString(toCents(invoice.amount)),
    gstAmount: centsToString(toCents(invoice.gstAmount)),
    dueDate: invoice.dueDate.toISOString(),
    status: invoice.status,
    source: invoice.source,
    fileUrl: invoice.fileUrl,
    txnReference: invoice.txnReference,
    paymentMode: invoice.paymentMode,
    paidDate: invoice.paidDate?.toISOString() ?? null,
    isOverdue: invoice.status === 'UNPAID' && invoice.dueDate.getTime() < Date.now(),
    createdAt: invoice.createdAt.toISOString(),
  };
}

export async function listInvoices(db: Db, tournamentId: string): Promise<InvoiceRow[]> {
  const invoices = await db.invoice.findMany({
    where: { tournamentId },
    orderBy: [{ dueDate: 'asc' }],
  });
  return invoices.map(toRow);
}

export async function getInvoice(db: Db, invoiceId: string) {
  const invoice = await db.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      audits: {
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
      },
    },
  });
  if (!invoice) throw notFound('Invoice not found');

  return {
    ...toRow(invoice),
    audits: invoice.audits.map((a) => ({
      id: a.id,
      action: a.action,
      detail: a.detail,
      at: a.createdAt.toISOString(),
      by: a.user,
    })),
  };
}

export interface TournamentFinancials {
  tournament: { id: string; name: string; startDate: string; endDate: string };
  invoices: {
    totalInvoiced: string;
    totalPaid: string;
    totalOutstanding: string;
    overdueCount: number;
    count: number;
  };
  playerDues: {
    totalCharged: string;
    totalCollected: string;
    totalPending: string;
  };
  /** Collected from players minus paid out to vendors. */
  netPosition: string;
  isCashPositive: boolean;
}

/**
 * One screen answering "is this tournament cash-positive": vendor invoices on
 * one side, player match fees for the tournament's matches on the other.
 */
export async function getTournamentFinancials(
  db: Db,
  tournamentId: string,
): Promise<TournamentFinancials> {
  const tournament = await db.tournament.findUnique({ where: { id: tournamentId } });
  if (!tournament) throw notFound('Tournament not found');

  const invoices = await db.invoice.findMany({ where: { tournamentId } });

  let totalInvoiced = 0;
  let totalPaid = 0;
  let overdueCount = 0;
  const now = Date.now();

  for (const inv of invoices) {
    const cents = toCents(inv.amount);
    totalInvoiced += cents;
    if (inv.status === 'PAID') totalPaid += cents;
    else if (inv.dueDate.getTime() < now) overdueCount += 1;
  }

  // Player-side money is scoped to charges raised against this tournament's
  // matches — ad-hoc charges are club-wide and deliberately excluded.
  const charges = await db.charge.findMany({
    where: { match: { tournamentId } },
    include: { allocations: true },
  });

  let totalCharged = 0;
  let totalCollected = 0;
  for (const c of charges) {
    if (c.status === 'WAIVED') continue;
    const amount = toCents(c.amount);
    const allocated = c.allocations.reduce((s, a) => s + toCents(a.amountAllocated), 0);
    totalCharged += amount;
    totalCollected += Math.min(allocated, amount);
  }
  const totalPendingDues = totalCharged - totalCollected;
  const netPosition = totalCollected - totalPaid;

  return {
    tournament: {
      id: tournament.id,
      name: tournament.name,
      startDate: tournament.startDate.toISOString(),
      endDate: tournament.endDate.toISOString(),
    },
    invoices: {
      totalInvoiced: centsToString(totalInvoiced),
      totalPaid: centsToString(totalPaid),
      totalOutstanding: centsToString(totalInvoiced - totalPaid),
      overdueCount,
      count: invoices.length,
    },
    playerDues: {
      totalCharged: centsToString(totalCharged),
      totalCollected: centsToString(totalCollected),
      totalPending: centsToString(totalPendingDues),
    },
    netPosition: centsToString(netPosition),
    isCashPositive: netPosition >= 0,
  };
}
