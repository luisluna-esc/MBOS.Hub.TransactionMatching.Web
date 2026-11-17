// Mismos formatos que /api/auth (LoginDto, AuthResponseDto).

export interface LoginRequest {
  /** nombre.apellido */
  username: string;
  password: string;
}

export interface AuthSession {
  appUserId: number;
  fullName: string;
  username: string;
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
  roles: string[];
}

/** Mismos nombres que RoleNames del backend. */
export const ROLES = {
  admin: 'M-BOS',
  /** Importa el extracto y el Mayor, coteja y cierra conciliaciones. */
  accountant: 'Contabilidad',
  /** Solo consulta y descarga reportes. */
  viewer: 'Consulta',
} as const;

/** RoleNames.Writers: los únicos que registran y modifican datos. */
export const WRITER_ROLES: string[] = [ROLES.admin, ROLES.accountant];
