import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Link, useFocusEffect, useRouter } from 'expo-router';
import { api } from '../../src/api';
import { useAuth } from '../../src/auth';
import { useDebounced, useLoader } from '../../src/hooks';
import { Badge, Button, Card, EmptyState, ErrorBanner, Loading, Row, SearchBar, Segmented } from '../../src/components/ui';
import { colors, formatDate, formatSGD, spacing, type } from '../../src/theme';
import type { MatchRow, PlayerRow, Tournament } from '../../src/types';

type Sort = 'name' | 'owing' | 'jersey';

/**
 * Admin landing screen: the roster with everyone's outstanding balance, plus
 * the tournament's upcoming matches so squad selection is one tap away.
 * A PLAYER is redirected straight to their own dues.
 */
export default function SquadScreen() {
  const { user, isAdmin, signOut } = useAuth();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<Sort>('owing');
  const debouncedSearch = useDebounced(search);

  const roster = useLoader(
    () => api.get<PlayerRow[]>('/api/players', { search: debouncedSearch }),
    [debouncedSearch],
  );
  const tournaments = useLoader(() => api.get<Tournament[]>('/api/tournaments'), []);
  const activeTournament = tournaments.data?.[0] ?? null;

  const matches = useLoader(
    () =>
      activeTournament
        ? api.get<MatchRow[]>(`/api/tournaments/${activeTournament.id}/matches`)
        : Promise.resolve([]),
    [activeTournament?.id],
  );

  // Coming back from squad selection or a payment should show fresh balances.
  useFocusEffect(
    useCallback(() => {
      void roster.refresh();
      void matches.refresh();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedSearch, activeTournament?.id]),
  );

  const players = useMemo(() => {
    const list = [...(roster.data ?? [])];
    if (sort === 'name') return list.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === 'jersey')
      return list.sort((a, b) => (a.jerseyNumber ?? 999) - (b.jerseyNumber ?? 999));
    return list.sort((a, b) => Number(b.totalPending) - Number(a.totalPending));
  }, [roster.data, sort]);

  const totalOutstanding = useMemo(
    () => players.reduce((sum, p) => sum + Math.round(Number(p.totalPending) * 100), 0) / 100,
    [players],
  );

  if (!isAdmin) {
    return <PlayerHome />;
  }

  const upcoming = (matches.data ?? []).filter((m) => new Date(m.matchDate) >= new Date());

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={players}
      keyExtractor={(p) => p.id}
      refreshControl={
        <RefreshControl
          refreshing={roster.refreshing}
          onRefresh={() => {
            void roster.refresh();
            void matches.refresh();
          }}
          tintColor={colors.primary}
        />
      }
      ListHeaderComponent={
        <View>
          <ErrorBanner message={roster.error} />

          <Card>
            <Text style={type.label}>OUTSTANDING ACROSS THE CLUB</Text>
            <Text style={styles.bigMoney}>{formatSGD(totalOutstanding.toFixed(2))}</Text>
            <Text style={type.caption}>
              {players.filter((p) => Number(p.totalPending) > 0).length} of {players.length} players
              owe something
            </Text>
            <Row style={{ marginTop: spacing.lg }}>
              <Button
                label="Bulk mark paid"
                onPress={() => router.push('/payments/bulk')}
                style={{ flex: 1 }}
              />
              <Button
                label="Raise a charge"
                variant="secondary"
                onPress={() => router.push('/charges/adhoc')}
                style={{ flex: 1 }}
              />
            </Row>
          </Card>

          {upcoming.length > 0 ? (
            <Card>
              <Text style={type.label}>NEXT MATCHES</Text>
              {upcoming.slice(0, 3).map((m) => (
                <Link key={m.id} href={`/match/${m.id}`} asChild>
                  <Pressable style={styles.matchRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={type.body}>vs {m.opponent}</Text>
                      <Text style={type.caption}>
                        {formatDate(m.matchDate)} · {formatSGD(m.matchFee)} per player
                      </Text>
                    </View>
                    {m.squadConfirmedAt ? (
                      <Badge label={`XI SET · ${m.squadSize}`} tone="success" />
                    ) : (
                      <Badge label="PICK SQUAD" tone="warning" />
                    )}
                  </Pressable>
                </Link>
              ))}
            </Card>
          ) : null}

          <Text style={[type.heading, styles.sectionHeading]}>Roster</Text>
          <SearchBar value={search} onChangeText={setSearch} placeholder="Search players…" />
          <View style={{ marginTop: spacing.sm, marginBottom: spacing.md }}>
            <Segmented
              value={sort}
              onChange={setSort}
              options={[
                { value: 'owing', label: 'Owing' },
                { value: 'name', label: 'Name' },
                { value: 'jersey', label: 'Jersey' },
              ]}
            />
          </View>
        </View>
      }
      renderItem={({ item }) => <PlayerCard player={item} />}
      ListEmptyComponent={
        roster.loading ? (
          <Loading label="Loading roster…" />
        ) : (
          <EmptyState
            title={search ? 'No players match that search' : 'No players yet'}
            subtitle={search ? 'Try a different name.' : 'Add players to get started.'}
          />
        )
      }
      ListFooterComponent={
        <Button
          label={`Sign out (${user?.name ?? ''})`}
          variant="secondary"
          onPress={() => void signOut()}
          style={{ marginTop: spacing.xl }}
        />
      }
    />
  );
}

function PlayerCard({ player }: { player: PlayerRow }) {
  const owing = Number(player.totalPending) > 0;
  return (
    <Link href={`/player/${player.id}`} asChild>
      <Pressable>
        <Card style={styles.playerCard}>
          <View style={styles.jersey}>
            <Text style={styles.jerseyText}>
              {player.jerseyNumber !== null ? player.jerseyNumber : '–'}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={type.body}>{player.name}</Text>
            <Text style={type.caption}>
              {owing
                ? `Oldest charge ${formatDate(player.oldestChargeDate)}`
                : 'Nothing outstanding'}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[type.money, owing ? { color: colors.danger } : { color: colors.success }]}>
              {formatSGD(player.totalPending)}
            </Text>
          </View>
        </Card>
      </Pressable>
    </Link>
  );
}

/** A PLAYER only ever sees their own dues. */
function PlayerHome() {
  const { user, signOut } = useAuth();
  const router = useRouter();

  return (
    <View style={[styles.screen, { padding: spacing.lg }]}>
      <Card>
        <Text style={type.title}>Hello, {user?.name}</Text>
        <Text style={[type.caption, { marginTop: spacing.xs }]}>
          You can see everything you have been charged and everything you have paid.
        </Text>
        <Button
          label="View my dues"
          onPress={() => router.push(`/player/${user?.playerId}`)}
          style={{ marginTop: spacing.lg }}
        />
      </Card>
      <Button label="Sign out" variant="secondary" onPress={() => void signOut()} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  bigMoney: { fontSize: 32, fontWeight: '800', color: colors.primary, marginVertical: spacing.xs },
  sectionHeading: { marginTop: spacing.md, marginBottom: spacing.sm },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  playerCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  jersey: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  jerseyText: { fontWeight: '700', color: colors.primary },
});
