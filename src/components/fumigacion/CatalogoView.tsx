import React, { useState } from 'react';
import type { ProductoMoray } from './fumigacionTypes';
import { CATEGORIAS_PRODUCTO, CATEGORIA_ICONS, CATEGORIA_COLORS } from './fumigacionTypes';
import { supabase } from '../../lib/supabaseClient';
import toast from 'react-hot-toast';

interface CatalogoViewProps {
  productos: ProductoMoray[];
  onRefresh: () => void;
}

export default function CatalogoView({ productos, onRefresh }: CatalogoViewProps) {
  const [busqueda, setBusqueda] = useState('');
  const [editando, setEditando] = useState<ProductoMoray | null>(null);
  const [showForm, setShowForm] = useState(false);

  const productosFiltrados = productos.filter(p =>
    p.Nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    p.categoria.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 flex items-center gap-2 px-3 py-2.5 bg-[#0e0f1a]
          border border-[#1c1d2e] rounded-lg">
          <span className="text-[#3e4262]">🔍</span>
          <input
            type="text"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar producto..."
            className="flex-1 bg-transparent text-sm text-[#eceef5] outline-none placeholder:text-[#3e4262]"
          />
        </div>
        <button
          onClick={() => { setEditando(null); setShowForm(true); }}
          className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black
            text-sm font-bold rounded-lg transition-colors"
        >
          + Nuevo
        </button>
      </div>

      {/* Lista productos */}
      <div className="space-y-2">
        {productosFiltrados.map(p => {
          const icon = CATEGORIA_ICONS[p.categoria] ?? '📦';
          const color = CATEGORIA_COLORS[p.categoria] ?? '#4B5563';

          return (
            <div
              key={p.id}
              className="flex items-center gap-3 bg-[#181929] border border-[#1c1d2e]
                rounded-xl p-3.5 hover:border-[#252638] transition-colors cursor-pointer"
              onClick={() => { setEditando(p); setShowForm(true); }}
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
                style={{ background: `${color}22` }}
              >
                {icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-[#eceef5] truncate">{p.Nombre}</div>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-[10px] font-bold font-mono" style={{ color }}>
                    {p.categoria}
                  </span>
                  <span className="text-[10px] text-[#3e4262] font-mono">
                    ref: {p.dosis_ref_200l ?? '—'} {p.unidad}/200L
                  </span>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="font-mono text-sm font-bold text-emerald-400">
                  ${p.costo_unitario}
                </div>
                <div className="text-[10px] text-[#3e4262] mt-0.5">/{p.unidad}</div>
              </div>
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${p.activo ? 'bg-emerald-500' : 'bg-[#3e4262]'}`} />
            </div>
          );
        })}
        {productosFiltrados.length === 0 && (
          <div className="text-center py-12 text-[#3e4262]">
            <div className="text-4xl mb-3">🧪</div>
            <div className="text-sm">Sin productos que coincidan</div>
          </div>
        )}
      </div>

      {/* Form / modal */}
      {showForm && (
        <ProductoForm
          producto={editando}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); onRefresh(); }}
        />
      )}
    </div>
  );
}

// ── Formulario de producto ───────────────────────────────────────────────────

function ProductoForm({
  producto,
  onClose,
  onSaved,
}: {
  producto: ProductoMoray | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nombre, setNombre] = useState(producto?.Nombre ?? '');
  const [categoria, setCategoria] = useState(producto?.categoria ?? 'Otro');
  const [unidad, setUnidad] = useState(producto?.unidad ?? 'mL');
  const [dosisRef, setDosisRef] = useState(producto?.dosis_ref_200l?.toString() ?? '');
  const [costo, setCosto] = useState(producto?.costo_unitario?.toString() ?? '0');
  const [activo, setActivo] = useState(producto?.activo ?? true);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!nombre.trim()) { toast.error('El nombre es requerido'); return; }
    setSaving(true);
    try {
      const data = {
        categoria,
        unidad,
        dosis_ref_200l: dosisRef ? parseFloat(dosisRef) : null,
        costo_unitario: parseFloat(costo) || 0,
        activo,
      };

      if (producto) {
        // Update
        const { error } = await supabase
          .from('Productos Moray')
          .update(data)
          .eq('id', producto.id);
        if (error) throw error;
        toast.success('Producto actualizado');
      } else {
        // Insert
        const { error } = await supabase
          .from('Productos Moray')
          .insert({ ...data, Nombre: nombre.trim() });
        if (error) throw error;
        toast.success('Producto creado');
      }
      onSaved();
    } catch (err: any) {
      toast.error(err.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 w-[420px] max-w-full bg-[#12131e]
        border-l border-[#252638] z-50 flex flex-col animate-in slide-in-from-right duration-200">

        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1c1d2e]">
          <div className="font-syne text-base font-extrabold text-[#eceef5]">
            {producto ? 'Editar producto' : 'Nuevo producto'}
          </div>
          <button onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg border border-[#252638]
              text-[#7b7f9e] hover:text-[#eceef5] text-sm transition-colors">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-[#7b7f9e] uppercase tracking-wider mb-2">
              Nombre del producto
            </label>
            <input
              type="text"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              disabled={!!producto} // No editar nombre si ya existe (PK lógica)
              className="w-full px-3 py-2.5 bg-[#0e0f1a] border border-[#252638] rounded-lg
                text-[#eceef5] text-sm outline-none focus:border-emerald-500 disabled:opacity-50"
              placeholder="Nombre exacto del producto"
            />
            {producto && (
              <div className="text-[10px] text-[#3e4262] mt-1">
                El nombre no se puede cambiar para mantener la integridad con el historial
              </div>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#7b7f9e] uppercase tracking-wider mb-2">
              Categoría
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {CATEGORIAS_PRODUCTO.map(cat => {
                const icon = CATEGORIA_ICONS[cat] ?? '📦';
                const color = CATEGORIA_COLORS[cat] ?? '#4B5563';
                return (
                  <button
                    key={cat}
                    onClick={() => setCategoria(cat)}
                    className="flex items-center gap-2 px-2.5 py-2 rounded-lg border text-xs
                      font-semibold transition-all"
                    style={{
                      background: categoria === cat ? `${color}20` : '#0e0f1a',
                      borderColor: categoria === cat ? `${color}60` : '#252638',
                      color: categoria === cat ? color : '#7b7f9e',
                    }}
                  >
                    {icon} {cat}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-[#7b7f9e] uppercase tracking-wider mb-2">
                Unidad
              </label>
              <select
                value={unidad}
                onChange={e => setUnidad(e.target.value)}
                className="w-full px-3 py-2.5 bg-[#0e0f1a] border border-[#252638] rounded-lg
                  text-[#eceef5] text-sm outline-none focus:border-emerald-500"
              >
                {['mL', 'g', 'L', 'kg'].map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#7b7f9e] uppercase tracking-wider mb-2">
                Dosis ref. /200L
              </label>
              <input
                type="number"
                step="0.01"
                value={dosisRef}
                onChange={e => setDosisRef(e.target.value)}
                className="w-full px-3 py-2.5 bg-[#0e0f1a] border border-[#252638] rounded-lg
                  text-[#eceef5] text-sm font-mono outline-none focus:border-emerald-500"
                placeholder="ej: 500"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#7b7f9e] uppercase tracking-wider mb-2">
              Costo unitario (MXN / {unidad})
            </label>
            <input
              type="number"
              step="0.01"
              value={costo}
              onChange={e => setCosto(e.target.value)}
              className="w-full px-3 py-2.5 bg-[#0e0f1a] border border-[#252638] rounded-lg
                text-[#eceef5] text-sm font-mono outline-none focus:border-emerald-500"
              placeholder="0.00"
            />
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <div
              onClick={() => setActivo(!activo)}
              className={`w-10 h-6 rounded-full border-2 flex items-center transition-all ${
                activo ? 'bg-emerald-500 border-emerald-500' : 'bg-[#1c1d2e] border-[#252638]'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform mx-0.5 ${
                  activo ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </div>
            <div>
              <div className="text-sm font-semibold text-[#eceef5]">Producto activo</div>
              <div className="text-[10px] text-[#3e4262]">
                Inactivo = no aparece en selectores de programa
              </div>
            </div>
          </label>
        </div>

        <div className="flex gap-2 px-5 py-4 border-t border-[#1c1d2e]">
          <button onClick={onClose}
            className="px-4 py-2.5 border border-[#252638] rounded-lg text-sm font-semibold
              text-[#7b7f9e] hover:bg-[#181929] transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60
              text-black text-sm font-bold rounded-lg transition-colors
              flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                Guardando…
              </>
            ) : '💾 Guardar'}
          </button>
        </div>
      </div>
    </>
  );
}