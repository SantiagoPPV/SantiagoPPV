/**
 * navigation.ts — Árbol completo de navegación de Moray ERP
 *
 * ÚNICA FUENTE DE VERDAD para:
 *   - Header.tsx         (qué mostrar y cómo estructurarlo)
 *   - usePermissions.ts  (resolver canView por nav_key)
 *   - NavPermissionsTree (árbol visual en Config UI)
 *   - Migrations         (LEGACY_TAB_MAP para convertir CSV viejo)
 *
 * Regla: Si se agrega un módulo nuevo, solo se modifica este archivo.
 * El Header, los permisos y la UI de configuración lo detectan automáticamente.
 */

// ─── Tipos ──────────────────────────────────────────────────────────────────

/**
 * Nivel jerárquico de cada nodo:
 *
 *  'direct'   → Ítem de primer nivel en el Header (Mapa, Muestreos, etc.)
 *  'group'    → Dropdown de primer nivel en el Header (Operación)
 *  'subgroup' → Sub-menú dentro de un grupo (Personal, Plagas, Cosecha, etc.)
 *  'section'  → Ítem dentro del dropdown o sub-menú, tiene ruta propia
 *  'tab'      → Tab interna de una página (no aparece en Header, controla canView dentro de la página)
 */
export type NavLevel = 'direct' | 'group' | 'subgroup' | 'section' | 'tab';

export interface NavNode {
  /** Clave única. Usada en DB (role_nav_permissions, user_nav_overrides). */
  key: string;

  /** Etiqueta visible en UI. */
  label: string;

  /** Ruta del router. Undefined para grupos/subgrupos que no tienen ruta propia. */
  path?: string;

  /** Tipo de nodo — determina cómo se renderiza en Header y en el árbol de Config. */
  level: NavLevel;

  /** Hijos directos (para group, subgroup). */
  children?: NavNode[];

  /**
   * Valor(es) que este nodo tenía en el CSV viejo de la columna `tabs`.
   * Usado exclusivamente por LEGACY_TAB_MAP para la migración (Fase 6).
   * Undefined = no existía en el sistema viejo (nodo nuevo).
   */
  legacyTab?: string | string[];

  /**
   * Emoji o icono corto para la UI de configuración.
   * No se usa en el Header de producción.
   */
  icon?: string;
}

// ─── Árbol de navegación ────────────────────────────────────────────────────

/**
 * NAVIGATION es el árbol canónico. El orden de los nodos refleja el orden
 * visual en el Header y en la UI de configuración.
 *
 * Nodos de nivel 'group' y 'subgroup' NO necesitan permiso propio:
 * aparecen automáticamente si al menos uno de sus hijos tiene canView=true.
 */
export const NAVIGATION: NavNode[] = [
  // ── Directos (primer nivel, sin dropdown) ─────────────────────────────────
  {
    key: 'mapa',
    label: 'Mapa',
    path: '/app/mapa',
    level: 'direct',
    legacyTab: 'Mapa',
    icon: '🗺️',
  },
  {
    key: 'muestreos',
    label: 'Muestreos',
    path: '/app/muestreos',
    level: 'direct',
    legacyTab: 'Muestreos',
    icon: '🔬',
  },
  {
    key: 'reportes',
    label: 'Reportes',
    path: '/app/reportes',
    level: 'direct',
    legacyTab: 'Reportes',
    icon: '📊',
  },
  {
    key: 'finanzas',
    label: 'Finanzas',
    path: '/app/finanzas',
    level: 'direct' as const,
    icon: '💰',
    children: [
      { key: 'finanzas.cuadre',    label: 'Cuadre Diario', level: 'tab' as const },
      { key: 'finanzas.ventas',    label: 'Ventas',        level: 'tab' as const },
      { key: 'finanzas.costos',    label: 'Costos',        level: 'tab' as const },
      { key: 'finanzas.resultados',label: 'Resultados',    level: 'tab' as const },
    ],
  },
  {
    key: 'configuracion',
    label: 'Configuración',
    path: '/app/configuracion',
    level: 'direct',
    legacyTab: 'Configuración',
    icon: '⚙️',
  },

  // ── Grupo: Operación (dropdown) ───────────────────────────────────────────
  {
    key: 'operacion',
    label: 'Operación',
    level: 'group',
    icon: '🌿',
    // Sin legacyTab: el grupo no tenía clave propia, se derivaba de 'Personal'
    children: [

      // Sub-grupo: Gestión de Personal
      {
        key: 'personal',
        label: 'Gestión de Personal',
        level: 'subgroup',
        icon: '👥',
        children: [
          {
            key: 'personal.programa',
            label: 'Programa de Trabajo',
            path: '/app/estrategia/personal',
            level: 'section',
            legacyTab: 'Personal',
          },
          {
            key: 'personal.planeacion',
            label: 'Planeación de Labores',
            path: '/app/estrategia/personal/planeacion',
            level: 'section',
            legacyTab: 'Personal',
          },
        ],
      },

      // Fumigación — módulo completo
      {
        key: 'fumigacion',
        label: 'Fumigación',
        path: '/app/operacion/fumigacion',
        level: 'section',
        legacyTab: 'Personal',
        icon: '🌫️',
        children: [
          { key: 'fumigacion.programa',      label: 'Programa',      level: 'tab' as const },
          { key: 'fumigacion.aplicaciones',  label: 'Aplicaciones',  level: 'tab' as const },
          { key: 'fumigacion.jornada',       label: 'Jornada',       level: 'tab' as const },
          { key: 'fumigacion.catalogo',      label: 'Catálogo',      level: 'tab' as const },
        ],
      },

      // Sub-grupo: Nutrición
      {
        key: 'nutricion',
        label: 'Nutrición',
        level: 'subgroup',
        icon: '💧',
        children: [
          {
            key: 'nutricion.tanques',
            label: 'Tanques de Nutrición',
            path: '/app/operacion/nutricion/tanques',
            level: 'section',
            legacyTab: 'Personal',
          },
        ],
      },

      // Cosecha — entrada única en el header; las subpestañas viven en CosechaLayout
      {
        key: 'cosecha',
        label: 'Cosecha',
        path: '/app/operacion/cosecha',
        level: 'section',
        icon: '🫐',
        legacyTab: 'Personal',
        children: [
          {
            key: 'cosecha.registro',
            label: 'Registro de Cosecha',
            path: '/app/operacion/cosecha/registro',
            level: 'tab',
            legacyTab: 'Personal',
          },
          {
            key: 'cosecha.reportes',
            label: 'Reportes de Cosecha',
            path: '/app/operacion/cosecha/reportes',
            level: 'tab',
            legacyTab: 'Personal',
          },
        ],
      },

      // Secciones directas dentro del dropdown de Operación
      {
        key: 'administracion',
        label: 'Administración',
        path: '/app/administracion',
        level: 'section',
        legacyTab: 'Personal',
        icon: '📋',
      },
      {
        key: 'empaque',
        label: 'Empaque',
        path: '/app/operacion/empaque',
        level: 'section',
        legacyTab: 'Personal',
        icon: '📦',
      },
      {
        key: 'inventario',
        label: 'Inventario General',
        path: '/app/operacion/inventario',
        level: 'section',
        legacyTab: 'Personal',
        icon: '🗃️',
        children: [
          { key: 'inventario.stock',            label: 'Stock',                 level: 'tab' as const },
          { key: 'inventario.historial',         label: 'Historial',             level: 'tab' as const },
          { key: 'inventario.configuracion',     label: 'Configuración',         level: 'tab' as const },
          { key: 'inventario.cat.empaque',       label: 'Materiales de Empaque', level: 'tab' as const, icon: '📦' },
          { key: 'inventario.cat.agroquimicos',  label: 'Agroquímicos',          level: 'tab' as const, icon: '🧪' },
          { key: 'inventario.cat.fertilizantes', label: 'Fertilizantes',         level: 'tab' as const, icon: '🌱' },
          { key: 'inventario.cat.riego',         label: 'Riego',                 level: 'tab' as const, icon: '💧' },
          { key: 'inventario.cat.fumigacion',    label: 'Fumigación',            level: 'tab' as const, icon: '🌫️' },
          { key: 'inventario.cat.herramientas',  label: 'Herramientas y Equipo', level: 'tab' as const, icon: '🔧' },
          { key: 'inventario.cat.combustibles',  label: 'Combustibles',          level: 'tab' as const, icon: '⛽' },
          // Permisos de acceso por rancho — invisibles en Header, controlados en Configuración → Usuarios
          { key: 'inventario.rancho.moray',      label: 'Rancho Moray',          level: 'tab' as const, icon: '🌿' },
          { key: 'inventario.rancho.mojave',     label: 'Rancho Mojave',         level: 'tab' as const, icon: '🌵' },
          { key: 'inventario.rancho.lapena',     label: 'Rancho La Peña',        level: 'tab' as const, icon: '⛰️' },
        ],
      },

      // Exportación: sección + tabs internas
      {
        key: 'exportacion',
        label: 'Exportación',
        path: '/app/operacion/exportacion',
        level: 'section',
        legacyTab: 'Personal',
        icon: '🚀',
        children: [
          {
            key: 'exportacion.dashboard',
            label: 'Dashboard',
            level: 'tab',
            // Sin path: es una tab interna, la ruta es la misma que el padre
          },
          {
            key: 'exportacion.pipeline',
            label: 'Pipeline',
            level: 'tab',
          },
          {
            key: 'exportacion.catalogos',
            label: 'Catálogos',
            level: 'tab',
          },
        ],
      },
    ],
  },
];

// ─── Mapa plano: nav_key → NavNode ───────────────────────────────────────────

/**
 * NAVIGATION_MAP provee lookups O(1) por nav_key.
 * Usado en usePermissions.ts (Fase 3) para resolver permisos sin iterar el árbol.
 *
 * Incluye todos los nodos: directos, grupos, subgrupos, secciones y tabs.
 * Los grupos/subgrupos están aquí por completitud, aunque no tienen permiso propio en DB.
 */
function buildFlatMap(nodes: NavNode[], acc: Record<string, NavNode> = {}): Record<string, NavNode> {
  for (const node of nodes) {
    acc[node.key] = node;
    if (node.children?.length) {
      buildFlatMap(node.children, acc);
    }
  }
  return acc;
}

export const NAVIGATION_MAP: Readonly<Record<string, NavNode>> = buildFlatMap(NAVIGATION);

// ─── Lista de claves controladas por permisos ────────────────────────────────

/**
 * PERMISSIONED_KEYS: todas las nav_keys que tienen un permiso asociado en DB.
 * Excluye grupos y subgrupos (aparecen automáticamente si tienen hijos activos).
 * Usado en:
 *   - Fase 2 (migrations): para insertar filas en role_nav_permissions
 *   - Fase 5 (NavPermissionsTree): para iterar y mostrar toggles en la UI
 */
export const PERMISSIONED_KEYS: readonly string[] = Object.values(NAVIGATION_MAP)
  .filter((n) => n.level !== 'group' && n.level !== 'subgroup')
  .map((n) => n.key);

// ─── Utilidad: hijos permisionables de un nodo ───────────────────────────────

/**
 * Retorna todas las nav_keys permisionables que descienden de un nodo dado.
 * Un grupo/dropdown es visible si getDescendantKeys(groupKey).some(canView).
 * Usado en Fase 4 (Header.tsx) para auto-detectar si mostrar el dropdown de Operación.
 */
export function getDescendantKeys(key: string): string[] {
  const node = NAVIGATION_MAP[key];
  if (!node?.children?.length) return [];
  const keys: string[] = [];
  for (const child of node.children) {
    if (child.level !== 'group' && child.level !== 'subgroup') {
      keys.push(child.key);
    }
    keys.push(...getDescendantKeys(child.key));
  }
  return keys;
}

// ─── Migración legacy (Fase 6) ───────────────────────────────────────────────

/**
 * LEGACY_TAB_MAP: mapea cada valor del CSV viejo de `Users.tabs`
 * a las nav_keys del nuevo sistema.
 *
 * Lógica de migración:
 *   Para cada usuario, toma su campo `tabs` → split(',').trim()
 *   → para cada valor, busca las nav_keys correspondientes
 *   → inserta filas en user_nav_overrides con can_view = true
 *
 * El script SQL de Fase 6 (003_migrate_existing_tabs.sql) usa este mapeo.
 * También se puede usar desde la UI de migración si se necesita.
 */
export const LEGACY_TAB_MAP: Readonly<Record<string, string[]>> = {
  'Mapa': ['mapa'],
  'Muestreos': ['muestreos'],
  'Reportes': ['reportes'],
  'Configuración': ['configuracion'],

  /**
   * 'Personal' era la llave que abría TODO el dropdown de Operación.
   * En el nuevo sistema, se traduce a todos los permisos de Operación.
   * Durante la migración, si un usuario tenía 'Personal', se le asigna
   * el rol 'Supervisor Campo' que incluye todo esto, en lugar de
   * insertar overrides individuales. El script SQL de Fase 6 lo maneja así.
   */
  'Personal': [
    'personal.programa',
    'personal.planeacion',
    'fumigacion',
    'fumigacion.programa',
    'fumigacion.aplicaciones',
    'fumigacion.jornada',
    'fumigacion.catalogo',
    'nutricion.tanques',
    'cosecha.registro',
    'cosecha.reportes',
    'administracion',
    'empaque',
    'inventario',
    'inventario.stock',
    'inventario.historial',
    'inventario.configuracion',
    'inventario.cat.empaque',
    'inventario.cat.agroquimicos',
    'inventario.cat.fertilizantes',
    'inventario.cat.riego',
    'inventario.cat.fumigacion',
    'inventario.cat.herramientas',
    'inventario.cat.combustibles',
    'inventario.rancho.moray',
    'exportacion',
    'exportacion.dashboard',
    'exportacion.pipeline',
    'exportacion.catalogos',
  ],
} as const;

/** Lista de todos los valores legacy conocidos. Para validación en migración. */
export const KNOWN_LEGACY_TABS = Object.keys(LEGACY_TAB_MAP) as ReadonlyArray<string>;