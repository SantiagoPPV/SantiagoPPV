/**
 * fumigacionTypes.ts — Tipos del módulo de Fumigación
 * Agrícola Moray ERP
 */

// ── Catálogos ────────────────────────────────────────────────────────────────

export const VARIEDADES_CONFIG = {
  BILOXI:          { color: '#15803D', sectores: ['1A','1B','1C','1D','1E','2A','2B'] },
  'AZRA 3S Y 5S':  { color: '#7C3AED', sectores: ['3A','3B','3C','5A','5B','5C'] },
  'AZRA 4S':       { color: '#0D9488', sectores: ['4A','4B','4C'] },
  'AZRA 6S Y 7S':  { color: '#DC2626', sectores: ['6A','6B','6C','6D','7A','7B','7C','7D','7E'] },
  GENERAL:         { color: '#4B5563', sectores: [] as string[] },
  MAX:             { color: '#1F2937', sectores: ['2C','2D','2E'] as string[] },
} as const;

export type VariedadKey = keyof typeof VARIEDADES_CONFIG;

export const METODOS_CONFIG = {
  'DRENCH':                { color: '#7C3AED' },
  'FOLIAR':                { color: '#16A34A' },
  'TOMA DOMICILIARIA':     { color: '#0D9488' },
  'INMERSIÓN':             { color: '#92400E' },
  'GENERAL':               { color: '#374151' },
  'PODA':                  { color: '#DC2626' },
  'APORTE ESPECIAL (RIEGO)': { color: '#374151' },
} as const;

export type MetodoKey = keyof typeof METODOS_CONFIG;

export const OBJETIVOS = [
  'Aplicación para trips',
  'Aplicación para botrytis',
  'Aplicación para corinespora',
  'Aplicación para roya',
  'Aplicación para gusano',
  'Aplicación para mayate',
  'Aplicación nutritiva',
  'Aplicación preventiva',
  'Poda',
  'Aporte especial',
  'Herbicida',
  'Otro',
] as const;

export type Objetivo = typeof OBJETIVOS[number];

export const CATEGORIAS_PRODUCTO = [
  'Fungicida', 'Insecticida', 'Bioestimulante', 'Coadyuvante',
  'Biofábrica', 'Herbicida', 'Atrayente', 'AporteEspecial', 'Poda', 'Otro',
] as const;

export type CategoriaProducto = typeof CATEGORIAS_PRODUCTO[number];

export const CATEGORIA_ICONS: Record<string, string> = {
  Fungicida: '🍄', Insecticida: '🐛', Bioestimulante: '🌱',
  Coadyuvante: '⚗️', Biofábrica: '🧫', Herbicida: '🌿',
  Atrayente: '🐝', AporteEspecial: '💧', Poda: '✂️', Otro: '📦',
};

export const CATEGORIA_COLORS: Record<string, string> = {
  Fungicida: '#7C3AED', Insecticida: '#DC2626', Bioestimulante: '#16A34A',
  Coadyuvante: '#0D9488', Biofábrica: '#0284C7', Herbicida: '#92400E',
  Atrayente: '#B45309', AporteEspecial: '#0369A1', Poda: '#374151', Otro: '#4B5563',
};

// Todos los sectores posibles ordenados
export const TODOS_SECTORES = [
  '1A','1B','1C','1D','1E',
  '2A','2B','2C','2D','2E',
  '3A','3B','3C',
  '4A','4B','4C',
  '5A','5B','5C',
  '6A','6B','6C','6D',
  '7A','7B','7C','7D','7E',
];

// ── Entidades DB ──────────────────────────────────────────────────────────────

export interface ProductoMoray {
  id: number;
  Nombre: string;
  categoria: CategoriaProducto;
  unidad: string;
  dosis_ref_200l: number | null;
  costo_unitario: number;
  activo: boolean;
}

export interface FumPrograma {
  id: string;
  almacen_id: string;
  semana: number;
  fecha: string;                // ISO date string
  variedad: string;
  sectores: string[];
  producto_nombre: string;
  dosis_200l: number;
  tambos: number;
  metodo: string;
  objetivo: string | null;
  estatus: 'programada' | 'realizada' | 'pospuesta' | 'cancelada';
  responsable_id: number | null;
  notas: string | null;
  created_by: number | null;
  // Campos de sync con Google Sheets (Fase 2)
  sheets_sync_id: string | null;
  sheets_range: string | null;
  sheets_synced_at: string | null;
  created_at: string;
  updated_at: string;
  // Join del responsable (opcional)
  responsable?: { name: string } | null;
}

/** Fila del programa enriquecida con datos de inventario (calculados en frontend) */
export interface FumProgramaEnriquecida extends FumPrograma {
  total_producto: number;        // dosis_200l * tambos / 1000
  stock_inventario: number;      // desde inventario_items (0 si no vinculado)
  inventario_vinculado: boolean; // true = producto existe en inventario_items
  necesidad: number;             // max(0, total_producto - stock_inventario)
  costo_estimado: number;        // total_producto * costo_unitario
  costo_unitario: number;        // de "Productos Moray"
  unidad_producto: string;       // de "Productos Moray"
  categoria_producto: string;    // de "Productos Moray"
}

export interface FumAplicacion {
  id: string;
  almacen_id: string;
  fecha_inicio: string;
  fecha_fin: string | null;
  variedad: string;
  sectores_programados: string[];
  sectores_completados: string[];
  tambos_programados: number;
  tambos_realizados: number;
  ph_caldo: number | null;
  ce_caldo: number | null;
  clima: string;
  responsable_id: number | null;
  notas: string | null;
  programa_ids: string[] | null;
  chk_aspersoras_lavadas: boolean;
  chk_equipo_guardado: boolean;
  chk_epp_revisado: boolean;
  chk_envases_foto: boolean;
  chk_tambos_llenos: boolean;
  created_at: string;
  // Joins
  responsable?: { name: string } | null;
  productos?: FumAplicacionProd[];
  docs?: FumAplicacionDoc[];
  fumigadores?: FumFumigadorDia[];
}

export interface FumAplicacionProd {
  id: string;
  aplicacion_id: string;
  producto_nombre: string;
  categoria: string | null;
  dosis_200l: number;
  tambos: number;
  total_usado: number;
  metodo: string | null;
  costo_unitario: number;
  costo_total: number;
  es_base: boolean;
}

export interface FumAplicacionDoc {
  id: string;
  aplicacion_id: string;
  tipo: 'video' | 'envases_vacios' | 'foto' | 'otro';
  storage_path: string;
  nombre_archivo: string;
  size_bytes: number | null;
  uploaded_at: string;
  uploaded_by: number | null;
}

export interface FumFumigadorDia {
  id: string;
  aplicacion_id: string;
  personal_id: number;
  fecha: string;
  tambos_realizados: number;
  sectores: string[];
  notas: string | null;
  // Join
  personal?: { Nombre: string; Categoria: string };
}

// ── Personal fumigación ───────────────────────────────────────────────────────

/** Personal Moray filtrado para fumigación (Categoria = 'Fumigación' | 'Labores') */
export interface PersonalFumigacion {
  ID: number;
  Nombre: string;
  Categoria: string;  // 'Fumigación' | 'Labores'
  Estado: string;     // 'Activo' | 'Inactivo'
}

// ── Estado del módulo ─────────────────────────────────────────────────────────

export type FumTab = 'programa' | 'aplicaciones' | 'jornada' | 'catalogo';

export interface AlertaInventario {
  producto_nombre: string;
  necesidad_total: number;
  stock_actual: number;
  deficit: number;
  unidad: string;
  fechas_afectadas: string[];
}

// ── Jornada (checklist diario) ────────────────────────────────────────────────

export interface JornadaItem {
  key: string;
  label: string;
  link?: string;        // texto del enlace a otro módulo
  onlyIfLluvia?: boolean;
}

export interface JornadaFase {
  id: string;
  icon: string;
  label: string;
  items: JornadaItem[];
}

export const JORNADA_FASES: JornadaFase[] = [
  {
    id: 'inicio',
    icon: '🌅',
    label: 'Inicio de Jornada',
    items: [
      { key: 'prog_dia',       label: 'Revisar programa de fumigación del día', link: 'Ver programa →' },
      { key: 'verificar_inv',  label: 'Verificar existencia de productos', link: 'Ver inventario →' },
      { key: 'coord_equipo',   label: 'Convocar y coordinar equipo de fumigación' },
      { key: 'reg_clima',      label: 'Registrar condición climática del día' },
    ],
  },
  {
    id: 'preparacion',
    icon: '🧪',
    label: 'Preparación',
    items: [
      { key: 'epp_completo',   label: 'Supervisión EPP completo en equipo' },
      { key: 'prep_caldo',     label: 'Preparar el caldo en el área de fumigación' },
      { key: 'ph_ce',          label: 'Medir y registrar pH y CE del caldo' },
      { key: 'aportes_toma',   label: 'Coordinar aportes por toma domiciliaria' },
      { key: 'insp_inundacion', label: 'Inspeccionar zonas propensas a inundación', onlyIfLluvia: true },
    ],
  },
  {
    id: 'durante',
    icon: '☀️',
    label: 'Durante el Día',
    items: [
      { key: 'sup_campo',      label: 'Supervisión de fumigación en campo' },
      { key: 'avance_sec',     label: 'Verificar avance de sectores aplicados' },
      { key: 'llena_tambos',   label: 'Coordinar llenado de tambos para mañana' },
      { key: 'rev_inventario', label: 'Revisar inventario de productos', link: 'Ver inventario →' },
    ],
  },
  {
    id: 'cierre',
    icon: '🌙',
    label: 'Cierre del Día',
    items: [
      { key: 'lavar_asper',    label: 'Fumigadores lavaron motoaspersoras con agua y jabón' },
      { key: 'guardar_equipo', label: 'Equipo guardado en cuarto de fumigación' },
      { key: 'epp_final',      label: 'EPP completo y en buen estado' },
      { key: 'fotos_envases',  label: 'Fotos de envases vacíos enviadas (WhatsApp)' },
      { key: 'tambos_llenos',  label: 'Tambos llenos con agua para mañana' },
      { key: 'rev_refacciones',label: 'Revisión de refacciones y equipo de fumigación' },
      { key: 'registrar_aplic',label: 'Registrar aplicación del día en el sistema', link: 'Ir a registrar →' },
    ],
  },
];

// ── Google Sheets (Fase 2) — Estructura de datos esperada ────────────────────

/**
 * Estructura de una fila del Google Sheets del programa de fumigación.
 * Las columnas deben tener exactamente estos nombres en el Sheets.
 * Usado por el servicio de sync en Fase 2.
 */
export interface SheetsProgramaRow {
  // Columnas que se leen del Sheets
  Semana: number;
  Fecha: string;                    // DD/MM/YYYY
  Variedad: string;
  Productos: string;                // nombre del producto
  'Dosis Por 200 litros': number;
  Total: number;                    // calculado en Sheets = dosis * tambos / 1000
  Inventario: number;               // calculado en Sheets (se ignora al importar)
  Necesidad: number;                // calculado en Sheets (se ignora al importar)
  'Metodo Aplicacion': string;
  Tambos: number;
  // Metadata del Sheets
  _rowIndex?: number;               // Índice de fila en el Sheets (para updates)
  _sheetId?: string;                // ID del Google Sheets
}