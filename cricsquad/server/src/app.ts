import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { env } from './env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { authenticate, requireAdmin } from './middleware/auth.js';
import { authRouter } from './routes/auth.js';
import { playersRouter } from './routes/players.js';
import { tournamentsRouter, matchesRouter } from './routes/tournaments.js';
import { chargesRouter } from './routes/charges.js';
import { paymentsRouter } from './routes/payments.js';
import { invoicesRouter, tournamentInvoicesRouter } from './routes/invoices.js';
import { statementsRouter } from './routes/statements.js';

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.get('/api/health', (_req, res) => res.json({ status: 'ok', currency: 'SGD' }));

  app.use('/api/auth', authRouter);
  app.use('/api/players', playersRouter);
  app.use('/api/tournaments', tournamentsRouter);
  // Nested so invoices are always addressed within their tournament.
  app.use('/api/tournaments/:tournamentId/invoices', tournamentInvoicesRouter);
  app.use('/api/matches', matchesRouter);
  app.use('/api/charges', chargesRouter);
  app.use('/api/payments', paymentsRouter);
  app.use('/api/invoices', invoicesRouter);
  app.use('/api/statements', statementsRouter);

  // Uploaded invoice and statement files. Behind auth — these are financial
  // records, not public assets.
  app.use('/api/files', authenticate, requireAdmin, express.static(env.uploadDir));

  app.use((req, res) => {
    res.status(404).json({ message: `No route for ${req.method} ${req.path}`, code: 'not_found' });
  });

  app.use(errorHandler);

  return app;
}

export const uploadDir = path.resolve(env.uploadDir);
