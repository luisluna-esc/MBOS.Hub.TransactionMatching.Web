import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Dialog } from '../../../shared/components/dialog/dialog';
import { Input as AppInput } from '../../../shared/components/input/input';
import { FormDialog } from '../../../shared/list-page/form-dialog';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { dmy, normalize } from '../reconciliation-format';
import { ReconciliationLine } from '../reconciliation.models';
import { ReconciliationService } from '../reconciliation.services';

export interface MatchDialogData {
  reconciliationId: number;
  /** La fila sin pareja desde la que se abrió (del banco o de ASSINET). */
  line: ReconciliationLine;
  /** Las filas sin pareja del otro lado, del mismo sentido (ingreso o egreso). */
  candidates: ReconciliationLine[];
}

interface Candidate {
  line: ReconciliationLine;
  date: string;
  text: string;
  detail: string;
  amount: number;
  amountGap: number;
  dayGap: number;
}

// Emparejar a mano: la fila elegida contra las sin pareja del otro lado, ordenadas por importe y
// fecha más cercanos (las parecidas arriba), con buscador y una observación opcional.
@Component({
  selector: 'app-match-dialog',
  imports: [FormsModule, Dialog, AppInput, MoneyPipe, TranslatePipe],
  template: `
    <app-dialog
      [title]="'reconciliation.match.title' | translate"
      [saveLabel]="'reconciliation.match.save' | translate"
      [saveDisabled]="!selected() || saving()"
      (save)="save()"
      (cancel)="dialogRef.close(false)"
    >
      <div class="flex flex-col gap-4">
        <div class="rounded-md border border-border bg-surface p-3 text-sm text-foreground">
          <span class="text-xs text-muted-foreground">{{ (fromBank ? 'reconciliation.bank' : 'reconciliation.ledger') | translate }}</span>
          <div class="flex flex-wrap items-baseline justify-between gap-2">
            <span class="font-medium">{{ source.date }} · {{ source.text }}</span>
            <span class="font-semibold tabular-nums">{{ source.amount | money }}</span>
          </div>
          @if (source.detail) {
            <span class="text-xs text-muted-foreground">{{ source.detail }}</span>
          }
        </div>

        <div class="flex items-end gap-2">
          <div class="flex-1">
            <app-input [label]="'reconciliation.match.search' | translate" [ngModel]="query()" (ngModelChange)="query.set($event)" />
          </div>
          <button
            type="button"
            class="mb-5 rounded-md border border-border px-4 py-2 text-sm text-foreground transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
            [disabled]="!query() && !selected()"
            (click)="query.set(''); selected.set(null)"
          >
            {{ 'filters.clear' | translate }}
          </button>
        </div>

        <div class="max-h-[45vh] overflow-y-auto rounded-md border border-border">
          @for (c of filtered(); track $index) {
            <button
              type="button"
              class="flex w-full items-center justify-between gap-3 border-b border-border px-3 py-2 text-left text-sm transition-colors last:border-b-0"
              [class]="selected() === c ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-surface'"
              (click)="selected.set(c)"
            >
              <span class="flex min-w-0 flex-col">
                <span class="truncate font-medium">{{ c.date }} · {{ c.text }}</span>
                @if (c.detail) {
                  <span class="truncate text-xs opacity-75">{{ c.detail }}</span>
                }
              </span>
              <span class="flex shrink-0 flex-col items-end">
                <span class="font-semibold tabular-nums">{{ c.amount | money }}</span>
                @if (c.amountGap !== 0) {
                  <span class="text-xs opacity-75">{{ 'reconciliation.match.gap' | translate: { gap: (c.amountGap | money: true) } }}</span>
                }
              </span>
            </button>
          } @empty {
            <p class="px-3 py-6 text-center text-sm text-muted-foreground">{{ 'reconciliation.match.empty' | translate }}</p>
          }
        </div>

        <app-input [label]="'reconciliation.note' | translate" [maxLength]="500" [ngModel]="note()" (ngModelChange)="note.set($event)" />
      </div>
    </app-dialog>
  `,
})
export class MatchDialog extends FormDialog {
  private readonly data = inject<MatchDialogData>(DIALOG_DATA);
  protected readonly dialogRef = inject(DialogRef<boolean, MatchDialog>);
  private readonly reconciliationService = inject(ReconciliationService);

  protected readonly fromBank = this.data.line.bank !== null;
  protected readonly source = this.describe(this.data.line);
  protected readonly query = signal('');
  protected readonly note = signal('');
  protected readonly selected = signal<Candidate | null>(null);

  private readonly candidates: Candidate[] = this.data.candidates
    .map((line) => {
      const c = this.describe(line);
      return {
        ...c,
        amountGap: Math.round((this.source.amount - c.amount) * 100) / 100,
        dayGap: Math.abs(Date.parse(this.source.iso) - Date.parse(c.iso)) / 86_400_000,
      };
    })
    .sort((a, b) => Math.abs(a.amountGap) - Math.abs(b.amountGap) || a.dayGap - b.dayGap);

  protected readonly filtered = computed(() => {
    const q = normalize(this.query().trim());
    if (!q) return this.candidates;
    return this.candidates.filter((c) => normalize(`${c.text} ${c.detail} ${c.amount} ${c.date}`).includes(q));
  });

  protected save(): Promise<void> {
    const target = this.selected();
    if (!target) return Promise.resolve();
    const bank = this.fromBank ? this.data.line.bank! : target.line.bank!;
    const ledger = this.fromBank ? target.line.ledger! : this.data.line.ledger!;
    return this.submit(
      () => this.reconciliationService.match(this.data.reconciliationId, bank.bankMovementId, ledger.ledgerEntryId, this.text(this.note())),
      'reconciliation.match.done'
    );
  }

  private describe(line: ReconciliationLine): Omit<Candidate, 'amountGap' | 'dayGap'> & { iso: string } {
    if (line.bank) {
      const b = line.bank;
      return { line, iso: b.date, date: dmy(b.date), text: b.name ?? b.description ?? '', detail: [b.bankCode, b.glosa].filter(Boolean).join(' · '), amount: b.amount };
    }
    const l = line.ledger!;
    const iso = l.movementDate ?? l.accountingDate;
    return { line, iso, date: dmy(iso), text: l.description, detail: l.batch ?? '', amount: l.amount };
  }
}
