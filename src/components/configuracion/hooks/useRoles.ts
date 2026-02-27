/**
 * useRoles.ts — Lógica de lectura/escritura de roles y sus permisos
 * Fase 5 — Config UI
 */
import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import type { Role, RoleNavPermission } from '../configTypes';
import toast from 'react-hot-toast';

interface UseRolesReturn {
  roles: Role[];
  /** Mapa de role_id → nav_keys[] con can_view = true */
  rolePermissionsMap: Record<string, string[]>;
  isLoading: boolean;
  createRole: (data: Pick<Role, 'nombre' | 'descripcion' | 'color'>) => Promise<Role>;
  updateRole: (id: string, data: Partial<Role>) => Promise<void>;
  deleteRole: (id: string) => Promise<void>;
  setRolePermissions: (roleId: string, navKeys: string[]) => Promise<void>;
  refetch: () => Promise<void>;
}

export function useRoles(): UseRolesReturn {
  const [roles, setRoles] = useState<Role[]>([]);
  const [rolePermissionsMap, setRolePermissionsMap] = useState<Record<string, string[]>>({});
  const [isLoading, setIsLoading] = useState(true);

  const fetchAll = async () => {
    setIsLoading(true);
    const [{ data: rolesData, error: rolesErr }, { data: permsData, error: permsErr }] =
      await Promise.all([
        supabase.from('roles').select('*').order('nombre'),
        supabase.from('role_nav_permissions').select('role_id, nav_key').eq('can_view', true),
      ]);

    if (rolesErr) console.error('[useRoles] fetch roles:', rolesErr);
    if (permsErr)  console.error('[useRoles] fetch perms:', permsErr);

    setRoles((rolesData ?? []) as Role[]);

    // Construir mapa role_id → nav_keys[]
    const map: Record<string, string[]> = {};
    for (const p of (permsData ?? []) as RoleNavPermission[]) {
      if (!map[p.role_id]) map[p.role_id] = [];
      map[p.role_id].push(p.nav_key);
    }
    setRolePermissionsMap(map);
    setIsLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const createRole = async (data: Pick<Role, 'nombre' | 'descripcion' | 'color'>) => {
    const { data: created, error } = await supabase
      .from('roles')
      .insert(data)
      .select()
      .single();
    if (error) { toast.error('Error al crear rol'); throw error; }
    toast.success('Rol creado');
    await fetchAll();
    return created as Role;
  };

  const updateRole = async (id: string, data: Partial<Role>) => {
    const { error } = await supabase.from('roles').update(data).eq('id', id);
    if (error) { toast.error('Error al actualizar rol'); throw error; }
    toast.success('Rol actualizado');
    await fetchAll();
  };

  const deleteRole = async (id: string) => {
    // Verificar que no hay usuarios con este rol antes de eliminar
    const { count } = await supabase
      .from('Users')
      .select('"ID"', { count: 'exact', head: true })
      .eq('role_id', id);

    if (count && count > 0) {
      toast.error(`No se puede eliminar: ${count} usuario(s) tienen este rol asignado`);
      return;
    }

    const { error } = await supabase.from('roles').delete().eq('id', id);
    if (error) { toast.error('Error al eliminar rol'); throw error; }
    toast.success('Rol eliminado');
    await fetchAll();
  };

  /**
   * Reemplaza todos los permisos de un rol con las navKeys dadas.
   * Usa delete + insert para garantizar consistencia.
   */
  const setRolePermissions = async (roleId: string, navKeys: string[]) => {
    // Eliminar todos los permisos actuales del rol
    // Nota: en Supabase JS v2 el delete no falla si no hay filas, pero
    // para evitar errores de RLS en tablas vacías usamos .select() al final
    const { error: delErr } = await supabase
      .from('role_nav_permissions')
      .delete()
      .eq('role_id', roleId)
      .select();   // Evita error silencioso de RLS en Supabase v2

    if (delErr) {
      console.error('[useRoles] delete role_nav_permissions:', delErr);
      toast.error('Error al actualizar permisos del rol');
      throw delErr;
    }

    // Insertar los nuevos (si hay)
    if (navKeys.length > 0) {
      const rows = navKeys.map((nav_key) => ({ role_id: roleId, nav_key, can_view: true }));
      const { error: insErr } = await supabase.from('role_nav_permissions').insert(rows);
      if (insErr) { toast.error('Error al guardar permisos del rol'); throw insErr; }
    }

    toast.success('Permisos del rol actualizados');
    await fetchAll();
  };

  return { roles, rolePermissionsMap, isLoading, createRole, updateRole, deleteRole, setRolePermissions, refetch: fetchAll };
}