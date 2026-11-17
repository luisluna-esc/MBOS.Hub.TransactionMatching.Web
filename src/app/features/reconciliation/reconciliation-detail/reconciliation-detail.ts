import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { DialogService } from '../../../core/dialog/dialog.service';
import { apiErrorCode, apiErrorMessage } from '../../../core/http/api-error';
import { saveBlob } from '../../../core/http/save-blob';
import { LanguageService } from '../../../core/i18n/language.service';
import { ToastService } from '../../../core/toast/toast.service';
import { Badge } from '../../../shared/components/badge/badge';
import { ConfirmDialog, ConfirmDialogData } from '../../../shared/components/confirm-dialog/confirm-dialog';
import { ErrorState } from '../../../shared/components/error-state/error-state';
import { Input as AppInput } from '../../../shared/components/input/input';
import { Skeleton } from '../../../shared/components/skeleton/skeleton';
import { Tooltip } from '../../../shared/components/tooltip/tooltip';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { MatchDialog, MatchDialogData } from '../match-dialog/match-dialog';
import { NoteDialog, NoteDialogData } from '../note-dialog/note-dialog';
import { dmy, LINE_STATUS_TONE, monthKey, normalize, RECONCILIATION_STATUS_TONE } from '../reconciliation-format';
import { LineStatus, MATCHED_STATUSES, ReconciliationDetail as Detail, ReconciliationLine, Side } from '../reconciliation.models';
import { ReconciliationService } from '../reconciliation.services';

/** Filtro de la tabla: todas, por revisar, lo que falta en cada lado, o lo ya cotejado. */
type LineFilter = 'all' | 'Suggested' | 'MissingInLedger' | 'MissingInBank' | 'matched';

// Revisión de una conciliación (lo que antes era el Excel de control): banco a la izquierda,
// ASSINET a la derecha, una fila por par cotejado o por fila sin pareja. Contabilidad confirma
// las propuestas, deshace las que están mal, empareja a mano lo que el sistema no pudo y anota.
@Component({
  selector: 'app-reconciliation-detail',
  imports: [FormsModule, RouterLink, AppInput, Badge, ErrorState, MoneyPipe, Skeleton, Tooltip, TranslatePipe],
  templateUrl: './reconciliation-detail.html',
})
export class ReconciliationDetail {
  /** :id de la ruta (withComponentInputBinding). */
  readonly id = input.required<string>();

  private readonly reconciliationService = inject(ReconciliationService);
  private readonly dialogService = inject(DialogService);
  private readonly languageService = inject(LanguageService);
  private readonly toastService = inject(ToastService);
  protected readonly authService = inject(AuthService);

  protected readonly detail = signal<Detail | null>(null);
  protected readonly loading = signal(true);
  protected readonly errorCode = signal<number | null>(null);
  protected readonly busy = signal(false);

  protected readonly side = signal<Side>('Income');
  protected readonly filter = signal<LineFilter>('all');
  protected readonly query = signal('');

  protected readonly dmy = dmy;
  protected readonly lineTone = LINE_STATUS_TONE;
  protected readonly statusTone = RECONCILIATION_STATUS_TONE;

  /** Conciliación de solo ingresos o solo egresos: se muestra esa parte, sin pestañas ni cuadre de saldos. */
  protected readonly singleScope = computed(() => this.detail()?.scope !== 'All');
  protected readonly exporting = signal(false);

  protected readonly editable = computed(() => this.authService.canWrite() && this.detail()?.status === 'Open');
  protected readonly summary = computed(() => {
    const d = this.detail();
    return d ? (this.side() === 'Income' ? d.income : d.expense) : null;
  });
  protected readonly periodLabel = computed(() => {
    const d = this.detail();
    return d ? `${this.t(monthKey(d.periodStart))} ${d.periodStart.slice(0, 4)}` : '';
  });
  protected readonly toReviewTotal = computed(() => {
    const d = this.detail();
    return d ? d.income.toReviewCount + d.expense.toReviewCount : 0;
  });
  protected readonly balanced = computed(() => Math.abs(this.detail()?.unexplainedDifference ?? 1) < 0.005);

  private readonly sideLines = computed(() => this.detail()?.lines.filter((l) => l.side === this.side()) ?? []);

  protected readonly filters = computed(() => {
    const lines = this.sideLines();
    const count = (f: LineFilter) => lines.filter((l) => this.matches(l, f)).length;
    return (['all', 'Suggested', 'MissingInLedger', 'MissingInBank', 'matched'] as LineFilter[]).map((key) => ({ key, count: count(key) }));
  });

  protected readonly visibleLines = computed(() => {
    const q = normalize(this.query().trim());
    return this.sideLines().filter(
      (l) =>
        this.matches(l, this.filter()) &&
        (!q ||
          normalize(
            [l.bank?.name, l.bank?.description, l.bank?.bankCode, l.bank?.amount, l.ledger?.description, l.ledger?.batch, l.ledger?.amount, l.bank?.note, l.ledger?.note]
              .filter((v) => v !== null && v !== undefined)
              .join(' ')
          ).includes(q))
    );
  });

  constructor() {
    queueMicrotask(() => void this.load());
  }

  protected async load(): Promise<void> {
    this.errorCode.set(null);
    try {
      const detail = await this.reconciliationService.get(Number(this.id()));
      if (detail.scope !== 'All' && !this.detail()) {
        this.side.set(detail.scope);
      }
      this.detail.set(detail);
    } catch (error) {
      this.errorCode.set(apiErrorCode(error));
    } finally {
      this.loading.set(false);
    }
  }

  protected readonly hasFilters = computed(() => this.filter() !== 'all' || this.query().trim() !== '');

  protected clearFilters(): void {
    this.filter.set('all');
    this.query.set('');
  }

  protected setSide(side: Side): void {
    this.side.set(side);
    this.filter.set('all');
  }

  protected isMatched(line: ReconciliationLine): boolean {
    return MATCHED_STATUSES.includes(line.status);
  }

  protected isMissing(line: ReconciliationLine): boolean {
    return line.status === 'MissingInLedger' || line.status === 'MissingInBank';
  }

  protected statusLabel(status: LineStatus): string {
    return this.t(`reconciliation.lineStatus.${status}`);
  }

  // --- Acciones -----------------------------------------------------------------------------

  protected confirm(line: ReconciliationLine): void {
    void this.act(() => this.reconciliationService.confirm(this.reconciliationId(), line.matchId!), 'reconciliation.confirmed');
  }

  protected unmatch(line: ReconciliationLine): void {
    void this.act(() => this.reconciliationService.unmatch(this.reconciliationId(), line.matchId!), 'reconciliation.unmatched');
  }

  protected confirmAll(): void {
    this.ask('reconciliation.confirmAllTitle', this.t('reconciliation.confirmAllMessage', { count: this.toReviewTotal() }), 'reconciliation.actions.confirmAll', () =>
      this.act(() => this.reconciliationService.confirmAll(this.reconciliationId()), 'reconciliation.confirmed')
    );
  }

  protected rematch(): void {
    this.ask('reconciliation.rematchTitle', this.t('reconciliation.rematchMessage'), 'reconciliation.actions.rematch', () =>
      this.act(() => this.reconciliationService.rematch(this.reconciliationId()), 'reconciliation.rematched')
    );
  }

  protected close(): void {
    this.ask('reconciliation.closeTitle', this.t('reconciliation.closeMessage'), 'reconciliation.actions.close', () =>
      this.act(() => this.reconciliationService.close(this.reconciliationId()), 'reconciliation.closed')
    );
  }

  protected reopen(): void {
    void this.act(() => this.reconciliationService.reopen(this.reconciliationId()), 'reconciliation.reopened');
  }

  protected openMatch(line: ReconciliationLine): void {
    const wanted: LineStatus = line.bank ? 'MissingInBank' : 'MissingInLedger';
    const candidates = this.detail()!.lines.filter((l) => l.side === line.side && l.status === wanted);
    this.dialogService
      .open<boolean, MatchDialogData>(MatchDialog, { data: { reconciliationId: this.reconciliationId(), line, candidates } })
      .closed.subscribe((saved) => saved && void this.load());
  }

  protected openNote(line: ReconciliationLine): void {
    const id = this.reconciliationId();
    const bank = line.bank;
    const ledger = line.ledger;
    const subject = bank
      ? `${dmy(bank.date)} · ${bank.name ?? bank.description ?? ''} · ${bank.amount}`
      : `${ledger!.description} · ${ledger!.amount}`;
    this.dialogService
      .open<boolean, NoteDialogData>(NoteDialog, {
        data: {
          title: this.t('reconciliation.note'),
          subject,
          note: bank ? bank.note : ledger!.note,
          maxLength: 500,
          save: (note) => (bank ? this.reconciliationService.bankNote(id, bank.bankMovementId, note) : this.reconciliationService.ledgerNote(id, ledger!.ledgerEntryId, note)),
        },
      })
      .closed.subscribe((saved) => saved && void this.load());
  }

  protected openNotes(): void {
    const id = this.reconciliationId();
    this.dialogService
      .open<boolean, NoteDialogData>(NoteDialog, {
        data: { title: this.t('reconciliation.notes'), subject: '', note: this.detail()!.notes, maxLength: 1000, save: (note) => this.reconciliationService.notes(id, note) },
      })
      .closed.subscribe((saved) => saved && void this.load());
  }

  protected async export(): Promise<void> {
    const d = this.detail();
    if (!d) return;
    try {
      const blob = await this.reconciliationService.export(d.reconciliationId);
      saveBlob(blob, `Conciliación ${d.bankAccount.department ? d.bankAccount.department + ' ' : ''}${d.bankAccount.name} ${d.periodStart.slice(0, 7)}.xlsx`);
    } catch (error) {
      this.toastService.show(this.t('reconciliation.exportError'), apiErrorMessage(error) ?? undefined);
    }
  }

  /** Descarga solo lo que se ve: la parte (ingresos o egresos) y el filtro de estado elegidos. */
  protected async exportView(): Promise<void> {
    const d = this.detail();
    if (!d || this.exporting()) return;
    this.exporting.set(true);
    try {
      const status = this.filter() === 'all' ? null : this.filter();
      const blob = await this.reconciliationService.export(d.reconciliationId, this.side(), status);
      const parts = [this.t(`reconciliation.side.${this.side()}`), status ? this.t(`reconciliation.filter.${status}`) : null].filter(Boolean).join(' - ');
      saveBlob(blob, `Conciliación ${d.bankAccount.department ? d.bankAccount.department + ' ' : ''}${d.bankAccount.name} ${d.periodStart.slice(0, 7)} ${parts}.xlsx`);
    } catch (error) {
      this.toastService.show(this.t('reconciliation.exportError'), apiErrorMessage(error) ?? undefined);
    } finally {
      this.exporting.set(false);
    }
  }

  // ------------------------------------------------------------------------------------------

  private matches(line: ReconciliationLine, filter: LineFilter): boolean {
    switch (filter) {
      case 'all':
        return true;
      case 'matched':
        return this.isMatched(line);
      default:
        return line.status === filter;
    }
  }

  private reconciliationId(): number {
    return this.detail()!.reconciliationId;
  }

  private ask(titleKey: string, message: string, confirmKey: string, then: () => unknown): void {
    this.dialogService
      .open<boolean, ConfirmDialogData>(ConfirmDialog, { data: { title: this.t(titleKey), message, confirmLabel: this.t(confirmKey) } })
      .closed.subscribe((ok) => ok && then());
  }

  /** Ejecuta una acción y recarga; si el backend la rechaza, muestra su mensaje. */
  private async act(action: () => Promise<unknown>, successKey: string): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      await action();
      this.toastService.show(this.t(successKey));
      await this.load();
    } catch (error) {
      this.toastService.show(this.t('common.saveError'), apiErrorMessage(error) ?? undefined);
    } finally {
      this.busy.set(false);
    }
  }

  protected t(key: string, params?: Record<string, string | number>): string {
    return this.languageService.t(key, params);
  }
}
