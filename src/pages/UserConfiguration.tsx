/**
 * UserConfiguration.tsx — Página de gestión de usuarios
 * Fase 5 — reemplaza la versión anterior (checkboxes legacy)
 *
 * Layout dos paneles: UsersList (izquierda) + UserEditor (derecha).
 * El selectedUserId se guarda en estado local — no en URL porque
 * no hay necesidad de navegación directa a un usuario específico.
 */
import React, { useState } from 'react';
import { useUsers } from '../components/configuracion/hooks/useUsers';
import { useRoles } from '../components/configuracion/hooks/useRoles';
import UsersList from '../components/configuracion/UsersList';
import UserEditor from '../components/configuracion/UserEditor';

export default function UserConfiguration() {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const { users, isLoading: usersLoading, refetch } = useUsers();
  const { roles, isLoading: rolesLoading } = useRoles();

  const selectedUser = users.find((u) => u.id === selectedUserId) ?? null;

  const handleSelect = (id: string) => {
    setSelectedUserId(id);
    setIsCreating(false);
  };

  const handleNewUser = () => {
    setSelectedUserId(null);
    setIsCreating(true);
  };

  const handleSaved = async () => {
    await refetch();
    // Si estaba creando, limpiar
    if (isCreating) setIsCreating(false);
  };

  const handleDeleted = async () => {
    setSelectedUserId(null);
    await refetch();
  };

  return (
    <div className="flex h-[calc(100vh-112px)]"> {/* 112px = Header(64) + ConfigLayout tab bar(48) */}
      {/* Panel izquierdo — 30% */}
      <div className="w-72 flex-shrink-0">
        <UsersList
          users={users}
          roles={roles}
          selectedUserId={isCreating ? null : selectedUserId}
          onSelect={handleSelect}
          onNewUser={handleNewUser}
          isLoading={usersLoading || rolesLoading}
        />
      </div>

      {/* Panel derecho — 70% */}
      <div className="flex-1 overflow-hidden">
        <UserEditor
          user={isCreating ? null : selectedUser}
          roles={roles}
          isCreating={isCreating}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
          onCancelNew={() => setIsCreating(false)}
        />
      </div>
    </div>
  );
}