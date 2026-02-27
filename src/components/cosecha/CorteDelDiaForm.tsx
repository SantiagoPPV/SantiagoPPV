import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { CorteEntry, SectorConfig } from './cosechaTypes';

interface Props {
  entries: CorteEntry[];
  sectores: SectorConfig[];
  onAdd: () => void;
  onRemove: (uid: string) => void;
  onChange: (uid: string, field: keyof CorteEntry, value: any) => void;
  getSector: (sector: string) => SectorConfig | undefined;
  getTunnelRange: (sector: string) => number[];
}

const inputCls = (hasError = false) =>
  `w-full bg-[#1F1F1F] border ${hasError ? 'border-red-500' : 'border-[#2A2A2A]'} text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 ${hasError ? 'focus:ring-red-500' : 'focus:ring-blue-500'} transition-colors`;

export default function CorteDelDiaForm({ entries, sectores, onAdd, onRemove, onChange, getSector, getTunnelRange }: Props) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-white flex items-center gap-2">
        <span className="w-1.5 h-5 bg-blue-500 rounded-full" />
        Corte del Día
      </h2>

      {entries.map((entry, idx) => {
        const tunnels = entry.sector ? getTunnelRange(entry.sector) : [];
        const sectorCfg = entry.sector ? getSector(entry.sector) : undefined;

        return (
          <div key={entry.uid} className="bg-[#1A1A1A] p-5 rounded-xl border border-[#2A2A2A]">
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm font-medium text-[#A3A3A3]">Entrada {idx + 1}</span>
              {entries.length > 1 && (
                <button type="button" onClick={() => onRemove(entry.uid)} className="text-[#666] hover:text-red-400 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Sector */}
              <div>
                <label className="block text-sm font-medium text-[#A3A3A3] mb-1.5">Sector</label>
                <select
                  value={entry.sector}
                  onChange={(e) => onChange(entry.uid, 'sector', e.target.value)}
                  className={inputCls(!entry.sector && idx === 0 ? false : false)}
                >
                  <option value="">Seleccionar</option>
                  {sectores.map((s) => (
                    <option key={s.sector} value={s.sector}>{s.sector}</option>
                  ))}
                </select>
              </div>

              {/* Variedad (auto) */}
              <div>
                <label className="block text-sm font-medium text-[#A3A3A3] mb-1.5">Variedad</label>
                <div className="w-full bg-[#161616] border border-[#2A2A2A] text-[#8B8B8B] rounded-xl px-4 py-3 text-sm">
                  {sectorCfg?.variedad || '—'}
                </div>
              </div>

              {/* Túnel inicio */}
              <div>
                <label className="block text-sm font-medium text-[#A3A3A3] mb-1.5">Túnel Inicio</label>
                <select
                  value={entry.tunelInicio}
                  onChange={(e) => onChange(entry.uid, 'tunelInicio', e.target.value ? Number(e.target.value) : '')}
                  disabled={!entry.sector}
                  className={inputCls()}
                >
                  <option value="">Seleccionar</option>
                  {tunnels.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              {/* Túnel final */}
              <div>
                <label className="block text-sm font-medium text-[#A3A3A3] mb-1.5">Túnel Final</label>
                <select
                  value={entry.tunelFinal}
                  onChange={(e) => onChange(entry.uid, 'tunelFinal', e.target.value ? Number(e.target.value) : '')}
                  disabled={!entry.sector}
                  className={inputCls()}
                >
                  <option value="">Seleccionar</option>
                  {tunnels
                    .filter((t) => entry.tunelInicio === '' || t >= Number(entry.tunelInicio))
                    .map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                </select>
              </div>
            </div>

            {/* Cubetas → Kg */}
            <div className="mt-4 grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#A3A3A3] mb-1.5">
                  Cubetas Cosechadas
                  <span className="ml-1.5 text-[#555] font-normal text-xs">(× 2.65 kg)</span>
                </label>
                <input
                  type="number"
                  value={entry.cubetas}
                  onChange={(e) => {
                    const cubetas = e.target.value ? Number(e.target.value) : '';
                    const kg = cubetas !== '' ? Math.round(cubetas * 2.65 * 100) / 100 : '';
                    onChange(entry.uid, 'cubetas', cubetas);
                    onChange(entry.uid, 'kgCosechados', kg);
                  }}
                  onWheel={(e) => e.currentTarget.blur()}
                  min="0"
                  step="1"
                  placeholder="0"
                  className={inputCls()}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#A3A3A3] mb-1.5">Kg Calculados</label>
                <div className={`w-full bg-[#161616] border ${entry.cubetas !== '' ? 'border-blue-500/40 text-white' : 'border-[#2A2A2A] text-[#555]'} rounded-xl px-4 py-3 text-sm font-mono transition-colors`}>
                  {entry.cubetas !== '' ? `${(Number(entry.cubetas) * 2.65).toFixed(2)} kg` : '—'}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#A3A3A3] mb-1.5">Observaciones</label>
                <input
                  type="text"
                  value={entry.observaciones}
                  onChange={(e) => onChange(entry.uid, 'observaciones', e.target.value)}
                  placeholder="Opcional"
                  className={inputCls()}
                />
              </div>
            </div>
          </div>
        );
      })}

      <button
        type="button"
        onClick={onAdd}
        className="w-full bg-[#1F1F1F] border border-dashed border-[#333] text-[#A3A3A3] rounded-xl py-3 flex items-center justify-center gap-2 hover:bg-[#2A2A2A] hover:text-white transition-colors"
      >
        <Plus className="w-4 h-4" />
        Añadir otro sector
      </button>
    </div>
  );
}