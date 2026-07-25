import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api, ApiError } from '../../src/api';
import { useDebounced, useLoader } from '../../src/hooks';
import { useDialog } from '../../src/dialog';
import { Badge, Button, Card, EmptyState, ErrorBanner, Loading, Row, SearchBar, Segmented } from '../../src/components/ui';
import { colors, formatDate, formatSGD, radius, spacing, type } from '../../src/theme';
import type { PlayerRow, ReconciliationSummary, ReviewLine, ReviewScreen } from '../../src/types';

type Tab = 'auto' | 'unmatched' | 'ignored';

/**
 * Feature 3 — the three-tab review. Confirm the auto-matched proposals, assign
 * or ignore the rest, then commit everything in one go.
 */
export default function StatementReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const dialog = useDialog();
  const [tab, setTab] = useState<Tab>('auto');
  const [banner, setBanner] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [assigning, setAssigning] = useState<ReviewLine | null>(null);

  const review = useLoader(() => api.get<ReviewScreen>(`/api/statements/${id}/review`), [id]);

  const lines = useMemo(() => {
    if (!review.data) return [];
    if (tab === 'auto') return review.data.autoMatched;
    if (tab === 'unmatched') return review.data.unmatched;
    return review.data.ignored;
  }, [review.data, tab]);

  async function confirmAll() {
    setBanner(null);
    setBusy(true);
    try {
      const res = await api.post<{ message: string }>(`/api/statements/${id}/confirm-all`);
      setBanner(null);
      await dialog.notify({ title: 'Confirmed', message: res.message });
      void review.refresh();
    } catch (err) {
      setBanner(err instanceof ApiError ? err.message : 'Could not confirm the matches.');
    } finally {
      setBusy(false);
    }
  }

  async function updateLine(lineId: string, body: { playerId?: string | null; ignore?: boolean }) {
    setBanner(null);
    try {
      await api.patch(`/api/statements/lines/${lineId}`, body);
      void review.refresh();
    } catch (err) {
      setBanner(err instanceof ApiError ? err.message : 'Could not update that line.');
    }
  }

  async function complete() {
    const unmatchedCount = review.data?.unmatched.length ?? 0;
    const confirmed = await dialog.confirm({
      title: 'Complete reconciliation?',
      message:
        unmatchedCount > 0
          ? `${unmatchedCount} line(s) are still unmatched and will be left out. Everything matched will be recorded as payments in one go.`
          : 'Everything matched will be recorded as payments in one go.',
      confirmLabel: 'Complete',
      cancelLabel: 'Not yet',
    });
    if (!confirmed) return;

    setBusy(true);
    try {
      const summary = await api.post<ReconciliationSummary>(`/api/statements/${id}/complete`);
      await dialog.notify({
        title: 'Reconciliation complete',
        message: `${summary.message}\n\n${summary.linesIgnored} line(s) ignored, ${summary.linesUnmatched} left unmatched.`,
        confirmLabel: 'Done',
      });
      router.back();
    } catch (err) {
      setBanner(
        err instanceof ApiError
          ? err.message
          : 'Could not complete the reconciliation. Nothing was saved.',
      );
    } finally {
      setBusy(false);
    }
  }

  if (review.loading) return <Loading label="Loading statement…" />;
  if (!review.data) {
    return (
      <View style={{ padding: spacing.lg }}>
        <ErrorBanner message={review.error ?? 'Statement not found'} />
      </View>
    );
  }

  const d = review.data;
  const isComplete = d.upload.status === 'COMPLETED';

  return (
    <View style={styles.screen}>
      <FlatList
        contentContainerStyle={styles.content}
        data={lines}
        keyExtractor={(l) => l.id}
        refreshControl={
          <RefreshControl
            refreshing={review.refreshing}
            onRefresh={review.refresh}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <View>
            <ErrorBanner message={banner ?? review.error} />

            <Card>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text style={type.heading} numberOfLines={1}>
                  {d.upload.fileName}
                </Text>
                {isComplete ? <Badge label="COMPLETE" tone="success" /> : null}
              </Row>
              <Text style={type.caption}>
                {formatDate(d.upload.periodFrom)} – {formatDate(d.upload.periodTo)}
              </Text>
              <Text style={[styles.bigMoney]}>{formatSGD(d.totals.received)}</Text>
              <Text style={type.caption}>
                {formatSGD(d.totals.autoMatched)} matched · {formatSGD(d.totals.unmatched)}{' '}
                unmatched · {formatSGD(d.totals.ignored)} ignored
              </Text>
            </Card>

            <Segmented
              value={tab}
              onChange={setTab}
              options={[
                { value: 'auto', label: `Matched (${d.autoMatched.length})` },
                { value: 'unmatched', label: `Unmatched (${d.unmatched.length})` },
                { value: 'ignored', label: `Ignored (${d.ignored.length})` },
              ]}
            />

            {tab === 'auto' && !isComplete && d.autoMatched.some((l) => l.matchStatus === 'AUTO_MATCHED') ? (
              <Button
                label="Confirm all auto-matched"
                variant="secondary"
                onPress={() => void confirmAll()}
                loading={busy}
                style={{ marginTop: spacing.md }}
              />
            ) : null}

            <View style={{ height: spacing.md }} />
          </View>
        }
        renderItem={({ item }) => (
          <LineCard
            line={item}
            readOnly={isComplete}
            onAssign={() => setAssigning(item)}
            onIgnore={() => void updateLine(item.id, { ignore: true })}
            onClear={() => void updateLine(item.id, { playerId: null })}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            title={
              tab === 'auto'
                ? 'Nothing was auto-matched'
                : tab === 'unmatched'
                  ? 'No unmatched lines'
                  : 'No ignored lines'
            }
          />
        }
      />

      {!isComplete ? (
        <View style={styles.footer}>
          <Button
            label="Complete reconciliation"
            onPress={() => void complete()}
            loading={busy}
            disabled={d.autoMatched.length === 0}
          />
        </View>
      ) : null}

      <AssignPlayerModal
        line={assigning}
        onClose={() => setAssigning(null)}
        onPick={(playerId) => {
          const line = assigning;
          setAssigning(null);
          if (line) void updateLine(line.id, { playerId });
        }}
      />
    </View>
  );
}

function LineCard({
  line,
  readOnly,
  onAssign,
  onIgnore,
  onClear,
}: {
  line: ReviewLine;
  readOnly: boolean;
  onAssign: () => void;
  onIgnore: () => void;
  onClear: () => void;
}) {
  return (
    <Card style={{ padding: spacing.md }}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1, paddingRight: spacing.sm }}>
          <Text style={type.body}>{formatDate(line.txnDate)}</Text>
          <Text style={type.caption} numberOfLines={2}>
            {line.description}
          </Text>
        </View>
        <Text style={type.money}>{formatSGD(line.amount)}</Text>
      </Row>

      {line.isDuplicate ? (
        <View style={{ marginTop: spacing.sm }}>
          <Badge label="ALREADY PROCESSED" tone="danger" />
        </View>
      ) : null}

      {line.proposedPlayer ? (
        <View style={styles.proposal}>
          <Text style={type.body}>{line.proposedPlayer.name}</Text>
          <Text style={type.caption}>
            {line.matchReason}
            {line.matchConfidence !== null ? ` · ${line.matchConfidence}% confidence` : ''}
          </Text>
          {line.playerPending !== null ? (
            <Text style={type.caption}>Currently owes {formatSGD(line.playerPending)}</Text>
          ) : null}
        </View>
      ) : line.matchStatus === 'UNMATCHED' ? (
        <Text style={[type.caption, { marginTop: spacing.sm }]}>{line.matchReason}</Text>
      ) : null}

      {readOnly ? null : (
        <Row style={{ marginTop: spacing.md, gap: spacing.sm }}>
          <Button
            label={line.proposedPlayer ? 'Change player' : 'Assign player'}
            variant="secondary"
            onPress={onAssign}
            style={{ flex: 1 }}
          />
          {line.matchStatus === 'IGNORED' ? (
            <Button label="Un-ignore" variant="secondary" onPress={onClear} style={{ flex: 1 }} />
          ) : (
            <Button label="Ignore" variant="secondary" onPress={onIgnore} style={{ flex: 1 }} />
          )}
        </Row>
      )}
    </Card>
  );
}

/** Player picker for assigning an unmatched line by hand. */
function AssignPlayerModal({
  line,
  onClose,
  onPick,
}: {
  line: ReviewLine | null;
  onClose: () => void;
  onPick: (playerId: string) => void;
}) {
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);
  const roster = useLoader(
    () => (line ? api.get<PlayerRow[]>('/api/players', { search: debounced }) : Promise.resolve([])),
    [debounced, line?.id],
  );

  return (
    <Modal visible={!!line} animationType="slide" onRequestClose={onClose} transparent={false}>
      <View style={[styles.screen, { padding: spacing.lg }]}>
        <Row style={{ justifyContent: 'space-between', marginBottom: spacing.md }}>
          <Text style={type.title}>Assign to</Text>
          <Pressable onPress={onClose} accessibilityRole="button">
            <Text style={[type.body, { color: colors.primary, fontWeight: '600' }]}>Cancel</Text>
          </Pressable>
        </Row>

        {line ? (
          <Text style={[type.caption, { marginBottom: spacing.md }]}>
            {formatSGD(line.amount)} on {formatDate(line.txnDate)} — {line.description}
          </Text>
        ) : null}

        <SearchBar value={search} onChangeText={setSearch} placeholder="Search players…" />

        <FlatList
          style={{ marginTop: spacing.md }}
          data={roster.data ?? []}
          keyExtractor={(p) => p.id}
          renderItem={({ item }) => (
            <Pressable onPress={() => onPick(item.id)} style={styles.pickRow}>
              <View style={{ flex: 1 }}>
                <Text style={type.body}>{item.name}</Text>
                <Text style={type.caption}>Owes {formatSGD(item.totalPending)}</Text>
              </View>
              <Text style={type.caption}>
                {item.jerseyNumber !== null ? `#${item.jerseyNumber}` : ''}
              </Text>
            </Pressable>
          )}
          ListEmptyComponent={
            roster.loading ? <Loading /> : <EmptyState title="No players match that search" />
          }
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  bigMoney: { fontSize: 28, fontWeight: '800', color: colors.primary, marginVertical: spacing.xs },
  proposal: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.sm,
  },
  pickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
});
