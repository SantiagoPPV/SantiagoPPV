import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import type {
  FumProgramaEnriquecida,
  ProductoMoray,
  AlertaInventario,
  FumPrograma,
} from './fumigacionTypes';
import { VARIEDADES_CONFIG, METODOS_CONFIG } from './fumigacionTypes';
import NuevaEntradaModal from './modals/NuevaEntradaModal';

interface ProgramaViewProps {
  programa: FumProgramaEnriquecida[];
  productos: ProductoMoray[];
  alertas: AlertaInventario[];
  almacenId: string;
  loading: boolean;
  onCrear: (data: any) => Promise<void>;
  onActualizar: (id: string, data: any) => Promise<void>;
  onEliminar: (id: string) => Promise<void>;
  onEliminarVarios: (ids: string[]) => Promise<void>;
  onActualizarEstatusVarios: (ids: string[], estatus: FumPrograma['estatus']) => Promise<void>;
  onVerDetalle: (row: FumProgramaEnriquecida) => void;
}

type EstatusFilter = 'todos' | 'programada' | 'realizada' | 'pospuesta' | 'cancelada';
type EstatusValue  = FumPrograma['estatus'];

const ESTATUS_OPTIONS: { value: EstatusValue; label: string; color: string }[] = [
  { value: 'realizada',  label: '✓ Realizada',  color: '#818cf8' },
  { value: 'programada', label: '● Programada', color: '#10b981' },
  { value: 'pospuesta',  label: '⟳ Pospuesta',  color: '#f59e0b' },
  { value: 'cancelada',  label: '✕ Cancelada',  color: '#ef4444' },
];

// ── Dropdown genérico ─────────────────────────────────────────────────────────
function FilterDropdown({
  label,
  value,
  options,
  onChange,
  accentColor,
}: {
  label: string;
  value: string;
  options: { value: string; label: string; color?: string }[];
  onChange: (v: string) => void;
  accentColor?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const selected = options.find(o => o.value === value);
  const isActive = value !== '' && value !== 'todos';

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-semibold
          transition-all duration-100 whitespace-nowrap ${
          isActive
            ? 'bg-emerald-900/30 border-emerald-700/50 text-emerald-300'
            : 'bg-[#12131e] border-[#1c1d2e] text-[#7b7f9e] hover:border-[#2e3050]'
        }`}
        style={isActive && accentColor ? { color: accentColor, borderColor: `${accentColor}55`, background: `${accentColor}18` } : {}}
      >
        {isActive && selected?.color && (
          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: selected.color }} />
        )}
        <span>{isActive ? selected?.label ?? label : label}</span>
        <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 10 10" fill="none">
          <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 bg-[#181929] border border-[#252638]
          rounded-xl overflow-hidden shadow-2xl z-50 min-w-[160px]">
          {options.map(opt => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[11px] font-semibold
                hover:bg-[#1c1d2e] transition-colors text-left ${
                value === opt.value ? 'text-emerald-400' : 'text-[#7b7f9e]'
              }`}
              style={value === opt.value && opt.color ? { color: opt.color } : {}}
            >
              {opt.color && (
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: opt.color }} />
              )}
              {opt.label}
              {value === opt.value && <span className="ml-auto text-[10px]">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── MultiDropdown para semana (selección múltiple) ────────────────────────────
function SemanaDropdown({
  semanas,
  selected,
  onChange,
}: {
  semanas: number[];
  selected: Set<number>;
  onChange: (s: Set<number>) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const toggle = (s: number) => {
    const next = new Set(selected);
    next.has(s) ? next.delete(s) : next.add(s);
    onChange(next);
  };

  const label = selected.size === 0
    ? 'Semana'
    : selected.size === 1
      ? `S${[...selected][0]}`
      : `${selected.size} semanas`;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-semibold
          transition-all duration-100 whitespace-nowrap ${
          selected.size > 0
            ? 'bg-emerald-900/30 border-emerald-700/50 text-emerald-300'
            : 'bg-[#12131e] border-[#1c1d2e] text-[#7b7f9e] hover:border-[#2e3050]'
        }`}
      >
        📅 {label}
        <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 10 10" fill="none">
          <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 bg-[#181929] border border-[#252638]
          rounded-xl overflow-hidden shadow-2xl z-50 min-w-[140px]">
          {/* Opción limpiar */}
          {selected.size > 0 && (
            <button
              onClick={() => onChange(new Set())}
              className="w-full px-3.5 py-2 text-[11px] text-[#3e4262] hover:text-[#7b7f9e]
                hover:bg-[#1c1d2e] transition-colors text-left border-b border-[#1c1d2e]">
              Limpiar filtro
            </button>
          )}
          <div className="flex flex-wrap gap-1 p-2">
            {semanas.map(s => (
              <button
                key={s}
                onClick={() => toggle(s)}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${
                  selected.has(s)
                    ? 'bg-emerald-900/40 border-emerald-600/50 text-emerald-400'
                    : 'bg-[#0e0f1a] border-[#252638] text-[#7b7f9e] hover:border-[#2e3050]'
                }`}>
                S{s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── VariedadDropdown (selección única) ────────────────────────────────────────
function VariedadDropdown({
  variedades,
  selected,
  onChange,
}: {
  variedades: string[];
  selected: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const cfg = selected ? VARIEDADES_CONFIG[selected as keyof typeof VARIEDADES_CONFIG] : null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-semibold
          transition-all duration-100 whitespace-nowrap"
        style={selected && cfg ? {
          background: `${cfg.color}18`,
          borderColor: `${cfg.color}55`,
          color: cfg.color,
        } : {
          background: '#12131e',
          borderColor: '#1c1d2e',
          color: '#7b7f9e',
        }}
      >
        {selected && cfg && (
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cfg.color }} />
        )}
        {selected || 'Variedad'}
        <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 10 10" fill="none">
          <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 bg-[#181929] border border-[#252638]
          rounded-xl overflow-hidden shadow-2xl z-50 min-w-[180px]">
          {selected && (
            <button
              onClick={() => { onChange(''); setOpen(false); }}
              className="w-full px-3.5 py-2 text-[11px] text-[#3e4262] hover:text-[#7b7f9e]
                hover:bg-[#1c1d2e] transition-colors text-left border-b border-[#1c1d2e]">
              Todas las variedades
            </button>
          )}
          {variedades.map(v => {
            const c = VARIEDADES_CONFIG[v as keyof typeof VARIEDADES_CONFIG];
            return (
              <button
                key={v}
                onClick={() => { onChange(v === selected ? '' : v); setOpen(false); }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[11px] font-semibold
                  hover:bg-[#1c1d2e] transition-colors text-left"
                style={{ color: c?.color ?? '#7b7f9e' }}
              >
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c?.color ?? '#7b7f9e' }} />
                {v}
                {selected === v && <span className="ml-auto text-[10px]">✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── EstatusBadge ──────────────────────────────────────────────────────────────
function EstatusBadge({ estatus }: { estatus: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    programada: { bg: 'rgba(16,185,129,.12)',  color: '#10b981', label: '● prog'     },
    realizada:  { bg: 'rgba(99,102,241,.12)',  color: '#818cf8', label: '✓ real'     },
    pospuesta:  { bg: 'rgba(245,158,11,.12)',  color: '#f59e0b', label: '⟳ pospuesta'},
    cancelada:  { bg: 'rgba(239,68,68,.12)',   color: '#ef4444', label: '✕ canc'     },
  };
  const cfg = map[estatus] ?? map.programada;
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold
      font-mono uppercase tracking-wide" style={{ background: cfg.bg, color: cfg.color }}>
      {cfg.label}
    </span>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ProgramaView
// ══════════════════════════════════════════════════════════════════════════════
export default function ProgramaView({
  programa, productos, alertas, almacenId, loading,
  onCrear, onActualizar, onEliminar, onEliminarVarios,
  onActualizarEstatusVarios, onVerDetalle,
}: ProgramaViewProps) {
  const [filterSemanas,    setFilterSemanas]    = useState<Set<number>>(new Set());
  const [filterVariedad,   setFilterVariedad]   = useState('');
  const [filterEstatus,    setFilterEstatus]    = useState<EstatusFilter>('todos');
  const [showNueva,        setShowNueva]        = useState(false);
  const [seleccionando,    setSeleccionando]    = useState(false);
  const [seleccionados,    setSeleccionados]    = useState<Set<string>>(new Set());
  const [showEstatusMenu,  setShowEstatusMenu]  = useState(false);
  const [bulkLoading,      setBulkLoading]      = useState(false);
  const estatusMenuRef = useRef<HTMLDivElement>(null);

  // Close bulk status menu on outside click
  useEffect(() => {
    if (!showEstatusMenu) return;
    const handler = (e: MouseEvent) => {
      if (estatusMenuRef.current && !estatusMenuRef.current.contains(e.target as Node))
        setShowEstatusMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showEstatusMenu]);

  const semanasDisponibles = useMemo(() =>
    [...new Set(programa.map(p => p.semana))].sort((a, b) => a - b), [programa]);

  const variedadesDisponibles = useMemo(() =>
    [...new Set(programa.map(p => p.variedad))], [programa]);

  const programaFiltrado = useMemo(() => programa.filter(p => {
    if (filterSemanas.size > 0 && !filterSemanas.has(p.semana))  return false;
    if (filterVariedad && p.variedad !== filterVariedad)          return false;
    if (filterEstatus !== 'todos' && p.estatus !== filterEstatus) return false;
    return true;
  }), [programa, filterSemanas, filterVariedad, filterEstatus]);

  const costoTotal = useMemo(() =>
    programaFiltrado.reduce((s, p) => s + p.costo_estimado, 0), [programaFiltrado]);

  // Selección múltiple
  const toggleSeleccion = useCallback((id: string) =>
    setSeleccionados(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    }), []);

  const seleccionarTodos = () => {
    if (seleccionados.size === programaFiltrado.length)
      setSeleccionados(new Set());
    else
      setSeleccionados(new Set(programaFiltrado.map(r => r.id)));
  };

  const salirSeleccion = () => {
    setSeleccionando(false);
    setSeleccionados(new Set());
  };

  const handleEliminarSeleccionados = async () => {
    if (!confirm(`¿Eliminar ${seleccionados.size} entrada${seleccionados.size > 1 ? 's' : ''}?`)) return;
    setBulkLoading(true);
    try { await onEliminarVarios([...seleccionados]); salirSeleccion(); }
    finally { setBulkLoading(false); }
  };

  const handleCambiarEstatus = async (estatus: EstatusValue) => {
    setBulkLoading(true); setShowEstatusMenu(false);
    try { await onActualizarEstatusVarios([...seleccionados], estatus); salirSeleccion(); }
    finally { setBulkLoading(false); }
  };

  const todosSeleccionados  = seleccionados.size === programaFiltrado.length && programaFiltrado.length > 0;
  const algunosSeleccionados = seleccionados.size > 0 && !todosSeleccionados;

  const ESTATUS_FILTER_OPTIONS = [
    { value: 'todos',      label: 'Todos' },
    { value: 'programada', label: '● Programada', color: '#10b981' },
    { value: 'realizada',  label: '✓ Realizada',  color: '#818cf8' },
    { value: 'pospuesta',  label: '⟳ Pospuesta',  color: '#f59e0b' },
    { value: 'cancelada',  label: '✕ Cancelada',  color: '#ef4444' },
  ];

  return (
    <div className="flex flex-col flex-1 overflow-hidden">

      {/* ── Alertas ──────────────────────────────────────────────── */}
      {alertas.length > 0 && (
        <div className="flex items-start gap-3 px-4 py-3 bg-red-950/30 border-b border-red-800/30 flex-shrink-0">
          <span className="text-base mt-0.5">🚨</span>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold text-red-400 uppercase tracking-wider mb-1.5">
              Inventario insuficiente — próximos 3 días
            </div>
            <div className="flex flex-wrap gap-2">
              {alertas.map(a => (
                <span key={a.producto_nombre}
                  className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-mono font-semibold
                    bg-red-900/40 border border-red-700/40 text-red-300">
                  {a.producto_nombre} · faltan {a.deficit.toFixed(2)} {a.unidad}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Toolbar COMPACTO (una sola línea) ─────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-2 bg-[#0e0f1a] border-b border-[#1c1d2e]
        flex-shrink-0 flex-wrap">

        {/* Dropdowns de filtro */}
        <SemanaDropdown
          semanas={semanasDisponibles}
          selected={filterSemanas}
          onChange={setFilterSemanas}
        />

        <VariedadDropdown
          variedades={variedadesDisponibles}
          selected={filterVariedad}
          onChange={setFilterVariedad}
        />

        <FilterDropdown
          label="Estatus"
          value={filterEstatus}
          options={ESTATUS_FILTER_OPTIONS}
          onChange={v => setFilterEstatus(v as EstatusFilter)}
        />

        {/* Separador */}
        <div className="w-px h-4 bg-[#1c1d2e] mx-1" />

        {/* Costo */}
        <span className="text-xs font-mono text-emerald-400 font-semibold">
          ${costoTotal.toFixed(2)}
        </span>

        {/* Botones de acción al final */}
        <div className="ml-auto flex items-center gap-2">
          {seleccionando ? (
            <button onClick={salirSeleccion}
              className="px-3 py-1.5 rounded-lg border border-[#252638] text-[#7b7f9e]
                text-xs font-semibold hover:bg-[#181929] transition-colors">
              Cancelar
            </button>
          ) : (
            <button onClick={() => setSeleccionando(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#252638]
                text-xs font-semibold text-[#7b7f9e] hover:text-[#eceef5] hover:border-[#2e3050] transition-all">
              ☑ Seleccionar
            </button>
          )}

          <button onClick={() => setShowNueva(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400
              text-black text-xs font-bold transition-all duration-150">
            ＋ Nueva entrada
          </button>
        </div>
      </div>

      {/* ── Barra bulk ───────────────────────────────────────────── */}
      {seleccionando && seleccionados.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2 bg-indigo-950/40 border-b border-indigo-800/30
          flex-shrink-0 animate-in slide-in-from-top duration-150">
          <span className="text-xs font-bold text-indigo-300">
            {seleccionados.size} seleccionada{seleccionados.size > 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-2 ml-auto">
            {/* Cambiar estatus */}
            <div className="relative" ref={estatusMenuRef}>
              <button
                onClick={() => setShowEstatusMenu(v => !v)}
                disabled={bulkLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/20 border border-indigo-500/30
                  text-xs font-bold text-indigo-300 hover:bg-indigo-500/30 disabled:opacity-50 transition-all">
                🔄 Cambiar estatus
                <svg className="w-3 h-3" viewBox="0 0 10 10" fill="none">
                  <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
              {showEstatusMenu && (
                <div className="absolute right-0 top-full mt-1 bg-[#181929] border border-[#252638]
                  rounded-xl overflow-hidden shadow-2xl z-50 min-w-[180px]">
                  {ESTATUS_OPTIONS.map(opt => (
                    <button key={opt.value} onClick={() => handleCambiarEstatus(opt.value)}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold
                        hover:bg-[#1c1d2e] transition-colors text-left"
                      style={{ color: opt.color }}>
                      <span className="w-2 h-2 rounded-full" style={{ background: opt.color }} />
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* Eliminar */}
            <button onClick={handleEliminarSeleccionados} disabled={bulkLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/15 border border-red-500/30
                text-xs font-bold text-red-400 hover:bg-red-500/25 disabled:opacity-50 transition-all">
              {bulkLoading
                ? <span className="w-3.5 h-3.5 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin"/>
                : '🗑'}
              Eliminar {seleccionados.size}
            </button>
          </div>
        </div>
      )}

      {/* ── Tabla ────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-[#7b7f9e] text-sm gap-2">
            <span className="w-4 h-4 border-2 border-[#3e4262] border-t-emerald-500 rounded-full animate-spin"/>
            Cargando programa…
          </div>
        ) : programaFiltrado.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-60 text-[#3e4262]">
            <div className="text-5xl mb-4">📅</div>
            <div className="text-sm font-semibold text-[#7b7f9e]">Sin entradas en el programa</div>
            <div className="text-xs mt-2">Importa desde Google Sheets o crea una nueva entrada</div>
          </div>
        ) : (
          <table className="w-full border-collapse" style={{ minWidth: '1140px' }}>
            <thead>
              <tr>
                {seleccionando && (
                  <th className="text-left px-3 py-2.5 text-[10px] font-bold
                    text-[#3e4262] uppercase tracking-wider bg-[#0e0f1a] border-b-2 border-[#1c1d2e] w-10">
                    {/* Checkbox cabecera */}
                    <button onClick={seleccionarTodos}
                      className={`w-4 h-4 rounded border flex items-center justify-center text-[9px] font-bold
                        transition-all ${todosSeleccionados || algunosSeleccionados
                          ? 'bg-indigo-500 border-indigo-400 text-white'
                          : 'border-[#3e4262] hover:border-indigo-500'}`}>
                      {todosSeleccionados ? '✓' : algunosSeleccionados ? '—' : ''}
                    </button>
                  </th>
                )}
                {['Semana','Fecha','Variedad','Producto','Dosis/200L','Total','Inventario',
                  'Necesidad','Método','Tambos','Objetivo','Estatus','Costo Est.'].map(col => (
                  <th key={col}
                    className="text-left px-3 py-2.5 text-[10px] font-bold
                      text-[#3e4262] uppercase tracking-wider bg-[#0e0f1a]
                      border-b-2 border-[#1c1d2e] whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {programaFiltrado.map((row, i) => {
                const vCfg     = VARIEDADES_CONFIG[row.variedad as keyof typeof VARIEDADES_CONFIG];
                const mColor   = METODOS_CONFIG[row.metodo as keyof typeof METODOS_CONFIG]?.color ?? '#374151';
                const prevRow  = programaFiltrado[i - 1];
                const isNewGroup = !prevRow || prevRow.semana !== row.semana;
                const isSelected = seleccionados.has(row.id);

                const invColor = !row.inventario_vinculado
                  ? 'text-[#3e4262]'
                  : row.stock_inventario <= 0
                    ? 'text-red-400'
                    : row.stock_inventario < row.total_producto
                      ? 'text-amber-400'
                      : 'text-emerald-400';

                const necColor = row.necesidad <= 0
                  ? 'text-emerald-400'
                  : row.necesidad > row.total_producto * 0.5
                    ? 'text-red-400 font-bold'
                    : 'text-amber-400';

                return (
                  <tr key={row.id}
                    onClick={() => seleccionando ? toggleSeleccion(row.id) : onVerDetalle(row)}
                    className={`cursor-pointer transition-colors duration-75
                      ${isNewGroup && i > 0 ? 'border-t-2 border-[#1c1d2e]' : ''}
                      ${isSelected ? 'bg-indigo-900/20 hover:bg-indigo-900/30' : 'hover:bg-white/[0.022]'}`}>

                    {seleccionando && (
                      <td className="px-3 py-2.5 border-b border-[#1c1d2e]"
                        onClick={e => { e.stopPropagation(); toggleSeleccion(row.id); }}>
                        <div className={`w-4 h-4 rounded border flex items-center justify-center text-[9px] font-bold
                          transition-all ${isSelected
                            ? 'bg-indigo-500 border-indigo-400 text-white'
                            : 'border-[#3e4262] hover:border-indigo-500'}`}>
                          {isSelected ? '✓' : ''}
                        </div>
                      </td>
                    )}

                    <td className="px-3 py-2.5 border-b border-[#1c1d2e]">
                      <span className="font-mono text-[10px] font-semibold text-[#3e4262] bg-[#181929] px-2 py-1 rounded">
                        S{row.semana}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 border-b border-[#1c1d2e] font-mono text-[11px] text-[#7b7f9e] whitespace-nowrap">
                      {new Date(row.fecha + 'T12:00:00').toLocaleDateString('es-MX', {
                        day: 'numeric', month: 'short', year: '2-digit'
                      })}
                    </td>
                    <td className="px-3 py-2.5 border-b border-[#1c1d2e]">
                      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-bold text-white"
                        style={{ background: vCfg?.color ?? '#374151' }}>
                        <span className="w-1.5 h-1.5 rounded-full bg-white/50"/>
                        {row.variedad}
                      </span>
                      {row.sectores.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {row.sectores.slice(0, 5).map(s => (
                            <span key={s} className="text-[9px] font-mono font-bold px-1 py-px rounded border"
                              style={{
                                background: `${vCfg?.color ?? '#374151'}22`,
                                color: vCfg?.color ?? '#374151',
                                borderColor: `${vCfg?.color ?? '#374151'}44`,
                              }}>
                              {s}
                            </span>
                          ))}
                          {row.sectores.length > 5 && (
                            <span className="text-[9px] text-[#3e4262]">+{row.sectores.length - 5}</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 border-b border-[#1c1d2e]">
                      <span className="text-xs font-semibold text-[#eceef5]">{row.producto_nombre}</span>
                      <span className="ml-1.5 text-[9px] font-bold font-mono text-[#3e4262] bg-[#181929] px-1.5 py-px rounded uppercase">
                        {row.categoria_producto}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 border-b border-[#1c1d2e] font-mono text-xs text-[#eceef5]">
                      {row.dosis_200l}
                    </td>
                    <td className="px-3 py-2.5 border-b border-[#1c1d2e] font-mono text-xs font-medium text-[#eceef5]">
                      {row.total_producto.toFixed(3)} {row.unidad_producto}
                    </td>
                    <td className={`px-3 py-2.5 border-b border-[#1c1d2e] font-mono text-xs font-medium ${invColor}`}>
                      {!row.inventario_vinculado ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border
                          bg-[#181929] border-[#252638] text-[#3e4262] text-[9px] font-bold uppercase tracking-wide"
                          title="Producto no registrado en inventario">
                          N/A <span className="text-[8px]">⚠</span>
                        </span>
                      ) : row.stock_inventario > 0 ? row.stock_inventario.toFixed(2) : '0'}
                    </td>
                    <td className="px-3 py-2.5 border-b border-[#1c1d2e]">
                      <span className={`font-mono text-xs font-medium ${necColor}`}>
                        {!row.inventario_vinculado ? '—' : row.necesidad <= 0 ? '✓ ok' : row.necesidad.toFixed(3)}
                      </span>
                      {row.inventario_vinculado && row.necesidad > 0 && (
                        <div className="w-12 h-1 mt-1 rounded-full bg-[#1c1d2e] overflow-hidden">
                          <div className="h-full rounded-full" style={{
                            width: `${Math.min(100, (row.necesidad / row.total_producto) * 100)}%`,
                            background: row.necesidad > row.total_producto * 0.5 ? '#ef4444' : '#f59e0b',
                          }}/>
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 border-b border-[#1c1d2e]">
                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold font-mono text-white uppercase"
                        style={{ background: mColor }}>
                        {row.metodo.slice(0, 12)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 border-b border-[#1c1d2e] font-mono text-xs text-[#eceef5]">
                      {row.tambos}
                    </td>
                    <td className="px-3 py-2.5 border-b border-[#1c1d2e] text-[11px] text-[#7b7f9e] max-w-[130px] truncate">
                      {row.objetivo ?? '—'}
                    </td>
                    <td className="px-3 py-2.5 border-b border-[#1c1d2e]">
                      <EstatusBadge estatus={row.estatus}/>
                    </td>
                    <td className="px-3 py-2.5 border-b border-[#1c1d2e] font-mono text-xs font-semibold text-emerald-400">
                      ${row.costo_estimado.toFixed(2)}
                    </td>
                  </tr>
                );
              })}
              {/* Fila de totales */}
              <tr className="bg-[#0e0f1a]">
                <td colSpan={seleccionando ? 14 : 13}
                  className="px-3 py-2.5 text-[11px] font-bold text-[#7b7f9e] text-right">
                  TOTAL ESTIMADO ({programaFiltrado.length} entradas):
                </td>
                <td className="px-3 py-2.5 font-mono text-sm font-bold text-emerald-400">
                  ${costoTotal.toFixed(2)}
                </td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      {/* ── Modal nueva entrada ───────────────────────────────────── */}
      {showNueva && (
        <NuevaEntradaModal
          almacenId={almacenId}
          productos={productos}
          onClose={() => setShowNueva(false)}
          onSave={async (data) => { await onCrear(data); setShowNueva(false); }}
        />
      )}
    </div>
  );
}