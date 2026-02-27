// ── Tipos de merma ──
export const TIPOS_MERMA = [
  'Insecto / Larva',
  'Picada de pájaro',
  'Pudrición',
  'Deshidratación',
  'Blanda',
  'Rasgada',
  'Fruta roja',
  'Cicatriz',
  'Pedúnculo',
  'Pequeña (<11mm)',
  'Resto floral',
] as const;

export type TipoMerma = (typeof TIPOS_MERMA)[number];

// ── Interfaces ──
export interface SectorConfig {
  id: number;
  sector: string;
  variedad: string;
  tunel_inicio: number;
  tunel_final: number;
  activo: boolean;
}

export const KG_POR_CUBETA = 2.65; // kg estándar por cubeta

export interface CorteEntry {
  uid: string;          // clave temporal para React keys
  sector: string;
  variedad: string;     // auto-completado
  tunelInicio: number | '';
  tunelFinal: number | '';
  cubetas: number | '';          // campo fuente: cubetas cosechadas
  kgCosechados: number | '';     // calculado: cubetas × KG_POR_CUBETA
  observaciones: string;
}

export interface MermaEntry {
  uid: string;
  sector: string;
  totalMermaKg: number | '';
  detalles: Record<TipoMerma, number | ''>; // porcentaje (0-100) de cada tipo
}

export interface CorteDia {
  id: string;
  fecha: string;
  sector: string;
  variedad: string;
  tunel_inicio: number;
  tunel_final: number;
  kg_cosechados: number;
  observaciones: string | null;
  created_at: string;
}

export interface MermaRow {
  id: string;
  corte_id: string | null;
  fecha: string;
  sector: string;
  tipo_merma: TipoMerma;
  kg_merma: number;
}

// ── Helper: generar UID simple ──
let _uid = 0;
export const genUID = () => `_${++_uid}_${Date.now()}`;

// ── Helper: crear entrada de corte vacía ──
export const emptyCorteEntry = (): CorteEntry => ({
  uid: genUID(),
  sector: '',
  variedad: '',
  tunelInicio: '',
  tunelFinal: '',
  cubetas: '',
  kgCosechados: '',
  observaciones: '',
});

// ── Helper: crear entrada de merma vacía ──
export const emptyMermaEntry = (): MermaEntry => ({
  uid: genUID(),
  sector: '',
  totalMermaKg: '',
  detalles: Object.fromEntries(TIPOS_MERMA.map((t) => [t, ''])) as Record<TipoMerma, number | ''>,
});