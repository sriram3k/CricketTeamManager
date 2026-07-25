import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { api } from '../../src/api';
import { useLoader } from '../../src/hooks';
import { Badge, Card, ErrorBanner, Loading, Row } from '../../src/components/ui';
import { colors, formatDate, formatSGD, spacing, type } from '../../src/theme';
import type { TournamentFinancials } from '../../src/types';

/**
 * Feature 5 — the one screen that answers "is this tournament cash-positive":
 * vendor invoices on one side, player dues on the other.
 */
export default function TournamentFinancialsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const financials = useLoader(
    () => api.get<TournamentFinancials>(`/api/tournaments/${id}/financials`),
    [id],
  );

  if (financials.loading) return <Loading label="Loading summary…" />;
  if (!financials.data) {
    return (
      <View style={{ padding: spacing.lg }}>
        <ErrorBanner message={financials.error ?? 'Tournament not found'} />
      </View>
    );
  }

  const f = financials.data;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={financials.refreshing}
          onRefresh={financials.refresh}
          tintColor={colors.primary}
        />
      }
    >
      <ErrorBanner message={financials.error} />

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text style={type.title}>{f.tournament.name}</Text>
            <Text style={type.caption}>
              {formatDate(f.tournament.startDate)} – {formatDate(f.tournament.endDate)}
            </Text>
          </View>
          <Badge
            label={f.isCashPositive ? 'CASH POSITIVE' : 'CASH NEGATIVE'}
            tone={f.isCashPositive ? 'success' : 'danger'}
          />
        </Row>

        <Text style={type.label}>NET POSITION</Text>
        <Text
          style={[styles.bigMoney, { color: f.isCashPositive ? colors.success : colors.danger }]}
        >
          {formatSGD(f.netPosition)}
        </Text>
        <Text style={type.caption}>Collected from players minus paid out to vendors.</Text>
      </Card>

      <Card>
        <Text style={type.heading}>Vendor invoices</Text>
        <StatRow label="Total invoiced" value={f.invoices.totalInvoiced} />
        <StatRow label="Paid" value={f.invoices.totalPaid} tone="success" />
        <StatRow label="Outstanding" value={f.invoices.totalOutstanding} tone="danger" />
        <Row style={{ justifyContent: 'space-between', marginTop: spacing.sm }}>
          <Text style={type.caption}>
            {f.invoices.count} invoice{f.invoices.count === 1 ? '' : 's'}
          </Text>
          {f.invoices.overdueCount > 0 ? (
            <Badge label={`${f.invoices.overdueCount} OVERDUE`} tone="danger" />
          ) : null}
        </Row>
      </Card>

      <Card>
        <Text style={type.heading}>Player dues for this tournament</Text>
        <StatRow label="Total charged" value={f.playerDues.totalCharged} />
        <StatRow label="Collected" value={f.playerDues.totalCollected} tone="success" />
        <StatRow label="Still pending" value={f.playerDues.totalPending} tone="danger" />
        <Text style={[type.caption, { marginTop: spacing.sm }]}>
          Match fees for this tournament's matches only — club-wide charges such as registration
          are excluded.
        </Text>
      </Card>
    </ScrollView>
  );
}

function StatRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'success' | 'danger';
}) {
  const color = tone === 'success' ? colors.success : tone === 'danger' ? colors.danger : colors.text;
  return (
    <Row style={styles.statRow}>
      <Text style={[type.body, { flex: 1 }]}>{label}</Text>
      <Text style={[type.money, { color }]}>{formatSGD(value)}</Text>
    </Row>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  bigMoney: { fontSize: 34, fontWeight: '800', marginVertical: spacing.xs },
  statRow: {
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
});
