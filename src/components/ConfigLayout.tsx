/**
 * ConfigLayout.tsx — Shell de configuración con sub-tabs
 * Fase 5 — agrega Roles y Solicitudes
 *
 * Tabs:
 *   - Usuarios          → /app/configuracion/usuarios     (todos los admins)
 *   - Roles             → /app/configuracion/roles        (todos los admins)
 *   - Solicitudes       → /app/configuracion/solicitudes  (solo admin, Fase 7)
 *   - Inventario General → /app/configuracion/inventario-general (existente)
 */
import React from 'react';
import { NavLink, Outlet, Navigate, useLocation } from 'react-router-dom';
import { usePermissions } from '../hooks/usePermissions';

export default function ConfigLayout() {
  const { pathname } = useLocation();
  const { isAdmin } = usePermissions();

  if (pathname === '/app/configuracion') {
    return <Navigate to="/app/configuracion/usuarios" replace />;
  }

  const tabs = [
    { to: '/app/configuracion/usuarios',           label: 'Usuarios',           icon: '👥', adminOnly: false },
    { to: '/app/configuracion/roles',              label: 'Roles',              icon: '🏷️', adminOnly: false },
    { to: '/app/configuracion/solicitudes',        label: 'Solicitudes',        icon: '🔔', adminOnly: true  },
  ].filter((tab) => !tab.adminOnly || isAdmin);

  return (
    <div>
      {/* Sub-tab bar */}
      <div className="border-b border-[#2a2a3e] bg-[#111118]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex gap-0" aria-label="Configuración tabs">
            {tabs.map((tab) => {
              const active = pathname.startsWith(tab.to);
              return (
                <NavLink
                  key={tab.to}
                  to={tab.to}
                  className={`
                    flex items-center gap-2 px-6 py-3 text-sm font-semibold transition-all
                    border-b-[2.5px] whitespace-nowrap
                    ${active
                      ? 'border-blue-500 text-white'
                      : 'border-transparent text-[#666680] hover:text-[#9999b0] hover:border-[#3a3a52]'
                    }
                  `}
                >
                  <span>{tab.icon}</span>
                  {tab.label}
                </NavLink>
              );
            })}
          </nav>
        </div>
      </div>

      <Outlet />
    </div>
  );
}