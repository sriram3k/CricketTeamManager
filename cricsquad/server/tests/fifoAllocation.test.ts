import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createCharge, createPlayer, prisma, resetDb } from './helpers.js';
import {
  applyPaymentFifo,
  getOpenCharges,
  getPendingTotalCents,
  planFifoAllocation,
} from '../src/services/allocation.js';
import { toCents } from '../src/lib/money.js';

/** FIFO allocation — oldest charge first, partials leave the charge PENDING. */
describe('FIFO allocation', () => {
  beforeEach(resetDb);
  afterAll(() => prisma.$disconnect());

  it('allocates oldest-first and clears only fully-covered charges', async () => {
    const player = await createPlayer();
    const oldest = await createCharge(player.id, 4500, new Date('2026-01-01'), 'Oldest');
    const middle = await createCharge(player.id, 6000, new Date('2026-02-01'), 'Middle');
    const newest = await createCharge(player.id, 3500, new Date('2026-03-01'), 'Newest');

    // 70.00 clears the 45.00 charge and pays 25.00 of the 60.00 one.
    const result = await prisma.$transaction((tx) =>
      applyPaymentFifo(tx, { playerId: player.id, amountCents: 7000, mode: 'PAYNOW' }),
    );

    expect(result.allocatedCents).toBe(7000);
    expect(result.unallocatedCents).toBe(0);
    expect(result.chargesCleared).toBe(1);
    expect(result.fullySettled).toBe(false);

    const after = await prisma.charge.findMany({
      where: { playerId: player.id },
      include: { allocations: true },
      orderBy: { createdAt: 'asc' },
    });

    expect(after[0].id).toBe(oldest.id);
    expect(after[0].status).toBe('PAID');
    expect(after[0].paidAt).not.toBeNull();

    // The partially-paid charge stays PENDING with a reduced balance.
    expect(after[1].id).toBe(middle.id);
    expect(after[1].status).toBe('PENDING');
    const middleAllocated = after[1].allocations.reduce(
      (s, a) => s + toCents(a.amountAllocated),
      0,
    );
    expect(middleAllocated).toBe(2500);

    expect(after[2].id).toBe(newest.id);
    expect(after[2].status).toBe('PENDING');
    expect(after[2].allocations).toHaveLength(0);

    // 45 + 60 + 35 = 140 charged, 70 paid → 70 outstanding.
    expect(await getPendingTotalCents(prisma, player.id)).toBe(7000);
  });

  it('carries a later payment on from the partial balance, not the full charge', async () => {
    const player = await createPlayer();
    await createCharge(player.id, 4500, new Date('2026-01-01'));
    await createCharge(player.id, 6000, new Date('2026-02-01'));

    await prisma.$transaction((tx) =>
      applyPaymentFifo(tx, { playerId: player.id, amountCents: 7000, mode: 'CASH' }),
    );
    // 35.00 settles the remaining 35.00 of the second charge exactly.
    const second = await prisma.$transaction((tx) =>
      applyPaymentFifo(tx, { playerId: player.id, amountCents: 3500, mode: 'CASH' }),
    );

    expect(second.chargesCleared).toBe(1);
    expect(second.fullySettled).toBe(true);
    expect(await getPendingTotalCents(prisma, player.id)).toBe(0);
  });

  it('leaves an overpayment unallocated rather than creating a negative balance', async () => {
    const player = await createPlayer();
    await createCharge(player.id, 4500, new Date('2026-01-01'));

    const result = await prisma.$transaction((tx) =>
      applyPaymentFifo(tx, { playerId: player.id, amountCents: 10000, mode: 'PAYNOW' }),
    );

    expect(result.allocatedCents).toBe(4500);
    expect(result.unallocatedCents).toBe(5500);
    expect(await getPendingTotalCents(prisma, player.id)).toBe(0);
  });

  it('keeps cent-level exactness across many odd amounts', async () => {
    const player = await createPlayer();
    // 33.33 × 3 = 99.99 — a classic float-rounding trap.
    for (let i = 0; i < 3; i += 1) {
      await createCharge(player.id, 3333, new Date(`2026-0${i + 1}-01`));
    }

    const result = await prisma.$transaction((tx) =>
      applyPaymentFifo(tx, { playerId: player.id, amountCents: 9999, mode: 'PAYNOW' }),
    );

    expect(result.allocatedCents).toBe(9999);
    expect(result.chargesCleared).toBe(3);
    expect(await getPendingTotalCents(prisma, player.id)).toBe(0);

    const payment = await prisma.payment.findFirstOrThrow({ where: { playerId: player.id } });
    expect(payment.amount.toFixed(2)).toBe('99.99');
  });

  it('orders deterministically when charges share a createdAt', async () => {
    const player = await createPlayer();
    const sameTime = new Date('2026-01-01T00:00:00Z');
    await createCharge(player.id, 1000, sameTime, 'A');
    await createCharge(player.id, 1000, sameTime, 'B');

    const first = await getOpenCharges(prisma, player.id);
    const second = await getOpenCharges(prisma, player.id);
    expect(first.map((c) => c.id)).toEqual(second.map((c) => c.id));
  });

  it('planFifoAllocation matches what applyPaymentFifo actually writes', async () => {
    const player = await createPlayer();
    await createCharge(player.id, 4500, new Date('2026-01-01'));
    await createCharge(player.id, 6000, new Date('2026-02-01'));

    const open = await getOpenCharges(prisma, player.id);
    const plan = planFifoAllocation(open, 7000);

    const actual = await prisma.$transaction((tx) =>
      applyPaymentFifo(tx, { playerId: player.id, amountCents: 7000, mode: 'PAYNOW' }),
    );

    expect(actual.allocatedCents).toBe(plan.allocatedCents);
    expect(actual.chargesCleared).toBe(plan.chargesCleared);
    expect(await prisma.paymentAllocation.count()).toBe(plan.allocations.length);
  });

  it('ignores WAIVED charges when allocating', async () => {
    const player = await createPlayer();
    const waived = await createCharge(player.id, 4500, new Date('2026-01-01'));
    await prisma.charge.update({ where: { id: waived.id }, data: { status: 'WAIVED' } });
    await createCharge(player.id, 2000, new Date('2026-02-01'));

    const result = await prisma.$transaction((tx) =>
      applyPaymentFifo(tx, { playerId: player.id, amountCents: 2000, mode: 'CASH' }),
    );

    expect(result.chargesCleared).toBe(1);
    const stillWaived = await prisma.charge.findUniqueOrThrow({ where: { id: waived.id } });
    expect(stillWaived.status).toBe('WAIVED');
  });
});
