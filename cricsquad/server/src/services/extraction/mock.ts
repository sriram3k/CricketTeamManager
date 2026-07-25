import crypto from 'node:crypto';
import {
  EMPTY_EXTRACTION,
  type ExtractionInput,
  type ExtractionResult,
  type ExtractionService,
} from './types.js';

/**
 * Deterministic stand-in used when ANTHROPIC_API_KEY is unset and in tests, so
 * the upload flow is exercisable offline. Fields are derived from the file
 * name and a hash of its contents — same input, same output, every time.
 */
export class MockExtractionService implements ExtractionService {
  readonly name = 'mock';

  async extract(input: ExtractionInput): Promise<ExtractionResult> {
    const hash = crypto.createHash('sha256').update(input.buffer).digest('hex');
    const seed = parseInt(hash.slice(0, 8), 16);

    // A file named like "INV-2026-0042.pdf" gives the mock something realistic
    // to echo back; otherwise it derives a stable number from the hash.
    const fromName = input.fileName.match(/([A-Z]{2,}[-_]?\d[\w-]*)/i)?.[1];
    const invoiceNumber = fromName ?? `INV-${hash.slice(0, 6).toUpperCase()}`;

    const totalCents = 20_000 + (seed % 480_000);
    // Singapore GST at 9%, backed out of a GST-inclusive total.
    const gstCents = Math.round(totalCents - totalCents / 1.09);

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);

    return {
      ...EMPTY_EXTRACTION,
      invoiceNumber,
      vendorName: 'Sample Vendor Pte Ltd',
      amount: (totalCents / 100).toFixed(2),
      gstAmount: (gstCents / 100).toFixed(2),
      dueDate: dueDate.toISOString().slice(0, 10),
      confidence: 0.5,
      notes: 'Extracted by the mock service — verify every field before saving.',
      provider: this.name,
      succeeded: true,
    };
  }
}
