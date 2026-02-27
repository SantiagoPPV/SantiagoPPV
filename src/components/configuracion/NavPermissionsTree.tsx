/**
 * NavPermissionsTree.tsx — Árbol visual de permisos de navegación
 *
 * Componente reutilizable en:
 *   - UserEditor Tab 2 (permisos del usuario con overrides)
 *   - RolesManager (permisos del rol)
 *
 * Props:
 *   activeKeys    — nav_keys que están activadas (checked)
 *   inheritedKeys — subset de activeKeys que vienen del rol (se muestran con 🔒)
 *   onChange      — callback al cambiar un toggle: (nav_key, can_view) => void
 *   readOnly      — si true, no muestra toggles (modo vista)
 */
import React from 'react';
import { NAVIGATION, PERMISSIONED_KEYS, type NavNode } from '../../config/navigation';

interface Props {
  activeKeys: string[];
  inheritedKeys?: string[];   // Claves heredadas del rol (con ícono de candado)
  onChange: (nav_key: string, can_view: boolean) => void;
  readOnly?: boolean;
}

// ─── Toggle ───────────────────────────────────────────────────────────────────

interface ToggleProps {
  nav_key: string;
  label: string;
  icon?: string;
  isActive: boolean;
  isInherited: boolean;
  isOverride: boolean;   // tiene override individual (diferente al rol)
  readOnly: boolean;
  onChange: (nav_key: string, can_view: boolean) => void;
}

function PermissionToggle({
  nav_key, label, icon, isActive, isInherited, isOverride, readOnly, onChange,
}: ToggleProps) {
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-[#1f1f1f] group">
      <div className="flex items-center gap-2 min-w-0">
        {icon && <span className="text-sm flex-shrink-0">{icon}</span>}
        <span className={`text-sm truncate ${isActive ? 'text-white' : 'text-[#666]'}`}>
          {label}
        </span>
        {/* Indicadores de origen */}
        {isInherited && !isOverride && (
          <span className="text-[10px] text-[#555] flex-shrink-0" title="Heredado del rol">
            🔒
          </span>
        )}
        {isOverride && (
          <span
            className={`text-[10px] flex-shrink-0 font-semibold px-1.5 py-0.5 rounded ${
              isActive
                ? 'bg-[#10B98120] text-[#10B981]'
                : 'bg-[#EF444420] text-[#EF4444]'
            }`}
            title="Override individual (sobreescribe el rol)"
          >
            override
          </span>
        )}
      </div>

      {!readOnly && (
        <button
          onClick={() => onChange(nav_key, !isActive)}
          className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ml-3 ${
            isActive ? 'bg-[#3B82F6]' : 'bg-[#333]'
          }`}
          title={isActive ? 'Quitar acceso' : 'Dar acceso'}
        >
          <span
            className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
              isActive ? 'translate-x-4' : 'translate-x-0.5'
            }`}
          />
        </button>
      )}

      {readOnly && (
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ml-3 ${isActive ? 'bg-[#3B82F6]' : 'bg-[#333]'}`} />
      )}
    </div>
  );
}

// ─── Sección colapsable ───────────────────────────────────────────────────────

interface SectionProps {
  title: string;
  icon?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  anyActive?: boolean;
}

function TreeSection({ title, icon, children, defaultOpen = true, anyActive = false }: SectionProps) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div className="mb-1">
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-[#666] hover:text-[#999] transition-colors"
      >
        <span>{open ? '▾' : '▸'}</span>
        {icon && <span>{icon}</span>}
        <span>{title}</span>
        {anyActive && !open && (
          <span className="ml-auto w-2 h-2 rounded-full bg-[#3B82F6]" />
        )}
      </button>
      {open && <div className="pl-2">{children}</div>}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function NavPermissionsTree({ activeKeys, inheritedKeys = [], onChange, readOnly = false }: Props) {
  // Calcular qué claves tienen override (están en activeKeys pero NO en inheritedKeys,
  // O están en inheritedKeys pero fueron desactivadas — es decir: su estado difiere del rol)
  const overrideKeys = PERMISSIONED_KEYS.filter((k) => {
    const isActive   = activeKeys.includes(k);
    const isInherited = inheritedKeys.includes(k);
    return isActive !== isInherited; // Si difieren, hay override
  });

  const makeToggleProps = (node: NavNode): ToggleProps => ({
    nav_key: node.key,
    label: node.label,
    icon: node.icon,
    isActive: activeKeys.includes(node.key),
    isInherited: inheritedKeys.includes(node.key),
    isOverride: overrideKeys.includes(node.key),
    readOnly: readOnly ?? false,
    onChange,
  });

  const renderNode = (node: NavNode): React.ReactNode => {
    if (!PERMISSIONED_KEYS.includes(node.key)) return null;
    return <PermissionToggle key={node.key} {...makeToggleProps(node)} />;
  };

  return (
    <div className="space-y-1">

      {/* ── Páginas directas ─────────────────────────────── */}
      <TreeSection
        title="Acceso directo"
        icon="🧭"
        anyActive={['mapa','muestreos','reportes','configuracion'].some(k => activeKeys.includes(k))}
      >
        {NAVIGATION
          .filter((n) => n.level === 'direct')
          .map(renderNode)}
      </TreeSection>

      {/* ── Operación → cada subgrupo ────────────────────── */}
      {NAVIGATION
        .filter((n) => n.level === 'group')
        .map((group) => (
          group.children?.map((child) => {
            if (child.level === 'subgroup' && child.children?.length) {
              const anyChildActive = child.children.some((c) => activeKeys.includes(c.key));
              return (
                <TreeSection
                  key={child.key}
                  title={child.label}
                  icon={child.icon}
                  defaultOpen={anyChildActive}
                  anyActive={anyChildActive}
                >
                  {child.children.map(renderNode)}
                </TreeSection>
              );
            }

            if (child.level === 'section') {
              // Exportación tiene tabs hijas
              if (child.children?.length) {
                const anyChildActive = [child.key, ...child.children.map((c) => c.key)].some(
                  (k) => activeKeys.includes(k)
                );
                return (
                  <TreeSection
                    key={child.key}
                    title={child.label}
                    icon={child.icon}
                    defaultOpen={anyChildActive}
                    anyActive={anyChildActive}
                  >
                    <PermissionToggle {...makeToggleProps(child)} />
                    <div className="pl-4 border-l border-[#222] ml-3 mt-1">
                      {child.children.map(renderNode)}
                    </div>
                  </TreeSection>
                );
              }
              return <div key={child.key} className="pl-2">{renderNode(child)}</div>;
            }
            return null;
          })
        ))}

      {/* Leyenda */}
      {!readOnly && (
        <div className="mt-4 pt-3 border-t border-[#222] flex flex-wrap gap-3 px-3">
          <span className="flex items-center gap-1.5 text-[11px] text-[#555]">
            <span>🔒</span> Heredado del rol
          </span>
          <span className="flex items-center gap-1.5 text-[11px] text-[#10B981]">
            <span className="bg-[#10B98120] px-1.5 py-0.5 rounded font-semibold text-[10px]">override</span>
            Permiso individual activo
          </span>
          <span className="flex items-center gap-1.5 text-[11px] text-[#EF4444]">
            <span className="bg-[#EF444420] px-1.5 py-0.5 rounded font-semibold text-[10px] text-[#EF4444]">override</span>
            Permiso quitado individualmente
          </span>
        </div>
      )}
    </div>
  );
}