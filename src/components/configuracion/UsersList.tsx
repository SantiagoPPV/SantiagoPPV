/**
 * UsersList.tsx — Panel izquierdo de gestión de usuarios
 * Fase 5 — Config UI
 *
 * Muestra la lista de usuarios con:
 *   - Buscador en tiempo real
 *   - Badge colorido del rol asignado
 *   - Indicador verde/rojo activo/inactivo
 *   - Indicador ⚠️ para usuarios sin rol (pendientes de migración — Fase 6)
 *   - Botón "+ Nuevo Usuario"
 */
import React, { useState } from 'react';
import { UserPlus, Search } from 'lucide-react';
import type { AppUser, Role } from './configTypes';

interface Props {
  users: AppUser[];
  roles: Role[];
  selectedUserId: string | null;
  onSelect: (userId: string) => void;
  onNewUser: () => void;
  isLoading: boolean;
}

export default function UsersList({ users, roles, selectedUserId, onSelect, onNewUser, isLoading }: Props) {
  const [search, setSearch] = useState('');

  const roleMap = Object.fromEntries(roles.map((r) => [r.id, r]));

  const filtered = users.filter((u) => {
    const term = search.toLowerCase();
    return (
      u.email.toLowerCase().includes(term) ||
      (u.name ?? '').toLowerCase().includes(term)
    );
  });

  // Separar: primero admins, luego activos, luego inactivos
  const sorted = [...filtered].sort((a, b) => {
    if (a.is_admin !== b.is_admin) return a.is_admin ? -1 : 1;
    if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
    return (a.name ?? a.email).localeCompare(b.name ?? b.email);
  });

  return (
    <div className="flex flex-col h-full bg-[#111] border-r border-[#222]">
      {/* Header */}
      <div className="p-4 border-b border-[#222]">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-white">Usuarios</h2>
          <button
            onClick={onNewUser}
            className="flex items-center gap-1.5 text-xs bg-[#3B82F6] hover:bg-[#2563EB] text-white px-3 py-1.5 rounded-lg transition-colors"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Nuevo
          </button>
        </div>

        {/* Buscador */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#555]" />
          <input
            type="text"
            placeholder="Buscar por nombre o email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#1A1A1A] text-white text-xs pl-8 pr-3 py-2 rounded-lg border border-[#333] focus:outline-none focus:border-[#3B82F6] placeholder-[#555]"
          />
        </div>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-[#555] text-sm">
            Cargando…
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-[#555] text-sm">
            {search ? 'Sin resultados' : 'Sin usuarios'}
          </div>
        ) : (
          sorted.map((user) => {
            const role = user.role_id ? roleMap[user.role_id] : null;
            const isSelected = user.id === selectedUserId;
            const needsMigration = !user.role_id && !user.is_admin;

            return (
              <button
                key={user.id}
                onClick={() => onSelect(user.id)}
                className={`w-full text-left px-4 py-3 border-b border-[#1a1a1a] transition-colors ${
                  isSelected
                    ? 'bg-[#1e2a3a] border-l-2 border-l-[#3B82F6]'
                    : 'hover:bg-[#161616] border-l-2 border-l-transparent'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  {/* Info principal */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      {/* Indicador activo/inactivo */}
                      <span
                        className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                          user.is_active ? 'bg-[#10B981]' : 'bg-[#EF4444]'
                        }`}
                        title={user.is_active ? 'Activo' : 'Inactivo'}
                      />
                      <span className="text-sm text-white truncate font-medium">
                        {user.name ?? user.email.split('@')[0]}
                      </span>
                      {user.is_admin && (
                        <span className="text-[10px] text-[#EF4444] font-bold flex-shrink-0">ADMIN</span>
                      )}
                    </div>
                    <div className="text-[11px] text-[#555] truncate pl-3">{user.email}</div>
                  </div>

                  {/* Badge de rol */}
                  <div className="flex-shrink-0 flex flex-col items-end gap-1">
                    {role ? (
                      <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: role.color + '25', color: role.color }}
                      >
                        {role.nombre}
                      </span>
                    ) : needsMigration ? (
                      <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#F59E0B20] text-[#F59E0B]"
                        title="Sin rol asignado — requiere migración"
                      >
                        ⚠️ Sin rol
                      </span>
                    ) : null}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Footer con conteos */}
      <div className="p-3 border-t border-[#222] flex gap-3 text-[11px] text-[#555]">
        <span>{users.filter((u) => u.is_active).length} activos</span>
        <span>·</span>
        <span>{users.filter((u) => !u.role_id && !u.is_admin).length} sin rol</span>
      </div>
    </div>
  );
}