/**
 * useAuthStore.ts — Zustand store de autenticación
 *
 * Cambios Fase 3:
 *   - Tipo User extendido a AppUser (id, name, role_id, is_admin, is_active)
 *   - Estado `permissions` con snapshot de permisos de navegación
 *   - login() ahora también carga role_nav_permissions + user_nav_overrides
 *   - refreshPermissions() para recargar permisos sin re-login (útil en Fase 5)
 *
 * Compatibilidad:
 *   - `allowedTabs` se mantiene: Header y componentes que aún no migraron
 *     siguen funcionando sin cambios durante la transición.
 *   - Campos nuevos tienen defaults para no romper sesiones existentes.
 */

import { create } from 'zustand';
import { supabase } from '../lib/supabaseClient';
import type { AppUser, UserPermissionsSnapshot, UserNavOverride } from '../components/configuracion/configTypes';

interface AuthState {
  // ── Legacy (compatibilidad) ────────────────────────────────────────────────
  user: AppUser | null;
  allowedTabs: string[];

  // ── Nuevo: permisos de navegación ─────────────────────────────────────────
  permissions: UserPermissionsSnapshot | null;

  // ── Acciones ──────────────────────────────────────────────────────────────
  setUser: (user: AppUser | null) => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshPermissions: () => Promise<void>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function loadUserFromStorage(): AppUser | null {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return { is_admin: false, is_active: true, role_id: null, name: null, ...parsed } as AppUser;
  } catch { return null; }
}

function loadPermissionsFromStorage(): UserPermissionsSnapshot | null {
  try {
    const raw = localStorage.getItem('permissions');
    if (!raw) return null;
    return JSON.parse(raw) as UserPermissionsSnapshot;
  } catch { return null; }
}

async function fetchPermissionsForUser(user: AppUser): Promise<UserPermissionsSnapshot> {
  // Admin: bypass total
  if (user.is_admin) return { roleKeys: [], overrides: [], roleActionPerms: [] };
  // Sin rol: sin permisos
  if (!user.role_id) return { roleKeys: [], overrides: [], roleActionPerms: [] };

  const [
    { data: rolePerms,   error: roleErr     },
    { data: overrides,   error: overrideErr  },
    { data: actionPerms, error: actionErr    },
  ] = await Promise.all([
    supabase
      .from('role_nav_permissions')
      .select('nav_key')
      .eq('role_id', user.role_id)
      .eq('can_view', true),
    supabase
      .from('user_nav_overrides')
      .select('id, user_id, nav_key, can_view')
      .eq('user_id', user.id),
    supabase
      .from('role_action_permissions')
      .select('action_key, can_execute')
      .eq('role_id', user.role_id),
  ]);

  if (roleErr)     console.error('[useAuthStore] role_nav_permissions:', roleErr);
  if (overrideErr) console.error('[useAuthStore] user_nav_overrides:', overrideErr);
  if (actionErr)   console.error('[useAuthStore] role_action_permissions:', actionErr);

  return {
    roleKeys:        (rolePerms   ?? []).map((p: { nav_key: string }) => p.nav_key),
    overrides:       (overrides   ?? []) as UserNavOverride[],
    roleActionPerms: (actionPerms ?? []) as { action_key: string; can_execute: boolean }[],
  };
}

// ─── Store ────────────────────────────────────────────────────────────────────

const storedUser = loadUserFromStorage();

export const useAuthStore = create<AuthState>((set, get) => ({
  user: storedUser,
  allowedTabs: storedUser?.tabs?.split(',').map((t) => t.trim()) ?? [],
  permissions: loadPermissionsFromStorage(),

  setUser: (user) => {
    if (user) localStorage.setItem('user', JSON.stringify(user));
    else localStorage.removeItem('user');
    set({ user, allowedTabs: user?.tabs?.split(',').map((t) => t.trim()) ?? [] });
  },

  login: async (email: string, password: string) => {
    const { data, error } = await supabase
      .from('Users')
      .select('*')
      .eq('email', email)
      .eq('password', password)
      .single();

    if (error || !data) throw new Error('Credenciales incorrectas');

    // Normalizar: la columna en DB se llama "ID" (mayúscula, int8)
    // Supabase lo devuelve como { ID: number, ... }
    // Lo mapeamos a { id: number, ... } para el resto del frontend
    const raw = data as Record<string, unknown>;
    const user: AppUser = {
      id:         raw['ID'] as number,
      email:      raw['email'] as string,
      password:   raw['password'] as string | undefined,
      name:       (raw['name'] as string | null) ?? null,
      tabs:       (raw['tabs'] as string) ?? '',
      role_id:    (raw['role_id'] as string | null) ?? null,
      is_active:  raw['is_active'] !== false,
      is_admin:   raw['is_admin'] === true,
      created_at: raw['created_at'] as string,
    };

    if (user.is_active === false)
      throw new Error('Esta cuenta está desactivada. Contacta al administrador.');

    const permissions = await fetchPermissionsForUser(user);

    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('permissions', JSON.stringify(permissions));

    set({ user, allowedTabs: user.tabs?.split(',').map((t) => t.trim()) ?? [], permissions });
  },

  logout: async () => {
    localStorage.removeItem('user');
    localStorage.removeItem('permissions');
    set({ user: null, allowedTabs: [], permissions: null });
    window.location.reload();
  },

  /**
   * Recarga permisos del usuario actual desde Supabase sin re-login.
   * Llamar desde Fase 5 (Config UI) después de editar permisos,
   * y desde Fase 7 (ApprovalQueue) después de aprobar solicitudes.
   */
  refreshPermissions: async () => {
    const { user } = get();
    if (!user) return;
    const permissions = await fetchPermissionsForUser(user);
    localStorage.setItem('permissions', JSON.stringify(permissions));
    set({ permissions });
  },
}));