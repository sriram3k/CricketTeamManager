import Anthropic from '@anthropic-ai/sdk';
import { env } from '../../env.js';
import {
  EMPTY_EXTRACTION,
  extractedInvoiceSchema,
  type ExtractionInput,
  type ExtractionResult,
  type ExtractionService,
} from './types.js';

/**
 * Invoice extraction via the Anthropic API.
 *
 * The file is sent as a document (PDF) or image block and the model is
 * constrained to a JSON schema, so the response needs no prose parsing.
 */

const SYSTEM_PROMPT = `You extract billing fields from invoices issued to a cricket club in Singapore.

Rules:
- Amounts are Singapore dollars. Return them as plain decimal strings with two
  decimal places and no currency symbol, thousands separator, or sign.
- "amount" is the total payable INCLUDING GST. "gstAmount" is only the GST
  component; use "0.00" when the invoice shows no GST.
- Dates are ISO YYYY-MM-DD. Singapore invoices commonly use DD/MM/YYYY, so read
  05/03/2026 as 2026-03-05. If only payment terms are given (e.g. "Net 30"),
  compute the due date from the invoice date.
- Return null for any field the document does not state. Never guess a value.
- "confidence" is your overall confidence in the extraction, from 0 to 1.`;

const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    invoiceNumber: { type: ['string', 'null'] },
    vendorName: { type: ['string', 'null'] },
    amount: { type: ['string', 'null'] },
    gstAmount: { type: ['string', 'null'] },
    dueDate: { type: ['string', 'null'] },
    confidence: { type: 'number' },
    notes: { type: ['string', 'null'] },
  },
  required: [
    'invoiceNumber',
    'vendorName',
    'amount',
    'gstAmount',
    'dueDate',
    'confidence',
    'notes',
  ],
  additionalProperties: false,
} as const;

const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

export class AnthropicExtractionService implements ExtractionService {
  readonly name = 'anthropic';
  private client: Anthropic;

  constructor(apiKey: string = env.anthropicApiKey) {
    this.client = new Anthropic({ apiKey });
  }

  async extract(input: ExtractionInput): Promise<ExtractionResult> {
    const base64 = input.buffer.toString('base64');

    let fileBlock;
    if (input.contentType === 'application/pdf') {
      fileBlock = {
        type: 'document' as const,
        source: {
          type: 'base64' as const,
          media_type: 'application/pdf' as const,
          data: base64,
        },
      };
    } else if (SUPPORTED_IMAGE_TYPES.includes(input.contentType)) {
      fileBlock = {
        type: 'image' as const,
        source: {
          type: 'base64' as const,
          media_type: input.contentType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
          data: base64,
        },
      };
    } else {
      return {
        ...EMPTY_EXTRACTION,
        provider: this.name,
        succeeded: false,
        errorMessage: `Cannot extract from ${input.contentType}. Upload a PDF or an image.`,
      };
    }

    try {
      const response = await this.client.beta.messages.create({
        model: env.anthropicModel,
        max_tokens: 16000,
        system: SYSTEM_PROMPT,
        // Safety classifiers can decline a request; the server-side fallback
        // re-runs it on Anthropic's recommended model rather than failing.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: {
          format: { type: 'json_schema', schema: OUTPUT_SCHEMA },
        },
        messages: [
          {
            role: 'user',
            content: [
              fileBlock,
              {
                type: 'text',
                text: `Extract the billing fields from this invoice (${input.fileName}).`,
              },
            ],
          },
        ],
      } as Anthropic.Beta.Messages.MessageCreateParamsNonStreaming);

      // A refusal returns HTTP 200 with empty or partial content — check before
      // reading content, or the block access below throws.
      if (response.stop_reason === 'refusal') {
        return {
          ...EMPTY_EXTRACTION,
          provider: this.name,
          succeeded: false,
          errorMessage: 'Extraction was declined for this document. Enter the details manually.',
        };
      }

      const text = response.content
        .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('');

      if (!text.trim()) {
        return {
          ...EMPTY_EXTRACTION,
          provider: this.name,
          succeeded: false,
          errorMessage: 'The model returned no fields for this document.',
        };
      }

      const parsed = extractedInvoiceSchema.safeParse(JSON.parse(text));
      if (!parsed.success) {
        return {
          ...EMPTY_EXTRACTION,
          provider: this.name,
          succeeded: false,
          errorMessage: 'Extracted fields did not match the expected shape.',
        };
      }

      return { ...parsed.data, provider: this.name, succeeded: true };
    } catch (err) {
      // Extraction is best-effort: a failure drops the admin into the manual
      // form rather than blocking the upload.
      return {
        ...EMPTY_EXTRACTION,
        provider: this.name,
        succeeded: false,
        errorMessage: err instanceof Error ? err.message : 'Extraction failed',
      };
    }
  }
}
