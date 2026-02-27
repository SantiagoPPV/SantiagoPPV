/**
 * actionLabels.ts — Etiquetas de acciones sensibles para la UI
 *
 * Espeja el catálogo de permission_actions en DB (Migration 002).
 * Usado en UserEditor Tab 3 y en ApprovalQueue para mostrar labels legibles.
 *
 * Si se agrega una acción nueva a la DB, agregarla aquí también.
 */

export interface ActionLabel {
  action_key: string;
  label: string;
  module: string;
}

export const ACTION_LABELS: ActionLabel[] = [
  {
    action_key: 'exportacion.kanban.advance_without_docs',
    label: 'Avanzar embarque sin documentos completos',
    module: 'Exportación — Pipeline',
  },
  {
    action_key: 'exportacion.embarque.delete',
    label: 'Eliminar embarque',
    module: 'Exportación',
  },
  {
    action_key: 'exportacion.embarque.edit',
    label: 'Editar datos de un embarque',
    module: 'Exportación',
  },
  {
    action_key: 'exportacion.catalogos.edit',
    label: 'Editar catálogos (warehouses, contactos)',
    module: 'Exportación — Catálogos',
  },
  {
    action_key: 'cosecha.corte.delete',
    label: 'Eliminar corte de cosecha',
    module: 'Cosecha',
  },
  {
    action_key: 'cosecha.merma.delete',
    label: 'Eliminar registro de merma',
    module: 'Cosecha',
  },
  {
    action_key: 'inventario.ajuste.negativo',
    label: 'Ajuste negativo de inventario',
    module: 'Inventario',
  },
  {
    action_key: 'inventario.item.delete',
    label: 'Eliminar ítem de inventario',
    module: 'Inventario',
  },
  {
    action_key: 'personal.baja',
    label: 'Dar de baja a un trabajador',
    module: 'Personal',
  },
  {
    action_key: 'plagas.aplicacion.delete',
    label: 'Eliminar registro de aplicación',
    module: 'Plagas y Enfermedades',
  },
  {
    action_key: 'usuarios.delete',
    label: 'Eliminar usuario del sistema',
    module: 'Configuración — Usuarios',
  },
];

/** Lookup O(1) por action_key */
export const ACTION_LABELS_MAP: Readonly<Record<string, ActionLabel>> = Object.fromEntries(
  ACTION_LABELS.map((a) => [a.action_key, a])
);