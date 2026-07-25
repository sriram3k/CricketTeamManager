import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { api, ApiError } from '../../src/api';
import { useLoader } from '../../src/hooks';
import { useDialog } from '../../src/dialog';
import { Badge, Button, Card, ErrorBanner, Field, Loading, Row, SuccessBanner } from '../../src/components/ui';
import { colors, spacing, type } from '../../src/theme';
import type { ExtractResponse, Tournament } from '../../src/types';

/**
 * Features 4 — both invoice paths share this form. In upload mode the fields
 * arrive pre-filled from extraction and stay fully editable; in manual mode
 * they start blank. Either way the admin confirms before anything is saved.
 */
export default function NewInvoiceScreen() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const router = useRouter();
  const dialog = useDialog();

  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [amount, setAmount] = useState('');
  const [gstAmount, setGstAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [extraction, setExtraction] = useState<ExtractResponse['extracted'] | null>(null);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const tournaments = useLoader(() => api.get<Tournament[]>('/api/tournaments'), []);
  const tournament = tournaments.data?.[0] ?? null;

  // Upload mode opens the picker immediately — the file is the whole point.
  useEffect(() => {
    if (mode === 'upload' && !fileUrl) void pickAndExtract();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  async function pickAndExtract() {
    setBanner(null);
    setNotice(null);

    const picked = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'],
      copyToCacheDirectory: true,
    });
    if (picked.canceled || !picked.assets?.[0]) return;

    const asset = picked.assets[0];
    setBusy(true);
    try {
      const res = await api.upload<ExtractResponse>('/api/invoices/extract', {
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType ?? 'application/pdf',
      });

      setFileUrl(res.file.url);
      setFileName(res.file.name);
      setExtraction(res.extracted);
      setNotice(res.message);

      // Pre-fill only the fields extraction actually found.
      if (res.extracted.invoiceNumber) setInvoiceNumber(res.extracted.invoiceNumber);
      if (res.extracted.vendorName) setVendorName(res.extracted.vendorName);
      if (res.extracted.amount) setAmount(res.extracted.amount);
      if (res.extracted.gstAmount) setGstAmount(res.extracted.gstAmount);
      if (res.extracted.dueDate) setDueDate(res.extracted.dueDate);
    } catch (err) {
      if (err instanceof ApiError) {
        const detail = Object.values(err.fieldErrors)[0];
        setBanner(detail ? `${err.message} — ${detail}` : err.message);
      } else {
        setBanner('Could not upload that file. You can still enter the details by hand.');
      }
    } finally {
      setBusy(false);
    }
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!invoiceNumber.trim()) next.invoiceNumber = 'Enter the invoice number';
    if (!vendorName.trim()) next.vendorName = 'Enter the vendor name';
    if (!/^\d+(\.\d{1,2})?$/.test(amount.trim()) || Number(amount) <= 0) {
      next.amount = 'Enter an amount greater than zero';
    }
    if (gstAmount.trim() && !/^\d+(\.\d{1,2})?$/.test(gstAmount.trim())) {
      next.gstAmount = 'Enter a valid GST amount';
    }
    if (gstAmount.trim() && Number(gstAmount) > Number(amount)) {
      next.gstAmount = 'GST cannot be more than the total amount';
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate.trim())) {
      next.dueDate = 'Use the format YYYY-MM-DD';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function save() {
    setBanner(null);
    if (!tournament) {
      setBanner('No tournament to file this invoice against.');
      return;
    }
    if (!validate()) return;

    setBusy(true);
    try {
      await api.post(`/api/tournaments/${tournament.id}/invoices`, {
        invoiceNumber: invoiceNumber.trim(),
        vendorName: vendorName.trim(),
        amount: amount.trim(),
        gstAmount: gstAmount.trim() || '0',
        dueDate: dueDate.trim(),
        fileUrl,
        source: fileUrl ? 'UPLOADED' : 'MANUAL',
      });
      await dialog.notify({
        title: 'Invoice saved',
        message: `${invoiceNumber.trim()} added to ${tournament.name}.`,
        confirmLabel: 'Done',
      });
      router.back();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fieldErrors);
        if (Object.keys(err.fieldErrors).length === 0) setBanner(err.message);
      } else {
        setBanner('Could not save the invoice. Check your connection and try again.');
      }
    } finally {
      setBusy(false);
    }
  }

  if (tournaments.loading) return <Loading />;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <ErrorBanner message={banner} />
      <SuccessBanner message={notice} />

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={type.heading}>Invoice file</Text>
          {extraction ? (
            <Badge
              label={
                extraction.succeeded
                  ? `${Math.round(extraction.confidence * 100)}% CONFIDENCE`
                  : 'NOT READ'
              }
              tone={extraction.succeeded && extraction.confidence >= 0.7 ? 'success' : 'warning'}
            />
          ) : null}
        </Row>
        <Text style={[type.caption, { marginTop: spacing.xs }]}>
          {fileName ?? 'Optional — attach the PDF or photo and the fields fill themselves in.'}
        </Text>
        {extraction?.notes ? (
          <Text style={[type.caption, { marginTop: spacing.xs, color: colors.warning }]}>
            {extraction.notes}
          </Text>
        ) : null}
        <Button
          label={fileUrl ? 'Replace file' : 'Attach a file'}
          variant="secondary"
          onPress={() => void pickAndExtract()}
          loading={busy && !fileUrl}
          style={{ marginTop: spacing.md }}
        />
      </Card>

      <Card>
        <Text style={[type.heading, { marginBottom: spacing.md }]}>Details</Text>
        <Text style={[type.caption, { marginBottom: spacing.md }]}>
          Every field is editable — check them against the invoice before saving.
        </Text>

        <Field
          label="Invoice number"
          value={invoiceNumber}
          onChangeText={setInvoiceNumber}
          error={errors.invoiceNumber}
          autoCapitalize="characters"
          placeholder="SCA-2026-0148"
        />
        <Field
          label="Vendor"
          value={vendorName}
          onChangeText={setVendorName}
          error={errors.vendorName}
          placeholder="Singapore Cricket Association"
        />
        <Field
          label="Total amount incl. GST (SGD)"
          value={amount}
          onChangeText={setAmount}
          error={errors.amount}
          keyboardType="decimal-pad"
          placeholder="1635.00"
        />
        <Field
          label="GST amount (SGD)"
          value={gstAmount}
          onChangeText={setGstAmount}
          error={errors.gstAmount}
          keyboardType="decimal-pad"
          placeholder="135.00"
          hint="Leave blank if the invoice shows no GST."
        />
        <Field
          label="Due date"
          value={dueDate}
          onChangeText={setDueDate}
          error={errors.dueDate}
          placeholder="YYYY-MM-DD"
          autoCapitalize="none"
        />
      </Card>

      <Button label="Save invoice" onPress={() => void save()} loading={busy} />
      <View style={{ height: spacing.xl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
});
