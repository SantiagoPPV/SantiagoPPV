/**
 * UserEditor.tsx — Panel derecho de edición de usuario (3 tabs)
 * Fase 5 — Config UI
 *
 * Tab 1 — Identidad:  nombre, email, password reset, rol, activo, is_admin
 * Tab 2 — Permisos:   árbol visual con herencia del rol + overrides individuales
 * Tab 3 — Acciones:   lista de acciones sensibles con estado por rol (read-only, Fase 7 las activa)
 *
 * También maneja el formulario de "Nuevo Usuario" (user === null).
 *
 * Fase 6 — Migración:
 *   Cuando el usuario no tiene role_id, se muestra un banner con sugerencia de rol
 *   basado en su campo `tabs` legacy. Botón "Asignar rol sugerido" dispara la migración.
 */
import React, { useState, useEffect } from 'react';
import { Loader2, Save, Trash2, RotateCcw, AlertTriangle } from 'lucide-react';
import type { AppUser, Role } from './configTypes';
import { useNavOverrides } from './hooks/useNavOverrides';
import { useUsers } from './hooks/useUsers';
import NavPermissionsTree from './NavPermissionsTree';
import { LEGACY_TAB_MAP } from '../../config/navigation';
import { ACTION_LABELS } from './actionLabels';
import toast from 'react-hot-toast';

interface Props {
  user: AppUser | null;       // null = nuevo usuario
  roles: Role[];
  isCreating: boolean;        // true cuando viene de "Nuevo Usuario"
  onSaved: () => void;
  onDeleted: () => void;
  onCancelNew: () => void;
}

type Tab = 'identidad' | 'permisos' | 'acciones';

// ─── Helper Fase 6: sugerir rol según tabs legacy ─────────────────────────────

function suggestRoleFromTabs(tabs: string, roles: Role[]): Role | null {
  if (!tabs) return null;
  const parts = tabs.split(',').map((t) => t.trim());

  if (parts.includes('Personal')) {
    return roles.find((r) => r.nombre === 'Supervisor Campo') ?? null;
  }
  const tabsLower = tabs.toLowerCase();
  if (tabsLower.includes('exportaci')) {
    return roles.find((r) => r.nombre === 'Exportación') ?? null;
  }
  if (tabsLower.includes('cosecha')) {
    return roles.find((r) => r.nombre === 'Cosecha') ?? null;
  }
  if (tabsLower.includes('empaque') || tabsLower.includes('inventario')) {
    return roles.find((r) => r.nombre === 'Empaque') ?? null;
  }
  // Solo Mapa/Reportes → Visor
  if (parts.every((p) => ['Mapa', 'Reportes'].includes(p))) {
    return roles.find((r) => r.nombre === 'Visor') ?? null;
  }
  return null;
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function UserEditor({ user, roles, isCreating, onSaved, onDeleted, onCancelNew }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('identidad');

  // Form state — Identidad
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [roleId, setRoleId] = useState<string>('');
  const [isActive, setIsActive] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { createUser, updateUser, deleteUser } = useUsers();
  const { overrides, roleKeys, effectiveKeys, isLoading: overridesLoading, setOverride, resetToRole } =
    useNavOverrides(user?.id ?? null, user?.role_id ?? null);

  // Sincronizar form cuando cambia el usuario seleccionado
  useEffect(() => {
    if (user) {
      setName(user.name ?? '');
      setEmail(user.email);
      setPassword('');
      setRoleId(user.role_id ?? '');
      setIsActive(user.is_active);
      setIsAdmin(user.is_admin);
    } else if (isCreating) {
      setName('');
      setEmail('');
      setPassword('');
      setRoleId(roles[0]?.id ?? '');
      setIsActive(true);
      setIsAdmin(false);
    }
    setActiveTab('identidad');
    setConfirmDelete(false);
  }, [user?.id, isCreating]);

  // ── Guardar identidad ────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!email) { toast.error('El email es obligatorio'); return; }
    if (isCreating && !password) { toast.error('La contraseña es obligatoria para usuarios nuevos'); return; }

    setIsSaving(true);
    try {
      if (isCreating) {
        await createUser({ email, password, name, role_id: roleId || null });
        onSaved();
      } else if (user) {
        await updateUser(user.id, {
          name: name || null,
          email,
          ...(password ? { password } : {}),
          role_id: roleId || null,
          is_active: isActive,
          is_admin: isAdmin,
        });
        onSaved();
      }
    } finally {
      setIsSaving(false);
    }
  };

  // ── Eliminar ─────────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!user) return;
    if (!confirmDelete) { setConfirmDelete(true); return; }
    await deleteUser(user.id);
    onDeleted();
  };

  // ── Migración Fase 6: asignar rol sugerido ───────────────────────────────────

  const suggestedRole = user && !user.role_id ? suggestRoleFromTabs(user.tabs ?? '', roles) : null;

  const handleApplySuggestedRole = async () => {
    if (!user || !suggestedRole) return;
    setRoleId(suggestedRole.id);
    toast.success(`Rol "${suggestedRole.nombre}" seleccionado. Guarda para confirmar.`);
  };

  // ── Estado vacío ─────────────────────────────────────────────────────────────

  if (!user && !isCreating) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-[#555] select-none">
        <span className="text-4xl mb-3">👥</span>
        <p className="text-sm">Selecciona un usuario para editar</p>
        <p className="text-xs mt-1">o crea uno nuevo</p>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'identidad', label: 'Identidad', icon: '👤' },
    { id: 'permisos',  label: 'Permisos',  icon: '🔑' },
    { id: 'acciones',  label: 'Acciones',  icon: '⚡' },
  ];

  return (
    <div className="flex flex-col h-full bg-[#0D0D0D]">

      {/* Header del editor */}
      <div className="px-6 pt-5 pb-0 border-b border-[#222]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-white font-semibold text-base">
              {isCreating ? 'Nuevo Usuario' : (user?.name ?? user?.email ?? '')}
            </h3>
            {!isCreating && user && (
              <p className="text-[#555] text-xs mt-0.5">{user.email}</p>
            )}
          </div>
          {isCreating && (
            <button onClick={onCancelNew} className="text-[#555] hover:text-white text-sm transition-colors">
              ✕ Cancelar
            </button>
          )}
        </div>

        {/* Tabs */}
        <nav className="flex gap-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-[#3B82F6] text-white'
                  : 'border-transparent text-[#555] hover:text-[#999]'
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
              {/* Badge en tab de permisos si hay overrides */}
              {tab.id === 'permisos' && overrides.length > 0 && (
                <span className="ml-1 text-[10px] bg-[#3B82F620] text-[#3B82F6] px-1.5 py-0.5 rounded-full font-semibold">
                  {overrides.length}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Contenido del tab activo */}
      <div className="flex-1 overflow-y-auto">

        {/* ── Tab 1: Identidad ─────────────────────────────────────────── */}
        {activeTab === 'identidad' && (
          <div className="p-6 space-y-4 max-w-lg">

            {/* Banner de migración Fase 6 */}
            {suggestedRole && (
              <div className="flex items-start gap-3 bg-[#F59E0B10] border border-[#F59E0B30] rounded-lg p-3">
                <AlertTriangle className="w-4 h-4 text-[#F59E0B] flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-[#F59E0B] text-xs font-semibold">Usuario en modo legacy</p>
                  <p className="text-[#999] text-xs mt-0.5">
                    Tabs actuales: <code className="text-[#F59E0B]">{user?.tabs}</code>
                  </p>
                  <p className="text-[#999] text-xs">
                    Rol sugerido: <strong className="text-white">{suggestedRole.nombre}</strong>
                  </p>
                  <button
                    onClick={handleApplySuggestedRole}
                    className="mt-2 text-xs bg-[#F59E0B20] hover:bg-[#F59E0B30] text-[#F59E0B] px-3 py-1 rounded-lg transition-colors"
                  >
                    Asignar rol sugerido
                  </button>
                </div>
              </div>
            )}

            {/* Nombre */}
            <div>
              <label className="block text-xs font-medium text-[#999] mb-1.5">Nombre</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nombre visible"
                className="w-full bg-[#1A1A1A] text-white text-sm px-3 py-2 rounded-lg border border-[#333] focus:outline-none focus:border-[#3B82F6]"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-medium text-[#999] mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#1A1A1A] text-white text-sm px-3 py-2 rounded-lg border border-[#333] focus:outline-none focus:border-[#3B82F6]"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-medium text-[#999] mb-1.5">
                {isCreating ? 'Contraseña' : 'Nueva contraseña (dejar vacío para no cambiar)'}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isCreating ? 'Contraseña' : '••••••••'}
                className="w-full bg-[#1A1A1A] text-white text-sm px-3 py-2 rounded-lg border border-[#333] focus:outline-none focus:border-[#3B82F6]"
              />
            </div>

            {/* Rol */}
            <div>
              <label className="block text-xs font-medium text-[#999] mb-1.5">Rol</label>
              <select
                value={roleId}
                onChange={(e) => setRoleId(e.target.value)}
                className="w-full bg-[#1A1A1A] text-white text-sm px-3 py-2 rounded-lg border border-[#333] focus:outline-none focus:border-[#3B82F6]"
              >
                <option value="">— Sin rol asignado —</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>{r.nombre}</option>
                ))}
              </select>
            </div>

            {/* Toggles */}
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 rounded"
                />
                <span className="text-sm text-white">Usuario activo</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isAdmin}
                  onChange={(e) => setIsAdmin(e.target.checked)}
                  className="w-4 h-4 rounded"
                />
                <span className="text-sm text-white">Administrador</span>
              </label>
            </div>

            {/* Acciones */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 bg-[#3B82F6] hover:bg-[#2563EB] disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition-colors"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {isCreating ? 'Crear usuario' : 'Guardar cambios'}
              </button>

              {!isCreating && user && (
                <button
                  onClick={handleDelete}
                  className={`flex items-center gap-2 text-sm px-4 py-2 rounded-lg transition-colors ${
                    confirmDelete
                      ? 'bg-[#EF4444] text-white'
                      : 'text-[#EF4444] hover:bg-[#EF444415]'
                  }`}
                >
                  <Trash2 className="w-4 h-4" />
                  {confirmDelete ? '¿Confirmar?' : 'Eliminar'}
                </button>
              )}
              {confirmDelete && (
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="text-sm text-[#555] hover:text-white"
                >
                  Cancelar
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Tab 2: Permisos ──────────────────────────────────────────── */}
        {activeTab === 'permisos' && (
          <div className="p-4">
            {isCreating ? (
              <div className="text-[#555] text-sm text-center py-12">
                Guarda el usuario primero para configurar permisos individuales.
                <br />
                Los permisos se heredan del rol seleccionado.
              </div>
            ) : overridesLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-[#555]" />
              </div>
            ) : (
              <>
                {/* Cabecera con rol actual y botón reset */}
                <div className="flex items-center justify-between mb-4 px-1">
                  <div>
                    <p className="text-xs text-[#555]">
                      Rol base:{' '}
                      <span className="text-white font-medium">
                        {roles.find((r) => r.id === user?.role_id)?.nombre ?? 'Sin rol'}
                      </span>
                    </p>
                    {overrides.length > 0 && (
                      <p className="text-xs text-[#555] mt-0.5">
                        {overrides.length} override{overrides.length !== 1 ? 's' : ''} individual
                        {overrides.length !== 1 ? 'es' : ''}
                      </p>
                    )}
                  </div>
                  {overrides.length > 0 && (
                    <button
                      onClick={resetToRole}
                      className="flex items-center gap-1.5 text-xs text-[#F59E0B] hover:text-[#FBBF24] transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Restablecer al rol
                    </button>
                  )}
                </div>

                <NavPermissionsTree
                  activeKeys={effectiveKeys}
                  inheritedKeys={roleKeys}
                  onChange={setOverride}
                />
              </>
            )}
          </div>
        )}

        {/* ── Tab 3: Acciones ──────────────────────────────────────────── */}
        {activeTab === 'acciones' && (
          <div className="p-4">
            <p className="text-xs text-[#555] mb-4 px-1">
              Estado de acciones sensibles según el rol del usuario.
              La configuración de permisos de ejecución por rol se hace en la sección <strong className="text-white">Roles</strong>.
            </p>
            <div className="space-y-1">
              {ACTION_LABELS.map(({ action_key, label, module }) => (
                <div
                  key={action_key}
                  className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-[#111]"
                >
                  <div>
                    <p className="text-sm text-white">{label}</p>
                    <p className="text-[11px] text-[#555] mt-0.5">{module}</p>
                  </div>
                  {isAdmin ? (
                    <span className="text-[11px] text-[#10B981] bg-[#10B98115] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ml-3">
                      ✓ Admin — directo
                    </span>
                  ) : (
                    <span className="text-[11px] text-[#F59E0B] bg-[#F59E0B15] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ml-3">
                      Requiere aprobación
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}