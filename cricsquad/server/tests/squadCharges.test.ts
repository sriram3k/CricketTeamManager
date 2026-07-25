import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  api,
  createAdmin,
  createPlayer,
  createTournamentWithMatch,
  prisma,
  resetDb,
} from './helpers.js';

/** Feature 1 — confirming a squad must generate the match-fee charges. */
describe('charge generation on squad confirmation', () => {
  beforeEach(resetDb);
  afterAll(() => prisma.$disconnect());

  it('raises one PENDING MATCH_FEE charge per selected player', async () => {
    const { token } = await createAdmin();
    const { match, tournament } = await createTournamentWithMatch(4500);

    const players = [];
    for (let i = 0; i < 13; i += 1) {
      players.push(await createPlayer({ name: `Player ${i}`, jerseyNumber: i }));
    }

    const selections = players.map((p, i) => ({
      playerId: p.id,
      role: i === 0 ? 'CAPTAIN' : i === 1 ? 'KEEPER' : i >= 11 ? 'SUB' : 'PLAYER',
    }));

    const res = await api()
      .post(`/api/matches/${match.id}/squad`)
      .set('Authorization', `Bearer ${token}`)
      .send({ selections });

    expect(res.status).toBe(200);
    expect(res.body.chargesCreated).toBe(13);
    expect(res.body.playingXi).toBe(11);
    expect(res.body.subs).toBe(2);
    expect(res.body.totalCharged).toBe('585.00'); // 13 × 45.00

    const charges = await prisma.charge.findMany({ where: { matchId: match.id } });
    expect(charges).toHaveLength(13);
    expect(charges.every((c) => c.status === 'PENDING')).toBe(true);
    expect(charges.every((c) => c.type === 'MATCH_FEE')).toBe(true);
    expect(charges.every((c) => c.amount.toFixed(2) === '45.00')).toBe(true);

    // The description carries the match context, per the spec.
    expect(charges[0].description).toContain('Test Opponent');
    expect(charges[0].description).toContain('2026-03-01');
    expect(charges[0].description).toContain(tournament.name);

    const updated = await prisma.match.findUniqueOrThrow({ where: { id: match.id } });
    expect(updated.squadConfirmedAt).not.toBeNull();
  });

  it('does not double-charge when the same squad is confirmed twice', async () => {
    const { token } = await createAdmin();
    const { match } = await createTournamentWithMatch(4500);
    const players = [await createPlayer({ name: 'A' }), await createPlayer({ name: 'B' })];
    const selections = players.map((p) => ({ playerId: p.id, role: 'PLAYER' as const }));

    await api()
      .post(`/api/matches/${match.id}/squad`)
      .set('Authorization', `Bearer ${token}`)
      .send({ selections });

    const second = await api()
      .post(`/api/matches/${match.id}/squad`)
      .set('Authorization', `Bearer ${token}`)
      .send({ selections });

    expect(second.body.chargesCreated).toBe(0);
    expect(second.body.chargesSkipped).toBe(2);
    expect(await prisma.charge.count({ where: { matchId: match.id } })).toBe(2);
  });

  it('removes the unpaid charge for a player dropped from the squad', async () => {
    const { token } = await createAdmin();
    const { match } = await createTournamentWithMatch(4500);
    const kept = await createPlayer({ name: 'Kept' });
    const dropped = await createPlayer({ name: 'Dropped' });

    await api()
      .post(`/api/matches/${match.id}/squad`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        selections: [
          { playerId: kept.id, role: 'PLAYER' },
          { playerId: dropped.id, role: 'PLAYER' },
        ],
      });

    await api()
      .post(`/api/matches/${match.id}/squad`)
      .set('Authorization', `Bearer ${token}`)
      .send({ selections: [{ playerId: kept.id, role: 'PLAYER' }] });

    const charges = await prisma.charge.findMany({ where: { matchId: match.id } });
    expect(charges).toHaveLength(1);
    expect(charges[0].playerId).toBe(kept.id);
  });

  it('rejects a playing XI of more than 11 with an inline field error', async () => {
    const { token } = await createAdmin();
    const { match } = await createTournamentWithMatch();

    const selections = [];
    for (let i = 0; i < 12; i += 1) {
      const p = await createPlayer({ name: `P${i}` });
      selections.push({ playerId: p.id, role: 'PLAYER' as const });
    }

    const res = await api()
      .post(`/api/matches/${match.id}/squad`)
      .set('Authorization', `Bearer ${token}`)
      .send({ selections });

    expect(res.status).toBe(400);
    expect(res.body.fieldErrors.players).toContain('12 selected');
    expect(await prisma.charge.count({ where: { matchId: match.id } })).toBe(0);
  });

  it('rejects more than 4 substitutes', async () => {
    const { token } = await createAdmin();
    const { match } = await createTournamentWithMatch();

    const selections = [];
    for (let i = 0; i < 5; i += 1) {
      const p = await createPlayer({ name: `S${i}` });
      selections.push({ playerId: p.id, role: 'SUB' as const });
    }

    const res = await api()
      .post(`/api/matches/${match.id}/squad`)
      .set('Authorization', `Bearer ${token}`)
      .send({ selections });

    expect(res.status).toBe(400);
    expect(res.body.fieldErrors.players).toContain('5 substitutes');
  });

  it('refuses squad confirmation for a non-admin', async () => {
    const { match } = await createTournamentWithMatch();
    const player = await createPlayer({ name: 'Someone' });
    const { createPlayerUser } = await import('./helpers.js');
    const playerToken = await createPlayerUser(player.id, 'p@test.example');

    const res = await api()
      .post(`/api/matches/${match.id}/squad`)
      .set('Authorization', `Bearer ${playerToken}`)
      .send({ selections: [{ playerId: player.id, role: 'PLAYER' }] });

    expect(res.status).toBe(403);
    expect(await prisma.charge.count()).toBe(0);
  });
});
