/** Response shapes returned by the CricSquad API. */

export type Role = 'ADMIN' | 'PLAYER';
export type SquadRole = 'CAPTAIN' | 'KEEPER' | 'PLAYER' | 'SUB';
export type PaymentMode = 'PAYNOW' | 'BANK_TRANSFER' | 'CASH';
export type InvoicePaymentMode = 'PAYNOW' | 'BANK_TRANSFER' | 'CHEQUE' | 'CARD' | 'CASH';
export type ChargeType = 'MATCH_FEE' | 'REGISTRATION_FEE' | 'JERSEY_FEE' | 'ADHOC';
export type LineMatchStatus = 'AUTO_MATCHED' | 'MANUALLY_MATCHED' | 'UNMATCHED' | 'IGNORED';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  playerId: string | null;
}

export interface PlayerRow {
  id: string;
  name: string;
  mobile: string | null;
  email: string | null;
  jerseyNumber: number | null;
  active: boolean;
  totalPending: string;
  oldestChargeDate: string | null;
}

export interface PlayerDues {
  player: { id: string; name: string; jerseyNumber: number | null; mobile: string | null; active: boolean };
  totalPending: string;
  matchFeesPending: string;
  adhocPending: string;
  charges: Array<{
    id: string;
    type: ChargeType;
    amount: string;
    allocated: string;
    balance: string;
    description: string;
    status: string;
    matchId: string | null;
    dueDate: string | null;
    createdAt: string;
    paidAt: string | null;
  }>;
  payments: Array<{
    id: string;
    amount: string;
    mode: string;
    reference: string | null;
    receivedDate: string;
    source: string;
    allocations: Array<{ chargeId: string; amount: string; description: string }>;
  }>;
}

export interface Tournament {
  id: string;
  name: string;
  organiser: string | null;
  startDate: string;
  endDate: string;
  venue: string | null;
  matchCount: number;
  invoiceCount: number;
}

export interface MatchRow {
  id: string;
  opponent: string;
  matchDate: string;
  venue: string | null;
  matchFee: string;
  squadConfirmedAt: string | null;
  squadSize: number;
  chargeCount: number;
}

export interface MatchDetail {
  id: string;
  opponent: string;
  matchDate: string;
  venue: string | null;
  matchFee: string;
  squadConfirmedAt: string | null;
  tournament: { id: string; name: string };
  squad: Array<{ playerId: string; name: string; jerseyNumber: number | null; role: SquadRole }>;
}

export interface PendingPlayerRow {
  playerId: string;
  name: string;
  jerseyNumber: number | null;
  mobile: string | null;
  totalPending: string;
  totalPendingCents: number;
  oldestChargeDate: string | null;
  chargeCount: number;
}

export interface BulkPreview {
  rows: Array<{
    playerId: string;
    playerName: string;
    pendingBefore: string;
    amountToPay: string;
    chargesCleared: number;
    chargesPartiallyPaid: number;
    pendingAfter: string;
    unallocated: string;
    fullySettled: boolean;
    warning?: string;
  }>;
  playerCount: number;
  totalAmount: string;
  totalChargesCleared: number;
  playersFullySettled: number;
  totalUnallocated: string;
}

export interface BulkResult {
  bulkActionId: string;
  playerCount: number;
  totalAmount: string;
  chargesCleared: number;
  playersFullySettled: number;
  undoAvailableUntil: string;
  message: string;
}

export interface UndoableAction {
  id: string;
  playerCount: number;
  totalAmount: string;
  chargesCleared: number;
  mode: string;
  reference: string | null;
  createdAt: string;
  performedBy: { id: string; name: string; email: string };
  undoAvailableUntil: string;
}

export interface StatementUploadRow {
  id: string;
  fileName: string;
  uploadedAt: string;
  periodFrom: string;
  periodTo: string;
  status: 'PROCESSING' | 'REVIEWED' | 'COMPLETED';
  matchedCount: number;
  unmatchedCount: number;
  completedAt: string | null;
}

export interface UploadStatementResult {
  statementUploadId: string;
  totalLines: number;
  autoMatchedCount: number;
  unmatchedCount: number;
  duplicateCount: number;
  skipped: Array<{ rowNumber: number; reason: string }>;
  detectedHeaders: string[];
  message: string;
}

export interface ReviewLine {
  id: string;
  txnDate: string;
  description: string;
  amount: string;
  matchStatus: LineMatchStatus;
  matchReason: string | null;
  matchConfidence: number | null;
  isDuplicate: boolean;
  proposedPlayer: { id: string; name: string; jerseyNumber: number | null } | null;
  playerPending: string | null;
}

export interface ReviewScreen {
  upload: {
    id: string;
    fileName: string;
    periodFrom: string;
    periodTo: string;
    status: string;
    uploadedAt: string;
  };
  autoMatched: ReviewLine[];
  unmatched: ReviewLine[];
  ignored: ReviewLine[];
  totals: { received: string; autoMatched: string; unmatched: string; ignored: string };
}

export interface ReconciliationSummary {
  totalReceived: string;
  paymentsCreated: number;
  chargesCleared: number;
  playersFullySettled: number;
  linesIgnored: number;
  linesUnmatched: number;
  unallocated: string;
  message: string;
  playerBreakdown: Array<{
    playerId: string;
    playerName: string;
    received: string;
    chargesCleared: number;
    stillPending: string;
    fullySettled: boolean;
  }>;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  vendorName: string;
  amount: string;
  gstAmount: string;
  dueDate: string;
  status: 'UNPAID' | 'PAID';
  source: 'UPLOADED' | 'MANUAL';
  fileUrl: string | null;
  txnReference: string | null;
  paymentMode: string | null;
  paidDate: string | null;
  isOverdue: boolean;
  createdAt: string;
}

export interface InvoiceDetail extends Invoice {
  audits: Array<{
    id: string;
    action: 'CREATED' | 'EDITED' | 'MARKED_PAID' | 'REOPENED';
    detail: string | null;
    at: string;
    by: { id: string; name: string; email: string };
  }>;
}

export interface ExtractedInvoice {
  invoiceNumber: string | null;
  vendorName: string | null;
  amount: string | null;
  gstAmount: string | null;
  dueDate: string | null;
  confidence: number;
  notes: string | null;
  provider: string;
  succeeded: boolean;
  errorMessage?: string;
}

export interface ExtractResponse {
  file: { url: string; key: string; name: string; size: number };
  extracted: ExtractedInvoice;
  message: string;
}

export interface TournamentFinancials {
  tournament: { id: string; name: string; startDate: string; endDate: string };
  invoices: {
    totalInvoiced: string;
    totalPaid: string;
    totalOutstanding: string;
    overdueCount: number;
    count: number;
  };
  playerDues: { totalCharged: string; totalCollected: string; totalPending: string };
  netPosition: string;
  isCashPositive: boolean;
}
