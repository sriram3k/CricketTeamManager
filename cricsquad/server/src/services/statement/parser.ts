import crypto from 'node:crypto';
import * as XLSX from 'xlsx';
import { badRequest } from '../../lib/errors.js';
import { type Cents, toCents } from '../../lib/money.js';

/**
 * DBS/POSB statement parsing.
 *
 * DBS exports a preamble (account number, balances, a blank line) before the
 * real header row, splits the narrative across three "Transaction Ref" columns,
 * and puts debits and credits in separate columns. Only credits — money coming
 * in from players — are relevant to reconciliation.
 *
 * The column mapping is discovered on first upload and then stored per bank, so
 * an admin maps a given export layout once. A caller can also pass a mapping
 * explicitly for a layout the sniffer does not recognise.
 */

export const DBS_BANK_NAME = 'DBS';

/** The layout DBS currently exports; used as the default mapping. */
export const DBS_DEFAULT_MAPPING: ColumnMappingSpec = {
  dateColumn: 'Transaction Date',
  descriptionColumn: 'Transaction Ref1',
  creditColumn: 'Credit Amount',
  debitColumn: 'Debit Amount',
  extraDescriptionColumns: ['Transaction Ref2', 'Transaction Ref3', 'Reference'],
  dateFormat: 'DD MMM YYYY',
  headerRowIndex: -1, // -1 means "find the header row by sniffing"
};

export interface ColumnMappingSpec {
  dateColumn: string;
  descriptionColumn: string;
  creditColumn: string;
  debitColumn?: string | null;
  extraDescriptionColumns: string[];
  dateFormat: string;
  headerRowIndex: number;
}

export interface ParsedLine {
  txnDate: Date;
  description: string;
  amountCents: Cents;
  lineHash: string;
  rowNumber: number;
}

export interface ParseResult {
  lines: ParsedLine[];
  mapping: ColumnMappingSpec;
  /** Rows skipped and why — surfaced so an admin can spot a bad mapping. */
  skipped: Array<{ rowNumber: number; reason: string }>;
  periodFrom: Date;
  periodTo: Date;
  detectedHeaders: string[];
}

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/**
 * Parse the date formats DBS emits. Singapore is day-first, so an ambiguous
 * numeric date like 05/03/2026 is 5 March, never 3 May.
 */
export function parseStatementDate(raw: string): Date | null {
  const value = raw.trim();
  if (!value) return null;

  // 05 Mar 2026 / 05-Mar-2026
  const named = value.match(/^(\d{1,2})[\s\-/]+([A-Za-z]{3,})[\s\-/]+(\d{2,4})$/);
  if (named) {
    const month = MONTHS[named[2].slice(0, 3).toLowerCase()];
    if (month === undefined) return null;
    const year = named[3].length === 2 ? 2000 + Number(named[3]) : Number(named[3]);
    return buildDate(year, month, Number(named[1]));
  }

  // 05/03/2026 — day first.
  const numeric = value.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (numeric) {
    const year = numeric[3].length === 2 ? 2000 + Number(numeric[3]) : Number(numeric[3]);
    return buildDate(year, Number(numeric[2]) - 1, Number(numeric[1]));
  }

  // 2026-03-05 — ISO, unambiguous.
  const iso = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    return buildDate(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  }

  return null;
}

function buildDate(year: number, monthIndex: number, day: number): Date | null {
  if (monthIndex < 0 || monthIndex > 11 || day < 1 || day > 31) return null;
  const d = new Date(Date.UTC(year, monthIndex, day));
  // Reject a rolled-over date such as 31 Feb.
  if (d.getUTCMonth() !== monthIndex || d.getUTCDate() !== day) return null;
  return d;
}

/** "1,234.50" / "(1,234.50)" / "" → cents. Returns null when not a number. */
export function parseAmount(raw: string): Cents | null {
  let value = raw.trim().replace(/[,\s]/g, '').replace(/^SGD/i, '');
  if (!value) return null;

  let negative = false;
  if (value.startsWith('(') && value.endsWith(')')) {
    negative = true;
    value = value.slice(1, -1);
  }
  if (!/^-?\d+(\.\d+)?$/.test(value)) return null;

  const cents = toCents(Number(value).toFixed(2));
  return negative ? -cents : cents;
}

/**
 * A statement line's identity: date + amount + normalised description. Used to
 * spot a line that was already processed in an earlier upload.
 */
export function hashLine(txnDate: Date, amountCents: Cents, description: string): string {
  const normalised = description.toLowerCase().replace(/\s+/g, ' ').trim();
  return crypto
    .createHash('sha256')
    .update(`${txnDate.toISOString().slice(0, 10)}|${amountCents}|${normalised}`)
    .digest('hex');
}

/** Read a CSV or XLSX buffer into a grid of trimmed strings. */
function toGrid(buffer: Buffer, fileName: string): string[][] {
  const isCsv = /\.csv$/i.test(fileName);
  let workbook: XLSX.WorkBook;

  try {
    workbook = isCsv
      ? XLSX.read(buffer.toString('utf8'), { type: 'string', raw: true })
      : XLSX.read(buffer, { type: 'buffer', raw: true });
  } catch {
    throw badRequest('That file could not be read. Upload a CSV or XLSX export.', {
      file: 'Unreadable file',
    });
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw badRequest('The statement file has no sheets', { file: 'Empty file' });
  }

  const rows = XLSX.utils.sheet_to_json<string[]>(workbook.Sheets[sheetName], {
    header: 1,
    raw: false,
    defval: '',
    blankrows: true,
  });

  return rows.map((row) => (row ?? []).map((cell) => String(cell ?? '').trim()));
}

/**
 * DBS puts account metadata above the real header. Find the first row that
 * looks like a header: it must name a date column and an amount column.
 */
export function findHeaderRow(grid: string[][]): number {
  for (let i = 0; i < Math.min(grid.length, 30); i += 1) {
    const cells = grid[i].map((c) => c.toLowerCase());
    const hasDate = cells.some((c) => c.includes('date'));
    const hasAmount = cells.some(
      (c) => c.includes('amount') || c === 'credit' || c === 'debit' || c.includes('deposit'),
    );
    if (hasDate && hasAmount) return i;
  }
  return -1;
}

function findColumn(headers: string[], wanted: string): number {
  const target = wanted.toLowerCase().replace(/[\s._]/g, '');
  const exact = headers.findIndex((h) => h.toLowerCase().replace(/[\s._]/g, '') === target);
  if (exact !== -1) return exact;
  return headers.findIndex((h) => h.toLowerCase().replace(/[\s._]/g, '').includes(target));
}

export interface ParseOptions {
  fileName: string;
  /** A stored mapping for this bank; the DBS default is used when omitted. */
  mapping?: Partial<ColumnMappingSpec> | null;
}

export function parseStatement(buffer: Buffer, options: ParseOptions): ParseResult {
  const grid = toGrid(buffer, options.fileName);
  if (grid.length === 0) {
    throw badRequest('The statement file is empty', { file: 'Empty file' });
  }

  const spec: ColumnMappingSpec = { ...DBS_DEFAULT_MAPPING, ...(options.mapping ?? {}) };

  const headerRowIndex =
    spec.headerRowIndex >= 0 && grid[spec.headerRowIndex] ? spec.headerRowIndex : findHeaderRow(grid);

  if (headerRowIndex < 0) {
    throw badRequest(
      'Could not find the column headers in that file. Check it is a DBS transaction export.',
      { file: 'No header row found' },
    );
  }

  const headers = grid[headerRowIndex];
  const dateIdx = findColumn(headers, spec.dateColumn);
  const creditIdx = findColumn(headers, spec.creditColumn);
  const debitIdx = spec.debitColumn ? findColumn(headers, spec.debitColumn) : -1;
  const descIdx = findColumn(headers, spec.descriptionColumn);
  const extraIdxs = spec.extraDescriptionColumns
    .map((c) => findColumn(headers, c))
    .filter((i) => i !== -1 && i !== descIdx);

  if (dateIdx === -1) {
    throw badRequest(`No "${spec.dateColumn}" column in the file`, {
      dateColumn: `Not found. Columns present: ${headers.filter(Boolean).join(', ')}`,
    });
  }
  if (creditIdx === -1) {
    throw badRequest(`No "${spec.creditColumn}" column in the file`, {
      creditColumn: `Not found. Columns present: ${headers.filter(Boolean).join(', ')}`,
    });
  }

  const lines: ParsedLine[] = [];
  const skipped: ParseResult['skipped'] = [];

  for (let i = headerRowIndex + 1; i < grid.length; i += 1) {
    const row = grid[i];
    const rowNumber = i + 1; // 1-indexed, matching what the admin sees in Excel
    if (row.every((cell) => !cell)) continue;

    const txnDate = parseStatementDate(row[dateIdx] ?? '');
    if (!txnDate) {
      // Trailing summary rows ("Total", "End of statement") land here.
      if ((row[dateIdx] ?? '').length > 0) {
        skipped.push({ rowNumber, reason: `Unrecognised date "${row[dateIdx]}"` });
      }
      continue;
    }

    const credit = parseAmount(row[creditIdx] ?? '');
    if (credit === null || credit === 0) {
      const debit = debitIdx !== -1 ? parseAmount(row[debitIdx] ?? '') : null;
      skipped.push({
        rowNumber,
        reason: debit ? 'Outgoing payment — only incoming credits are reconciled' : 'No credit amount',
      });
      continue;
    }
    if (credit < 0) {
      skipped.push({ rowNumber, reason: 'Negative credit amount' });
      continue;
    }

    const description = [descIdx !== -1 ? row[descIdx] : '', ...extraIdxs.map((idx) => row[idx])]
      .map((part) => (part ?? '').trim())
      .filter(Boolean)
      .join(' ');

    lines.push({
      txnDate,
      description,
      amountCents: credit,
      lineHash: hashLine(txnDate, credit, description),
      rowNumber,
    });
  }

  if (lines.length === 0) {
    throw badRequest('No incoming credit transactions were found in that statement', {
      file: 'No credit lines found',
    });
  }

  const times = lines.map((l) => l.txnDate.getTime());
  return {
    lines,
    mapping: { ...spec, headerRowIndex },
    skipped,
    periodFrom: new Date(Math.min(...times)),
    periodTo: new Date(Math.max(...times)),
    detectedHeaders: headers.filter(Boolean),
  };
}
