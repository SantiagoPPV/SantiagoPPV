import React, { useState } from 'react';
import type { FumAplicacion, PersonalFumigacion, ProductoMoray } from './fumigacionTypes';
import { VARIEDADES_CONFIG } from './fumigacionTypes';
import DetalleAplicacionModal from './modals/DetalleAplicacionModal';
import NuevaAplicacionModal from './modals/NuevaAplicacionModal';

interface AplicacionesViewProps {
  aplicaciones: FumAplicacion[];
  personal: PersonalFumigacion[];
  productos: ProductoMoray[];
  loading: boolean;
  almacenId: string;
  onCrear: (data: any) => Promise<any>;
  onActualizar: (id: string, data: Partial<FumAplicacion>) => Promise<void>;
  onActualizarChecklist: (id: string, chk: any) => Promise<void>;
  onGuardarFumigadores: (aplicacionId: string, fumigadores: any[]) => Promise<void>;
}

export default function AplicacionesView({
  aplicaciones,
  personal,
  productos,
  loading,
  almacenId,
  onCrear,
  onActualizar,
  onActualizarChecklist,
  onGuardarFumigadores,
}: AplicacionesViewProps) {
  const [detalle, setDetalle] = useState<FumAplicacion | null>(null);
  const [showNueva, setShowNueva] = useState(false);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">

      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5
        bg-[#0e0f1a] border-b border-[#1c1d2e] flex-shrink-0">
        <span className="text-xs text-[#7b7f9e]">
          {aplicaciones.length} aplicación{aplicaciones.length !== 1 ? 'es' : ''} registrada{aplicaciones.length !== 1 ? 's' : ''}
        </span>
        <button
          onClick={() => setShowNueva(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500
            hover:bg-emerald-400 text-black text-xs font-bold transition-all duration-150"
        >
          ＋ Registrar aplicación
        </button>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-[#7b7f9e] text-sm">
            Cargando aplicaciones…
          </div>
        ) : aplicaciones.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-60 text-[#3e4262]">
            <div className="text-5xl mb-4">🌱</div>
            <div className="text-sm font-semibold text-[#7b7f9e]">Sin aplicaciones registradas</div>
            <div className="text-xs mt-2">Registra la primera usando el botón de arriba</div>
          </div>
        ) : (
          aplicaciones.map(a => {
            const vCfg = VARIEDADES_CONFIG[a.variedad as keyof typeof VARIEDADES_CONFIG];
            const chkDone = [
              a.chk_aspersoras_lavadas, a.chk_equipo_guardado, a.chk_epp_revisado,
              a.chk_envases_foto, a.chk_tambos_llenos,
            ].filter(Boolean).length;
            const pctTambos = a.tambos_programados > 0
              ? Math.round((a.tambos_realizados / a.tambos_programados) * 100) : 0;
            const costo = (a.productos ?? []).reduce((s, p) => s + (p.costo_total ?? 0), 0);
            const docsOk = (a.docs ?? []).length;

            return (
              <div key={a.id} onClick={() => setDetalle(a)}
                className="bg-[#13141f] border border-[#1c1d2e] rounded-xl p-4 cursor-pointer
                  hover:border-[#252638] transition-colors duration-100">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-syne text-base font-extrabold text-[#eceef5]">
                      {new Date(a.fecha_inicio).toLocaleDateString('es-MX', {
                        weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
                      })}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full
                        text-[11px] font-bold text-white" style={{ background: vCfg?.color ?? '#374151' }}>
                        <span className="w-1.5 h-1.5 rounded-full bg-white/50" />{a.variedad}
                      </span>
                      <span className="text-xs text-[#7b7f9e]">{a.responsable?.name ?? 'Sin responsable'}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-lg font-bold text-emerald-400">${costo.toFixed(0)}</div>
                    <div className="text-[10px] text-[#3e4262] mt-0.5">Costo total</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {a.sectores_completados.map(s => (
                    <span key={s} className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border"
                      style={{ background: `${vCfg?.color ?? '#374151'}22`, color: vCfg?.color ?? '#374151', borderColor: `${vCfg?.color ?? '#374151'}44` }}>
                      ✓ {s}
                    </span>
                  ))}
                  {a.sectores_programados.filter(s => !a.sectores_completados.includes(s)).map(s => (
                    <span key={s} className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border border-[#252638] text-[#3e4262]">
                      {s}
                    </span>
                  ))}
                </div>
                <div className="grid grid-cols-4 gap-3">
                  <StatCell label="Tambos" value={`${a.tambos_realizados}/${a.tambos_programados}`} sub={`${pctTambos}%`} color={pctTambos >= 100 ? 'text-emerald-400' : 'text-amber-400'} />
                  <StatCell label="Checklist" value={`${chkDone}/5`} sub={chkDone === 5 ? 'completo' : 'pendiente'} color={chkDone === 5 ? 'text-emerald-400' : 'text-amber-400'} />
                  <StatCell label="Evidencias" value={docsOk > 0 ? `${docsOk} docs` : '—'} sub={docsOk >= 2 ? 'ok' : 'falta subir'} color={docsOk >= 2 ? 'text-emerald-400' : 'text-[#3e4262]'} />
                  <StatCell label="Clima" value={a.ph_caldo ? `pH ${a.ph_caldo}` : '—'} sub={a.clima} color="text-[#7b7f9e]" />
                </div>
              </div>
            );
          })
        )}
      </div>

      {detalle && (
        <DetalleAplicacionModal
          aplicacion={detalle}
          personal={personal}
          onClose={() => setDetalle(null)}
          onActualizarChecklist={async (chk) => {
            await onActualizarChecklist(detalle.id, chk);
            setDetalle(prev => prev ? { ...prev, ...chk } : null);
          }}
          onGuardarFumigadores={async (fums) => { await onGuardarFumigadores(detalle.id, fums); }}
          onActualizar={async (data) => {
            await onActualizar(detalle.id, data);
            setDetalle(prev => prev ? { ...prev, ...data } : null);
          }}
        />
      )}

      {showNueva && (
        <NuevaAplicacionModal
          almacenId={almacenId}
          productos={productos}
          onClose={() => setShowNueva(false)}
          onSave={async (data) => {
            const created = await onCrear(data);
            setShowNueva(false);
            return created;
          }}
        />
      )}
    </div>
  );
}

function StatCell({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div>
      <div className="text-[10px] font-bold text-[#3e4262] uppercase tracking-wider">{label}</div>
      <div className={`font-mono text-sm font-semibold mt-0.5 ${color}`}>{value}</div>
      <div className="text-[10px] text-[#3e4262]">{sub}</div>
    </div>
  );
}