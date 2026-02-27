import React, { useState, useEffect, useRef } from 'react';
import { getISOWeek } from 'date-fns';
import type { ProductoMoray } from '../fumigacionTypes';
import {
  VARIEDADES_CONFIG,
  METODOS_CONFIG,
  OBJETIVOS,
  TODOS_SECTORES,
} from '../fumigacionTypes';
import { supabase } from '../../../lib/supabaseClient';
import { useAuthStore } from '../../../store/useAuthStore';

interface NuevaEntradaModalProps {
  almacenId: string;
  productos: ProductoMoray[];
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  initialData?: any;
}

export default function NuevaEntradaModal({
  almacenId,
  productos,
  onClose,
  onSave,
  initialData,
}: NuevaEntradaModalProps) {
  const isEditing = !!initialData;
  const { user } = useAuthStore();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Form state ──────────────────────────────────────────────────────
  const [fecha,       setFecha]       = useState(initialData?.fecha ?? new Date().toISOString().split('T')[0]);
  const [variedad,    setVariedad]    = useState<string>(initialData?.variedad ?? '');
  const [sectores,    setSectores]    = useState<Set<string>>(new Set(initialData?.sectores ?? []));
  const [productoNombre, setProductoNombre] = useState(initialData?.producto_nombre ?? '');
  const [busquedaProd,   setBusquedaProd]   = useState('');
  const [showProdDropdown, setShowProdDropdown] = useState(false);
  const [dosis,       setDosis]       = useState<string>(initialData?.dosis_200l?.toString() ?? '');
  const [tambos,      setTambos]      = useState<string>(initialData?.tambos?.toString() ?? '');
  const [metodo,      setMetodo]      = useState(initialData?.metodo ?? '');
  const [objetivo,    setObjetivo]    = useState(initialData?.objetivo ?? '');
  const [notas,       setNotas]       = useState(initialData?.notas ?? '');
  const [responsableId, setResponsableId] = useState<number | null>(initialData?.responsable_id ?? null);
  // Edición: permitir cambiar estatus directamente
  const [estatus, setEstatus] = useState<string>(initialData?.estatus ?? 'programada');
  const [supervisores, setSupervisores] = useState<{ID: number; name: string}[]>([]);
  const [stockProducto, setStockProducto] = useState<number>(0);

  // Ref para detectar clic fuera del dropdown de productos
  const dropdownRef = useRef<HTMLDivElement>(null);

  const prodSeleccionado = productos.find(p => p.Nombre === productoNombre);
  const semana = fecha ? getISOWeek(new Date(fecha + 'T12:00:00')) : 0;
  const dosisNum   = parseFloat(dosis)  || 0;
  const tambosNum  = parseInt(tambos)   || 0;
  const totalProducto  = (dosisNum * tambosNum) / 1000;
  const necesidad      = Math.max(0, totalProducto - stockProducto);
  const costoEstimado  = totalProducto * (prodSeleccionado?.costo_unitario ?? 0);

  useEffect(() => {
    supabase
      .from('Users')
      .select('"ID", name')
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => {
        if (data) setSupervisores(data.map((u: any) => ({ ID: u.ID, name: u.name })));
      });
  }, []);

  useEffect(() => {
    if (!productoNombre || !almacenId) return;
    supabase
      .from('inventario_items')
      .select('stock_actual')
      .eq('almacen_id', almacenId)
      .ilike('nombre', productoNombre)
      .maybeSingle()
      .then(({ data }) => setStockProducto(data?.stock_actual ?? 0));
  }, [productoNombre, almacenId]);

  // ── Click fuera del dropdown → cerrarlo ─────────────────────────────
  useEffect(() => {
    if (!showProdDropdown) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowProdDropdown(false);
        setBusquedaProd('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showProdDropdown]);

  // ── Selección de variedad ────────────────────────────────────────────
  const selectVariedad = (v: string) => {
    setVariedad(v);
    const cfg = VARIEDADES_CONFIG[v as keyof typeof VARIEDADES_CONFIG];
    if (cfg && cfg.sectores.length > 0) {
      setSectores(new Set(cfg.sectores));
    } else {
      setSectores(new Set());
    }
  };

  const toggleSector = (s: string) =>
    setSectores(prev => {
      const next = new Set(prev);
      next.has(s) ? next.delete(s) : next.add(s);
      return next;
    });

  // ── Guardar ──────────────────────────────────────────────────────────
  const handleSave = async () => {
    setError(null);
    if (!fecha)             { setError('Selecciona una fecha');               return; }
    if (!variedad)          { setError('Selecciona una variedad');            return; }
    if (!productoNombre)    { setError('Selecciona un producto');             return; }
    if (!dosis || dosisNum <= 0)   { setError('Ingresa la dosis por 200L');  return; }
    if (!tambos || tambosNum <= 0) { setError('Ingresa el número de tambos'); return; }
    if (!metodo)            { setError('Selecciona el método de aplicación'); return; }

    setSaving(true);
    try {
      // ── BUG FIX: en edición preservar campos críticos del registro original
      const payload: Record<string, any> = {
        almacen_id: almacenId,
        semana,
        fecha,
        variedad,
        sectores: [...sectores],
        producto_nombre: productoNombre,
        dosis_200l: dosisNum,
        tambos: tambosNum,
        metodo,
        objetivo: objetivo || null,
        estatus,                        // editable (no hardcodeado a 'programada')
        responsable_id: responsableId || null,
        notas: notas || null,
      };

      if (isEditing) {
        // Preservar campos de sync y auditoría del registro original
        payload.sheets_sync_id   = initialData.sheets_sync_id   ?? null;
        payload.sheets_range     = initialData.sheets_range     ?? null;
        payload.sheets_synced_at = initialData.sheets_synced_at ?? null;
        payload.created_by       = initialData.created_by       ?? null;
      } else {
        // Solo en creación: asignar created_by (solo si el ID es numérico válido)
        const userId = user?.id ? parseInt(user.id) : null;
        payload.created_by       = userId && !isNaN(userId) ? userId : null;
        payload.sheets_sync_id   = null;
        payload.sheets_range     = null;
        payload.sheets_synced_at = null;
      }

      await onSave(payload);
    } catch (err: any) {
      setError(err.message || 'Error al guardar');
      setSaving(false);
    }
  };

  const prodsFiltrados = productos.filter(p =>
    p.activo && p.Nombre.toLowerCase().includes(busquedaProd.toLowerCase())
  );

  return (
    <>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40" onClick={onClose} />

      <div className="fixed right-0 top-0 bottom-0 w-[500px] max-w-full bg-[#12131e]
        border-l border-[#252638] z-50 flex flex-col overflow-hidden
        animate-in slide-in-from-right duration-200">

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-[#1c1d2e] flex-shrink-0">
          <div>
            <h2 className="font-syne text-lg font-extrabold text-[#eceef5]">
              {isEditing ? 'Editar entrada' : 'Nueva entrada — Programa'}
            </h2>
            <p className="text-xs text-[#7b7f9e] mt-1">Una fila = un producto en una fecha/variedad</p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#252638]
              text-[#7b7f9e] hover:text-[#eceef5] hover:bg-[#181929] transition-colors text-sm">
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* ── Fecha y Semana ── */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-[#7b7f9e] uppercase tracking-wider mb-2">
                Fecha
              </label>
              <input
                type="date"
                value={fecha}
                onChange={e => setFecha(e.target.value)}
                className="w-full px-3 py-2.5 bg-[#0e0f1a] border border-[#252638] rounded-lg
                  text-[#eceef5] text-sm outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#7b7f9e] uppercase tracking-wider mb-2">
                Semana ISO
              </label>
              <div className="w-full px-3 py-2.5 bg-emerald-900/20 border border-emerald-800/40 rounded-lg
                font-mono text-sm font-bold text-emerald-400">
                Semana {semana || '—'} · {fecha ? new Date(fecha + 'T12:00:00').getFullYear() : ''}
              </div>
            </div>
          </div>

          {/* ── Estatus (solo edición) ── */}
          {isEditing && (
            <div>
              <label className="block text-[11px] font-bold text-[#7b7f9e] uppercase tracking-wider mb-2">
                Estatus
              </label>
              <div className="flex gap-2">
                {(['programada','realizada','pospuesta','cancelada'] as const).map(e => {
                  const colors: Record<string, { active: string; text: string }> = {
                    programada: { active: 'bg-emerald-900/40 border-emerald-600/50', text: 'text-emerald-400' },
                    realizada:  { active: 'bg-indigo-900/40 border-indigo-600/50',   text: 'text-indigo-400' },
                    pospuesta:  { active: 'bg-amber-900/40 border-amber-600/50',     text: 'text-amber-400' },
                    cancelada:  { active: 'bg-red-900/40 border-red-600/50',         text: 'text-red-400' },
                  };
                  const c = colors[e];
                  const active = estatus === e;
                  return (
                    <button key={e} onClick={() => setEstatus(e)}
                      className={`flex-1 py-2 rounded-lg border text-[11px] font-bold uppercase tracking-wide transition-all ${
                        active
                          ? `${c.active} ${c.text}`
                          : 'bg-[#0e0f1a] border-[#252638] text-[#3e4262] hover:border-[#2e3050]'
                      }`}>
                      {e}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Variedad ── */}
          <div>
            <label className="block text-[11px] font-bold text-[#7b7f9e] uppercase tracking-wider mb-2">
              Variedad
            </label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(VARIEDADES_CONFIG).map(([v, cfg]) => (
                <button key={v} onClick={() => selectVariedad(v)}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-bold text-white
                    border-2 transition-all duration-100"
                  style={{
                    background:  cfg.color,
                    borderColor: variedad === v ? 'rgba(255,255,255,0.4)' : 'transparent',
                    opacity:     variedad === v ? 1 : 0.55,
                    boxShadow:   variedad === v ? `0 0 0 3px ${cfg.color}33` : 'none',
                  }}>
                  <span className="w-2 h-2 rounded-full bg-white/60 flex-shrink-0"/>
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* ── Sectores ── */}
          <div>
            <label className="block text-[11px] font-bold text-[#7b7f9e] uppercase tracking-wider mb-1">
              Sectores{' '}
              <span className="normal-case text-[#3e4262] font-normal tracking-normal">
                (auto desde variedad · ajustables)
              </span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {TODOS_SECTORES.map(s => {
                const sel  = sectores.has(s);
                const vCfg = variedad ? VARIEDADES_CONFIG[variedad as keyof typeof VARIEDADES_CONFIG] : null;
                return (
                  <button key={s} onClick={() => toggleSector(s)}
                    className="px-2 py-1 rounded text-[11px] font-mono font-bold border-[1.5px] transition-all"
                    style={{
                      background:  sel ? vCfg?.color ?? '#10b981' : '#0e0f1a',
                      borderColor: sel ? 'transparent' : '#252638',
                      color:       sel ? '#fff' : '#7b7f9e',
                    }}>
                    {s}
                  </button>
                );
              })}
            </div>
            {sectores.size > 0 && (
              <p className="text-[10px] text-[#7b7f9e] mt-1.5">{sectores.size} sectores seleccionados</p>
            )}
          </div>

          {/* ── Producto ── */}
          <div className="relative" ref={dropdownRef}>
            <label className="block text-[11px] font-bold text-[#7b7f9e] uppercase tracking-wider mb-2">
              Producto
            </label>
            <div
              className="flex items-center gap-2 px-3 py-2.5 bg-[#0e0f1a] border border-[#252638]
                rounded-lg cursor-pointer hover:border-[#2e3050] transition-colors"
              onClick={() => setShowProdDropdown(true)}>
              <span className="text-sm text-[#3e4262]">🔍</span>
              <span className={`flex-1 text-sm ${productoNombre ? 'text-[#eceef5] font-medium' : 'text-[#3e4262]'}`}>
                {productoNombre || 'Buscar producto...'}
              </span>
              {prodSeleccionado && (
                <span className="text-[9px] font-bold font-mono text-[#3e4262] bg-[#181929] px-1.5 py-0.5 rounded">
                  {prodSeleccionado.categoria}
                </span>
              )}
              {productoNombre && (
                <button
                  onClick={e => { e.stopPropagation(); setProductoNombre(''); setDosis(''); }}
                  className="text-[#3e4262] hover:text-[#7b7f9e] text-xs ml-1">
                  ✕
                </button>
              )}
            </div>

            {/* Dropdown */}
            {showProdDropdown && (
              <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-[#181929] border border-[#252638]
                rounded-lg shadow-2xl overflow-hidden max-h-64 flex flex-col">
                <div className="p-2 border-b border-[#1c1d2e]">
                  <input
                    autoFocus
                    type="text"
                    value={busquedaProd}
                    onChange={e => setBusquedaProd(e.target.value)}
                    placeholder="Buscar..."
                    className="w-full bg-[#0e0f1a] border border-[#252638] rounded px-3 py-1.5
                      text-sm text-[#eceef5] outline-none focus:border-emerald-500"
                    onKeyDown={e => {
                      if (e.key === 'Escape') { setShowProdDropdown(false); setBusquedaProd(''); }
                    }}
                  />
                </div>
                <div className="overflow-y-auto">
                  {prodsFiltrados.map(p => (
                    <div key={p.id}
                      className="flex items-center justify-between px-3 py-2.5 hover:bg-[#1c1d2e]
                        cursor-pointer border-b border-[#1c1d2e]/50 last:border-none"
                      onMouseDown={e => e.preventDefault()} // evitar que el blur se active antes del click
                      onClick={() => {
                        setProductoNombre(p.Nombre);
                        setDosis(p.dosis_ref_200l?.toString() ?? '');
                        setBusquedaProd('');
                        setShowProdDropdown(false);
                      }}>
                      <div>
                        <div className="text-sm font-medium text-[#eceef5]">{p.Nombre}</div>
                        <div className="text-[10px] text-[#3e4262] mt-0.5 font-mono">
                          {p.categoria} · ref: {p.dosis_ref_200l ?? '—'} {p.unidad}/200L
                        </div>
                      </div>
                      <div className="text-xs font-mono font-semibold text-emerald-400">
                        ${p.costo_unitario}/{p.unidad}
                      </div>
                    </div>
                  ))}
                  {prodsFiltrados.length === 0 && (
                    <div className="text-center py-6 text-[#3e4262] text-sm">Sin resultados</div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── Dosis y Tambos ── */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-[#7b7f9e] uppercase tracking-wider mb-2">
                Dosis por 200 L
                {prodSeleccionado && (
                  <span className="ml-1 text-[#3e4262] font-normal normal-case tracking-normal">
                    ({prodSeleccionado.unidad})
                  </span>
                )}
              </label>
              <input
                type="number" step="0.01" value={dosis}
                onChange={e => setDosis(e.target.value)}
                placeholder="ej: 0.5"
                className="w-full px-3 py-2.5 bg-[#0e0f1a] border border-[#252638] rounded-lg
                  text-[#eceef5] text-sm font-mono outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#7b7f9e] uppercase tracking-wider mb-2">
                Tambos (200 L c/u)
              </label>
              <input
                type="number" value={tambos}
                onChange={e => setTambos(e.target.value)}
                placeholder="ej: 5"
                className="w-full px-3 py-2.5 bg-[#0e0f1a] border border-[#252638] rounded-lg
                  text-[#eceef5] text-sm font-mono outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
          </div>

          {/* ── Cálculo en tiempo real ── */}
          {(dosisNum > 0 && tambosNum > 0) && (
            <div className="bg-[#0e0f1a] border border-[#1c1d2e] rounded-lg p-4 space-y-3">
              <div className="grid grid-cols-4 gap-2 text-center">
                {[
                  { label: 'Total producto',  value: `${totalProducto.toFixed(3)} ${prodSeleccionado?.unidad ?? ''}`,  color: 'text-[#eceef5]' },
                  { label: 'En inventario',   value: stockProducto > 0 ? stockProducto.toFixed(2) : '—',               color: stockProducto >= totalProducto ? 'text-emerald-400' : 'text-red-400' },
                  { label: 'Necesidad',       value: necesidad <= 0 ? '✓ ok' : necesidad.toFixed(3),                   color: necesidad <= 0 ? 'text-emerald-400' : necesidad > totalProducto * 0.5 ? 'text-red-400 font-bold' : 'text-amber-400' },
                  { label: 'Costo est.',      value: `$${costoEstimado.toFixed(2)}`,                                   color: 'text-emerald-400 font-bold' },
                ].map(item => (
                  <div key={item.label}>
                    <div className={`font-mono text-base font-semibold ${item.color}`}>{item.value}</div>
                    <div className="text-[9px] text-[#3e4262] mt-0.5 uppercase tracking-wider">{item.label}</div>
                  </div>
                ))}
              </div>
              {productoNombre && (
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border
                  ${necesidad <= 0
                    ? 'bg-emerald-900/20 border-emerald-800/30 text-emerald-400'
                    : necesidad > totalProducto * 0.5
                      ? 'bg-red-900/20 border-red-800/30 text-red-400'
                      : 'bg-amber-900/20 border-amber-800/30 text-amber-400'}`}>
                  <span>{necesidad <= 0 ? '✅' : necesidad > totalProducto * 0.5 ? '🚨' : '⚠️'}</span>
                  <span className="flex-1">
                    {necesidad <= 0
                      ? `Stock suficiente (${stockProducto.toFixed(2)} disponibles)`
                      : `Faltan ${necesidad.toFixed(3)} ${prodSeleccionado?.unidad ?? ''} — coordinar compra`}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* ── Método y Objetivo ── */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-[#7b7f9e] uppercase tracking-wider mb-2">
                Método de aplicación
              </label>
              <select value={metodo} onChange={e => setMetodo(e.target.value)}
                className="w-full px-3 py-2.5 bg-[#0e0f1a] border border-[#252638] rounded-lg
                  text-[#eceef5] text-sm outline-none focus:border-emerald-500 transition-colors">
                <option value="">Seleccionar...</option>
                {Object.keys(METODOS_CONFIG).map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#7b7f9e] uppercase tracking-wider mb-2">
                Objetivo / Nota
              </label>
              <select value={objetivo} onChange={e => setObjetivo(e.target.value)}
                className="w-full px-3 py-2.5 bg-[#0e0f1a] border border-[#252638] rounded-lg
                  text-[#eceef5] text-sm outline-none focus:border-emerald-500 transition-colors">
                <option value="">Sin especificar</option>
                {OBJETIVOS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          </div>

          {/* ── Responsable ── */}
          <div>
            <label className="block text-[11px] font-bold text-[#7b7f9e] uppercase tracking-wider mb-2">
              Responsable
            </label>
            <select
              value={responsableId ?? ''}
              onChange={e => setResponsableId(e.target.value ? Number(e.target.value) : null)}
              className="w-full px-3 py-2.5 bg-[#0e0f1a] border border-[#252638] rounded-lg
                text-[#eceef5] text-sm outline-none focus:border-emerald-500 transition-colors">
              <option value="">Sin asignar</option>
              {supervisores.map(s => <option key={s.ID} value={s.ID}>{s.name}</option>)}
            </select>
          </div>

          {/* ── Notas ── */}
          <div>
            <label className="block text-[11px] font-bold text-[#7b7f9e] uppercase tracking-wider mb-2">
              Notas
            </label>
            <textarea
              value={notas}
              onChange={e => setNotas(e.target.value)}
              rows={2}
              placeholder="Observaciones adicionales..."
              className="w-full px-3 py-2.5 bg-[#0e0f1a] border border-[#252638] rounded-lg
                text-[#eceef5] text-sm outline-none focus:border-emerald-500 transition-colors resize-none"
            />
          </div>

          {error && (
            <div className="px-3 py-2.5 bg-red-900/20 border border-red-800/30 rounded-lg
              text-sm text-red-400 font-medium">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-6 py-4 border-t border-[#1c1d2e] flex-shrink-0">
          <button onClick={onClose}
            className="px-4 py-2.5 rounded-lg border border-[#252638] text-[#7b7f9e]
              text-sm font-semibold hover:bg-[#181929] transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60
              text-black text-sm font-bold transition-colors flex items-center justify-center gap-2">
            {saving ? (
              <>
                <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin"/>
                Guardando…
              </>
            ) : '💾 Guardar entrada'}
          </button>
        </div>
      </div>
    </>
  );
}