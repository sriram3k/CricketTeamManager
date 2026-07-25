import bcrypt from 'bcryptjs';
import { PrismaClient, type SquadRole } from '@prisma/client';
import { toCents, toDecimal } from '../src/lib/money.js';

/**
 * Demo data for CricSquad — 15 players, one tournament, three matches with
 * squads, a mix of pending and paid charges, and two invoices, so every screen
 * has something to show immediately.
 *
 * Amounts are written in cents and converted at the boundary; the seed never
 * does float arithmetic on money.
 */

const prisma = new PrismaClient();

const PLAYERS = [
  { name: 'Tan Wei Ming', mobile: '+65 9123 4567', jerseyNumber: 7 },
  { name: 'Arjun Sharma', mobile: '+65 9234 5678', jerseyNumber: 10 },
  { name: 'Priya Nair', mobile: '+65 9123 4568', jerseyNumber: 3 },
  { name: 'Benjamin Low', mobile: '+65 9345 6789', jerseyNumber: 21 },
  { name: 'Harish Kumar', mobile: '+65 9456 7890', jerseyNumber: 44 },
  { name: 'Siti Nurhaliza', mobile: '+65 9567 8901', jerseyNumber: 5 },
  { name: 'Rajesh Iyer', mobile: '+65 9678 9012', jerseyNumber: 18 },
  { name: 'Daniel Koh Yong', mobile: '+65 9789 0123', jerseyNumber: 9 },
  { name: 'Vikram Menon', mobile: '+65 9890 1234', jerseyNumber: 33 },
  { name: 'Muhammad Faizal', mobile: '+65 9901 2345', jerseyNumber: 12 },
  { name: 'Chen Jia Hao', mobile: '+65 9012 3456', jerseyNumber: 26 },
  { name: 'Sanjay Patel', mobile: '+65 8123 4567', jerseyNumber: 8 },
  { name: 'Lim Wei Jie', mobile: '+65 8234 5678', jerseyNumber: 15 },
  { name: 'Karthik Raman', mobile: '+65 8345 6789', jerseyNumber: 71 },
  { name: 'Aravind Krishnan', mobile: '+65 8456 7890', jerseyNumber: 4 },
];

function emailFor(name: string): string {
  return `${name.toLowerCase().replace(/[^a-z]+/g, '.')}@cricsquad.example`;
}

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setUTCHours(9, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

async function reset() {
  // Order matters — children before parents.
  await prisma.invoiceAudit.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.statementLine.deleteMany();
  await prisma.statementUpload.deleteMany();
  await prisma.paymentAllocation.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.bulkAction.deleteMany();
  await prisma.charge.deleteMany();
  await prisma.matchSquad.deleteMany();
  await prisma.match.deleteMany();
  await prisma.tournament.deleteMany();
  await prisma.user.deleteMany();
  await prisma.player.deleteMany();
  await prisma.columnMapping.deleteMany();
}

async function main() {
  console.log('Seeding CricSquad demo data…');
  await reset();

  // --- Players ---
  const players = [];
  for (const p of PLAYERS) {
    players.push(
      await prisma.player.create({
        data: { ...p, email: emailFor(p.name), active: true },
      }),
    );
  }
  console.log(`  ${players.length} players`);

  // --- Users: one admin, plus a player login for the first three ---
  const passwordHash = await bcrypt.hash('cricsquad123', 10);
  await prisma.user.create({
    data: {
      email: 'admin@cricsquad.example',
      name: 'Club Admin',
      role: 'ADMIN',
      passwordHash,
    },
  });
  for (const player of players.slice(0, 3)) {
    await prisma.user.create({
      data: {
        email: player.email!,
        name: player.name,
        role: 'PLAYER',
        passwordHash,
        playerId: player.id,
      },
    });
  }
  console.log('  1 admin + 3 player logins (password: cricsquad123)');

  // --- Tournament and matches ---
  const tournament = await prisma.tournament.create({
    data: {
      name: 'SCA Division 2 League 2026',
      organiser: 'Singapore Cricket Association',
      startDate: daysFromNow(-30),
      endDate: daysFromNow(60),
      venue: 'Padang, Singapore',
    },
  });

  const matchSpecs = [
    { opponent: 'Kallang Cricket Club', dayOffset: -21, venue: 'Kallang Field 2', feeCents: 4500 },
    { opponent: 'Bukit Timah CC', dayOffset: -7, venue: 'Padang', feeCents: 4500 },
    { opponent: 'Serangoon Strikers', dayOffset: 10, venue: 'Ceylon Sports Club', feeCents: 5000 },
  ];

  const matches = [];
  for (const spec of matchSpecs) {
    matches.push(
      await prisma.match.create({
        data: {
          tournamentId: tournament.id,
          opponent: spec.opponent,
          matchDate: daysFromNow(spec.dayOffset),
          venue: spec.venue,
          matchFee: toDecimal(spec.feeCents),
        },
      }),
    );
  }
  console.log(`  1 tournament, ${matches.length} matches`);

  // --- Squads + the match-fee charges they generate ---
  const squadPlans: Array<{ start: number; roles: Record<number, SquadRole> }> = [
    { start: 0, roles: { 0: 'CAPTAIN', 1: 'KEEPER', 11: 'SUB', 12: 'SUB' } },
    { start: 1, roles: { 0: 'CAPTAIN', 2: 'KEEPER', 11: 'SUB' } },
    { start: 2, roles: { 0: 'CAPTAIN', 1: 'KEEPER', 11: 'SUB', 12: 'SUB' } },
  ];

  let chargeCount = 0;
  for (let m = 0; m < matches.length; m += 1) {
    const match = matches[m];
    const plan = squadPlans[m];
    const size = 11 + Object.values(plan.roles).filter((r) => r === 'SUB').length;

    for (let i = 0; i < size; i += 1) {
      const player = players[(plan.start + i) % players.length];
      const role: SquadRole = plan.roles[i] ?? 'PLAYER';

      await prisma.matchSquad.create({
        data: { matchId: match.id, playerId: player.id, role },
      });

      const date = match.matchDate.toISOString().slice(0, 10);
      await prisma.charge.create({
        data: {
          playerId: player.id,
          type: 'MATCH_FEE',
          amount: match.matchFee,
          description: `Match fee — vs ${match.opponent} on ${date} (${tournament.name})`,
          matchId: match.id,
          status: 'PENDING',
          // Backdate so FIFO ordering across matches is meaningful in the demo.
          createdAt: match.matchDate,
        },
      });
      chargeCount += 1;
    }
    await prisma.match.update({
      where: { id: match.id },
      data: { squadConfirmedAt: match.matchDate },
    });
  }
  console.log(`  ${chargeCount} match-fee charges from squad selection`);

  // --- Ad-hoc charges: an annual registration fee for everyone, jerseys for some ---
  for (const player of players) {
    await prisma.charge.create({
      data: {
        playerId: player.id,
        type: 'REGISTRATION_FEE',
        amount: toDecimal(6000),
        description: 'Annual club registration 2026',
        status: 'PENDING',
        dueDate: daysFromNow(-15),
        createdAt: daysFromNow(-45),
      },
    });
  }
  for (const player of players.slice(0, 6)) {
    await prisma.charge.create({
      data: {
        playerId: player.id,
        type: 'JERSEY_FEE',
        amount: toDecimal(3500),
        description: 'Home kit jersey 2026',
        status: 'PENDING',
        dueDate: daysFromNow(14),
        createdAt: daysFromNow(-20),
      },
    });
  }
  console.log(`  ${players.length} registration + 6 jersey charges`);

  // --- Payments: settle some players fully, some partially, leave others owing ---
  const { applyPaymentFifo } = await import('../src/services/allocation.js');

  // Fully settled: their entire outstanding balance is paid off.
  for (const player of players.slice(0, 3)) {
    const open = await prisma.charge.findMany({
      where: { playerId: player.id, status: 'PENDING' },
      include: { allocations: true },
    });
    const totalCents = open.reduce((sum, c) => sum + toCents(c.amount), 0);
    if (totalCents > 0) {
      await prisma.$transaction((tx) =>
        applyPaymentFifo(tx, {
          playerId: player.id,
          amountCents: totalCents,
          mode: 'PAYNOW',
          reference: `PN-SEED-${player.jerseyNumber}`,
          receivedDate: daysFromNow(-5),
          source: 'MANUAL',
        }),
      );
    }
  }

  // Partially paid: a round amount that clears the oldest charge and part of the next.
  for (const player of players.slice(3, 6)) {
    await prisma.$transaction((tx) =>
      applyPaymentFifo(tx, {
        playerId: player.id,
        amountCents: 7000,
        mode: 'BANK_TRANSFER',
        reference: `BT-SEED-${player.jerseyNumber}`,
        receivedDate: daysFromNow(-3),
        source: 'MANUAL',
      }),
    );
  }
  console.log('  3 players fully settled, 3 partially paid, 9 still owing');

  // --- Invoices ---
  const admin = await prisma.user.findUniqueOrThrow({
    where: { email: 'admin@cricsquad.example' },
  });

  const groundInvoice = await prisma.invoice.create({
    data: {
      tournamentId: tournament.id,
      invoiceNumber: 'SCA-2026-0148',
      vendorName: 'Singapore Cricket Association',
      amount: toDecimal(163500),
      gstAmount: toDecimal(13500),
      dueDate: daysFromNow(-3), // overdue, so the list shows the overdue state
      source: 'MANUAL',
      status: 'UNPAID',
    },
  });
  await prisma.invoiceAudit.create({
    data: {
      invoiceId: groundInvoice.id,
      action: 'CREATED',
      userId: admin.id,
      detail: 'Created from manual entry',
    },
  });

  const kitInvoice = await prisma.invoice.create({
    data: {
      tournamentId: tournament.id,
      invoiceNumber: 'KS-8821',
      vendorName: 'Kit Solutions Pte Ltd',
      amount: toDecimal(54500),
      gstAmount: toDecimal(4500),
      dueDate: daysFromNow(-20),
      source: 'UPLOADED',
      status: 'PAID',
      txnReference: 'PAYNOW-20260302-88213',
      paymentMode: 'PAYNOW',
      paidDate: daysFromNow(-18),
    },
  });
  await prisma.invoiceAudit.createMany({
    data: [
      {
        invoiceId: kitInvoice.id,
        action: 'CREATED',
        userId: admin.id,
        detail: 'Created from an uploaded file',
      },
      {
        invoiceId: kitInvoice.id,
        action: 'MARKED_PAID',
        userId: admin.id,
        detail: `PAYNOW · ref PAYNOW-20260302-88213 · ${daysFromNow(-18)
          .toISOString()
          .slice(0, 10)}`,
      },
    ],
  });
  console.log('  2 invoices (1 overdue unpaid, 1 paid)');

  // --- Remembered DBS column mapping, so the first upload needs no mapping step ---
  await prisma.columnMapping.create({
    data: {
      bankName: 'DBS',
      dateColumn: 'Transaction Date',
      descriptionColumn: 'Transaction Ref1',
      creditColumn: 'Credit Amount',
      debitColumn: 'Debit Amount',
      extraDescriptionColumns: ['Transaction Ref2', 'Transaction Ref3', 'Reference'],
      dateFormat: 'DD MMM YYYY',
      headerRowIndex: -1,
    },
  });

  console.log('\nSeed complete.');
  console.log('  Admin login:  admin@cricsquad.example / cricsquad123');
  console.log(`  Player login: ${players[0].email} / cricsquad123`);
  console.log('  Sample statement: sample-data/dbs-statement-sample.csv');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
