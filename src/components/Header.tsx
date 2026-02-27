/**
 * Header.tsx — Navegación principal (Fase 4)
 *
 * Cambios vs versión anterior:
 *   - Reemplaza allowedTabs.includes() por canView() de usePermissions
 *   - Lee la estructura del menú desde navigation.ts (única fuente de verdad)
 *   - Los grupos (Operación) se muestran automáticamente si algún hijo es visible
 *   - Badge de notificaciones para solicitudes de aprobación pendientes (Fase 7 lo conecta)
 *   - allowedTabs ya no se usa aquí
 *
 * Para agregar un módulo nuevo al Header:
 *   1. Agregar el nodo en src/config/navigation.ts
 *   2. Agregar la ruta en App.tsx
 *   3. Listo — el Header lo detecta automáticamente
 */
import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { usePermissions } from '../hooks/usePermissions';
import { NAVIGATION, getDescendantKeys, type NavNode } from '../config/navigation';
import { supabase } from '../lib/supabaseClient';
import logo from '../assets/Moray-logo-blanco.jpg';

// ─── Tipos internos ───────────────────────────────────────────────────────────

/** Estado de submenús abiertos — clave = nav_key del subgrupo */
type SubMenuState = Record<string, boolean>;

// ─── Componente ───────────────────────────────────────────────────────────────

export default function Header() {
  const { pathname } = useLocation();
  const { logout } = useAuthStore();
  const { canView, canViewAny, isAdmin } = usePermissions();

  const [isOperationOpen, setIsOperationOpen] = useState(false);
  const [subMenus, setSubMenus] = useState<SubMenuState>({});
  const menuRef = useRef<HTMLDivElement>(null);

  // Cerrar todo al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOperationOpen(false);
        setSubMenus({});
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Abrir/cerrar un submenú específico (cierra los demás)
  const toggleSubMenu = (key: string) => {
    setSubMenus((prev) => {
      const isOpen = prev[key];
      // Cerrar todos, luego abrir el que se tocó (si no estaba abierto)
      const next: SubMenuState = {};
      if (!isOpen) next[key] = true;
      return next;
    });
  };

  const closeAll = () => {
    setIsOperationOpen(false);
    setSubMenus({});
  };

  const isActive = (path: string) => {
    if (path === '/app/mapa') return pathname === '/app/mapa' || pathname === '/app';
    if (path === '/app/configuracion') return pathname.startsWith('/app/configuracion');
    return pathname === path || pathname.startsWith(path + '/');
  };

  // ── Renderizar nodo directo (primer nivel, sin dropdown) ──────────────────
  const renderDirectLink = (node: NavNode) => {
    if (!node.path) return null;
    if (!canView(node.key)) return null;

    return (
      <Link
        key={node.key}
        to={node.path}
        className={`text-lg transition-colors ${
          isActive(node.path)
            ? 'text-white font-medium'
            : 'text-[#A3A3A3] hover:text-white'
        }`}
      >
        {node.label}
      </Link>
    );
  };

  // ── Renderizar sección dentro del dropdown ────────────────────────────────
  const renderSection = (node: NavNode) => {
    if (!node.path) return null;
    if (!canView(node.key)) return null;

    const active = isActive(node.path);

    // Exportación tiene estilo especial
    if (node.key === 'exportacion') {
      return (
        <div key={node.key} className="border-t border-[#333] mt-2 pt-2">
          <Link
            to={node.path}
            onClick={closeAll}
            className={`flex items-center gap-2 px-4 py-2 hover:bg-[#2A2A2A] rounded-md font-medium ${
              active ? 'bg-[#00c9a715] text-[#00c9a7]' : 'text-[#00c9a7]'
            }`}
          >
            {node.icon} {node.label}
          </Link>
        </div>
      );
    }

    return (
      <Link
        key={node.key}
        to={node.path}
        onClick={closeAll}
        className={`block px-4 py-2 hover:bg-[#2A2A2A] rounded-md mt-1 ${
          active ? 'bg-[#2A2A2A] text-white' : ''
        }`}
      >
        {node.label}
      </Link>
    );
  };

  // ── Renderizar subgrupo (con sub-menú lateral) ────────────────────────────
  const renderSubGroup = (node: NavNode) => {
    if (!node.children?.length) return null;

    // Obtener solo las secciones visibles de este subgrupo
    const visibleChildren = node.children.filter(
      (child) => child.path && canView(child.key)
    );
    if (!visibleChildren.length) return null;

    const isOpen = subMenus[node.key] ?? false;

    return (
      <div key={node.key} className="relative group mb-1">
        <button
          onClick={() => toggleSubMenu(node.key)}
          className="w-full flex justify-between items-center px-4 py-2 hover:bg-[#2A2A2A] rounded-md"
        >
          {node.label}
          <span className="ml-2">{isOpen ? '▾' : '▸'}</span>
        </button>

        {isOpen && (
          <div className="absolute right-full top-0 mr-2 w-64 bg-[#1A1A1A] border border-[#333] rounded-xl shadow-lg z-50 p-2 animate-fadeInLeft">
            {visibleChildren.map((child) => (
              <Link
                key={child.key}
                to={child.path!}
                onClick={closeAll}
                className="block px-4 py-2 hover:bg-[#2A2A2A] rounded-md"
              >
                {child.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  };

  // ── Renderizar grupo Operación (dropdown principal) ───────────────────────
  const renderOperacionGroup = (node: NavNode) => {
    if (!node.children?.length) return null;

    // El grupo se muestra si el usuario puede ver al menos un descendiente
    const descendantKeys = getDescendantKeys(node.key);
    if (!canViewAny(descendantKeys)) return null;

    // Detectar si alguna ruta activa está dentro de Operación
    const isOperationActive =
      isOperationOpen ||
      pathname.startsWith('/app/operacion') ||
      pathname.startsWith('/app/estrategia') ||
      pathname.startsWith('/app/administracion');

    return (
      <div className="relative" ref={menuRef} key={node.key}>
        <button
          onClick={() => setIsOperationOpen((prev) => !prev)}
          className={`text-lg transition-colors ${
            isOperationActive ? 'text-white font-medium' : 'text-[#A3A3A3] hover:text-white'
          }`}
        >
          {node.label}
        </button>

        {isOperationOpen && (
          <div className="absolute right-0 mt-2 w-64 bg-[#1A1A1A] border border-[#333] rounded-xl shadow-lg z-50 p-2">
            {node.children.map((child) => {
              if (child.level === 'subgroup') return renderSubGroup(child);
              if (child.level === 'section')  return renderSection(child);
              return null;
            })}
          </div>
        )}
      </div>
    );
  };

  // ─── Render principal ───────────────────────────────────────────────────────
  return (
    <header className="bg-[#0D0D0D] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">

          {/* Logo */}
          <div className="flex items-center">
            <Link to="/" className="flex items-center">
              <img
                src={logo}
                alt="Agrícola Moray"
                className="h-10 w-auto object-contain"
                loading="lazy"
              />
            </Link>
          </div>

          {/* Navegación */}
          <nav className="flex items-center space-x-8">
            {NAVIGATION.map((node) => {
              if (node.level === 'direct')  return renderDirectLink(node);
              if (node.level === 'group')   return renderOperacionGroup(node);
              return null;
            })}

            {/* Badge de solicitudes pendientes — Fase 7 conecta el contador real */}
            {isAdmin && <PendingApprovalsBadge />}

            <button
              onClick={logout}
              className="ml-6 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
            >
              Cerrar sesión
            </button>
          </nav>
        </div>
      </div>

      <style>{`
        @keyframes fadeInLeft {
          from { opacity: 0; transform: translateX(-10px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .animate-fadeInLeft { animation: fadeInLeft 0.2s ease-out; }
      `}</style>
    </header>
  );
}

// ─── Badge de aprobaciones pendientes ─────────────────────────────────────────
/**
 * Hace una query COUNT ligera cada 30s para mantener el badge actualizado.
 * No usa useApprovals para no cargar el payload completo en cada página.
 * Solo visible para admins (controlado por el Header).
 */
function PendingApprovalsBadge() {
  const [count, setCount] = React.useState(0);
  const { user } = useAuthStore();

  React.useEffect(() => {
    if (!user?.is_admin) return;

    const fetchCount = async () => {
      const { count: n } = await supabase
        .from('approval_requests')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending');
      setCount(n ?? 0);
    };

    fetchCount();
    const interval = setInterval(fetchCount, 30_000);
    return () => clearInterval(interval);
  }, [user?.is_admin]);

  if (count === 0) return null;

  return (
    <Link
      to="/app/configuracion/solicitudes"
      className="relative flex items-center justify-center w-8 h-8 rounded-full hover:bg-[#2A2A2A] transition-colors"
      title={`${count} solicitud${count !== 1 ? 'es' : ''} pendiente${count !== 1 ? 's' : ''}`}
    >
      <span className="text-[#A3A3A3] text-lg">🔔</span>
      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
        {count > 9 ? '9+' : count}
      </span>
    </Link>
  );
}