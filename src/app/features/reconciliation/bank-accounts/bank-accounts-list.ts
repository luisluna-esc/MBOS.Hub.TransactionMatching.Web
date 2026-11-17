import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DialogService } from '../../../core/dialog/dialog.service';
import { QueryParams } from '../../../core/http/api.models';
import { Checkbox } from '../../../shared/components/checkbox/checkbox';
import { Dialog } from '../../../shared/components/dialog/dialog';
import { ErrorState } from '../../../shared/components/error-state/error-state';
import { FilterField, Filters, FilterValues } from '../../../shared/components/filters/filters';
import { Input as AppInput } from '../../../shared/components/input/input';
import { Table, TableAction, TableColumn } from '../../../shared/components/table/table';
import { FormDialog } from '../../../shared/list-page/form-dialog';
import { HeaderButton, ListPage, TableRow } from '../../../shared/list-page/list-page';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { BankAccount } from '../reconciliation.models';
import { BankAccountService } from '../reconciliation.services';

type Row = TableRow<BankAccount>;

// Las cuentas se crean solas al subir el primer extracto de cada una; aquí solo se les pone un
// nombre legible ("BMSC 5642") o se desactivan. El número de cuenta no se cambia.
@Component({
  selector: 'app-bank-accounts-list',
  imports: [ErrorState, Filters, Table, TranslatePipe],
  templateUrl: '../../../shared/list-page/list-page.html',
})
export class BankAccountsList extends ListPage<BankAccount> {
  private readonly bankAccountService = inject(BankAccountService);
  private readonly dialogService = inject(DialogService);

  protected readonly titleKey = 'nav.bankAccounts';
  protected override readonly subtitleKey = 'reconciliation.accounts.subtitle';

  protected fetchPage(pageNumber: number, pageSize: number, filters: QueryParams) {
    return this.bankAccountService.list(pageNumber, pageSize, filters);
  }

  protected toQuery(values: FilterValues): QueryParams {
    return { searchCriteria: values['search'], isActive: this.bool(values['status']) };
  }

  protected readonly headerButtons = computed<HeaderButton[]>(() => []);

  protected readonly filterFields = computed<FilterField[]>(() => [
    { key: 'search', label: this.t('reconciliation.list.searchAccount'), type: 'text' },
    {
      key: 'status',
      label: this.t('catalogs.filters.status'),
      type: 'select',
      options: [
        { value: 'true', label: this.t('catalogs.active') },
        { value: 'false', label: this.t('catalogs.inactive') },
      ],
    },
  ]);

  protected readonly columns = computed<TableColumn<Row>[]>(() => [
    { key: 'department', header: this.t('reconciliation.columns.department'), format: (v) => (v as string) ?? '' },
    { key: 'name', header: this.t('catalogs.columns.name') },
    { key: 'bank', header: this.t('reconciliation.accounts.bank') },
    { key: 'accountNumber', header: this.t('reconciliation.accounts.number') },
    { key: 'ledgerSubaccount', header: this.t('reconciliation.accounts.subaccount'), format: (v) => (v as string) ?? '' },
    { key: 'isActive', header: this.t('catalogs.columns.status'), align: 'center', format: (v) => this.t(v ? 'catalogs.active' : 'catalogs.inactive') },
  ]);

  protected readonly actions = computed<TableAction<Row>[]>(() =>
    this.authService.canWrite()
      ? [
          {
            label: this.t('catalogs.actions.edit'),
            icon: 'edit',
            onClick: (row) =>
              this.dialogService.open<boolean, BankAccountDialogData>(BankAccountDialog, { data: { account: row } }).closed.subscribe(this.reloadIfSaved),
          },
        ]
      : []
  );
}

export interface BankAccountDialogData {
  account: BankAccount;
}

@Component({
  selector: 'app-bank-account-dialog',
  imports: [ReactiveFormsModule, Checkbox, Dialog, AppInput, TranslatePipe],
  template: `
    <app-dialog [title]="'reconciliation.accounts.editTitle' | translate" [saveDisabled]="saveDisabled()" (save)="save()" (cancel)="dialogRef.close(false)">
      <form [formGroup]="form" class="flex flex-col gap-4">
        <p class="text-sm text-muted-foreground">{{ account.bank }} · {{ account.accountNumber }}</p>
        <app-input formControlName="department" [label]="'reconciliation.columns.department' | translate" [maxLength]="100" />
        <app-input formControlName="name" [label]="'catalogs.columns.name' | translate" [required]="true" [maxLength]="100" />
        <app-checkbox formControlName="isActive">{{ 'catalogs.active' | translate }}</app-checkbox>
      </form>
    </app-dialog>
  `,
})
export class BankAccountDialog extends FormDialog {
  protected readonly account = inject<BankAccountDialogData>(DIALOG_DATA).account;
  protected readonly dialogRef = inject(DialogRef<boolean, BankAccountDialog>);
  private readonly bankAccountService = inject(BankAccountService);

  protected readonly form = new FormGroup({
    department: new FormControl(this.account.department ?? '', { nonNullable: true }),
    name: new FormControl(this.account.name, { nonNullable: true, validators: Validators.required }),
    isActive: new FormControl(this.account.isActive, { nonNullable: true }),
  });

  constructor() {
    super();
    this.watch(this.form);
  }

  protected save(): Promise<void> {
    const raw = this.form.getRawValue();
    return this.submit(() => this.bankAccountService.update({ ...this.account, department: this.text(raw.department), name: raw.name.trim(), isActive: raw.isActive }));
  }
}
