/**
 * useNavOverrides.ts — Overrides individuales de navegación por usuario
 * Fase 5 — Config UI / UserEditor Tab 2
 *
 * Lee y escribe en user_nav_overrides para un usuario específico.
 * También expone los permisos efectivos del usuario (rol + overrides fusionados)
 * para que NavPermissionsTree pueda mostrar qué viene del rol y qué es override.
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useAuthStore } from '../../../store/useAuthStore';
import type { UserNavOverride } from '../configTypes';
import toast from 'react-hot-toast';

interface UseNavOverridesReturn {
  /** Overrides individuales del usuario */
  overrides: UserNavOverride[];
  /** Nav keys del rol asignado (can_view = true) */
  roleKeys: string[];
  /**
   * Nav keys efectivas: rol + overrides aplicados.
   * Esta es la verdad de qué puede ver el usuario.
   */
  effectiveKeys: string[];
  isLoading: boolean;
  /**
   * Establece un override individual.
   * Si can_view coincide con el permiso del rol → eliminar override (innecesario).
   * Si difiere → upsert el override.
   */
  setOverride: (nav_key: string, can_view: boolean) => Promise<void>;
  /** Elimina todos los overrides del usuario (reset al rol) */
  resetToRole: () => Promise<void>;
}

export function useNavOverrides(userId: number | null, roleId: string | null): UseNavOverridesReturn {
  const [overrides, setOverrides] = useState<UserNavOverride[]>([]);
  const [roleKeys, setRoleKeys] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { refreshPermissions } = useAuthStore();

  const fetch = useCallback(async () => {
    if (!userId) {
      setOverrides([]);
      setRoleKeys([]);
      return;
    }
    setIsLoading(true);

    const [{ data: overridesData, error: overridesErr }, { data: roleData, error: roleErr }] =
      await Promise.all([
        supabase
          .from('user_nav_overrides')
          .select('id, user_id, nav_key, can_view')
          .eq('user_id', userId),
        roleId
          ? supabase
              .from('role_nav_permissions')
              .select('nav_key')
              .eq('role_id', roleId)
              .eq('can_view', true)
          : Promise.resolve({ data: [], error: null }),
      ]);

    if (overridesErr) console.error('[useNavOverrides] overrides:', overridesErr);
    if (roleErr)      console.error('[useNavOverrides] role perms:', roleErr);

    setOverrides((overridesData ?? []) as UserNavOverride[]);
    setRoleKeys(((roleData ?? []) as { nav_key: string }[]).map((p) => p.nav_key));
    setIsLoading(false);
  }, [userId, roleId]);

  useEffect(() => { fetch(); }, [fetch]);

  const setOverride = async (nav_key: string, can_view: boolean) => {
    if (!userId) return;

    const roleHasKey = roleKeys.includes(nav_key);

    // Si el override coincide con el permiso del rol → no necesitamos override, borrar si existe
    if (can_view === roleHasKey) {
      await supabase
        .from('user_nav_overrides')
        .delete()
        .eq('user_id', userId)
        .eq('nav_key', nav_key);
    } else {
      // Upsert el override
      await supabase.from('user_nav_overrides').upsert(
        { user_id: userId, nav_key, can_view },
        { onConflict: 'user_id,nav_key' }
      );
    }

    await fetch();
    // Si es el usuario actual, refrescar permisos en el store
    await refreshPermissions();
  };

  const resetToRole = async () => {
    if (!userId) return;
    const { error } = await supabase
      .from('user_nav_overrides')
      .delete()
      .eq('user_id', userId);
    if (error) { toast.error('Error al restablecer permisos'); return; }
    toast.success('Permisos restablecidos al rol');
    await fetch();
    await refreshPermissions();
  };

  // Calcular permisos efectivos: rol + overrides
  const effectiveKeys = [
    // Claves del rol que no tienen override negativo
    ...roleKeys.filter(
      (k) => !overrides.some((o) => o.nav_key === k && !o.can_view)
    ),
    // Overrides positivos que no están en el rol
    ...overrides
      .filter((o) => o.can_view && !roleKeys.includes(o.nav_key))
      .map((o) => o.nav_key),
  ];

  return { overrides, roleKeys, effectiveKeys, isLoading, setOverride, resetToRole };
}