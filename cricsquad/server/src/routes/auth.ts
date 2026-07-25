import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { signToken, authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { conflict, unauthorized } from '../lib/errors.js';

export const authRouter = Router();

const credentialsSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const signupSchema = credentialsSchema.extend({
  name: z.string().min(1, 'Enter your name'),
  role: z.enum(['ADMIN', 'PLAYER']).default('PLAYER'),
  playerId: z.string().uuid().optional(),
});

authRouter.post(
  '/signup',
  asyncHandler(async (req, res) => {
    const body = signupSchema.parse(req.body);
    const email = body.email.toLowerCase();

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw conflict('That email is already registered', { email: 'Already registered' });
    }

    const user = await prisma.user.create({
      data: {
        email,
        name: body.name,
        role: body.role,
        passwordHash: await bcrypt.hash(body.password, 10),
        playerId: body.playerId ?? null,
      },
    });

    const authUser = {
      id: user.id,
      email: user.email,
      role: user.role,
      playerId: user.playerId,
    };
    res.status(201).json({ token: signToken(authUser), user: { ...authUser, name: user.name } });
  }),
);

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const body = credentialsSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });

    // Same message either way — don't leak which emails are registered.
    if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) {
      throw unauthorized('Email or password is incorrect');
    }

    const authUser = {
      id: user.id,
      email: user.email,
      role: user.role,
      playerId: user.playerId,
    };
    res.json({ token: signToken(authUser), user: { ...authUser, name: user.name } });
  }),
);

authRouter.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { player: true },
    });
    if (!user) throw unauthorized();

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      player: user.player
        ? { id: user.player.id, name: user.player.name, jerseyNumber: user.player.jerseyNumber }
        : null,
    });
  }),
);
