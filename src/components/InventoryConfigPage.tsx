import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";
import toast from "react-hot-toast";

/* ═══════════════════════════════════════════════════════════════
   THEME (same as InventoryModule)
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

const UNIT_OPTIONS = [
  { value: "pza", label: "Pieza (pza)" }, { value: "kg", label: "Kilogramo (kg)" },
  { value: "L", label: "Litro (L)" }, { value: "m", label: "Metro (m)" },
  { value: "rollo", label: "Rollo" }, { value: "caja", label: "Caja" },
  { value: "par", label: "Par" }, { value: "bolsa", label: "Bolsa" }, { value: "paq", label: "Paquete" },
];

/* ═══════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════ */
function getMexTimestamp(): string {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).formatToParts(new Date());
  const g = (t: string) => p.find(x => x.type === t)?.value || "00";
  return `${g("year")}-${g("month")}-${g("day")}T${g("hour")}:${g("minute")}:${g("second")}`;
}

/* ═══════════════════════════════════════════════════════════════
   UI PRIMITIVES
   ═══════════════════════════════════════════════════════════════ */
const Card = ({ children, style = {} }: any) => (
  <div style={{ background: C.card, borderRadius: 14, border: `1px solid ${C.border}`, padding: 22, ...style }}>{children}</div>
);
const Btn = ({ children, onClick, variant = "primary", style = {}, disabled = false }: any) => {
  const base: any = { padding: "10px 20px", borderRadius: 10, border: "none", fontSize: 14, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer", display: "inline-flex", alignItems: "center", gap: 7, transition: "all 0.15s", opacity: disabled ? 0.4 : 1 };
  const styles: any = {
    primary: { ...base, background: C.accent, color: "#fff" },
    secondary: { ...base, background: C.surface, color: C.textSecondary, border: `1.5px solid ${C.border}` },
    danger: { ...base, background: "rgba(248,113,113,0.1)", color: "#f87171", border: "1.5px solid rgba(248,113,113,0.25)" },
    ghost: { ...base, background: "transparent", color: C.textMuted, padding: "6px 10px" },
  };
  return <button onClick={onClick} disabled={disabled} style={{ ...styles[variant], ...style }}>{children}</button>;
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
const Badge = ({ children, color, bg }: any) => <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 12, fontSize: 11, fontWeight: 700, background: bg, color }}>{children}</span>;

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
`;

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE — Configuración de Inventario
   ═══════════════════════════════════════════════════════════════ */
export default function InventoryConfigPage({
  embedded = false,
  almacenId,
  almacenNombre,
}: {
  embedded?: boolean;
  almacenId?: string;
  almacenNombre?: string;
} = {}) {
  const [items, setItems] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      let itemsQ = supabase.from("inventario_items").select("*").order("categoria").order("subcategoria").order("nombre");
      if (almacenId) itemsQ = itemsQ.eq("almacen_id", almacenId);

      let movsQ = supabase.from("inventario_movimientos").select("id, item_id").limit(5000);
      if (almacenId) movsQ = movsQ.eq("almacen_id", almacenId);

      const [itemsRes, movRes] = await Promise.all([itemsQ, movsQ]);
      if (itemsRes.error) throw itemsRes.error;
      setItems(itemsRes.data || []);
      setMovements(movRes.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [almacenId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: C.bg, minHeight: embedded ? "unset" : "100vh", color: C.text }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      <style>{GLOBAL_CSS}</style>
      <div style={{ padding: 24, maxWidth: 1280, margin: "0 auto" }}>
        <ConfigView items={items} loading={loading} onRefresh={fetchAll} movements={movements} almacenId={almacenId} almacenNombre={almacenNombre} />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CONFIG VIEW (accordion CRUD)
   ═══════════════════════════════════════════════════════════════ */
function ConfigView({ items, loading, onRefresh, movements, almacenId, almacenNombre }: any) {
  const [expandedCat, setExpandedCat] = useState<string | null>(CATEGORIES[0]);
  const [editItem, setEditItem] = useState<any>(null);
  const [editCat, setEditCat] = useState("");
  const [search, setSearch] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  const searchResults = search
    ? items.filter((i: any) => i.nombre.toLowerCase().includes(search.toLowerCase()) || i.codigo.toLowerCase().includes(search.toLowerCase()))
    : [];

  const itemHasMovements = useCallback((itemId: number) => {
    return movements.some((m: any) => m.item_id === itemId);
  }, [movements]);

  const openNewItem = (cat: string, subcat?: string) => {
    const cfg = CATEGORY_CONFIG[cat];
    setEditCat(cat);
    setEditItem({
      categoria: cat, subcategoria: subcat || null,
      nombre: "", codigo: "", unidad: "pza",
      punto_reorden: cfg.hasReorderPoint ? 10 : null,
      stock_minimo: cfg.hasReorderPoint ? 0 : 0,
      activo: true,
    });
  };

  const toggleActive = async (item: any) => {
    const next = !item.activo;
    try {
      const { error } = await supabase.from("inventario_items").update({ activo: next, updated_at: new Date().toISOString() }).eq("id", item.id);
      if (error) throw error;
      await supabase.from("inventario_audit").insert({ registro_id: item.id, campo: "activo", valor_anterior: String(item.activo), valor_nuevo: String(next), accion: next ? "reactivar" : "desactivar", usuario: "admin", fecha_hora: getMexTimestamp() });
      toast.success(next ? `${item.nombre} reactivado` : `${item.nombre} desactivado`);
      onRefresh();
    } catch { toast.error("Error al cambiar estado"); }
  };

  const deleteItem = async (item: any) => {
    if (item.protegido) { toast.error("Item protegido — no se puede eliminar"); return; }
    if (itemHasMovements(item.id)) { toast.error("Tiene movimientos — solo puede desactivar"); return; }
    try {
      const { error } = await supabase.from("inventario_items").delete().eq("id", item.id);
      if (error) throw error;
      await supabase.from("inventario_audit").insert({ registro_id: item.id, campo: "registro", valor_anterior: item.nombre, valor_nuevo: null, accion: "eliminar", usuario: "admin", fecha_hora: getMexTimestamp() });
      toast.success(`${item.nombre} eliminado`);
      setConfirmDelete(null);
      onRefresh();
    } catch { toast.error("Error al eliminar"); }
  };

  const renderConfigTable = (list: any[], cfg: CatConfig) => {
    if (list.length === 0) return <p style={{ color: C.textMuted, fontSize: 13, margin: "8px 0" }}>Sin items registrados.</p>;
    return (
      <div style={{ overflowX: "auto" }}>
        <table>
          <thead><tr>
            <th>Nombre</th><th>Código</th><th>Unidad</th>
            {cfg.hasReorderPoint && <th>Reorden</th>}
            {cfg.hasReorderPoint && <th>Stk. Mín.</th>}
            <th>Stock</th><th>Estado</th><th>Acciones</th>
          </tr></thead>
          <tbody>{list.map((item: any) => (
            <tr key={item.id} style={{ opacity: item.activo ? 1 : 0.45 }}>
              <td style={{ fontWeight: 600, color: item.activo ? C.text : C.textMuted }}>
                {item.nombre} {item.protegido && <span title="Protegido" style={{ fontSize: 11 }}>🔒</span>}
              </td>
              <td style={{ fontFamily: "'DM Mono', monospace", fontSize: 12 }}>{item.codigo}</td>
              <td>{item.unidad}</td>
              {cfg.hasReorderPoint && <td style={{ fontFamily: "'DM Mono', monospace" }}>{item.punto_reorden ?? "—"}</td>}
              {cfg.hasReorderPoint && <td style={{ fontFamily: "'DM Mono', monospace" }}>{item.stock_minimo ?? 0}</td>}
              <td style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700, color: C.text }}>{item.stock_actual}</td>
              <td>
                <button onClick={() => { if (!item.protegido) toggleActive(item); }}
                  style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, border: "none", cursor: item.protegido ? "not-allowed" : "pointer",
                    background: item.activo ? "rgba(52,211,153,0.12)" : "rgba(248,113,113,0.12)",
                    color: item.activo ? "#34d399" : "#f87171" }} disabled={item.protegido}>
                  {item.activo ? "Activo" : "Inactivo"}
                </button>
              </td>
              <td>
                <div style={{ display: "flex", gap: 4 }}>
                  <Btn variant="ghost" onClick={() => { setEditCat(item.categoria); setEditItem({ ...item }); }} style={{ fontSize: 12 }}>✏️</Btn>
                  {confirmDelete === item.id ? (
                    <Btn variant="danger" style={{ fontSize: 11, padding: "4px 10px" }} onClick={() => deleteItem(item)}>¿Confirmar?</Btn>
                  ) : (
                    <Btn variant="ghost" onClick={() => {
                      if (item.protegido) { toast.error("Item protegido"); return; }
                      if (itemHasMovements(item.id)) { toast.error("Tiene movimientos — use desactivar"); return; }
                      setConfirmDelete(item.id);
                      setTimeout(() => setConfirmDelete(null), 3000);
                    }} style={{ fontSize: 12, color: "#f87171" }}>🗑</Btn>
                  )}
                </div>
              </td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    );
  };

  if (loading) return <Card><div style={{ textAlign: "center", padding: 40, color: C.textMuted }}>Cargando configuración de inventario...</div></Card>;

  return (
    <div className="inv-fade">
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>
            📋 Inventario General
            {almacenNombre && <span style={{ fontSize: 15, fontWeight: 500, color: C.textMuted, marginLeft: 10 }}>— {almacenNombre}</span>}
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: C.textMuted }}>Gestionar categorías, items, puntos de reorden y stock mínimo</p>
        </div>
        <Input value={search} onChange={setSearch} placeholder="🔍 Buscar item por nombre o código..." style={{ width: 320 }} />
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Total Items", value: items.length, color: C.accent },
          { label: "Activos", value: items.filter((i: any) => i.activo).length, color: "#34d399" },
          { label: "Inactivos", value: items.filter((i: any) => !i.activo).length, color: "#f87171" },
          { label: "Categorías", value: CATEGORIES.length, color: C.accentLight },
        ].map((s, i) => (
          <Card key={i} style={{ padding: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.5 }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: s.color, fontFamily: "'DM Mono', monospace", lineHeight: 1, marginTop: 4 }}>{s.value}</div>
          </Card>
        ))}
      </div>

      {/* Search results */}
      {search && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: C.text }}>Resultados: "{search}" <span style={{ color: C.textMuted, fontWeight: 500 }}>({searchResults.length})</span></h3>
            <Btn variant="ghost" onClick={() => setSearch("")}>✕ Limpiar</Btn>
          </div>
          {searchResults.length === 0 ? <p style={{ color: C.textMuted }}>No se encontraron items.</p> : (
            <div style={{ overflowX: "auto" }}>
              <table><thead><tr><th>Nombre</th><th>Código</th><th>Categoría</th><th>Subcat.</th><th>Unidad</th><th>Reorden</th><th>Estado</th><th></th></tr></thead>
                <tbody>{searchResults.map((item: any) => {
                  const cfg = CATEGORY_CONFIG[item.categoria];
                  return (
                    <tr key={item.id}>
                      <td style={{ fontWeight: 600, color: item.activo ? C.text : C.textMuted }}>{item.nombre} {item.protegido && "🔒"}</td>
                      <td style={{ fontFamily: "'DM Mono', monospace", fontSize: 12 }}>{item.codigo}</td>
                      <td>{cfg?.icon} {item.categoria}</td>
                      <td>{item.subcategoria || "—"}</td>
                      <td>{item.unidad}</td>
                      <td style={{ fontFamily: "'DM Mono', monospace" }}>{item.punto_reorden ?? "—"}</td>
                      <td><span style={{ color: item.activo ? "#34d399" : "#f87171", fontWeight: 600, fontSize: 12 }}>{item.activo ? "Activo" : "Inactivo"}</span></td>
                      <td><Btn variant="ghost" onClick={() => { setEditCat(item.categoria); setEditItem({ ...item }); }}>✏️</Btn></td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Category accordions */}
      {!search && CATEGORIES.map(cat => {
        const cfg = CATEGORY_CONFIG[cat];
        const catIt = items.filter((i: any) => i.categoria === cat);
        const activeCount = catIt.filter((i: any) => i.activo).length;
        const inactiveCount = catIt.filter((i: any) => !i.activo).length;
        const alertCount = cfg.hasStockAlerts ? catIt.filter((i: any) => i.activo && i.punto_reorden !== null && i.stock_actual < i.punto_reorden).length : 0;
        const isOpen = expandedCat === cat;
        const subcats = [...new Set(catIt.map((i: any) => i.subcategoria).filter(Boolean))] as string[];

        return (
          <div key={cat} style={{ marginBottom: 8 }}>
            <button onClick={() => setExpandedCat(isOpen ? null : cat)}
              style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", background: isOpen ? C.card : C.surface, border: `1px solid ${isOpen ? C.accent + "40" : C.border}`, borderRadius: isOpen ? "14px 14px 0 0" : 14, cursor: "pointer", transition: "all 0.15s" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 20 }}>{cfg.icon}</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{cfg.label}</span>
                <Badge color={C.accentLight} bg={C.accentDim}>{activeCount}</Badge>
                {inactiveCount > 0 && <Badge color="#f87171" bg="rgba(248,113,113,0.1)">{inactiveCount} inactivos</Badge>}
                {alertCount > 0 && <Badge color="#fbbf24" bg="rgba(251,191,36,0.15)">⚠ {alertCount}</Badge>}
                {!cfg.hasReorderPoint && <Badge color={C.textMuted} bg="rgba(153,153,176,0.1)">Sin reorden</Badge>}
                {cfg.subcategoriesLocked && <span title="Subcategorías bloqueadas" style={{ fontSize: 12, opacity: 0.4 }}>🔒</span>}
              </div>
              <span style={{ color: C.textMuted, fontSize: 18, transition: "transform 0.2s", transform: isOpen ? "rotate(180deg)" : "rotate(0)" }}>▾</span>
            </button>

            {isOpen && (
              <div style={{ background: C.card, border: `1px solid ${C.accent}40`, borderTop: "none", borderRadius: "0 0 14px 14px", padding: 20 }} className="inv-fade">
                {!cfg.hasReorderPoint && (
                  <div style={{ background: "rgba(153,153,176,0.06)", padding: 12, borderRadius: 10, border: `1px solid ${C.border}`, marginBottom: 16 }}>
                    <p style={{ margin: 0, fontSize: 13, color: C.textMuted }}>ℹ️ <strong>{cfg.label}</strong> no utiliza punto de reorden ni alertas de stock.</p>
                  </div>
                )}

                {cfg.allowSubcategories && subcats.length > 0 ? subcats.map(sub => {
                  const subItems = catIt.filter((i: any) => i.subcategoria === sub);
                  const isProtected = cfg.protectedSubcategories?.includes(sub) || cfg.subcategoriesLocked;
                  return (
                    <div key={sub} style={{ marginBottom: 20 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.text }}>{sub}</h4>
                          {isProtected && <span title="Subcategoría protegida" style={{ fontSize: 12, opacity: 0.5 }}>🔒</span>}
                          <span style={{ fontSize: 11, color: C.textMuted }}>({subItems.length})</span>
                        </div>
                        <Btn variant="ghost" style={{ fontSize: 12 }} onClick={() => openNewItem(cat, sub)}>+ Agregar item</Btn>
                      </div>
                      {renderConfigTable(subItems, cfg)}
                    </div>
                  );
                }) : renderConfigTable(catIt, cfg)}

                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <Btn variant="primary" style={{ fontSize: 13 }} onClick={() => openNewItem(cat)}>+ Agregar Item</Btn>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {editItem && (
        <ItemFormModal item={editItem} category={editCat} allItems={items} almacenId={almacenId}
          onClose={() => setEditItem(null)} onSaved={() => { setEditItem(null); onRefresh(); }} />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ITEM FORM MODAL (Create / Edit)
   ═══════════════════════════════════════════════════════════════ */
function ItemFormModal({ item, category, allItems, almacenId, onClose, onSaved }: any) {
  const config = CATEGORY_CONFIG[category];
  const isNew = !item.id;
  const [form, setForm] = useState({ ...item });
  const [submitting, setSubmitting] = useState(false);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const unitLocked = !isNew && item.stock_actual > 0;

  // Auto-generate code
  useEffect(() => {
    if (isNew && form.nombre && form.nombre.length >= 2) {
      const pre = category.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, "");
      const sub = (form.subcategoria || "GEN").substring(0, 4).toUpperCase().replace(/[^A-Z]/g, "");
      const nam = form.nombre.replace(/[^a-zA-Z0-9]/g, "").substring(0, 6).toUpperCase();
      set("codigo", `${pre}-${sub}-${nam}`);
    }
  }, [form.nombre, form.subcategoria, category, isNew]);

  const subcatOptions = config.fixedSubcategories
    ? config.fixedSubcategories.map(s => ({ value: s, label: s }))
    : [...new Set(allItems.filter((i: any) => i.categoria === category).map((i: any) => i.subcategoria).filter(Boolean))].map(s => ({ value: s, label: s }));

  const validate = (): boolean => {
    if (!form.nombre || form.nombre.length < 3) { toast.error("Nombre mínimo 3 caracteres"); return false; }
    if (!form.codigo) { toast.error("Código requerido"); return false; }
    if (!form.unidad) { toast.error("Seleccione unidad"); return false; }
    const dupCode = allItems.find((i: any) => i.codigo === form.codigo && i.id !== form.id);
    if (dupCode) { toast.error(`Código "${form.codigo}" ya existe en ${dupCode.nombre}`); return false; }
    const dupName = allItems.find((i: any) => i.nombre.toLowerCase() === form.nombre.toLowerCase() && i.subcategoria === form.subcategoria && i.categoria === category && i.id !== form.id);
    if (dupName) { toast.error(`"${form.nombre}" ya existe en esta subcategoría`); return false; }
    if (config.hasReorderPoint && form.punto_reorden !== null && form.stock_minimo > form.punto_reorden) {
      toast.error("Stock mínimo no puede superar punto de reorden"); return false;
    }
    return true;
  };

  const save = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const data: any = {
        categoria: category,
        subcategoria: form.subcategoria || null,
        nombre: form.nombre,
        codigo: form.codigo,
        unidad: form.unidad,
        punto_reorden: config.hasReorderPoint ? (parseInt(form.punto_reorden) || 10) : null,
        stock_minimo: config.hasReorderPoint ? (parseInt(form.stock_minimo) || 0) : 0,
        activo: form.activo !== false,
        updated_at: new Date().toISOString(),
      };

      if (isNew) {
        data.stock_actual = 0;
        data.protegido = false;
        if (almacenId) data.almacen_id = almacenId;
        const { data: inserted, error } = await supabase.from("inventario_items").insert(data).select().single();
        if (error) throw error;
        await supabase.from("inventario_audit").insert({ registro_id: inserted.id, campo: "registro", valor_anterior: null, valor_nuevo: form.nombre, accion: "crear", usuario: "admin", fecha_hora: getMexTimestamp() });
        toast.success(`${form.nombre} creado`);
      } else {
        const changes: { campo: string; antes: string; despues: string }[] = [];
        if (item.nombre !== form.nombre) changes.push({ campo: "nombre", antes: item.nombre, despues: form.nombre });
        if (item.codigo !== form.codigo) changes.push({ campo: "codigo", antes: item.codigo, despues: form.codigo });
        if (item.unidad !== form.unidad) changes.push({ campo: "unidad", antes: item.unidad, despues: form.unidad });
        if (String(item.punto_reorden) !== String(data.punto_reorden)) changes.push({ campo: "punto_reorden", antes: String(item.punto_reorden), despues: String(data.punto_reorden) });
        if (String(item.stock_minimo ?? 0) !== String(data.stock_minimo)) changes.push({ campo: "stock_minimo", antes: String(item.stock_minimo ?? 0), despues: String(data.stock_minimo) });

        const { error } = await supabase.from("inventario_items").update(data).eq("id", item.id);
        if (error) throw error;
        for (const ch of changes) {
          await supabase.from("inventario_audit").insert({ registro_id: item.id, campo: ch.campo, valor_anterior: ch.antes, valor_nuevo: ch.despues, accion: "editar", usuario: "admin", fecha_hora: getMexTimestamp() });
        }
        toast.success(`${form.nombre} actualizado`);
      }
      onSaved();
    } catch (e: any) { console.error(e); toast.error("Error: " + (e.message || "ver consola")); }
    finally { setSubmitting(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }} onClick={onClose}>
      <div style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, padding: 28, width: 560, maxHeight: "90vh", overflowY: "auto" }} onClick={(e: any) => e.stopPropagation()} className="inv-fade">

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 20 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{isNew ? "Agregar Item" : "Editar Item"}</h3>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: C.textMuted }}>{config.icon} {config.label}{form.subcategoria ? ` > ${form.subcategoria}` : ""}</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.textMuted, fontSize: 20, cursor: "pointer" }}>✕</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
          <div>
            <Label>Categoría</Label>
            <div style={{ padding: "10px 14px", borderRadius: 10, background: C.surface, border: `1px solid ${C.border}`, fontSize: 14, color: C.textMuted }}>{config.icon} {category}</div>
          </div>
          {config.allowSubcategories && (
            <div>
              <Label>Subcategoría</Label>
              {config.subcategoriesLocked ? (
                <Select value={form.subcategoria || ""} onChange={(v: string) => set("subcategoria", v)} options={subcatOptions} placeholder="Seleccionar..." />
              ) : (
                <Input value={form.subcategoria || ""} onChange={(v: string) => set("subcategoria", v)} placeholder="Subcategoría..." list="subcatList" />
              )}
              {!config.subcategoriesLocked && (
                <datalist id="subcatList">{subcatOptions.map((o: any) => <option key={o.value} value={o.value} />)}</datalist>
              )}
            </div>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
          <div>
            <Label>Nombre del producto</Label>
            <Input value={form.nombre} onChange={(v: string) => set("nombre", v)} placeholder="Nombre..." />
          </div>
          <div>
            <Label>Código único</Label>
            <Input value={form.codigo} onChange={(v: string) => set("codigo", v.toUpperCase())} placeholder="AUTO-GENERADO" />
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <Label>Unidad de medida {unitLocked && <span style={{ color: "#fb923c", fontSize: 10 }}>(🔒 bloqueada — tiene stock)</span>}</Label>
          <Select value={form.unidad} onChange={(v: string) => { if (!unitLocked) set("unidad", v); }} options={UNIT_OPTIONS} placeholder="Seleccionar..."
            style={unitLocked ? { opacity: 0.5, pointerEvents: "none" as const } : {}} />
        </div>

        {config.hasReorderPoint && (
          <div style={{ background: C.surface, padding: 16, borderRadius: 12, border: `1px solid ${C.border}`, marginBottom: 16 }}>
            <h4 style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 700, color: C.text }}>📊 Control de Stock</h4>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <Label>Punto de reorden</Label>
                <Input type="number" value={form.punto_reorden ?? ""} onChange={(v: string) => set("punto_reorden", v)} placeholder="10" min="1" />
                <p style={{ margin: "4px 0 0", fontSize: 11, color: C.textMuted }}>Alerta cuando stock baja de este nivel</p>
              </div>
              <div>
                <Label>Stock mínimo</Label>
                <Input type="number" value={form.stock_minimo ?? ""} onChange={(v: string) => set("stock_minimo", v)} placeholder="0" min="0" />
                <p style={{ margin: "4px 0 0", fontSize: 11, color: C.textMuted }}>Nivel crítico (alerta roja)</p>
              </div>
            </div>
          </div>
        )}

        {!config.hasReorderPoint && (
          <div style={{ background: "rgba(153,153,176,0.06)", padding: 14, borderRadius: 12, border: `1px solid ${C.border}`, marginBottom: 16 }}>
            <p style={{ margin: 0, fontSize: 13, color: C.textMuted }}>ℹ️ <strong>{config.label}</strong> no utiliza punto de reorden ni alertas de stock.</p>
          </div>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <Btn variant="secondary" onClick={onClose}>Cancelar</Btn>
          <Btn onClick={save} disabled={submitting || !form.nombre || !form.unidad} style={{ padding: "12px 28px" }}>
            {submitting ? "Guardando..." : isNew ? "💾 Crear Item" : "💾 Guardar Cambios"}
          </Btn>
        </div>
      </div>
    </div>
  );
}