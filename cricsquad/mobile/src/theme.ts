export const colors = {
  bg: '#F5F7F5',
  surface: '#FFFFFF',
  border: '#E2E8E4',
  primary: '#0F3D2E',
  primarySoft: '#E6F0EB',
  accent: '#C87941',
  text: '#12211B',
  textMuted: '#5C6B64',
  danger: '#B3261E',
  dangerSoft: '#FBEAE8',
  success: '#1B7A46',
  successSoft: '#E4F3EA',
  warning: '#8A5A00',
  warningSoft: '#FBF0DC',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const radius = { sm: 6, md: 10, lg: 14, pill: 999 };

export const type = {
  title: { fontSize: 22, fontWeight: '700' as const, color: colors.text },
  heading: { fontSize: 17, fontWeight: '600' as const, color: colors.text },
  body: { fontSize: 15, color: colors.text },
  label: { fontSize: 13, fontWeight: '600' as const, color: colors.textMuted },
  caption: { fontSize: 12, color: colors.textMuted },
  money: { fontSize: 16, fontWeight: '700' as const, color: colors.text },
};

/** "1234.50" → "S$1,234.50". Formatting only — never used for arithmetic. */
export function formatSGD(amount: string | number | null | undefined): string {
  if (amount === null || amount === undefined || amount === '') return 'S$0.00';
  const value = typeof amount === 'number' ? amount.toFixed(2) : amount;
  const negative = value.startsWith('-');
  const [whole, frac = '00'] = value.replace('-', '').split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${negative ? '-' : ''}S$${grouped}.${frac.padEnd(2, '0')}`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-SG', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}
