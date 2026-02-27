import { useState, useEffect, useCallback } from "react";
import { usePermissions } from "../hooks/usePermissions";
import InventoryConfigPage from "./InventoryConfigPage";
import { supabase } from "../lib/supabaseClient";
import toast from "react-hot-toast";

/* ═══════════════════════════════════════════════════════════════
   THEME
   ═══════════════════════════════════════════════════════════════ */
const C = {
  bg: "#0f0f17", surface: "#1a1a28", card: "#1e1e2e", cardHover: "#252538",
  input: "#282840", inputBorder: "#3a3a52", inputFocus: "#4f6bf6", border: "#2a2a3e",
  text: "#f0f0f5", textSecondary: "#9999b0", textMuted: "#666680",
  accent: "#4f6bf6", accentLight: "#6b83f7", accentDim: "rgba(79,107,246,0.15)",
};

/* ═══════════════════════════════════════════════════════════════
   CATEGORY CONFIG
   ═══════════════════════════════════════════════════════════════ */
interface CatConfig {
  icon: string; label: string;
  hasReorderPoint: boolean; hasStockAlerts: boolean;
  allowSubcategories: boolean; subcategoriesLocked: boolean;
  fixedSubcategories?: string[]; protectedSubcategories?: string[];
}

const CATEGORY_CONFIG: Record<string, CatConfig> = {
  "Materiales de Empaque": { icon: "📦", label: "Materiales de Empaque", hasReorderPoint: true, hasStockAlerts: true, allowSubcategories: true, subcategoriesLocked: false },
  "Agroquímicos": { icon: "🧪", label: "Agroquímicos", hasReorderPoint: false, hasStockAlerts: false, allowSubcategories: true, subcategoriesLocked: true, fixedSubcategories: ["Fungicidas", "Insecticidas", "Bioestimulantes", "Coadyuvantes"] },
  "Fertilizantes": { icon: "🌱", label: "Fertilizantes", hasReorderPoint: true, hasStockAlerts: true, allowSubcategories: true, subcategoriesLocked: false, protectedSubcategories: ["Macronutrientes", "Micronutrientes"] },
  "Riego": { icon: "💧", label: "Riego", hasReorderPoint: true, hasStockAlerts: true, allowSubcategories: true, subcategoriesLocked: false },
  "Fumigación": { icon: "🌫️", label: "Fumigación", hasReorderPoint: true, hasStockAlerts: true, allowSubcategories: true, subcategoriesLocked: false },
  "Herramientas": { icon: "🔧", label: "Herramientas y Equipo", hasReorderPoint: true, hasStockAlerts: true, allowSubcategories: true, subcategoriesLocked: false },
  "Combustibles": { icon: "⛽", label: "Combustibles", hasReorderPoint: true, hasStockAlerts: true, allowSubcategories: false, subcategoriesLocked: true },
};
const CATEGORIES = Object.keys(CATEGORY_CONFIG);

const MOVEMENT_TYPES = [
  { value: "entrada", label: "Entrada", color: "#34d399", icon: "📥" },
  { value: "salida", label: "Salida", color: "#f87171", icon: "📤" },
  { value: "ajuste_positivo", label: "Ajuste (+)", color: "#60a5fa", icon: "➕" },
  { value: "ajuste_negativo", label: "Ajuste (−)", color: "#fb923c", icon: "➖" },
];

const MOTIVO_OPTIONS: Record<string, string[]> = {
  entrada: ["Compra", "Donación", "Transferencia", "Devolución", "Otro"],
  salida: ["Uso en campo", "Embarque", "Transferencia", "Préstamo", "Otro"],
  ajuste_positivo: ["Conteo físico", "Corrección de error", "Producto encontrado", "Otro"],
  ajuste_negativo: ["Merma", "Caducidad", "Daño", "Robo/Extravío", "Corrección de error", "Otro"],
};

const UNIT_OPTIONS = [
  { value: "pza", label: "Pieza" }, { value: "kg", label: "kg" }, { value: "L", label: "L" },
  { value: "m", label: "m" }, { value: "rollo", label: "Rollo" }, { value: "caja", label: "Caja" },
  { value: "par", label: "Par" }, { value: "bolsa", label: "Bolsa" }, { value: "paq", label: "Paquete" },
];

/* ═══════════════════════════════════════════════════════════════
   ALMACENES
   ═══════════════════════════════════════════════════════════════ */
interface Almacen {
  id: string;
  nombre: string;
  slug: string;
  activo: boolean;
}

// Mapa slug → nav_key de permiso de rancho
const RANCHO_NAV_KEY: Record<string, string> = {
  moray:   "inventario.rancho.moray",
  mojave:  "inventario.rancho.mojave",
  la_pena: "inventario.rancho.lapena",
};

/* ═══════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════ */
function getMexTimestamp(): string {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).formatToParts(new Date());
  const g = (t: string) => p.find(x => x.type === t)?.value || "00";
  return `${g("year")}-${g("month")}-${g("day")}T${g("hour")}:${g("minute")}:${g("second")}`;
}
function getMexDate(): string { return new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" }); }
function getMexTime(): string { return new Date().toLocaleTimeString("en-US", { timeZone: "America/Mexico_City", hour: "2-digit", minute: "2-digit", hour12: true }); }

function getStockStatus(stock: number, reorden: number | null) {
  if (reorden === null) return { label: "Sin control", color: C.textMuted, bg: C.surface, border: C.border };
  if (stock === 0) return { label: "Agotado", color: "#f87171", bg: "rgba(248,113,113,0.12)", border: "rgba(248,113,113,0.3)" };
  if (stock < reorden * 0.5) return { label: "Crítico", color: "#fb923c", bg: "rgba(251,146,60,0.12)", border: "rgba(251,146,60,0.3)" };
  if (stock < reorden) return { label: "Bajo", color: "#fbbf24", bg: "rgba(251,191,36,0.12)", border: "rgba(251,191,36,0.3)" };
  return { label: "Normal", color: "#34d399", bg: "rgba(52,211,153,0.12)", border: "rgba(52,211,153,0.3)" };
}

/* ═══════════════════════════════════════════════════════════════
   UI PRIMITIVES
   ═══════════════════════════════════════════════════════════════ */
const Card = ({ children, style = {}, onClick }: any) => (
  <div onClick={onClick} style={{ background: C.card, borderRadius: 14, border: `1px solid ${C.border}`, padding: 22, ...style }}>{children}</div>
);
const Btn = ({ children, onClick, variant = "primary", style = {}, disabled = false }: any) => {
  const base: any = { padding: "10px 20px", borderRadius: 10, border: "none", fontSize: 14, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer", display: "inline-flex", alignItems: "center", gap: 7, transition: "all 0.15s", opacity: disabled ? 0.4 : 1 };
  const s: any = {
    primary: { ...base, background: C.accent, color: "#fff" },
    secondary: { ...base, background: C.surface, color: C.textSecondary, border: `1.5px solid ${C.border}` },
    danger: { ...base, background: "rgba(248,113,113,0.1)", color: "#f87171", border: "1.5px solid rgba(248,113,113,0.25)" },
    ghost: { ...base, background: "transparent", color: C.textMuted, padding: "6px 10px" },
    success: { ...base, background: "rgba(52,211,153,0.15)", color: "#34d399", border: "1.5px solid rgba(52,211,153,0.3)" },
    warning: { ...base, background: "rgba(251,191,36,0.15)", color: "#fbbf24", border: "1.5px solid rgba(251,191,36,0.3)" },
  };
  return <button onClick={onClick} disabled={disabled} style={{ ...s[variant], ...style }}>{children}</button>;
};
const Input = ({ type = "text", value, onChange, placeholder, style = {}, ...rest }: any) => (
  <input type={type} value={value} onChange={(e: any) => onChange(e.target.value)} placeholder={placeholder}
    style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${C.inputBorder}`, fontSize: 14, outline: "none", boxSizing: "border-box" as const, background: C.input, color: C.text, ...style }} {...rest} />
);
const Select = ({ value, onChange, options, placeholder, style = {} }: any) => (
  <select value={value} onChange={(e: any) => onChange(e.target.value)}
    style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${C.inputBorder}`, fontSize: 14, background: C.input, color: value ? C.text : C.textMuted, outline: "none", ...style }}>
    <option value="">{placeholder || "Seleccionar..."}</option>
    {options.map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}
  </select>
);
const Label = ({ children }: any) => <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: C.textSecondary, marginBottom: 6, textTransform: "uppercase" as const, letterSpacing: 0.6 }}>{children}</label>;

const StatusPill = ({ stock, reorden }: { stock: number; reorden: number | null }) => {
  const s = getStockStatus(stock, reorden);
  return <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: s.bg, color: s.color, border: `1.5px solid ${s.border}`, textTransform: "uppercase" as const, letterSpacing: 0.4 }}>{s.label}</span>;
};

const GLOBAL_CSS = `
  * { box-sizing: border-box; }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  .inv-fade { animation: fadeIn 0.25s ease-out; }
  select:focus, input:focus { border-color: ${C.inputFocus} !important; box-shadow: 0 0 0 3px rgba(79,107,246,0.2) !important; }
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: ${C.bg}; }
  ::-webkit-scrollbar-thumb { background: ${C.inputBorder}; border-radius: 3px; }
  table { border-collapse: collapse; width: 100%; }
  th { text-align: left; padding: 11px 14px; font-size: 11px; font-weight: 700; color: ${C.textMuted}; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid ${C.border}; background: ${C.surface}; }
  td { padding: 11px 14px; font-size: 13px; color: ${C.textSecondary}; border-bottom: 1px solid ${C.border}; }
  tr:hover td { background: ${C.cardHover}; }
  option { background: ${C.card}; color: ${C.text}; }
  input[type="number"]::-webkit-inner-spin-button { opacity: 1; }
`;

/* ═══════════════════════════════════════════════════════════════
   MAIN — Stock + History (sin Config)
   ═══════════════════════════════════════════════════════════════ */
type StockFilter = "all" | "low" | "critical";

export default function InventoryModule() {
  const [items, setItems] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState(CATEGORIES[0]);
  const [view, setView] = useState<"stock" | "history" | "config">("stock");
  const [movModal, setMovModal] = useState<any>(null);
  const [historyItem, setHistoryItem] = useState<any>(null);
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");

  // ── Multi-almacén ──
  const [almacenes, setAlmacenes] = useState<Almacen[]>([]);
  const [almacenActivo, setAlmacenActivo] = useState<Almacen | null>(null);
  const [loadingAlmacenes, setLoadingAlmacenes] = useState(true);

  const { canView, isAdmin } = usePermissions();

  // Mapa de categoria DB → nav_key de permisos
  const CAT_NAV_KEY: Record<string, string> = {
    "Materiales de Empaque": "inventario.cat.empaque",
    "Agroquímicos":          "inventario.cat.agroquimicos",
    "Fertilizantes":         "inventario.cat.fertilizantes",
    "Riego":                 "inventario.cat.riego",
    "Fumigación":            "inventario.cat.fumigacion",
    "Herramientas":          "inventario.cat.herramientas",
    "Combustibles":          "inventario.cat.combustibles",
  };
  const VISIBLE_CATEGORIES = CATEGORIES.filter(cat => canView(CAT_NAV_KEY[cat] ?? ""));

  // ── Cargar almacenes y filtrar por permisos ──
  useEffect(() => {
    const fetchAlmacenes = async () => {
      setLoadingAlmacenes(true);
      try {
        const { data, error } = await supabase
          .from("almacenes")
          .select("*")
          .eq("activo", true)
          .order("nombre");
        if (error) throw error;

        const todos = data || [];
        // Admin ve todos; usuarios normales solo los que tienen permiso de rancho
        const visibles = isAdmin
          ? todos
          : todos.filter(a => canView(RANCHO_NAV_KEY[a.slug] ?? ""));

        setAlmacenes(visibles);
        // Seleccionar automáticamente el primer rancho visible
        if (visibles.length > 0) setAlmacenActivo(visibles[0]);
      } catch (e) { console.error(e); }
      finally { setLoadingAlmacenes(false); }
    };
    fetchAlmacenes();
  }, [isAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch de ítems — siempre filtrado por almacenActivo ──
  const fetchItems = useCallback(async () => {
    if (!almacenActivo) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("inventario_items")
        .select("*")
        .eq("activo", true)
        .eq("almacen_id", almacenActivo.id)
        .order("categoria")
        .order("subcategoria")
        .order("nombre");
      if (error) throw error;
      setItems(data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [almacenActivo]);

  // ── Fetch de movimientos — siempre filtrado por almacenActivo ──
  const fetchMovements = useCallback(async (opts?: { itemId?: number; category?: string }) => {
    if (!almacenActivo) return;
    try {
      let q = supabase
        .from("inventario_movimientos")
        .select("*, inventario_items(nombre, unidad, categoria)")
        .eq("almacen_id", almacenActivo.id)
        .order("fecha_hora", { ascending: false })
        .limit(500);

      if (opts?.itemId) {
        q = q.eq("item_id", opts.itemId);
      } else if (opts?.category) {
        const { data: catItems } = await supabase
          .from("inventario_items")
          .select("id")
          .eq("categoria", opts.category)
          .eq("almacen_id", almacenActivo.id);
        const ids = (catItems || []).map((i: any) => i.id);
        if (ids.length > 0) q = q.in("item_id", ids);
        else { setMovements([]); return; }
      }
      const { data, error } = await q;
      if (error) throw error;
      setMovements(data || []);
    } catch (e) { console.error(e); }
  }, [almacenActivo]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  useEffect(() => {
    if (view === "history") {
      if (historyItem) fetchMovements({ itemId: historyItem.id });
      else fetchMovements({ category: activeCategory });
    } else {
      fetchMovements({ category: activeCategory });
    }
  }, [view, activeCategory, historyItem, fetchMovements]);

  // ── Cambiar de rancho: resetear estado de UI ──
  const handleCambiarAlmacen = (almacen: Almacen) => {
    setAlmacenActivo(almacen);
    setView("stock");
    setHistoryItem(null);
    setStockFilter("all");
    setActiveCategory(CATEGORIES[0]);
  };

  // ── Computed values ──
  const catItems = items.filter(i => i.categoria === activeCategory);
  const totalItems = items.length;
  const alertItems = items.filter(i => i.punto_reorden !== null && i.stock_actual < i.punto_reorden).length;
  const criticalItems = items.filter(i => i.stock_actual === 0 && i.punto_reorden !== null).length;
  const todayMov = movements.filter(m => m.fecha_hora?.substring(0, 10) === getMexDate()).length;

  const filteredCatItems = (() => {
    if (stockFilter === "low") return catItems.filter(i => i.punto_reorden !== null && i.stock_actual < i.punto_reorden && i.stock_actual > 0);
    if (stockFilter === "critical") return catItems.filter(i => i.stock_actual === 0 && i.punto_reorden !== null);
    return catItems;
  })();
  const filteredSubcats = [...new Set(filteredCatItems.map(i => i.subcategoria).filter(Boolean))] as string[];

  const handleStatClick = (filter: StockFilter) => {
    setView("stock");
    setHistoryItem(null);
    setStockFilter(prev => prev === filter ? "all" : filter);
  };

  // ── Pantalla de carga inicial (almacenes) ──
  if (loadingAlmacenes) {
    return (
      <div style={{ fontFamily: "'DM Sans', sans-serif", background: C.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: C.textMuted }}>
        Cargando inventario...
      </div>
    );
  }

  // ── Sin acceso a ningún rancho ──
  if (!almacenActivo) {
    return (
      <div style={{ fontFamily: "'DM Sans', sans-serif", background: C.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", color: C.textMuted }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: C.textSecondary }}>Sin acceso al inventario</div>
          <div style={{ fontSize: 13, marginTop: 6 }}>Contacta al administrador para solicitar permisos.</div>
        </div>
      </div>
    );
  }

  const mostrarTabsRancho = almacenes.length > 1;

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: C.bg, minHeight: "100vh", color: C.text }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      <style>{GLOBAL_CSS}</style>

      {/* ── HEADER ── */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "16px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 24 }}>📋</span>
            <div>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
                Inventario General
                {mostrarTabsRancho && (
                  <span style={{ marginLeft: 10, fontSize: 14, fontWeight: 500, color: C.textMuted }}>
                    — {almacenActivo.nombre}
                  </span>
                )}
              </h1>
              <p style={{ margin: 0, fontSize: 12, color: C.textMuted }}>{getMexDate()} · {getMexTime()}</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {canView("inventario.stock")     && <Btn variant={view === "stock"   ? "primary" : "secondary"} onClick={() => { setView("stock");   setHistoryItem(null); setStockFilter("all"); }}>📊 Stock</Btn>}
            {canView("inventario.historial") && <Btn variant={view === "history" ? "primary" : "secondary"} onClick={() => { setView("history"); setHistoryItem(null); }}>📜 Historial</Btn>}
            {(isAdmin || canView("inventario.configuracion")) && <Btn variant={view === "config" ? "primary" : "secondary"} onClick={() => setView("config")}>⚙️ Configuración</Btn>}
          </div>
        </div>

        {/* ── TABS DE RANCHO — solo si hay acceso a 2+ almacenes ── */}
        {mostrarTabsRancho && (
          <div style={{ display: "flex", gap: 0, marginTop: 12, borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
            {almacenes.map(a => (
              <button key={a.id} onClick={() => handleCambiarAlmacen(a)}
                style={{
                  padding: "8px 20px", border: "none", background: "none", cursor: "pointer",
                  fontSize: 13, fontWeight: almacenActivo.id === a.id ? 700 : 500,
                  color: almacenActivo.id === a.id ? C.accent : C.textMuted,
                  borderBottom: almacenActivo.id === a.id ? `2.5px solid ${C.accent}` : "2.5px solid transparent",
                  transition: "all 0.15s", whiteSpace: "nowrap",
                }}>
                {a.nombre}
              </button>
            ))}
          </div>
        )}
      </div>

      <main style={{ padding: 24, maxWidth: 1280, margin: "0 auto" }}>
        {/* ── STAT CARDS ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
          {([
            { label: "Items Registrados",  value: totalItems,    color: C.accent,                                    filter: "all"      as StockFilter },
            { label: "Alertas Stock Bajo", value: alertItems,    color: alertItems   > 0 ? "#fbbf24" : "#34d399",   filter: "low"      as StockFilter },
            { label: "Items Agotados",     value: criticalItems, color: criticalItems > 0 ? "#f87171" : "#34d399",  filter: "critical" as StockFilter },
            { label: "Movimientos Hoy",    value: todayMov,      color: C.accent,                                    filter: null },
          ]).map((s, i) => (
            <Card key={i}
              onClick={s.filter !== null ? () => handleStatClick(s.filter!) : undefined}
              style={{
                cursor: s.filter !== null ? "pointer" : "default",
                transition: "all 0.15s",
                border: stockFilter === s.filter && s.filter !== "all" ? `2px solid ${s.color}` : `1px solid ${C.border}`,
                transform: stockFilter === s.filter && s.filter !== "all" ? "scale(1.02)" : "scale(1)",
              }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.6 }}>{s.label}</div>
              <div style={{ fontSize: 36, fontWeight: 700, color: s.color, marginTop: 6, fontFamily: "'DM Mono', monospace", lineHeight: 1 }}>{loading ? "..." : s.value}</div>
              {stockFilter === s.filter && s.filter !== "all" && <div style={{ fontSize: 10, color: s.color, marginTop: 6, fontWeight: 600 }}>FILTRO ACTIVO — click para quitar</div>}
            </Card>
          ))}
        </div>

        {/* ── CATEGORY TABS ── */}
        <div style={{ display: "flex", gap: 0, marginBottom: 20, overflowX: "auto", background: C.surface, borderRadius: 12, border: `1px solid ${C.border}` }}>
          {VISIBLE_CATEGORIES.map(cat => {
            const cfg = CATEGORY_CONFIG[cat];
            return (
              <button key={cat} onClick={() => { setActiveCategory(cat); setHistoryItem(null); setStockFilter("all"); }}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "12px 18px", border: "none", background: "none", fontSize: 13, fontWeight: activeCategory === cat ? 700 : 500, cursor: "pointer", whiteSpace: "nowrap", color: activeCategory === cat ? C.accent : C.textMuted, transition: "all 0.15s", borderBottom: activeCategory === cat ? `2.5px solid ${C.accent}` : "2.5px solid transparent" }}>
                <span>{cfg.icon}</span> {cfg.label}
              </button>
            );
          })}
        </div>

        {/* Filter active indicator */}
        {stockFilter !== "all" && view === "stock" && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, padding: "8px 14px", background: C.surface, borderRadius: 10, border: `1px solid ${C.border}` }}>
            <span style={{ fontSize: 13, color: C.textSecondary }}>
              Mostrando: <strong style={{ color: C.text }}>{stockFilter === "low" ? "Stock bajo" : "Agotados"}</strong> en {CATEGORY_CONFIG[activeCategory]?.icon} {activeCategory}
              {filteredCatItems.length === 0 && " — sin resultados"}
            </span>
            <Btn variant="ghost" style={{ fontSize: 11, marginLeft: "auto" }} onClick={() => setStockFilter("all")}>✕ Quitar filtro</Btn>
          </div>
        )}

        {/* ── VIEWS ── */}
        {view === "stock"   && canView("inventario.stock")     && <StockView items={filteredCatItems} subcategories={filteredSubcats} loading={loading} category={activeCategory} onRegisterMovement={(item: any) => setMovModal(item)} onViewHistory={(item: any) => { setHistoryItem(item); setView("history"); }} />}
        {view === "history" && canView("inventario.historial") && <HistoryView movements={movements} historyItem={historyItem} activeCategory={activeCategory} loading={loading} onBack={() => { setView("stock"); setHistoryItem(null); }} onClearFilter={() => setHistoryItem(null)} />}
        {view === "config"  && (isAdmin || canView("inventario.configuracion")) && <InventoryConfigPage embedded almacenId={almacenActivo.id} almacenNombre={almacenActivo.nombre} />}
        {view === "config"  && !isAdmin && !canView("inventario.configuracion") && <div style={{ padding: 48, textAlign: "center", color: "#666680" }}>🔒 Sin acceso a configuración</div>}
      </main>

      {movModal && (
        <MovementModal
          item={movModal}
          almacenId={almacenActivo.id}
          onClose={() => setMovModal(null)}
          onSaved={() => { setMovModal(null); fetchItems(); fetchMovements({ category: activeCategory }); }}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   STOCK VIEW
   ═══════════════════════════════════════════════════════════════ */
function StockView({ items, subcategories, loading, category, onRegisterMovement, onViewHistory }: any) {
  const config = CATEGORY_CONFIG[category];
  if (loading) return <Card><div style={{ textAlign: "center", padding: 40, color: C.textMuted }}>Cargando inventario...</div></Card>;
  if (items.length === 0) return <Card><div style={{ textAlign: "center", padding: 40, color: C.textMuted }}>No hay items que coincidan con el filtro.</div></Card>;

  const headers = ["Nombre", "Código", "Stock"];
  if (config.hasReorderPoint) headers.push("Reorden");
  if (config.hasStockAlerts) headers.push("Estado");
  headers.push("Acciones");

  const renderRow = (item: any) => {
    const pct = item.punto_reorden ? Math.min((item.stock_actual / item.punto_reorden) * 100, 100) : 100;
    const status = getStockStatus(item.stock_actual, item.punto_reorden);
    return (
      <tr key={item.id}>
        <td style={{ fontWeight: 600, color: C.text }}>{item.nombre}</td>
        <td style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: C.textMuted }}>{item.codigo}</td>
        <td>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontWeight: 700, fontFamily: "'DM Mono', monospace", color: C.text, fontSize: 16, minWidth: 50, textAlign: "right" }}>{item.stock_actual}</span>
            <span style={{ fontSize: 11, color: C.textMuted }}>{item.unidad}</span>
          </div>
        </td>
        {config.hasReorderPoint && (
          <td>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 60, height: 6, background: C.input, borderRadius: 3, overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: status.color, borderRadius: 3 }} />
              </div>
              <span style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: C.textMuted }}>{item.punto_reorden}</span>
            </div>
          </td>
        )}
        {config.hasStockAlerts && <td><StatusPill stock={item.stock_actual} reorden={item.punto_reorden} /></td>}
        <td>
          <div style={{ display: "flex", gap: 4 }}>
            <Btn variant="success" style={{ padding: "6px 12px", fontSize: 12 }} onClick={() => onRegisterMovement(item)}>📥 Movimiento</Btn>
            <Btn variant="ghost" style={{ padding: "6px 8px" }} onClick={() => onViewHistory(item)}>🕐</Btn>
          </div>
        </td>
      </tr>
    );
  };

  const renderTable = (list: any[], title?: string) => (
    <Card key={title || "all"} style={{ marginBottom: 16 }}>
      {title && <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 700, color: C.text }}>{title} <span style={{ fontSize: 12, fontWeight: 500, color: C.textMuted }}>({list.length} items)</span></h3>}
      <div style={{ overflowX: "auto" }}>
        <table><thead><tr>{headers.map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{list.map(renderRow)}</tbody></table>
      </div>
    </Card>
  );

  return (
    <div className="inv-fade">
      {subcategories.length > 0
        ? subcategories.map(sub => renderTable(items.filter((i: any) => i.subcategoria === sub), sub))
        : renderTable(items, `${config.icon} ${config.label}`)}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   HISTORY VIEW — con filtro de fecha, usuario, tipo
   ═══════════════════════════════════════════════════════════════ */
function HistoryView({ movements, historyItem, activeCategory, loading, onBack, onClearFilter }: any) {
  const [filterType, setFilterType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filterUser, setFilterUser] = useState("");
  const cfg = CATEGORY_CONFIG[activeCategory];

  // Get unique users from movements
  const uniqueUsers = [...new Set(movements.map((m: any) => m.usuario).filter(Boolean))];

  // Apply all filters
  const filtered = movements.filter((m: any) => {
    if (filterType && m.tipo !== filterType) return false;
    if (filterUser && m.usuario !== filterUser) return false;
    if (dateFrom) {
      const movDate = m.fecha_hora?.substring(0, 10);
      if (movDate && movDate < dateFrom) return false;
    }
    if (dateTo) {
      const movDate = m.fecha_hora?.substring(0, 10);
      if (movDate && movDate > dateTo) return false;
    }
    return true;
  });

  const clearFilters = () => { setFilterType(""); setDateFrom(""); setDateTo(""); setFilterUser(""); };

  const hasActiveFilters = filterType || dateFrom || dateTo || filterUser;

  return (
    <div className="inv-fade">
      {/* ── Top bar ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Btn variant="secondary" onClick={onBack}>← Stock</Btn>
          {historyItem ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{historyItem.nombre}</span>
              <span style={{ fontSize: 12, color: C.textMuted }}>({historyItem.codigo})</span>
              <Btn variant="ghost" onClick={onClearFilter} style={{ fontSize: 11 }}>✕ Ver categoría</Btn>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: C.accent }}>{cfg?.icon} {cfg?.label}</span>
              <span style={{ fontSize: 12, color: C.textMuted }}>({filtered.length} movimientos)</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Filters ── */}
      <Card style={{ marginBottom: 16, padding: 16 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end" }}>
          {/* Tipo */}
          <div style={{ minWidth: 130 }}>
            <Label>Tipo</Label>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {[{ value: "", label: "Todos" }, ...MOVEMENT_TYPES.map(t => ({ value: t.value, label: t.label }))].map(t => (
                <Btn key={t.value} variant={filterType === t.value ? "primary" : "secondary"} onClick={() => setFilterType(t.value)} style={{ padding: "5px 10px", fontSize: 11 }}>{t.label}</Btn>
              ))}
            </div>
          </div>

          {/* Fecha desde */}
          <div style={{ minWidth: 140 }}>
            <Label>Desde</Label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              style={{ padding: "8px 10px", borderRadius: 8, border: `1.5px solid ${C.inputBorder}`, background: C.input, color: C.text, fontSize: 13, outline: "none" }} />
          </div>

          {/* Fecha hasta */}
          <div style={{ minWidth: 140 }}>
            <Label>Hasta</Label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              style={{ padding: "8px 10px", borderRadius: 8, border: `1.5px solid ${C.inputBorder}`, background: C.input, color: C.text, fontSize: 13, outline: "none" }} />
          </div>

          {/* Usuario */}
          {uniqueUsers.length > 1 && (
            <div style={{ minWidth: 140 }}>
              <Label>Usuario</Label>
              <Select value={filterUser} onChange={setFilterUser} options={uniqueUsers.map(u => ({ value: u, label: u }))} placeholder="Todos"
                style={{ padding: "8px 10px", fontSize: 13 }} />
            </div>
          )}

          {/* Clear */}
          {hasActiveFilters && (
            <Btn variant="ghost" onClick={clearFilters} style={{ fontSize: 11, alignSelf: "end", marginBottom: 2 }}>✕ Limpiar filtros</Btn>
          )}
        </div>
      </Card>

      {/* ── Table ── */}
      <Card>
        {loading ? <div style={{ textAlign: "center", padding: 40, color: C.textMuted }}>Cargando...</div> :
        filtered.length === 0 ? <div style={{ textAlign: "center", padding: 40, color: C.textMuted }}>📜 No hay movimientos{hasActiveFilters ? " con los filtros seleccionados" : ""}.</div> : (
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead><tr><th>Fecha/Hora</th><th>Item</th><th>Tipo</th><th>Cant.</th><th>Motivo</th><th>Usuario</th><th>Notas</th></tr></thead>
              <tbody>{filtered.map((m: any) => {
                const mt = MOVEMENT_TYPES.find(t => t.value === m.tipo);
                const isNeg = m.tipo === "salida" || m.tipo === "ajuste_negativo";
                const dt = m.fecha_hora ? new Date(m.fecha_hora).toLocaleString("es-MX", { timeZone: "America/Mexico_City", day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";
                return (
                  <tr key={m.id}>
                    <td style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: C.textMuted, whiteSpace: "nowrap" }}>{dt}</td>
                    <td style={{ fontWeight: 600, color: C.text }}>{m.inventario_items?.nombre || "—"}</td>
                    <td><span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 8, fontSize: 11, fontWeight: 700, background: `${mt?.color}18`, color: mt?.color }}>{mt?.icon} {mt?.label}</span></td>
                    <td style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700, color: isNeg ? "#f87171" : "#34d399", fontSize: 15 }}>{isNeg ? "−" : "+"}{m.cantidad} <span style={{ fontSize: 11, fontWeight: 400, color: C.textMuted }}>{m.inventario_items?.unidad}</span></td>
                    <td>{m.motivo}</td>
                    <td style={{ fontSize: 12, color: C.textMuted }}>{m.usuario}</td>
                    <td style={{ fontSize: 12, color: C.textMuted, maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.notas || "—"}</td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MOVEMENT MODAL
   ═══════════════════════════════════════════════════════════════ */
function MovementModal({ item, almacenId, onClose, onSaved }: any) {
  const [tipo, setTipo] = useState("entrada");
  const [cantidad, setCantidad] = useState("");
  const [motivo, setMotivo] = useState("");
  const [motivoCustom, setMotivoCustom] = useState("");
  const [usuario, setUsuario] = useState("");
  const [notas, setNotas] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const status = getStockStatus(item.stock_actual, item.punto_reorden);
  const isExit = tipo === "salida" || tipo === "ajuste_negativo";
  const cantNum = parseInt(cantidad) || 0;
  const stockInsuf = isExit && cantNum > item.stock_actual;
  const finalMotivo = motivo === "Otro" ? motivoCustom : motivo;

  const submit = async () => {
    if (!cantidad || cantNum <= 0) { toast.error("Ingrese cantidad válida"); return; }
    if (!finalMotivo || finalMotivo.length < 3) { toast.error("Ingrese motivo válido"); return; }
    if (stockInsuf) { toast.error(`Stock insuficiente (${item.stock_actual} ${item.unidad})`); return; }
    setSubmitting(true);
    try {
      const { error } = await supabase.from("inventario_movimientos").insert({
        item_id: item.id, tipo, cantidad: cantNum, motivo: finalMotivo,
        usuario: usuario || "operador", notas: notas || null, fecha_hora: getMexTimestamp(),
        almacen_id: almacenId,
      });
      if (error) throw error;
      toast.success(`${isExit ? "−" : "+"}${cantNum} ${item.unidad} de ${item.nombre}`);
      onSaved();
    } catch { toast.error("Error al registrar"); }
    finally { setSubmitting(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }} onClick={onClose}>
      <div style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, padding: 28, width: 520, maxHeight: "90vh", overflowY: "auto" }} onClick={(e: any) => e.stopPropagation()} className="inv-fade">

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 20 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Registrar Movimiento</h3>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: C.textMuted }}>{item.nombre} ({item.codigo})</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.textMuted, fontSize: 20, cursor: "pointer" }}>✕</button>
        </div>

        <div style={{ background: C.surface, padding: 14, borderRadius: 10, border: `1px solid ${C.border}`, marginBottom: 18, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase" }}>Stock Actual</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: C.text, fontFamily: "'DM Mono', monospace" }}>{item.stock_actual} <span style={{ fontSize: 14, color: C.textMuted, fontWeight: 400 }}>{item.unidad}</span></div>
          </div>
          <span style={{ padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: status.bg, color: status.color, border: `1.5px solid ${status.border}`, textTransform: "uppercase" }}>{status.label}</span>
        </div>

        <Label>Tipo de Movimiento</Label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 16 }}>
          {MOVEMENT_TYPES.map(t => (
            <button key={t.value} onClick={() => { setTipo(t.value); setMotivo(""); }}
              style={{ padding: "10px 8px", borderRadius: 10, border: `1.5px solid ${tipo === t.value ? t.color : C.border}`, background: tipo === t.value ? `${t.color}18` : C.surface, cursor: "pointer", textAlign: "center", color: tipo === t.value ? t.color : C.textMuted, fontSize: 12, fontWeight: 600 }}>
              <div style={{ fontSize: 18 }}>{t.icon}</div>{t.label}
            </button>
          ))}
        </div>

        <div style={{ marginBottom: 16 }}>
          <Label>Cantidad ({item.unidad})</Label>
          <Input type="number" value={cantidad} onChange={setCantidad} placeholder="0" min="1"
            style={stockInsuf ? { borderColor: "#f87171", background: "rgba(248,113,113,0.05)" } : {}} />
          {stockInsuf && <p style={{ margin: "4px 0 0", fontSize: 12, color: "#f87171" }}>⚠ Stock insuficiente ({item.stock_actual} {item.unidad})</p>}
          {cantNum > 0 && !stockInsuf && <p style={{ margin: "4px 0 0", fontSize: 12, color: C.textMuted }}>Resultante: <strong style={{ color: C.text }}>{isExit ? item.stock_actual - cantNum : item.stock_actual + cantNum} {item.unidad}</strong></p>}
        </div>

        <div style={{ marginBottom: 16 }}>
          <Label>Motivo</Label>
          <Select value={motivo} onChange={setMotivo} options={(MOTIVO_OPTIONS[tipo] || []).map(m => ({ value: m, label: m }))} placeholder="Seleccionar motivo..." />
          {motivo === "Otro" && <Input value={motivoCustom} onChange={setMotivoCustom} placeholder="Describa el motivo..." style={{ marginTop: 8 }} />}
        </div>

        <div style={{ marginBottom: 16 }}>
          <Label>Registrado por</Label>
          <Input value={usuario} onChange={setUsuario} placeholder="Nombre del operador..." />
        </div>

        <div style={{ marginBottom: 20 }}>
          <Label>Notas (opcional)</Label>
          <Input value={notas} onChange={setNotas} placeholder="Observaciones..." />
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <Btn variant="secondary" onClick={onClose}>Cancelar</Btn>
          <Btn onClick={submit} disabled={submitting || !cantidad || cantNum <= 0 || !finalMotivo || stockInsuf} style={{ padding: "12px 28px" }}>
            {submitting ? "Guardando..." : `💾 Registrar ${MOVEMENT_TYPES.find(t => t.value === tipo)?.label}`}
          </Btn>
        </div>
      </div>
    </div>
  );
}