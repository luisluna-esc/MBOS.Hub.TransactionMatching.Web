import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Dialog } from '../../../shared/components/dialog/dialog';
import { Textarea } from '../../../shared/components/textarea/textarea';
import { FormDialog } from '../../../shared/list-page/form-dialog';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

export interface NoteDialogData {
  title: string;
  /** Qué se está anotando (la fila del banco o de ASSINET), para que se vea en el diálogo. */
  subject: string;
  note: string | null;
  maxLength: number;
  save: (note: string | null) => Promise<unknown>;
}

// Observación de una fila o de toda la conciliación (ej. "registrar en ASSINET", "depósito de noviembre").
@Component({
  selector: 'app-note-dialog',
  imports: [ReactiveFormsModule, Dialog, Textarea, TranslatePipe],
  template: `
    <app-dialog
      [title]="data.title"
      [saveDisabled]="saveDisabled()"
      [extraLabel]="data.note ? ('reconciliation.deleteNote' | translate) : null"
      [extraDisabled]="saving()"
      (extra)="remove()"
      (save)="save()"
      (cancel)="dialogRef.close(false)"
    >
      <div class="flex flex-col gap-3">
        @if (data.subject) {
          <p class="rounded-md border border-border bg-surface p-3 text-sm text-foreground">{{ data.subject }}</p>
        }
        <app-textarea [formControl]="note" [rows]="4" [maxLength]="data.maxLength" />
      </div>
    </app-dialog>
  `,
})
export class NoteDialog extends FormDialog {
  protected readonly data = inject<NoteDialogData>(DIALOG_DATA);
  protected readonly dialogRef = inject(DialogRef<boolean, NoteDialog>);
  protected readonly note = new FormControl(this.data.note ?? '');

  constructor() {
    super();
    this.watch(this.note);
  }

  /** Borra la observación guardada (la guarda vacía) y cierra. */
  protected remove(): Promise<void> {
    return this.submit(() => this.data.save(null), 'reconciliation.noteDeleted');
  }

  protected save(): Promise<void> {
    return this.submit(() => this.data.save(this.text(this.note.value)));
  }
}
