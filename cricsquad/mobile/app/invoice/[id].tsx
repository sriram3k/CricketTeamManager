import { useState } from 'react';
import { Modal, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { api, ApiError } from '../../src/api';
import { useLoader } from '../../src/hooks';
import { useDialog } from '../../src/dialog';
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, Loading, Row, Segmented } from '../../src/components/ui';
import { colors, formatDate, formatSGD, spacing, type } from '../../src/theme';
import type { InvoiceDetail, InvoicePaymentMode } from '../../src/types';

/** Feature 5 — invoice detail, mark-as-paid, reopen, and the audit trail. */
export default function InvoiceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const dialog = useDialog();
  const [payOpen, setPayOpen] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const invoice = useLoader(() => api.get<InvoiceDetail>(`/api/invoices/${id}`), [id]);

  async function reopen() {
    const confirmed = await dialog.confirm({
      title: 'Reopen this invoice?',
      message:
        'The transaction reference, payment mode and paid date are cleared. The change is recorded against your name.',
      confirmLabel: 'Reopen',
      destructive: true,
    });
    if (!confirmed) return;

    try {
      await api.post(`/api/invoices/${id}/reopen`, {});
      void invoice.refresh();
    } catch (err) {
      setBanner(err instanceof ApiError ? err.message : 'Could not reopen the invoice.');
    }
  }

  if (invoice.loading) return <Loading />;
  if (!invoice.data) {
    return (
      <View style={{ padding: spacing.lg }}>
        <ErrorBanner message={invoice.error ?? 'Invoice not found'} />
      </View>
    );
  }

  const inv = invoice.data;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={invoice.refreshing}
          onRefresh={invoice.refresh}
          tintColor={colors.primary}
        />
      }
    >
      <ErrorBanner message={banner ?? invoice.error} />

      <Card style={inv.isOverdue ? styles.overdue : undefined}>
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Text style={type.title}>{inv.vendorName}</Text>
            <Text style={type.caption}>{inv.invoiceNumber}</Text>
          </View>
          <Badge label={inv.status} tone={inv.status === 'PAID' ? 'success' : 'danger'} />
        </Row>

        <Text style={styles.bigMoney}>{formatSGD(inv.amount)}</Text>
        <Text style={type.caption}>
          Includes {formatSGD(inv.gstAmount)} GST · due {formatDate(inv.dueDate)}
          {inv.isOverdue ? ' · OVERDUE' : ''}
        </Text>
        <Text style={[type.caption, { marginTop: spacing.xs }]}>
          {inv.source === 'UPLOADED' ? 'From an uploaded file' : 'Entered manually'}
        </Text>
      </Card>

      {inv.status === 'PAID' ? (
        <Card>
          <Text style={type.heading}>Payment</Text>
          <Text style={[type.caption, { marginTop: spacing.xs }]}>
            {inv.paymentMode?.replace('_', ' ')} · {formatDate(inv.paidDate)}
          </Text>
          <Text style={[type.body, { marginTop: spacing.xs }]}>Ref {inv.txnReference}</Text>
          <Text style={[type.caption, { marginTop: spacing.md }]}>
            A paid invoice cannot be edited. Reopen it if the payment was recorded in error.
          </Text>
          <Button
            label="Reopen invoice"
            variant="danger"
            onPress={() => void reopen()}
            style={{ marginTop: spacing.md }}
          />
        </Card>
      ) : (
        <Button label="Mark as paid" onPress={() => setPayOpen(true)} />
      )}

      <Text style={[type.heading, { marginTop: spacing.xl, marginBottom: spacing.sm }]}>
        Audit trail
      </Text>
      {inv.audits.length === 0 ? (
        <EmptyState title="Nothing recorded yet" />
      ) : (
        inv.audits.map((a) => (
          <Card key={a.id} style={{ padding: spacing.md }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Badge
                label={a.action.replace('_', ' ')}
                tone={
                  a.action === 'MARKED_PAID'
                    ? 'success'
                    : a.action === 'REOPENED'
                      ? 'danger'
                      : 'neutral'
                }
              />
              <Text style={type.caption}>{formatDate(a.at)}</Text>
            </Row>
            <Text style={[type.caption, { marginTop: spacing.xs }]}>by {a.by.name}</Text>
            {a.detail ? (
              <Text style={[type.caption, { marginTop: 2 }]}>{a.detail}</Text>
            ) : null}
          </Card>
        ))
      )}

      <MarkPaidModal
        visible={payOpen}
        invoiceId={inv.id}
        amount={inv.amount}
        onClose={() => setPayOpen(false)}
        onPaid={() => {
          setPayOpen(false);
          void invoice.refresh();
        }}
      />
    </ScrollView>
  );
}

function MarkPaidModal({
  visible,
  invoiceId,
  amount,
  onClose,
  onPaid,
}: {
  visible: boolean;
  invoiceId: string;
  amount: string;
  onClose: () => void;
  onPaid: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [txnReference, setTxnReference] = useState('');
  const [paymentMode, setPaymentMode] = useState<InvoicePaymentMode>('PAYNOW');
  const [paidDate, setPaidDate] = useState(today);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBanner(null);
    const next: Record<string, string> = {};
    // The spec makes the reference mandatory — enforce it before the request.
    if (!txnReference.trim()) next.txnReference = 'Enter the transaction reference';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(paidDate.trim())) next.paidDate = 'Use the format YYYY-MM-DD';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setBusy(true);
    try {
      await api.post(`/api/invoices/${invoiceId}/mark-paid`, {
        txnReference: txnReference.trim(),
        paymentMode,
        paidDate: paidDate.trim(),
      });
      setTxnReference('');
      onPaid();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fieldErrors);
        if (Object.keys(err.fieldErrors).length === 0) setBanner(err.message);
      } else {
        setBanner('Could not record the payment. Check your connection and try again.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Text style={type.title}>Mark as paid</Text>
        <Text style={[type.caption, { marginTop: spacing.xs, marginBottom: spacing.lg }]}>
          Recording {formatSGD(amount)}. Once saved, the invoice is locked unless it is reopened.
        </Text>

        <ErrorBanner message={banner} />

        <Field
          label="Transaction reference (required)"
          value={txnReference}
          onChangeText={setTxnReference}
          error={errors.txnReference}
          placeholder="PAYNOW-20260315-771"
          autoCapitalize="characters"
        />

        <Text style={[type.label, { marginBottom: spacing.sm }]}>PAYMENT MODE</Text>
        <Segmented
          value={paymentMode}
          onChange={setPaymentMode}
          options={[
            { value: 'PAYNOW', label: 'PayNow' },
            { value: 'BANK_TRANSFER', label: 'Transfer' },
            { value: 'CHEQUE', label: 'Cheque' },
          ]}
        />
        <View style={{ height: spacing.sm }} />
        <Segmented
          value={paymentMode}
          onChange={setPaymentMode}
          options={[
            { value: 'CARD', label: 'Card' },
            { value: 'CASH', label: 'Cash' },
          ]}
        />

        <View style={{ height: spacing.lg }} />
        <Field
          label="Paid date"
          value={paidDate}
          onChangeText={setPaidDate}
          error={errors.paidDate}
          placeholder="YYYY-MM-DD"
          autoCapitalize="none"
        />

        <Button label="Record payment" onPress={() => void submit()} loading={busy} />
        <Button
          label="Cancel"
          variant="secondary"
          onPress={onClose}
          style={{ marginTop: spacing.sm }}
        />
      </ScrollView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  bigMoney: { fontSize: 30, fontWeight: '800', color: colors.primary, marginVertical: spacing.xs },
  overdue: { borderColor: colors.danger, borderWidth: 1.5 },
});
