/**
 * usePermissions.ts — Hook de permisos del sistema
 *
 * Provee dos funciones para todos los componentes:
 *   canView(nav_key)      → boolean
 *   canExecute(action_key) → PermissionResult
 *
 * ARQUITECTURA IMPORTANTE:
 *   Este hook NO hace fetches a Supabase. Lee del store que ya tiene
 *   los permisos cargados al login. Esto garantiza:
 *   - Sin loading states en cada componente
 *   - Sin re-renders por fetches asíncronos
 *   - Funciona con localStorage cache (útil si hay lentitud de red)
 *
 * LÓGICA DE canView (en orden de precedencia):
 *   1. Si user.is_admin → true siempre (bypass total)
 *   2. Buscar en user_nav_overrides para (user_id, nav_key) → usar ese valor
 *   3. Buscar en role_nav_permissions (ya está en roleKeys) → si existe, true
 *   4. Default → false (deny by default)
 *
 * LÓGICA DE canExecute:
 *   1. Si user.is_admin → 'allowed' siempre
 *   2. Buscar en roleActionPerms (del store) → si can_execute = true, 'allowed'
 *   3. Buscar default_requires_approval del catálogo → si true, 'needs_approval'
 *   4. Default → 'needs_approval' (postura conservadora)
 *
 * USO EN COMPONENTES:
 *   // Fase 4 — Header
 *   const { canView } = usePermissions();
 *   if (!canView('cosecha.registro')) return null;
 *
 *   // Fase 7 — Acciones sensibles
 *   const { canExecute } = usePermissions();
 *   const result = canExecute('exportacion.kanban.advance_without_docs');
 *   if (result === 'needs_approval') { ... }
 *
 *   // Fase 8 — Exportacion.jsx tabs internas
 *   const { canView } = usePermissions();
 *   {canView('exportacion.dashboard') && <DashboardView ... />}
 */

import { useCallback } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import type { PermissionResult } from '../components/configuracion/configTypes';

// ─── Catálogo local de acciones (para canExecute sin fetch) ──────────────────
//
// Este objeto espeja el catálogo de permission_actions en DB (Migration 002).
// Evita un fetch extra al resolver canExecute. Si se agrega una acción nueva
// a la DB, debe agregarse aquí también.
//
// Clave: action_key → default_requires_approval
const ACTION_DEFAULTS: Readonly<Record<string, boolean>> = {
  'exportacion.kanban.advance_without_docs': true,
  'exportacion.embarque.edit':               true,
  'exportacion.embarque.delete':             true,
  'exportacion.catalogos.edit':              true,
  'cosecha.corte.delete':                    true,
  'cosecha.merma.delete':                    true,
  'inventario.ajuste.negativo':              true,
  'inventario.item.delete':                  true,
  'personal.baja':                           true,
  'plagas.aplicacion.delete':                true,
  'usuarios.delete':                         true,
} as const;

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function usePermissions() {
  const { user, permissions } = useAuthStore();

  // ── canView ────────────────────────────────────────────────────────────────
  /**
   * Determina si el usuario puede ver una sección de navegación.
   *
   * @param nav_key - Clave del árbol de navigation.ts. Ej: 'cosecha.registro'
   * @returns true si tiene acceso, false si no
   */
  const canView = useCallback(
    (nav_key: string): boolean => {
      // Sin usuario autenticado → no
      if (!user) return false;

      // Admin: bypass total
      if (user.is_admin) return true;

      // Sin permisos cargados → denegar por seguridad
      if (!permissions) return false;

      // Buscar override individual (tiene precedencia sobre el rol)
      const override = permissions.overrides.find((o) => o.nav_key === nav_key);
      if (override !== undefined) return override.can_view;

      // Verificar permiso del rol
      return permissions.roleKeys.includes(nav_key);
    },
    [user, permissions]
  );

  // ── canViewAny ─────────────────────────────────────────────────────────────
  /**
   * Devuelve true si el usuario puede ver AL MENOS UNA de las claves dadas.
   * Útil para mostrar/ocultar grupos del Header (operacion, personal, plagas, etc.)
   *
   * Ejemplo:
   *   canViewAny(['cosecha.registro', 'cosecha.reportes']) → true si puede ver alguna
   */
  const canViewAny = useCallback(
    (nav_keys: string[]): boolean => {
      return nav_keys.some((k) => canView(k));
    },
    [canView]
  );

  // ── canExecute ─────────────────────────────────────────────────────────────
  /**
   * Determina si el usuario puede ejecutar una acción sensible.
   *
   * @param action_key - Clave de permission_actions. Ej: 'exportacion.embarque.delete'
   * @returns 'allowed' | 'needs_approval' | 'denied'
   *
   * Nota: en esta fase, 'denied' no se usa — todas las acciones tienen
   * fallback a 'needs_approval'. Se reserva para fases futuras donde
   * algunos roles pueden tener prohibición explícita (can_execute = false).
   */
  const canExecute = useCallback(
    (action_key: string): PermissionResult => {
      if (!user) return 'denied';

      // Admin: siempre permitido directo
      if (user.is_admin) return 'allowed';

      // Verificar si la acción es conocida
      const defaultRequiresApproval = ACTION_DEFAULTS[action_key];

      // Acción desconocida: denegar por seguridad
      if (defaultRequiresApproval === undefined) {
        console.warn(`[usePermissions] action_key desconocido: "${action_key}". Denegando.`);
        return 'denied';
      }

      // Verificar role_action_permissions del snapshot
      // Si el rol tiene configuración explícita para esta acción, úsala
      if (permissions?.roleActionPerms) {
        const rolePerm = permissions.roleActionPerms.find((p) => p.action_key === action_key);
        if (rolePerm !== undefined) {
          return rolePerm.can_execute ? 'allowed' : 'needs_approval';
        }
      }

      // Sin configuración explícita: usar default del catálogo
      return defaultRequiresApproval ? 'needs_approval' : 'allowed';
    },
    [user, permissions]
  );

  // ── isAdmin ────────────────────────────────────────────────────────────────
  /** Shortcut para verificar si el usuario actual es administrador */
  const isAdmin = user?.is_admin ?? false;

  // ── isLoaded ───────────────────────────────────────────────────────────────
  /**
   * true cuando los permisos están listos para usarse.
   * Admin no necesita cargar permisos (is_admin = bypass), así que isLoaded
   * es true para admins incluso si permissions === null.
   *
   * Usar esto en componentes que renderizan condicional en permisos:
   *   if (!isLoaded) return <Spinner />;
   */
  const isLoaded = user?.is_admin === true || permissions !== null;

  return {
    canView,
    canViewAny,
    canExecute,
    isAdmin,
    isLoaded,
    /** Usuario actual del store, tipado como AppUser */
    user,
  };
}