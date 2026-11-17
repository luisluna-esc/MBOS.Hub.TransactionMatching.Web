// Mismos formatos que los DTOs del backend (TransactionMatching.Application/Dtos/Reconciliation).

export type ReconciliationStatus = 'Open' | 'Closed';
export type Side = 'Income' | 'Expense';

/** Auto, Suggested, Confirmed y Manual son cotejos; los Missing son filas sin pareja. */
export type LineStatus = 'Auto' | 'Suggested' | 'Confirmed' | 'Manual' | 'MissingInLedger' | 'MissingInBank';

export interface BankAccount {
  bankAccountId: number;
  bank: string;
  accountNumber: string;
  name: string;
  department: string | null;
  ledgerSubaccount: string | null;
  isActive: boolean;
}

export interface ReconciliationListItem {
  reconciliationId: number;
  bankAccountId: number;
  bankAccountName: string;
  department: string | null;
  accountNumber: string;
  periodStart: string;
  periodEnd: string;
  status: ReconciliationStatus;
  matchedCount: number;
  toReviewCount: number;
  missingInLedgerCount: number;
  missingInBankCount: number;
  createdByName: string | null;
  createdAt: string;
}

export interface SideSummary {
  bankCount: number;
  bankTotal: number;
  ledgerCount: number;
  ledgerTotal: number;
  matchedCount: number;
  toReviewCount: number;
  missingInLedgerCount: number;
  missingInLedgerTotal: number;
  missingInBankCount: number;
  missingInBankTotal: number;
  amountDifferences: number;
}

export interface BankMovement {
  bankMovementId: number;
  lineNumber: number;
  date: string;
  time: string | null;
  bankCode: string | null;
  name: string | null;
  document: string | null;
  description: string | null;
  glosa: string | null;
  amount: number;
  note: string | null;
}

export interface LedgerEntry {
  ledgerEntryId: number;
  lineNumber: number;
  accountingDate: string;
  movementDate: string | null;
  batch: string | null;
  description: string;
  amount: number;
  note: string | null;
}

export interface ReconciliationLine {
  side: Side;
  status: LineStatus;
  matchId: number | null;
  score: number | null;
  matchNote: string | null;
  bank: BankMovement | null;
  ledger: LedgerEntry | null;
  difference: number;
}

export interface ReconciliationDetail {
  reconciliationId: number;
  bankAccount: BankAccount;
  periodStart: string;
  periodEnd: string;
  status: ReconciliationStatus;
  bankFileName: string;
  ledgerFileName: string;
  bankOpeningBalance: number | null;
  bankClosingBalance: number | null;
  ledgerOpeningBalance: number | null;
  ledgerClosingBalance: number | null;
  reconciledBalance: number | null;
  unexplainedDifference: number | null;
  notes: string | null;
  createdByName: string | null;
  createdAt: string;
  closedAt: string | null;
  income: SideSummary;
  expense: SideSummary;
  lines: ReconciliationLine[];
}

/** Estados que son "cotejado" (no hay nada que hacer). */
export const MATCHED_STATUSES: LineStatus[] = ['Auto', 'Confirmed', 'Manual'];
