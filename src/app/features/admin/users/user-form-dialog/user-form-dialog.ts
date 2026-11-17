import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { USERNAME_PATTERN, usernameFromFullName } from '../../../../core/auth/username';
import { Checkbox } from '../../../../shared/components/checkbox/checkbox';
import { Dialog } from '../../../../shared/components/dialog/dialog';
import { Input as AppInput } from '../../../../shared/components/input/input';
import { FormDialog } from '../../../../shared/list-page/form-dialog';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { AppUser } from '../../admin.models';
import { AppUserService } from '../../admin.services';

export interface UserFormDialogData {
  user: AppUser | null;
}

// Se entra con el usuario nombre.apellido: al crear se arma solo con el nombre completo (se puede
// corregir). La contraseña la pone M-BOS; al editar es opcional y, si se llena, también desbloquea
// la cuenta. No hay "olvidé mi contraseña" ni contraseña temporal.
@Component({
  selector: 'app-user-form-dialog',
  imports: [ReactiveFormsModule, Checkbox, Dialog, AppInput, TranslatePipe],
  template: `
    <app-dialog
      [title]="(user ? 'admin.users.editTitle' : 'admin.users.newTitle') | translate"
      [saveDisabled]="saveDisabled()"
      (save)="save()"
      (cancel)="dialogRef.close(false)"
    >
      <form [formGroup]="form" class="flex flex-col gap-4">
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <app-input formControlName="fullName" [label]="'catalogs.columns.fullName' | translate" [required]="true" [maxLength]="150" />
          <app-input
            formControlName="username"
            [label]="'admin.users.username' | translate"
            [required]="true"
            [maxLength]="100"
            [patternRule]="usernamePattern"
            [errorMessages]="{ pattern: ('admin.users.usernameInvalid' | translate) }"
            [hint]="'admin.users.usernameHint' | translate"
          />
          <app-input formControlName="ci" [label]="'catalogs.columns.ci' | translate" [maxLength]="20" />
          <app-input formControlName="phone" type="tel" [label]="'catalogs.columns.phone' | translate" [maxLength]="30" />
        </div>
        <app-input
          formControlName="password"
          type="password"
          [label]="(user ? 'admin.users.newPassword' : 'admin.users.password') | translate"
          [required]="!user"
          [minLength]="8"
          [maxLength]="100"
          [hint]="(user ? 'admin.users.newPasswordHint' : 'admin.users.passwordHint') | translate"
        />
        <app-checkbox formControlName="isActive">{{ 'catalogs.active' | translate }}</app-checkbox>
      </form>
    </app-dialog>
  `,
})
export class UserFormDialog extends FormDialog {
  protected readonly user = inject<UserFormDialogData>(DIALOG_DATA).user;
  protected readonly dialogRef = inject(DialogRef<boolean, UserFormDialog>);
  private readonly appUserService = inject(AppUserService);

  protected readonly usernamePattern = USERNAME_PATTERN;

  protected readonly form = new FormGroup({
    fullName: new FormControl(this.user?.fullName ?? '', { nonNullable: true, validators: Validators.required }),
    username: new FormControl(this.user?.username ?? '', { nonNullable: true, validators: Validators.required }),
    ci: new FormControl(this.user?.ci ?? ''),
    phone: new FormControl(this.user?.phone ?? ''),
    password: new FormControl('', {
      nonNullable: true,
      validators: this.user ? [Validators.minLength(8), Validators.maxLength(100)] : [Validators.required, Validators.minLength(8), Validators.maxLength(100)],
    }),
    isActive: new FormControl(this.user?.isActive ?? true, { nonNullable: true }),
  });

  /** Al crear, el usuario sigue al nombre completo hasta que alguien lo escribe a mano. */
  private usernameEdited = !!this.user;

  constructor() {
    super();
    this.watch(this.form);

    const { fullName, username } = this.form.controls;
    fullName.valueChanges.subscribe((name) => {
      if (!this.usernameEdited) {
        username.setValue(usernameFromFullName(name), { emitEvent: false });
        username.updateValueAndValidity();
      }
    });
    username.valueChanges.subscribe(() => (this.usernameEdited = true));
  }

  protected save(): Promise<void> {
    const raw = this.form.getRawValue();
    const user: AppUser = {
      appUserId: this.user?.appUserId ?? 0,
      fullName: raw.fullName.trim(),
      username: raw.username.trim().toLowerCase(),
      ci: this.text(raw.ci),
      phone: this.text(raw.phone),
      password: raw.password || null,
      isActive: raw.isActive,
      failedLoginAttempts: this.user?.failedLoginAttempts ?? 0,
      lockedUntil: this.user?.lockedUntil ?? null,
      lastLogin: this.user?.lastLogin ?? null,
    };
    return this.submit(() => (this.user ? this.appUserService.update(user) : this.appUserService.create(user)));
  }
}
