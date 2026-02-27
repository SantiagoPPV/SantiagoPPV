/**
 * usePermissionsForJSX.js — Wrapper de usePermissions para archivos JSX
 *
 * Exportacion.jsx es un archivo JSX (no TypeScript). Este wrapper permite
 * importar usePermissions sin romper el build por imports de tipos.
 *
 * Fase 8 usa esto así en Exportacion.jsx:
 *
 *   import { usePermissionsForJSX } from '../hooks/usePermissionsForJSX';
 *
 *   // Dentro del componente principal:
 *   const { canView, canExecute, isAdmin } = usePermissionsForJSX();
 *
 *   // Tabs:
 *   {canView('exportacion.dashboard') && <DashboardView ... />}
 *   {canView('exportacion.pipeline')  && <KanbanView ... />}
 *   {canView('exportacion.catalogos') && <CatalogosView ... />}
 *
 *   // NAV array (filtrar ítems del sidebar según permisos):
 *   const NAV = [
 *     { id: 'dashboard', icon: '📊', label: 'Dashboard', navKey: 'exportacion.dashboard' },
 *     { id: 'kanban',    icon: '⬛', label: 'Pipeline',  navKey: 'exportacion.pipeline' },
 *     { id: 'catalogos', icon: '🗂', label: 'Catálogos', navKey: 'exportacion.catalogos' },
 *   ].filter(n => canView(n.navKey));
 *
 *   // Acción sensible (avanzar embarque sin docs):
 *   const result = canExecute('exportacion.kanban.advance_without_docs');
 *   if (result === 'needs_approval') { openApprovalModal(); return; }
 *   // else: ejecutar directo
 */

import { usePermissions } from './usePermissions';

/**
 * Re-exporta usePermissions como función JS pura.
 * Idéntico a usePermissions pero sin imports de tipos TypeScript,
 * lo que permite importarlo en archivos .jsx sin errores de build.
 */
export function usePermissionsForJSX() {
  return usePermissions();
}