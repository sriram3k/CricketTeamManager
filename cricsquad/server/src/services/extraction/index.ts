import { env } from '../../env.js';
import { AnthropicExtractionService } from './anthropic.js';
import { MockExtractionService } from './mock.js';
import type { ExtractionService } from './types.js';

export * from './types.js';
export { AnthropicExtractionService, MockExtractionService };

/**
 * Pick an extractor. The real provider needs a key; without one the mock keeps
 * the upload flow working offline and in tests. Swapping in an OCR provider
 * means implementing ExtractionService and returning it here.
 */
export function createExtractionService(): ExtractionService {
  if (env.anthropicApiKey) {
    return new AnthropicExtractionService();
  }
  return new MockExtractionService();
}

export const extractionService: ExtractionService = createExtractionService();
