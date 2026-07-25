import { useCallback } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { api, ApiError } from '../../src/api';
import { useLoader } from '../../src/hooks';
import { Badge, Button, Card, EmptyState, ErrorBanner, Loading, Row } from '../../src/components/ui';
import { colors, formatDate, formatSGD, spacing, type } from '../../src/theme';
import type { PendingPlayerRow, UndoableAction } from '../../src/types';
import { useDialog } from '../../src/dialog';

/** Feature 2 — entry point: who owes what, plus the undo window. */
export default function PaymentsScreen() {
  const router = useRouter();
  const dialog = useDialog();
  const pending = useLoader(() => api.get<PendingPlayerRow[]>('/api/payments/pending'), []);
  const undoable = useLoader(
    () => api.get<UndoableAction | null>('/api/payments/bulk/undoable'),
    [],
  );

  useFocusEffect(
    useCallback(() => {
      void pending.refresh();
      void undoable.refresh();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  async function undo(action: UndoableAction) {
    const confirmed = await dialog.confirm({
      title: 'Undo this bulk payment?',
      message: `This reverses ${formatSGD(action.totalAmount)} across ${action.playerCount} player(s) and reopens ${action.chargesCleared} charge(s).`,
      confirmLabel: 'Undo',
      cancelLabel: 'Keep it',
      destructive: true,
    });
    if (!confirmed) return;

    try {
      const res = await api.post<{ message: string }>(`/api/payments/bulk/${action.id}/undo`);
      await dialog.notify({ title: 'Undone', message: res.message });
      void pending.refresh();
      void undoable.refresh();
    } catch (err) {
      await dialog.notify({
        title: 'Could not undo',
        message: err instanceof ApiError ? err.message : 'Please try again.',
      });
    }
  }

  const rows = pending.data ?? [];
  const total = rows.reduce((sum, r) => sum + r.totalPendingCents, 0) / 100;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={pending.refreshing}
          onRefresh={() => {
            void pending.refresh();
            void undoable.refresh();
          }}
          tintColor={colors.primary}
        />
      }
    >
      <ErrorBanner message={pending.error} />

      <Card>
        <Text style={type.label}>TOTAL PENDING</Text>
        <Text style={styles.bigMoney}>{formatSGD(total.toFixed(2))}</Text>
        <Text style={type.caption}>
          {rows.length} player{rows.length === 1 ? '' : 's'} with an outstanding balance
        </Text>
        <Button
          label="Start bulk mark as paid"
          onPress={() => router.push('/payments/bulk')}
          disabled={rows.length === 0}
          style={{ marginTop: spacing.lg }}
        />
      </Card>

      {undoable.data ? (
        <Card style={{ borderColor: colors.warning }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={type.heading}>Recent bulk payment</Text>
            <Badge label="UNDOABLE" tone="warning" />
          </Row>
          <Text style={[type.caption, { marginTop: spacing.xs }]}>
            {formatSGD(undoable.data.totalAmount)} from {undoable.data.playerCount} player(s) ·{' '}
            {undoable.data.mode} · recorded by {undoable.data.performedBy.name}
          </Text>
          <Text style={type.caption}>
            Can be undone until {formatDate(undoable.data.undoAvailableUntil)}
          </Text>
          <Button
            label="Undo this bulk payment"
            variant="danger"
            onPress={() => void undo(undoable.data!)}
            style={{ marginTop: spacing.md }}
          />
        </Card>
      ) : null}

      <Text style={[type.heading, { marginBottom: spacing.sm }]}>Players with dues</Text>

      {pending.loading ? (
        <Loading />
      ) : rows.length === 0 ? (
        <EmptyState title="Everyone is settled up" subtitle="No outstanding charges right now." />
      ) : (
        rows.map((r) => (
          <Card key={r.playerId} style={{ padding: spacing.md }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text style={type.body}>{r.name}</Text>
                <Text style={type.caption}>
                  {r.chargeCount} charge{r.chargeCount === 1 ? '' : 's'} · oldest{' '}
                  {formatDate(r.oldestChargeDate)}
                </Text>
              </View>
              <Text style={[type.money, { color: colors.danger }]}>
                {formatSGD(r.totalPending)}
              </Text>
            </Row>
          </Card>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  bigMoney: { fontSize: 32, fontWeight: '800', color: colors.primary, marginVertical: spacing.xs },
});
