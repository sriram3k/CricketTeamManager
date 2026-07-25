import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { api, ApiError } from '../../src/api';
import { useLoader } from '../../src/hooks';
import { useDialog } from '../../src/dialog';
import { Badge, Button, Card, EmptyState, ErrorBanner, Loading, Row } from '../../src/components/ui';
import { colors, formatDate, spacing, type } from '../../src/theme';
import type { StatementUploadRow, UploadStatementResult } from '../../src/types';

/** Feature 3 — upload a fortnightly DBS statement and pick up past ones. */
export default function ReconcileScreen() {
  const router = useRouter();
  const dialog = useDialog();
  const [banner, setBanner] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const uploads = useLoader(() => api.get<StatementUploadRow[]>('/api/statements'), []);

  useFocusEffect(
    useCallback(() => {
      void uploads.refresh();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  async function pickAndUpload() {
    setBanner(null);
    const picked = await DocumentPicker.getDocumentAsync({
      type: [
        'text/csv',
        'text/comma-separated-values',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ],
      copyToCacheDirectory: true,
    });
    if (picked.canceled || !picked.assets?.[0]) return;

    const asset = picked.assets[0];
    setUploading(true);
    try {
      const res = await api.upload<UploadStatementResult>('/api/statements', {
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType ?? 'text/csv',
      });

      const skippedNote =
        res.skipped.length > 0 ? `\n\n${res.skipped.length} row(s) were skipped.` : '';
      await dialog.notify({
        title: 'Statement read',
        message: `${res.message}${skippedNote}`,
        confirmLabel: 'Review now',
      });
      router.push(`/statement/${res.statementUploadId}`);
      void uploads.refresh();
    } catch (err) {
      // A bad mapping surfaces as a field error naming the missing column.
      if (err instanceof ApiError) {
        const detail = Object.values(err.fieldErrors)[0];
        setBanner(detail ? `${err.message} — ${detail}` : err.message);
      } else {
        setBanner('Could not upload the statement. Check your connection and try again.');
      }
    } finally {
      setUploading(false);
    }
  }

  const rows = uploads.data ?? [];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={uploads.refreshing}
          onRefresh={uploads.refresh}
          tintColor={colors.primary}
        />
      }
    >
      <ErrorBanner message={banner ?? uploads.error} />

      <Card>
        <Text style={type.heading}>Fortnightly reconciliation</Text>
        <Text style={[type.caption, { marginTop: spacing.xs }]}>
          Upload the DBS transaction export. Only incoming credits are read, and nothing is applied
          to player balances until you complete the review.
        </Text>
        <Button
          label="Upload bank statement"
          onPress={() => void pickAndUpload()}
          loading={uploading}
          style={{ marginTop: spacing.lg }}
        />
      </Card>

      <Text style={[type.heading, { marginBottom: spacing.sm }]}>Past uploads</Text>

      {uploads.loading ? (
        <Loading />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No statements uploaded yet"
          subtitle="Upload your first DBS export to get started."
        />
      ) : (
        rows.map((u) => (
          <Card key={u.id} style={{ padding: spacing.md }}>
            <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1, paddingRight: spacing.sm }}>
                <Text style={type.body} numberOfLines={1}>
                  {u.fileName}
                </Text>
                <Text style={type.caption}>
                  {formatDate(u.periodFrom)} – {formatDate(u.periodTo)}
                </Text>
                <Text style={type.caption}>
                  {u.matchedCount} matched · {u.unmatchedCount} unmatched
                </Text>
              </View>
              <Badge
                label={u.status === 'COMPLETED' ? 'COMPLETE' : 'NEEDS REVIEW'}
                tone={u.status === 'COMPLETED' ? 'success' : 'warning'}
              />
            </Row>
            <Button
              label={u.status === 'COMPLETED' ? 'View summary' : 'Continue review'}
              variant="secondary"
              onPress={() => router.push(`/statement/${u.id}`)}
              style={{ marginTop: spacing.md }}
            />
          </Card>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
});
