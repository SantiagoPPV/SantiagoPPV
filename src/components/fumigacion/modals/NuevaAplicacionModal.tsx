import React, { useState, useEffect } from 'react';
import { getISOWeek } from 'date-fns';
import type { ProductoMoray } from '../fumigacionTypes';
import {
  VARIEDADES_CONFIG,
  METODOS_CONFIG,
  TODOS_SECTORES,
} from '../fumigacionTypes';
import { supabase } from '../../../lib/supabaseClient';
import { useAuthStore } from '../../../store/useAuthStore';

interface NuevaAplicacionModalProps {
  almacenId: string;
  productos: ProductoMoray[];
  onClose: () => void;
  onSave: (data: any) => Promise<any>;
}

type Clima = 'despejado' | 'parcial' | 'lluvia';

export default function NuevaAplicacionModal({
  almacenId,
  productos,
  onClose,
  onSave,
}: NuevaAplicacionModalProps) {
  const { user } = useAuthStore();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Campos principales
  const [fechaInicio, setFechaInicio] = useState(new Date().toISOString().split('T')[0]);
  const [variedad, setVariedad] = useState('');
  const [sectores, setSectores] = useState<Set<string>>(new Set());
  const [tambosProgramados, setTambosProgramados] = useState('');
  const [clima, setClima] = useState<Clima>('despejado');
  const [phCaldo, setPhCaldo] = useState('');
  const [ceCaldo, setCeCaldo] = useState('');
  const [responsableId, setResponsableId] = useState<number | null>(null);
  const [notas, setNotas] = useState('');
  const [supervisores, setSupervisores] = useState<{ ID: number; name: string }[]>([]);

  // Productos de la aplicación
  const [prodsAplicacion, setProdsAplicacion] = useState<{
    producto_nombre: string;
    dosis_200l: number;
    tambos: number;
    metodo: string;
  }[]>([]);
  const [busquedaProd, setBusquedaProd] = useState('');
  const [showProdDrop, setShowProdDrop] = useState(false);

  useEffect(() => {
    supabase
      .from('Users')
      .select('"ID", name')
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => {
        if (data) setSupervisores(data.map((u: any) => ({ ID: u.ID, name: u.name })));
      });
    if (user?.id) setResponsableId(Number(user.id));
  }, []);

  const selectVariedad = (v: string) => {
    setVariedad(v);
    const cfg = VARIEDADES_CONFIG[v as keyof typeof VARIEDADES_CONFIG];
    setSectores(new Set(cfg?.sectores.length ? cfg.sectores : []));
  };

  const toggleSector = (s: string) =>
    setSectores(prev => {
      const next = new Set(prev);
      next.has(s) ? next.delete(s) : next.add(s);
      return next;
    });

  const addProducto = (nombre: string) => {
    if (prodsAplicacion.find(p => p.producto_nombre === nombre)) return;
    const prod = productos.find(p => p.Nombre === nombre);
    setProdsAplicacion(prev => [...prev, {
      producto_nombre: nombre,
      dosis_200l: prod?.dosis_ref_200l ?? 0,
      tambos: parseInt(tambosProgramados) || 1,
      metodo: 'FOLIAR',
    }]);
    setBusquedaProd('');
    setShowProdDrop(false);
  };

  const updateProd = (index: number, field: string, value: any) =>
    setProdsAplicacion(prev => prev.map((p, i) => i === index ? { ...p, [field]: value } : p));

  const removeProd = (index: number) =>
    setProdsAplicacion(prev => prev.filter((_, i) => i !== index));

  const handleSave = async () => {
    setError(null);
    if (!variedad) { setError('Selecciona una variedad'); return; }
    if (sectores.size === 0) { setError('Selecciona al menos un sector'); return; }
    if (!tambosProgramados || parseInt(tambosProgramados) <= 0) { setError('Ingresa el número de tambos'); return; }
    if (prodsAplicacion.length === 0) { setError('Agrega al menos un producto'); return; }

    setSaving(true);
    try {
      const tambosNum = parseInt(tambosProgramados);
      await onSave({
        almacen_id: almacenId,
        fecha_inicio: fechaInicio,
        fecha_fin: null,
        variedad,
        sectores_programados: [...sectores],
        sectores_completados: [],
        tambos_programados: tambosNum,
        tambos_realizados: 0,
        ph_caldo: phCaldo ? parseFloat(phCaldo) : null,
        ce_caldo: ceCaldo ? parseFloat(ceCaldo) : null,
        clima,
        responsable_id: responsableId,
        notas: notas || null,
        programa_ids: null,
        chk_aspersoras_lavadas: false,
        chk_equipo_guardado: false,
        chk_epp_revisado: false,
        chk_envases_foto: false,
        chk_tambos_llenos: false,
        // Productos se insertan por separado en el hook tras crear la aplicación
        _productos: prodsAplicacion.map(p => {
          const prod = productos.find(pr => pr.Nombre === p.producto_nombre);
          const total = (p.dosis_200l * p.tambos) / 1000;
          return {
            producto_nombre: p.producto_nombre,
            categoria: prod?.categoria ?? null,
            dosis_200l: p.dosis_200l,
            tambos: p.tambos,
            total_usado: Math.round(total * 1000) / 1000,
            metodo: p.metodo || null,
            costo_unitario: prod?.costo_unitario ?? 0,
            costo_total: Math.round(total * (prod?.costo_unitario ?? 0) * 100) / 100,
            es_base: true,
          };
        }),
      });
    } catch (err: any) {
      setError(err.message || 'Error al guardar');
      setSaving(false);
    }
  };

  const prodsFiltrados = productos.filter(
    p => p.activo && p.Nombre.toLowerCase().includes(busquedaProd.toLowerCase())
      && !prodsAplicacion.find(pa => pa.producto_nombre === p.Nombre)
  );

  const variedadCfg = VARIEDADES_CONFIG[variedad as keyof typeof VARIEDADES_CONFIG];

  return (
    <>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40" onClick={onClose} />

      <div className="fixed right-0 top-0 bottom-0 w-[520px] max-w-full bg-[#12131e]
        border-l border-[#252638] z-50 flex flex-col overflow-hidden
        animate-in slide-in-from-right duration-200">

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-[#1c1d2e] flex-shrink-0">
          <div>
            <h2 className="font-syne text-lg font-extrabold text-[#eceef5]">
              Registrar aplicación
            </h2>
            <p className="text-xs text-[#7b7f9e] mt-1">
              Datos generales + productos aplicados
            </p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg
              border border-[#252638] text-[#7b7f9e] hover:text-[#eceef5]
              hover:bg-[#181929] transition-colors text-sm">
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* ── Fecha y clima ── */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-[#7b7f9e] uppercase tracking-wider mb-2">
                Fecha de aplicación
              </label>
              <input
                type="date"
                value={fechaInicio}
                onChange={e => setFechaInicio(e.target.value)}
                className="w-full px-3 py-2.5 bg-[#0e0f1a] border border-[#252638] rounded-lg
                  text-[#eceef5] text-sm outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#7b7f9e] uppercase tracking-wider mb-2">
                Condición climática
              </label>
              <div className="flex gap-1.5">
                {([
                  { key: 'despejado', emoji: '☀️' },
                  { key: 'parcial',   emoji: '⛅' },
                  { key: 'lluvia',    emoji: '🌧️' },
                ] as { key: Clima; emoji: string }[]).map(c => (
                  <button
                    key={c.key}
                    onClick={() => setClima(c.key)}
                    className={`flex-1 py-2.5 rounded-lg border text-sm transition-all ${
                      clima === c.key
                        ? 'bg-[#252638] border-emerald-600/50 text-[#eceef5]'
                        : 'bg-[#0e0f1a] border-[#252638] text-[#3e4262] hover:border-[#2e3050]'
                    }`}
                  >
                    {c.emoji}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── Variedad ── */}
          <div>
            <label className="block text-[11px] font-bold text-[#7b7f9e] uppercase tracking-wider mb-2">
              Variedad
            </label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(VARIEDADES_CONFIG).map(([v, cfg]) => (
                <button
                  key={v}
                  onClick={() => selectVariedad(v)}
                  className="px-3 py-1.5 rounded-full border text-[11px] font-bold transition-all"
                  style={{
                    background: variedad === v ? `${cfg.color}25` : '#0e0f1a',
                    borderColor: variedad === v ? `${cfg.color}70` : '#252638',
                    color: variedad === v ? cfg.color : '#7b7f9e',
                  }}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* ── Sectores ── */}
          {variedad && (
            <div>
              <label className="block text-[11px] font-bold text-[#7b7f9e] uppercase tracking-wider mb-2">
                Sectores programados ({sectores.size} seleccionados)
              </label>
              <div className="flex flex-wrap gap-1.5">
                {TODOS_SECTORES.map(s => {
                  const active = sectores.has(s);
                  return (
                    <button
                      key={s}
                      onClick={() => toggleSector(s)}
                      className="w-10 h-8 rounded text-[10px] font-mono font-bold border transition-all"
                      style={{
                        background: active ? `${variedadCfg?.color ?? '#374151'}22` : '#0e0f1a',
                        borderColor: active ? `${variedadCfg?.color ?? '#374151'}60` : '#252638',
                        color: active ? (variedadCfg?.color ?? '#374151') : '#3e4262',
                      }}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Tambos y pH/CE ── */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-[#7b7f9e] uppercase tracking-wider mb-2">
                Tambos programados
              </label>
              <input
                type="number"
                value={tambosProgramados}
                onChange={e => setTambosProgramados(e.target.value)}
                placeholder="ej: 5"
                className="w-full px-3 py-2.5 bg-[#0e0f1a] border border-[#252638] rounded-lg
                  text-[#eceef5] text-sm font-mono outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#7b7f9e] uppercase tracking-wider mb-2">
                pH del caldo
              </label>
              <input
                type="number"
                step="0.1"
                value={phCaldo}
                onChange={e => setPhCaldo(e.target.value)}
                placeholder="ej: 6.5"
                className="w-full px-3 py-2.5 bg-[#0e0f1a] border border-[#252638] rounded-lg
                  text-[#eceef5] text-sm font-mono outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#7b7f9e] uppercase tracking-wider mb-2">
                CE del caldo
              </label>
              <input
                type="number"
                step="0.01"
                value={ceCaldo}
                onChange={e => setCeCaldo(e.target.value)}
                placeholder="ej: 1.2"
                className="w-full px-3 py-2.5 bg-[#0e0f1a] border border-[#252638] rounded-lg
                  text-[#eceef5] text-sm font-mono outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
          </div>

          {/* ── Productos aplicados ── */}
          <div>
            <label className="block text-[11px] font-bold text-[#7b7f9e] uppercase tracking-wider mb-2">
              Productos aplicados
            </label>

            {/* Selector de productos */}
            <div className="relative mb-3">
              <div className="flex items-center gap-2 px-3 py-2.5 bg-[#0e0f1a] border border-[#252638]
                rounded-lg focus-within:border-emerald-500 transition-colors">
                <span className="text-[#3e4262] text-sm">🔍</span>
                <input
                  type="text"
                  value={busquedaProd}
                  onChange={e => { setBusquedaProd(e.target.value); setShowProdDrop(true); }}
                  onFocus={() => setShowProdDrop(true)}
                  placeholder="Buscar y agregar producto..."
                  className="flex-1 bg-transparent text-sm text-[#eceef5] outline-none placeholder:text-[#3e4262]"
                />
              </div>
              {showProdDrop && busquedaProd && (
                <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-[#181929]
                  border border-[#252638] rounded-xl overflow-hidden shadow-2xl max-h-48 overflow-y-auto">
                  {prodsFiltrados.slice(0, 10).map(p => (
                    <button
                      key={p.id}
                      onMouseDown={() => addProducto(p.Nombre)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium
                        text-[#eceef5] hover:bg-[#1c1d2e] transition-colors text-left"
                    >
                      <span className="flex-1 truncate">{p.Nombre}</span>
                      <span className="text-[10px] font-mono text-[#3e4262]">
                        {p.dosis_ref_200l} {p.unidad}/200L
                      </span>
                    </button>
                  ))}
                  {prodsFiltrados.length === 0 && (
                    <div className="text-center py-4 text-[#3e4262] text-sm">Sin resultados</div>
                  )}
                </div>
              )}
            </div>

            {/* Lista de productos agregados */}
            {prodsAplicacion.length === 0 ? (
              <div className="text-center py-5 text-[#3e4262] text-xs border border-dashed border-[#252638] rounded-xl">
                Sin productos. Busca y agrega productos arriba.
              </div>
            ) : (
              <div className="space-y-2">
                {prodsAplicacion.map((p, i) => {
                  const total = (p.dosis_200l * p.tambos) / 1000;
                  const prod = productos.find(pr => pr.Nombre === p.producto_nombre);
                  return (
                    <div key={i} className="bg-[#0e0f1a] border border-[#1c1d2e] rounded-xl p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-[#eceef5] truncate flex-1 mr-2">
                          {p.producto_nombre}
                        </span>
                        <span className="font-mono text-[10px] text-emerald-400 font-bold mr-2">
                          {total.toFixed(3)} {prod?.unidad}
                        </span>
                        <button onClick={() => removeProd(i)}
                          className="text-[#3e4262] hover:text-red-400 transition-colors text-xs">
                          ✕
                        </button>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <div className="text-[9px] text-[#3e4262] uppercase mb-1">Dosis /200L</div>
                          <input
                            type="number"
                            step="0.01"
                            value={p.dosis_200l}
                            onChange={e => updateProd(i, 'dosis_200l', parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1.5 bg-[#181929] border border-[#252638] rounded
                              text-[#eceef5] text-xs font-mono outline-none focus:border-emerald-500"
                          />
                        </div>
                        <div>
                          <div className="text-[9px] text-[#3e4262] uppercase mb-1">Tambos</div>
                          <input
                            type="number"
                            value={p.tambos}
                            onChange={e => updateProd(i, 'tambos', parseInt(e.target.value) || 0)}
                            className="w-full px-2 py-1.5 bg-[#181929] border border-[#252638] rounded
                              text-[#eceef5] text-xs font-mono outline-none focus:border-emerald-500"
                          />
                        </div>
                        <div>
                          <div className="text-[9px] text-[#3e4262] uppercase mb-1">Método</div>
                          <select
                            value={p.metodo}
                            onChange={e => updateProd(i, 'metodo', e.target.value)}
                            className="w-full px-2 py-1.5 bg-[#181929] border border-[#252638] rounded
                              text-[#eceef5] text-xs outline-none focus:border-emerald-500"
                          >
                            {Object.keys(METODOS_CONFIG).map(m => (
                              <option key={m} value={m}>{m}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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
                text-[#eceef5] text-sm outline-none focus:border-emerald-500 transition-colors"
            >
              <option value="">Sin asignar</option>
              {supervisores.map(s => (
                <option key={s.ID} value={s.ID}>{s.name}</option>
              ))}
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
              placeholder="Observaciones..."
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
            className="flex-1 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400
              disabled:opacity-60 text-black text-sm font-bold transition-colors
              flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                Guardando…
              </>
            ) : '✅ Registrar aplicación'}
          </button>
        </div>
      </div>
    </>
  );
}