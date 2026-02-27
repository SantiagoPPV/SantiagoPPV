/**
 * configTypes.ts — Tipos del sistema de permisos y configuración
 *
 * Este archivo es la única fuente de tipos para:
 *   Fase 3  — usePermissions.ts
 *   Fase 4  — Header.tsx
 *   Fase 5  — Config UI (UsersList, UserEditor, RolesManager, NavPermissionsTree)
 *   Fase 7  — ApprovalQueue, useApprovals.ts
 *   Fase 8  — Exportacion.jsx (importa PermissionResult)
 *
 * Regla: ningún componente define sus propios tipos de permisos.
 * Si un tipo nuevo es necesario, se agrega aquí.
 */

// ─── Usuario ────────────────────────────────────────────────────────────────

/**
 * Campos del usuario tal como vienen de la tabla Users de Supabase.
 * Incluye tanto los campos legacy (tabs) como los nuevos (role_id, is_admin, etc.)
 * La columna `tabs` se mantiene mientras dure la transición (ver Migration 003).
 *
 * NOTA: La columna se llama "ID" (mayúscula) en la DB y es int8.
 * Supabase JS client la devuelve como number. El campo `id` aquí es
 * el alias normalizado para uso en el frontend.
 */
export interface AppUser {
  id: number;           // Users."ID" — int8 en DB. Supabase lo devuelve como number.
  email: string;
  password?: string;    // Nunca mostrar en UI
  name: string | null;
  tabs: string;         // Legacy — CSV. Se mantiene hasta confirmar estabilidad.
  role_id: string | null;
  is_active: boolean;
  is_admin: boolean;
  created_at: string;
}

// ─── Roles ──────────────────────────────────────────────────────────────────

export interface Role {
  id: string;
  nombre: string;
  descripcion: string;
  color: string;            // Hex — usado para badge visual en UI
  created_at: string;
}

// ─── Permisos de navegación ─────────────────────────────────────────────────

/**
 * Fila de role_nav_permissions.
 * Una fila por permiso activo. Default deny: ausencia = sin acceso.
 */
export interface RoleNavPermission {
  id: string;
  role_id: string;
  nav_key: string;
  can_view: boolean;
}

/**
 * Fila de user_nav_overrides.
 * Excepciones individuales que sobreescriben el rol del usuario.
 * can_view = true  → acceso extra sobre su rol
 * can_view = false → quitar acceso del rol
 */
export interface UserNavOverride {
  id: string;
  user_id: number;    // bigint en DB — corregido en migration 003 (era uuid por error)
  nav_key: string;
  can_view: boolean;
}

/**
 * Snapshot de todos los permisos de un usuario.
 * Se calcula al login y se guarda en el auth store.
 * usePermissions.ts lee de aquí — no hace fetches propios.
 */
export interface UserPermissionsSnapshot {
  /** nav_keys que el rol del usuario tiene can_view = true */
  roleKeys: string[];
  /** Overrides individuales del usuario */
  overrides: UserNavOverride[];
  /**
   * Permisos de acción del rol del usuario.
   * Cargados al login junto con los permisos de navegación.
   * Usados por canExecute() para resolver 'allowed' | 'needs_approval'.
   */
  roleActionPerms: Array<{ action_key: string; can_execute: boolean }>;
}

// ─── Acciones y autorización ─────────────────────────────────────────────────

/**
 * Fila de permission_actions.
 * Catálogo de acciones sensibles. Se puebla via migrations, no UI.
 */
export interface PermissionAction {
  id: string;
  module_key: string;
  action_key: string;
  label: string;
  description: string;
  default_requires_approval: boolean;
  created_at: string;
}

/**
 * Fila de role_action_permissions.
 * Define qué roles ejecutan acciones directamente (sin aprobación).
 */
export interface RoleActionPermission {
  id: string;
  role_id: string;
  action_key: string;
  can_execute: boolean;
}

/**
 * Resultado de canExecute().
 * - 'allowed'        → ejecutar directamente
 * - 'needs_approval' → crear solicitud en approval_requests
 * - 'denied'         → acción no disponible para este rol
 */
export type PermissionResult = 'allowed' | 'needs_approval' | 'denied';

// ─── Cola de autorización ────────────────────────────────────────────────────

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired';

/**
 * Fila de approval_requests con joins opcionales para la UI.
 */
export interface ApprovalRequest {
  id: string;
  requested_by: number;   // bigint en DB — Users."ID"
  action_key: string;
  context_id: string | null;
  context_data: Record<string, unknown> | null;
  status: ApprovalStatus;
  reviewed_by: number | null;   // bigint en DB — Users."ID"
  reviewed_at: string | null;
  expires_at: string | null;
  admin_notes: string | null;
  created_at: string;

  // Joins — opcionales, presentes cuando se hace select con joins
  requester?: Pick<AppUser, 'id' | 'email' | 'name'>;
  reviewer?: Pick<AppUser, 'id' | 'email' | 'name'>;
  action?: Pick<PermissionAction, 'action_key' | 'label' | 'module_key'>;
}

/**
 * Payload para crear una solicitud de aprobación.
 * Lo usa el hook useRequestApproval (Fase 7) cuando canExecute devuelve 'needs_approval'.
 */
export interface CreateApprovalPayload {
  action_key: string;
  context_id?: string;
  context_data?: Record<string, unknown>;
}

/**
 * Payload para que el admin apruebe o rechace una solicitud.
 */
export interface ReviewApprovalPayload {
  request_id: string;
  decision: 'approved' | 'rejected';
  admin_notes?: string;
}

// ─── Estado del auth store (extendido) ───────────────────────────────────────

/**
 * Lo que el auth store guarda después de la Fase 3.
 * Se extiende useAuthStore.ts para incluir estos campos.
 * Los campos legacy (allowedTabs) se mantienen durante la transición.
 */
export interface AuthStoreState {
  // Legacy — se mantiene para compatibilidad durante migración
  user: AppUser | null;
  allowedTabs: string[];

  // Nuevo — disponible después de Fase 3
  permissions: UserPermissionsSnapshot | null;

  // Acciones del store
  setUser: (user: AppUser | null) => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshPermissions: () => Promise<void>;
}

// ─── Props comunes para componentes de Config UI (Fase 5) ────────────────────

export interface UsersListProps {
  users: AppUser[];
  roles: Role[];
  selectedUserId: string | null;
  onSelect: (userId: string) => void;
  onNewUser: () => void;
  isLoading: boolean;
}

export interface UserEditorProps {
  user: AppUser | null;          // null = creando usuario nuevo
  roles: Role[];
  permissions: UserPermissionsSnapshot | null;
  onSave: (user: Partial<AppUser>) => Promise<void>;
  onDelete: (userId: string) => Promise<void>;
  isLoading: boolean;
}

export interface NavPermissionsTreeProps {
  /** Claves que el rol/usuario tiene activas */
  activeKeys: string[];
  /** Claves con override individual (se muestran con ícono diferente) */
  overrideKeys?: string[];
  /** Callback al cambiar un toggle */
  onChange: (nav_key: string, can_view: boolean) => void;
  /** Si true, los toggles son solo lectura */
  readOnly?: boolean;
}

export interface RolesManagerProps {
  roles: Role[];
  permissions: Record<string, string[]>; // role_id → nav_keys[]
  onSaveRole: (role: Partial<Role>, keys: string[]) => Promise<void>;
  onDeleteRole: (roleId: string) => Promise<void>;
  isLoading: boolean;
}

export interface ApprovalQueueProps {
  requests: ApprovalRequest[];
  onReview: (payload: ReviewApprovalPayload) => Promise<void>;
  isLoading: boolean;
}