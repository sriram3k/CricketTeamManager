import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { Prisma } from '@prisma/client';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { badRequest } from '../src/lib/errors.js';
import { prisma, resetDb } from './helpers.js';

/**
 * The error handler is the last thing between an internal failure and the
 * client, including on unauthenticated routes such as login.
 */
describe('error handler', () => {
  beforeEach(resetDb);
  afterEach(() => {
    process.env.NODE_ENV = 'test';
    vi.restoreAllMocks();
  });
  afterAll(() => prisma.$disconnect());

  function appThatThrows(err: unknown) {
    const app = express();
    app.get('/boom', (_req, _res, next) => next(err));
    app.use(errorHandler);
    return app;
  }

  it('does not leak internal error text in production', async () => {
    process.env.NODE_ENV = 'production';
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const leaky = new Error(
      'Invalid `prisma.user.findUnique()` invocation in /srv/app/src/routes/auth.ts:57:36',
    );
    const res = await request(appThatThrows(leaky)).get('/boom');

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Something went wrong. Please try again.');
    // No source paths, no query internals, no schema names.
    expect(JSON.stringify(res.body)).not.toContain('prisma.user');
    expect(JSON.stringify(res.body)).not.toContain('/srv/app');
    expect(JSON.stringify(res.body)).not.toContain('auth.ts');
  });

  it('keeps the detail in development so failures stay debuggable', async () => {
    process.env.NODE_ENV = 'development';
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await request(appThatThrows(new Error('something specific broke'))).get('/boom');

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('something specific broke');
  });

  it('reports an unreachable database as 503, not 500', async () => {
    process.env.NODE_ENV = 'production';
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const dbDown = new Prisma.PrismaClientInitializationError(
      "Can't reach database server at `127.0.0.1:5432`",
      '6.19.3',
    );
    const res = await request(appThatThrows(dbDown)).get('/boom');

    expect(res.status).toBe(503);
    expect(res.body.code).toBe('service_unavailable');
    expect(JSON.stringify(res.body)).not.toContain('127.0.0.1');
  });

  it('still surfaces deliberate validation messages in production', async () => {
    process.env.NODE_ENV = 'production';

    const res = await request(
      appThatThrows(badRequest('Enter an amount greater than zero', { amount: 'Too small' })),
    ).get('/boom');

    // AppError messages are written for the user, so they pass through intact.
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Enter an amount greater than zero');
    expect(res.body.fieldErrors.amount).toBe('Too small');
  });
});
