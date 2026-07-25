import { useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api, ApiError } from '../../src/api';
import { useDebounced, useLoader } from '../../src/hooks';
import { Badge, Button, Card, EmptyState, ErrorBanner, Loading, Row, SearchBar } from '../../src/components/ui';
import { colors, formatDate, formatSGD, radius, spacing, type } from '../../src/theme';
import type { MatchDetail, PlayerRow, SquadRole } from '../../src/types';

const MAX_XI = 11;
const MAX_SUBS = 4;

/**
 * Feature 1 — the fast squad picker. Search by name, tap to toggle, long-press
 * to cycle a player's role, with a live "11 selected" count. Confirming saves
 * the squad and raises the match-fee charges.
 */
export default function SquadSelectionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);
  const [selection, setSelection] = useState<Map<string, SquadRole> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const match = useLoader(() => api.get<MatchDetail>(`/api/matches/${id}`), [id]);
  const roster = useLoader(
    () => api.get<PlayerRow[]>('/api/players', { search: debounced }),
    [debounced],
  );

  // Seed from the saved squad the first time the match loads; after that the
  // local map is the source of truth so edits are not clobbered by a refresh.
  const current: Map<string, SquadRole> = useMemo(() => {
    if (selection) return selection;
    const seeded = new Map<string, SquadRole>();
    for (const s of match.data?.squad ?? []) seeded.set(s.playerId, s.role);
    return seeded;
  }, [selection, match.data]);

  const xiCount = [...current.values()].filter((r) => r !== 'SUB').length;
  const subCount = [...current.values()].filter((r) => r === 'SUB').length;

  function update(next: Map<string, SquadRole>) {
    setSelection(next);
    setFieldError(null);
  }

  function toggle(playerId: string) {
    const next = new Map(current);
    if (next.has(playerId)) {
      next.delete(playerId);
    } else if (xiCount < MAX_XI) {
      next.set(playerId, 'PLAYER');
    } else if (subCount < MAX_SUBS) {
      // The XI is full, so further taps add substitutes.
      next.set(playerId, 'SUB');
    } else {
      setFieldError(`Squad is full — ${MAX_XI} in the XI and ${MAX_SUBS} substitutes.`);
      return;
    }
    update(next);
  }

  function cycleRole(playerId: string) {
    if (!current.has(playerId)) return;
    const order: SquadRole[] = ['PLAYER', 'CAPTAIN', 'KEEPER', 'SUB'];
    const nextRole = order[(order.indexOf(current.get(playerId)!) + 1) % order.length];

    const next = new Map(current);
    // Captain and keeper are unique — taking the armband hands it over.
    if (nextRole === 'CAPTAIN' || nextRole === 'KEEPER') {
      for (const [pid, role] of next) if (role === nextRole) next.set(pid, 'PLAYER');
    }
    next.set(playerId, nextRole);
    update(next);
  }

  async function copyPrevious() {
    setError(null);
    try {
      const res = await api.get<{ selections: Array<{ playerId: string; role: SquadRole }>; message?: string }>(
        `/api/matches/${id}/previous-squad`,
      );
      if (res.selections.length === 0) {
        setError(res.message ?? 'No earlier squad to copy in this tournament.');
        return;
      }
      update(new Map(res.selections.map((s) => [s.playerId, s.role])));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load the previous squad.');
    }
  }

  async function confirm() {
    setError(null);
    setFieldError(null);

    if (current.size === 0) {
      setFieldError('Select at least one player.');
      return;
    }

    setSaving(true);
    try {
      const res = await api.post<{ chargesCreated: number; totalCharged: string; message: string }>(
        `/api/matches/${id}/squad`,
        { selections: [...current].map(([playerId, role]) => ({ playerId, role })) },
      );
      Alert.alert(
        'Squad confirmed',
        res.chargesCreated > 0
          ? `${res.message}\n\n${formatSGD(res.totalCharged)} has been added to player dues.`
          : res.message,
        [{ text: 'Done', onPress: () => router.back() }],
      );
    } catch (err) {
      if (err instanceof ApiError) {
        setFieldError(err.fieldErrors.players ?? null);
        if (!err.fieldErrors.players) setError(err.message);
      } else {
        setError('Could not save the squad. Check your connection and try again.');
      }
    } finally {
      setSaving(false);
    }
  }

  if (match.loading) return <Loading label="Loading match…" />;
  if (!match.data) return <EmptyState title="Match not found" />;

  const selectedFirst = [...(roster.data ?? [])].sort((a, b) => {
    const aSel = current.has(a.id) ? 0 : 1;
    const bSel = current.has(b.id) ? 0 : 1;
    return aSel - bSel || a.name.localeCompare(b.name);
  });

  return (
    <View style={styles.screen}>
      <FlatList
        contentContainerStyle={styles.content}
        data={selectedFirst}
        keyExtractor={(p) => p.id}
        refreshControl={
          <RefreshControl
            refreshing={roster.refreshing}
            onRefresh={roster.refresh}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <View>
            <ErrorBanner message={error} />

            <Card>
              <Text style={type.heading}>vs {match.data.opponent}</Text>
              <Text style={type.caption}>
                {formatDate(match.data.matchDate)}
                {match.data.venue ? ` · ${match.data.venue}` : ''}
              </Text>
              <Text style={[type.caption, { marginTop: spacing.xs }]}>
                Every selected player is charged {formatSGD(match.data.matchFee)} on confirmation.
              </Text>
              <Button
                label="Copy previous match squad"
                variant="secondary"
                onPress={() => void copyPrevious()}
                style={{ marginTop: spacing.md }}
              />
            </Card>

            <SearchBar value={search} onChangeText={setSearch} placeholder="Search players…" />
            <Text style={[type.caption, { marginTop: spacing.sm }]}>
              Tap to select. Long-press a selected player to set captain, keeper or sub.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const role = current.get(item.id);
          return (
            <Pressable
              onPress={() => toggle(item.id)}
              onLongPress={() => cycleRole(item.id)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: !!role }}
              style={[styles.playerRow, !!role && styles.playerRowSelected]}
            >
              <View style={[styles.check, !!role && styles.checkOn]}>
                <Text style={styles.checkMark}>{role ? '✓' : ''}</Text>
              </View>
              <View style={styles.jersey}>
                <Text style={styles.jerseyText}>
                  {item.jerseyNumber !== null ? item.jerseyNumber : '–'}
                </Text>
              </View>
              <Text style={[type.body, { flex: 1 }]}>{item.name}</Text>
              {role && role !== 'PLAYER' ? (
                <Badge label={role} tone={role === 'SUB' ? 'warning' : 'neutral'} />
              ) : null}
            </Pressable>
          );
        }}
        ListEmptyComponent={
          roster.loading ? <Loading /> : <EmptyState title="No players match that search" />
        }
      />

      <View style={styles.footer}>
        {fieldError ? <Text style={styles.footerError}>{fieldError}</Text> : null}
        <Row style={{ justifyContent: 'space-between', marginBottom: spacing.sm }}>
          <Text style={type.heading}>
            {xiCount} selected
            {subCount > 0 ? ` + ${subCount} sub${subCount > 1 ? 's' : ''}` : ''}
          </Text>
          <Text style={type.caption}>
            {formatSGD((Number(match.data.matchFee) * current.size).toFixed(2))} total
          </Text>
        </Row>
        <Button
          label={xiCount === MAX_XI ? 'Confirm XI and raise fees' : `Confirm squad (${current.size})`}
          onPress={() => void confirm()}
          loading={saving}
          disabled={current.size === 0}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  playerRowSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  check: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  checkOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkMark: { color: '#fff', fontSize: 14, fontWeight: '800' },
  jersey: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  jerseyText: { fontWeight: '700', color: colors.primary, fontSize: 13 },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  footerError: { color: colors.danger, fontSize: 13, marginBottom: spacing.sm, fontWeight: '500' },
});
