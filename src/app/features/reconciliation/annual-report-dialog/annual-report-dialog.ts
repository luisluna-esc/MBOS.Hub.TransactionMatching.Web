import { DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { apiErrorMessage } from '../../../core/http/api-error';
import { saveBlob } from '../../../core/http/save-blob';
import { LanguageService } from '../../../core/i18n/language.service';
import { ToastService } from '../../../core/toast/toast.service';
import { Dialog } from '../../../shared/components/dialog/dialog';
import { Select, SelectOption } from '../../../shared/components/select/select';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { BankAccount } from '../reconciliation.models';
import { BankAccountService, ReconciliationService } from '../reconciliation.services';

// Reporte anual por meses: los depósitos no identificados (en el banco, sin registro en ASSINET) y
// los registrados sin depósito, de todas las cuentas o de una. Se descarga en Excel.
@Component({
  selector: 'app-annual-report-dialog',
  imports: [FormsModule, Dialog, Select, TranslatePipe],
  template: `
    <app-dialog
      [title]="'reconciliation.annual.title' | translate"
      [saveLabel]="(downloading() ? 'reports.downloading' : 'reconciliation.annual.download') | translate"
      [saveDisabled]="!year() || downloading()"
      (save)="download()"
      (cancel)="dialogRef.close()"
    >
      <div class="flex flex-col gap-4">
        <p class="text-sm text-muted-foreground">{{ 'reconciliation.annual.description' | translate }}</p>
        <app-select [label]="'reconciliation.list.year' | translate" [options]="years" [ngModel]="year()" (ngModelChange)="year.set($event)" />
        <app-select
          [label]="'reconciliation.columns.account' | translate"
          [placeholder]="'reconciliation.annual.allAccounts' | translate"
          [options]="accountOptions()"
          [ngModel]="account()"
          (ngModelChange)="account.set($event)"
        />
        @if (account()) {
          <button type="button" class="self-start text-xs text-muted-foreground underline hover:text-foreground" (click)="account.set(null)">
            {{ 'reconciliation.annual.allAccounts' | translate }}
          </button>
        }
      </div>
    </app-dialog>
  `,
})
export class AnnualReportDialog {
  protected readonly dialogRef = inject(DialogRef<void, AnnualReportDialog>);
  private readonly reconciliationService = inject(ReconciliationService);
  private readonly bankAccountService = inject(BankAccountService);
  private readonly languageService = inject(LanguageService);
  private readonly toastService = inject(ToastService);

  private readonly currentYear = new Date().getFullYear();
  protected readonly years: SelectOption[] = [0, 1, 2, 3].map((i) => ({ value: String(this.currentYear - i), label: String(this.currentYear - i) }));
  protected readonly year = signal<string | null>(String(this.currentYear));
  protected readonly account = signal<string | null>(null);
  protected readonly downloading = signal(false);

  private readonly accounts = signal<BankAccount[]>([]);
  protected readonly accountOptions = computed<SelectOption[]>(() =>
    this.accounts().map((a) => ({ value: String(a.bankAccountId), label: a.department ? `${a.department} · ${a.name}` : a.name }))
  );

  constructor() {
    this.bankAccountService.all().then((all) => this.accounts.set(all.filter((a) => a.isActive))).catch(() => this.accounts.set([]));
  }

  protected async download(): Promise<void> {
    const year = Number(this.year());
    if (!year || this.downloading()) return;
    this.downloading.set(true);
    try {
      const accountId = this.account() ? Number(this.account()) : null;
      const blob = await this.reconciliationService.annualReport(year, accountId);
      const account = this.accounts().find((a) => a.bankAccountId === accountId);
      saveBlob(blob, `Reporte anual ${year}${account ? ' ' + (account.department ?? account.name) : ''}.xlsx`);
      this.dialogRef.close();
    } catch (error) {
      this.toastService.show(this.languageService.t('reconciliation.exportError'), apiErrorMessage(error) ?? undefined);
    } finally {
      this.downloading.set(false);
    }
  }
}
