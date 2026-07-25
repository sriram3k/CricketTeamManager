import { useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { api, ApiError } from '../../src/api';
import { useDebounced, useLoader } from '../../src/hooks';
import { Button, Card, EmptyState, ErrorBanner, Field, Loading, Row, SearchBar, Segmented } from '../../src/components/ui';
import { colors, formatSGD, radius, spacing, type } from '../../src/theme';
import type { ChargeType, PlayerRow } from '../../src/types';

type Target = 'PLAYERS' | 'ALL_ACTIVE';

/**
 * Feature 1 — raise a registration, jersey or ad-hoc charge against one
 * player, a selected set, or every active player in a single action.
 */
export default function AdhocChargeScreen() {
  const router = useRouter();
  const [chargeType, setChargeType] = useState<ChargeType>('REGISTRATION_FEE');
  const [target, setTarget] = useState<Target>('ALL_ACTIVE');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const roster = useLoader(
    () => api.get<PlayerRow[]>('/api/players', { search: debounced }),
    [debounced],
  );

  const recipientCount = useMemo(
    () => (target === 'ALL_ACTIVE' ? (roster.data?.length ?? 0) : selected.size),
    [target, selected, roster.data],
  );

  const totalPreview = useMemo(() => {
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return (parsed * recipientCount).toFixed(2);
  }, [amount, recipientCount]);

  function toggle(playerId: string) {
    const next = new Set(selected);
    if (next.has(playerId)) next.delete(playerId);
    else next.add(playerId);
    setSelected(next);
    setErrors((e) => ({ ...e, playerIds: '' }));
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!/^\d+(\.\d{1,2})?$/.test(amount.trim()) || Number(amount) <= 0) {
      next.amount = 'Enter an amount greater than zero, with at most 2 decimal places';
    }
    if (!description.trim()) next.description = 'Enter a description';
    if (dueDate.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate.trim())) {
      next.dueDate = 'Use the format YYYY-MM-DD';
    }
    if (target === 'PLAYERS' && selected.size === 0) {
      next.playerIds = 'Select at least one player';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit() {
    setBanner(null);
    if (!validate()) return;

    setSubmitting(true);
    try {
      const res = await api.post<{ chargesCreated: number; total: string; message: string }>(
        '/api/charges/adhoc',
        {
          type: chargeType,
          amount: amount.trim(),
          description: description.trim(),
          dueDate: dueDate.trim() || undefined,
          target,
          ...(target === 'PLAYERS' ? { playerIds: [...selected] } : {}),
        },
      );
      Alert.alert('Charges raised', res.message, [
        { text: 'Done', onPress: () => router.back() },
      ]);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fieldErrors);
        if (Object.keys(err.fieldErrors).length === 0) setBanner(err.message);
      } else {
        setBanner('Could not raise the charges. Check your connection and try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.screen}>
      <FlatList
        contentContainerStyle={styles.content}
        data={target === 'PLAYERS' ? (roster.data ?? []) : []}
        keyExtractor={(p) => p.id}
        ListHeaderComponent={
          <View>
            <ErrorBanner message={banner} />

            <Card>
              <Text style={[type.label, { marginBottom: spacing.sm }]}>CHARGE TYPE</Text>
              <Segmented
                value={chargeType}
                onChange={setChargeType}
                options={[
                  { value: 'REGISTRATION_FEE', label: 'Registration' },
                  { value: 'JERSEY_FEE', label: 'Jersey' },
                  { value: 'ADHOC', label: 'Ad-hoc' },
                ]}
              />

              <View style={{ height: spacing.lg }} />

              <Field
                label="Amount per player (SGD)"
                value={amount}
                onChangeText={setAmount}
                error={errors.amount}
                keyboardType="decimal-pad"
                placeholder="60.00"
              />
              <Field
                label="Description"
                value={description}
                onChangeText={setDescription}
                error={errors.description}
                placeholder="Annual club registration 2026"
              />
              <Field
                label="Due date (optional)"
                value={dueDate}
                onChangeText={setDueDate}
                error={errors.dueDate}
                placeholder="YYYY-MM-DD"
                autoCapitalize="none"
                hint="Leave blank if there is no deadline."
              />
            </Card>

            <Card>
              <Text style={[type.label, { marginBottom: spacing.sm }]}>WHO IS CHARGED</Text>
              <Segmented
                value={target}
                onChange={setTarget}
                options={[
                  { value: 'ALL_ACTIVE', label: 'All active players' },
                  { value: 'PLAYERS', label: 'Choose players' },
                ]}
              />
              {errors.playerIds ? (
                <Text style={styles.error}>{errors.playerIds}</Text>
              ) : null}
              {target === 'PLAYERS' ? (
                <View style={{ marginTop: spacing.md }}>
                  <SearchBar
                    value={search}
                    onChangeText={setSearch}
                    placeholder="Search players…"
                  />
                </View>
              ) : null}
            </Card>
          </View>
        }
        renderItem={({ item }) => {
          const on = selected.has(item.id);
          return (
            <Pressable
              onPress={() => toggle(item.id)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              style={[styles.playerRow, on && styles.playerRowSelected]}
            >
              <View style={[styles.check, on && styles.checkOn]}>
                <Text style={styles.checkMark}>{on ? '✓' : ''}</Text>
              </View>
              <Text style={[type.body, { flex: 1 }]}>{item.name}</Text>
              <Text style={type.caption}>
                {item.jerseyNumber !== null ? `#${item.jerseyNumber}` : ''}
              </Text>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          target === 'PLAYERS' ? (
            roster.loading ? (
              <Loading />
            ) : (
              <EmptyState title="No players match that search" />
            )
          ) : null
        }
      />

      <View style={styles.footer}>
        <Row style={{ justifyContent: 'space-between', marginBottom: spacing.sm }}>
          <Text style={type.body}>
            {recipientCount} player{recipientCount === 1 ? '' : 's'}
          </Text>
          {totalPreview ? (
            <Text style={type.money}>{formatSGD(totalPreview)} total</Text>
          ) : null}
        </Row>
        <Button
          label="Raise charges"
          onPress={() => void submit()}
          loading={submitting}
          disabled={recipientCount === 0}
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
  },
  checkOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkMark: { color: '#fff', fontSize: 14, fontWeight: '800' },
  error: { color: colors.danger, fontSize: 12, fontWeight: '500', marginTop: spacing.sm },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
});
