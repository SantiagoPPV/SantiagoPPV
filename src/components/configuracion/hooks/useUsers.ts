/**
 * useUsers.ts — Lógica de lectura/escritura de usuarios
 * Fase 5 — Config UI
 *
 * CORRECCIÓN: La tabla Users tiene la PK como "ID" (mayúscula, int8).
 * Todas las queries usan '"ID"' con comillas para que Supabase lo resuelva
 * correctamente. El objeto AppUser normaliza esto como { id: number }.
 */
import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useAuthStore } from '../../../store/useAuthStore';
import type { AppUser } from '../configTypes';
import toast from 'react-hot-toast';

interface UseUsersReturn {
  users: AppUser[];
  isLoading: boolean;
  createUser: (data: { email: string; password: string; name: string; role_id: string | null }) => Promise<void>;
  updateUser: (id: number, data: Partial<AppUser>) => Promise<void>;
  deleteUser: (id: number) => Promise<void>;
  refetch: () => Promise<void>;
}

// Normaliza una fila cruda de Supabase (con "ID" mayúscula) al tipo AppUser
function normalizeUser(raw: Record<string, unknown>): AppUser {
  return {
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
}

export function useUsers(): UseUsersReturn {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { refreshPermissions } = useAuthStore();

  const fetchUsers = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('Users')
      .select('"ID", email, name, tabs, role_id, is_active, is_admin, created_at')
      .order('email');

    if (error) {
      console.error('[useUsers] fetch:', error);
      toast.error('Error al cargar usuarios');
    } else {
      setUsers((data ?? []).map((u) => normalizeUser(u as Record<string, unknown>)));
    }
    setIsLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const createUser = async (data: { email: string; password: string; name: string; role_id: string | null }) => {
    const { error } = await supabase.from('Users').insert({
      email:     data.email,
      password:  data.password,
      name:      data.name,
      role_id:   data.role_id,
      tabs:      'Mapa',
      is_active: true,
      is_admin:  false,
    });
    if (error) { toast.error('Error al crear usuario'); throw error; }
    toast.success('Usuario creado');
    await fetchUsers();
  };

  const updateUser = async (id: number, data: Partial<AppUser>) => {
    const payload = { ...data } as Record<string, unknown>;
    if ('password' in payload && !payload['password']) delete payload['password'];
    delete payload['id'];

    const { error } = await supabase
      .from('Users')
      .update(payload)
      .eq('"ID"', id);

    if (error) { toast.error('Error al actualizar usuario'); throw error; }
    toast.success('Usuario actualizado');
    await fetchUsers();
    await refreshPermissions();
  };

  const deleteUser = async (id: number) => {
    const { error } = await supabase
      .from('Users')
      .delete()
      .eq('"ID"', id);

    if (error) { toast.error('Error al eliminar usuario'); throw error; }
    toast.success('Usuario eliminado');
    await fetchUsers();
  };

  return { users, isLoading, createUser, updateUser, deleteUser, refetch: fetchUsers };
}