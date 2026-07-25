import bcrypt from 'bcryptjs';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import { prisma } from '../src/prisma.js';
import { toDecimal } from '../src/lib/money.js';

export const app: Express = createApp();
export const api = () => request(app);

/** Wipe every table between tests so each one starts from a known state. */
export async function resetDb() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "InvoiceAudit", "Invoice", "StatementLine", "StatementUpload",
      "PaymentAllocation", "Payment", "BulkAction", "Charge",
      "MatchSquad", "Match", "Tournament", "User", "Player", "ColumnMapping"
    RESTART IDENTITY CASCADE
  `);
}

export async function createAdmin(email = 'admin@test.example') {
  const user = await prisma.user.create({
    data: {
      email,
      name: 'Test Admin',
      role: 'ADMIN',
      passwordHash: await bcrypt.hash('password123', 10),
    },
  });
  const res = await api().post('/api/auth/login').send({ email, password: 'password123' });
  return { user, token: res.body.token as string };
}

export async function createPlayerUser(playerId: string, email: string) {
  await prisma.user.create({
    data: {
      email,
      name: 'Test Player',
      role: 'PLAYER',
      passwordHash: await bcrypt.hash('password123', 10),
      playerId,
    },
  });
  const res = await api().post('/api/auth/login').send({ email, password: 'password123' });
  return res.body.token as string;
}

export function createPlayer(overrides: Partial<{ name: string; mobile: string; jerseyNumber: number }> = {}) {
  return prisma.player.create({
    data: {
      name: overrides.name ?? 'Test Player',
      mobile: overrides.mobile ?? null,
      jerseyNumber: overrides.jerseyNumber ?? null,
      active: true,
    },
  });
}

export async function createTournamentWithMatch(feeCents = 4500) {
  const tournament = await prisma.tournament.create({
    data: {
      name: 'Test League',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
    },
  });
  const match = await prisma.match.create({
    data: {
      tournamentId: tournament.id,
      opponent: 'Test Opponent',
      matchDate: new Date('2026-03-01'),
      matchFee: toDecimal(feeCents),
    },
  });
  return { tournament, match };
}

/** Raise a charge directly, with an explicit createdAt so FIFO order is exact. */
export function createCharge(
  playerId: string,
  amountCents: number,
  createdAt: Date,
  description = 'Test charge',
) {
  return prisma.charge.create({
    data: {
      playerId,
      type: 'ADHOC',
      amount: toDecimal(amountCents),
      description,
      status: 'PENDING',
      createdAt,
    },
  });
}

export { prisma };
