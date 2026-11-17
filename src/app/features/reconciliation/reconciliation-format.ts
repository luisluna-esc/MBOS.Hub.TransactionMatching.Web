import { BadgeTone } from '../../shared/components/badge/badge';
import { LineStatus, ReconciliationStatus } from './reconciliation.models';

/** "2026-10-06" → "06/10/2026" (sin pasar por Date, para no correr el día por la zona horaria). */
export function dmy(date: string | null | undefined): string {
  if (!date) return '';
  const [y, m, d] = date.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

/** Clave i18n del mes de una fecha ISO: "months.10". */
export function monthKey(date: string): string {
  return `months.${Number(date.slice(5, 7))}`;
}

export const LINE_STATUS_TONE: Record<LineStatus, BadgeTone> = {
  Auto: 'success',
  Confirmed: 'success',
  Manual: 'info',
  Suggested: 'warning',
  MissingInLedger: 'danger',
  MissingInBank: 'danger',
};

export const RECONCILIATION_STATUS_TONE: Record<ReconciliationStatus, BadgeTone> = {
  Open: 'warning',
  Closed: 'success',
};

/** Texto sin tildes y en minúsculas, para buscar. */
export function normalize(text: string | null | undefined): string {
  return (text ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}
