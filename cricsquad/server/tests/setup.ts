import 'dotenv/config';

/**
 * Tests run against TEST_DATABASE_URL so a run can never touch dev data.
 * Set before importing anything that constructs a PrismaClient.
 */
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://postgres@127.0.0.1:5432/cricsquad_test';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret';
// Force the deterministic extractor regardless of the developer's environment.
process.env.ANTHROPIC_API_KEY = '';
