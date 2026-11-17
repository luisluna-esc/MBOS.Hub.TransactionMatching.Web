import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { DialogService } from '../../../core/dialog/dialog.service';
import { apiErrorMessage } from '../../../core/http/api-error';
import { QueryParams } from '../../../core/http/api.models';
import { saveBlob } from '../../../core/http/save-blob';
import { ConfirmDialog, ConfirmDialogData } from '../../../shared/components/confirm-dialog/confirm-dialog';
import { ErrorState } from '../../../shared/components/error-state/error-state';
import { FilterField, Filters, FilterValues } from '../../../shared/components/filters/filters';
import { Table, TableAction, TableColumn } from '../../../shared/components/table/table';
import { HeaderButton, ListPage, TableRow } from '../../../shared/list-page/list-page';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { AnnualReportDialog } from '../annual-report-dialog/annual-report-dialog';
import { dmy, monthKey } from '../reconciliation-format';
import { ReconciliationListItem } from '../reconciliation.models';
import { ReconciliationService } from '../reconciliation.services';

type Row = TableRow<ReconciliationListItem>;

// Historial: una fila por cuenta y mes, con cuánto quedó cotejado y cuánto falta en cada lado.
@Component({
  selector: 'app-reconciliations-list',
  imports: [ErrorState, Filters, Table, TranslatePipe],
  templateUrl: '../../../shared/list-page/list-page.html',
})
export class ReconciliationsList extends ListPage<ReconciliationListItem> {
  private readonly reconciliationService = inject(ReconciliationService);
  private readonly dialogService = inject(DialogService);
  private readonly router = inject(Router);

  protected readonly titleKey = 'nav.reconciliations';
  protected override readonly subtitleKey = 'reconciliation.list.subtitle';

  protected fetchPage(pageNumber: number, pageSize: number, filters: QueryParams) {
    return this.reconciliationService.list(pageNumber, pageSize, filters);
  }

  protected toQuery(values: FilterValues): QueryParams {
    return { searchCriteria: values['search'], status: values['status'], year: values['year'], scope: values['scope'] };
  }

  protected readonly headerButtons = computed<HeaderButton[]>(() => [
    { labelKey: 'reconciliation.annual.button', onClick: () => this.dialogService.open(AnnualReportDialog) },
    ...(this.authService.canWrite()
      ? [{ labelKey: 'nav.newReconciliation', primary: true, onClick: () => void this.router.navigateByUrl('/reconciliations/new') }]
      : []),
  ]);

  protected readonly filterFields = computed<FilterField[]>(() => {
    const year = new Date().getFullYear();
    return [
      { key: 'search', label: this.t('reconciliation.list.searchAccount'), type: 'text' },
      {
        key: 'year',
        label: this.t('reconciliation.list.year'),
        type: 'select',
        options: [year, year - 1, year - 2].map((y) => ({ value: String(y), label: String(y) })),
      },
      {
        key: 'scope',
        label: this.t('reconciliation.columns.scope'),
        type: 'select',
        options: (['Income', 'Expense', 'All'] as const).map((s) => ({ value: s, label: this.t(`reconciliation.scope.${s}`) })),
      },
      {
        key: 'status',
        label: this.t('catalogs.filters.status'),
        type: 'select',
        options: [
          { value: 'Open', label: this.t('reconciliation.status.Open') },
          { value: 'Closed', label: this.t('reconciliation.status.Closed') },
        ],
      },
    ];
  });

  protected readonly columns = computed<TableColumn<Row>[]>(() => [
    { key: 'department', header: this.t('reconciliation.columns.department'), format: (v) => (v as string) ?? '' },
    { key: 'bankAccountName', header: this.t('reconciliation.columns.account'), format: (v, row) => `${v} · ${row.accountNumber}` },
    {
      key: 'periodStart',
      header: this.t('reconciliation.columns.period'),
      format: (v, row) => `${this.t(monthKey(v as string))} ${(v as string).slice(0, 4)}`,
      tooltip: (_, row) => `${dmy(row.periodStart)} – ${dmy(row.periodEnd)}`,
    },
    { key: 'scope', header: this.t('reconciliation.columns.scope'), format: (v) => this.t(`reconciliation.scope.${v}`) },
    { key: 'matchedCount', header: this.t('reconciliation.columns.matched'), align: 'center' },
    { key: 'toReviewCount', header: this.t('reconciliation.columns.toReview'), align: 'center' },
    { key: 'missingInLedgerCount', header: this.t('reconciliation.columns.missingInLedger'), align: 'center' },
    { key: 'missingInBankCount', header: this.t('reconciliation.columns.missingInBank'), align: 'center' },
    { key: 'status', header: this.t('catalogs.columns.status'), align: 'center', format: (v) => this.t(`reconciliation.status.${v}`) },
    { key: 'createdByName', header: this.t('reconciliation.columns.createdBy'), format: (v) => (v as string) ?? '' },
  ]);

  protected readonly actions = computed<TableAction<Row>[]>(() => [
    { label: this.t('reconciliation.actions.open'), icon: 'view', onClick: (row) => void this.router.navigate(['/reconciliations', row.reconciliationId]) },
    { label: this.t('reconciliation.actions.export'), icon: 'download', onClick: (row) => void this.export(row) },
    ...(this.authService.canWrite()
      ? [
          {
            label: this.t('catalogs.actions.delete'),
            icon: 'delete' as const,
            variant: 'danger' as const,
            disabled: (row: Row) => row.status === 'Closed',
            disabledReason: () => this.t('reconciliation.closedHint'),
            onClick: (row: Row) => this.confirmDelete(row),
          },
        ]
      : []),
  ]);

  private async export(row: ReconciliationListItem): Promise<void> {
    try {
      const blob = await this.reconciliationService.export(row.reconciliationId);
      saveBlob(blob, `Conciliación ${row.department ? row.department + ' ' : ''}${row.bankAccountName} ${row.periodStart.slice(0, 7)}.xlsx`);
    } catch (error) {
      this.toastService.show(this.t('reconciliation.exportError'), apiErrorMessage(error) ?? undefined);
    }
  }

  private confirmDelete(row: ReconciliationListItem): void {
    const period = `${this.t(monthKey(row.periodStart))} ${row.periodStart.slice(0, 4)}`;
    const ref = this.dialogService.open<boolean, ConfirmDialogData>(ConfirmDialog, {
      data: {
        title: this.t('reconciliation.deleteTitle'),
        message: this.t('reconciliation.deleteMessage', { account: [row.department, row.bankAccountName].filter(Boolean).join(' · '), period }),
        confirmLabel: this.t('catalogs.actions.delete'),
      },
    });
    ref.closed.subscribe((confirmed) => confirmed && void this.run(() => this.reconciliationService.delete(row.reconciliationId), 'common.deleted'));
  }
}
