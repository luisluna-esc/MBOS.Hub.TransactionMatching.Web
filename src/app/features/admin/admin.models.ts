// Mismos formatos que los DTOs del backend (TransactionMatching.Application/Dtos/Security y Audit).

/** AppUserDto (también es el cuerpo de POST y PUT /api/appusers). */
export interface AppUser {
  appUserId: number;
  ci: string | null;
  fullName: string;
  /** nombre.apellido: con esto se entra al sistema. */
  username: string;
  phone: string | null;
  /** Solo al crear o al cambiarla: la contraseña. Nunca viene en las respuestas. */
  password?: string | null;
  passwordChangedAt?: string | null;
  failedLoginAttempts: number;
  lockedUntil: string | null;
  isActive: boolean;
  lastLogin: string | null;
  createdById?: number | null;
  createdAt?: string;
}

/** RoleDto */
export interface Role {
  roleId: number;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt?: string;
}

/** MenuDto */
export interface Menu {
  menuId: number;
  name: string;
  translationKey: string | null;
  route: string | null;
  icon: string | null;
  parentMenuId: number | null;
  displayOrder: number;
  isActive: boolean;
}

export type AuditAction = 'INSERT' | 'UPDATE' | 'DELETE';

/** AuditLogDto */
export interface AuditLog {
  auditLogId: number;
  appUserId: number | null;
  appUserFullName: string | null;
  action: AuditAction;
  tableName: string;
  recordId: number | null;
  /** De qué registro se trata: la iglesia y el mes de un arqueo, el nombre de una iglesia, etc. */
  recordLabel: string | null;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
}

/** Tablas que registra la auditoría, para el filtro. */
export const AUDITED_TABLES = [
  'app_user',
  'app_user_role',
  'role',
  'menu',
  'menu_role',
  'bank_account',
  'reconciliation',
  'reconciliation_match',
];
