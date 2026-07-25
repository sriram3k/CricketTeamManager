import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Lets one test make the allocation step fail partway through a bulk run, to
 * prove the whole run rolls back. `failOnCall` is 0 (pass-through) otherwise.
 * vi.mock is hoisted, so the shared state has to be hoisted with it.
 */
const allocationControl = vi.hoisted(() => ({ failOnCall: 0, callCount: 0 }));

vi.mock('../src/services/allocation.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/services/allocation.js')>();
  return {
    ...actual,
    applyPaymentFifo: async (...args: Parameters<typeof actual.applyPaymentFifo>) => {
      allocationControl.callCount += 1;
      if (
        allocationControl.failOnCall > 0 &&
        allocationControl.callCount === allocationControl.failOnCall
      ) {
        throw new Error('simulated failure on the second player');
      }
      return actual.applyPaymentFifo(...args);
    },
  };
});

import { api, createAdmin, createCharge, createPlayer, prisma, resetDb } from './helpers.js';
import { getPendingTotalCents } from '../src/services/allocation.js';
import { commitBulkPayment, undoBulkAction } from '../src/services/bulkPayments.js';

/** Feature 2 — bulk mark-as-paid, its transaction guarantee, and undo. */
describe('bulk mark-as-paid', () => {
  beforeEach(async () => {
    allocationControl.failOnCall = 0;
    allocationControl.callCount = 0;
    await resetDb();
  });
  afterAll(() => prisma.$disconnect());

  async function threePlayersOwing() {
    const a = await createPlayer({ name: 'Alpha' });
    const b = await createPlayer({ name: 'Bravo' });
    const c = await createPlayer({ name: 'Charlie' });
    await createCharge(a.id, 4500, new Date('2026-01-01'));
    await createCharge(a.id, 6000, new Date('2026-02-01'));
    await createCharge(b.id, 3000, new Date('2026-01-15'));
    await createCharge(c.id, 8000, new Date('2026-01-20'));
    return { a, b, c };
  }

  it('previews exactly what the commit will do', async () => {
    const { token } = await createAdmin();
    const { a, b } = await threePlayersOwing();

    const preview = await api()
      .post('/api/payments/bulk/preview')
      .set('Authorization', `Bearer ${token}`)
      .send({ targets: [{ playerId: a.id }, { playerId: b.id, amount: '15.00' }] });

    expect(preview.status).toBe(200);
    expect(preview.body.playerCount).toBe(2);
    expect(preview.body.totalAmount).toBe('120.00'); // 105.00 full + 15.00 partial
    expect(preview.body.totalChargesCleared).toBe(2);
    expect(preview.body.playersFullySettled).toBe(1);

    const bravo = preview.body.rows.find((r: { playerId: string }) => r.playerId === b.id);
    expect(bravo.pendingBefore).toBe('30.00');
    expect(bravo.pendingAfter).toBe('15.00');
    expect(bravo.chargesPartiallyPaid).toBe(1);
    expect(bravo.fullySettled).toBe(false);

    // A preview must not write anything.
    expect(await prisma.payment.count()).toBe(0);
  });

  it('commits marking the full pending balance paid for each selected player', async () => {
    const { token } = await createAdmin();
    const { a, b, c } = await threePlayersOwing();

    const res = await api()
      .post('/api/payments/bulk')
      .set('Authorization', `Bearer ${token}`)
      .send({
        targets: [{ playerId: a.id }, { playerId: b.id }],
        mode: 'PAYNOW',
        reference: 'BULK-001',
      });

    expect(res.status).toBe(201);
    expect(res.body.totalAmount).toBe('135.00');
    expect(res.body.chargesCleared).toBe(3);
    expect(res.body.playersFullySettled).toBe(2);

    expect(await getPendingTotalCents(prisma, a.id)).toBe(0);
    expect(await getPendingTotalCents(prisma, b.id)).toBe(0);
    // The unselected player is untouched.
    expect(await getPendingTotalCents(prisma, c.id)).toBe(8000);

    const payments = await prisma.payment.findMany();
    expect(payments).toHaveLength(2);
    expect(payments.every((p) => p.mode === 'PAYNOW' && p.reference === 'BULK-001')).toBe(true);
  });

  it('allocates a per-player amount FIFO, leaving a partial charge PENDING', async () => {
    const { token } = await createAdmin();
    const { a } = await threePlayersOwing();

    await api()
      .post('/api/payments/bulk')
      .set('Authorization', `Bearer ${token}`)
      .send({ targets: [{ playerId: a.id, amount: '70.00' }], mode: 'CASH' });

    const charges = await prisma.charge.findMany({
      where: { playerId: a.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(charges[0].status).toBe('PAID');
    expect(charges[1].status).toBe('PENDING');
    expect(await getPendingTotalCents(prisma, a.id)).toBe(3500);
  });

  it('rolls the whole run back if any player in it fails', async () => {
    const { user } = await createAdmin();
    const { a, b } = await threePlayersOwing();

    // Fail on the second player, after the first has already been written.
    allocationControl.failOnCall = 2;

    await expect(
      commitBulkPayment({
        targets: [{ playerId: a.id }, { playerId: b.id }],
        mode: 'PAYNOW',
        performedByUserId: user.id,
      }),
    ).rejects.toThrow('simulated failure');

    // Nothing at all should have landed — not the first player's payment,
    // not the BulkAction row.
    expect(await prisma.payment.count()).toBe(0);
    expect(await prisma.paymentAllocation.count()).toBe(0);
    expect(await prisma.bulkAction.count()).toBe(0);
    expect(await getPendingTotalCents(prisma, a.id)).toBe(10500);
    expect(await getPendingTotalCents(prisma, b.id)).toBe(3000);
  });

  it('undoes the most recent bulk action within 24 hours', async () => {
    const { token } = await createAdmin();
    const { a, b } = await threePlayersOwing();

    const commit = await api()
      .post('/api/payments/bulk')
      .set('Authorization', `Bearer ${token}`)
      .send({ targets: [{ playerId: a.id }, { playerId: b.id }], mode: 'PAYNOW' });

    const bulkActionId = commit.body.bulkActionId;

    const undoable = await api()
      .get('/api/payments/bulk/undoable')
      .set('Authorization', `Bearer ${token}`);
    expect(undoable.body.id).toBe(bulkActionId);

    const undo = await api()
      .post(`/api/payments/bulk/${bulkActionId}/undo`)
      .set('Authorization', `Bearer ${token}`);

    expect(undo.status).toBe(200);
    expect(undo.body.paymentsReversed).toBe(2);
    expect(undo.body.chargesReopened).toBe(3);

    // Balances are exactly back to where they started.
    expect(await getPendingTotalCents(prisma, a.id)).toBe(10500);
    expect(await getPendingTotalCents(prisma, b.id)).toBe(3000);
    expect(await prisma.payment.count()).toBe(0);
    expect(await prisma.paymentAllocation.count()).toBe(0);

    const action = await prisma.bulkAction.findUniqueOrThrow({ where: { id: bulkActionId } });
    expect(action.undoneAt).not.toBeNull();
  });

  it('refuses to undo the same action twice', async () => {
    const { token } = await createAdmin();
    const { a } = await threePlayersOwing();

    const commit = await api()
      .post('/api/payments/bulk')
      .set('Authorization', `Bearer ${token}`)
      .send({ targets: [{ playerId: a.id }], mode: 'CASH' });

    await api()
      .post(`/api/payments/bulk/${commit.body.bulkActionId}/undo`)
      .set('Authorization', `Bearer ${token}`);

    const second = await api()
      .post(`/api/payments/bulk/${commit.body.bulkActionId}/undo`)
      .set('Authorization', `Bearer ${token}`);

    expect(second.status).toBe(400);
    expect(second.body.message).toContain('already been undone');
  });

  it('refuses to undo an action older than the 24-hour window', async () => {
    const { user } = await createAdmin();
    const { a } = await threePlayersOwing();

    const result = await commitBulkPayment({
      targets: [{ playerId: a.id }],
      mode: 'CASH',
      performedByUserId: user.id,
    });

    await prisma.bulkAction.update({
      where: { id: result.bulkActionId },
      data: { createdAt: new Date(Date.now() - 25 * 3600_000) },
    });

    await expect(undoBulkAction(result.bulkActionId)).rejects.toThrow('within 24 hours');
    expect(await getPendingTotalCents(prisma, a.id)).toBe(0); // still paid
  });

  it('rejects a bulk action where nothing is owed', async () => {
    const { token } = await createAdmin();
    const settled = await createPlayer({ name: 'Settled' });

    const res = await api()
      .post('/api/payments/bulk')
      .set('Authorization', `Bearer ${token}`)
      .send({ targets: [{ playerId: settled.id }], mode: 'CASH' });

    expect(res.status).toBe(400);
    expect(res.body.fieldErrors.players).toBeDefined();
  });
});
