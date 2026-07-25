import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { api } from '../../src/api';
import { useDebounced, useLoader } from '../../src/hooks';
import { Badge, Button, Card, EmptyState, ErrorBanner, Loading, Row, SearchBar, Segmented } from '../../src/components/ui';
import { colors, formatDate, formatSGD, spacing, type } from '../../src/theme';
import type { Invoice, Tournament, TournamentFinancials } from '../../src/types';

type Filter = 'ALL' | 'UNPAID' | 'PAID';

/** Features 4 & 5 — the tournament invoice register and cash position. */
export default function InvoicesScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('ALL');
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);

  const tournaments = useLoader(() => api.get<Tournament[]>('/api/tournaments'), []);
  const tournament = tournaments.data?.[0] ?? null;

  const invoices = useLoader(
    () =>
      tournament
        ? api.get<Invoice[]>(`/api/tournaments/${tournament.id}/invoices`, {
            search: debounced,
            status: filter === 'ALL' ? undefined : filter,
          })
        : Promise.resolve([]),
    [tournament?.id, debounced, filter],
  );

  const financials = useLoader(
    () =>
      tournament
        ? api.get<TournamentFinancials>(`/api/tournaments/${tournament.id}/financials`)
        : Promise.resolve(null),
    [tournament?.id],
  );

  useFocusEffect(
    useCallback(() => {
      void invoices.refresh();
      void financials.refresh();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tournament?.id, filter, debounced]),
  );

  const rows = useMemo(() => {
    // Overdue first, then by due date — the order an admin chases them in.
    return [...(invoices.data ?? [])].sort((a, b) => {
      if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
      return a.dueDate.localeCompare(b.dueDate);
    });
  }, [invoices.data]);

  if (tournaments.loading) return <Loading label="Loading tournaments…" />;
  if (!tournament) {
    return <EmptyState title="No tournaments yet" subtitle="Create one to start tracking invoices." />;
  }

  const f = financials.data;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={invoices.refreshing}
          onRefresh={() => {
            void invoices.refresh();
            void financials.refresh();
          }}
          tintColor={colors.primary}
        />
      }
    >
      <ErrorBanner message={invoices.error} />

      {f ? (
        <Pressable onPress={() => router.push(`/tournament/${tournament.id}`)}>
          <Card>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text style={type.label}>{f.tournament.name.toUpperCase()}</Text>
              <Badge
                label={f.isCashPositive ? 'CASH POSITIVE' : 'CASH NEGATIVE'}
                tone={f.isCashPositive ? 'success' : 'danger'}
              />
            </Row>
            <Text
              style={[
                styles.bigMoney,
                { color: f.isCashPositive ? colors.success : colors.danger },
              ]}
            >
              {formatSGD(f.netPosition)}
            </Text>
            <Text style={type.caption}>
              {formatSGD(f.playerDues.totalCollected)} collected from players ·{' '}
              {formatSGD(f.invoices.totalPaid)} paid to vendors
            </Text>
            <Text style={[type.caption, { color: colors.primary, marginTop: spacing.sm }]}>
              View full financial summary →
            </Text>
          </Card>
        </Pressable>
      ) : null}

      <Row style={{ gap: spacing.sm, marginBottom: spacing.md }}>
        <Button
          label="Upload invoice"
          onPress={() => router.push('/invoice/new?mode=upload')}
          style={{ flex: 1 }}
        />
        <Button
          label="Enter manually"
          variant="secondary"
          onPress={() => router.push('/invoice/new?mode=manual')}
          style={{ flex: 1 }}
        />
      </Row>

      <SearchBar value={search} onChangeText={setSearch} placeholder="Search vendor or number…" />
      <View style={{ marginTop: spacing.sm, marginBottom: spacing.md }}>
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'ALL', label: 'All' },
            { value: 'UNPAID', label: 'Unpaid' },
            { value: 'PAID', label: 'Paid' },
          ]}
        />
      </View>

      {invoices.loading ? (
        <Loading />
      ) : rows.length === 0 ? (
        <EmptyState
          title={search ? 'No invoices match that search' : 'No invoices yet'}
          subtitle={search ? undefined : 'Upload one or enter it manually.'}
        />
      ) : (
        rows.map((inv) => (
          <Pressable key={inv.id} onPress={() => router.push(`/invoice/${inv.id}`)}>
            <Card style={[styles.invoiceCard, inv.isOverdue && styles.overdue]}>
              <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1, paddingRight: spacing.sm }}>
                  <Text style={type.body}>{inv.vendorName}</Text>
                  <Text style={type.caption}>
                    {inv.invoiceNumber} · due {formatDate(inv.dueDate)}
                  </Text>
                  {inv.isOverdue ? (
                    <Text style={[type.caption, { color: colors.danger, fontWeight: '600' }]}>
                      Overdue
                    </Text>
                  ) : null}
                </View>
                <View style={{ alignItems: 'flex-end', gap: spacing.xs }}>
                  <Text style={type.money}>{formatSGD(inv.amount)}</Text>
                  <Badge
                    label={inv.status}
                    tone={inv.status === 'PAID' ? 'success' : 'danger'}
                  />
                </View>
              </Row>
            </Card>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  bigMoney: { fontSize: 30, fontWeight: '800', marginVertical: spacing.xs },
  invoiceCard: { padding: spacing.md },
  overdue: { borderColor: colors.danger, borderWidth: 1.5 },
});
