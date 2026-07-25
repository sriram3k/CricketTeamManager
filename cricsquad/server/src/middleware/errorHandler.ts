import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { AppError } from '../lib/errors.js';

/**
 * Turns every thrown error into the shape the client renders inline:
 *   { message: string, code: string, fieldErrors?: { field: message } }
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof AppError) {
    return res.status(err.status).json({
      message: err.message,
      code: err.code,
      ...(err.fieldErrors ? { fieldErrors: err.fieldErrors } : {}),
    });
  }

  if (err instanceof ZodError) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of err.issues) {
      const key = issue.path.join('.') || '_';
      // Keep the first message per field — that is what sits under the input.
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return res.status(422).json({
      message: 'Please correct the highlighted fields',
      code: 'validation_error',
      fieldErrors,
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const target = (err.meta?.target as string[] | undefined)?.join(', ') ?? 'value';
      return res.status(409).json({
        message: `That ${target} is already in use`,
        code: 'conflict',
      });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ message: 'Not found', code: 'not_found' });
    }
  }

  // Always log the full error server-side — it is the only copy.
  if (process.env.NODE_ENV !== 'test') {
    // eslint-disable-next-line no-console
    console.error('[cricsquad] unhandled error:', err);
  }

  // A database that is down or unreachable is not the caller's fault, and
  // saying so plainly is more useful than a generic 500.
  if (
    err instanceof Prisma.PrismaClientInitializationError ||
    err instanceof Prisma.PrismaClientRustPanicError
  ) {
    return res.status(503).json({
      message: 'CricSquad is temporarily unavailable. Please try again in a moment.',
      code: 'service_unavailable',
    });
  }

  // Never return raw error text to the client in production: Prisma messages
  // carry absolute source paths, query internals and schema details, and this
  // handler also covers unauthenticated routes such as login.
  const isProduction = process.env.NODE_ENV === 'production';
  const message =
    isProduction || !(err instanceof Error)
      ? 'Something went wrong. Please try again.'
      : err.message;

  return res.status(500).json({ message, code: 'internal_error' });
}

/** Wraps an async handler so rejections reach the error handler. */
export function asyncHandler<T extends (req: Request, res: Response, next: NextFunction) => Promise<unknown>>(
  fn: T,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}
