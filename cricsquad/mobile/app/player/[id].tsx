import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { api } from '../../src/api';
import { useLoader } from '../../src/hooks';
import { Badge, Card, EmptyState, ErrorBanner, Loading, Row, Segmented } from '../../src/components/ui';
import { colors, formatDate, formatSGD, spacing, type } from '../../src/theme';
import type { PlayerDues } from '../../src/types';

type Tab = 'charges' | 'payments';

/** Feature 1 — per-player dues: totals, itemised charges, payment history. */
export default function PlayerDuesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>('charges');
  const dues = useLoader(() => api.get<PlayerDues>(`/api/players/${id}/dues`), [id]);

  if (dues.loading) return <Loading label="Loading dues…" />;
  if (dues.error && !dues.data) {
    return (
      <View style={{ padding: spacing.lg }}>
        <ErrorBanner message={dues.error} />
      </View>
    );
  }
  if (!dues.data) return <EmptyState title="Player not found" />;

  const d = dues.data;
  const matchCharges = d.charges.filter((c) => c.type === 'MATCH_FEE');
  const adhocCharges = d.charges.filter((c) => c.type !== 'MATCH_FEE');

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={dues.refreshing}
          onRefresh={dues.refresh}
          tintColor={colors.primary}
        />
      }
    >
      <ErrorBanner message={dues.error} />

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text style={type.title}>{d.player.name}</Text>
            <Text style={type.caption}>
              {d.player.jerseyNumber !== null ? `#${d.player.jerseyNumber}` : 'No jersey number'}
              {d.player.mobile ? ` · ${d.player.mobile}` : ''}
            </Text>
          </View>
          {d.player.active ? null : <Badge label="INACTIVE" tone="warning" />}
        </Row>

        <Text style={[type.label, { marginTop: spacing.lg }]}>TOTAL OUTSTANDING</Text>
        <Text
          style={[
            styles.bigMoney,
            { color: Number(d.totalPending) > 0 ? colors.danger : colors.success },
          ]}
        >
          {formatSGD(d.totalPending)}
        </Text>

        <Row style={{ marginTop: spacing.sm, gap: spacing.xl }}>
          <View>
            <Text style={type.caption}>Match fees</Text>
            <Text style={type.money}>{formatSGD(d.matchFeesPending)}</Text>
          </View>
          <View>
            <Text style={type.caption}>Other charges</Text>
            <Text style={type.money}>{formatSGD(d.adhocPending)}</Text>
          </View>
        </Row>
      </Card>

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'charges', label: `Charges (${d.charges.length})` },
          { value: 'payments', label: `Payments (${d.payments.length})` },
        ]}
      />

      {tab === 'charges' ? (
        <View style={{ marginTop: spacing.md }}>
          <ChargeGroup title="Match fees" charges={matchCharges} />
          <ChargeGroup title="Registration, kit and ad-hoc" charges={adhocCharges} />
          {d.charges.length === 0 ? <EmptyState title="No charges raised yet" /> : null}
        </View>
      ) : (
        <View style={{ marginTop: spacing.md }}>
          {d.payments.length === 0 ? (
            <EmptyState title="No payments recorded yet" />
          ) : (
            d.payments.map((p) => (
              <Card key={p.id}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Text style={type.money}>{formatSGD(p.amount)}</Text>
                  <Badge label={p.source === 'STATEMENT' ? 'FROM STATEMENT' : p.mode} />
                </Row>
                <Text style={[type.caption, { marginTop: spacing.xs }]}>
                  Received {formatDate(p.receivedDate)}
                  {p.reference ? ` · ${p.reference}` : ''}
                </Text>
                {p.allocations.map((a) => (
                  <Row key={a.chargeId} style={styles.allocation}>
                    <Text style={[type.caption, { flex: 1 }]} numberOfLines={1}>
                      {a.description}
                    </Text>
                    <Text style={type.caption}>{formatSGD(a.amount)}</Text>
                  </Row>
                ))}
              </Card>
            ))
          )}
        </View>
      )}
    </ScrollView>
  );
}

function ChargeGroup({
  title,
  charges,
}: {
  title: string;
  charges: PlayerDues['charges'];
}) {
  if (charges.length === 0) return null;

  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={[type.label, { marginBottom: spacing.sm }]}>{title.toUpperCase()}</Text>
      {charges.map((c) => {
        const partiallyPaid = c.status === 'PENDING' && Number(c.allocated) > 0;
        return (
          <Card key={c.id} style={{ padding: spacing.md }}>
            <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1, paddingRight: spacing.sm }}>
                <Text style={type.body}>{c.description}</Text>
                <Text style={[type.caption, { marginTop: 2 }]}>
                  Raised {formatDate(c.createdAt)}
                  {c.dueDate ? ` · due ${formatDate(c.dueDate)}` : ''}
                </Text>
                {partiallyPaid ? (
                  <Text style={[type.caption, { color: colors.warning, marginTop: 2 }]}>
                    {formatSGD(c.allocated)} paid of {formatSGD(c.amount)}
                  </Text>
                ) : null}
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Text style={type.money}>
                  {formatSGD(c.status === 'PENDING' ? c.balance : c.amount)}
                </Text>
                <Badge
                  label={partiallyPaid ? 'PART PAID' : c.status}
                  tone={
                    c.status === 'PAID'
                      ? 'success'
                      : c.status === 'WAIVED'
                        ? 'neutral'
                        : partiallyPaid
                          ? 'warning'
                          : 'danger'
                  }
                />
              </View>
            </Row>
          </Card>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  bigMoney: { fontSize: 32, fontWeight: '800', marginVertical: spacing.xs },
  allocation: {
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
