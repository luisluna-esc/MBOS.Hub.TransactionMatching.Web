import { Injectable, inject } from '@angular/core';
import { QueryParams, WriteResponse } from '../../core/http/api.models';
import { ApiService } from '../../core/http/api.service';
import { BankAccount, ReconciliationDetail, ReconciliationListItem, ReconciliationScope, Side } from './reconciliation.models';

// Leer y descargar lo pueden todos; subir, cotejar, cerrar y eliminar, M-BOS y Contabilidad
// ([Authorize(Roles = RoleNames.Writers)] en ReconciliationsController).
@Injectable({ providedIn: 'root' })
export class ReconciliationService {
  private readonly api = inject(ApiService);

  list = (pageNumber: number, pageSize: number, filters: QueryParams) =>
    this.api.list<ReconciliationListItem>('/reconciliations', pageNumber, pageSize, filters);
  get = (id: number) => this.api.get<ReconciliationDetail>(`/reconciliations/${id}`);
  delete = (id: number) => this.api.delete(`/reconciliations/${id}`);

  /** Sube el extracto del banco y el Mayor de ASSINET; el backend guarda solo la parte elegida y coteja. */
  create(bankFile: File, ledgerFile: File, scope: ReconciliationScope): Promise<WriteResponse> {
    const form = new FormData();
    form.append('bankFile', bankFile);
    form.append('ledgerFile', ledgerFile);
    form.append('scope', scope);
    return this.api.postRaw<WriteResponse>('/reconciliations', form);
  }

  rematch = (id: number) => this.api.post(`/reconciliations/${id}/rematch`);
  match = (id: number, bankMovementId: number, ledgerEntryId: number, note: string | null) =>
    this.api.post(`/reconciliations/${id}/matches`, { bankMovementId, ledgerEntryId, note });
  confirm = (id: number, matchId: number) => this.api.post(`/reconciliations/${id}/matches/${matchId}/confirm`);
  confirmAll = (id: number) => this.api.post(`/reconciliations/${id}/matches/confirm-all`);
  unmatch = (id: number, matchId: number) => this.api.delete(`/reconciliations/${id}/matches/${matchId}`);
  bankNote = (id: number, movementId: number, note: string | null) =>
    this.api.put(`/reconciliations/${id}/bank-movements/${movementId}/note`, { note });
  ledgerNote = (id: number, entryId: number, note: string | null) =>
    this.api.put(`/reconciliations/${id}/ledger-entries/${entryId}/note`, { note });
  notes = (id: number, note: string | null) => this.api.put(`/reconciliations/${id}/notes`, { note });
  close = (id: number) => this.api.post(`/reconciliations/${id}/close`);
  reopen = (id: number) => this.api.post(`/reconciliations/${id}/reopen`);
  /** Todo el Excel; con side y/o status, solo esas líneas ("exportar lo que veo"). */
  export = (id: number, side?: Side | null, status?: string | null, voucher?: string | null) =>
    this.api.download(`/reconciliations/${id}/export`, { side, status, voucher });
  /** Reporte anual por meses; sin cuenta, todas. */
  annualReport = (year: number, bankAccountId?: number | null) =>
    this.api.download('/reconciliations/annual-report', { year, bankAccountId });
}

@Injectable({ providedIn: 'root' })
export class BankAccountService {
  private readonly api = inject(ApiService);

  list = (pageNumber: number, pageSize: number, filters: QueryParams) => this.api.list<BankAccount>('/bankaccounts', pageNumber, pageSize, filters);
  all = () => this.api.all<BankAccount>('/bankaccounts');
  update = (account: BankAccount) => this.api.put(`/bankaccounts/${account.bankAccountId}`, account);
}
