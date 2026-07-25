import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../env.js';
import { forbidden, unauthorized } from '../lib/errors.js';

export interface AuthUser {
  id: string;
  email: string;
  role: 'ADMIN' | 'PLAYER';
  playerId: string | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signToken(user: AuthUser): string {
  return jwt.sign(user, env.jwtSecret, { expiresIn: env.jwtExpiresIn } as jwt.SignOptions);
}

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(unauthorized('Sign in to continue'));
  }
  try {
    const payload = jwt.verify(header.slice(7), env.jwtSecret) as AuthUser & jwt.JwtPayload;
    req.user = {
      id: payload.id,
      email: payload.email,
      role: payload.role,
      playerId: payload.playerId ?? null,
    };
    return next();
  } catch {
    return next(unauthorized('Your session has expired, please sign in again'));
  }
}

/** ADMIN has full access; PLAYER is limited to their own dues. */
export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(unauthorized());
  if (req.user.role !== 'ADMIN') {
    return next(forbidden('Only team admins can do this'));
  }
  return next();
}

/**
 * Allows an ADMIN through, or a PLAYER only when the :playerId in the route is
 * their own roster entry.
 */
export function requireSelfOrAdmin(paramName = 'playerId') {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(unauthorized());
    if (req.user.role === 'ADMIN') return next();
    if (req.user.playerId && req.params[paramName] === req.user.playerId) return next();
    return next(forbidden('You can only view your own dues'));
  };
}
