import React, { useState } from 'react';
import type { FumAplicacion, PersonalFumigacion } from '../fumigacionTypes';
import { VARIEDADES_CONFIG } from '../fumigacionTypes';

interface DetalleAplicacionModalProps {
  aplicacion: FumAplicacion;
  personal: PersonalFumigacion[];
  onClose: () => void;
  onActualizarChecklist: (chk: Partial<FumAplicacion>) => Promise<void>;
  onGuardarFumigadores: (fums: { personal_id: number; fecha: string; tambos_realizados: number }[]) => Promise<void>;
  onActualizar: (data: Partial<FumAplicacion>) => Promise<void>;
}

type PanelSection = 'avance' | 'checklist' | 'docs' | 'fumigadores';

export default function DetalleAplicacionModal({
  aplicacion: a,
  personal,
  onClose,
  onActualizarChecklist,
  onGuardarFumigadores,
  onActualizar,
}: DetalleAplicacionModalProps) {
  const [openSections, setOpenSections] = useState<Set<PanelSection>>(
    new Set(['avance', 'checklist'])
  );
  const [tambosEdit, setTambosEdit] = useState(a.tambos_realizados);
  const [secCompletadas, setSecCompletadas] = useState(new Set(a.sectores_completados));
  const [chk, setChk] = useState({
    chk_aspersoras_lavadas: a.chk_aspersoras_lavadas,
    chk_equipo_guardado: a.chk_equipo_guardado,
    chk_epp_revisado: a.chk_epp_revisado,
    chk_envases_foto: a.chk_envases_foto,
    chk_tambos_llenos: a.chk_tambos_llenos,
  });
  const [savingChk, setSavingChk] = useState(false);
  const [savingFum, setSavingFum] = useState(false);

  // Fumigadores: inicializar con los que ya vienen del join
  const [fumigadorTambos, setFumigadorTambos] = useState<Record<number, number>>(() => {
    const init: Record<number, number> = {};
    for (const fum of (a.fumigadores ?? [])) {
      init[fum.personal_id] = fum.tambos_realizados;
    }
    return init;
  });
  const [fumigadoresActivos, setFumigadoresActivos] = useState<Set<number>>(() => {
    return new Set((a.fumigadores ?? []).map(f => f.personal_id));
  });

  const vCfg = VARIEDADES_CONFIG[a.variedad as keyof typeof VARIEDADES_CONFIG];
  const costo = (a.productos ?? []).reduce((s, p) => s + (p.costo_total ?? 0), 0);
  const chkDone = Object.values(chk).filter(Boolean).length;
  const pctChk = Math.round((chkDone / 5) * 100);
  const pctTambos = a.tambos_programados > 0
    ? Math.round((tambosEdit / a.tambos_programados) * 100)
    : 0;

  const toggleSection = (s: PanelSection) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      next.has(s) ? next.delete(s) : next.add(s);
      return next;
    });
  };

  const handleToggleChk = async (key: keyof typeof chk) => {
    const newChk = { ...chk, [key]: !chk[key] };
    setChk(newChk);
    setSavingChk(true);
    try {
      await onActualizarChecklist(newChk);
    } finally {
      setSavingChk(false);
    }
  };

  const handleSaveFumigadores = async () => {
    setSavingFum(true);
    try {
      const fecha = a.fecha_inicio.split('T')[0];
      const rows = [...fumigadoresActivos].map(pid => ({
        personal_id: pid,
        fecha,
        tambos_realizados: fumigadorTambos[pid] ?? 0,
      }));
      await onGuardarFumigadores(rows);
    } finally {
      setSavingFum(false);
    }
  };

  const handleSaveAvance = async () => {
    await onActualizar({
      tambos_realizados: tambosEdit,
      sectores_completados: [...secCompletadas],
    });
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40" onClick={onClose} />

      <div className="fixed right-0 top-0 bottom-0 w-[660px] max-w-full bg-[#12131e]
        border-l border-[#252638] z-50 flex flex-col overflow-hidden
        animate-in slide-in-from-right duration-200">

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-[#1c1d2e] flex-shrink-0">
          <div>
            <h2 className="font-syne text-lg font-extrabold text-[#eceef5]">
              {a.variedad} —{' '}
              {new Date(a.fecha_inicio).toLocaleDateString('es-MX', {
                weekday: 'long', day: 'numeric', month: 'long',
              })}
            </h2>
            <div className="flex items-center gap-2 mt-1.5">
              <span
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold text-white"
                style={{ background: vCfg?.color ?? '#374151' }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-white/50" />
                {a.variedad}
              </span>
              <span className="text-xs text-[#7b7f9e]">
                {a.responsable?.name ?? 'Sin responsable'} · {a.clima}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Costo total */}
            <div className="text-right">
              <div className="font-mono text-xl font-bold text-emerald-400">${costo.toFixed(2)}</div>
              <div className="text-[10px] text-[#3e4262]">Costo total MXN</div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg
                border border-[#252638] text-[#7b7f9e] hover:text-[#eceef5]
                hover:bg-[#181929] transition-colors text-sm"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {/* ── AVANCE ─────────────────────────────────────────────── */}
          <Section
            id="avance" icon="📊" title="Avance de aplicación"
            sub={`${secCompletadas.size}/${a.sectores_programados.length} sectores · ${tambosEdit}/${a.tambos_programados} tambos`}
            open={openSections.has('avance')}
            onToggle={() => toggleSection('avance')}
          >
            {/* Sectores */}
            <div className="mb-4">
              <div className="text-[11px] font-bold text-[#7b7f9e] uppercase tracking-wider mb-2">
                Sectores completados
              </div>
              <div className="flex flex-wrap gap-1.5">
                {a.sectores_programados.map(s => {
                  const done = secCompletadas.has(s);
                  return (
                    <button
                      key={s}
                      onClick={() => {
                        setSecCompletadas(prev => {
                          const next = new Set(prev);
                          next.has(s) ? next.delete(s) : next.add(s);
                          return next;
                        });
                      }}
                      className="px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-bold border-[1.5px] transition-all"
                      style={{
                        background: done ? vCfg?.color ?? '#10b981' : '#0e0f1a',
                        borderColor: done ? 'transparent' : '#252638',
                        color: done ? '#fff' : '#7b7f9e',
                      }}
                    >
                      {done ? '✓ ' : ''}{s}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tambos */}
            <div className="flex items-center gap-4 p-3 bg-[#0e0f1a] rounded-lg border border-[#1c1d2e]">
              <div>
                <div className="font-syne text-2xl font-extrabold text-[#eceef5]">
                  {tambosEdit}{' '}
                  <span className="text-[#3e4262] text-base">/ {a.tambos_programados}</span>
                </div>
                <div className="text-[10px] text-[#7b7f9e] mt-0.5">Tambos realizados</div>
              </div>
              <div className="flex-1 h-2 bg-[#1c1d2e] rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, pctTambos)}%` }}
                />
              </div>
              <input
                type="number"
                min={0}
                max={a.tambos_programados + 10}
                value={tambosEdit}
                onChange={e => setTambosEdit(parseInt(e.target.value) || 0)}
                className="w-14 text-center py-1.5 bg-[#0e0f1a] border border-[#252638] rounded-lg
                  font-mono text-sm font-bold text-[#eceef5] outline-none focus:border-emerald-500"
              />
            </div>

            <button
              onClick={handleSaveAvance}
              className="mt-3 w-full py-2 rounded-lg bg-[#181929] border border-[#252638]
                text-sm font-semibold text-[#7b7f9e] hover:text-[#eceef5] hover:border-[#2e3050] transition-colors"
            >
              Guardar avance
            </button>
          </Section>

          {/* ── PRODUCTOS ──────────────────────────────────────────── */}
          {(a.productos ?? []).length > 0 && (
            <Section
              id="productos" icon="🧪" title="Productos aplicados"
              sub={`${a.productos!.length} producto(s)`}
              open={openSections.has('productos' as any)}
              onToggle={() => toggleSection('productos' as any)}
            >
              <div className="space-y-2">
                {a.productos!.map(p => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between px-3 py-2.5
                      bg-[#0e0f1a] border border-[#1c1d2e] rounded-lg"
                  >
                    <div>
                      <div className="text-sm font-semibold text-[#eceef5]">{p.producto_nombre}</div>
                      <div className="text-[10px] font-mono text-[#3e4262] mt-0.5">
                        {p.dosis_200l}/{p.tambos} · {p.total_usado.toFixed(3)} total · {p.metodo ?? '—'}
                      </div>
                    </div>
                    <div className="font-mono text-sm font-bold text-emerald-400">
                      ${p.costo_total.toFixed(2)}
                    </div>
                  </div>
                ))}
                <div className="flex justify-between px-3 py-2 bg-emerald-900/10 border border-emerald-800/20 rounded-lg">
                  <span className="text-xs font-bold text-[#7b7f9e]">TOTAL</span>
                  <span className="font-mono text-sm font-bold text-emerald-400">${costo.toFixed(2)}</span>
                </div>
              </div>
            </Section>
          )}

          {/* ── CHECKLIST DE CIERRE ────────────────────────────────── */}
          <Section
            id="checklist" icon="✅" title="Checklist de cierre"
            sub={`${chkDone}/5 · ${pctChk}%`}
            open={openSections.has('checklist')}
            onToggle={() => toggleSection('checklist')}
            rightExtra={
              <span
                className="text-xs font-mono font-bold"
                style={{ color: pctChk >= 100 ? '#10b981' : pctChk > 50 ? '#f59e0b' : '#ef4444' }}
              >
                {pctChk}%
              </span>
            }
          >
            {savingChk && (
              <div className="text-[10px] text-[#7b7f9e] mb-2 font-mono">Guardando…</div>
            )}
            <div className="space-y-2">
              {([
                ['chk_aspersoras_lavadas', 'Fumigadores lavaron motoaspersoras con agua y jabón'],
                ['chk_equipo_guardado',    'Equipo guardado en cuarto de fumigación'],
                ['chk_epp_revisado',       'EPP completo y en buen estado'],
                ['chk_envases_foto',       'Fotos de envases vacíos enviadas (WhatsApp)'],
                ['chk_tambos_llenos',      'Tambos llenos con agua para mañana'],
              ] as [keyof typeof chk, string][]).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => handleToggleChk(key)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left
                    transition-colors duration-100 ${
                      chk[key]
                        ? 'bg-emerald-900/20 border-emerald-800/30'
                        : 'bg-[#0e0f1a] border-[#1c1d2e] hover:border-[#252638]'
                    }`}
                >
                  <div
                    className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                      chk[key] ? 'bg-emerald-500 border-emerald-500' : 'border-[#252638]'
                    }`}
                  >
                    {chk[key] && (
                      <svg viewBox="0 0 12 12" className="w-3 h-3" fill="none" stroke="black" strokeWidth="2.5" strokeLinecap="round">
                        <polyline points="2,6 5,9 10,3" />
                      </svg>
                    )}
                  </div>
                  <span className={`text-sm font-medium flex-1 ${chk[key] ? 'text-[#7b7f9e] line-through' : 'text-[#eceef5]'}`}>
                    {label}
                  </span>
                </button>
              ))}
            </div>
          </Section>

          {/* ── DOCUMENTOS ─────────────────────────────────────────── */}
          <Section
            id="docs" icon="📂" title="Evidencias"
            sub={`${(a.docs ?? []).length}/2 subidas`}
            open={openSections.has('docs')}
            onToggle={() => toggleSection('docs')}
          >
            <div className="grid grid-cols-2 gap-3">
              {[
                { tipo: 'video', icon: '📹', title: 'Video aplicación', sub: 'MP4, MOV · máx 100MB' },
                { tipo: 'envases_vacios', icon: '🗑️', title: 'Fotos envases vacíos', sub: 'JPG, PNG · máx 20MB' },
              ].map(item => {
                const docExiste = (a.docs ?? []).some(d => d.tipo === item.tipo);
                return (
                  <label
                    key={item.tipo}
                    className={`flex flex-col items-center justify-center p-5 rounded-xl
                      border-2 border-dashed cursor-pointer text-center transition-colors duration-150 ${
                        docExiste
                          ? 'bg-emerald-900/20 border-emerald-600/40'
                          : 'bg-[#0e0f1a] border-[#252638] hover:border-emerald-600/30 hover:bg-emerald-900/10'
                      }`}
                  >
                    <input type="file" className="hidden" accept={item.tipo === 'video' ? 'video/*' : 'image/*'} />
                    <div className="text-2xl mb-2">{item.icon}</div>
                    <div className="text-xs font-bold text-[#eceef5]">{item.title}</div>
                    <div className="text-[10px] text-[#7b7f9e] mt-1">
                      {docExiste ? <span className="text-emerald-400">✓ Subido</span> : item.sub}
                    </div>
                  </label>
                );
              })}
            </div>
            <div className="mt-3 px-3 py-2 bg-[#0e0f1a] border border-[#1c1d2e] rounded-lg
              text-[10px] text-[#3e4262]">
              Los archivos se guardan en <code>fumigacion-docs/{a.almacen_id}/{a.id}/</code>
            </div>
          </Section>

          {/* ── FUMIGADORES ────────────────────────────────────────── */}
          <Section
            id="fumigadores" icon="👷" title="Fumigadores del día"
            sub={`${fumigadoresActivos.size} trabajadores`}
            open={openSections.has('fumigadores')}
            onToggle={() => toggleSection('fumigadores')}
          >
            <div className="mb-3 flex items-center gap-2 px-3 py-2 bg-emerald-900/10
              border border-emerald-800/20 rounded-lg text-[11px] text-emerald-400/80">
              <span>ℹ</span>
              <span>Los tambos registrados aquí se usarán para calcular el pago de destajo</span>
            </div>

            {/* Lista de personal disponible (Fumigación + Labores) */}
            <div className="space-y-1.5">
              {personal.map(p => {
                const activo = fumigadoresActivos.has(p.ID);
                return (
                  <div
                    key={p.ID}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors ${
                      activo
                        ? 'bg-[#181929] border-[#252638]'
                        : 'bg-[#0e0f1a] border-[#1c1d2e] opacity-50'
                    }`}
                  >
                    {/* Toggle activo */}
                    <button
                      onClick={() => {
                        setFumigadoresActivos(prev => {
                          const next = new Set(prev);
                          next.has(p.ID) ? next.delete(p.ID) : next.add(p.ID);
                          return next;
                        });
                      }}
                      className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                        activo ? 'bg-emerald-500 border-emerald-500' : 'border-[#252638]'
                      }`}
                    >
                      {activo && (
                        <svg viewBox="0 0 12 12" className="w-2.5 h-2.5" fill="none" stroke="black" strokeWidth="2.5" strokeLinecap="round">
                          <polyline points="2,6 5,9 10,3" />
                        </svg>
                      )}
                    </button>

                    <div className="flex-1">
                      <div className="text-sm font-semibold text-[#eceef5]">{p.Nombre}</div>
                      <div className={`text-[10px] font-mono px-1.5 py-px rounded inline-block mt-0.5 ${
                        p.Categoria === 'Fumigación'
                          ? 'bg-emerald-900/30 text-emerald-400/70'
                          : 'bg-[#252638] text-[#3e4262]'
                      }`}>
                        {p.Categoria}
                      </div>
                    </div>

                    {/* Tambos input */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-[#3e4262]">tambos</span>
                      <input
                        type="number"
                        min={0}
                        value={fumigadorTambos[p.ID] ?? 0}
                        onChange={e => setFumigadorTambos(prev => ({
                          ...prev, [p.ID]: parseInt(e.target.value) || 0
                        }))}
                        disabled={!activo}
                        className="w-12 text-center py-1 bg-[#0e0f1a] border border-[#252638] rounded
                          font-mono text-sm font-bold text-[#eceef5] outline-none
                          focus:border-emerald-500 disabled:opacity-30"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Total tambos */}
            <div className="flex justify-between items-center mt-3 px-3 py-2
              bg-[#0e0f1a] border border-[#1c1d2e] rounded-lg">
              <span className="text-xs font-bold text-[#7b7f9e]">Total tambos registrados</span>
              <span className="font-mono text-sm font-bold text-emerald-400">
                {[...fumigadoresActivos].reduce((s, pid) => s + (fumigadorTambos[pid] ?? 0), 0)} tambos
              </span>
            </div>

            <button
              onClick={handleSaveFumigadores}
              disabled={savingFum}
              className="mt-3 w-full py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400
                disabled:opacity-60 text-black text-sm font-bold transition-colors
                flex items-center justify-center gap-2"
            >
              {savingFum ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  Guardando…
                </>
              ) : '💾 Guardar fumigadores'}
            </button>
          </Section>

        </div>
      </div>
    </>
  );
}

// ── Componente auxiliar Section ──────────────────────────────────────────────

function Section({
  id, icon, title, sub, open, onToggle, children, rightExtra,
}: {
  id: string; icon: string; title: string; sub: string;
  open: boolean; onToggle: () => void;
  children: React.ReactNode; rightExtra?: React.ReactNode;
}) {
  return (
    <div className="bg-[#181929] border border-[#1c1d2e] rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3.5
          hover:bg-[#1c1d2e] transition-colors"
      >
        <div className="flex items-center gap-3 text-left">
          <span className="text-base">{icon}</span>
          <div>
            <div className="font-syne text-sm font-bold text-[#eceef5]">{title}</div>
            <div className="text-[11px] text-[#7b7f9e] mt-0.5">{sub}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {rightExtra}
          <svg
            className={`w-4 h-4 text-[#3e4262] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            viewBox="0 0 16 16" fill="none"
          >
            <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 border-t border-[#1c1d2e]" style={{ paddingTop: '12px' }}>
          {children}
        </div>
      )}
    </div>
  );
}