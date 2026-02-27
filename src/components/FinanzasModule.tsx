/**
 * FinanzasModule.tsx — Módulo Financiero Agrícola Moray
 *
 * ─── FASE 1 ──────────────────────────────────────────────────────────
 *   Tab 1 — Cuadre Diario:  solver cosecha vs empaque vs merma
 *   Tab 2 — Ventas:         tabulador FOB, semanas de precio + cobranza
 *
 * ─── FASE 2 ──────────────────────────────────────────────────────────
 *   Cuadre: semana_iso/year_iso → cruce con ventas y costos
 *   Ventas: proyección de ingreso, vencimientos, alertas, flujo de caja
 *   Infraestructura: FinanzasProvider, tipos exportados
 *
 * ─── FASE 3 ──────────────────────────────────────────────────────────
 *   Tab 3 — Costos: CRUD gastos, conversión MXN↔USD, costo/kg, costo/caja
 *
 * ─── FASE 4 (esta versión) ───────────────────────────────────────────
 *   Tab 4 — Resultados: Estado de Resultados completo (4 sub-tabs)
 *     · Resumen:    KPIs ejecutivos + gráfica ingresos vs costos (CSS bars)
 *     · P&L:        waterfall completo con selector de período
 *                   (sem. actual / mes / ult. 4 sem / ult. 12 sem / todo)
 *     · Eficiencia: tabla semanal costo/kg, costo/caja, merma %, margen
 *                   cruzado con cuadres (F1) y ventas (F2)
 *     · Exportar:   descarga CSV con todos los datos del período seleccionado
 *   Integración extra F1→F4: campo merma_pct en cuadre para KPI de rendimiento
 *   Integración extra F2→F4: precio_promedio_real para análisis de precio/caja
 *   Integración extra F3→F4: calcGastosPorSemana + calcGastosPorCategoria
 *
 * ─── TABLAS DB ───────────────────────────────────────────────────────
 *   cuadre_diario            f1 + semana_iso, year_iso
 *   finanzas_semana_precio   f1 + cajas_vendidas, ingresos, vencimiento
 *   finanzas_config          tipo_cambio_mxn, dias_credito, kg_por_cubeta
 *   gastos_operativos        f3 — CRUD completo
 */

import {
  useState, useEffect, useCallback, useMemo,
  createContext, useContext, type ReactNode, type CSSProperties,
} from "react";
import { supabase } from "../lib/supabaseClient";
import toast from "react-hot-toast";

// ═══════════════════════════════════════════════════════════════
// THEME
// ═══════════════════════════════════════════════════════════════
const C = {
  bg: "#0b0b12", surface: "#13131f", card: "#1a1a2a",
  input: "#20202e", inputBorder: "#2e2e44", border: "#252535",
  text: "#eeeef5", textSecondary: "#8888a8", textMuted: "#55556a",
  accent: "#4f6bf6", accentLight: "#7b91f8", accentDim: "rgba(79,107,246,0.14)",
  green: "#34d399", greenDim: "rgba(52,211,153,0.12)", greenBorder: "rgba(52,211,153,0.25)",
  yellow: "#fbbf24", yellowDim: "rgba(251,191,36,0.12)", yellowBorder: "rgba(251,191,36,0.25)",
  red: "#f87171", redDim: "rgba(248,113,113,0.12)", redBorder: "rgba(248,113,113,0.25)",
  orange: "#fb923c", orangeDim: "rgba(251,146,60,0.12)", orangeBorder: "rgba(251,146,60,0.25)",
  purple: "#c084fc", purpleDim: "rgba(192,132,252,0.12)",
};

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════
// IMPORTANTE: las claves deben coincidir EXACTAMENTE con Tipo_embalaje en DB
// Pesos confirmados por Agrícola Moray
const KG_POR_PRESENTACION: Record<string, number> = {
  // Claves exactas de la DB (Muestreos Empaque → Tipo_embalaje)
  "12x18":  6.30,   // TwinRiver / RiverRun main
  "8x18":   4.20,   // RiverRun
  "Jumbo":  3.45,   // Hortifruit / JMB
  "6oz":    1.77,
  "PNT":    3.25,
  // Aliases legacy por si algún registro usa la nomenclatura anterior
  "12x18oz": 6.30,
  "8x18oz":  4.20,
  "JMB":     3.45,
};
const PRESENTACIONES = Object.keys(KG_POR_PRESENTACION);
const CLIENTES = ["TwinRiver", "RiverRun", "Hortifrut", "BerryLovers"];

const DEFAULT_COSTOS = {
  comision_pct: 10, warehousing: 0.28, quality_control: 0.15,
  fees_importacion: 0.60, materiales: 3.00,
  agente_aduanal_us: 0.016, agente_aduanal_mx: 0.0016,
  material_palletizado: 0.006, servicio_frio: 0.214, servicio_flete: 0.049,
};

// Fase 3 — Costos
export const CATEGORIAS_GASTO = [
  "Nómina Cosecha", "Nómina Empaque", "Insumos Campo",
  "Materiales Empaque", "Logística / Exportación", "Overhead",
] as const;
export type CategoriaGasto = typeof CATEGORIAS_GASTO[number];

export const SUBCATEGORIAS: Record<CategoriaGasto, string[]> = {
  "Nómina Cosecha":          ["Personal Permanente", "Personal Eventual", "Prestaciones", "Bonos / Incentivos"],
  "Nómina Empaque":          ["Personal Planta", "Personal Eventual", "Horas Extra", "Prestaciones"],
  "Insumos Campo":           ["Fertilizantes", "Agroquímicos", "Agua / Riego", "Material Vivero", "Otros"],
  "Materiales Empaque":      ["Cajas / Envases", "Bolsas / Film", "Etiquetas", "Pallets", "Consumibles"],
  "Logística / Exportación": ["Flete Nacional", "Flete Internacional", "Maniobras", "Seguros", "Aduanas / Gestión"],
  "Overhead":                ["Renta / Instalaciones", "Servicios Básicos", "Mantenimiento", "Administrativo", "Otros"],
};

// Colores por categoría — usados en Fase 3 y 4
export const CATEGORIA_COLOR: Record<CategoriaGasto, string> = {
  "Nómina Cosecha":          "#34d399",
  "Nómina Empaque":          "#4f6bf6",
  "Insumos Campo":           "#fbbf24",
  "Materiales Empaque":      "#fb923c",
  "Logística / Exportación": "#c084fc",
  "Overhead":                "#f87171",
};

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════
export type SemanaPrecioStatus =
  | "precio_recibido" | "en_transito" | "pendiente_liquidacion"
  | "anticipado" | "liquidado";

export interface SemanaPrecio {
  id?: string;
  semana: number; year: number;
  presentacion: string; cliente: string;
  precio_estimado_min: number; precio_estimado_max: number;
  precio_real: number | null;
  status: SemanaPrecioStatus;
  anticipo_usd: number | null; fecha_pago_real: string | null; notas: string | null;
  // Fase 2
  cajas_vendidas: number | null;
  tipo_cambio_mxn: number | null;
  ingreso_estimado_min_usd: number | null;
  ingreso_estimado_max_usd: number | null;
  ingreso_real_usd: number | null;
  dias_credito: number;
  fecha_vencimiento: string | null;
}

export interface CuadreDiario {
  id?: string; fecha: string;
  semana_iso: number | null; year_iso: number | null;
  kg_cosechados: number; cubetas_totales: number;
  kg_empacados: number; cajas_totales: number; kg_merma: number;
  diferencia: number; factor_ajuste: number;
  status: "pendiente" | "ok" | "alerta" | "critico";
  notas: string | null;
}

export interface GastoOperativo {
  id?: string; fecha: string;
  semana_iso: number; year_iso: number;
  categoria: CategoriaGasto; subcategoria: string | null;
  proveedor: string | null; descripcion: string;
  monto_mxn: number | null; monto_usd: number | null; tipo_cambio: number | null;
  notas: string | null;
}

// ═══════════════════════════════════════════════════════════════
// CONTEXT — puente para Fase 3 y 4
// ═══════════════════════════════════════════════════════════════
interface FinanzasCtxValue {
  semanasPrecio: SemanaPrecio[];
  cuadres: CuadreDiario[];
  gastosOp: GastoOperativo[];
  configMap: Record<string, string>;
  loading: boolean; reload: () => void;
  tipoCambio: number; diasCredito: number;
}
const FinanzasCtx = createContext<FinanzasCtxValue>({
  semanasPrecio: [], cuadres: [], gastosOp: [], configMap: {},
  loading: false, reload: () => {}, tipoCambio: 17.5, diasCredito: 21,
});
function useFinanzas() { return useContext(FinanzasCtx); }

function FinanzasProvider({ children }: { children: ReactNode }) {
  const [semanasPrecio, setSemanasPrecio] = useState<SemanaPrecio[]>([]);
  const [cuadres, setCuadres] = useState<CuadreDiario[]>([]);
  const [gastosOp, setGastosOp] = useState<GastoOperativo[]>([]);
  const [configMap, setConfigMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: sp }, { data: cd }, { data: go }, { data: cfg }] = await Promise.all([
        supabase.from("finanzas_semana_precio").select("*").order("year", { ascending: false }).order("semana", { ascending: false }).limit(200),
        supabase.from("cuadre_diario").select("*").order("fecha", { ascending: false }).limit(100),
        supabase.from("gastos_operativos").select("*").order("fecha", { ascending: false }).limit(500),
        supabase.from("finanzas_config").select("clave,valor"),
      ]);
      if (sp) setSemanasPrecio(sp);
      if (cd) setCuadres(cd);
      if (go) setGastosOp(go);
      if (cfg) setConfigMap(Object.fromEntries(cfg.map((r: any) => [r.clave, r.valor])));
    } catch { /* tablas de fases futuras pueden no existir aún */ }
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  return (
    <FinanzasCtx.Provider value={{
      semanasPrecio, cuadres, gastosOp, configMap, loading, reload,
      tipoCambio: parseFloat(configMap["tipo_cambio_mxn"] ?? "17.5"),
      diasCredito: parseInt(configMap["dias_credito"] ?? "21"),
    }}>
      {children}
    </FinanzasCtx.Provider>
  );
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════
function getMexDate() { return new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" }); }
function getCurrentYear() { return parseInt(getMexDate().slice(0, 4)); }
/** ISO 8601 week number — weeks start Monday, week 1 contains first Thursday */
function getWeekNumber(dateStr: string): number {
  const d = new Date(dateStr + "T12:00:00");
  const utc = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  utc.setUTCDate(utc.getUTCDate() + 4 - (utc.getUTCDay() || 7)); // shift to nearest Thursday
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  return Math.ceil(((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
/** ISO 8601 year — may differ from calendar year in late-Dec / early-Jan */
function getISOYear(dateStr: string): number {
  const d = new Date(dateStr + "T12:00:00");
  const utc = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  utc.setUTCDate(utc.getUTCDate() + 4 - (utc.getUTCDay() || 7));
  return utc.getUTCFullYear();
}
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("en-CA");
}
function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b + "T12:00:00").getTime() - new Date(a + "T12:00:00").getTime()) / 86400000);
}
function fmt2(n: number) { return n.toFixed(2); }
function fmtUSD(n: number) { return `$${n.toFixed(2)}`; }
function fmtKUSD(n: number) { return n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : fmtUSD(n); }
function diffColor(pct: number) {
  if (Math.abs(pct) <= 2) return C.green;
  if (Math.abs(pct) <= 5) return C.yellow;
  return C.red;
}
function calcFechaVencimiento(semana: number, year: number, dias: number): string {
  const jan4 = new Date(year, 0, 4);
  const dow = jan4.getDay() || 7;
  const mon1 = new Date(jan4.getTime() - (dow - 1) * 86400000);
  const monday = new Date(mon1.getTime() + (semana - 1) * 7 * 86400000);
  return addDays(monday.toLocaleDateString("en-CA"), dias);
}

// ═══════════════════════════════════════════════════════════════
// STATUS CONFIG
// ═══════════════════════════════════════════════════════════════
const STATUS_CFG: Record<SemanaPrecioStatus, { label: string; color: string; bg: string; border: string; emoji: string }> = {
  precio_recibido:       { label: "Precio recibido",   color: C.accentLight, bg: C.accentDim,   border: "rgba(123,145,248,0.25)", emoji: "💬" },
  en_transito:           { label: "En tránsito",       color: C.yellow,      bg: C.yellowDim,   border: C.yellowBorder,           emoji: "🚚" },
  pendiente_liquidacion: { label: "Pend. liquidación", color: C.orange,      bg: C.orangeDim,   border: C.orangeBorder,           emoji: "⏳" },
  anticipado:            { label: "Anticipo recibido", color: C.purple,      bg: C.purpleDim,   border: "rgba(192,132,252,0.25)", emoji: "💸" },
  liquidado:             { label: "Liquidado",         color: C.green,       bg: C.greenDim,    border: C.greenBorder,            emoji: "✅" },
};

// ═══════════════════════════════════════════════════════════════
// SHARED UI
// ═══════════════════════════════════════════════════════════════
const Card = ({ children, style = {} }: any) => (
  <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "20px 22px", ...style }}>{children}</div>
);
const StatCard = ({ label, value, sub, color = C.accent, emoji }: any) => (
  <Card>
    <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase" as const, letterSpacing: 0.6, marginBottom: 8 }}>
      {emoji && <span style={{ marginRight: 5 }}>{emoji}</span>}{label}
    </div>
    <div style={{ fontSize: 24, fontWeight: 800, color, fontFamily: "'DM Mono', monospace" }}>{value}</div>
    {sub && <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>{sub}</div>}
  </Card>
);
const Inp = ({ label, value, onChange, type = "number", placeholder = "0", step = "0.01", readOnly = false, note = "" }: any) => (
  <div>
    <div style={{ fontSize: 12, fontWeight: 600, color: C.textSecondary, marginBottom: 4 }}>{label}</div>
    {note && <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 3 }}>{note}</div>}
    <input type={type} value={value} onChange={onChange} step={step} placeholder={placeholder} readOnly={readOnly}
      style={{ width: "100%", padding: "9px 12px", borderRadius: 9, outline: "none", background: readOnly ? C.surface : C.input, border: `1.5px solid ${readOnly ? C.border : C.inputBorder}`, color: readOnly ? C.textSecondary : C.text, fontSize: 13, fontFamily: readOnly ? "'DM Mono', monospace" : "inherit", boxSizing: "border-box" as const }} />
  </div>
);
const Sel = ({ label, value, onChange, options }: any) => (
  <div>
    <div style={{ fontSize: 12, fontWeight: 600, color: C.textSecondary, marginBottom: 4 }}>{label}</div>
    <select value={value} onChange={onChange} style={{ width: "100%", padding: "9px 12px", borderRadius: 9, outline: "none", background: C.input, border: `1.5px solid ${C.inputBorder}`, color: C.text, fontSize: 13 }}>
      {options.map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
);
const Btn = ({ children, onClick, variant = "primary", disabled = false }: any) => {
  const bg = variant === "primary" ? C.accent : variant === "success" ? "#059669" : variant === "danger" ? "#dc2626" : C.surface;
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ padding: "9px 18px", borderRadius: 9, border: `1.5px solid ${disabled ? C.border : bg}`, background: disabled ? C.surface : bg, color: disabled ? C.textMuted : "#fff", fontSize: 13, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.6 : 1 }}>
      {children}
    </button>
  );
};
const Badge = ({ text, color, bg, border }: any) => (
  <span style={{ padding: "3px 9px", borderRadius: 20, background: bg, color, border: `1px solid ${border}`, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" as const }}>{text}</span>
);
const TabBar = ({ tabs, active, onSelect }: any) => (
  <div style={{ display: "flex", gap: 4, background: C.surface, padding: "5px", borderRadius: 12, border: `1px solid ${C.border}`, marginBottom: 24, flexWrap: "wrap" as const }}>
    {tabs.map((t: any) => (
      <button key={t.key} onClick={() => onSelect(t.key)}
        style={{ padding: "7px 16px", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", border: "none", background: active === t.key ? C.accent : "transparent", color: active === t.key ? "#fff" : C.textSecondary }}>
        {t.emoji} {t.label}
      </button>
    ))}
  </div>
);
const MiniBar = ({ value, max, color }: any) => (
  <div style={{ flex: 1, height: 7, background: C.surface, borderRadius: 4, overflow: "hidden" }}>
    <div style={{ width: `${Math.max(2, (value / Math.max(max, 1)) * 100)}%`, height: "100%", background: color, borderRadius: 4, transition: "width .4s" }} />
  </div>
);

// ═══════════════════════════════════════════════════════════════
// TAB 1 — CUADRE DIARIO (Fase 2: semana_iso, enlace a precio)
// ═══════════════════════════════════════════════════════════════
function CuadreDiarioTab() {
  const { semanasPrecio, reload: reloadGlobal } = useFinanzas();
  const [fecha, setFecha] = useState(getMexDate());
  const [cortes, setCortes] = useState<any[]>([]);
  const [empaque, setEmpaque] = useState<any[]>([]);
  const [merma, setMerma] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [notas, setNotas] = useState("");
  const [saving, setSaving] = useState(false);

  const semanaActual = useMemo(() => getWeekNumber(fecha), [fecha]);
  const yearActual = useMemo(() => getISOYear(fecha), [fecha]);
  const semanaVinculada = useMemo(() =>
    semanasPrecio.find(s => s.semana === semanaActual && s.year === yearActual),
    [semanasPrecio, semanaActual, yearActual]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [{ data: c }, { data: e }, { data: m }] = await Promise.all([
      supabase.from("cosecha_corte_dia").select("*").eq("fecha", fecha),
      supabase.from("Muestreos Empaque").select("*").eq("Fecha", fecha),
      supabase.from("Calidad Empaque").select("kg_merma_total,FechaHora").eq("tipo", "merma")
        .gte("FechaHora", fecha + "T00:00:00").lte("FechaHora", fecha + "T23:59:59"),
    ]);
    setCortes(c || []); setEmpaque(e || []); setMerma(m || []);
    setLoading(false);
  }, [fecha]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const kgCosechados = useMemo(() => cortes.reduce((s, c) => s + (Number(c.kg_cosechados) || 0), 0), [cortes]);
  const cubetasTotales = useMemo(() => cortes.reduce((s, c) => s + (Number(c.cubetas_cosechadas) || 0), 0), [cortes]);
  const kgEmpacados = useMemo(() => empaque.reduce((s, e) => s + (Number(e.Cantidad_cajas) || 0) * (KG_POR_PRESENTACION[e.Tipo_embalaje] ?? 0), 0), [empaque]);
  const cajasTotal = useMemo(() => empaque.reduce((s, e) => s + (Number(e.Cantidad_cajas) || 0), 0), [empaque]);
  const kgMerma = useMemo(() => merma.reduce((s, m) => s + (Number(m.kg_merma_total) || 0), 0), [merma]);

  // Desglose de empacado por presentación — clave para auditar el cálculo
  const empaqueDesglose = useMemo(() => {
    const map: Record<string, { cajas: number; kgCaja: number; kgTotal: number; sinFactor: boolean }> = {};
    empaque.forEach(e => {
      const tipo = e.Tipo_embalaje ?? "Sin tipo";
      const cajas = Number(e.Cantidad_cajas) || 0;
      const kgCaja = KG_POR_PRESENTACION[tipo];
      const sinFactor = kgCaja === undefined;
      const kg = cajas * (kgCaja ?? 0);
      if (!map[tipo]) map[tipo] = { cajas: 0, kgCaja: kgCaja ?? 0, kgTotal: 0, sinFactor };
      map[tipo].cajas   += cajas;
      map[tipo].kgTotal += kg;
    });
    return Object.entries(map)
      .map(([tipo, v]) => ({ tipo, ...v }))
      .sort((a, b) => b.kgTotal - a.kgTotal);
  }, [empaque]);
  const kgReal = kgEmpacados + kgMerma;
  const diferencia = kgCosechados - kgReal;
  const factorAjuste = kgCosechados > 0 ? kgReal / kgCosechados : 1;
  const diffPct = kgCosechados > 0 ? (diferencia / kgCosechados) * 100 : 0;
  const semaforo = Math.abs(diffPct) <= 2 ? { t: "OK", e: "✅" } : Math.abs(diffPct) <= 5 ? { t: "Alerta", e: "⚠️" } : { t: "Crítico", e: "🔴" };

  const sectorDistrib = useMemo(() => {
    const map: Record<string, { kg: number; cub: number }> = {};
    cortes.forEach(c => {
      if (!map[c.sector]) map[c.sector] = { kg: 0, cub: 0 };
      map[c.sector].kg += Number(c.kg_cosechados) || 0;
      map[c.sector].cub += Number(c.cubetas_cosechadas) || 0;
    });
    return Object.entries(map).map(([s, v]) => ({ sector: s, kgBruto: v.kg, kgAjustado: v.kg * factorAjuste, cubetas: v.cub })).sort((a, b) => b.kgBruto - a.kgBruto);
  }, [cortes, factorAjuste]);

  const handleSave = async () => {
    if (kgCosechados === 0 && kgEmpacados === 0) { toast.error("Sin datos para esta fecha"); return; }
    setSaving(true);
    try {
      const st = Math.abs(diffPct) <= 2 ? "ok" : Math.abs(diffPct) <= 5 ? "alerta" : "critico";
      const { error } = await supabase.from("cuadre_diario").upsert({
        fecha, semana_iso: semanaActual, year_iso: yearActual,
        kg_cosechados: kgCosechados, cubetas_totales: cubetasTotales,
        kg_empacados: kgEmpacados, cajas_totales: cajasTotal,
        kg_merma: kgMerma, diferencia, factor_ajuste: factorAjuste,
        status: st, notas: notas || null,
      }, { onConflict: "fecha" });
      if (error) throw error;
      toast.success("Cuadre cerrado ✓");
      reloadGlobal();
    } catch (err: any) { toast.error(err.message); }
    setSaving(false);
  };

  const hasDatos = kgCosechados > 0 || kgEmpacados > 0;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 16, marginBottom: 20, flexWrap: "wrap" as const }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase" as const, letterSpacing: 0.5, marginBottom: 5 }}>Fecha</div>
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
            style={{ padding: "9px 14px", borderRadius: 9, background: C.input, border: `1.5px solid ${C.inputBorder}`, color: C.text, fontSize: 13 }} />
        </div>
        <div style={{ padding: "9px 14px", background: C.surface, borderRadius: 9, border: `1px solid ${C.border}`, fontSize: 13, color: C.textSecondary }}>
          📅 Semana <strong style={{ color: C.accentLight }}>{semanaActual}</strong> — {yearActual}
        </div>
        <Btn onClick={fetchData} disabled={loading}>{loading ? "Cargando…" : "🔄 Actualizar"}</Btn>
        {hasDatos && <Btn onClick={handleSave} disabled={saving} variant="success">{saving ? "Guardando…" : "💾 Cerrar Cuadre"}</Btn>}
      </div>

      {/* Enlace a semana de precio — NUEVO Fase 2 */}
      {semanaVinculada && (
        <div style={{ marginBottom: 16, padding: "11px 16px", background: C.accentDim, borderRadius: 10, border: `1px solid ${C.accentLight}33`, display: "flex", alignItems: "center", gap: 10 }}>
          <span>🔗</span>
          <span style={{ fontSize: 13, color: C.accentLight }}>
            Sem. {semanaActual} tiene precio: <strong>{semanaVinculada.cliente} · {semanaVinculada.presentacion}</strong>
            {" "} ${semanaVinculada.precio_estimado_min}–${semanaVinculada.precio_estimado_max} USD/caja
            {" "}
            <Badge text={STATUS_CFG[semanaVinculada.status].emoji + " " + STATUS_CFG[semanaVinculada.status].label} color={STATUS_CFG[semanaVinculada.status].color} bg={STATUS_CFG[semanaVinculada.status].bg} border={STATUS_CFG[semanaVinculada.status].border} />
          </span>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14, marginBottom: 20 }}>
        <StatCard emoji="🌾" label="Cosechado" value={`${fmt2(kgCosechados)} kg`} sub={`${cubetasTotales} cubetas`} color={C.green} />
        <StatCard emoji="📦" label="Empacado" value={`${fmt2(kgEmpacados)} kg`} sub={`${cajasTotal} cajas`} color={C.accentLight} />
        <StatCard emoji="📉" label="Merma" value={`${fmt2(kgMerma)} kg`} sub={`${merma.length} registros`} color={C.orange} />
        <StatCard emoji="⚖️" label="Diferencia" value={`${diferencia >= 0 ? "+" : ""}${fmt2(diferencia)} kg`} sub={`${fmt2(Math.abs(diffPct))}% — ${semaforo.e} ${semaforo.t}`} color={diffColor(diffPct)} />
      </div>

      {hasDatos && (
        <Card style={{ marginBottom: 20, border: `1.5px solid ${diffColor(diffPct)}44` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" as const }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase" as const, letterSpacing: 0.5 }}>Factor Ajuste</div>
              <div style={{ fontSize: 32, fontWeight: 900, color: C.text, fontFamily: "'DM Mono', monospace", marginTop: 4 }}>{factorAjuste.toFixed(4)}</div>
              <div style={{ fontSize: 12, color: C.textMuted }}>kg real / kg cosechado</div>
            </div>
            <div style={{ width: 1, height: 60, background: C.border }} />
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase" as const, letterSpacing: 0.5 }}>Kg Real</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: C.text, fontFamily: "'DM Mono', monospace", marginTop: 4 }}>{fmt2(kgReal)} kg</div>
              <div style={{ fontSize: 12, color: C.textMuted }}>{fmt2(kgEmpacados)} emp + {fmt2(kgMerma)} merma</div>
            </div>
            <div style={{ marginLeft: "auto" }}>
              <div style={{ padding: "14px 20px", borderRadius: 12, background: diffColor(diffPct) + "22", border: `1.5px solid ${diffColor(diffPct)}44`, textAlign: "center" as const }}>
                <div style={{ fontSize: 26 }}>{semaforo.e}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: diffColor(diffPct) }}>{semaforo.t}</div>
              </div>
            </div>
          </div>
          {Math.abs(diffPct) > 2 && (
            <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 8, background: diffColor(diffPct) + "18", fontSize: 13, color: diffColor(diffPct) }}>
              {Math.abs(diffPct) > 10 ? "🔴 Diferencia crítica (>10%) — revisar antes de cerrar" : "⚠️  Diferencia 2–10% — verificar merma de campo o empaque"}
            </div>
          )}
        </Card>
      )}

      {/* ── Desglose del cálculo de empacado ── */}
      {empaqueDesglose.length > 0 && (
        <Card style={{ marginBottom: 20, border: `1px solid ${C.accentLight}33` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>📦 Desglose de Empacado — Cómo se calculan los kg</div>
            <div style={{ fontSize: 13, fontFamily: "'DM Mono', monospace", color: C.green, fontWeight: 700 }}>
              = {fmt2(kgEmpacados)} kg total
            </div>
          </div>
          <div style={{ overflowX: "auto" as const }}>
            <table style={{ width: "100%", borderCollapse: "collapse" as const }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  {["Presentación", "Cajas", "×", "kg / caja", "=", "kg total", "%"].map(h => (
                    <th key={h} style={{ textAlign: h === "×" || h === "=" ? "center" as const : "left" as const, padding: "7px 12px", fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase" as const, letterSpacing: 0.4 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {empaqueDesglose.map(r => {
                  const pctDel = kgEmpacados > 0 ? (r.kgTotal / kgEmpacados) * 100 : 0;
                  return (
                    <tr key={r.tipo} style={{ borderBottom: `1px solid ${C.border}22`, background: r.sinFactor ? C.redDim : "transparent" }}>
                      <td style={{ padding: "10px 12px", fontWeight: 700, color: r.sinFactor ? C.red : C.accentLight }}>
                        {r.tipo}
                        {r.sinFactor && <span style={{ fontSize: 10, color: C.red, marginLeft: 6 }}>⚠️ sin factor</span>}
                      </td>
                      <td style={{ padding: "10px 12px", fontFamily: "'DM Mono', monospace", fontSize: 14, fontWeight: 700, color: C.text }}>{r.cajas}</td>
                      <td style={{ padding: "10px 12px", textAlign: "center" as const, color: C.textMuted }}>×</td>
                      <td style={{ padding: "10px 12px", fontFamily: "'DM Mono', monospace", fontSize: 14, color: r.sinFactor ? C.red : C.yellow, fontWeight: 600 }}>
                        {r.sinFactor ? "—" : `${r.kgCaja.toFixed(2)} kg`}
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "center" as const, color: C.textMuted }}>=</td>
                      <td style={{ padding: "10px 12px", fontFamily: "'DM Mono', monospace", fontSize: 15, fontWeight: 800, color: r.sinFactor ? C.red : C.green }}>
                        {r.sinFactor ? "0.00 kg ⚠️" : `${fmt2(r.kgTotal)} kg`}
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ flex: 1, minWidth: 60, height: 6, background: C.surface, borderRadius: 3, overflow: "hidden" }}>
                            <div style={{ width: `${pctDel}%`, height: "100%", background: C.accentLight, borderRadius: 3 }} />
                          </div>
                          <span style={{ fontSize: 11, color: C.textMuted, minWidth: 32, textAlign: "right" as const }}>{pctDel.toFixed(0)}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: `2px solid ${C.border}`, background: C.surface }}>
                  <td style={{ padding: "10px 12px", fontWeight: 700, color: C.textSecondary }}>TOTAL</td>
                  <td style={{ padding: "10px 12px", fontFamily: "'DM Mono', monospace", fontWeight: 700 }}>{cajasTotal} cajas</td>
                  <td /><td /><td />
                  <td style={{ padding: "10px 12px", fontFamily: "'DM Mono', monospace", fontSize: 16, fontWeight: 900, color: C.green }}>{fmt2(kgEmpacados)} kg</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
          {empaqueDesglose.some(r => r.sinFactor) && (
            <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 8, background: C.redDim, border: `1px solid ${C.redBorder}`, fontSize: 13, color: C.red }}>
              ⚠️ Hay presentaciones sin factor de peso — agregar su clave a <code>KG_POR_PRESENTACION</code> para que se calculen correctamente.
            </div>
          )}
        </Card>
      )}

      {sectorDistrib.length > 0 && (
        <Card style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 14 }}>📊 Distribución por Sector</div>
          <div style={{ overflowX: "auto" as const }}>
            <table style={{ width: "100%", borderCollapse: "collapse" as const }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  {["Sector", "Cubetas", "Kg Bruto", "Factor", "Kg Ajustado", "Δ kg"].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "7px 11px", fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase" as const }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sectorDistrib.map(r => (
                  <tr key={r.sector} style={{ borderBottom: `1px solid ${C.border}22` }}>
                    <td style={{ padding: "9px 11px", fontWeight: 700, color: C.accentLight }}>{r.sector}</td>
                    <td style={{ padding: "9px 11px", fontFamily: "'DM Mono', monospace" }}>{r.cubetas}</td>
                    <td style={{ padding: "9px 11px", fontFamily: "'DM Mono', monospace" }}>{fmt2(r.kgBruto)}</td>
                    <td style={{ padding: "9px 11px", fontFamily: "'DM Mono', monospace", color: C.textSecondary, fontSize: 12 }}>{factorAjuste.toFixed(4)}</td>
                    <td style={{ padding: "9px 11px", fontFamily: "'DM Mono', monospace", fontWeight: 700, color: C.green }}>{fmt2(r.kgAjustado)}</td>
                    <td style={{ padding: "9px 11px", fontFamily: "'DM Mono', monospace", fontSize: 12, color: r.kgAjustado - r.kgBruto < 0 ? C.red : C.textMuted }}>
                      {(r.kgAjustado - r.kgBruto) >= 0 ? "+" : ""}{fmt2(r.kgAjustado - r.kgBruto)}
                    </td>
                  </tr>
                ))}
                <tr style={{ borderTop: `2px solid ${C.border}`, background: C.surface }}>
                  <td style={{ padding: "9px 11px", fontWeight: 700 }}>TOTAL</td>
                  <td style={{ padding: "9px 11px", fontFamily: "'DM Mono', monospace", fontWeight: 700 }}>{cubetasTotales}</td>
                  <td style={{ padding: "9px 11px", fontFamily: "'DM Mono', monospace", fontWeight: 700 }}>{fmt2(kgCosechados)}</td>
                  <td />
                  <td style={{ padding: "9px 11px", fontFamily: "'DM Mono', monospace", fontWeight: 700, color: C.green }}>{fmt2(kgReal)}</td>
                  <td style={{ padding: "9px 11px", fontFamily: "'DM Mono', monospace", fontWeight: 700, color: diffColor(diffPct) }}>{diferencia >= 0 ? "+" : ""}{fmt2(diferencia)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {hasDatos && (
        <Card>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 10 }}>Notas del Cuadre</div>
          <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={3}
            placeholder="Observaciones, justificación de diferencias, incidencias del día…"
            style={{ width: "100%", padding: "10px 14px", borderRadius: 9, background: C.input, border: `1.5px solid ${C.inputBorder}`, color: C.text, fontSize: 13, resize: "vertical", outline: "none", boxSizing: "border-box" as const }} />
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
            <Btn onClick={handleSave} disabled={saving} variant="success">{saving ? "Guardando…" : "💾 Cerrar Cuadre del Día"}</Btn>
          </div>
        </Card>
      )}
      {!hasDatos && !loading && (
        <div style={{ textAlign: "center" as const, padding: "60px 20px", color: C.textMuted }}>Sin datos para el {fecha}</div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 2A — TABULADOR FOB
// ═══════════════════════════════════════════════════════════════
function TabuladorFOB() {
  const [pres, setPres] = useState("12x18oz");
  const [semana, setSemana] = useState(getWeekNumber(getMexDate()));
  const [precioFOB, setPrecioFOB] = useState(70);
  const [kgCaja, setKgCaja] = useState(KG_POR_PRESENTACION["12x18oz"]);
  const [costos, setCostos] = useState({ ...DEFAULT_COSTOS });
  const setCosto = (k: keyof typeof DEFAULT_COSTOS, v: number) => setCostos(p => ({ ...p, [k]: v }));

  const comision = precioFOB * (costos.comision_pct / 100);
  const totalCaja = comision + costos.warehousing + costos.quality_control + costos.fees_importacion + costos.materiales;
  const precioCajaFOB = precioFOB - totalCaja;
  const precioKgFOB = kgCaja > 0 ? precioCajaFOB / kgCaja : 0;
  const totalKg = costos.agente_aduanal_us + costos.agente_aduanal_mx + costos.material_palletizado + costos.servicio_frio + costos.servicio_flete;
  const precioRetornoKg = precioKgFOB - totalKg;
  const precioRetornoCaja = precioRetornoKg * kgCaja;

  const TRow = ({ label, value, highlight = false, sep = false }: any) => (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 14px", background: highlight ? C.accentDim : "transparent", borderTop: sep ? `1px solid ${C.border}` : undefined, borderRadius: highlight ? 7 : 0, marginTop: sep ? 3 : 0 }}>
      <span style={{ fontSize: 13, color: highlight ? C.text : C.textSecondary }}>{label}</span>
      <span style={{ fontSize: highlight ? 14 : 13, fontWeight: highlight ? 700 : 500, color: highlight ? C.accentLight : C.text, fontFamily: "'DM Mono', monospace" }}>{fmtUSD(value)}</span>
    </div>
  );

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start" }}>
      <div style={{ display: "flex", flexDirection: "column" as const, gap: 16 }}>
        <Card>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 14 }}>⚙️ Parámetros Sem. {semana}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Inp label="Semana" type="number" step="1" value={semana} onChange={(e: any) => setSemana(Number(e.target.value))} />
            <Sel label="Presentación" value={pres} onChange={(e: any) => { setPres(e.target.value); setKgCaja(KG_POR_PRESENTACION[e.target.value] ?? 4.08); }} options={PRESENTACIONES.map(p => ({ value: p, label: p }))} />
            <Inp label="Precio FOB Bruto (USD/caja)" value={precioFOB} onChange={(e: any) => setPrecioFOB(Number(e.target.value))} step="0.5" />
            <Inp label="Kg netos / caja" value={kgCaja} onChange={(e: any) => setKgCaja(Number(e.target.value))} />
          </div>
        </Card>
        <Card>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 14 }}>🇺🇸 Deducciones / Caja (USD)</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Inp label={`Comisión (${costos.comision_pct}%)`} value={costos.comision_pct} onChange={(e: any) => setCosto("comision_pct", Number(e.target.value))} step="0.5" />
            <Inp label="Warehousing" value={costos.warehousing} onChange={(e: any) => setCosto("warehousing", Number(e.target.value))} />
            <Inp label="Quality Control" value={costos.quality_control} onChange={(e: any) => setCosto("quality_control", Number(e.target.value))} />
            <Inp label="Fees importación" value={costos.fees_importacion} onChange={(e: any) => setCosto("fees_importacion", Number(e.target.value))} />
            <Inp label="Materiales" value={costos.materiales} onChange={(e: any) => setCosto("materiales", Number(e.target.value))} />
          </div>
        </Card>
        <Card>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 14 }}>🇲🇽 Deducciones / Kg (USD)</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Inp label="Agente Aduanal US" value={costos.agente_aduanal_us} onChange={(e: any) => setCosto("agente_aduanal_us", Number(e.target.value))} />
            <Inp label="Agente Aduanal MX" value={costos.agente_aduanal_mx} onChange={(e: any) => setCosto("agente_aduanal_mx", Number(e.target.value))} />
            <Inp label="Material Paletizado" value={costos.material_palletizado} onChange={(e: any) => setCosto("material_palletizado", Number(e.target.value))} />
            <Inp label="Servicio de Frío" value={costos.servicio_frio} onChange={(e: any) => setCosto("servicio_frio", Number(e.target.value))} />
            <Inp label="Servicio de Flete" value={costos.servicio_flete} onChange={(e: any) => setCosto("servicio_flete", Number(e.target.value))} />
          </div>
        </Card>
      </div>
      <div style={{ position: "sticky" as const, top: 20, display: "flex", flexDirection: "column" as const, gap: 16 }}>
        <Card style={{ border: `1.5px solid ${C.accentDim}` }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 14 }}>📊 Sem. {semana} · {pres}</div>
          <div style={{ background: C.surface, borderRadius: 10, overflow: "hidden", border: `1px solid ${C.border}` }}>
            <div style={{ padding: "6px 14px", background: C.border + "66", fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase" as const }}>Precio base</div>
            <TRow label="Precio FOB Bruto" value={precioFOB} />
            <div style={{ padding: "6px 14px", background: C.border + "66", fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase" as const, marginTop: 3 }}>− Deducciones / caja</div>
            <TRow label={`Comisión (${costos.comision_pct}%)`} value={-comision} />
            <TRow label="Warehousing" value={-costos.warehousing} />
            <TRow label="Quality Control" value={-costos.quality_control} />
            <TRow label="Fees importación" value={-costos.fees_importacion} />
            <TRow label="Materiales" value={-costos.materiales} />
            <TRow label="= Precio Caja FOB" value={precioCajaFOB} highlight sep />
            <TRow label={`= Precio kg FOB ÷ ${kgCaja}kg`} value={precioKgFOB} highlight />
            <div style={{ padding: "6px 14px", background: C.border + "66", fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase" as const, marginTop: 3 }}>− Deducciones / kg</div>
            <TRow label="Agente Aduanal US" value={-costos.agente_aduanal_us} />
            <TRow label="Agente Aduanal MX" value={-costos.agente_aduanal_mx} />
            <TRow label="Material Paletizado" value={-costos.material_palletizado} />
            <TRow label="Servicio de Frío" value={-costos.servicio_frio} />
            <TRow label="Servicio de Flete" value={-costos.servicio_flete} />
          </div>
          <div style={{ marginTop: 16, padding: "18px", background: C.greenDim, borderRadius: 12, border: `2px solid ${C.greenBorder}`, textAlign: "center" as const }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.green, textTransform: "uppercase" as const, letterSpacing: 0.5, marginBottom: 8 }}>💵 Precio Retorno Productor</div>
            <div style={{ fontSize: 36, fontWeight: 900, color: C.green, fontFamily: "'DM Mono', monospace" }}>{fmtUSD(precioRetornoKg)}<span style={{ fontSize: 15, fontWeight: 400, color: C.textMuted }}> /kg</span></div>
            <div style={{ fontSize: 20, fontWeight: 700, color: C.green, marginTop: 4, fontFamily: "'DM Mono', monospace" }}>{fmtUSD(precioRetornoCaja)}<span style={{ fontSize: 13, fontWeight: 400, color: C.textMuted }}> /caja</span></div>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 2B — SEMANAS / COBRANZA (Fase 2: ingreso estimado, vencimiento, alertas)
// ═══════════════════════════════════════════════════════════════
function SemanasCobranza() {
  const { semanasPrecio, reload, diasCredito } = useFinanzas();
  const [showForm, setShowForm] = useState(false);
  const [editRow, setEditRow] = useState<SemanaPrecio | null>(null);
  const hoy = getMexDate();

  const vencidos = semanasPrecio.filter(r => r.status === "pendiente_liquidacion" && r.fecha_vencimiento && daysBetween(r.fecha_vencimiento, hoy) > 0);
  const totalEspMin = semanasPrecio.filter(r => r.status !== "liquidado").reduce((s, r) => s + (r.ingreso_estimado_min_usd ?? 0), 0);
  const totalEspMax = semanasPrecio.filter(r => r.status !== "liquidado").reduce((s, r) => s + (r.ingreso_estimado_max_usd ?? 0), 0);
  const totalLiq = semanasPrecio.filter(r => r.status === "liquidado").reduce((s, r) => s + (r.ingreso_real_usd ?? 0), 0);

  const blank = (): SemanaPrecio => ({
    semana: getWeekNumber(hoy), year: getCurrentYear(), presentacion: "12x18oz", cliente: "TwinRiver",
    precio_estimado_min: 65, precio_estimado_max: 75, precio_real: null,
    status: "precio_recibido", anticipo_usd: null, fecha_pago_real: null, notas: null,
    cajas_vendidas: null, tipo_cambio_mxn: null, ingreso_estimado_min_usd: null,
    ingreso_estimado_max_usd: null, ingreso_real_usd: null,
    dias_credito: diasCredito, fecha_vencimiento: null,
  });

  const handleSave = async (row: SemanaPrecio) => {
    try {
      const cajas = row.cajas_vendidas ?? 0;
      const saved: any = {
        ...row,
        ingreso_estimado_min_usd: cajas ? cajas * row.precio_estimado_min : null,
        ingreso_estimado_max_usd: cajas ? cajas * row.precio_estimado_max : null,
        ingreso_real_usd: cajas && row.precio_real ? cajas * row.precio_real : null,
        fecha_vencimiento: row.fecha_vencimiento ?? calcFechaVencimiento(row.semana, row.year, row.dias_credito ?? diasCredito),
      };
      if (row.id) {
        const { error } = await supabase.from("finanzas_semana_precio").update(saved).eq("id", row.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("finanzas_semana_precio").insert(saved);
        if (error) throw error;
      }
      toast.success(row.id ? "Actualizado ✓" : "Creado ✓");
      setShowForm(false); setEditRow(null); reload();
    } catch (err: any) { toast.error(err.message); }
  };

  if (showForm && editRow) {
    return <SemanaForm row={editRow} onChange={setEditRow} onSave={() => handleSave(editRow)} onCancel={() => { setShowForm(false); setEditRow(null); }} />;
  }

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(175px, 1fr))", gap: 14, marginBottom: 20 }}>
        <StatCard emoji="💰" label="Esperado pendiente" value={`${fmtKUSD(totalEspMin)}–${fmtKUSD(totalEspMax)}`} sub="por liquidar" color={C.accentLight} />
        <StatCard emoji="✅" label="Cobrado confirmado" value={fmtKUSD(totalLiq)} sub="liquidaciones reales" color={C.green} />
        <StatCard emoji="⏳" label="Pendientes" value={semanasPrecio.filter(r => r.status === "pendiente_liquidacion").length} color={C.orange} />
        <StatCard emoji="🔔" label="Vencidos" value={vencidos.length} sub={vencidos.length > 0 ? "Requieren acción" : "Sin vencidos"} color={vencidos.length > 0 ? C.red : C.green} />
      </div>

      {vencidos.length > 0 && (
        <div style={{ marginBottom: 16, padding: "12px 16px", background: C.redDim, borderRadius: 10, border: `1px solid ${C.redBorder}` }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.red, marginBottom: 6 }}>🔔 {vencidos.length} cobro(s) vencido(s) — plazo de crédito superado</div>
          {vencidos.map(r => (
            <div key={r.id} style={{ fontSize: 13, color: C.red, opacity: 0.85 }}>
              · Sem. {r.semana}/{r.year} · {r.cliente} · {r.presentacion} — venció {r.fecha_vencimiento} ({daysBetween(r.fecha_vencimiento!, hoy)} días)
            </div>
          ))}
        </div>
      )}

      {/* Pipeline */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20, overflowX: "auto" as const }}>
        {Object.entries(STATUS_CFG).map(([key, cfg]) => {
          const rows = semanasPrecio.filter(r => r.status === key);
          const monto = rows.reduce((s, r) => s + (r.ingreso_estimado_min_usd ?? 0), 0);
          return (
            <div key={key} style={{ flex: "0 0 auto", minWidth: 140, padding: "12px 14px", background: cfg.bg, border: `1.5px solid ${cfg.border}`, borderRadius: 12, textAlign: "center" as const }}>
              <div style={{ fontSize: 18 }}>{cfg.emoji}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: cfg.color, marginTop: 4 }}>{cfg.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: cfg.color, fontFamily: "'DM Mono', monospace" }}>{rows.length}</div>
              {monto > 0 && <div style={{ fontSize: 11, color: cfg.color, opacity: 0.7 }}>{fmtKUSD(monto)}</div>}
            </div>
          );
        })}
      </div>

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>Registros de Cobranza</div>
          <Btn onClick={() => { setEditRow(blank()); setShowForm(true); }}>+ Nueva Semana</Btn>
        </div>
        {semanasPrecio.length === 0 ? (
          <div style={{ textAlign: "center" as const, padding: 40, color: C.textMuted }}>Sin registros. Presiona "+ Nueva Semana".</div>
        ) : (
          <div style={{ overflowX: "auto" as const }}>
            <table style={{ width: "100%", borderCollapse: "collapse" as const }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  {["Sem.", "Pres.", "Cliente", "Cajas", "Rango USD", "Ing. Estimado", "Precio Real", "Estado", "Venc.", ""].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "7px 10px", fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase" as const, letterSpacing: 0.5 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {semanasPrecio.map(row => {
                  const cfg = STATUS_CFG[row.status];
                  const isVencido = row.fecha_vencimiento && row.status === "pendiente_liquidacion" && daysBetween(row.fecha_vencimiento, hoy) > 0;
                  const diasVence = row.fecha_vencimiento && row.status !== "liquidado" ? daysBetween(hoy, row.fecha_vencimiento) : null;
                  return (
                    <tr key={row.id} style={{ borderBottom: `1px solid ${C.border}22`, cursor: "pointer", background: isVencido ? C.redDim : "transparent" }} onClick={() => { setEditRow({ ...row }); setShowForm(true); }}>
                      <td style={{ padding: "9px 10px", fontWeight: 700, color: C.text }}>{row.semana}<span style={{ fontSize: 10, color: C.textMuted }}>/{row.year}</span></td>
                      <td style={{ padding: "9px 10px", color: C.accentLight, fontSize: 12 }}>{row.presentacion}</td>
                      <td style={{ padding: "9px 10px", color: C.textSecondary, fontSize: 12 }}>{row.cliente}</td>
                      <td style={{ padding: "9px 10px", fontFamily: "'DM Mono', monospace", fontSize: 12 }}>{row.cajas_vendidas ?? <span style={{ color: C.textMuted }}>—</span>}</td>
                      <td style={{ padding: "9px 10px", fontFamily: "'DM Mono', monospace", fontSize: 12 }}>${row.precio_estimado_min}–${row.precio_estimado_max}</td>
                      <td style={{ padding: "9px 10px", fontFamily: "'DM Mono', monospace", fontSize: 12, color: C.accentLight }}>
                        {row.ingreso_estimado_min_usd ? `${fmtKUSD(row.ingreso_estimado_min_usd)}–${fmtKUSD(row.ingreso_estimado_max_usd!)}` : <span style={{ color: C.textMuted }}>—</span>}
                      </td>
                      <td style={{ padding: "9px 10px", fontFamily: "'DM Mono', monospace", fontWeight: 700, color: row.precio_real ? C.green : C.textMuted, fontSize: 12 }}>{row.precio_real ? `$${row.precio_real}` : "—"}</td>
                      <td style={{ padding: "9px 10px" }}><Badge text={`${cfg.emoji} ${cfg.label}`} color={cfg.color} bg={cfg.bg} border={cfg.border} /></td>
                      <td style={{ padding: "9px 10px", fontSize: 11, color: diasVence !== null ? (diasVence < 0 ? C.red : diasVence <= 5 ? C.yellow : C.textMuted) : C.textMuted, fontWeight: diasVence !== null && diasVence <= 5 ? 700 : 400 }}>
                        {diasVence !== null ? (diasVence < 0 ? `+${Math.abs(diasVence)}d vencido` : diasVence === 0 ? "⚠️ Hoy" : `${diasVence}d`) : "—"}
                      </td>
                      <td style={{ padding: "9px 10px", fontSize: 11, color: C.accent }}>Editar</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

// Form edición semana (Fase 2: cajas, tipo cambio, vencimiento)
function SemanaForm({ row, onChange, onSave, onCancel }: any) {
  const { diasCredito: dcGlobal } = useFinanzas();
  const set = (k: keyof SemanaPrecio, v: any) => onChange((p: any) => ({ ...p, [k]: v }));
  const autoVenc = useMemo(() => calcFechaVencimiento(row.semana, row.year, row.dias_credito ?? dcGlobal), [row.semana, row.year, row.dias_credito, dcGlobal]);
  const cajas = row.cajas_vendidas ?? 0;
  const ingresoMin = cajas * row.precio_estimado_min;
  const ingresoMax = cajas * row.precio_estimado_max;
  const ingresoReal = cajas && row.precio_real ? cajas * row.precio_real : null;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <button onClick={onCancel} style={{ background: "none", border: "none", color: C.textSecondary, cursor: "pointer", fontSize: 13 }}>← Volver</button>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: C.text }}>{row.id ? `Editar Sem. ${row.semana}/${row.year}` : "Nueva Semana de Precio"}</h2>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <Card>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 14 }}>Identificación</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Inp label="Semana ISO" type="number" step="1" value={row.semana} onChange={(e: any) => set("semana", Number(e.target.value))} />
            <Inp label="Año" type="number" step="1" value={row.year} onChange={(e: any) => set("year", Number(e.target.value))} />
            <Sel label="Presentación" value={row.presentacion} onChange={(e: any) => set("presentacion", e.target.value)} options={PRESENTACIONES.map(p => ({ value: p, label: p }))} />
            <Sel label="Cliente" value={row.cliente} onChange={(e: any) => set("cliente", e.target.value)} options={CLIENTES.map(c => ({ value: c, label: c }))} />
          </div>
        </Card>
        <Card>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 14 }}>📦 Volumen y Tipo de Cambio</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Inp label="Cajas vendidas" type="number" step="1" value={row.cajas_vendidas ?? ""} onChange={(e: any) => set("cajas_vendidas", e.target.value ? Number(e.target.value) : null)} placeholder="Capturar o dejar vacío" note="Necesario para calcular ingreso estimado" />
            <Inp label="Tipo cambio MXN/USD" value={row.tipo_cambio_mxn ?? ""} onChange={(e: any) => set("tipo_cambio_mxn", e.target.value ? Number(e.target.value) : null)} placeholder="ej. 17.50" note="Para conversión en P&L (Fase 4)" />
          </div>
        </Card>
        <Card>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 14 }}>💬 Precios</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Inp label="Estimado mín (USD/caja)" value={row.precio_estimado_min} onChange={(e: any) => set("precio_estimado_min", Number(e.target.value))} step="0.5" />
            <Inp label="Estimado máx (USD/caja)" value={row.precio_estimado_max} onChange={(e: any) => set("precio_estimado_max", Number(e.target.value))} step="0.5" />
            <Inp label="Precio real (USD/caja)" value={row.precio_real ?? ""} onChange={(e: any) => set("precio_real", e.target.value ? Number(e.target.value) : null)} placeholder="Al liquidar" note="Llenar cuando se recibe la liquidación" />
          </div>
          {cajas > 0 && (
            <div style={{ marginTop: 14, padding: "12px 14px", background: C.accentDim, borderRadius: 9, border: `1px solid ${C.accentLight}33` }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase" as const, letterSpacing: 0.5, marginBottom: 6 }}>Preview Ingreso — {cajas} cajas</div>
              <div style={{ display: "flex", gap: 20 }}>
                <div><div style={{ fontSize: 11, color: C.textMuted }}>Mín</div><div style={{ fontSize: 16, fontWeight: 700, color: C.accentLight, fontFamily: "'DM Mono', monospace" }}>{fmtUSD(ingresoMin)}</div></div>
                <div><div style={{ fontSize: 11, color: C.textMuted }}>Máx</div><div style={{ fontSize: 16, fontWeight: 700, color: C.accentLight, fontFamily: "'DM Mono', monospace" }}>{fmtUSD(ingresoMax)}</div></div>
                {ingresoReal && <div><div style={{ fontSize: 11, color: C.textMuted }}>Real</div><div style={{ fontSize: 16, fontWeight: 700, color: C.green, fontFamily: "'DM Mono', monospace" }}>{fmtUSD(ingresoReal)}</div></div>}
              </div>
            </div>
          )}
        </Card>
        <Card>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 14 }}>💸 Cobro y Vencimiento</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Sel label="Estado" value={row.status} onChange={(e: any) => set("status", e.target.value)} options={Object.entries(STATUS_CFG).map(([k, v]) => ({ value: k, label: `${v.emoji} ${v.label}` }))} />
            <Inp label="Días de crédito" type="number" step="1" value={row.dias_credito ?? dcGlobal} onChange={(e: any) => set("dias_credito", Number(e.target.value))} note="Default global: 21 días" />
            <Inp label="Fecha vencimiento" value={row.fecha_vencimiento ?? autoVenc} onChange={(e: any) => set("fecha_vencimiento", e.target.value)} type="date" note="Auto-calculada o editar manual" />
            <Inp label="Anticipo (USD)" value={row.anticipo_usd ?? ""} onChange={(e: any) => set("anticipo_usd", e.target.value ? Number(e.target.value) : null)} placeholder="Opcional" />
            <Inp label="Fecha pago real" type="date" value={row.fecha_pago_real ?? ""} onChange={(e: any) => set("fecha_pago_real", e.target.value || null)} />
          </div>
        </Card>
        <Card style={{ gridColumn: "1 / -1" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 10 }}>📝 Notas</div>
          <textarea value={row.notas ?? ""} onChange={e => set("notas", e.target.value || null)} rows={3}
            placeholder="Ajustes por calidad, diferencias de precio vs estimado, condiciones especiales…"
            style={{ width: "100%", padding: "10px 14px", borderRadius: 9, background: C.input, border: `1.5px solid ${C.inputBorder}`, color: C.text, fontSize: 13, resize: "vertical", outline: "none", boxSizing: "border-box" as const }} />
        </Card>
      </div>
      <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 20 }}>
        <Btn onClick={onCancel} variant="ghost">Cancelar</Btn>
        <Btn onClick={onSave} variant="success">💾 Guardar</Btn>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 2C — FLUJO DE CAJA (nuevo Fase 2)
// Ventana de 8 semanas: 4 pasadas + actual + 3 futuras
// ═══════════════════════════════════════════════════════════════
function FlujoCaja() {
  const { semanasPrecio, cuadres } = useFinanzas();
  const hoy = getMexDate();
  const cur = getWeekNumber(hoy);
  const curY = getCurrentYear();

  const semanas = useMemo(() => Array.from({ length: 8 }, (_, i) => {
    let w = cur - 4 + i; let y = curY;
    if (w <= 0) { w += 52; y -= 1; }
    if (w > 52) { w -= 52; y += 1; }
    return { semana: w, year: y, isCurrent: i === 4, isFuture: i > 4 };
  }), [cur, curY]);

  const data = useMemo(() => semanas.map(s => {
    const regs = semanasPrecio.filter(r => r.semana === s.semana && r.year === s.year);
    const cuadre = cuadres.find(c => c.semana_iso === s.semana && c.year_iso === s.year);
    const estMin = regs.reduce((sum, r) => sum + (r.ingreso_estimado_min_usd ?? 0), 0);
    const estMax = regs.reduce((sum, r) => sum + (r.ingreso_estimado_max_usd ?? 0), 0);
    const real   = regs.filter(r => r.status === "liquidado").reduce((sum, r) => sum + (r.ingreso_real_usd ?? 0), 0);
    const anticipo = regs.filter(r => r.status === "anticipado").reduce((sum, r) => sum + (r.anticipo_usd ?? 0), 0);
    const cajas = regs.reduce((sum, r) => sum + (r.cajas_vendidas ?? 0), 0);
    const hasVencido = regs.some(r => r.status === "pendiente_liquidacion" && r.fecha_vencimiento && daysBetween(r.fecha_vencimiento, hoy) > 0);
    const mainStatus = regs.length > 0 ? regs[0].status : null;
    return { ...s, regs, cuadre, estMin, estMax, real, anticipo, cajas, hasVencido, mainStatus };
  }), [semanas, semanasPrecio, cuadres, hoy]);

  const maxBar = Math.max(...data.map(s => Math.max(s.estMax, s.real)), 1);
  const totalEsp3 = data.filter(s => s.isFuture || s.isCurrent).reduce((sum, s) => sum + s.estMin, 0);
  const totalCobrado = data.filter(s => !s.isFuture).reduce((sum, s) => sum + s.real, 0);

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 24 }}>
        <StatCard emoji="📅" label="Ventana" value="8 semanas" sub="4 pasadas + actual + 3 futuras" color={C.accentLight} />
        <StatCard emoji="🔮" label="Esperado próx. semanas" value={fmtKUSD(totalEsp3)} sub="precio estimado mín" color={C.yellow} />
        <StatCard emoji="✅" label="Cobrado en ventana" value={fmtKUSD(totalCobrado)} sub="liquidaciones confirmadas" color={C.green} />
      </div>

      <Card style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 20 }}>📊 Flujo de Ingresos — 8 Semanas</div>
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 16 }}>
          {data.map(s => (
            <div key={`${s.semana}-${s.year}`}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ minWidth: 76 }}>
                  <div style={{ fontSize: 13, fontWeight: s.isCurrent ? 800 : 600, color: s.isCurrent ? C.accentLight : C.text }}>Sem. {s.semana}</div>
                  <div style={{ fontSize: 10, color: C.textMuted }}>{s.year}</div>
                </div>
                <div style={{ flex: 1, display: "flex", flexDirection: "column" as const, gap: 4 }}>
                  {s.estMin > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <div style={{ fontSize: 10, color: C.textMuted, minWidth: 42 }}>Est.</div>
                      <div style={{ flex: 1, height: 8, background: C.surface, borderRadius: 4, overflow: "hidden" }}>
                        <div style={{ width: `${(s.estMax / maxBar) * 100}%`, height: "100%", background: C.accentDim, position: "relative" as const, borderRadius: 4 }}>
                          <div style={{ width: `${(s.estMin / s.estMax) * 100}%`, height: "100%", background: C.accent + "66", borderRadius: 4 }} />
                        </div>
                      </div>
                      <span style={{ fontSize: 11, color: C.textSecondary, fontFamily: "'DM Mono', monospace", minWidth: 100, textAlign: "right" as const }}>{fmtKUSD(s.estMin)}–{fmtKUSD(s.estMax)}</span>
                    </div>
                  )}
                  {s.real > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <div style={{ fontSize: 10, color: C.textMuted, minWidth: 42 }}>Real</div>
                      <MiniBar value={s.real} max={maxBar} color={C.green} />
                      <span style={{ fontSize: 11, fontWeight: 700, color: C.green, fontFamily: "'DM Mono', monospace", minWidth: 100, textAlign: "right" as const }}>{fmtKUSD(s.real)} ✓</span>
                    </div>
                  )}
                  {s.anticipo > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <div style={{ fontSize: 10, color: C.textMuted, minWidth: 42 }}>Anticipo</div>
                      <MiniBar value={s.anticipo} max={maxBar} color={C.purple} />
                      <span style={{ fontSize: 11, color: C.purple, fontFamily: "'DM Mono', monospace", minWidth: 100, textAlign: "right" as const }}>{fmtKUSD(s.anticipo)} 💸</span>
                    </div>
                  )}
                  {s.estMin === 0 && s.real === 0 && (
                    <div style={{ fontSize: 12, color: C.textMuted, fontStyle: "italic" }}>Sin registro de precio</div>
                  )}
                </div>
                <div style={{ minWidth: 90, textAlign: "right" as const, display: "flex", flexDirection: "column" as const, alignItems: "flex-end", gap: 3 }}>
                  {s.cajas > 0 && <span style={{ fontSize: 11, color: C.textMuted }}>{s.cajas} cajas</span>}
                  {s.cuadre && <span style={{ fontSize: 10, color: s.cuadre.status === "ok" ? C.green : s.cuadre.status === "alerta" ? C.yellow : C.red }}>⚖️ {s.cuadre.status}</span>}
                  {s.hasVencido && <span style={{ fontSize: 10, color: C.red, fontWeight: 700 }}>🔔 Vencido</span>}
                  {s.isCurrent && <span style={{ fontSize: 10, color: C.accentLight, fontWeight: 700 }}>← Hoy</span>}
                </div>
              </div>
              {s.isCurrent && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "8px 0 0" }}>
                  <div style={{ flex: 1, height: 1, background: C.accentLight + "33" }} />
                  <span style={{ fontSize: 11, color: C.accentLight, fontWeight: 700 }}>▼ PROYECCIÓN</span>
                  <div style={{ flex: 1, height: 1, background: C.accentLight + "33" }} />
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 14 }}>📋 Resumen Semanal</div>
        <div style={{ overflowX: "auto" as const }}>
          <table style={{ width: "100%", borderCollapse: "collapse" as const }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {["Semana", "Cajas", "Est. Mín", "Est. Máx", "Real", "Estado", "Vencimiento", "Cuadre"].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "7px 10px", fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase" as const }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map(s => {
                const cfg = s.mainStatus ? STATUS_CFG[s.mainStatus] : null;
                return (
                  <tr key={`${s.semana}-${s.year}`} style={{ borderBottom: `1px solid ${C.border}22`, background: s.isCurrent ? C.accentDim : "transparent" }}>
                    <td style={{ padding: "9px 10px", fontWeight: 700, color: s.isCurrent ? C.accentLight : C.text }}>
                      Sem. {s.semana}/{s.year}{s.isCurrent && <span style={{ fontSize: 10, marginLeft: 4, color: C.accentLight }}>←</span>}
                    </td>
                    <td style={{ padding: "9px 10px", fontFamily: "'DM Mono', monospace", fontSize: 12 }}>{s.cajas || "—"}</td>
                    <td style={{ padding: "9px 10px", fontFamily: "'DM Mono', monospace", fontSize: 12, color: C.accentLight }}>{s.estMin > 0 ? fmtUSD(s.estMin) : "—"}</td>
                    <td style={{ padding: "9px 10px", fontFamily: "'DM Mono', monospace", fontSize: 12, color: C.accentLight }}>{s.estMax > 0 ? fmtUSD(s.estMax) : "—"}</td>
                    <td style={{ padding: "9px 10px", fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 700, color: s.real > 0 ? C.green : C.textMuted }}>{s.real > 0 ? fmtUSD(s.real) : "—"}</td>
                    <td style={{ padding: "9px 10px" }}>
                      {cfg ? <Badge text={`${cfg.emoji} ${cfg.label}`} color={cfg.color} bg={cfg.bg} border={cfg.border} /> : <span style={{ color: C.textMuted, fontSize: 12 }}>Sin registro</span>}
                    </td>
                    <td style={{ padding: "9px 10px", fontSize: 11, color: s.hasVencido ? C.red : C.textMuted }}>
                      {s.regs[0]?.fecha_vencimiento ?? "—"}{s.hasVencido && " 🔔"}
                    </td>
                    <td style={{ padding: "9px 10px", fontSize: 11 }}>
                      {s.cuadre ? <span style={{ color: s.cuadre.status === "ok" ? C.green : s.cuadre.status === "alerta" ? C.yellow : C.red }}>
                        {s.cuadre.status === "ok" ? "✅" : s.cuadre.status === "alerta" ? "⚠️" : "🔴"} {s.cuadre.status}
                      </span> : <span style={{ color: C.textMuted }}>—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// VENTAS WRAPPER
// ═══════════════════════════════════════════════════════════════
function VentasTab() {
  const [sub, setSub] = useState("tabulador");
  return (
    <div>
      <TabBar
        tabs={[
          { key: "tabulador", emoji: "🧮", label: "Tabulador FOB" },
          { key: "semanas",   emoji: "📅", label: "Semanas / Cobranza" },
          { key: "flujo",     emoji: "📈", label: "Flujo de Caja" },
        ]}
        active={sub} onSelect={setSub}
      />
      {sub === "tabulador" && <TabuladorFOB />}
      {sub === "semanas"   && <SemanasCobranza />}
      {sub === "flujo"     && <FlujoCaja />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// HELPERS DE COSTOS — exportados para Fase 4
// ═══════════════════════════════════════════════════════════════

/** Agrega gastos por semana. Fase 4 llama directo con gastosOp del contexto. */
export function calcGastosPorSemana(
  gastos: GastoOperativo[],
  tipoCambio: number,
): Record<string, { semana: number; year: number; totalMXN: number; totalUSD: number; byCategoria: Record<string, number> }> {
  const map: Record<string, any> = {};
  gastos.forEach(g => {
    const key = `${g.year_iso}-${String(g.semana_iso).padStart(2, "0")}`;
    if (!map[key]) map[key] = { semana: g.semana_iso, year: g.year_iso, totalMXN: 0, totalUSD: 0, byCategoria: {} };
    const mxn = g.monto_mxn ?? (g.monto_usd ?? 0) * (g.tipo_cambio ?? tipoCambio);
    const usd = g.monto_usd ?? (g.monto_mxn ?? 0) / (g.tipo_cambio ?? tipoCambio);
    map[key].totalMXN += mxn;
    map[key].totalUSD += usd;
    map[key].byCategoria[g.categoria] = (map[key].byCategoria[g.categoria] ?? 0) + mxn;
  });
  return map;
}

/** Agrega gastos por categoría. Para gráficas en Fase 4. */
export function calcGastosPorCategoria(
  gastos: GastoOperativo[],
  tipoCambio: number,
): Array<{ categoria: CategoriaGasto; totalMXN: number; totalUSD: number; count: number }> {
  const map: Record<string, any> = {};
  CATEGORIAS_GASTO.forEach(c => { map[c] = { categoria: c, totalMXN: 0, totalUSD: 0, count: 0 }; });
  gastos.forEach(g => {
    const mxn = g.monto_mxn ?? (g.monto_usd ?? 0) * (g.tipo_cambio ?? tipoCambio);
    const usd = g.monto_usd ?? (g.monto_mxn ?? 0) / (g.tipo_cambio ?? tipoCambio);
    if (map[g.categoria]) { map[g.categoria].totalMXN += mxn; map[g.categoria].totalUSD += usd; map[g.categoria].count += 1; }
  });
  return CATEGORIAS_GASTO.map(c => map[c]);
}

// ═══════════════════════════════════════════════════════════════
// HELPERS FASE 4 — P&L, períodos, CSV
// ═══════════════════════════════════════════════════════════════

type PeriodoKey = "semana_actual" | "mes_actual" | "ultimas_4" | "ultimas_12" | "todo";

const PERIODO_LABELS: Record<PeriodoKey, string> = {
  semana_actual: "Esta semana",
  mes_actual:    "Este mes",
  ultimas_4:     "Últimas 4 semanas",
  ultimas_12:    "Últimas 12 semanas",
  todo:          "Toda la temporada",
};

/** Devuelve un string "YYYY-WW" para cada combinación de año+semana */
function semKey(year: number, semana: number) {
  return `${year}-${String(semana).padStart(2, "0")}`;
}

/** Filtra un array de objetos con {semana_iso, year_iso} o {semana, year} por período */
function filtrarPorPeriodo<T extends { semana_iso?: number; year_iso?: number; semana?: number; year?: number; fecha?: string }>(
  items: T[],
  periodo: PeriodoKey,
  hoy: string,
): T[] {
  if (periodo === "todo") return items;
  const curY = parseInt(hoy.slice(0, 4));
  const curM = parseInt(hoy.slice(5, 7));
  const curW = getWeekNumber(hoy);
  return items.filter(item => {
    const y = item.year_iso ?? item.year ?? curY;
    const w = item.semana_iso ?? item.semana ?? curW;
    if (periodo === "semana_actual") return y === curY && w === curW;
    if (periodo === "mes_actual")    return y === curY && parseInt((item.fecha ?? hoy).slice(5, 7)) === curM;
    if (periodo === "ultimas_4")  {
      const sk = semKey(y, w); const lim = semKey(curY, Math.max(1, curW - 3));
      return sk >= lim && sk <= semKey(curY, curW);
    }
    if (periodo === "ultimas_12") {
      const sk = semKey(y, w); const lim = semKey(curY, Math.max(1, curW - 11));
      return sk >= lim && sk <= semKey(curY, curW);
    }
    return true;
  });
}

interface SemanaAgregada {
  key: string; year: number; semana: number;
  // F1 — Producción
  kgCosechados: number; kgEmpacados: number; kgMerma: number;
  cajasEmpaque: number; mermaPct: number; factorConversion: number;
  cuadresCount: number;
  // F2 — Ventas
  cajasVendidas: number; ingEstMin: number; ingEstMax: number; ingReal: number;
  precioPromReal: number | null; precioPromEst: number;
  tieneVentas: boolean;
  // F3 — Costos
  costoMXN: number; costoUSD: number;
  costoNominaMXN: number; costoInsumosMXN: number; costoLogisticaMXN: number;
  // Derivados
  margenUSD: number; margenPct: number | null;
  costoKg: number | null; costoCaja: number | null;
  precioVsCosto: number | null; // precio_real - costo_caja
}

/** Agrega TODAS las fuentes (F1+F2+F3) por semana ISO */
export function calcSemanasAgregadas(
  semanasPrecio: SemanaPrecio[],
  cuadres: CuadreDiario[],
  gastosOp: GastoOperativo[],
  tipoCambio: number,
): SemanaAgregada[] {
  const map: Record<string, SemanaAgregada> = {};

  const ensure = (key: string, y: number, w: number): SemanaAgregada => {
    if (!map[key]) map[key] = {
      key, year: y, semana: w,
      kgCosechados: 0, kgEmpacados: 0, kgMerma: 0, cajasEmpaque: 0,
      mermaPct: 0, factorConversion: 0, cuadresCount: 0,
      cajasVendidas: 0, ingEstMin: 0, ingEstMax: 0, ingReal: 0,
      precioPromReal: null, precioPromEst: 0, tieneVentas: false,
      costoMXN: 0, costoUSD: 0,
      costoNominaMXN: 0, costoInsumosMXN: 0, costoLogisticaMXN: 0,
      margenUSD: 0, margenPct: null, costoKg: null, costoCaja: null, precioVsCosto: null,
    };
    return map[key];
  };

  // F1 — cuadres
  cuadres.forEach(c => {
    if (!c.semana_iso || !c.year_iso) return;
    const s = ensure(semKey(c.year_iso, c.semana_iso), c.year_iso, c.semana_iso);
    s.kgCosechados += c.kg_cosechados;
    s.kgEmpacados  += c.kg_empacados;
    s.kgMerma      += c.kg_merma;
    s.cajasEmpaque += c.cajas_totales;
    s.cuadresCount++;
  });

  // F2 — semanas precio
  semanasPrecio.forEach(r => {
    const s = ensure(semKey(r.year, r.semana), r.year, r.semana);
    s.cajasVendidas += r.cajas_vendidas ?? 0;
    s.ingEstMin     += r.ingreso_estimado_min_usd ?? 0;
    s.ingEstMax     += r.ingreso_estimado_max_usd ?? 0;
    s.ingReal       += r.status === "liquidado" ? (r.ingreso_real_usd ?? 0) : 0;
    s.tieneVentas    = true;
  });

  // F3 — gastos
  gastosOp.forEach(g => {
    const s = ensure(semKey(g.year_iso, g.semana_iso), g.year_iso, g.semana_iso);
    const mxn = g.monto_mxn ?? (g.monto_usd ?? 0) * (g.tipo_cambio ?? tipoCambio);
    const usd = mxn / tipoCambio;
    s.costoMXN += mxn;
    s.costoUSD += usd;
    if (g.categoria === "Nómina Cosecha" || g.categoria === "Nómina Empaque") s.costoNominaMXN += mxn;
    else if (g.categoria === "Insumos Campo" || g.categoria === "Materiales Empaque") s.costoInsumosMXN += mxn;
    else s.costoLogisticaMXN += mxn;
  });

  // Cálculos derivados
  Object.values(map).forEach(s => {
    const kgTotal = s.kgEmpacados + s.kgMerma;
    s.mermaPct = kgTotal > 0 ? (s.kgMerma / kgTotal) * 100 : 0;
    s.factorConversion = s.kgCosechados > 0 ? kgTotal / s.kgCosechados : 0;
    const ingRef = s.ingReal > 0 ? s.ingReal : s.ingEstMin;
    s.margenUSD = ingRef - s.costoUSD;
    s.margenPct = ingRef > 0 ? (s.margenUSD / ingRef) * 100 : null;
    s.costoKg   = s.kgCosechados > 0 ? s.costoMXN / s.kgCosechados : null;
    s.costoCaja = s.cajasVendidas > 0 ? s.costoUSD / s.cajasVendidas : (s.cajasEmpaque > 0 ? s.costoUSD / s.cajasEmpaque : null);
    // precio promedio ponderado real
    const liqRows = semanasPrecio.filter(r => r.semana === s.semana && r.year === s.year && r.status === "liquidado" && r.precio_real);
    if (liqRows.length > 0) {
      const totalCajas = liqRows.reduce((a, r) => a + (r.cajas_vendidas ?? 0), 0);
      s.precioPromReal = totalCajas > 0
        ? liqRows.reduce((a, r) => a + (r.precio_real! * (r.cajas_vendidas ?? 0)), 0) / totalCajas
        : liqRows[0].precio_real!;
    }
    const estRows = semanasPrecio.filter(r => r.semana === s.semana && r.year === s.year);
    if (estRows.length > 0) {
      const totalCajas = estRows.reduce((a, r) => a + (r.cajas_vendidas ?? 0), 0);
      s.precioPromEst = totalCajas > 0
        ? estRows.reduce((a, r) => a + (r.precio_estimado_min * (r.cajas_vendidas ?? 0)), 0) / totalCajas
        : estRows[0].precio_estimado_min;
    }
    if (s.precioPromReal != null && s.costoCaja != null) {
      s.precioVsCosto = s.precioPromReal - s.costoCaja;
    }
  });

  return Object.values(map).sort((a, b) => a.key.localeCompare(b.key));
}

/** Genera y descarga un archivo CSV */
function descargarCSV(rows: SemanaAgregada[], tipoCambio: number, periodo: string) {
  const cols = [
    "Semana", "Año",
    "Kg Cosechados", "Kg Empacados", "Kg Merma", "Merma %", "Cajas Empaque",
    "Cajas Vendidas", "Ingreso Est. Min USD", "Ingreso Est. Max USD", "Ingreso Real USD",
    "Precio Prom. Real USD", "Precio Prom. Est. USD",
    "Costo Total MXN", "Costo Total USD",
    "Costo Nómina MXN", "Costo Insumos MXN", "Costo Logística MXN",
    "Costo/kg MXN", "Costo/caja USD",
    "Margen USD", "Margen %",
    "TC Usado",
  ];
  const lines = [cols.join(",")];
  rows.forEach(s => {
    lines.push([
      s.semana, s.year,
      s.kgCosechados.toFixed(2), s.kgEmpacados.toFixed(2), s.kgMerma.toFixed(2),
      s.mermaPct.toFixed(2), s.cajasEmpaque,
      s.cajasVendidas, s.ingEstMin.toFixed(2), s.ingEstMax.toFixed(2), s.ingReal.toFixed(2),
      s.precioPromReal?.toFixed(2) ?? "", s.precioPromEst.toFixed(2),
      s.costoMXN.toFixed(2), s.costoUSD.toFixed(2),
      s.costoNominaMXN.toFixed(2), s.costoInsumosMXN.toFixed(2), s.costoLogisticaMXN.toFixed(2),
      s.costoKg?.toFixed(2) ?? "", s.costoCaja?.toFixed(2) ?? "",
      s.margenUSD.toFixed(2), s.margenPct?.toFixed(2) ?? "",
      tipoCambio.toFixed(2),
    ].join(","));
  });
  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url;
  a.download = `moray_resultados_${periodo}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

// ── Formulario de gasto ───────────────────────────────────────
function GastoForm({ gasto, onChange, onSave, onCancel, onDelete }: {
  gasto: GastoOperativo;
  onChange: (g: GastoOperativo) => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const { tipoCambio } = useFinanzas();
  const set = (k: keyof GastoOperativo, v: any) => onChange({ ...gasto, [k]: v });

  // Auto-conversión cruzada
  const handleMXN = (v: string) => {
    const mxn = v ? Number(v) : null;
    const tc = gasto.tipo_cambio ?? tipoCambio;
    onChange({ ...gasto, monto_mxn: mxn, monto_usd: mxn != null ? parseFloat((mxn / tc).toFixed(4)) : null });
  };
  const handleUSD = (v: string) => {
    const usd = v ? Number(v) : null;
    const tc = gasto.tipo_cambio ?? tipoCambio;
    onChange({ ...gasto, monto_usd: usd, monto_mxn: usd != null ? parseFloat((usd * tc).toFixed(2)) : null });
  };
  const handleTC = (v: string) => {
    const tc = v ? Number(v) : tipoCambio;
    const usd = gasto.monto_usd;
    onChange({ ...gasto, tipo_cambio: tc, monto_mxn: usd != null ? parseFloat((usd * tc).toFixed(2)) : gasto.monto_mxn });
  };

  const subcats = SUBCATEGORIAS[gasto.categoria] ?? [];
  const isEdit = !!gasto.id;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <button onClick={onCancel} style={{ background: "none", border: "none", color: C.textSecondary, cursor: "pointer", fontSize: 13 }}>← Volver</button>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: C.text }}>{isEdit ? "Editar Gasto" : "Nuevo Gasto"}</h2>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Identificación */}
        <Card>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 14 }}>📅 Cuándo y Qué</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Inp label="Fecha" type="date" value={gasto.fecha} onChange={(e: any) => {
              const f = e.target.value;
              onChange({ ...gasto, fecha: f, semana_iso: getWeekNumber(f), year_iso: getISOYear(f) });
            }} step="1" />
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.textSecondary, marginBottom: 4 }}>Semana (auto)</div>
              <div style={{ padding: "9px 12px", borderRadius: 9, background: C.surface, border: `1.5px solid ${C.border}`, fontSize: 13, fontFamily: "'DM Mono', monospace", color: C.textSecondary }}>
                Sem. {gasto.semana_iso} / {gasto.year_iso}
              </div>
            </div>
            <Sel label="Categoría" value={gasto.categoria}
              onChange={(e: any) => onChange({ ...gasto, categoria: e.target.value as CategoriaGasto, subcategoria: null })}
              options={CATEGORIAS_GASTO.map(c => ({ value: c, label: c }))} />
            <Sel label="Subcategoría" value={gasto.subcategoria ?? ""}
              onChange={(e: any) => set("subcategoria", e.target.value || null)}
              options={[{ value: "", label: "— General —" }, ...subcats.map(s => ({ value: s, label: s }))]} />
          </div>
          <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
            <Inp label="Descripción" type="text" value={gasto.descripcion} step="1" placeholder="Concepto del gasto…"
              onChange={(e: any) => set("descripcion", e.target.value)} />
            <Inp label="Proveedor / Pagado a" type="text" value={gasto.proveedor ?? ""} step="1" placeholder="Nombre proveedor (opcional)"
              onChange={(e: any) => set("proveedor", e.target.value || null)} />
          </div>
        </Card>

        {/* Montos */}
        <Card>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 14 }}>💱 Monto</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Inp label="Monto MXN ($)" value={gasto.monto_mxn ?? ""} step="0.01" placeholder="0.00"
              onChange={(e: any) => handleMXN(e.target.value)}
              note="Llenar uno — el otro se auto-calcula" />
            <Inp label="Monto USD ($)" value={gasto.monto_usd ?? ""} step="0.01" placeholder="0.00"
              onChange={(e: any) => handleUSD(e.target.value)} />
            <Inp label="Tipo de cambio usado" value={gasto.tipo_cambio ?? tipoCambio} step="0.01"
              onChange={(e: any) => handleTC(e.target.value)}
              note={`Default global: ${tipoCambio.toFixed(2)}`} />
          </div>
          {/* Preview */}
          {(gasto.monto_mxn || gasto.monto_usd) && (
            <div style={{ marginTop: 14, padding: "12px 14px", background: C.orangeDim, borderRadius: 9, border: `1px solid ${C.orangeBorder}` }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase" as const, letterSpacing: 0.5, marginBottom: 6 }}>
                📊 Gasto — {CATEGORIAS_GASTO.includes(gasto.categoria) ? gasto.categoria : ""}
              </div>
              <div style={{ display: "flex", gap: 24 }}>
                <div>
                  <div style={{ fontSize: 11, color: C.textMuted }}>MXN</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: C.orange, fontFamily: "'DM Mono', monospace" }}>
                    ${(gasto.monto_mxn ?? 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: C.textMuted }}>USD</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: C.yellow, fontFamily: "'DM Mono', monospace" }}>
                    {fmtUSD(gasto.monto_usd ?? 0)}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 11, color: C.textMuted, marginTop: 6 }}>
                TC: {(gasto.tipo_cambio ?? tipoCambio).toFixed(2)} · Sem. {gasto.semana_iso}/{gasto.year_iso}
              </div>
            </div>
          )}
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.textSecondary, marginBottom: 4 }}>Notas</div>
            <textarea value={gasto.notas ?? ""} onChange={e => set("notas", e.target.value || null)} rows={3}
              placeholder="Comprobante #, observaciones…"
              style={{ width: "100%", padding: "9px 12px", borderRadius: 9, background: C.input, border: `1.5px solid ${C.inputBorder}`, color: C.text, fontSize: 13, resize: "vertical", outline: "none", boxSizing: "border-box" as const }} />
          </div>
        </Card>
      </div>

      <div style={{ display: "flex", gap: 12, justifyContent: "space-between", alignItems: "center", marginTop: 20 }}>
        <div>
          {isEdit && onDelete && (
            <Btn onClick={onDelete} variant="danger">🗑 Eliminar</Btn>
          )}
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <Btn onClick={onCancel} variant="ghost">Cancelar</Btn>
          <Btn onClick={onSave} variant="success">💾 Guardar</Btn>
        </div>
      </div>
    </div>
  );
}

// ── Registro de gastos (CRUD principal) ──────────────────────
function CostosRegistroTab() {
  const { gastosOp, reload, tipoCambio } = useFinanzas();
  const [showForm, setShowForm] = useState(false);
  const [editGasto, setEditGasto] = useState<GastoOperativo | null>(null);
  const [saving, setSaving] = useState(false);
  // Filtros
  const [filtroCategoria, setFiltroCategoria] = useState<string>("todas");
  const [filtroSemana, setFiltroSemana] = useState<string>(""); // "YYYY-WW"
  const hoy = getMexDate();

  const blank = (): GastoOperativo => ({
    fecha: hoy, semana_iso: getWeekNumber(hoy), year_iso: getISOYear(hoy),
    categoria: "Nómina Cosecha", subcategoria: null, proveedor: null,
    descripcion: "", monto_mxn: null, monto_usd: null,
    tipo_cambio: tipoCambio, notas: null,
  });

  // KPIs globales
  const totalMXN = useMemo(() => gastosOp.reduce((s, g) => s + (g.monto_mxn ?? (g.monto_usd ?? 0) * (g.tipo_cambio ?? tipoCambio)), 0), [gastosOp, tipoCambio]);
  const totalUSD = useMemo(() => gastosOp.reduce((s, g) => s + (g.monto_usd ?? (g.monto_mxn ?? 0) / (g.tipo_cambio ?? tipoCambio)), 0), [gastosOp, tipoCambio]);

  // Semanas disponibles para filtro
  const semanasDisp = useMemo(() => {
    const set = new Set<string>();
    gastosOp.forEach(g => { if (g.year_iso && g.semana_iso) set.add(`${g.year_iso}-${String(g.semana_iso).padStart(2, "0")}`); });
    return Array.from(set).sort().reverse();
  }, [gastosOp]);

  // Gastos filtrados
  const gastosFiltrados = useMemo(() => gastosOp.filter(g => {
    if (filtroCategoria !== "todas" && g.categoria !== filtroCategoria) return false;
    if (filtroSemana && `${g.year_iso}-${String(g.semana_iso).padStart(2, "0")}` !== filtroSemana) return false;
    return true;
  }), [gastosOp, filtroCategoria, filtroSemana]);

  const totalFiltradoMXN = useMemo(() => gastosFiltrados.reduce((s, g) => s + (g.monto_mxn ?? (g.monto_usd ?? 0) * (g.tipo_cambio ?? tipoCambio)), 0), [gastosFiltrados, tipoCambio]);

  const handleSave = async () => {
    if (!editGasto) return;
    if (!editGasto.descripcion.trim()) { toast.error("Descripción requerida"); return; }
    if (!editGasto.monto_mxn && !editGasto.monto_usd) { toast.error("Ingresa al menos un monto"); return; }
    setSaving(true);
    try {
      const data: any = { ...editGasto };
      if (editGasto.id) {
        const { error } = await supabase.from("gastos_operativos").update(data).eq("id", editGasto.id);
        if (error) throw error;
        toast.success("Gasto actualizado ✓");
      } else {
        delete data.id;
        const { error } = await supabase.from("gastos_operativos").insert(data);
        if (error) throw error;
        toast.success("Gasto registrado ✓");
      }
      setShowForm(false); setEditGasto(null); reload();
    } catch (err: any) { toast.error(err.message); }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!editGasto?.id) return;
    if (!window.confirm("¿Eliminar este gasto?")) return;
    try {
      const { error } = await supabase.from("gastos_operativos").delete().eq("id", editGasto.id);
      if (error) throw error;
      toast.success("Eliminado ✓");
      setShowForm(false); setEditGasto(null); reload();
    } catch (err: any) { toast.error(err.message); }
  };

  if (showForm && editGasto) {
    return (
      <GastoForm
        gasto={editGasto}
        onChange={setEditGasto}
        onSave={handleSave}
        onCancel={() => { setShowForm(false); setEditGasto(null); }}
        onDelete={editGasto.id ? handleDelete : undefined}
      />
    );
  }

  return (
    <div>
      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(175px, 1fr))", gap: 14, marginBottom: 20 }}>
        <StatCard emoji="💸" label="Total gastado" value={`$${(totalMXN / 1000).toFixed(1)}k`} sub="MXN · todos los registros" color={C.orange} />
        <StatCard emoji="💵" label="Total en USD" value={fmtUSD(totalUSD)} sub="equivalente" color={C.yellow} />
        <StatCard emoji="📋" label="Registros" value={gastosOp.length} sub={`${semanasDisp.length} semanas`} color={C.accentLight} />
        {filtroSemana && (
          <StatCard emoji="🔍" label="Filtrado" value={`$${(totalFiltradoMXN / 1000).toFixed(1)}k MXN`} sub={`${gastosFiltrados.length} registros`} color={C.purple} />
        )}
      </div>

      {/* Barra de filtros */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" as const, alignItems: "flex-end" }}>
        <Sel label="Categoría" value={filtroCategoria}
          onChange={(e: any) => setFiltroCategoria(e.target.value)}
          options={[{ value: "todas", label: "Todas las categorías" }, ...CATEGORIAS_GASTO.map(c => ({ value: c, label: c }))]} />
        <Sel label="Semana" value={filtroSemana}
          onChange={(e: any) => setFiltroSemana(e.target.value)}
          options={[{ value: "", label: "Todas las semanas" }, ...semanasDisp.map(s => ({ value: s, label: `Sem. ${s.split("-")[1]}/${s.split("-")[0]}` }))]} />
        {(filtroCategoria !== "todas" || filtroSemana) && (
          <Btn onClick={() => { setFiltroCategoria("todas"); setFiltroSemana(""); }} variant="ghost">✕ Limpiar</Btn>
        )}
        <div style={{ marginLeft: "auto" }}>
          <Btn onClick={() => { setEditGasto(blank()); setShowForm(true); }}>+ Nuevo Gasto</Btn>
        </div>
      </div>

      {/* Tabla */}
      <Card>
        {gastosFiltrados.length === 0 ? (
          <div style={{ textAlign: "center" as const, padding: "40px", color: C.textMuted }}>
            {gastosOp.length === 0 ? "Sin gastos registrados. Presiona \"+ Nuevo Gasto\"." : "Sin resultados con los filtros aplicados."}
          </div>
        ) : (
          <div style={{ overflowX: "auto" as const }}>
            <table style={{ width: "100%", borderCollapse: "collapse" as const }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  {["Fecha", "Sem.", "Categoría", "Subcateg.", "Descripción", "Proveedor", "MXN", "USD", ""].map(h => (
                    <th key={h} style={{ textAlign: "left" as const, padding: "7px 10px", fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase" as const, letterSpacing: 0.5 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {gastosFiltrados.map(g => {
                  const mxn = g.monto_mxn ?? (g.monto_usd ?? 0) * (g.tipo_cambio ?? tipoCambio);
                  const usd = g.monto_usd ?? (g.monto_mxn ?? 0) / (g.tipo_cambio ?? tipoCambio);
                  const color = CATEGORIA_COLOR[g.categoria] ?? C.textSecondary;
                  return (
                    <tr key={g.id} style={{ borderBottom: `1px solid ${C.border}22`, cursor: "pointer" }}
                      onClick={() => { setEditGasto({ ...g }); setShowForm(true); }}>
                      <td style={{ padding: "9px 10px", fontSize: 12, color: C.textSecondary, whiteSpace: "nowrap" as const }}>{g.fecha}</td>
                      <td style={{ padding: "9px 10px", fontSize: 12, fontFamily: "'DM Mono', monospace", color: C.textMuted }}>
                        {g.semana_iso}<span style={{ fontSize: 10 }}>/{g.year_iso}</span>
                      </td>
                      <td style={{ padding: "9px 10px" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color, background: color + "20", padding: "2px 8px", borderRadius: 20 }}>{g.categoria}</span>
                      </td>
                      <td style={{ padding: "9px 10px", fontSize: 12, color: C.textMuted }}>{g.subcategoria ?? "—"}</td>
                      <td style={{ padding: "9px 10px", fontSize: 13, color: C.text, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{g.descripcion}</td>
                      <td style={{ padding: "9px 10px", fontSize: 12, color: C.textMuted }}>{g.proveedor ?? "—"}</td>
                      <td style={{ padding: "9px 10px", fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 700, color: C.orange, whiteSpace: "nowrap" as const }}>
                        ${mxn.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: "9px 10px", fontFamily: "'DM Mono', monospace", fontSize: 12, color: C.yellow, whiteSpace: "nowrap" as const }}>{fmtUSD(usd)}</td>
                      <td style={{ padding: "9px 10px", fontSize: 11, color: C.accent }}>Editar</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: `2px solid ${C.border}`, background: C.surface }}>
                  <td colSpan={6} style={{ padding: "9px 10px", fontSize: 12, fontWeight: 700, color: C.textSecondary }}>
                    TOTAL ({gastosFiltrados.length} registros)
                  </td>
                  <td style={{ padding: "9px 10px", fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 800, color: C.orange, whiteSpace: "nowrap" as const }}>
                    ${totalFiltradoMXN.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td style={{ padding: "9px 10px", fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 800, color: C.yellow, whiteSpace: "nowrap" as const }}>
                    {fmtUSD(gastosFiltrados.reduce((s, g) => s + (g.monto_usd ?? (g.monto_mxn ?? 0) / (g.tipo_cambio ?? tipoCambio)), 0))}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

// ── Costos por semana (integración con Fase 1 y 2) ──────────
function CostosPorSemanaTab() {
  const { gastosOp, cuadres, semanasPrecio, tipoCambio } = useFinanzas();
  const hoy = getMexDate();
  const [semSelKey, setSemSelKey] = useState<string>(() => {
    const w = getWeekNumber(hoy); const y = getCurrentYear();
    return `${y}-${String(w).padStart(2, "0")}`;
  });

  // Todas las semanas con datos (gastosOp + cuadres + semanasPrecio)
  const semanasConDatos = useMemo(() => {
    const set = new Set<string>();
    gastosOp.forEach(g => { if (g.year_iso && g.semana_iso) set.add(`${g.year_iso}-${String(g.semana_iso).padStart(2, "0")}`); });
    cuadres.forEach(c => { if (c.year_iso && c.semana_iso) set.add(`${c.year_iso}-${String(c.semana_iso).padStart(2, "0")}`); });
    semanasPrecio.forEach(s => set.add(`${s.year}-${String(s.semana).padStart(2, "0")}`));
    // Agregar semana actual aunque no tenga datos
    const w = getWeekNumber(hoy); const y = getCurrentYear();
    set.add(`${y}-${String(w).padStart(2, "0")}`);
    return Array.from(set).sort().reverse();
  }, [gastosOp, cuadres, semanasPrecio, hoy]);

  const [selYear, selSem] = useMemo(() => {
    const parts = semSelKey.split("-");
    return [parseInt(parts[0]), parseInt(parts[1])];
  }, [semSelKey]);

  // Gastos de la semana seleccionada
  const gastosDelaSemana = useMemo(() =>
    gastosOp.filter(g => g.semana_iso === selSem && g.year_iso === selYear),
    [gastosOp, selSem, selYear]);

  // Agrupados por categoría
  const porCategoria = useMemo(() => {
    const map: Record<string, number> = {};
    gastosDelaSemana.forEach(g => {
      const mxn = g.monto_mxn ?? (g.monto_usd ?? 0) * (g.tipo_cambio ?? tipoCambio);
      map[g.categoria] = (map[g.categoria] ?? 0) + mxn;
    });
    return CATEGORIAS_GASTO.map(cat => ({ cat, mxn: map[cat] ?? 0 })).filter(r => r.mxn > 0);
  }, [gastosDelaSemana, tipoCambio]);

  const totalGastoMXN = porCategoria.reduce((s, r) => s + r.mxn, 0);
  const totalGastoUSD = totalGastoMXN / tipoCambio;

  // Contexto Fase 1 — cuadre de esta semana (puede haber varios días)
  const cuadresDelaSemana = useMemo(() =>
    cuadres.filter(c => c.semana_iso === selSem && c.year_iso === selYear),
    [cuadres, selSem, selYear]);
  const kgCosechados = cuadresDelaSemana.reduce((s, c) => s + c.kg_cosechados, 0);
  const kgEmpacados  = cuadresDelaSemana.reduce((s, c) => s + c.kg_empacados, 0);
  const cajasEmpaque = cuadresDelaSemana.reduce((s, c) => s + c.cajas_totales, 0);

  // Contexto Fase 2 — semanas de precio
  const preciosDelaSemana = useMemo(() =>
    semanasPrecio.filter(s => s.semana === selSem && s.year === selYear),
    [semanasPrecio, selSem, selYear]);
  const ingEstMin = preciosDelaSemana.reduce((s, r) => s + (r.ingreso_estimado_min_usd ?? 0), 0);
  const ingEstMax = preciosDelaSemana.reduce((s, r) => s + (r.ingreso_estimado_max_usd ?? 0), 0);
  const ingReal   = preciosDelaSemana.reduce((s, r) => s + (r.ingreso_real_usd ?? 0), 0);

  // KPIs derivados
  const costoPorKg    = kgCosechados > 0 ? totalGastoMXN / kgCosechados : null;
  const costoPorCaja  = cajasEmpaque > 0 ? totalGastoUSD / cajasEmpaque : null;
  const margenMinUSD  = ingEstMin > 0 ? ingEstMin - totalGastoUSD : null;
  const margenMaxUSD  = ingEstMax > 0 ? ingEstMax - totalGastoUSD : null;
  const margenPctMin  = ingEstMin > 0 && totalGastoUSD > 0 ? (margenMinUSD! / ingEstMin) * 100 : null;

  const maxBarMXN = Math.max(...porCategoria.map(r => r.mxn), 1);

  return (
    <div>
      {/* Selector de semana */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 14, marginBottom: 20, flexWrap: "wrap" as const }}>
        <Sel label="Semana" value={semSelKey}
          onChange={(e: any) => setSemSelKey(e.target.value)}
          options={semanasConDatos.map(s => {
            const [y, w] = s.split("-");
            return { value: s, label: `Sem. ${parseInt(w)} / ${y}` };
          })} />
        <div style={{ padding: "9px 14px", background: C.surface, borderRadius: 9, border: `1px solid ${C.border}`, fontSize: 13, color: C.textSecondary }}>
          📅 Semana <strong style={{ color: C.accentLight }}>{selSem}</strong> de {selYear}
          {" · "}{cuadresDelaSemana.length} cuadre(s) cerrado(s)
        </div>
      </div>

      {/* KPIs de la semana */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(175px, 1fr))", gap: 14, marginBottom: 20 }}>
        <StatCard emoji="💸" label="Gasto semana"
          value={totalGastoMXN > 0 ? `$${(totalGastoMXN / 1000).toFixed(1)}k` : "—"}
          sub={totalGastoUSD > 0 ? `${fmtUSD(totalGastoUSD)} USD` : "Sin registros aún"}
          color={C.orange} />
        <StatCard emoji="⚖️" label="Costo / kg"
          value={costoPorKg ? `$${costoPorKg.toFixed(2)}` : "—"}
          sub={kgCosechados > 0 ? `${kgCosechados.toFixed(0)} kg cosechados` : "Sin cuadre cerrado"}
          color={C.yellow} />
        <StatCard emoji="📦" label="Costo / caja"
          value={costoPorCaja ? fmtUSD(costoPorCaja) : "—"}
          sub={cajasEmpaque > 0 ? `${cajasEmpaque} cajas empacadas` : "Sin cuadre cerrado"}
          color={C.yellow} />
        {margenMinUSD !== null ? (
          <StatCard emoji={margenMinUSD >= 0 ? "📈" : "📉"} label="Margen estimado"
            value={margenMinUSD >= 0 ? `+${fmtUSD(margenMinUSD)}` : fmtUSD(margenMinUSD)}
            sub={margenPctMin != null ? `${margenPctMin.toFixed(1)}% sobre ingreso mín` : ""}
            color={margenMinUSD >= 0 ? C.green : C.red} />
        ) : (
          <StatCard emoji="💰" label="Ingreso estimado" value={ingEstMin > 0 ? `${fmtKUSD(ingEstMin)}–${fmtKUSD(ingEstMax)}` : "—"} sub="de semanas de precio" color={C.accentLight} />
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Breakown por categoría */}
        <Card>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 18 }}>📊 Gastos por Categoría</div>
          {porCategoria.length === 0 ? (
            <div style={{ textAlign: "center" as const, padding: "30px", color: C.textMuted }}>Sin gastos esta semana</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" as const, gap: 14 }}>
              {porCategoria.map(({ cat, mxn }) => {
                const color = CATEGORIA_COLOR[cat as CategoriaGasto] ?? C.textSecondary;
                const pct = (mxn / totalGastoMXN) * 100;
                return (
                  <div key={cat}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color }}>{cat}</span>
                      <span style={{ fontSize: 13, fontFamily: "'DM Mono', monospace", color: C.text }}>
                        ${mxn.toLocaleString("es-MX", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        <span style={{ fontSize: 11, color: C.textMuted, marginLeft: 6 }}>{pct.toFixed(1)}%</span>
                      </span>
                    </div>
                    <MiniBar value={mxn} max={maxBarMXN} color={color} />
                  </div>
                );
              })}
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12, display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Total MXN</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: C.orange, fontFamily: "'DM Mono', monospace" }}>
                  ${totalGastoMXN.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          )}
        </Card>

        {/* Integración Fase 1 y 2 */}
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 14 }}>
          {/* Contexto de producción (Fase 1) */}
          <Card>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 14 }}>⚖️ Producción Sem. {selSem} (Cuadre)</div>
            {cuadresDelaSemana.length === 0 ? (
              <div style={{ fontSize: 13, color: C.textMuted }}>Sin cuadres cerrados para esta semana</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  ["🌾 Kg Cosechados", kgCosechados.toFixed(0) + " kg", C.green],
                  ["📦 Kg Empacados", kgEmpacados.toFixed(0) + " kg", C.accentLight],
                  ["🗂 Cajas", cajasEmpaque + " cajas", C.accentLight],
                  ["📅 Días cuadre", cuadresDelaSemana.length + " día(s)", C.textSecondary],
                ].map(([label, val, color]) => (
                  <div key={label as string} style={{ padding: "10px 12px", background: C.surface, borderRadius: 9, border: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: 11, color: C.textMuted }}>{label}</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: color as string, fontFamily: "'DM Mono', monospace", marginTop: 3 }}>{val}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Contexto de ventas (Fase 2) */}
          <Card>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 14 }}>💵 Ingresos Sem. {selSem} (Ventas)</div>
            {preciosDelaSemana.length === 0 ? (
              <div style={{ fontSize: 13, color: C.textMuted }}>Sin precios registrados para esta semana</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column" as const, gap: 10 }}>
                {preciosDelaSemana.map(p => {
                  const cfg = STATUS_CFG[p.status];
                  const margenMin = ingEstMin > 0 && totalGastoUSD > 0 ? ingEstMin - totalGastoUSD : null;
                  return (
                    <div key={p.id} style={{ padding: "10px 12px", background: C.surface, borderRadius: 9, border: `1px solid ${C.border}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontSize: 12, color: C.textSecondary }}>{p.cliente} · {p.presentacion}</span>
                        <Badge text={`${cfg.emoji} ${cfg.label}`} color={cfg.color} bg={cfg.bg} border={cfg.border} />
                      </div>
                      <div style={{ display: "flex", gap: 14 }}>
                        <div>
                          <div style={{ fontSize: 10, color: C.textMuted }}>Rango estimado</div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: C.accentLight, fontFamily: "'DM Mono', monospace" }}>
                            {p.ingreso_estimado_min_usd ? `${fmtKUSD(p.ingreso_estimado_min_usd)}–${fmtKUSD(p.ingreso_estimado_max_usd!)}` : `$${p.precio_estimado_min}–$${p.precio_estimado_max}/caja`}
                          </div>
                        </div>
                        {p.precio_real && (
                          <div>
                            <div style={{ fontSize: 10, color: C.textMuted }}>Real</div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: C.green, fontFamily: "'DM Mono', monospace" }}>
                              {p.ingreso_real_usd ? fmtKUSD(p.ingreso_real_usd) : `$${p.precio_real}/caja`}
                            </div>
                          </div>
                        )}
                      </div>
                      {/* Margen rápido si hay datos suficientes */}
                      {margenMin !== null && totalGastoUSD > 0 && (
                        <div style={{ marginTop: 8, padding: "6px 10px", borderRadius: 7, background: margenMin >= 0 ? C.greenDim : C.redDim, display: "flex", justifyContent: "space-between" }}>
                          <span style={{ fontSize: 11, color: C.textMuted }}>Margen bruto est. (mín)</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: margenMin >= 0 ? C.green : C.red, fontFamily: "'DM Mono', monospace" }}>
                            {margenMin >= 0 ? "+" : ""}{fmtUSD(margenMin)} ({margenPctMin?.toFixed(1)}%)
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
                {ingReal > 0 && (
                  <div style={{ padding: "8px 12px", background: C.greenDim, borderRadius: 9, border: `1px solid ${C.greenBorder}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: C.green }}>✅ Ingreso liquidado</span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: C.green, fontFamily: "'DM Mono', monospace" }}>{fmtUSD(ingReal)}</span>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Detalle de gastos de la semana */}
      {gastosDelaSemana.length > 0 && (
        <Card style={{ marginTop: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 12 }}>📋 Detalle Gastos Sem. {selSem}/{selYear}</div>
          <div style={{ overflowX: "auto" as const }}>
            <table style={{ width: "100%", borderCollapse: "collapse" as const }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  {["Fecha", "Categoría", "Descripción", "Proveedor", "MXN", "USD"].map(h => (
                    <th key={h} style={{ textAlign: "left" as const, padding: "7px 10px", fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase" as const }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {gastosDelaSemana.map(g => {
                  const mxn = g.monto_mxn ?? (g.monto_usd ?? 0) * (g.tipo_cambio ?? tipoCambio);
                  const usd = g.monto_usd ?? (g.monto_mxn ?? 0) / (g.tipo_cambio ?? tipoCambio);
                  const color = CATEGORIA_COLOR[g.categoria] ?? C.textSecondary;
                  return (
                    <tr key={g.id} style={{ borderBottom: `1px solid ${C.border}22` }}>
                      <td style={{ padding: "8px 10px", fontSize: 12, color: C.textMuted }}>{g.fecha}</td>
                      <td style={{ padding: "8px 10px" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color, background: color + "20", padding: "2px 8px", borderRadius: 20 }}>{g.categoria}</span>
                      </td>
                      <td style={{ padding: "8px 10px", fontSize: 12, color: C.text }}>{g.descripcion}{g.subcategoria && <span style={{ color: C.textMuted }}> · {g.subcategoria}</span>}</td>
                      <td style={{ padding: "8px 10px", fontSize: 12, color: C.textMuted }}>{g.proveedor ?? "—"}</td>
                      <td style={{ padding: "8px 10px", fontFamily: "'DM Mono', monospace", fontSize: 12, color: C.orange }}>
                        ${mxn.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: "8px 10px", fontFamily: "'DM Mono', monospace", fontSize: 12, color: C.yellow }}>{fmtUSD(usd)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

// ── Resumen global por categoría ──────────────────────────────
function CostosPorCategoriaTab() {
  const { gastosOp, tipoCambio } = useFinanzas();
  const [periodo, setPeriodo] = useState<"semana" | "mes" | "todo">("todo");
  const hoy = getMexDate();

  // Filtrar por periodo
  const gastosFiltrados = useMemo(() => {
    if (periodo === "todo") return gastosOp;
    const curW = getWeekNumber(hoy); const curY = getCurrentYear();
    const curM = parseInt(hoy.slice(5, 7));
    return gastosOp.filter(g => {
      if (periodo === "semana") return g.semana_iso === curW && g.year_iso === curY;
      if (periodo === "mes") return parseInt(g.fecha.slice(5, 7)) === curM && g.year_iso === curY;
      return true;
    });
  }, [gastosOp, periodo, hoy]);

  const categorias = useMemo(() => calcGastosPorCategoria(gastosFiltrados, tipoCambio), [gastosFiltrados, tipoCambio]);
  const total = categorias.reduce((s, c) => s + c.totalMXN, 0);
  const maxBar = Math.max(...categorias.map(c => c.totalMXN), 1);

  return (
    <div>
      {/* Selector de periodo */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {(["semana", "mes", "todo"] as const).map(p => (
          <button key={p} onClick={() => setPeriodo(p)}
            style={{ padding: "8px 18px", borderRadius: 9, border: `1.5px solid ${periodo === p ? C.accent : C.border}`, background: periodo === p ? C.accentDim : "transparent", color: periodo === p ? C.accentLight : C.textSecondary, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            {p === "semana" ? "📅 Esta semana" : p === "mes" ? "📆 Este mes" : "📊 Todo"}
          </button>
        ))}
        <span style={{ marginLeft: "auto", fontSize: 12, color: C.textMuted, alignSelf: "center" }}>{gastosFiltrados.length} registros</span>
      </div>

      {/* KPI strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 20 }}>
        <StatCard emoji="💸" label="Total período" value={`$${(total / 1000).toFixed(1)}k`} sub="MXN" color={C.orange} />
        <StatCard emoji="💵" label="En USD" value={fmtUSD(total / tipoCambio)} sub={`TC ${tipoCambio.toFixed(2)}`} color={C.yellow} />
        <StatCard emoji="📋" label="Registros" value={gastosFiltrados.length} color={C.accentLight} />
        <StatCard emoji="🗂" label="Categorías activas" value={categorias.filter(c => c.totalMXN > 0).length} sub={`de ${CATEGORIAS_GASTO.length}`} color={C.textSecondary} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Barras por categoría */}
        <Card>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 20 }}>📊 Distribución de Costos</div>
          <div style={{ display: "flex", flexDirection: "column" as const, gap: 16 }}>
            {categorias.map(({ categoria, totalMXN, totalUSD, count }) => {
              const color = CATEGORIA_COLOR[categoria];
              const pct = total > 0 ? (totalMXN / total) * 100 : 0;
              return (
                <div key={categoria}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, alignItems: "baseline" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color }}>{categoria}</span>
                    <div style={{ textAlign: "right" as const }}>
                      <span style={{ fontSize: 13, fontFamily: "'DM Mono', monospace", color: C.text }}>
                        ${totalMXN.toLocaleString("es-MX", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </span>
                      <span style={{ fontSize: 11, color: C.textMuted, marginLeft: 6 }}>{pct.toFixed(1)}%</span>
                    </div>
                  </div>
                  <MiniBar value={totalMXN} max={maxBar} color={color} />
                  <div style={{ fontSize: 11, color: C.textMuted, marginTop: 3, display: "flex", justifyContent: "space-between" }}>
                    <span>{count} registro(s)</span>
                    <span>{fmtUSD(totalUSD)}</span>
                  </div>
                </div>
              );
            })}
            <div style={{ borderTop: `2px solid ${C.border}`, paddingTop: 12, display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Total MXN</span>
              <span style={{ fontSize: 15, fontWeight: 800, color: C.orange, fontFamily: "'DM Mono', monospace" }}>
                ${total.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </Card>

        {/* Tabla detalle por categoría con subcategorías */}
        <Card>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 16 }}>📋 Detalle por Categoría</div>
          <div style={{ display: "flex", flexDirection: "column" as const, gap: 12 }}>
            {categorias.filter(c => c.totalMXN > 0).map(({ categoria, totalMXN, count }) => {
              const color = CATEGORIA_COLOR[categoria];
              // Subcategorías de esta categoría
              const subs: Record<string, number> = {};
              gastosFiltrados.filter(g => g.categoria === categoria).forEach(g => {
                const k = g.subcategoria ?? "General";
                subs[k] = (subs[k] ?? 0) + (g.monto_mxn ?? (g.monto_usd ?? 0) * (g.tipo_cambio ?? tipoCambio));
              });
              return (
                <div key={categoria} style={{ padding: "12px 14px", background: C.surface, borderRadius: 10, border: `1px solid ${C.border}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color }}>{categoria}</span>
                    <span style={{ fontSize: 12, fontFamily: "'DM Mono', monospace", fontWeight: 700, color: C.text }}>
                      ${totalMXN.toLocaleString("es-MX", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  {Object.entries(subs).map(([sub, mxn]) => (
                    <div key={sub} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.textMuted, padding: "2px 0" }}>
                      <span>· {sub}</span>
                      <span style={{ fontFamily: "'DM Mono', monospace" }}>${mxn.toLocaleString("es-MX", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                    </div>
                  ))}
                  <div style={{ fontSize: 11, color: C.textMuted, marginTop: 5 }}>{count} registro(s)</div>
                </div>
              );
            })}
            {categorias.every(c => c.totalMXN === 0) && (
              <div style={{ textAlign: "center" as const, padding: 30, color: C.textMuted }}>Sin gastos en este período</div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ── Tab 3 wrapper ─────────────────────────────────────────────
function CostosTab() {
  const [sub, setSub] = useState("registro");
  return (
    <div>
      <TabBar
        tabs={[
          { key: "registro",   emoji: "📝", label: "Registro" },
          { key: "semana",     emoji: "📅", label: "Por Semana" },
          { key: "categoria",  emoji: "📊", label: "Por Categoría" },
        ]}
        active={sub} onSelect={setSub}
      />
      {sub === "registro"  && <CostosRegistroTab />}
      {sub === "semana"    && <CostosPorSemanaTab />}
      {sub === "categoria" && <CostosPorCategoriaTab />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 4 — RESULTADOS (FASE 4 COMPLETA)
// ═══════════════════════════════════════════════════════════════

// ── 4A: Resumen ejecutivo + gráfica CSS ──────────────────────
function ResultadosResumenTab({ semanas, loading }: { semanas: SemanaAgregada[]; loading: boolean }) {
  const { tipoCambio } = useFinanzas();

  // KPIs agregados del período
  const ingReal   = semanas.reduce((s, r) => s + r.ingReal, 0);
  const ingEst    = semanas.reduce((s, r) => s + r.ingEstMin, 0);
  const costoUSD  = semanas.reduce((s, r) => s + r.costoUSD, 0);
  const costoMXN  = semanas.reduce((s, r) => s + r.costoMXN, 0);
  const ingresoRef = ingReal > 0 ? ingReal : ingEst;
  const margenBruto = ingresoRef - costoUSD;
  const margenPct   = ingresoRef > 0 ? (margenBruto / ingresoRef) * 100 : null;
  const kgTotal   = semanas.reduce((s, r) => s + r.kgCosechados, 0);
  const cajasTotal = semanas.reduce((s, r) => s + (r.cajasVendidas || r.cajasEmpaque), 0);
  const costoKg   = kgTotal > 0 ? costoMXN / kgTotal : null;
  const costoCaja = cajasTotal > 0 ? costoUSD / cajasTotal : null;
  const mermaProm = semanas.length > 0 ? semanas.reduce((s, r) => s + r.mermaPct, 0) / semanas.length : null;

  // Datos para la gráfica — máximo 16 semanas
  const chartSems = semanas.slice(-16);
  const maxVal = Math.max(...chartSems.map(s => Math.max(s.ingEstMin, s.ingReal, s.costoUSD)), 1);

  const kpiStyle = (color: string): CSSProperties => ({
    padding: "14px 16px", background: C.card, borderRadius: 12,
    border: `1px solid ${C.border}`,
  });

  if (loading) return (
    <div style={{ textAlign: "center", padding: "60px", color: C.textMuted }}>Calculando…</div>
  );

  return (
    <div>
      {/* KPI strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(155px, 1fr))", gap: 12, marginBottom: 22 }}>
        {[
          { emoji: "✅", label: "Cobrado", val: fmtUSD(ingReal), sub: "liquidado confirmado", color: C.green },
          { emoji: "🔮", label: "Estimado", val: fmtKUSD(ingEst), sub: "por liquidar (mín)", color: C.yellow },
          { emoji: "💸", label: "Costos", val: costoMXN > 0 ? `$${(costoMXN/1000).toFixed(1)}k MXN` : "—", sub: costoUSD > 0 ? fmtUSD(costoUSD) : "sin registros", color: C.orange },
          { emoji: margenBruto >= 0 ? "📈" : "📉", label: "Margen bruto", val: margenPct != null ? `${margenPct.toFixed(1)}%` : "—", sub: margenBruto !== 0 ? (margenBruto >= 0 ? "+" : "") + fmtUSD(margenBruto) : "—", color: margenBruto >= 0 ? C.green : C.red },
          { emoji: "⚖️", label: "Costo / kg", val: costoKg ? `$${costoKg.toFixed(2)}` : "—", sub: "MXN por kg cosechado", color: C.yellow },
          { emoji: "📦", label: "Costo / caja", val: costoCaja ? fmtUSD(costoCaja) : "—", sub: "USD por caja vendida", color: C.yellow },
          { emoji: "📉", label: "Merma prom.", val: mermaProm != null ? `${mermaProm.toFixed(1)}%` : "—", sub: "promedio del período", color: mermaProm != null && mermaProm > 8 ? C.red : C.textSecondary },
          { emoji: "📅", label: "Semanas", val: String(semanas.length), sub: "con datos en el período", color: C.accentLight },
        ].map(k => (
          <div key={k.label} style={kpiStyle(k.color)}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, letterSpacing: 0.5, marginBottom: 6 }}>
              {k.emoji} {k.label.toUpperCase()}
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: k.color, fontFamily: "'DM Mono', monospace" }}>{k.val}</div>
            <div style={{ fontSize: 11, color: C.textMuted, marginTop: 3 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Gráfica CSS — Ingresos vs Costos por semana */}
      {chartSems.length > 0 ? (
        <Card style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 6 }}>
            📊 Ingresos vs Costos — Semana a Semana
          </div>
          {/* Leyenda */}
          <div style={{ display: "flex", gap: 18, marginBottom: 18, flexWrap: "wrap" as const }}>
            {[
              { color: C.accentLight, label: "Ingreso estimado" },
              { color: C.green,       label: "Ingreso real (liquidado)" },
              { color: C.orange,      label: "Costo total USD" },
            ].map(l => (
              <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: l.color }} />
                <span style={{ fontSize: 12, color: C.textMuted }}>{l.label}</span>
              </div>
            ))}
          </div>
          {/* Barras horizontales por semana */}
          <div style={{ display: "flex", flexDirection: "column" as const, gap: 14 }}>
            {chartSems.map(s => {
              const pIngEst  = (s.ingEstMin / maxVal) * 100;
              const pIngReal = (s.ingReal  / maxVal) * 100;
              const pCosto   = (s.costoUSD / maxVal) * 100;
              const isProfit = s.margenUSD >= 0;
              return (
                <div key={s.key}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, alignItems: "baseline" }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: C.textSecondary, minWidth: 80 }}>
                      S{s.semana}/{s.year}
                    </span>
                    <div style={{ display: "flex", gap: 14 }}>
                      {s.ingReal > 0 && (
                        <span style={{ fontSize: 11, color: C.green, fontFamily: "'DM Mono', monospace" }}>
                          ✓ {fmtUSD(s.ingReal)}
                        </span>
                      )}
                      {s.ingEstMin > 0 && s.ingReal === 0 && (
                        <span style={{ fontSize: 11, color: C.accentLight, fontFamily: "'DM Mono', monospace" }}>
                          ~{fmtUSD(s.ingEstMin)}
                        </span>
                      )}
                      {s.costoUSD > 0 && (
                        <span style={{ fontSize: 11, color: C.orange, fontFamily: "'DM Mono', monospace" }}>
                          -{fmtUSD(s.costoUSD)}
                        </span>
                      )}
                      {s.margenPct != null && (
                        <span style={{ fontSize: 11, fontWeight: 700, color: isProfit ? C.green : C.red, fontFamily: "'DM Mono', monospace" }}>
                          {isProfit ? "+" : ""}{s.margenPct.toFixed(0)}%
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column" as const, gap: 3 }}>
                    {/* Ingreso estimado */}
                    {s.ingEstMin > 0 && (
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 6, flexShrink: 0, fontSize: 9, color: C.textMuted, textAlign: "right" as const }}>E</div>
                        <div style={{ flex: 1, height: 8, background: C.surface, borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ width: `${pIngEst}%`, height: "100%", background: C.accentLight + "aa", borderRadius: 3, transition: "width .5s" }} />
                        </div>
                      </div>
                    )}
                    {/* Ingreso real */}
                    {s.ingReal > 0 && (
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 6, flexShrink: 0, fontSize: 9, color: C.textMuted, textAlign: "right" as const }}>R</div>
                        <div style={{ flex: 1, height: 8, background: C.surface, borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ width: `${pIngReal}%`, height: "100%", background: C.green, borderRadius: 3, transition: "width .5s" }} />
                        </div>
                      </div>
                    )}
                    {/* Costo */}
                    {s.costoUSD > 0 && (
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 6, flexShrink: 0, fontSize: 9, color: C.textMuted, textAlign: "right" as const }}>C</div>
                        <div style={{ flex: 1, height: 8, background: C.surface, borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ width: `${pCosto}%`, height: "100%", background: C.orange + "cc", borderRadius: 3, transition: "width .5s" }} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {semanas.length > 16 && (
            <div style={{ marginTop: 12, fontSize: 12, color: C.textMuted, textAlign: "center" as const }}>
              Mostrando las últimas 16 semanas del período. Cambia el período para ver más detalle.
            </div>
          )}
        </Card>
      ) : (
        <Card>
          <div style={{ textAlign: "center" as const, padding: "50px", color: C.textMuted }}>
            Sin datos en este período. Registra cuadres (F1), precios de venta (F2) y gastos (F3) para ver la gráfica.
          </div>
        </Card>
      )}

      {/* Semáforos de salud */}
      {semanas.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
          {/* Margen */}
          <Card>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.textSecondary, marginBottom: 10 }}>📈 Salud Financiera</div>
            {[
              { label: "Margen bruto", val: margenPct, umbralOk: 20, umbralWarn: 10, unit: "%", fmt: (v: number) => `${v.toFixed(1)}%` },
              { label: "Merma promedio", val: mermaProm, umbralOk: 5, umbralWarn: 10, invert: true, unit: "%", fmt: (v: number) => `${v.toFixed(1)}%` },
            ].map(({ label, val, umbralOk, umbralWarn, invert, fmt }) => {
              if (val == null) return null;
              const ok   = invert ? val <= umbralOk   : val >= umbralOk;
              const warn = invert ? val <= umbralWarn  : val >= umbralWarn;
              const clr  = ok ? C.green : warn ? C.yellow : C.red;
              const emoji = ok ? "✅" : warn ? "⚠️" : "🔴";
              return (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
                  <span style={{ fontSize: 13, color: C.textSecondary }}>{emoji} {label}</span>
                  <span style={{ fontSize: 15, fontWeight: 800, color: clr, fontFamily: "'DM Mono', monospace" }}>{fmt(val)}</span>
                </div>
              );
            })}
          </Card>

          {/* Resumen numérico */}
          <Card>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.textSecondary, marginBottom: 10 }}>🔢 Totales del Período</div>
            {[
              { label: "Kg cosechados",      val: `${kgTotal.toLocaleString("es-MX", { maximumFractionDigits: 0 })} kg`, color: C.green },
              { label: "Cajas (vend/emp)",   val: cajasTotal.toLocaleString(), color: C.accentLight },
              { label: "Costos totales MXN", val: `$${costoMXN.toLocaleString("es-MX", { maximumFractionDigits: 0 })}`, color: C.orange },
              { label: "Tipo de cambio",     val: `${tipoCambio.toFixed(2)} MXN/USD`, color: C.textSecondary },
            ].map(({ label, val, color }) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: `1px solid ${C.border}` }}>
                <span style={{ fontSize: 12, color: C.textMuted }}>{label}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color, fontFamily: "'DM Mono', monospace" }}>{val}</span>
              </div>
            ))}
          </Card>
        </div>
      )}
    </div>
  );
}

// ── 4B: P&L Completo waterfall ────────────────────────────────
function ResultadosPLTab({ semanas }: { semanas: SemanaAgregada[] }) {
  const { tipoCambio } = useFinanzas();

  const ingReal       = semanas.reduce((s, r) => s + r.ingReal, 0);
  const ingEst        = semanas.reduce((s, r) => s + r.ingEstMin, 0);
  const nominaUSD     = semanas.reduce((s, r) => s + r.costoNominaMXN, 0) / tipoCambio;
  const insumosUSD    = semanas.reduce((s, r) => s + r.costoInsumosMXN, 0) / tipoCambio;
  const logisticaUSD  = semanas.reduce((s, r) => s + r.costoLogisticaMXN, 0) / tipoCambio;
  const totalCostosUSD = nominaUSD + insumosUSD + logisticaUSD;
  const totalCostosMXN = semanas.reduce((s, r) => s + r.costoMXN, 0);
  const ingresoTotal  = ingReal + ingEst;
  const utilidadBruta = ingReal - (nominaUSD + insumosUSD);
  const ebitda        = ingresoTotal - totalCostosUSD;
  const margenBruto   = ingReal > 0 ? (utilidadBruta / ingReal) * 100 : null;
  const margenEBITDA  = ingresoTotal > 0 ? (ebitda / ingresoTotal) * 100 : null;
  const kgTotal       = semanas.reduce((s, r) => s + r.kgCosechados, 0);
  const cajasTotal    = semanas.reduce((s, r) => s + (r.cajasVendidas || r.cajasEmpaque), 0);

  // Waterfall items
  type WFItem = { label: string; val: number; color: string; indent?: boolean; bold?: boolean; sep?: boolean; isSubtotal?: boolean };
  const wf: WFItem[] = [
    { label: "Ingresos Liquidados (USD)", val: ingReal, color: C.green, bold: false },
    { label: "+ Ingresos Estimados pendientes (USD)", val: ingEst, color: C.yellow },
    { label: "= TOTAL INGRESOS", val: ingresoTotal, color: C.accentLight, bold: true, sep: true, isSubtotal: true },
    { label: "− Nómina Cosecha + Empaque (MXN→USD)", val: -nominaUSD, color: C.red, indent: true },
    { label: "− Insumos Campo + Materiales (MXN→USD)", val: -insumosUSD, color: C.orange, indent: true },
    { label: "= UTILIDAD BRUTA REAL", val: utilidadBruta, color: utilidadBruta >= 0 ? C.green : C.red, bold: true, sep: true, isSubtotal: true },
    { label: "− Logística / Exportación (MXN→USD)", val: -logisticaUSD, color: C.purple, indent: true },
    { label: "= EBITDA ESTIMADO", val: ebitda, color: ebitda >= 0 ? C.green : C.red, bold: true, sep: true, isSubtotal: true },
  ];

  const maxAbsVal = Math.max(...wf.filter(r => !r.isSubtotal).map(r => Math.abs(r.val)), 1);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
      {/* Waterfall */}
      <Card>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 20 }}>💹 Estado de Resultados</div>
        {wf.map((row, i) => {
          const barW = row.isSubtotal ? 0 : (Math.abs(row.val) / maxAbsVal) * 80;
          const isNeg = row.val < 0;
          return (
            <div key={i} style={{
              paddingTop:    row.sep ? 12 : 0,
              marginTop:     row.sep ? 8  : 0,
              borderTop:     row.sep ? `2px solid ${C.border}` : undefined,
              paddingBottom: 10,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: row.isSubtotal ? 0 : 5 }}>
                <span style={{
                  fontSize:    row.bold ? 14 : 12,
                  fontWeight:  row.bold ? 800 : 400,
                  color:       row.bold ? row.color : C.textMuted,
                  paddingLeft: row.indent ? 16 : 0,
                }}>
                  {row.label}
                </span>
                <span style={{
                  fontSize: row.bold ? 16 : 13,
                  fontWeight: row.bold ? 800 : 600,
                  color: row.color,
                  fontFamily: "'DM Mono', monospace",
                }}>
                  {row.val === 0 ? "—" : (isNeg ? "-" : "+") + fmtUSD(Math.abs(row.val))}
                </span>
              </div>
              {!row.isSubtotal && Math.abs(row.val) > 0 && (
                <div style={{ height: 6, background: C.surface, borderRadius: 3, overflow: "hidden", marginLeft: row.indent ? 16 : 0 }}>
                  <div style={{ width: `${barW}%`, height: "100%", background: row.color + (isNeg ? "bb" : "99"), borderRadius: 3 }} />
                </div>
              )}
              {row.isSubtotal && row.label.includes("EBITDA") && margenEBITDA != null && (
                <div style={{ display: "flex", gap: 20, marginTop: 8 }}>
                  <div style={{ padding: "8px 14px", borderRadius: 8, background: ebitda >= 0 ? C.greenDim : C.redDim, border: `1px solid ${ebitda >= 0 ? C.greenBorder : C.redBorder}`, flex: 1, textAlign: "center" as const }}>
                    <div style={{ fontSize: 11, color: C.textMuted }}>Margen EBITDA</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: ebitda >= 0 ? C.green : C.red, fontFamily: "'DM Mono', monospace" }}>{margenEBITDA.toFixed(1)}%</div>
                  </div>
                  {margenBruto != null && (
                    <div style={{ padding: "8px 14px", borderRadius: 8, background: margenBruto >= 0 ? C.greenDim : C.redDim, border: `1px solid ${margenBruto >= 0 ? C.greenBorder : C.redBorder}`, flex: 1, textAlign: "center" as const }}>
                      <div style={{ fontSize: 11, color: C.textMuted }}>Margen Bruto (liq)</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: margenBruto >= 0 ? C.green : C.red, fontFamily: "'DM Mono', monospace" }}>{margenBruto.toFixed(1)}%</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </Card>

      {/* Panel derecho: estructura + eficiencia */}
      <div style={{ display: "flex", flexDirection: "column" as const, gap: 14 }}>
        {/* Estructura de costos */}
        <Card>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 14 }}>💸 Estructura de Costos</div>
          {[
            { label: "Nómina (Cosecha + Empaque)", mxn: nominaUSD * tipoCambio, usd: nominaUSD, color: C.red },
            { label: "Insumos + Materiales",       mxn: insumosUSD * tipoCambio, usd: insumosUSD, color: C.orange },
            { label: "Logística + Overhead",       mxn: logisticaUSD * tipoCambio, usd: logisticaUSD, color: C.purple },
          ].map(({ label, mxn, usd, color }) => {
            const pct = totalCostosMXN > 0 ? (mxn / totalCostosMXN) * 100 : 0;
            return (
              <div key={label} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color }}>{label}</span>
                  <div style={{ textAlign: "right" as const }}>
                    <span style={{ fontSize: 12, fontFamily: "'DM Mono', monospace", color: C.text }}>
                      ${mxn.toLocaleString("es-MX", { maximumFractionDigits: 0 })}
                    </span>
                    <span style={{ fontSize: 10, color: C.textMuted, marginLeft: 6 }}>{pct.toFixed(0)}%</span>
                  </div>
                </div>
                <MiniBar value={mxn} max={totalCostosMXN} color={color} />
                <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2, textAlign: "right" as const }}>{fmtUSD(usd)}</div>
              </div>
            );
          })}
          <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 10, borderTop: `2px solid ${C.border}` }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Total MXN</span>
            <span style={{ fontSize: 15, fontWeight: 800, color: C.orange, fontFamily: "'DM Mono', monospace" }}>
              ${totalCostosMXN.toLocaleString("es-MX", { maximumFractionDigits: 0 })} <span style={{ fontSize: 11, fontWeight: 400, color: C.textMuted }}>= {fmtUSD(totalCostosUSD)}</span>
            </span>
          </div>
        </Card>

        {/* Métricas unitarias */}
        <Card>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 14 }}>⚡ Métricas Unitarias</div>
          {[
            { label: "Costo por kg cosechado", val: kgTotal > 0 ? `$${(totalCostosMXN / kgTotal).toFixed(2)} MXN` : "—", sub: `${kgTotal.toFixed(0)} kg en período` },
            { label: "Costo por caja vendida", val: cajasTotal > 0 ? fmtUSD(totalCostosUSD / cajasTotal) : "—", sub: `${cajasTotal} cajas` },
            { label: "Ingreso por caja (liq.)", val: ingReal > 0 && cajasTotal > 0 ? fmtUSD(ingReal / cajasTotal) : "—", sub: "solo liquidaciones" },
            { label: "Margen neto por caja", val: (ingReal > 0 || ingEst > 0) && cajasTotal > 0 ? fmtUSD((ingresoTotal - totalCostosUSD) / cajasTotal) : "—", sub: "ingreso - costo" },
          ].map(({ label, val, sub }) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", padding: "9px 0", borderBottom: `1px solid ${C.border}22` }}>
              <div>
                <div style={{ fontSize: 12, color: C.textMuted }}>{label}</div>
                <div style={{ fontSize: 11, color: C.textMuted, opacity: 0.6 }}>{sub}</div>
              </div>
              <span style={{ fontSize: 15, fontWeight: 700, color: C.accentLight, fontFamily: "'DM Mono', monospace" }}>{val}</span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

// ── 4C: Tabla de eficiencia por semana ───────────────────────
function ResultadosEficienciaTab({ semanas }: { semanas: SemanaAgregada[] }) {
  const [sortCol, setSortCol] = useState<keyof SemanaAgregada>("key");
  const [sortAsc, setSortAsc] = useState(false);

  const sorted = useMemo(() => {
    return [...semanas].sort((a, b) => {
      const av = a[sortCol] as any ?? 0;
      const bv = b[sortCol] as any ?? 0;
      return sortAsc ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
    });
  }, [semanas, sortCol, sortAsc]);

  const cols: { key: keyof SemanaAgregada; label: string; fmt: (s: SemanaAgregada) => string; color?: (s: SemanaAgregada) => string }[] = [
    { key: "key", label: "Semana", fmt: s => `S${s.semana}/${s.year}` },
    { key: "kgCosechados", label: "Kg Cos.", fmt: s => s.kgCosechados > 0 ? s.kgCosechados.toFixed(0) : "—" },
    { key: "kgMerma",    label: "Kg Merma", fmt: s => s.kgMerma > 0 ? s.kgMerma.toFixed(0) : "—",
      color: s => s.mermaPct > 10 ? C.red : s.mermaPct > 5 ? C.yellow : C.textMuted },
    { key: "mermaPct",   label: "Merma %", fmt: s => s.kgCosechados > 0 ? s.mermaPct.toFixed(1) + "%" : "—",
      color: s => s.mermaPct > 10 ? C.red : s.mermaPct > 5 ? C.yellow : C.green },
    { key: "cajasVendidas", label: "Cajas Vend.", fmt: s => s.cajasVendidas > 0 ? String(s.cajasVendidas) : (s.cajasEmpaque > 0 ? `~${s.cajasEmpaque}` : "—") },
    { key: "ingReal",    label: "Ing. Real", fmt: s => s.ingReal > 0 ? fmtUSD(s.ingReal) : "—",
      color: () => C.green },
    { key: "ingEstMin",  label: "Ing. Est.",  fmt: s => s.ingEstMin > 0 ? fmtUSD(s.ingEstMin) : "—",
      color: () => C.accentLight },
    { key: "costoUSD",   label: "Costo USD", fmt: s => s.costoUSD > 0 ? fmtUSD(s.costoUSD) : "—",
      color: () => C.orange },
    { key: "costoKg",    label: "$/kg MXN", fmt: s => s.costoKg ? `$${s.costoKg.toFixed(2)}` : "—",
      color: s => (s.costoKg ?? 0) > 30 ? C.red : (s.costoKg ?? 0) > 20 ? C.yellow : C.textSecondary },
    { key: "costoCaja",  label: "$/caja", fmt: s => s.costoCaja ? fmtUSD(s.costoCaja) : "—",
      color: () => C.yellow },
    { key: "precioPromReal", label: "Precio prom.", fmt: s => s.precioPromReal ? fmtUSD(s.precioPromReal) : (s.precioPromEst > 0 ? `~${fmtUSD(s.precioPromEst)}` : "—"),
      color: s => s.precioPromReal ? C.green : C.textMuted },
    { key: "margenPct",  label: "Margen %", fmt: s => s.margenPct != null ? `${s.margenPct.toFixed(1)}%` : "—",
      color: s => (s.margenPct ?? 0) >= 20 ? C.green : (s.margenPct ?? 0) >= 10 ? C.yellow : C.red },
  ];

  const handleSort = (key: keyof SemanaAgregada) => {
    if (key === sortCol) setSortAsc(!sortAsc);
    else { setSortCol(key); setSortAsc(false); }
  };

  return (
    <Card>
      <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 6 }}>
        ⚡ Eficiencia por Semana
      </div>
      <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 16 }}>
        Click en columna para ordenar · Cruza datos de cuadres (F1), ventas (F2) y gastos (F3)
      </div>
      {semanas.length === 0 ? (
        <div style={{ textAlign: "center" as const, padding: "40px", color: C.textMuted }}>Sin datos en el período seleccionado</div>
      ) : (
        <div style={{ overflowX: "auto" as const }}>
          <table style={{ width: "100%", borderCollapse: "collapse" as const }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {cols.map(c => (
                  <th key={c.key as string} onClick={() => handleSort(c.key)} style={{
                    textAlign: "left" as const, padding: "8px 10px", fontSize: 11, fontWeight: 700,
                    color: sortCol === c.key ? C.accentLight : C.textMuted,
                    textTransform: "uppercase" as const, letterSpacing: 0.5,
                    cursor: "pointer", whiteSpace: "nowrap" as const,
                  }}>
                    {c.label}{sortCol === c.key ? (sortAsc ? " ↑" : " ↓") : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map(s => (
                <tr key={s.key} style={{ borderBottom: `1px solid ${C.border}22` }}>
                  {cols.map(c => (
                    <td key={c.key as string} style={{
                      padding: "9px 10px",
                      fontFamily: c.key === "key" ? "inherit" : "'DM Mono', monospace",
                      fontSize: 12, fontWeight: c.key === "key" ? 700 : 400,
                      color: c.color ? c.color(s) : C.text,
                      whiteSpace: "nowrap" as const,
                    }}>
                      {c.fmt(s)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            {/* Totales */}
            <tfoot>
              <tr style={{ borderTop: `2px solid ${C.border}`, background: C.surface }}>
                <td style={{ padding: "9px 10px", fontSize: 12, fontWeight: 700, color: C.textSecondary }}>TOTAL / PROM.</td>
                <td style={{ padding: "9px 10px", fontFamily: "'DM Mono', monospace", fontSize: 12, color: C.green }}>{semanas.reduce((s, r) => s + r.kgCosechados, 0).toFixed(0)}</td>
                <td style={{ padding: "9px 10px", fontFamily: "'DM Mono', monospace", fontSize: 12, color: C.orange }}>{semanas.reduce((s, r) => s + r.kgMerma, 0).toFixed(0)}</td>
                <td style={{ padding: "9px 10px", fontFamily: "'DM Mono', monospace", fontSize: 12, color: C.yellow }}>
                  {semanas.length > 0 ? (semanas.reduce((s, r) => s + r.mermaPct, 0) / semanas.length).toFixed(1) + "%" : "—"}
                </td>
                <td style={{ padding: "9px 10px", fontFamily: "'DM Mono', monospace", fontSize: 12 }}>{semanas.reduce((s, r) => s + r.cajasVendidas, 0)}</td>
                <td style={{ padding: "9px 10px", fontFamily: "'DM Mono', monospace", fontSize: 12, color: C.green, fontWeight: 700 }}>{fmtUSD(semanas.reduce((s, r) => s + r.ingReal, 0))}</td>
                <td style={{ padding: "9px 10px", fontFamily: "'DM Mono', monospace", fontSize: 12, color: C.accentLight }}>{fmtUSD(semanas.reduce((s, r) => s + r.ingEstMin, 0))}</td>
                <td style={{ padding: "9px 10px", fontFamily: "'DM Mono', monospace", fontSize: 12, color: C.orange, fontWeight: 700 }}>{fmtUSD(semanas.reduce((s, r) => s + r.costoUSD, 0))}</td>
                <td colSpan={4} style={{ padding: "9px 10px", fontSize: 11, color: C.textMuted }}>—</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </Card>
  );
}

// ── 4D: Exportar CSV ─────────────────────────────────────────
function ResultadosExportarTab({
  semanas, periodo, tipoCambio,
}: { semanas: SemanaAgregada[]; periodo: PeriodoKey; tipoCambio: number }) {

  const [done, setDone] = useState(false);

  const handleExport = () => {
    descargarCSV(semanas, tipoCambio, periodo);
    setDone(true);
    setTimeout(() => setDone(false), 3000);
  };

  // Vista previa de lo que se exporta
  const ingReal  = semanas.reduce((s, r) => s + r.ingReal, 0);
  const costoMXN = semanas.reduce((s, r) => s + r.costoMXN, 0);
  const campos = [
    "Semana / Año",
    "Kg cosechados, Kg empacados, Kg merma, Merma %",
    "Cajas empaque, Cajas vendidas",
    "Ingreso estimado mín/máx USD, Ingreso real USD",
    "Precio promedio real y estimado USD/caja",
    "Costo total MXN y USD",
    "Costo nómina, insumos y logística MXN (separados)",
    "Costo por kg MXN, Costo por caja USD",
    "Margen bruto USD y %",
    "Tipo de cambio utilizado",
  ];

  return (
    <div style={{ maxWidth: 700 }}>
      <Card style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 16 }}>📥 Exportar a CSV</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
          <div style={{ padding: "14px 16px", background: C.surface, borderRadius: 10, border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>PERÍODO SELECCIONADO</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.accentLight }}>{PERIODO_LABELS[periodo]}</div>
          </div>
          <div style={{ padding: "14px 16px", background: C.surface, borderRadius: 10, border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>SEMANAS EN EL ARCHIVO</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{semanas.length} semanas</div>
          </div>
          <div style={{ padding: "14px 16px", background: C.surface, borderRadius: 10, border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>INGRESOS REALES</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.green, fontFamily: "'DM Mono', monospace" }}>{fmtUSD(ingReal)}</div>
          </div>
          <div style={{ padding: "14px 16px", background: C.surface, borderRadius: 10, border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>COSTOS TOTALES</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.orange, fontFamily: "'DM Mono', monospace" }}>
              ${costoMXN.toLocaleString("es-MX", { maximumFractionDigits: 0 })} MXN
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.textSecondary, marginBottom: 10 }}>📋 Campos incluidos en el CSV</div>
          <div style={{ display: "flex", flexDirection: "column" as const, gap: 6 }}>
            {campos.map((c, i) => (
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.accent, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: C.textMuted }}>{c}</span>
              </div>
            ))}
          </div>
        </div>

        {semanas.length === 0 ? (
          <div style={{ padding: "16px", background: C.yellowDim, borderRadius: 9, border: `1px solid ${C.yellowBorder}`, fontSize: 13, color: C.yellow }}>
            ⚠️ No hay datos en el período seleccionado. Cambia el selector de período para exportar datos.
          </div>
        ) : (
          <Btn onClick={handleExport} variant={done ? "success" : "primary"}>
            {done ? "✅ Descargado" : `📥 Descargar CSV — ${semanas.length} semanas`}
          </Btn>
        )}
        <div style={{ marginTop: 10, fontSize: 11, color: C.textMuted }}>
          Formato: UTF-8 con BOM · Compatible con Excel, Google Sheets, Números · Nombre: moray_resultados_{periodo}_{new Date().toISOString().slice(0,10)}.csv
        </div>
      </Card>

      {/* Tabla de vista previa */}
      {semanas.length > 0 && (
        <Card>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 14 }}>👁 Vista previa (primeras 5 filas)</div>
          <div style={{ overflowX: "auto" as const }}>
            <table style={{ width: "100%", borderCollapse: "collapse" as const, fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  {["Semana", "Kg Cos.", "Cajas Vend.", "Ing. Est. USD", "Ing. Real USD", "Costo USD", "Margen %"].map(h => (
                    <th key={h} style={{ textAlign: "left" as const, padding: "6px 10px", fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase" as const }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {semanas.slice(0, 5).map(s => (
                  <tr key={s.key} style={{ borderBottom: `1px solid ${C.border}22` }}>
                    <td style={{ padding: "7px 10px", fontWeight: 700 }}>S{s.semana}/{s.year}</td>
                    <td style={{ padding: "7px 10px", fontFamily: "'DM Mono', monospace", color: C.green }}>{s.kgCosechados > 0 ? s.kgCosechados.toFixed(0) : "—"}</td>
                    <td style={{ padding: "7px 10px", fontFamily: "'DM Mono', monospace" }}>{s.cajasVendidas || s.cajasEmpaque || "—"}</td>
                    <td style={{ padding: "7px 10px", fontFamily: "'DM Mono', monospace", color: C.accentLight }}>{s.ingEstMin > 0 ? fmtUSD(s.ingEstMin) : "—"}</td>
                    <td style={{ padding: "7px 10px", fontFamily: "'DM Mono', monospace", color: C.green, fontWeight: s.ingReal > 0 ? 700 : 400 }}>{s.ingReal > 0 ? fmtUSD(s.ingReal) : "—"}</td>
                    <td style={{ padding: "7px 10px", fontFamily: "'DM Mono', monospace", color: C.orange }}>{s.costoUSD > 0 ? fmtUSD(s.costoUSD) : "—"}</td>
                    <td style={{ padding: "7px 10px", fontFamily: "'DM Mono', monospace", fontWeight: 700, color: (s.margenPct ?? 0) >= 0 ? C.green : C.red }}>{s.margenPct != null ? s.margenPct.toFixed(1) + "%" : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {semanas.length > 5 && (
              <div style={{ textAlign: "center" as const, padding: "10px", fontSize: 12, color: C.textMuted }}>
                … y {semanas.length - 5} filas más en el archivo completo
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

// ── Tab 4 wrapper — período compartido ───────────────────────
function ResultadosTab() {
  const [sub, setSub] = useState("resumen");
  const [periodo, setPeriodo] = useState<PeriodoKey>("ultimas_12");
  const { semanasPrecio, cuadres, gastosOp, tipoCambio, loading } = useFinanzas();
  const hoy = getMexDate();

  const todasSemanas = useMemo(
    () => calcSemanasAgregadas(semanasPrecio, cuadres, gastosOp, tipoCambio),
    [semanasPrecio, cuadres, gastosOp, tipoCambio],
  );

  const semanas = useMemo(
    () => filtrarPorPeriodo(todasSemanas, periodo, hoy),
    [todasSemanas, periodo, hoy],
  );

  return (
    <div>
      {/* Selector de período — compartido por todos los sub-tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, alignItems: "center", flexWrap: "wrap" as const }}>
        <span style={{ fontSize: 12, color: C.textMuted, fontWeight: 600 }}>PERÍODO:</span>
        {(Object.entries(PERIODO_LABELS) as [PeriodoKey, string][]).map(([k, label]) => (
          <button key={k} onClick={() => setPeriodo(k)}
            style={{
              padding: "7px 14px", borderRadius: 9, cursor: "pointer",
              border: `1.5px solid ${periodo === k ? C.accent : C.border}`,
              background: periodo === k ? C.accentDim : "transparent",
              color: periodo === k ? C.accentLight : C.textSecondary,
              fontSize: 12, fontWeight: 600,
            }}>
            {label}
          </button>
        ))}
        <span style={{ marginLeft: 8, fontSize: 12, color: C.textMuted }}>
          {semanas.length} semana{semanas.length !== 1 ? "s" : ""}
        </span>
      </div>

      <TabBar
        tabs={[
          { key: "resumen",    emoji: "📊", label: "Resumen" },
          { key: "pl",         emoji: "💹", label: "P&L" },
          { key: "eficiencia", emoji: "⚡", label: "Eficiencia" },
          { key: "exportar",   emoji: "📥", label: "Exportar" },
        ]}
        active={sub} onSelect={setSub}
      />
      {sub === "resumen"    && <ResultadosResumenTab    semanas={semanas} loading={loading} />}
      {sub === "pl"         && <ResultadosPLTab         semanas={semanas} />}
      {sub === "eficiencia" && <ResultadosEficienciaTab semanas={semanas} />}
      {sub === "exportar"   && <ResultadosExportarTab   semanas={semanas} periodo={periodo} tipoCambio={tipoCambio} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ROOT
// ═══════════════════════════════════════════════════════════════
function FinanzasInner() {
  const [tab, setTab] = useState("cuadre");
  const { loading } = useFinanzas();
  return (
    <div style={{ minHeight: "100vh", background: C.bg, padding: "32px 24px", fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 1340, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: C.text }}>💰 Finanzas</h1>
            {loading && <span style={{ fontSize: 12, color: C.textMuted, background: C.surface, padding: "3px 10px", borderRadius: 20, border: `1px solid ${C.border}` }}>Actualizando…</span>}
          </div>
          <p style={{ margin: "5px 0 0", color: C.textMuted, fontSize: 13 }}>Cuadre operativo · Tabulador FOB · Cobranza · Flujo de caja · Costos · P&L</p>
        </div>
        <TabBar
          tabs={[
            { key: "cuadre",     emoji: "⚖️",  label: "Cuadre Diario" },
            { key: "ventas",     emoji: "💵",  label: "Ventas" },
            { key: "costos",     emoji: "📋",  label: "Costos" },
            { key: "resultados", emoji: "📊",  label: "Resultados" },
          ]}
          active={tab} onSelect={setTab}
        />
        {tab === "cuadre"     && <CuadreDiarioTab />}
        {tab === "ventas"     && <VentasTab />}
        {tab === "costos"     && <CostosTab />}
        {tab === "resultados" && <ResultadosTab />}
      </div>
    </div>
  );
}

export default function FinanzasModule() {
  return <FinanzasProvider><FinanzasInner /></FinanzasProvider>;
}