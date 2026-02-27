import { useState, useEffect, useCallback } from "react";
import { createClient } from '@supabase/supabase-js';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/useAuthStore';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// ─── CONSTANTES ─────────────────────────────────────────────
const DEFAULT_PRESENTATIONS = [
  { id: "p1", shortCode: "8x18oz", targetFruits: 250, targetWeight: 525 },
  { id: "p2", shortCode: "12x18oz", targetFruits: 250, targetWeight: 525 },
  { id: "p3", shortCode: "JMB", targetFruits: 100, targetWeight: 288 },
  { id: "p4", shortCode: "6oz", targetFruits: 105, targetWeight: 177 },
  { id: "p5", shortCode: "PNT", targetFruits: 150, targetWeight: 325 },
];
const DEFAULT_CLIENTS = [
  { id: "c1", name: "TwinRiver", code: "TWR" },
  { id: "c2", name: "RiverRun", code: "RVR" },
  { id: "c3", name: "Hortifrut", code: "HF" },
  { id: "c4", name: "BerryLovers", code: "BL" },
];
const DEFAULT_VARIETIES = [
  { id: "v1", name: "Biloxi" }, { id: "v2", name: "Azra3" }, { id: "v3", name: "Azra2" },
  { id: "v4", name: "Azra4s" }, { id: "v5", name: "Azra6s" }, { id: "v6", name: "Azra7s" },
  { id: "v7", name: "Sunset" }, { id: "v8", name: "Max" }, { id: "v9", name: "Sunrise" },
];
const DEFAULT_SECTORS = [
  { id: "s1", name: "Sector 1A" }, { id: "s2", name: "Sector 1B" }, { id: "s3", name: "Sector 1C" },
  { id: "s4", name: "Sector 1D" }, { id: "s5", name: "Sector 1E" },
  { id: "s6", name: "Sector 2A" }, { id: "s7", name: "Sector 2B" }, { id: "s8", name: "Sector 2C" },
  { id: "s9", name: "Sector 2D" }, { id: "s10", name: "Sector 2E" },
  { id: "s11", name: "Sector 3A" }, { id: "s12", name: "Sector 3B" }, { id: "s13", name: "Sector 3C" },
  { id: "s14", name: "Sector 4A" }, { id: "s15", name: "Sector 4B" }, { id: "s16", name: "Sector 4C" },
  { id: "s17", name: "Sector 5A" }, { id: "s18", name: "Sector 5B" }, { id: "s19", name: "Sector 5C" },
  { id: "s20", name: "Sector 6A" }, { id: "s21", name: "Sector 6B" }, { id: "s22", name: "Sector 6C" },
  { id: "s23", name: "Sector 6D" }, { id: "s24", name: "Sector 7A" }, { id: "s25", name: "Sector 7B" },
  { id: "s26", name: "Sector 7C" }, { id: "s27", name: "Sector 7D" }, { id: "s28", name: "Sector 7E" },
  { id: "s29", name: "Sector 8A" }, { id: "s30", name: "Sector 8B" }, { id: "s31", name: "Sector 8C" },
  { id: "s32", name: "Sector 8D" }, { id: "s33", name: "Sector 8E" }, { id: "s34", name: "Sector 8F" },
];

// ─── KG POR PRESENTACIÓN ─────────────────────────────────────
const PRES_KG: Record<string, number> = {
  "8x18oz": 4.2, "12x18oz": 6.3, "6oz": 2.1, "JMB": 3.5, "PNT": 3.84, "Jumbo": 3.5, "JumboK": 3.5, "12x18": 6.3, "8x18": 4.2, "PintasC": 3.92, "6x12": 2.1, "PintaC": 3.84, "4oz": 1.54, "PintaP": 3.84, "Granel": 2.65, "Cubeta 5kg": 5,
};
function getKgForEntry(tipoEmbalaje: string, cajas: number): number {
  return Math.round((PRES_KG[tipoEmbalaje] ?? 0) * cajas * 100) / 100;
}

// ─── DEFECTOS ─────────────────────────────────────────────────
const DEFECTS = [
  { key: "insectLarva", label: "Insecto / Larva", dbCol: "Insecto", limit: 0, group: "zero" },
  { key: "birdPeck", label: "Picada de pájaro", dbCol: "PicadaPajaro", limit: 0, group: "zero" },
  { key: "rot", label: "Pudrición", dbCol: "Pudricion", limit: 0.8, group: "low" },
  { key: "dehydration", label: "Deshidratación", dbCol: "Deshidratado", limit: 5, group: "merma1" },
  { key: "soft", label: "Blanda", dbCol: "Blanda", limit: 5, group: "merma1" },
  { key: "torn", label: "Rasgada", dbCol: "Rasgada", limit: 5, group: "merma1" },
  { key: "redFruit", label: "Fruta roja", dbCol: "Roja", limit: 5, group: "merma2" },
  { key: "scar", label: "Cicatriz", dbCol: "Cicatrizada", limit: 5, group: "merma2" },
  { key: "stem", label: "Pedúnculo", dbCol: "Pedunculo", limit: 5, group: "merma2" },
  { key: "smallFruit", label: "Pequeña (<11mm)", dbCol: "Pequeña", limit: 5, group: "merma2" },
  { key: "floralRemnant", label: "Resto floral", dbCol: "Resto Floral", limit: 5, group: "merma2" },
];
const MERMA1_KEYS = DEFECTS.filter(d => d.group === "merma1").map(d => d.key);
const MERMA2_KEYS = DEFECTS.filter(d => d.group === "merma2").map(d => d.key);

// ─── TEMA ─────────────────────────────────────────────────────
const C = {
  bg: "#0f0f17", surface: "#1a1a28", card: "#1e1e2e", cardHover: "#252538",
  input: "#282840", inputBorder: "#3a3a52", inputFocus: "#4f6bf6", border: "#2a2a3e",
  text: "#f0f0f5", textSecondary: "#9999b0", textMuted: "#666680",
  accent: "#4f6bf6", accentLight: "#6b83f7", accentDim: "rgba(79,107,246,0.15)",
  merma: "#f97316", mermaDim: "rgba(249,115,22,0.15)", mermaLight: "#fb923c",
};
const GRADE_CONFIG = {
  excellent: { label: "Excelente", color: "#34d399", bg: "rgba(52,211,153,0.12)", border: "rgba(52,211,153,0.3)" },
  good: { label: "Buena", color: "#60a5fa", bg: "rgba(96,165,250,0.12)", border: "rgba(96,165,250,0.3)" },
  medium: { label: "Media", color: "#fbbf24", bg: "rgba(251,191,36,0.12)", border: "rgba(251,191,36,0.3)" },
  poor: { label: "Baja", color: "#fb923c", bg: "rgba(251,146,60,0.12)", border: "rgba(251,146,60,0.3)" },
  reject: { label: "Rechazo", color: "#f87171", bg: "rgba(248,113,113,0.12)", border: "rgba(248,113,113,0.3)" },
} as Record<string, { label: string; color: string; bg: string; border: string }>;

function gradeZeroTolerance(pct: number) { return pct === 0 ? "excellent" : "reject"; }
function gradeLowLimit(pct: number) { if (pct === 0) return "excellent"; if (pct <= 0.3) return "good"; if (pct <= 0.5) return "medium"; if (pct <= 0.8) return "poor"; return "reject"; }
function gradeGroup1Sum(s: number) { if (s <= 1) return "excellent"; if (s <= 2) return "good"; if (s <= 3.5) return "medium"; if (s <= 5) return "poor"; return "reject"; }
function gradeGroup2Sum(s: number) { if (s <= 5) return "excellent"; if (s <= 8.5) return "good"; if (s <= 12) return "medium"; if (s <= 15) return "poor"; return "reject"; }
const GRADE_RANK: Record<string, number> = { excellent: 0, good: 1, medium: 2, poor: 3, reject: 4 };
function overallGrade(grades: Record<string, string>) { let w = "excellent"; for (const g of Object.values(grades)) { if (GRADE_RANK[g] > GRADE_RANK[w]) w = g; } return w; }

function computeGradesFromRow(row: any) {
  const total = Number(row.FrutaTotal) || 0;
  const percentages: Record<string, number> = {};
  const grades: Record<string, string> = {};
  const defectCounts: Record<string, number> = {};
  DEFECTS.forEach(d => { const c = Number(row[d.dbCol]) || 0; defectCounts[d.key] = c; percentages[d.key] = total > 0 ? Math.round(((c / total) * 100) * 100) / 100 : 0; });
  const merma1Sum = Math.round(MERMA1_KEYS.reduce((s, k) => s + (percentages[k] || 0), 0) * 100) / 100;
  const merma2Sum = Math.round(MERMA2_KEYS.reduce((s, k) => s + (percentages[k] || 0), 0) * 100) / 100;
  grades.insectLarva = gradeZeroTolerance(percentages.insectLarva);
  grades.birdPeck = gradeZeroTolerance(percentages.birdPeck);
  grades.rot = gradeLowLimit(percentages.rot);
  const m1g = gradeGroup1Sum(merma1Sum); MERMA1_KEYS.forEach(k => { grades[k] = m1g; });
  const m2g = gradeGroup2Sum(merma2Sum); MERMA2_KEYS.forEach(k => { grades[k] = m2g; });
  return { percentages, grades, defectCounts, overallGrade: overallGrade(grades), merma1Sum, merma2Sum };
}

// ─── UTILIDADES ───────────────────────────────────────────────
function getMexDate() { return new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" }); }
function getMexTime() { return new Date().toLocaleTimeString("en-US", { timeZone: "America/Mexico_City", hour: "2-digit", minute: "2-digit", hour12: true }); }
function getMexTimestamp() {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).formatToParts(new Date());
  const g = (t: string) => p.find(x => x.type === t)?.value || "00";
  return `${g("year")}-${g("month")}-${g("day")}T${g("hour")}:${g("minute")}:${g("second")}`;
}
/** Returns HH:MM:SS in Mexico City timezone — for composing timestamps with a manually entered date */
function getMexTimeOnly(): string {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).formatToParts(new Date());
  const g = (t: string) => p.find(x => x.type === t)?.value || "00";
  return `${g("hour")}:${g("minute")}:${g("second")}`;
}
/** ISO 8601 week number — weeks start Monday, week 1 contains first Thursday */
function getWeekNumber(dateStr: string): number {
  const d = new Date(dateStr + "T12:00:00");
  const utc = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  utc.setUTCDate(utc.getUTCDate() + 4 - (utc.getUTCDay() || 7));
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
function getCurrentYear() { return new Date().getFullYear(); }

function useStorage(key: string, defaultValue: any) {
  const [data, setData] = useState(defaultValue);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { (async () => { try { const r = await (window as any).storage.get(key); if (r && r.value) setData(JSON.parse(r.value)); } catch {} setLoaded(true); })(); }, [key]);
  const save = useCallback(async (v: any) => { setData(v); try { await (window as any).storage.set(key, JSON.stringify(v)); } catch {} }, [key]);
  return [data, save, loaded] as const;
}

// ─── ICONOS ───────────────────────────────────────────────────
const Icons = {
  Dashboard: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  Packing: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
  Quality: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>,
  Fruit: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="14" r="7"/><path d="M12 7c0 0-1-4 0-5 1 1 0 5 0 5z"/><path d="M9.5 8c0 0-3-2-2.5-4 2 0 2.5 4 2.5 4z"/></svg>,
  Merma: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  KPI: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  Plus: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  Trash: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>,
  Eye: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  Loader: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="bp-spin"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>,
};

// ─── COMPONENTES UI ───────────────────────────────────────────
const Card = ({ children, className = "", style = {} }: any) => <div className={className} style={{ background: C.card, borderRadius: 14, border: `1px solid ${C.border}`, padding: 22, ...style }}>{children}</div>;
const GradeBadge = ({ grade }: { grade: string }) => { const c = GRADE_CONFIG[grade]; if (!c) return null; return <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, letterSpacing: 0.5, background: c.bg, color: c.color, border: `1.5px solid ${c.border}`, textTransform: "uppercase" }}>{c.label}</span>; };
const Select = ({ value, onChange, options, placeholder, style = {} }: any) => <select value={value} onChange={(e: any) => onChange(e.target.value)} style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${C.inputBorder}`, fontSize: 14, background: C.input, color: value ? C.text : C.textMuted, outline: "none", ...style }}><option value="">{placeholder || "Seleccionar..."}</option>{options.map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>;
const Input = ({ type = "text", value, onChange, placeholder, style = {}, ...rest }: any) => <input type={type} value={value} onChange={(e: any) => onChange(e.target.value)} placeholder={placeholder} style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${C.inputBorder}`, fontSize: 14, outline: "none", boxSizing: "border-box" as const, background: C.input, color: C.text, ...style }} {...rest} />;
const Btn = ({ children, onClick, variant = "primary", style = {}, disabled = false }: any) => {
  const base: any = { padding: "10px 20px", borderRadius: 10, border: "none", fontSize: 14, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer", display: "inline-flex", alignItems: "center", gap: 7, transition: "all 0.15s", opacity: disabled ? 0.4 : 1 };
  const v: any = { primary: { ...base, background: C.accent, color: "#fff" }, secondary: { ...base, background: C.surface, color: C.textSecondary, border: `1.5px solid ${C.border}` }, danger: { ...base, background: "rgba(248,113,113,0.1)", color: "#f87171", border: "1.5px solid rgba(248,113,113,0.25)" }, ghost: { ...base, background: "transparent", color: C.textMuted, padding: "6px 10px" } };
  return <button onClick={onClick} disabled={disabled} style={{ ...v[variant], ...style }}>{children}</button>;
};
const Label = ({ children }: any) => <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: C.textSecondary, marginBottom: 6, textTransform: "uppercase" as const, letterSpacing: 0.6 }}>{children}</label>;
const FormRow = ({ children }: any) => <div style={{ display: "grid", gridTemplateColumns: `repeat(${Array.isArray(children) ? children.filter(Boolean).length : 1}, 1fr)`, gap: 16, marginBottom: 16 }}>{children}</div>;
const SectionTitle = ({ children, action }: any) => <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}><h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: C.text }}>{children}</h2>{action}</div>;
const EmptyState = ({ message }: any) => <div style={{ textAlign: "center" as const, padding: "48px 20px", color: C.textMuted }}><div style={{ fontSize: 40, marginBottom: 10, opacity: 0.5 }}>📋</div><p style={{ margin: 0, fontSize: 14 }}>{message}</p></div>;
const StatCard = ({ label, value, color, sub }: any) => <Card><div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase" as const, letterSpacing: 0.6 }}>{label}</div><div style={{ fontSize: 38, fontWeight: 700, color: color || C.accent, marginTop: 6, fontFamily: "'DM Mono', monospace", lineHeight: 1 }}>{value}</div>{sub && <div style={{ fontSize: 12, color: C.textMuted, marginTop: 6 }}>{sub}</div>}</Card>;
const MiniBar = ({ value, max, color = C.accent }: { value: number; max: number; color?: string }) => (
  <div style={{ flex: 1, height: 8, background: C.input, borderRadius: 4, overflow: "hidden", minWidth: 60 }}>
    <div style={{ width: `${max > 0 ? Math.min((value / max) * 100, 100) : 0}%`, height: "100%", background: `linear-gradient(90deg, ${color}, ${color}cc)`, borderRadius: 4 }} />
  </div>
);
const DateFilter = ({ date, onChange }: { date: string; onChange: (d: string) => void }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
    <span style={{ fontSize: 12, color: C.textMuted, fontWeight: 600 }}>📅</span>
    <input type="date" value={date} onChange={e => onChange(e.target.value)}
      style={{ padding: "7px 12px", borderRadius: 8, border: `1.5px solid ${C.inputBorder}`, background: C.input, color: C.text, fontSize: 13, outline: "none", fontFamily: "'DM Mono', monospace" }} />
    {date !== getMexDate() && <Btn variant="ghost" style={{ fontSize: 11, padding: "4px 8px" }} onClick={() => onChange(getMexDate())}>Hoy</Btn>}
  </div>
);

const GLOBAL_CSS = `
  * { box-sizing: border-box; }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  .bp-fade { animation: fadeIn 0.25s ease-out; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .bp-spin { animation: spin 1s linear infinite; }
  select:focus, input:focus { border-color: ${C.inputFocus} !important; box-shadow: 0 0 0 3px rgba(79,107,246,0.2) !important; }
  ::-webkit-scrollbar { width: 6px; height: 6px; } ::-webkit-scrollbar-track { background: ${C.bg}; } ::-webkit-scrollbar-thumb { background: ${C.inputBorder}; border-radius: 3px; }
  table { border-collapse: collapse; width: 100%; }
  th { text-align: left; padding: 11px 14px; font-size: 11px; font-weight: 700; color: ${C.textMuted}; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid ${C.border}; background: ${C.surface}; }
  td { padding: 11px 14px; font-size: 13px; color: ${C.textSecondary}; border-bottom: 1px solid ${C.border}; }
  tr:hover td { background: ${C.cardHover}; }
  option { background: ${C.card}; color: ${C.text}; }
`;

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function PackagingForm() {
  const { user } = useAuthStore();
  const userName = user?.name || user?.email || "—";
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedDate, setSelectedDate] = useState(getMexDate());
  const [presentations] = useStorage("bp-presentations", DEFAULT_PRESENTATIONS);
  const [clients] = useStorage("bp-clients", DEFAULT_CLIENTS);
  const [varieties] = useStorage("bp-varieties", DEFAULT_VARIETIES);
  const [sectors] = useStorage("bp-sectors", DEFAULT_SECTORS);

  const [packingEntries, setPackingEntries] = useState<any[]>([]);
  const [packingLoading, setPackingLoading] = useState(true);
  const [qualityRaw, setQualityRaw] = useState<any[]>([]);
  const [qualityLoading, setQualityLoading] = useState(true);
  const [mermaRaw, setMermaRaw] = useState<any[]>([]);
  const [mermaLoading, setMermaLoading] = useState(true);
  const [fruitSamples, setFruitSamples] = useState<any[]>([]);
  const [fruitLoading, setFruitLoading] = useState(true);

  const fetchPacking = useCallback(async () => {
    setPackingLoading(true);
    try { const { data, error } = await supabase.from('Muestreos Empaque').select('*').order('Fecha', { ascending: false }); if (error) throw error; setPackingEntries(data || []); }
    catch (e) { console.error(e); } finally { setPackingLoading(false); }
  }, []);

  const fetchQuality = useCallback(async () => {
    setQualityLoading(true);
    try {
      const { data, error } = await supabase.from('Calidad Empaque').select('*')
        .neq('tipo', 'merma').order('FechaHora', { ascending: false });
      if (error) throw error; setQualityRaw(data || []);
    } catch (e) { console.error(e); } finally { setQualityLoading(false); }
  }, []);

  const fetchMerma = useCallback(async () => {
    setMermaLoading(true);
    try {
      const { data, error } = await supabase.from('Calidad Empaque').select('*')
        .eq('tipo', 'merma').order('FechaHora', { ascending: false });
      if (error) throw error; setMermaRaw(data || []);
    } catch (e) { console.error(e); } finally { setMermaLoading(false); }
  }, []);

  const fetchFruit = useCallback(async () => {
    setFruitLoading(true);
    try { const { data, error } = await supabase.from('muestreos_fruta').select('*').order('fecha_hora', { ascending: false }); if (error) throw error; setFruitSamples(data || []); }
    catch (e) { console.error(e); } finally { setFruitLoading(false); }
  }, []);

  useEffect(() => { fetchPacking(); fetchQuality(); fetchMerma(); fetchFruit(); }, [fetchPacking, fetchQuality, fetchMerma, fetchFruit]);

  const qualitySamples = qualityRaw.map((row: any) => {
    const computed = computeGradesFromRow(row);
    const pres = presentations.find((p: any) => p.shortCode === row.Presentacion);
    const weightGrade = pres && Number(row.PesoClam) >= pres.targetWeight ? "pass" : "fail";
    return { ...row, ...computed, weightGrade };
  });

  // Merma: FrutaTotal = total weight in grams, defect cols = grams of each defect
  const mermaSamples = mermaRaw.map((row: any) => {
    const totalG = Number(row.FrutaTotal) || 0;
    const defectGrams: Record<string, number> = {};
    const percentages: Record<string, number> = {};
    DEFECTS.forEach(d => {
      const g = Number(row[d.dbCol]) || 0;
      defectGrams[d.key] = g;
      percentages[d.key] = totalG > 0 ? Math.round(((g / totalG) * 100) * 100) / 100 : 0;
    });
    return { ...row, totalG, defectGrams, percentages };
  });

  const tabs = [
    { id: "dashboard", label: "Resumen", icon: Icons.Dashboard },
    { id: "packing", label: "Empaque", icon: Icons.Packing },
    { id: "quality", label: "Calidad", icon: Icons.Quality },
    { id: "merma", label: "Merma", icon: Icons.Merma },
    { id: "fruit", label: "Muestreos Fruta", icon: Icons.Fruit },
    { id: "kpis", label: "KPIs", icon: Icons.KPI },
  ];
  const tabColor = (id: string) => id === "merma" ? C.merma : id === "kpis" ? "#a78bfa" : C.accent;

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: C.bg, minHeight: "100vh", color: C.text }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      <style>{GLOBAL_CSS}</style>
      <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: C.surface, borderBottom: `1px solid ${C.border}`, paddingRight: 24 }}>
        <div style={{ display: "flex", overflowX: "auto" }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{ display: "flex", alignItems: "center", gap: 7, padding: "14px 20px", border: "none", background: "none", fontSize: 14, fontWeight: activeTab === t.id ? 700 : 500, cursor: "pointer", color: activeTab === t.id ? tabColor(t.id) : C.textMuted, transition: "all 0.15s", whiteSpace: "nowrap", borderBottom: activeTab === t.id ? `2.5px solid ${tabColor(t.id)}` : "2.5px solid transparent" }}><t.icon />{t.label}</button>
          ))}
        </div>
        {activeTab !== "kpis" && <DateFilter date={selectedDate} onChange={setSelectedDate} />}
      </nav>
      <main style={{ padding: 24, maxWidth: 1300, margin: "0 auto" }} className="bp-fade" key={activeTab + selectedDate}>
        {activeTab === "dashboard" && <DashboardTab packingEntries={packingEntries} qualitySamples={qualitySamples} mermaSamples={mermaSamples} fruitSamples={fruitSamples} presentations={presentations} clients={clients} loading={packingLoading || qualityLoading} selectedDate={selectedDate} />}
        {activeTab === "packing" && <PackingTab entries={packingEntries} onRefresh={fetchPacking} presentations={presentations} clients={clients} varieties={varieties} loading={packingLoading} selectedDate={selectedDate} userName={userName} />}
        {activeTab === "quality" && <QualityTab samples={qualitySamples} onRefresh={fetchQuality} presentations={presentations} clients={clients} sectors={sectors} loading={qualityLoading} selectedDate={selectedDate} userName={userName} />}
        {activeTab === "merma" && <MermaEmpaqueTab samples={mermaSamples} onRefresh={fetchMerma} sectors={sectors} loading={mermaLoading} selectedDate={selectedDate} userName={userName} />}
        {activeTab === "fruit" && <FruitSamplingTab samples={fruitSamples} onRefresh={fetchFruit} sectors={sectors} varieties={varieties} loading={fruitLoading} selectedDate={selectedDate} userName={userName} />}
        {activeTab === "kpis" && <KPIsTab packingEntries={packingEntries} qualitySamples={qualitySamples} mermaSamples={mermaSamples} fruitSamples={fruitSamples} presentations={presentations} clients={clients} />}
      </main>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════
function DashboardTab({ packingEntries, qualitySamples, mermaSamples, fruitSamples, presentations, clients, loading, selectedDate }: any) {
  const dayPacking = packingEntries.filter((e: any) => e.Fecha === selectedDate);
  const dayQuality = qualitySamples.filter((s: any) => s.FechaHora && s.FechaHora.substring(0, 10) === selectedDate);
  const dayMerma = mermaSamples.filter((s: any) => s.FechaHora && s.FechaHora.substring(0, 10) === selectedDate);
  const dayFruit = fruitSamples.filter((s: any) => s.fecha_hora && s.fecha_hora.substring(0, 10) === selectedDate);

  const totalBoxes = dayPacking.reduce((s: number, e: any) => s + (Number(e.Cantidad_cajas) || 0), 0);
  const totalKgEmpacados = dayPacking.reduce((s: number, e: any) => s + getKgForEntry(e.Tipo_embalaje, Number(e.Cantidad_cajas) || 0), 0);
  const totalKgMerma = dayMerma.reduce((s: number, m: any) => s + (Number(m.kg_merma_total) || 0), 0);

  const boxesByPres = presentations.map((p: any) => ({ ...p, boxes: dayPacking.filter((e: any) => e.Tipo_embalaje === p.shortCode).reduce((s: number, e: any) => s + (Number(e.Cantidad_cajas) || 0), 0) }));
  const boxesByClient = clients.map((c: any) => ({ ...c, boxes: dayPacking.filter((e: any) => e.Cliente === c.name).reduce((s: number, e: any) => s + (Number(e.Cantidad_cajas) || 0), 0) }));

  const gradeDist: Record<string, number> = { excellent: 0, good: 0, medium: 0, poor: 0, reject: 0 };
  dayQuality.forEach((s: any) => { if (s.overallGrade) gradeDist[s.overallGrade]++; });

  const qualityDefectAvg: Record<string, number> = {};
  DEFECTS.forEach(d => { qualityDefectAvg[d.key] = dayQuality.length > 0 ? Math.round((dayQuality.reduce((s: number, q: any) => s + (q.percentages?.[d.key] || 0), 0) / dayQuality.length) * 100) / 100 : 0; });
  const getAvgGrade = (defect: typeof DEFECTS[0]) => {
    const avg = qualityDefectAvg[defect.key];
    if (defect.group === "zero") return gradeZeroTolerance(avg);
    if (defect.group === "low") return gradeLowLimit(avg);
    if (defect.group === "merma1") return gradeGroup1Sum(Math.round(MERMA1_KEYS.reduce((s, k) => s + (qualityDefectAvg[k] || 0), 0) * 100) / 100);
    return gradeGroup2Sum(Math.round(MERMA2_KEYS.reduce((s, k) => s + (qualityDefectAvg[k] || 0), 0) * 100) / 100);
  };
  const avgBrix = dayFruit.length > 0 ? Math.round((dayFruit.reduce((s: number, f: any) => s + Number(f.grados_brix || 0), 0) / dayFruit.length) * 100) / 100 : 0;

  // Top 5 merma por % de peso
  const top5Merma = DEFECTS.map(d => {
    const totalDefectG = dayMerma.reduce((s: number, m: any) => s + (m.defectGrams?.[d.key] || 0), 0);
    const totalSampleG = dayMerma.reduce((s: number, m: any) => s + (m.totalG || 0), 0);
    const pct = totalSampleG > 0 ? Math.round((totalDefectG / totalSampleG) * 10000) / 100 : 0;
    return { ...d, totalG: totalDefectG, pct };
  }).filter(d => d.pct > 0).sort((a, b) => b.pct - a.pct).slice(0, 5);

  return (
    <div className="bp-fade">
      <SectionTitle>Resumen — {selectedDate}</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
        <StatCard label="Cajas Empacadas" value={loading ? "..." : totalBoxes.toLocaleString()} />
        <StatCard label="Kg Empacados" value={loading ? "..." : totalKgEmpacados > 0 ? `${totalKgEmpacados.toLocaleString(undefined, { maximumFractionDigits: 1 })} kg` : "—"} color="#34d399" />
        <StatCard label="Muestreos Calidad" value={dayQuality.length} />
        <StatCard label="Kg Merma del Día" value={totalKgMerma > 0 ? `${totalKgMerma.toFixed(1)} kg` : "—"} color={C.merma} />
        <StatCard label="Muestreos Fruta" value={dayFruit.length} />
        <StatCard label="Brix Promedio" value={avgBrix > 0 ? `${avgBrix}°` : "—"} color="#34d399" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
        <Card>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: C.text }}>Cajas por Presentación</h3>
          {boxesByPres.map((p: any) => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${C.border}` }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: C.textSecondary }}>{p.shortCode}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 110, height: 8, background: C.input, borderRadius: 4, overflow: "hidden" }}><div style={{ width: `${totalBoxes ? (p.boxes / totalBoxes) * 100 : 0}%`, height: "100%", background: `linear-gradient(90deg, ${C.accent}, ${C.accentLight})`, borderRadius: 4 }} /></div>
                <span style={{ fontSize: 14, fontWeight: 700, color: C.text, fontFamily: "'DM Mono', monospace", minWidth: 44, textAlign: "right" }}>{p.boxes}</span>
              </div>
            </div>
          ))}
        </Card>
        <Card>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: C.text }}>Cajas por Cliente</h3>
          {boxesByClient.map((c: any) => (
            <div key={c.id + c.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${C.border}` }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: C.textSecondary }}>{c.name}</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: C.text, fontFamily: "'DM Mono', monospace" }}>{c.boxes}</span>
            </div>
          ))}
        </Card>
      </div>

      {/* Top 5 Defectos Merma en Dashboard */}
      <Card style={{ marginBottom: 24 }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: C.text }}>Top 5 Defectos de Merma del Día <span style={{ fontSize: 12, fontWeight: 400, color: C.textMuted }}>— % sobre peso del muestreo</span></h3>
        {top5Merma.length === 0
          ? <p style={{ color: C.textMuted, fontSize: 14, margin: 0 }}>Sin registros de merma para esta fecha.</p>
          : (
            <div style={{ display: "flex", flexDirection: "column" as const, gap: 10 }}>
              {top5Merma.map((d, i) => (
                <div key={d.key} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.merma, fontFamily: "'DM Mono', monospace", minWidth: 22 }}>#{i + 1}</span>
                  <span style={{ fontSize: 13, color: C.textSecondary, minWidth: 160 }}>{d.label}</span>
                  <MiniBar value={d.pct} max={top5Merma[0].pct} color={C.merma} />
                  <span style={{ fontSize: 14, fontWeight: 700, color: C.mermaLight, fontFamily: "'DM Mono', monospace", minWidth: 60, textAlign: "right" as const }}>{d.pct}%</span>
                  <span style={{ fontSize: 11, color: C.textMuted, minWidth: 60, textAlign: "right" as const }}>{d.totalG.toFixed(0)}g</span>
                </div>
              ))}
            </div>
          )}
      </Card>

      <Card style={{ marginBottom: 24 }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: C.text }}>Distribución de Calidad</h3>
        {dayQuality.length === 0 ? <p style={{ color: C.textMuted, fontSize: 14 }}>No hay muestreos de calidad en esta fecha.</p> : (
          <div style={{ display: "flex", gap: 12 }}>
            {Object.entries(GRADE_CONFIG).map(([key, cfg]) => (
              <div key={key} style={{ flex: 1, textAlign: "center", padding: 16, borderRadius: 12, background: cfg.bg, border: `1.5px solid ${cfg.border}` }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: cfg.color, fontFamily: "'DM Mono', monospace" }}>{gradeDist[key]}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: cfg.color, marginTop: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>{cfg.label}</div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: C.text }}>Promedio de Defectos</h3>
        {dayQuality.length === 0 ? <p style={{ color: C.textMuted, fontSize: 13 }}>Sin datos disponibles.</p> : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(165px, 1fr))", gap: 12 }}>
            {DEFECTS.map(d => { const avg = qualityDefectAvg[d.key]; const grade = getAvgGrade(d); const gc = GRADE_CONFIG[grade]; return (<div key={d.key} style={{ padding: 14, borderRadius: 10, background: gc.bg, border: `1px solid ${gc.border}` }}><div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.3 }}>{d.label}</div><div style={{ fontSize: 22, fontWeight: 700, color: gc.color, fontFamily: "'DM Mono', monospace", margin: "6px 0" }}>{avg}%</div><div style={{ fontSize: 10, color: gc.color, fontWeight: 600 }}>Límite: {d.group === "merma1" ? "5% grp" : d.group === "merma2" ? "15% grp" : d.limit + "%"}</div></div>); })}
          </div>
        )}
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// EMPAQUE
// ═══════════════════════════════════════════════════════════════
function PackingTab({ entries, onRefresh, presentations, clients, varieties, loading, selectedDate, userName }: any) {
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ clientId: "", presentationId: "", boxCount: "", varietyId: "", fecha: getMexDate() });
  const setField = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  const filtered = entries.filter((e: any) => e.Fecha === selectedDate);

  const handleSubmit = async () => {
    if (!form.clientId || !form.presentationId || !form.boxCount || !form.fecha) { toast.error('Complete todos los campos requeridos'); return; }
    const client = clients.find((c: any) => c.id === form.clientId);
    const pres = presentations.find((p: any) => p.id === form.presentationId);
    const variety = varieties.find((v: any) => v.id === form.varietyId);
    setSubmitting(true);
    try {
      const { error } = await supabase.from('Muestreos Empaque').insert({
        Semana: getWeekNumber(form.fecha), Fecha: form.fecha,
        Cliente: client?.name || '', Cantidad_cajas: parseInt(form.boxCount),
        Tipo_embalaje: pres?.shortCode || '', Variedad: variety?.name || '',
        Inspector: userName,
      });
      if (error) throw error;
      toast.success('Registro guardado');
      setForm({ clientId: "", presentationId: "", boxCount: "", varietyId: "", fecha: getMexDate() });
      setShowForm(false); onRefresh();
    } catch (e) { console.error(e); toast.error('Error al guardar'); } finally { setSubmitting(false); }
  };
  const handleDelete = async (id: number) => {
    try { const { error } = await supabase.from('Muestreos Empaque').delete().eq('ID', id); if (error) throw error; toast.success('Eliminado'); onRefresh(); } catch { toast.error('Error'); }
  };

  return (
    <div className="bp-fade">
      <SectionTitle action={<Btn onClick={() => setShowForm(!showForm)}><Icons.Plus />{showForm ? "Cancelar" : "Nuevo Registro"}</Btn>}>
        📦 Registro de Empaque <span style={{ fontSize: 13, fontWeight: 500, color: C.textMuted, marginLeft: 8 }}>({filtered.length} registros)</span>
      </SectionTitle>
      {showForm && (
        <Card className="bp-fade" style={{ marginBottom: 20 }}>
          {/* Inspector automático */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <span style={{ fontSize: 12, color: C.textMuted }}>👤 Inspector:</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.text, background: C.accentDim, padding: "4px 12px", borderRadius: 8 }}>{userName}</span>
          </div>
          <FormRow>
            <div><Label>Fecha</Label><Input type="date" value={form.fecha} onChange={(v: string) => setField("fecha", v)} /></div>
            <div><Label>Cliente</Label><Select value={form.clientId} onChange={(v: string) => setField("clientId", v)} options={clients.map((c: any) => ({ value: c.id, label: c.name }))} placeholder="Seleccionar cliente..." /></div>
            <div><Label>Presentación</Label><Select value={form.presentationId} onChange={(v: string) => setField("presentationId", v)} options={presentations.map((p: any) => ({ value: p.id, label: p.shortCode }))} placeholder="Seleccionar..." /></div>
          </FormRow>
          <FormRow>
            <div><Label>Cantidad de Cajas</Label><Input type="number" value={form.boxCount} onChange={(v: string) => setField("boxCount", v)} placeholder="0" min="0" /></div>
            <div><Label>Variedad</Label><Select value={form.varietyId} onChange={(v: string) => setField("varietyId", v)} options={varieties.map((v: any) => ({ value: v.id, label: v.name }))} placeholder="Seleccionar..." /></div>
          </FormRow>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Btn onClick={handleSubmit} disabled={submitting || !form.clientId || !form.presentationId || !form.boxCount} style={{ padding: "12px 32px" }}>
              {submitting ? <><Icons.Loader />Guardando...</> : "💾 Guardar"}
            </Btn>
          </div>
        </Card>
      )}
      <Card>
        {loading ? <div style={{ textAlign: "center", padding: 40, color: C.textMuted }}><Icons.Loader />Cargando...</div> :
        filtered.length === 0 ? <EmptyState message={`No hay registros de empaque para ${selectedDate}.`} /> : (
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead><tr><th>Sem.</th><th>Fecha</th><th>Cliente</th><th>Presentación</th><th>Cajas</th><th>Kg</th><th>Variedad</th><th></th></tr></thead>
              <tbody>
                {filtered.map((e: any) => {
                  const kg = getKgForEntry(e.Tipo_embalaje, Number(e.Cantidad_cajas) || 0);
                  return (
                    <tr key={e.ID}>
                      <td style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: C.textMuted }}>{e.Semana}</td>
                      <td style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: C.textMuted }}>{e.Fecha}</td>
                      <td style={{ fontWeight: 600, color: C.text }}>{e.Cliente}</td>
                      <td><span style={{ background: C.accentDim, color: C.accentLight, padding: "4px 10px", borderRadius: 8, fontSize: 12, fontWeight: 700 }}>{e.Tipo_embalaje}</span></td>
                      <td style={{ fontWeight: 700, fontFamily: "'DM Mono', monospace", color: C.text, fontSize: 15 }}>{e.Cantidad_cajas}</td>
                      <td style={{ fontFamily: "'DM Mono', monospace", color: "#34d399", fontWeight: 600 }}>{kg > 0 ? `${kg.toLocaleString(undefined, { maximumFractionDigits: 1 })} kg` : "—"}</td>
                      <td>{e.Variedad || "—"}</td>
                      <td><Btn variant="ghost" onClick={() => handleDelete(e.ID)}><Icons.Trash /></Btn></td>
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

// ═══════════════════════════════════════════════════════════════
// CALIDAD
// ═══════════════════════════════════════════════════════════════
function QualityTab({ samples, onRefresh, presentations, clients, sectors, loading, selectedDate, userName }: any) {
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  const emptyDefects = Object.fromEntries(DEFECTS.map(d => [d.key, ""]));
  const [form, setForm] = useState<any>({ fecha: getMexDate(), sectorId: "", presentationId: "", clientId: "", totalFruitCount: "", clamWeight: "", defects: { ...emptyDefects } });
  const setField = (k: string, v: string) => setForm((f: any) => ({ ...f, [k]: v }));
  const setDefect = (k: string, v: string) => setForm((f: any) => ({ ...f, defects: { ...f.defects, [k]: v } }));
  const filtered = samples.filter((s: any) => s.FechaHora && s.FechaHora.substring(0, 10) === selectedDate);

  const handleSubmit = async () => {
    if (!form.presentationId || !form.totalFruitCount) { toast.error('Complete la presentación y el conteo de frutas'); return; }
    const client = clients.find((c: any) => c.id === form.clientId);
    const pres = presentations.find((p: any) => p.id === form.presentationId);
    const sector = sectors.find((s: any) => s.id === form.sectorId);
    const insertData: any = { FechaHora: `${form.fecha}T${getMexTimeOnly()}`, tipo: 'calidad', Sector: sector?.name || '', Cliente: client?.name || '', Presentacion: pres?.shortCode || '', NombreInsp: userName, FrutaTotal: parseInt(form.totalFruitCount) || 0, PesoClam: parseInt(form.clamWeight) || 0 };
    DEFECTS.forEach(d => { insertData[d.dbCol] = parseInt(form.defects[d.key]) || 0; });
    setSubmitting(true);
    try { const { error } = await supabase.from('Calidad Empaque').insert(insertData); if (error) throw error; toast.success('Muestreo guardado'); setForm({ fecha: getMexDate(), sectorId: "", presentationId: "", clientId: "", totalFruitCount: "", clamWeight: "", defects: { ...emptyDefects } }); setShowForm(false); onRefresh(); }
    catch (e) { console.error(e); toast.error('Error al guardar'); } finally { setSubmitting(false); }
  };
  const handleDelete = async (id: number) => { try { const { error } = await supabase.from('Calidad Empaque').delete().eq('id', id); if (error) throw error; toast.success('Eliminado'); onRefresh(); } catch { toast.error('Error'); } };

  if (detailId !== null) {
    const s = filtered.find((s: any) => s.id === detailId) || samples.find((s: any) => s.id === detailId);
    if (!s) return <Card><p style={{ color: C.textMuted }}>Muestreo no encontrado.</p><Btn variant="secondary" onClick={() => setDetailId(null)}>← Volver</Btn></Card>;
    const dt = s.FechaHora ? new Date(s.FechaHora).toLocaleString("es-MX", { timeZone: "America/Mexico_City" }) : "—";
    return (
      <div className="bp-fade">
        <Btn variant="secondary" onClick={() => setDetailId(null)} style={{ marginBottom: 16 }}>← Volver a lista</Btn>
        <Card>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
            <div><Label>Fecha/Hora</Label><div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{dt}</div></div>
            <div><Label>Sector</Label><div style={{ fontSize: 14, color: C.text }}>{s.Sector || "—"}</div></div>
            <div><Label>Cliente</Label><div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{s.Cliente || "—"}</div></div>
            <div><Label>Presentación</Label><span style={{ background: C.accentDim, color: C.accentLight, padding: "4px 10px", borderRadius: 8, fontSize: 12, fontWeight: 700 }}>{s.Presentacion}</span></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
            <div><Label>Total Frutas</Label><div style={{ fontSize: 26, fontWeight: 700, color: C.text, fontFamily: "'DM Mono', monospace" }}>{s.FrutaTotal}</div></div>
            <div><Label>Peso Clam</Label><div style={{ fontSize: 26, fontWeight: 700, color: C.text, fontFamily: "'DM Mono', monospace" }}>{s.PesoClam}g</div></div>
            <div><Label>Peso</Label><div style={{ padding: "6px 12px", borderRadius: 8, display: "inline-block", fontWeight: 700, fontSize: 13, background: s.weightGrade === "pass" ? "rgba(52,211,153,0.12)" : "rgba(248,113,113,0.12)", color: s.weightGrade === "pass" ? "#34d399" : "#f87171" }}>{s.weightGrade === "pass" ? "✓ Cumple" : "✗ No cumple"}</div></div>
            <div><Label>Grado General</Label><GradeBadge grade={s.overallGrade} /></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14, marginBottom: 24 }}>
            <div style={{ background: C.surface, padding: 16, borderRadius: 12, border: `1px solid ${C.border}` }}>
              <Label>Merma 1 — Deshidrat. + Blanda + Rasgada</Label>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
                <span style={{ fontSize: 22, fontWeight: 700, color: C.text, fontFamily: "'DM Mono', monospace" }}>{s.merma1Sum}%</span>
                <span style={{ fontSize: 12, color: C.textMuted }}>/ 5%</span>
                <GradeBadge grade={s.grades?.dehydration || "excellent"} />
              </div>
            </div>
            <div style={{ background: C.surface, padding: 16, borderRadius: 12, border: `1px solid ${C.border}` }}>
              <Label>Merma 2 — Roja + Cicat. + Ped. + Peq. + Floral</Label>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
                <span style={{ fontSize: 22, fontWeight: 700, color: C.text, fontFamily: "'DM Mono', monospace" }}>{s.merma2Sum}%</span>
                <span style={{ fontSize: 12, color: C.textMuted }}>/ 15%</span>
                <GradeBadge grade={s.grades?.redFruit || "excellent"} />
              </div>
            </div>
          </div>
          <h4 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 700, color: C.text }}>Desglose de Defectos</h4>
          <div style={{ overflowX: "auto" }}>
            <table><thead><tr><th>Defecto</th><th>Cantidad</th><th>Porcentaje</th><th>Límite</th><th>Grado</th></tr></thead>
              <tbody>{DEFECTS.map(d => (
                <tr key={d.key}>
                  <td style={{ fontWeight: 600, color: C.text }}>{d.label}{d.group === "merma1" ? <span style={{ fontSize: 9, color: C.accent, marginLeft: 4 }}>M1</span> : d.group === "merma2" ? <span style={{ fontSize: 9, color: C.accent, marginLeft: 4 }}>M2</span> : null}</td>
                  <td style={{ fontFamily: "'DM Mono', monospace" }}>{s.defectCounts[d.key]}</td>
                  <td style={{ fontFamily: "'DM Mono', monospace" }}>{s.percentages[d.key]}%</td>
                  <td style={{ fontFamily: "'DM Mono', monospace", color: C.textMuted }}>{d.group === "merma1" ? "5% grp" : d.group === "merma2" ? "15% grp" : d.limit + "%"}</td>
                  <td><GradeBadge grade={s.grades[d.key]} /></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="bp-fade">
      <SectionTitle action={<Btn onClick={() => setShowForm(!showForm)}><Icons.Plus />{showForm ? "Cancelar" : "Nuevo Muestreo"}</Btn>}>🔬 Control de Calidad <span style={{ fontSize: 13, fontWeight: 500, color: C.textMuted, marginLeft: 8 }}>({filtered.length} muestreos)</span></SectionTitle>
      {showForm && (
        <Card className="bp-fade" style={{ marginBottom: 20 }}>
          {/* Inspector automático */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <span style={{ fontSize: 12, color: C.textMuted }}>👤 Inspector:</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.text, background: C.accentDim, padding: "4px 12px", borderRadius: 8 }}>{userName}</span>
          </div>
          <FormRow>
            <div>
              <Label>Fecha del Muestreo</Label>
              <Input type="date" value={form.fecha} onChange={(v: string) => setField("fecha", v)} />
            </div>
            <div><Label>Sector</Label><Select value={form.sectorId} onChange={(v: string) => setField("sectorId", v)} options={sectors.map((s: any) => ({ value: s.id, label: s.name }))} placeholder="Seleccionar..." /></div>
            <div><Label>Cliente</Label><Select value={form.clientId} onChange={(v: string) => setField("clientId", v)} options={clients.map((c: any) => ({ value: c.id, label: c.name }))} placeholder="Seleccionar..." /></div>
            <div><Label>Presentación</Label><Select value={form.presentationId} onChange={(v: string) => setField("presentationId", v)} options={presentations.map((p: any) => ({ value: p.id, label: p.shortCode }))} placeholder="Seleccionar..." /></div>
          </FormRow>
          <FormRow>
            <div><Label>Total Frutas</Label><Input type="number" value={form.totalFruitCount} onChange={(v: string) => setField("totalFruitCount", v)} placeholder="ej. 250" min="0" /></div>
            <div><Label>Peso Clam (g)</Label><Input type="number" value={form.clamWeight} onChange={(v: string) => setField("clamWeight", v)} placeholder="ej. 525" min="0" /></div>
          </FormRow>
          <h4 style={{ margin: "6px 0 14px", fontSize: 14, fontWeight: 700, color: C.text, borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>Conteo de Defectos</h4>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 18 }}>
            {DEFECTS.map(d => (
              <div key={d.key} style={{ background: C.surface, padding: "12px 14px", borderRadius: 10, border: `1px solid ${C.border}` }}>
                <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: C.textMuted, marginBottom: 6, textTransform: "uppercase" as const, letterSpacing: 0.3 }}>{d.label} <span style={{ opacity: 0.6 }}>({d.group === "merma1" ? "5% grp" : d.group === "merma2" ? "15% grp" : d.limit + "%"})</span></label>
                <Input type="number" value={form.defects[d.key]} onChange={(v: string) => setDefect(d.key, v)} placeholder="0" min="0" />
              </div>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}><Btn onClick={handleSubmit} disabled={submitting || !form.presentationId || !form.totalFruitCount} style={{ padding: "12px 32px" }}>{submitting ? <><Icons.Loader />Guardando...</> : "💾 Guardar"}</Btn></div>
        </Card>
      )}
      <Card>
        {loading ? <div style={{ textAlign: "center", padding: 40, color: C.textMuted }}><Icons.Loader />Cargando...</div> :
        filtered.length === 0 ? <EmptyState message={`No hay muestreos de calidad para ${selectedDate}.`} /> : (
          <div style={{ overflowX: "auto" }}>
            <table><thead><tr><th>Fecha/Hora</th><th>Sector</th><th>Cliente</th><th>Pres.</th><th>Frutas</th><th>Peso</th><th>Grado</th><th></th><th></th></tr></thead>
              <tbody>{filtered.map((s: any) => {
                const dt = s.FechaHora ? new Date(s.FechaHora).toLocaleString("es-MX", { timeZone: "America/Mexico_City", day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";
                return (<tr key={s.id}><td style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: C.textMuted }}>{dt}</td><td>{s.Sector || "—"}</td><td style={{ fontWeight: 600, color: C.text }}>{s.Cliente || "—"}</td><td><span style={{ background: C.accentDim, color: C.accentLight, padding: "4px 10px", borderRadius: 8, fontSize: 12, fontWeight: 700 }}>{s.Presentacion || "—"}</span></td><td style={{ fontFamily: "'DM Mono', monospace" }}>{s.FrutaTotal}</td><td><span style={{ fontFamily: "'DM Mono', monospace" }}>{s.PesoClam}g</span>{s.weightGrade === "fail" && <span style={{ color: "#f87171", fontSize: 11, marginLeft: 4 }}>⚠</span>}</td><td><GradeBadge grade={s.overallGrade} /></td><td><Btn variant="ghost" onClick={() => setDetailId(s.id)}><Icons.Eye /></Btn></td><td><Btn variant="ghost" onClick={() => handleDelete(s.id)}><Icons.Trash /></Btn></td></tr>);
              })}</tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MERMA — defectos en gramos / porcentaje sobre peso total
// ═══════════════════════════════════════════════════════════════
function MermaEmpaqueTab({ samples, onRefresh, sectors, loading, selectedDate, userName }: any) {
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const emptyDefects = Object.fromEntries(DEFECTS.map(d => [d.key, ""]));
  const [form, setForm] = useState<any>({ fecha: getMexDate(), sectorId: "", totalWeightG: "", kgMermaTotal: "", defects: { ...emptyDefects } });
  const setField = (k: string, v: string) => setForm((f: any) => ({ ...f, [k]: v }));
  const setDefect = (k: string, v: string) => setForm((f: any) => ({ ...f, defects: { ...f.defects, [k]: v } }));
  const filtered = samples.filter((s: any) => s.FechaHora && s.FechaHora.substring(0, 10) === selectedDate);
  const totalKgMerma = filtered.reduce((s: number, m: any) => s + (Number(m.kg_merma_total) || 0), 0);

  // Top 5 defectos por % de peso
  const top5 = DEFECTS.map(d => {
    const totalDefectG = filtered.reduce((s: number, m: any) => s + (m.defectGrams?.[d.key] || 0), 0);
    const totalSampleG = filtered.reduce((s: number, m: any) => s + (m.totalG || 0), 0);
    const pct = totalSampleG > 0 ? Math.round((totalDefectG / totalSampleG) * 10000) / 100 : 0;
    return { ...d, totalG: totalDefectG, pct };
  }).filter(d => d.pct > 0).sort((a, b) => b.pct - a.pct).slice(0, 5);

  const handleSubmit = async () => {
    if (!form.totalWeightG) { toast.error('Ingresa el peso total del muestreo en gramos'); return; }
    const sector = sectors.find((s: any) => s.id === form.sectorId);
    const insertData: any = {
      FechaHora: `${form.fecha}T${getMexTimeOnly()}`, tipo: 'merma',
      Sector: sector?.name || '', NombreInsp: userName,
      FrutaTotal: parseFloat(form.totalWeightG) || 0, // stores total grams
      kg_merma_total: parseFloat(form.kgMermaTotal) || null,
      Cliente: '', Presentacion: '', PesoClam: 0
    };
    DEFECTS.forEach(d => {
      const pct = parseFloat(form.defects[d.key]) || 0;
      insertData[d.dbCol] = form.totalWeightG ? Math.round((pct / 100) * parseFloat(form.totalWeightG) * 10) / 10 : 0;
    }); // converts % → grams
    setSubmitting(true);
    try {
      const { error } = await supabase.from('Calidad Empaque').insert(insertData);
      if (error) throw error;
      toast.success('Registro de merma guardado');
      setForm({ fecha: getMexDate(), sectorId: "", totalWeightG: "", kgMermaTotal: "", defects: { ...emptyDefects } });
      setShowForm(false); onRefresh();
    } catch (e) { console.error(e); toast.error('Error al guardar'); } finally { setSubmitting(false); }
  };
  const handleDelete = async (id: number) => { try { const { error } = await supabase.from('Calidad Empaque').delete().eq('id', id); if (error) throw error; toast.success('Eliminado'); onRefresh(); } catch { toast.error('Error'); } };

  return (
    <div className="bp-fade">
      <SectionTitle action={<Btn onClick={() => setShowForm(!showForm)} style={{ background: C.merma }}><Icons.Plus />{showForm ? "Cancelar" : "Nuevo Registro"}</Btn>}>
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: C.merma }}>📉</span> Merma de Empaque
          <span style={{ fontSize: 13, fontWeight: 500, color: C.textMuted }}>({filtered.length} registros hoy)</span>
        </span>
      </SectionTitle>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr", gap: 16, marginBottom: 24 }}>
        <StatCard label="Kg Merma Total Hoy" value={totalKgMerma > 0 ? `${totalKgMerma.toFixed(1)} kg` : "—"} color={C.merma} />
        <StatCard label="Registros del Día" value={filtered.length} color={C.mermaLight} />
        <Card>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase" as const, letterSpacing: 0.6, marginBottom: 12 }}>Top 5 Defectos del Día <span style={{ fontSize: 10, color: C.textMuted, fontWeight: 400 }}>— % sobre peso muestreo</span></div>
          {top5.length === 0
            ? <div style={{ fontSize: 20, fontWeight: 700, color: C.textMuted }}>—</div>
            : (
              <div style={{ display: "flex", flexDirection: "column" as const, gap: 8 }}>
                {top5.map((d, i) => (
                  <div key={d.key} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: C.merma, minWidth: 20, fontFamily: "'DM Mono', monospace" }}>#{i + 1}</span>
                    <span style={{ fontSize: 12, color: C.textSecondary, minWidth: 130 }}>{d.label}</span>
                    <MiniBar value={d.pct} max={top5[0].pct} color={C.merma} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: C.mermaLight, fontFamily: "'DM Mono', monospace", minWidth: 50, textAlign: "right" as const }}>{d.pct}%</span>
                    <span style={{ fontSize: 11, color: C.textMuted, minWidth: 46, textAlign: "right" as const }}>{d.totalG.toFixed(0)}g</span>
                  </div>
                ))}
              </div>
            )}
        </Card>
      </div>

      {showForm && (
        <Card className="bp-fade" style={{ marginBottom: 20, border: `1.5px solid ${C.merma}44` }}>
          {/* Inspector automático */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <span style={{ fontSize: 12, color: C.textMuted }}>👤 Inspector:</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.text, background: C.accentDim, padding: "4px 12px", borderRadius: 8 }}>{userName}</span>
            <div style={{ fontSize: 12, color: C.textMuted, fontFamily: "'DM Mono', monospace", background: C.input, padding: "4px 10px", borderRadius: 8, marginLeft: 8 }}>🕐 {getMexDate()} · {getMexTime()}</div>
          </div>
          <FormRow>
            <div>
              <Label>Fecha del Registro</Label>
              <Input type="date" value={form.fecha} onChange={(v: string) => setField("fecha", v)} style={{ borderColor: C.merma + "66" }} />
            </div>
            <div><Label>Sector</Label><Select value={form.sectorId} onChange={(v: string) => setField("sectorId", v)} options={sectors.map((s: any) => ({ value: s.id, label: s.name }))} placeholder="Seleccionar..." /></div>
            <div>
              <Label>Kg Merma Total del Día</Label>
              <Input type="number" value={form.kgMermaTotal} onChange={(v: string) => setField("kgMermaTotal", v)} placeholder="ej. 45.5" min="0" step="0.1" style={{ borderColor: C.merma + "66" }} />
              <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>Kilogramos totales de merma del empaque en el día</div>
            </div>
          </FormRow>
          <FormRow>
            <div>
              <Label>Peso Total del Muestreo (g)</Label>
              <Input type="number" value={form.totalWeightG} onChange={(v: string) => setField("totalWeightG", v)} placeholder="ej. 1500" min="1" step="0.1" />
              <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>Peso total en gramos de todas las frutas del muestreo</div>
            </div>
          </FormRow>
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 16, marginTop: 4 }}>
            <h4 style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 700, color: C.text }}>
              % de Defectos
              <span style={{ fontSize: 12, fontWeight: 400, color: C.textMuted, marginLeft: 8 }}>— Ingresa el porcentaje de cada defecto</span>
            </h4>
            {!form.totalWeightG && (
              <div style={{ fontSize: 12, color: "#fbbf24", marginBottom: 12, padding: "6px 12px", borderRadius: 8, background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)" }}>
                ⚠️ Ingresa primero el peso total del muestreo para ver los gramos calculados
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 18 }}>
              {DEFECTS.map(d => {
                const pctVal = parseFloat(form.defects[d.key]) || 0;
                const grams = form.totalWeightG && pctVal > 0
                  ? Math.round((pctVal / 100) * parseFloat(form.totalWeightG) * 10) / 10 : null;
                return (
                  <div key={d.key} style={{ background: C.surface, padding: "12px 14px", borderRadius: 10, border: `1px solid ${pctVal > 0 ? C.merma + "55" : C.border}` }}>
                    <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: C.textMuted, marginBottom: 6, textTransform: "uppercase" as const, letterSpacing: 0.3 }}>{d.label}</label>
                    <div style={{ position: "relative" as const }}>
                      <Input
                        type="number" value={form.defects[d.key]}
                        onChange={(v: string) => setDefect(d.key, v)}
                        placeholder="0" min="0" max="100" step="0.1"
                        style={{ paddingRight: 28 }}
                      />
                      <span style={{ position: "absolute" as const, right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: C.textMuted, pointerEvents: "none" as const }}>%</span>
                    </div>
                    {grams !== null ? (
                      <div style={{ fontSize: 11, color: C.mermaLight, marginTop: 5, fontFamily: "'DM Mono', monospace", display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ color: C.textMuted }}>≈</span> {grams}g
                      </div>
                    ) : (
                      <div style={{ fontSize: 11, color: C.textMuted, marginTop: 5 }}>— g</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Btn onClick={handleSubmit} disabled={submitting || !form.totalWeightG} style={{ padding: "12px 32px", background: C.merma }}>
              {submitting ? <><Icons.Loader />Guardando...</> : "💾 Guardar Registro"}
            </Btn>
          </div>
        </Card>
      )}
      <Card>
        {loading ? <div style={{ textAlign: "center", padding: 40, color: C.textMuted }}><Icons.Loader />Cargando...</div> :
        filtered.length === 0 ? <EmptyState message={`No hay registros de merma para ${selectedDate}.`} /> : (
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead><tr><th>Hora</th><th>Sector</th><th>Inspector</th><th>Kg Merma</th><th>Peso Muestra (g)</th>{DEFECTS.map(d => <th key={d.key} style={{ minWidth: 120 }}>{d.label}</th>)}<th></th></tr></thead>
              <tbody>
                {filtered.map((m: any) => {
                  const dt = m.FechaHora ? new Date(m.FechaHora).toLocaleTimeString("es-MX", { timeZone: "America/Mexico_City", hour: "2-digit", minute: "2-digit" }) : "—";
                  return (
                    <tr key={m.id}>
                      <td style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: C.textMuted }}>{dt}</td>
                      <td>{m.Sector || "—"}</td>
                      <td style={{ fontSize: 12, color: C.textMuted }}>{m.NombreInsp || "—"}</td>
                      <td style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700, color: C.merma }}>{m.kg_merma_total ? `${Number(m.kg_merma_total).toFixed(1)} kg` : "—"}</td>
                      <td style={{ fontFamily: "'DM Mono', monospace" }}>{m.totalG > 0 ? `${m.totalG.toFixed(0)}g` : "—"}</td>
                      {DEFECTS.map(d => (
                        <td key={d.key} style={{ fontFamily: "'DM Mono', monospace", fontSize: 12 }}>
                          {m.defectGrams[d.key] > 0
                            ? <span>{m.defectGrams[d.key].toFixed(0)}g<span style={{ color: C.mermaLight, fontSize: 10, marginLeft: 4 }}>({m.percentages[d.key]}%)</span></span>
                            : <span style={{ color: C.textMuted }}>—</span>}
                        </td>
                      ))}
                      <td><Btn variant="ghost" onClick={() => handleDelete(m.id)}><Icons.Trash /></Btn></td>
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

// ═══════════════════════════════════════════════════════════════
// MUESTREOS FRUTA
// ═══════════════════════════════════════════════════════════════
function FruitSamplingTab({ samples, onRefresh, sectors, varieties, loading, selectedDate, userName }: any) {
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ fecha: getMexDate(), sectorId: "", varietyId: "", brix: "", pesoTotal: "", totalFrutas: "", jumbo18: "", jumbo19: "", notas: "" });
  const setField = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  const filtered = samples.filter((s: any) => s.fecha_hora && s.fecha_hora.substring(0, 10) === selectedDate);

  const sumPeso = filtered.reduce((s: number, f: any) => s + Number(f.peso_fruta_g || 0), 0);
  const sumFrutas = filtered.reduce((s: number, f: any) => s + Number(f.total_frutas || 0), 0);
  const avgPeso = sumFrutas > 0 ? Math.round((sumPeso / sumFrutas) * 100) / 100 : 0;
  const sumPesoJ18 = filtered.reduce((s: number, f: any) => s + Number(f.frutas_jumbo_18mm || 0), 0);
  const sumPesoJ19 = filtered.reduce((s: number, f: any) => s + Number(f.frutas_jumbo_19mm || 0), 0);
  const pctJ18 = sumPeso > 0 ? Math.round((sumPesoJ18 / sumPeso) * 1000) / 10 : 0;
  const pctJ19 = sumPeso > 0 ? Math.round((sumPesoJ19 / sumPeso) * 1000) / 10 : 0;
  const avgBrix = filtered.length > 0 ? Math.round((filtered.reduce((s: number, f: any) => s + Number(f.grados_brix || 0), 0) / filtered.length) * 100) / 100 : 0;

  const handleSubmit = async () => {
    if (!form.varietyId || !form.brix || !form.pesoTotal || !form.totalFrutas) { toast.error("Complete variedad, brix, peso y total frutas"); return; }
    const variety = varieties.find((v: any) => v.id === form.varietyId);
    const sector = sectors.find((s: any) => s.id === form.sectorId);
    setSubmitting(true);
    try {
      const { error } = await supabase.from('muestreos_fruta').insert({
        fecha_hora: `${form.fecha}T${getMexTimeOnly()}`, sector: sector?.name || '', variedad: variety?.name || '',
        inspector: userName, grados_brix: parseFloat(form.brix) || 0,
        peso_fruta_g: parseFloat(form.pesoTotal) || 0,
        total_frutas: parseInt(form.totalFrutas) || 1,
        frutas_jumbo_18mm: parseFloat(form.jumbo18) || 0,
        frutas_jumbo_19mm: parseFloat(form.jumbo19) || 0,
        notas: form.notas || ''
      });
      if (error) throw error;
      toast.success('Muestreo de fruta guardado');
      setForm({ fecha: getMexDate(), sectorId: "", varietyId: "", brix: "", pesoTotal: "", totalFrutas: "", jumbo18: "", jumbo19: "", notas: "" });
      setShowForm(false); onRefresh();
    } catch (e) { console.error(e); toast.error('Error al guardar'); } finally { setSubmitting(false); }
  };
  const handleDelete = async (id: number) => { try { const { error } = await supabase.from('muestreos_fruta').delete().eq('id', id); if (error) throw error; toast.success('Eliminado'); onRefresh(); } catch { toast.error('Error'); } };

  return (
    <div className="bp-fade">
      <SectionTitle action={<Btn onClick={() => setShowForm(!showForm)}><Icons.Plus />{showForm ? "Cancelar" : "Nuevo Muestreo"}</Btn>}>🫐 Muestreos de Fruta <span style={{ fontSize: 13, fontWeight: 500, color: C.textMuted, marginLeft: 8 }}>({filtered.length} registros)</span></SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        <Card><div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: "uppercase" as const, letterSpacing: 0.5 }}>Grados Brix (prom)</div><div style={{ fontSize: 36, fontWeight: 700, color: "#34d399", marginTop: 6, fontFamily: "'DM Mono', monospace", lineHeight: 1 }}>{avgBrix > 0 ? `${avgBrix}°` : "—"}</div></Card>
        <Card><div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: "uppercase" as const, letterSpacing: 0.5 }}>Peso Prom. / Fruta</div><div style={{ fontSize: 36, fontWeight: 700, color: "#60a5fa", marginTop: 6, fontFamily: "'DM Mono', monospace", lineHeight: 1 }}>{avgPeso > 0 ? `${avgPeso}g` : "—"}</div><div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>PesoTotal / #Frutas</div></Card>
        <Card><div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: "uppercase" as const, letterSpacing: 0.5 }}>% Jumbo +18mm</div><div style={{ fontSize: 36, fontWeight: 700, color: "#fbbf24", marginTop: 6, fontFamily: "'DM Mono', monospace", lineHeight: 1 }}>{filtered.length > 0 ? `${pctJ18}%` : "—"}</div><div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>{sumPesoJ18.toFixed(0)}g / {sumPeso.toFixed(0)}g</div></Card>
        <Card><div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: "uppercase" as const, letterSpacing: 0.5 }}>% Jumbo +19mm</div><div style={{ fontSize: 36, fontWeight: 700, color: "#fb923c", marginTop: 6, fontFamily: "'DM Mono', monospace", lineHeight: 1 }}>{filtered.length > 0 ? `${pctJ19}%` : "—"}</div><div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>{sumPesoJ19.toFixed(0)}g / {sumPeso.toFixed(0)}g</div></Card>
      </div>

      {filtered.length > 0 && (() => {
        const byVar: Record<string, any[]> = {};
        filtered.forEach((f: any) => { const v = f.variedad || "Sin var."; if (!byVar[v]) byVar[v] = []; byVar[v].push(f); });
        return (
          <Card style={{ marginBottom: 24 }}>
            <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: C.text }}>Métricas por Variedad</h3>
            <div style={{ overflowX: "auto" }}>
              <table><thead><tr><th>Variedad</th><th>Muestreos</th><th>Brix Prom.</th><th>Peso Prom. (g/fruta)</th><th>% J+18mm</th><th>% J+19mm</th></tr></thead>
                <tbody>{Object.entries(byVar).map(([v, rows]) => {
                  const ab = Math.round((rows.reduce((s: number, r: any) => s + Number(r.grados_brix), 0) / rows.length) * 100) / 100;
                  const tp = rows.reduce((s: number, r: any) => s + Number(r.peso_fruta_g), 0);
                  const tf = rows.reduce((s: number, r: any) => s + Number(r.total_frutas), 0);
                  const ap = tf > 0 ? Math.round((tp / tf) * 100) / 100 : 0;
                  const pj18 = rows.reduce((s: number, r: any) => s + Number(r.frutas_jumbo_18mm), 0);
                  const pj19 = rows.reduce((s: number, r: any) => s + Number(r.frutas_jumbo_19mm), 0);
                  return (<tr key={v}><td style={{ fontWeight: 600, color: C.text }}>{v}</td><td style={{ fontFamily: "'DM Mono', monospace" }}>{rows.length}</td><td style={{ fontFamily: "'DM Mono', monospace", color: "#34d399", fontWeight: 700 }}>{ab}°</td><td style={{ fontFamily: "'DM Mono', monospace" }}>{ap}g</td><td style={{ fontFamily: "'DM Mono', monospace", color: "#fbbf24" }}>{tp > 0 ? Math.round((pj18 / tp) * 1000) / 10 : 0}%</td><td style={{ fontFamily: "'DM Mono', monospace", color: "#fb923c" }}>{tp > 0 ? Math.round((pj19 / tp) * 1000) / 10 : 0}%</td></tr>);
                })}</tbody>
              </table>
            </div>
          </Card>
        );
      })()}

      {showForm && (
        <Card className="bp-fade" style={{ marginBottom: 20 }}>
          {/* Inspector automático + hora informativa */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <span style={{ fontSize: 12, color: C.textMuted }}>👤 Inspector:</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.text, background: C.accentDim, padding: "4px 12px", borderRadius: 8 }}>{userName}</span>
            <div style={{ fontSize: 12, color: C.textMuted, fontFamily: "'DM Mono', monospace", background: C.input, padding: "4px 10px", borderRadius: 8, marginLeft: 8 }}>🕐 {getMexDate()} · {getMexTime()}</div>
          </div>
          <FormRow>
            <div>
              <Label>Fecha del Muestreo</Label>
              <Input type="date" value={form.fecha} onChange={(v: string) => setField("fecha", v)} />
              <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>Fecha que se registrará en la BD</div>
            </div>
            <div><Label>Sector</Label><Select value={form.sectorId} onChange={(v: string) => setField("sectorId", v)} options={sectors.map((s: any) => ({ value: s.id, label: s.name }))} placeholder="Seleccionar..." /></div>
            <div><Label>Variedad</Label><Select value={form.varietyId} onChange={(v: string) => setField("varietyId", v)} options={varieties.map((v: any) => ({ value: v.id, label: v.name }))} placeholder="Seleccionar..." /></div>
          </FormRow>
          <FormRow>
            <div><Label>Grados Brix</Label><Input type="number" value={form.brix} onChange={(v: string) => setField("brix", v)} placeholder="ej. 12.5" min="0" max="35" step="0.1" /></div>
            <div>
              <Label>Peso Total Muestra (g)</Label>
              <Input type="number" value={form.pesoTotal} onChange={(v: string) => setField("pesoTotal", v)} placeholder="ej. 1050" min="0" step="0.1" />
              <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>Peso de todas las frutas juntas</div>
            </div>
            <div><Label>Total Frutas Muestra</Label><Input type="number" value={form.totalFrutas} onChange={(v: string) => setField("totalFrutas", v)} placeholder="ej. 50" min="1" /></div>
          </FormRow>
          <FormRow>
            <div>
              <Label>Peso Jumbo +18mm (g)</Label>
              <Input type="number" value={form.jumbo18} onChange={(v: string) => setField("jumbo18", v)} placeholder="0" min="0" step="0.1" />
              {form.pesoTotal && parseFloat(form.jumbo18) > 0 && (
                <div style={{ fontSize: 11, color: "#fbbf24", marginTop: 4, fontFamily: "'DM Mono', monospace" }}>%J18 = {Math.round((parseFloat(form.jumbo18) / parseFloat(form.pesoTotal)) * 1000) / 10}%</div>
              )}
            </div>
            <div>
              <Label>Peso Jumbo +19mm (g)</Label>
              <Input type="number" value={form.jumbo19} onChange={(v: string) => setField("jumbo19", v)} placeholder="0" min="0" step="0.1" />
              {form.pesoTotal && parseFloat(form.jumbo19) > 0 && (
                <div style={{ fontSize: 11, color: "#fb923c", marginTop: 4, fontFamily: "'DM Mono', monospace" }}>%J19 = {Math.round((parseFloat(form.jumbo19) / parseFloat(form.pesoTotal)) * 1000) / 10}%</div>
              )}
            </div>
            <div><Label>Notas</Label><Input value={form.notas} onChange={(v: string) => setField("notas", v)} placeholder="Observaciones..." /></div>
          </FormRow>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Btn onClick={handleSubmit} disabled={submitting || !form.fecha || !form.varietyId || !form.brix || !form.pesoTotal || !form.totalFrutas} style={{ padding: "12px 32px" }}>
              {submitting ? <><Icons.Loader />Guardando...</> : "💾 Guardar"}
            </Btn>
          </div>
        </Card>
      )}
      <Card>
        {loading ? <div style={{ textAlign: "center", padding: 40, color: C.textMuted }}><Icons.Loader />Cargando...</div> :
        filtered.length === 0 ? <EmptyState message={`No hay muestreos de fruta para ${selectedDate}.`} /> : (
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead><tr><th>Hora</th><th>Sector</th><th>Variedad</th><th>Brix</th><th>Peso Total (g)</th><th>Frutas</th><th>g/Fruta</th><th>J+18mm</th><th>J+19mm</th><th>Inspector</th><th></th></tr></thead>
              <tbody>{filtered.map((f: any) => {
                const dt = f.fecha_hora ? new Date(f.fecha_hora).toLocaleTimeString("es-MX", { timeZone: "America/Mexico_City", hour: "2-digit", minute: "2-digit" }) : "—";
                const pesoTotal = Number(f.peso_fruta_g || 0);
                const numFrutas = Number(f.total_frutas || 0);
                const gFruta = numFrutas > 0 ? Math.round((pesoTotal / numFrutas) * 100) / 100 : 0;
                const pJ18 = pesoTotal > 0 ? Math.round((Number(f.frutas_jumbo_18mm) / pesoTotal) * 1000) / 10 : 0;
                const pJ19 = pesoTotal > 0 ? Math.round((Number(f.frutas_jumbo_19mm) / pesoTotal) * 1000) / 10 : 0;
                return (
                  <tr key={f.id}>
                    <td style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: C.textMuted }}>{dt}</td>
                    <td>{f.sector}</td>
                    <td style={{ fontWeight: 600, color: C.text }}>{f.variedad}</td>
                    <td style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700, color: "#34d399" }}>{f.grados_brix}°</td>
                    <td style={{ fontFamily: "'DM Mono', monospace", color: "#60a5fa", fontWeight: 600 }}>{pesoTotal.toFixed(1)}g</td>
                    <td style={{ fontFamily: "'DM Mono', monospace" }}>{numFrutas}</td>
                    <td style={{ fontFamily: "'DM Mono', monospace", color: C.textSecondary }}>{gFruta > 0 ? `${gFruta}g` : "—"}</td>
                    <td style={{ fontFamily: "'DM Mono', monospace", color: "#fbbf24" }}>{Number(f.frutas_jumbo_18mm).toFixed(0)}g <span style={{ fontSize: 10, color: C.textMuted }}>({pJ18}%)</span></td>
                    <td style={{ fontFamily: "'DM Mono', monospace", color: "#fb923c" }}>{Number(f.frutas_jumbo_19mm).toFixed(0)}g <span style={{ fontSize: 10, color: C.textMuted }}>({pJ19}%)</span></td>
                    <td style={{ fontSize: 12, color: C.textMuted }}>{f.inspector || "—"}</td>
                    <td><Btn variant="ghost" onClick={() => handleDelete(f.id)}><Icons.Trash /></Btn></td>
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

// ═══════════════════════════════════════════════════════════════
// KPIs — filtro bicíclo con dos años + semanas cruzadas
// ═══════════════════════════════════════════════════════════════
function KPIsTab({ packingEntries, qualitySamples, mermaSamples, fruitSamples, presentations, clients }: any) {
  const currentYear = getCurrentYear();
  const currentWeek = getWeekNumber(getMexDate());

  // Estado del filtro: año inicio, semana inicio, año fin, semana fin
  const [yearFrom, setYearFrom] = useState(currentYear - 1);
  const [weekFrom, setWeekFrom] = useState(40);
  const [yearTo, setYearTo] = useState(currentYear);
  const [weekTo, setWeekTo] = useState(currentWeek);

  const yearOpts = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map(y => ({ value: y, label: String(y) }));
  const weekOpts = Array.from({ length: 52 }, (_, i) => ({ value: i + 1, label: `Sem. ${i + 1}` }));

  // Comparar posición temporal (año, semana)
  const toPos = (y: number, w: number) => y * 100 + w;
  const fromPos = toPos(yearFrom, weekFrom);
  const toPosFinal = toPos(yearTo, weekTo);

  function inRange(dateStr: string) {
    if (!dateStr) return false;
    const d = dateStr.substring(0, 10);
    const y = getISOYear(d);
    const w = getWeekNumber(d);
    const pos = toPos(y, w);
    return pos >= fromPos && pos <= toPosFinal;
  }

  const fp = packingEntries.filter((e: any) => inRange(e.Fecha));
  const fq = qualitySamples.filter((s: any) => inRange(s.FechaHora?.substring(0, 10)));
  const fm = mermaSamples.filter((m: any) => inRange(m.FechaHora?.substring(0, 10)));
  const ff = fruitSamples.filter((f: any) => inRange(f.fecha_hora?.substring(0, 10)));

  const totalCajas = fp.reduce((s: number, e: any) => s + (Number(e.Cantidad_cajas) || 0), 0);
  const totalKg = fp.reduce((s: number, e: any) => s + getKgForEntry(e.Tipo_embalaje, Number(e.Cantidad_cajas) || 0), 0);

  // ─── Presentaciones por cliente ──────────────────────────────
  type PresRow = { pres: string; cajas: number; kg: number };
  type ClientData = { cajas: number; kg: number; pres: PresRow[] };
  const clientPresMap: Record<string, ClientData> = {};
  fp.forEach((e: any) => {
    const cli = e.Cliente || "—";
    const pres = e.Tipo_embalaje || "—";
    const cajas = Number(e.Cantidad_cajas) || 0;
    const kg = getKgForEntry(pres, cajas);
    if (!clientPresMap[cli]) clientPresMap[cli] = { cajas: 0, kg: 0, pres: [] };
    clientPresMap[cli].cajas += cajas;
    clientPresMap[cli].kg += kg;
    const existing = clientPresMap[cli].pres.find(p => p.pres === pres);
    if (existing) { existing.cajas += cajas; existing.kg += kg; }
    else clientPresMap[cli].pres.push({ pres, cajas, kg });
  });
  const clientDataSorted = Object.entries(clientPresMap)
    .map(([name, d]) => ({ name, ...d, pres: d.pres.sort((a, b) => b.cajas - a.cajas) }))
    .sort((a, b) => b.cajas - a.cajas);

  // ─── Cajas por presentación — dinámico (solo lo que hay en los datos) ──
  const presCodesUsed = [...new Set(fp.map((e: any) => e.Tipo_embalaje).filter(Boolean))].sort() as string[];
  const cajasPorPres = presCodesUsed.map(code => ({
    code,
    cajas: fp.filter((e: any) => e.Tipo_embalaje === code).reduce((s: number, e: any) => s + (Number(e.Cantidad_cajas) || 0), 0),
    kg: fp.filter((e: any) => e.Tipo_embalaje === code).reduce((s: number, e: any) => s + getKgForEntry(code, Number(e.Cantidad_cajas) || 0), 0),
  })).filter(p => p.cajas > 0).sort((a, b) => b.cajas - a.cajas);

  // ─── Jumbo por semana (muestreos fruta) ──────────────────────
  type JumboWeek = { pesoTotal: number; pesoJ18: number; pesoJ19: number };
  const jumboWeekMap: Record<string, JumboWeek> = {};
  ff.forEach((f: any) => {
    const dateStr = f.fecha_hora?.substring(0, 10) || "";
    if (!dateStr) return;
    const isoY = getISOYear(dateStr);
    const w = getWeekNumber(dateStr);
    const key = `${isoY}-${String(w).padStart(2, "0")}`;
    if (!jumboWeekMap[key]) jumboWeekMap[key] = { pesoTotal: 0, pesoJ18: 0, pesoJ19: 0 };
    jumboWeekMap[key].pesoTotal += Number(f.peso_fruta_g || 0);
    jumboWeekMap[key].pesoJ18 += Number(f.frutas_jumbo_18mm || 0);
    jumboWeekMap[key].pesoJ19 += Number(f.frutas_jumbo_19mm || 0);
  });
  const jumboWeeksSorted = Object.entries(jumboWeekMap).sort((a, b) => a[0].localeCompare(b[0]));
  const maxJ18Pct = Math.max(...jumboWeeksSorted.map(([, v]) => v.pesoTotal > 0 ? v.pesoJ18 / v.pesoTotal * 100 : 0), 1);
  const maxJ19Pct = Math.max(...jumboWeeksSorted.map(([, v]) => v.pesoTotal > 0 ? v.pesoJ19 / v.pesoTotal * 100 : 0), 1);

  // ─── Jumbo por variedad ───────────────────────────────────────
  type JumboVar = { pesoTotal: number; pesoJ18: number; pesoJ19: number; muestreos: number };
  const jumboVarMap: Record<string, JumboVar> = {};
  ff.forEach((f: any) => {
    const v = f.variedad || "Sin variedad";
    if (!jumboVarMap[v]) jumboVarMap[v] = { pesoTotal: 0, pesoJ18: 0, pesoJ19: 0, muestreos: 0 };
    jumboVarMap[v].pesoTotal += Number(f.peso_fruta_g || 0);
    jumboVarMap[v].pesoJ18 += Number(f.frutas_jumbo_18mm || 0);
    jumboVarMap[v].pesoJ19 += Number(f.frutas_jumbo_19mm || 0);
    jumboVarMap[v].muestreos += 1;
  });
  const jumboVarSorted = Object.entries(jumboVarMap)
    .map(([v, d]) => ({ variedad: v, ...d, pctJ18: d.pesoTotal > 0 ? Math.round((d.pesoJ18 / d.pesoTotal) * 1000) / 10 : 0, pctJ19: d.pesoTotal > 0 ? Math.round((d.pesoJ19 / d.pesoTotal) * 1000) / 10 : 0 }))
    .sort((a, b) => b.pctJ18 - a.pctJ18);
  const totalJumboJ18 = ff.reduce((s: number, f: any) => s + Number(f.frutas_jumbo_18mm || 0), 0);
  const totalJumboJ19 = ff.reduce((s: number, f: any) => s + Number(f.frutas_jumbo_19mm || 0), 0);
  const totalFruitPeso = ff.reduce((s: number, f: any) => s + Number(f.peso_fruta_g || 0), 0);
  const totalPctJ18 = totalFruitPeso > 0 ? Math.round((totalJumboJ18 / totalFruitPeso) * 1000) / 10 : 0;
  const totalPctJ19 = totalFruitPeso > 0 ? Math.round((totalJumboJ19 / totalFruitPeso) * 1000) / 10 : 0;

  // ─── Merma ────────────────────────────────────────────────────
  const totalKgMerma = fm.reduce((s: number, m: any) => s + (Number(m.kg_merma_total) || 0), 0);
  // Merma por semana
  const mermaWeekMap: Record<string, number> = {};
  fm.forEach((m: any) => {
    const dateStr = m.FechaHora?.substring(0, 10) || "";
    if (!dateStr) return;
    const y = new Date(dateStr + "T12:00:00").getFullYear();
    const w = getWeekNumber(dateStr);
    const key = `${y}-${String(w).padStart(2, "0")}`;
    mermaWeekMap[key] = (mermaWeekMap[key] || 0) + (Number(m.kg_merma_total) || 0);
  });
  const mermaWeeksSorted = Object.entries(mermaWeekMap).sort((a, b) => a[0].localeCompare(b[0]));
  const maxKgSemana = Math.max(...mermaWeeksSorted.map(([, v]) => v), 1);

  // Top 5 defectos del período por % promedio ponderado
  const totalMermaSampleG = fm.reduce((s: number, m: any) => s + (m.totalG || 0), 0);
  const mermaDefectTop5 = DEFECTS.map(d => {
    const totalDefectG = fm.reduce((s: number, m: any) => s + (m.defectGrams?.[d.key] || 0), 0);
    const pct = totalMermaSampleG > 0 ? Math.round((totalDefectG / totalMermaSampleG) * 10000) / 100 : 0;
    return { ...d, totalG: totalDefectG, pct };
  }).filter(d => d.pct > 0).sort((a, b) => b.pct - a.pct);
  const top5Merma = mermaDefectTop5.slice(0, 5);
  const maxMermaPct = Math.max(...top5Merma.map(d => d.pct), 1);

  // Desglose completo de defectos en gramos y %
  const mermaDefectAll = DEFECTS.map(d => {
    const totalDefectG = fm.reduce((s: number, m: any) => s + (m.defectGrams?.[d.key] || 0), 0);
    const pct = totalMermaSampleG > 0 ? Math.round((totalDefectG / totalMermaSampleG) * 10000) / 100 : 0;
    return { ...d, totalG: totalDefectG, pct };
  }).filter(d => d.totalG > 0).sort((a, b) => b.pct - a.pct);
  const maxAllPct = Math.max(...mermaDefectAll.map(d => d.pct), 1);

  // ─── Calidad ──────────────────────────────────────────────────
  const gradeDist: Record<string, number> = { excellent: 0, good: 0, medium: 0, poor: 0, reject: 0 };
  fq.forEach((s: any) => { if (s.overallGrade) gradeDist[s.overallGrade]++; });
  const totalQS = fq.length;
  const pctExcelente = totalQS > 0 ? Math.round((gradeDist.excellent / totalQS) * 100) : 0;
  const pctRechazo = totalQS > 0 ? Math.round((gradeDist.reject / totalQS) * 100) : 0;
  const avgBrix = ff.length > 0 ? Math.round((ff.reduce((s: number, f: any) => s + Number(f.grados_brix || 0), 0) / ff.length) * 100) / 100 : 0;
  const qualityDefectAvg: Record<string, number> = {};
  DEFECTS.forEach(d => { qualityDefectAvg[d.key] = totalQS > 0 ? Math.round((fq.reduce((s: number, q: any) => s + (q.percentages?.[d.key] || 0), 0) / totalQS) * 100) / 100 : 0; });
  const qualityDefectSorted = DEFECTS.map(d => ({ ...d, avg: qualityDefectAvg[d.key] })).sort((a, b) => b.avg - a.avg);
  const maxDefectAvg = Math.max(...qualityDefectSorted.map(d => d.avg), 1);

  const noData = fp.length === 0 && fq.length === 0 && fm.length === 0;
  const rangeInvalid = fromPos > toPosFinal;

  const SectionHeader = ({ emoji, title, color = C.accent }: any) => (
    <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "32px 0 16px", paddingBottom: 12, borderBottom: `2px solid ${color}44` }}>
      <span style={{ fontSize: 22 }}>{emoji}</span>
      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: C.text }}>{title}</h2>
      <div style={{ flex: 1, height: 2, background: `linear-gradient(90deg, ${color}44, transparent)`, borderRadius: 2 }} />
    </div>
  );

  const selStyle: any = { padding: "7px 12px", borderRadius: 8, border: `1.5px solid ${C.inputBorder}`, background: C.input, color: C.text, fontSize: 13, outline: "none", fontFamily: "'DM Mono', monospace" };

  return (
    <div className="bp-fade">
      {/* ── Filtro bicíclo ───────────────────────────────────────── */}
      <Card style={{ marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" as const }}>
          {/* Desde */}
          <div style={{ display: "flex", flexDirection: "column" as const, gap: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: "uppercase" as const, letterSpacing: 0.6 }}>Desde</span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <select value={yearFrom} onChange={e => setYearFrom(Number(e.target.value))} style={selStyle}>
                {yearOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <select value={weekFrom} onChange={e => setWeekFrom(Number(e.target.value))} style={{ ...selStyle, minWidth: 90 }}>
                {weekOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          <div style={{ color: C.textMuted, fontSize: 20, marginTop: 16 }}>→</div>

          {/* Hasta */}
          <div style={{ display: "flex", flexDirection: "column" as const, gap: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: "uppercase" as const, letterSpacing: 0.6 }}>Hasta</span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <select value={yearTo} onChange={e => setYearTo(Number(e.target.value))} style={selStyle}>
                {yearOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <select value={weekTo} onChange={e => setWeekTo(Number(e.target.value))} style={{ ...selStyle, minWidth: 90 }}>
                {weekOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          {/* Atajos de ciclo */}
          <div style={{ marginLeft: "auto", display: "flex", flexDirection: "column" as const, gap: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: "uppercase" as const, letterSpacing: 0.6 }}>Atajos de ciclo</span>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const }}>
              {[
                { label: "Ciclo actual", yf: currentYear - 1, wf: 40, yt: currentYear, wt: currentWeek },
                { label: "Ciclo anterior", yf: currentYear - 2, wf: 40, yt: currentYear - 1, wt: 22 },
                { label: "Últimas 8 sem.", yf: (() => { const w = currentWeek - 7; return w > 0 ? currentYear : currentYear - 1; })(), wf: (() => { const w = currentWeek - 7; return w > 0 ? w : 52 + (currentWeek - 7); })(), yt: currentYear, wt: currentWeek },
                { label: "Este año", yf: currentYear, wf: 1, yt: currentYear, wt: 52 },
              ].map(p => {
                const isActive = yearFrom === p.yf && weekFrom === p.wf && yearTo === p.yt && weekTo === p.wt;
                return (
                  <button key={p.label} onClick={() => { setYearFrom(p.yf); setWeekFrom(p.wf); setYearTo(p.yt); setWeekTo(p.wt); }}
                    style={{ padding: "6px 12px", borderRadius: 8, border: `1.5px solid ${isActive ? C.accent : C.inputBorder}`, background: isActive ? C.accent : C.input, color: isActive ? "#fff" : C.textMuted, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {rangeInvalid && (
          <div style={{ marginTop: 12, padding: "8px 14px", borderRadius: 8, background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", color: "#f87171", fontSize: 13 }}>
            ⚠️ La fecha de inicio es posterior a la fecha fin. Ajusta el rango.
          </div>
        )}
      </Card>

      <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 24, paddingLeft: 4 }}>
        {fp.length} reg. empaque · {totalQS} muestreos calidad · {fm.length} reg. merma · {ff.length} muestreos fruta
        <span style={{ marginLeft: 16, color: C.accent }}>{totalCajas.toLocaleString()} cajas · {totalKg.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg</span>
      </div>

      {(noData || rangeInvalid) && !rangeInvalid && <EmptyState message="No hay datos en el período seleccionado." />}

      {!noData && !rangeInvalid && <>
        {/* ─────────────────────────────────────────────────────── */}
        <SectionHeader emoji="📦" title="Producción — Empaque" color={C.accent} />

        {/* Presentaciones por cliente */}
        <Card style={{ marginBottom: 24 }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: C.text }}>Distribución por Cliente y Presentación</h3>
          {clientDataSorted.length === 0 ? <p style={{ color: C.textMuted, fontSize: 13 }}>Sin datos</p> : (
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Presentación</th>
                    <th style={{ textAlign: "right" as const }}>Cajas</th>
                    <th style={{ textAlign: "right" as const }}>Kg</th>
                    <th style={{ textAlign: "right" as const }}>% Cajas</th>
                  </tr>
                </thead>
                <tbody>
                  {clientDataSorted.map(c => (
                    <>
                      {c.pres.map((p, i) => (
                        <tr key={`${c.name}-${p.pres}`}>
                          {i === 0 && (
                            <td rowSpan={c.pres.length + 1} style={{ fontWeight: 700, color: C.text, verticalAlign: "top", paddingTop: 14, borderRight: `1px solid ${C.border}` }}>
                              {c.name}
                            </td>
                          )}
                          <td><span style={{ background: C.accentDim, color: C.accentLight, padding: "3px 8px", borderRadius: 6, fontSize: 12, fontWeight: 700 }}>{p.pres}</span></td>
                          <td style={{ textAlign: "right" as const, fontFamily: "'DM Mono', monospace", fontWeight: 600, color: C.text }}>{p.cajas.toLocaleString()}</td>
                          <td style={{ textAlign: "right" as const, fontFamily: "'DM Mono', monospace", color: "#34d399" }}>{p.kg.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg</td>
                          <td style={{ textAlign: "right" as const, fontFamily: "'DM Mono', monospace", color: C.textMuted, fontSize: 12 }}>{totalCajas > 0 ? Math.round((p.cajas / totalCajas) * 100) : 0}%</td>
                        </tr>
                      ))}
                      {/* Fila subtotal cliente */}
                      <tr style={{ borderTop: `1.5px solid ${C.accent}33` }}>
                        <td colSpan={1} style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase" as const, letterSpacing: 0.4 }}>Subtotal</td>
                        <td style={{ textAlign: "right" as const, fontWeight: 700, fontFamily: "'DM Mono', monospace", color: C.text, fontSize: 14 }}>{c.cajas.toLocaleString()}</td>
                        <td style={{ textAlign: "right" as const, fontWeight: 700, fontFamily: "'DM Mono', monospace", color: "#34d399", fontSize: 14 }}>{c.kg.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg</td>
                        <td style={{ textAlign: "right" as const, fontFamily: "'DM Mono', monospace", fontWeight: 700, color: C.accent, fontSize: 12 }}>{totalCajas > 0 ? Math.round((c.cajas / totalCajas) * 100) : 0}%</td>
                      </tr>
                    </>
                  ))}
                  {/* Total global */}
                  <tr style={{ borderTop: `2px solid ${C.accent}66`, background: C.surface }}>
                    <td colSpan={2} style={{ fontWeight: 700, color: C.text, fontSize: 13 }}>TOTAL GENERAL</td>
                    <td style={{ textAlign: "right" as const, fontWeight: 700, fontFamily: "'DM Mono', monospace", color: C.accent, fontSize: 15 }}>{totalCajas.toLocaleString()}</td>
                    <td style={{ textAlign: "right" as const, fontWeight: 700, fontFamily: "'DM Mono', monospace", color: "#34d399", fontSize: 15 }}>{totalKg.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg</td>
                    <td style={{ textAlign: "right" as const, fontWeight: 700, color: C.textMuted }}>100%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Cajas y Kg por Presentación — dinámico */}
        {cajasPorPres.length > 0 && (
          <Card style={{ marginBottom: 24 }}>
            <h3 style={{ margin: "0 0 18px", fontSize: 15, fontWeight: 700, color: C.text }}>Cajas y Kg por Presentación</h3>
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>Presentación</th>
                    <th style={{ textAlign: "right" as const }}>Cajas</th>
                    <th style={{ textAlign: "right" as const }}>Kg</th>
                    <th style={{ textAlign: "right" as const }}>% Cajas</th>
                    <th style={{ textAlign: "right" as const }}>% Kg</th>
                  </tr>
                </thead>
                <tbody>
                  {cajasPorPres.map((p) => (
                    <tr key={p.code}>
                      <td><span style={{ background: C.accentDim, color: C.accentLight, padding: "3px 10px", borderRadius: 8, fontSize: 12, fontWeight: 700 }}>{p.code}</span></td>
                      <td style={{ textAlign: "right" as const, fontFamily: "'DM Mono', monospace", fontWeight: 600, color: C.text }}>{p.cajas.toLocaleString()}</td>
                      <td style={{ textAlign: "right" as const, fontFamily: "'DM Mono', monospace", color: "#34d399", fontWeight: 600 }}>{p.kg.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg</td>
                      <td style={{ textAlign: "right" as const, fontFamily: "'DM Mono', monospace", color: C.textMuted, fontSize: 12 }}>{totalCajas > 0 ? Math.round((p.cajas / totalCajas) * 100) : 0}%</td>
                      <td style={{ textAlign: "right" as const, fontFamily: "'DM Mono', monospace", color: C.textMuted, fontSize: 12 }}>{totalKg > 0 ? Math.round((p.kg / totalKg) * 100) : 0}%</td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: `2px solid ${C.accent}66`, background: C.surface }}>
                    <td style={{ fontWeight: 700, color: C.text }}>TOTAL</td>
                    <td style={{ textAlign: "right" as const, fontWeight: 700, fontFamily: "'DM Mono', monospace", color: C.accent, fontSize: 15 }}>{totalCajas.toLocaleString()}</td>
                    <td style={{ textAlign: "right" as const, fontWeight: 700, fontFamily: "'DM Mono', monospace", color: "#34d399", fontSize: 15 }}>{totalKg.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg</td>
                    <td style={{ textAlign: "right" as const, fontWeight: 700, color: C.textMuted }}>100%</td>
                    <td style={{ textAlign: "right" as const, fontWeight: 700, color: C.textMuted }}>100%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* ─────────────────────────────────────────────────────── */}
        <SectionHeader emoji="🫐" title="Muestreos de Fruta — % Jumbo" color="#fbbf24" />

        {ff.length === 0
          ? <Card style={{ marginBottom: 24 }}><p style={{ color: C.textMuted, fontSize: 14, margin: 0 }}>Sin muestreos de fruta en el período seleccionado.</p></Card>
          : <>
            {/* Stat cards resumen */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
              <StatCard label="Muestreos Fruta" value={ff.length} color="#fbbf24" />
              <StatCard label="Peso Total Muestreado" value={totalFruitPeso > 0 ? `${(totalFruitPeso / 1000).toFixed(1)} kg` : "—"} color="#60a5fa" />
              <StatCard label="% Jumbo +18mm" value={totalFruitPeso > 0 ? `${totalPctJ18}%` : "—"} color="#fbbf24" sub={`${(totalJumboJ18 / 1000).toFixed(1)} kg / ${(totalFruitPeso / 1000).toFixed(1)} kg`} />
              <StatCard label="% Jumbo +19mm" value={totalFruitPeso > 0 ? `${totalPctJ19}%` : "—"} color="#fb923c" sub={`${(totalJumboJ19 / 1000).toFixed(1)} kg / ${(totalFruitPeso / 1000).toFixed(1)} kg`} />
            </div>

            {/* % Jumbo por semana */}
            {jumboWeeksSorted.length > 0 && (
              <Card style={{ marginBottom: 24 }}>
                <h3 style={{ margin: "0 0 18px", fontSize: 15, fontWeight: 700, color: C.text }}>% Jumbo por Semana</h3>
                <div style={{ overflowX: "auto" }}>
                  <table>
                    <thead>
                      <tr>
                        <th style={{ minWidth: 100 }}>Semana</th>
                        <th style={{ textAlign: "right" as const }}>Peso Total (g)</th>
                        <th style={{ textAlign: "right" as const }}>J+18mm (g)</th>
                        <th style={{ textAlign: "right" as const }}>% J+18mm</th>
                        <th style={{ minWidth: 130 }}></th>
                        <th style={{ textAlign: "right" as const }}>J+19mm (g)</th>
                        <th style={{ textAlign: "right" as const }}>% J+19mm</th>
                        <th style={{ minWidth: 130 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {jumboWeeksSorted.map(([week, data]) => {
                        const [yw, wn] = week.split("-");
                        const pctJ18 = data.pesoTotal > 0 ? Math.round((data.pesoJ18 / data.pesoTotal) * 1000) / 10 : 0;
                        const pctJ19 = data.pesoTotal > 0 ? Math.round((data.pesoJ19 / data.pesoTotal) * 1000) / 10 : 0;
                        return (
                          <tr key={week}>
                            <td style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: C.textMuted }}>
                              <span style={{ fontSize: 10 }}>{yw} </span>Sem. {parseInt(wn)}
                            </td>
                            <td style={{ textAlign: "right" as const, fontFamily: "'DM Mono', monospace", fontSize: 12 }}>{data.pesoTotal.toFixed(0)}g</td>
                            <td style={{ textAlign: "right" as const, fontFamily: "'DM Mono', monospace", color: "#fbbf24" }}>{data.pesoJ18.toFixed(0)}g</td>
                            <td style={{ textAlign: "right" as const, fontFamily: "'DM Mono', monospace", fontWeight: 700, color: "#fbbf24", minWidth: 55 }}>{pctJ18}%</td>
                            <td style={{ minWidth: 130 }}><MiniBar value={pctJ18} max={maxJ18Pct} color="#fbbf24" /></td>
                            <td style={{ textAlign: "right" as const, fontFamily: "'DM Mono', monospace", color: "#fb923c" }}>{data.pesoJ19.toFixed(0)}g</td>
                            <td style={{ textAlign: "right" as const, fontFamily: "'DM Mono', monospace", fontWeight: 700, color: "#fb923c", minWidth: 55 }}>{pctJ19}%</td>
                            <td style={{ minWidth: 130 }}><MiniBar value={pctJ19} max={maxJ19Pct} color="#fb923c" /></td>
                          </tr>
                        );
                      })}
                      <tr style={{ borderTop: `2px solid #fbbf2466`, background: C.surface }}>
                        <td style={{ fontWeight: 700, color: C.text, fontSize: 12 }}>TOTAL PERÍODO</td>
                        <td style={{ textAlign: "right" as const, fontFamily: "'DM Mono', monospace", fontWeight: 700 }}>{totalFruitPeso.toFixed(0)}g</td>
                        <td style={{ textAlign: "right" as const, fontFamily: "'DM Mono', monospace", fontWeight: 700, color: "#fbbf24" }}>{totalJumboJ18.toFixed(0)}g</td>
                        <td style={{ textAlign: "right" as const, fontFamily: "'DM Mono', monospace", fontWeight: 700, color: "#fbbf24", fontSize: 15 }}>{totalPctJ18}%</td>
                        <td></td>
                        <td style={{ textAlign: "right" as const, fontFamily: "'DM Mono', monospace", fontWeight: 700, color: "#fb923c" }}>{totalJumboJ19.toFixed(0)}g</td>
                        <td style={{ textAlign: "right" as const, fontFamily: "'DM Mono', monospace", fontWeight: 700, color: "#fb923c", fontSize: 15 }}>{totalPctJ19}%</td>
                        <td></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {/* % Jumbo por variedad */}
            {jumboVarSorted.length > 0 && (
              <Card style={{ marginBottom: 24 }}>
                <h3 style={{ margin: "0 0 18px", fontSize: 15, fontWeight: 700, color: C.text }}>% Jumbo por Variedad</h3>
                <div style={{ overflowX: "auto" }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Variedad</th>
                        <th style={{ textAlign: "right" as const }}>Muestreos</th>
                        <th style={{ textAlign: "right" as const }}>Peso Total (g)</th>
                        <th style={{ textAlign: "right" as const }}>J+18mm (g)</th>
                        <th style={{ textAlign: "right" as const }}>% J+18mm</th>
                        <th style={{ minWidth: 120 }}></th>
                        <th style={{ textAlign: "right" as const }}>J+19mm (g)</th>
                        <th style={{ textAlign: "right" as const }}>% J+19mm</th>
                        <th style={{ minWidth: 120 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {jumboVarSorted.map(v => (
                        <tr key={v.variedad}>
                          <td style={{ fontWeight: 600, color: C.text }}>{v.variedad}</td>
                          <td style={{ textAlign: "right" as const, fontFamily: "'DM Mono', monospace", color: C.textMuted }}>{v.muestreos}</td>
                          <td style={{ textAlign: "right" as const, fontFamily: "'DM Mono', monospace", fontSize: 12 }}>{v.pesoTotal.toFixed(0)}g</td>
                          <td style={{ textAlign: "right" as const, fontFamily: "'DM Mono', monospace", color: "#fbbf24" }}>{v.pesoJ18.toFixed(0)}g</td>
                          <td style={{ textAlign: "right" as const, fontFamily: "'DM Mono', monospace", fontWeight: 700, color: "#fbbf24" }}>{v.pctJ18}%</td>
                          <td style={{ minWidth: 120 }}><MiniBar value={v.pctJ18} max={Math.max(...jumboVarSorted.map(x => x.pctJ18), 1)} color="#fbbf24" /></td>
                          <td style={{ textAlign: "right" as const, fontFamily: "'DM Mono', monospace", color: "#fb923c" }}>{v.pesoJ19.toFixed(0)}g</td>
                          <td style={{ textAlign: "right" as const, fontFamily: "'DM Mono', monospace", fontWeight: 700, color: "#fb923c" }}>{v.pctJ19}%</td>
                          <td style={{ minWidth: 120 }}><MiniBar value={v.pctJ19} max={Math.max(...jumboVarSorted.map(x => x.pctJ19), 1)} color="#fb923c" /></td>
                        </tr>
                      ))}
                      <tr style={{ borderTop: `2px solid #fbbf2466`, background: C.surface }}>
                        <td style={{ fontWeight: 700, color: C.text, fontSize: 12 }}>TOTAL</td>
                        <td style={{ textAlign: "right" as const, fontFamily: "'DM Mono', monospace", fontWeight: 700 }}>{ff.length}</td>
                        <td style={{ textAlign: "right" as const, fontFamily: "'DM Mono', monospace", fontWeight: 700 }}>{totalFruitPeso.toFixed(0)}g</td>
                        <td style={{ textAlign: "right" as const, fontFamily: "'DM Mono', monospace", fontWeight: 700, color: "#fbbf24" }}>{totalJumboJ18.toFixed(0)}g</td>
                        <td style={{ textAlign: "right" as const, fontFamily: "'DM Mono', monospace", fontWeight: 700, color: "#fbbf24", fontSize: 15 }}>{totalPctJ18}%</td>
                        <td></td>
                        <td style={{ textAlign: "right" as const, fontFamily: "'DM Mono', monospace", fontWeight: 700, color: "#fb923c" }}>{totalJumboJ19.toFixed(0)}g</td>
                        <td style={{ textAlign: "right" as const, fontFamily: "'DM Mono', monospace", fontWeight: 700, color: "#fb923c", fontSize: 15 }}>{totalPctJ19}%</td>
                        <td></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </>
        }

        {/* ─────────────────────────────────────────────────────── */}
        <SectionHeader emoji="📉" title="Merma de Empaque" color={C.merma} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 20, marginBottom: 24 }}>
          <StatCard label="Total Kg Merma" value={totalKgMerma > 0 ? `${totalKgMerma.toFixed(1)} kg` : "—"} color={C.merma} />
          <Card>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase" as const, letterSpacing: 0.6, marginBottom: 12 }}>Top 5 Defectos del Período <span style={{ fontWeight: 400, fontSize: 10 }}>— % sobre peso total del muestreo</span></div>
            {top5Merma.length === 0
              ? <div style={{ fontSize: 20, fontWeight: 700, color: C.textMuted }}>—</div>
              : (
                <div style={{ display: "flex", flexDirection: "column" as const, gap: 10 }}>
                  {top5Merma.map((d, i) => (
                    <div key={d.key} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: C.merma, minWidth: 22, fontFamily: "'DM Mono', monospace" }}>#{i + 1}</span>
                      <span style={{ fontSize: 13, color: C.textSecondary, minWidth: 160 }}>{d.label}</span>
                      <MiniBar value={d.pct} max={maxMermaPct} color={C.merma} />
                      <span style={{ fontSize: 14, fontWeight: 700, color: C.mermaLight, fontFamily: "'DM Mono', monospace", minWidth: 55, textAlign: "right" as const }}>{d.pct}%</span>
                      <span style={{ fontSize: 11, color: C.textMuted, minWidth: 60, textAlign: "right" as const }}>{d.totalG.toFixed(0)}g</span>
                    </div>
                  ))}
                </div>
              )}
          </Card>
        </div>

        {/* Kg Merma por Semana */}
        {mermaWeeksSorted.length > 0 && (
          <Card style={{ marginBottom: 24 }}>
            <h3 style={{ margin: "0 0 18px", fontSize: 15, fontWeight: 700, color: C.text }}>Kg Merma por Semana</h3>
            <div style={{ display: "flex", flexDirection: "column" as const, gap: 10 }}>
              {mermaWeeksSorted.map(([week, kg]) => {
                const [yw, wn] = week.split("-");
                return (
                  <div key={week} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 12, color: C.textMuted, fontFamily: "'DM Mono', monospace", minWidth: 100 }}>
                      <span style={{ fontSize: 10 }}>{yw} </span>Sem. {parseInt(wn)}
                    </span>
                    <MiniBar value={kg} max={maxKgSemana} color={C.merma} />
                    <span style={{ fontSize: 14, fontWeight: 700, color: C.merma, fontFamily: "'DM Mono', monospace", minWidth: 72, textAlign: "right" as const }}>{kg.toFixed(1)} kg</span>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Desglose de defectos en % y gramos */}
        {mermaDefectAll.length > 0 && (
          <Card style={{ marginBottom: 24 }}>
            <h3 style={{ margin: "0 0 18px", fontSize: 15, fontWeight: 700, color: C.text }}>Desglose de Defectos — Merma Empaque <span style={{ fontSize: 12, fontWeight: 400, color: C.textMuted }}>% sobre peso total del muestreo</span></h3>
            <div style={{ display: "flex", flexDirection: "column" as const, gap: 10 }}>
              {mermaDefectAll.map(d => (
                <div key={d.key} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 13, color: C.textSecondary, minWidth: 170 }}>{d.label}</span>
                  <MiniBar value={d.pct} max={maxAllPct} color={C.mermaLight} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.mermaLight, fontFamily: "'DM Mono', monospace", minWidth: 55, textAlign: "right" as const }}>{d.pct}%</span>
                  <span style={{ fontSize: 12, color: C.textMuted, fontFamily: "'DM Mono', monospace", minWidth: 65, textAlign: "right" as const }}>{d.totalG.toFixed(0)}g</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* ─────────────────────────────────────────────────────── */}
        <SectionHeader emoji="🔬" title="Control de Calidad" color="#60a5fa" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
          <StatCard label="Muestreos Calidad" value={totalQS} color="#60a5fa" />
          <StatCard label="% Excelente" value={totalQS > 0 ? `${pctExcelente}%` : "—"} color="#34d399" />
          <StatCard label="% Rechazo" value={totalQS > 0 ? `${pctRechazo}%` : "—"} color="#f87171" />
          <StatCard label="Brix Promedio" value={avgBrix > 0 ? `${avgBrix}°` : "—"} color="#34d399" />
        </div>
        {totalQS > 0 && (
          <Card style={{ marginBottom: 24 }}>
            <h3 style={{ margin: "0 0 18px", fontSize: 15, fontWeight: 700, color: C.text }}>Distribución de Grados de Calidad</h3>
            <div style={{ display: "flex", gap: 12 }}>
              {Object.entries(GRADE_CONFIG).map(([key, cfg]) => (
                <div key={key} style={{ flex: 1, textAlign: "center" as const, padding: 16, borderRadius: 12, background: cfg.bg, border: `1.5px solid ${cfg.border}` }}>
                  <div style={{ fontSize: 30, fontWeight: 700, color: cfg.color, fontFamily: "'DM Mono', monospace" }}>{gradeDist[key]}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: cfg.color, marginTop: 4, textTransform: "uppercase" as const, letterSpacing: 0.5 }}>{cfg.label}</div>
                  <div style={{ fontSize: 12, color: cfg.color, opacity: 0.7, marginTop: 2 }}>{totalQS > 0 ? Math.round((gradeDist[key] / totalQS) * 100) : 0}%</div>
                </div>
              ))}
            </div>
          </Card>
        )}
        {totalQS > 0 && qualityDefectSorted.some(d => d.avg > 0) && (
          <Card style={{ marginBottom: 32 }}>
            <h3 style={{ margin: "0 0 18px", fontSize: 15, fontWeight: 700, color: C.text }}>Promedio de Defectos — Calidad Empaque</h3>
            <div style={{ display: "flex", flexDirection: "column" as const, gap: 10 }}>
              {qualityDefectSorted.map(d => (
                <div key={d.key} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 13, color: C.textSecondary, minWidth: 160 }}>{d.label}</span>
                  <MiniBar value={d.avg} max={maxDefectAvg} color="#60a5fa" />
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.text, fontFamily: "'DM Mono', monospace", minWidth: 50, textAlign: "right" as const }}>{d.avg}%</span>
                  <span style={{ fontSize: 11, color: C.textMuted, minWidth: 70, textAlign: "right" as const }}>lím: {d.group === "merma1" ? "5% grp" : d.group === "merma2" ? "15% grp" : d.limit + "%"}</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </>}
    </div>
  );
}