import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { apiErrorMessage } from '../../../core/http/api-error';
import { LanguageService } from '../../../core/i18n/language.service';
import { ToastService } from '../../../core/toast/toast.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { ReconciliationScope } from '../reconciliation.models';
import { ReconciliationService } from '../reconciliation.services';

type FileKind = 'bank' | 'ledger';

// Se suben los dos archivos tal como se descargan (el extracto del banco y el Mayor de ASSINET,
// sin convertir nada); el backend revisa que sean de la misma cuenta, coteja y se abre el resultado.
@Component({
  selector: 'app-new-reconciliation',
  imports: [TranslatePipe],
  templateUrl: './new-reconciliation.html',
})
export class NewReconciliation {
  private readonly reconciliationService = inject(ReconciliationService);
  private readonly languageService = inject(LanguageService);
  private readonly toastService = inject(ToastService);
  private readonly router = inject(Router);
  protected readonly authService = inject(AuthService);

  protected readonly files = { bank: signal<File | null>(null), ledger: signal<File | null>(null) };
  protected readonly dragging = signal<FileKind | null>(null);
  protected readonly uploading = signal(false);
  protected readonly kinds: FileKind[] = ['bank', 'ledger'];

  /** Ingresos y egresos los revisan personas distintas: cada una elige su parte. */
  protected readonly scopes: ReconciliationScope[] = ['Income', 'Expense', 'All'];
  protected readonly scope = signal<ReconciliationScope | null>(null);

  protected pick(kind: FileKind, event: Event): void {
    const input = event.target as HTMLInputElement;
    this.files[kind].set(input.files?.[0] ?? null);
    input.value = '';
  }

  protected drop(kind: FileKind, event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(null);
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      this.files[kind].set(file);
    }
  }

  /** Quita un archivo elegido (la ✕ está dentro del recuadro: no tiene que abrir el selector). */
  protected remove(kind: FileKind, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.files[kind].set(null);
  }

  protected clear(): void {
    this.files.bank.set(null);
    this.files.ledger.set(null);
    this.scope.set(null);
  }

  protected cancel(): void {
    void this.router.navigateByUrl('/reconciliations');
  }

  protected size(file: File): string {
    return `${Math.max(1, Math.round(file.size / 1024))} KB`;
  }

  protected async upload(): Promise<void> {
    const bank = this.files.bank();
    const ledger = this.files.ledger();
    const scope = this.scope();
    if (!bank || !ledger || !scope || this.uploading()) return;
    this.uploading.set(true);
    try {
      const response = await this.reconciliationService.create(bank, ledger, scope);
      this.toastService.show(this.languageService.t('reconciliation.new.done'));
      void this.router.navigate(['/reconciliations', response.id]);
    } catch (error) {
      this.toastService.show(this.languageService.t('reconciliation.new.error'), apiErrorMessage(error) ?? undefined, 12000);
    } finally {
      this.uploading.set(false);
    }
  }
}
