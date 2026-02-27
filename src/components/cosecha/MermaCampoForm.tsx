import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { TIPOS_MERMA } from './cosechaTypes';
import type { MermaEntry, SectorConfig, TipoMerma } from './cosechaTypes';

interface Props {
  entries: MermaEntry[];
  sectores: SectorConfig[];
  onAdd: () => void;
  onRemove: (uid: string) => void;
  onChange: (uid: string, sector: string) => void;
  onTotalChange: (uid: string, value: number | '') => void;
  onDetailChange: (uid: string, tipo: TipoMerma, value: number | '') => void;
  totalKgBySector: Record<string, number>;
}

export default function MermaCampoForm({ entries, sectores, onAdd, onRemove, onChange, onTotalChange, onDetailChange, totalKgBySector }: Props) {
  const getSumaPorcentajes = (entry: MermaEntry): number => {
    return Object.values(entry.detalles).reduce((sum: number, v) => sum + (Number(v) || 0), 0);
  };

  const getMermaPercent = (entry: MermaEntry): string => {
    const totalKg = totalKgBySector[entry.sector] || 0;
    const totalMerma = Number(entry.totalMermaKg) || 0;
    if (totalKg <= 0 || totalMerma <= 0) return '0.0';
    return ((totalMerma / totalKg) * 100).toFixed(1);
  };

  const getKgFromPercent = (entry: MermaEntry, porcentaje: number | ''): string => {
    const total = Number(entry.totalMermaKg) || 0;
    const pct = Number(porcentaje) || 0;
    if (total <= 0 || pct <= 0) return '0.00';
    return ((pct / 100) * total).toFixed(2);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-white flex items-center gap-2">
        <span className="w-1.5 h-5 bg-amber-500 rounded-full" />
        Merma de Campo
        <span className="text-xs text-[#666] font-normal">(opcional)</span>
      </h2>

      {entries.map((entry) => {
        const sumaPct = getSumaPorcentajes(entry);
        const pctDiff = Math.abs(sumaPct - 100);

        return (
          <div key={entry.uid} className="bg-[#1A1A1A] p-5 rounded-xl border border-[#2A2A2A]">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-4 flex-wrap">
                <div>
                  <label className="block text-xs text-[#666] mb-1">Sector</label>
                  <select
                    value={entry.sector}
                    onChange={(e) => onChange(entry.uid, e.target.value)}
                    className="bg-[#1F1F1F] border border-[#2A2A2A] text-white rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="">Seleccionar</option>
                    {sectores.map((s) => (
                      <option key={s.sector} value={s.sector}>{s.sector}</option>
                    ))}
                  </select>
                </div>
                {entry.sector && (
                  <div>
                    <label className="block text-xs text-[#666] mb-1">Total Merma (kg)</label>
                    <input
                      type="number"
                      value={entry.totalMermaKg}
                      onChange={(e) => onTotalChange(entry.uid, e.target.value ? Number(e.target.value) : '')}
                      onWheel={(e) => e.currentTarget.blur()}
                      min="0"
                      step="0.01"
                      placeholder="0"
                      className="w-36 bg-[#1F1F1F] border border-[#2A2A2A] text-white rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                )}
                {entry.sector && (
                  <div className="flex gap-4 text-sm items-end pb-1">
                    <span className="text-[#A3A3A3]">
                      % Merma: <span className={`font-medium ${Number(getMermaPercent(entry)) > 5 ? 'text-red-400' : 'text-emerald-400'}`}>
                        {getMermaPercent(entry)}%
                      </span>
                    </span>
                  </div>
                )}
              </div>
              {entries.length > 1 && (
                <button type="button" onClick={() => onRemove(entry.uid)} className="text-[#666] hover:text-red-400 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            {entry.sector && Number(entry.totalMermaKg) > 0 && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {TIPOS_MERMA.map((tipo) => (
                    <div key={tipo}>
                      <label className="block text-xs text-[#888] mb-1 truncate" title={tipo}>{tipo}</label>
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <input
                            type="number"
                            value={entry.detalles[tipo]}
                            onChange={(e) => onDetailChange(entry.uid, tipo, e.target.value ? Number(e.target.value) : '')}
                            onWheel={(e) => e.currentTarget.blur()}
                            min="0"
                            max="100"
                            step="0.1"
                            placeholder="0"
                            className="w-full bg-[#1F1F1F] border border-[#2A2A2A] text-white rounded-lg px-3 py-2 pr-7 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[#666] text-xs">%</span>
                        </div>
                        <span className="text-xs text-[#555] w-16 text-right shrink-0">
                          {getKgFromPercent(entry, entry.detalles[tipo])} kg
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Suma de porcentajes */}
                <div className="mt-3 flex items-center gap-2 text-sm">
                  <span className="text-[#A3A3A3]">Suma porcentajes:</span>
                  <span className={`font-medium ${pctDiff > 0.1 && sumaPct > 0 ? 'text-amber-400' : sumaPct > 0 ? 'text-emerald-400' : 'text-[#666]'}`}>
                    {sumaPct.toFixed(1)}%
                  </span>
                  {sumaPct > 0 && pctDiff > 0.1 && (
                    <span className="text-xs text-amber-400/70">
                      (la suma no es 100%)
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        );
      })}

      <button
        type="button"
        onClick={onAdd}
        className="w-full bg-[#1F1F1F] border border-dashed border-[#333] text-[#A3A3A3] rounded-xl py-3 flex items-center justify-center gap-2 hover:bg-[#2A2A2A] hover:text-white transition-colors"
      >
        <Plus className="w-4 h-4" />
        Añadir merma de otro sector
      </button>
    </div>
  );
}