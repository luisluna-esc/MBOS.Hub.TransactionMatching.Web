import { Routes } from '@angular/router';
import { authGuard, guestGuard, roleGuard } from './core/auth/auth.guard';
import { ROLES } from './core/auth/auth.models';

const placeholder = () => import('./features/placeholder/placeholder-page').then((m) => m.PlaceholderPage);

/** Opciones del menú que todavía muestran la pantalla provisional (se reemplazan una por una). */
const MENU_ROUTES: { path: string; titleKey: string; icon: string }[] = [];

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login/login').then((m) => m.Login),
  },
  {
    // Pantalla de prueba del sistema de estilos: muestra los colores de src/styles/theme.scss
    // en todos los componentes, en claro y en oscuro.
    path: 'style-guide',
    loadComponent: () => import('./features/style-guide/style-guide').then((m) => m.StyleGuide),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell/shell').then((m) => m.Shell),
    children: [
      {
        // Provisional hasta que exista el dashboard de TransactionMatching.
        path: '',
        pathMatch: 'full',
        loadComponent: placeholder,
        data: { titleKey: 'nav.home' },
      },
      {
        path: 'reconciliations/new',
        canActivate: [roleGuard(ROLES.admin, ROLES.accountant)],
        loadComponent: () => import('./features/reconciliation/new-reconciliation/new-reconciliation').then((m) => m.NewReconciliation),
      },
      {
        path: 'reconciliations',
        loadComponent: () => import('./features/reconciliation/reconciliations-list/reconciliations-list').then((m) => m.ReconciliationsList),
      },
      {
        path: 'reconciliations/:id',
        loadComponent: () => import('./features/reconciliation/reconciliation-detail/reconciliation-detail').then((m) => m.ReconciliationDetail),
      },
      {
        path: 'catalogs/bank-accounts',
        loadComponent: () => import('./features/reconciliation/bank-accounts/bank-accounts-list').then((m) => m.BankAccountsList),
      },
      {
        path: 'admin/users',
        canActivate: [roleGuard(ROLES.admin)],
        loadComponent: () => import('./features/admin/users/users-list/users-list').then((m) => m.UsersList),
      },
      {
        path: 'admin/roles',
        canActivate: [roleGuard(ROLES.admin)],
        loadComponent: () => import('./features/admin/roles/roles-list/roles-list').then((m) => m.RolesList),
      },
      {
        path: 'admin/audit-logs',
        canActivate: [roleGuard(ROLES.admin, ROLES.accountant)],
        loadComponent: () => import('./features/admin/audit-logs/audit-logs-list/audit-logs-list').then((m) => m.AuditLogsList),
      },
      ...MENU_ROUTES.map(({ path, titleKey, icon }) => ({
        path,
        pathMatch: 'full' as const,
        loadComponent: placeholder,
        data: { titleKey, icon },
      })),
    ],
  },
  { path: '**', redirectTo: '' },
];
