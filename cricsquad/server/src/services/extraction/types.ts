import { z } from 'zod';

/**
 * Invoice field extraction is behind this interface so an OCR provider
 * (Textract, Google Document AI, Azure Form Recognizer) can be dropped in
 * without touching the upload route or the review form.
 */

export const extractedInvoiceSchema = z.object({
  invoiceNumber: z.string().nullable(),
  vendorName: z.string().nullable(),
  /** Total payable including GST, as a "1234.50" string. */
  amount: z.string().nullable(),
  /** GST component only, as a "1234.50" string. */
  gstAmount: z.string().nullable(),
  /** ISO date (YYYY-MM-DD). */
  dueDate: z.string().nullable(),
  /** 0..1 — surfaced on the review form so the admin knows what to double-check. */
  confidence: z.number().min(0).max(1),
  notes: z.string().nullable(),
});

export type ExtractedInvoice = z.infer<typeof extractedInvoiceSchema>;

export interface ExtractionInput {
  buffer: Buffer;
  contentType: string;
  fileName: string;
}

export interface ExtractionResult extends ExtractedInvoice {
  /** Which implementation produced this, shown in the review UI. */
  provider: string;
  /** False when extraction failed — the admin fills the form in by hand. */
  succeeded: boolean;
  errorMessage?: string;
}

export interface ExtractionService {
  readonly name: string;
  extract(input: ExtractionInput): Promise<ExtractionResult>;
}

export const EMPTY_EXTRACTION: ExtractedInvoice = {
  invoiceNumber: null,
  vendorName: null,
  amount: null,
  gstAmount: null,
  dueDate: null,
  confidence: 0,
  notes: null,
};
