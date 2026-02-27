/**
 * RolesManager.tsx — Gestión de roles del sistema
 * Fase 5 — Config UI
 *
 * Panel izquierdo: lista de roles con badge de color y conteo de usuarios.
 * Panel derecho:   editor del rol seleccionado con NavPermissionsTree.
 *
 * Los roles con ID fijo de las migrations (a1000000-...) se marcan como
 * "rol del sistema" y no se pueden eliminar desde la UI.
 */
import React, { useState, useEffect } from 'react';
import { Plus, Save, Trash2, Loader2 } from 'lucide-react';
import type { AppUser, Role } from './configTypes';
import { useRoles } from './hooks/useRoles';
import NavPermissionsTree from './NavPermissionsTree';

const SYSTEM_ROLE_IDS = [
  'a1000000-0000-0000-0000-000000000001',
  'a1000000-0000-0000-0000-000000000002',
  'a1000000-0000-0000-0000-000000000003',
  'a1000000-0000-0000-0000-000000000004',
  'a1000000-0000-0000-0000-000000000005',
  'a1000000-0000-0000-0000-000000000006',
];

const COLOR_PRESETS = [
  '#EF4444', '#F59E0B', '#10B981', '#3B82F6',
  '#8B5CF6', '#EC4899', '#00C9A7', '#6B7280',
];

interface Props {
  users: AppUser[];
}

export default function RolesManager({ users }: Props) {
  const { roles, rolePermissionsMap, isLoading, createRole, updateRole, deleteRole, setRolePermissions } = useRoles();

  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Form state
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [color, setColor] = useState(COLOR_PRESETS[3]);
  const [activeKeys, setActiveKeys] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const selectedRole = roles.find((r) => r.id === selectedRoleId) ?? null;

  // Sync form cuando cambia el rol seleccionado
  useEffect(() => {
    if (selectedRole) {
      setNombre(selectedRole.nombre);
      setDescripcion(selectedRole.descripcion);
      setColor(selectedRole.color);
      setActiveKeys(rolePermissionsMap[selectedRole.id] ?? []);
      setConfirmDelete(false);
    } else if (isCreating) {
      setNombre('');
      setDescripcion('');
      setColor(COLOR_PRESETS[3]);
      setActiveKeys([]);
    }
  }, [selectedRoleId, isCreating, rolePermissionsMap]);

  const handleSave = async () => {
    if (!nombre.trim()) return;
    setIsSaving(true);
    try {
      if (isCreating) {
        const newRole = await createRole({ nombre, descripcion, color });
        await setRolePermissions(newRole.id, activeKeys);
        setIsCreating(false);
        setSelectedRoleId(newRole.id);
      } else if (selectedRole) {
        await updateRole(selectedRole.id, { nombre, descripcion, color });
        await setRolePermissions(selectedRole.id, activeKeys);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedRole) return;
    if (!confirmDelete) { setConfirmDelete(true); return; }
    await deleteRole(selectedRole.id);
    setSelectedRoleId(null);
  };

  const handlePermissionChange = (nav_key: string, can_view: boolean) => {
    setActiveKeys((prev) =>
      can_view ? [...prev, nav_key] : prev.filter((k) => k !== nav_key)
    );
  };

  const isSystemRole = selectedRole ? SYSTEM_ROLE_IDS.includes(selectedRole.id) : false;
  const userCountByRole = Object.fromEntries(
    roles.map((r) => [r.id, users.filter((u) => u.role_id === r.id).length])
  );

  return (
    <div className="flex h-full">

      {/* ── Panel izquierdo: lista de roles ─────────────────── */}
      <div className="w-64 flex-shrink-0 flex flex-col bg-[#111] border-r border-[#222]">
        <div className="p-4 border-b border-[#222] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Roles</h2>
          <button
            onClick={() => { setIsCreating(true); setSelectedRoleId(null); }}
            className="flex items-center gap-1 text-xs bg-[#3B82F6] hover:bg-[#2563EB] text-white px-2.5 py-1.5 rounded-lg transition-colors"
          >
            <Plus className="w-3 h-3" />
            Nuevo
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-24 text-[#555]">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
          ) : (
            roles.map((role) => {
              const isSelected = role.id === selectedRoleId && !isCreating;
              const count = userCountByRole[role.id] ?? 0;

              return (
                <button
                  key={role.id}
                  onClick={() => { setSelectedRoleId(role.id); setIsCreating(false); }}
                  className={`w-full text-left px-4 py-3 border-b border-[#1a1a1a] transition-colors ${
                    isSelected
                      ? 'bg-[#1e2a3a] border-l-2 border-l-[#3B82F6]'
                      : 'hover:bg-[#161616] border-l-2 border-l-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ background: role.color }}
                    />
                    <span className="text-sm text-white font-medium truncate">{role.nombre}</span>
                  </div>
                  <div className="text-[11px] text-[#555] pl-5">
                    {count} usuario{count !== 1 ? 's' : ''}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ── Panel derecho: editor de rol ───────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#0D0D0D]">
        {!selectedRole && !isCreating ? (
          <div className="flex items-center justify-center h-full text-[#555] text-sm select-none flex-col gap-2">
            <span className="text-3xl">🏷️</span>
            Selecciona un rol para editar
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-6 pt-5 pb-4 border-b border-[#222] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full" style={{ background: color }} />
                <div>
                  <h3 className="text-white font-semibold text-base">
                    {isCreating ? 'Nuevo Rol' : selectedRole?.nombre}
                  </h3>
                  {isSystemRole && (
                    <p className="text-[11px] text-[#555] mt-0.5">Rol del sistema</p>
                  )}
                </div>
              </div>
              {isCreating && (
                <button
                  onClick={() => setIsCreating(false)}
                  className="text-[#555] hover:text-white text-sm"
                >
                  ✕ Cancelar
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="p-6">
                {/* Datos del rol */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-xs font-medium text-[#999] mb-1.5">Nombre del rol</label>
                    <input
                      type="text"
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      className="w-full bg-[#1A1A1A] text-white text-sm px-3 py-2 rounded-lg border border-[#333] focus:outline-none focus:border-[#3B82F6]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#999] mb-1.5">Color del badge</label>
                    <div className="flex gap-2 flex-wrap">
                      {COLOR_PRESETS.map((c) => (
                        <button
                          key={c}
                          onClick={() => setColor(c)}
                          className={`w-6 h-6 rounded-full transition-transform ${
                            color === c ? 'scale-125 ring-2 ring-white ring-offset-1 ring-offset-[#0D0D0D]' : ''
                          }`}
                          style={{ background: c }}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-[#999] mb-1.5">Descripción</label>
                    <input
                      type="text"
                      value={descripcion}
                      onChange={(e) => setDescripcion(e.target.value)}
                      placeholder="¿Quién tiene este rol?"
                      className="w-full bg-[#1A1A1A] text-white text-sm px-3 py-2 rounded-lg border border-[#333] focus:outline-none focus:border-[#3B82F6]"
                    />
                  </div>
                </div>

                {/* Árbol de permisos */}
                <div className="border border-[#222] rounded-xl p-4 bg-[#0a0a0a]">
                  <p className="text-xs font-semibold text-[#555] uppercase tracking-wider mb-3">
                    Permisos de navegación
                  </p>
                  <NavPermissionsTree
                    activeKeys={activeKeys}
                    onChange={handlePermissionChange}
                  />
                </div>

                {/* Acciones */}
                <div className="flex items-center gap-3 mt-6">
                  <button
                    onClick={handleSave}
                    disabled={isSaving || !nombre.trim()}
                    className="flex items-center gap-2 bg-[#3B82F6] hover:bg-[#2563EB] disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition-colors"
                  >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {isCreating ? 'Crear rol' : 'Guardar cambios'}
                  </button>

                  {!isCreating && selectedRole && !isSystemRole && (
                    <button
                      onClick={handleDelete}
                      className={`flex items-center gap-2 text-sm px-4 py-2 rounded-lg transition-colors ${
                        confirmDelete
                          ? 'bg-[#EF4444] text-white'
                          : 'text-[#EF4444] hover:bg-[#EF444415]'
                      }`}
                    >
                      <Trash2 className="w-4 h-4" />
                      {confirmDelete ? '¿Confirmar?' : 'Eliminar rol'}
                    </button>
                  )}
                  {confirmDelete && (
                    <button onClick={() => setConfirmDelete(false)} className="text-sm text-[#555] hover:text-white">
                      Cancelar
                    </button>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}