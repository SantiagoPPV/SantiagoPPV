import React from 'react';
import { Search } from 'lucide-react';
import type { SectorConfig } from '../cosechaTypes';

interface Props {
  desde: string;
  hasta: string;
  sector: string;
  sectores: SectorConfig[];
  onDesdeChange: (v: string) => void;
  onHastaChange: (v: string) => void;
  onSectorChange: (v: string) => void;
  onApply: () => void;
  loading: boolean;
}

const cls = 'bg-[#1F1F1F] border border-[#2A2A2A] text-white rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none';

export default function FiltroFechas({ desde, hasta, sector, sectores, onDesdeChange, onHastaChange, onSectorChange, onApply, loading }: Props) {
  return (
    <div className="bg-[#1A1A1A] rounded-xl p-4 border border-[#2A2A2A] flex flex-wrap items-end gap-3">
      <div>
        <label className="block text-xs text-[#888] mb-1">Desde</label>
        <input type="date" value={desde} onChange={(e) => onDesdeChange(e.target.value)} className={cls} />
      </div>
      <div>
        <label className="block text-xs text-[#888] mb-1">Hasta</label>
        <input type="date" value={hasta} onChange={(e) => onHastaChange(e.target.value)} className={cls} />
      </div>
      <div>
        <label className="block text-xs text-[#888] mb-1">Sector</label>
        <select value={sector} onChange={(e) => onSectorChange(e.target.value)} className={cls}>
          <option value="">Todos</option>
          {sectores.map((s) => (
            <option key={s.sector} value={s.sector}>{s.sector}</option>
          ))}
        </select>
      </div>
      <button
        onClick={onApply}
        disabled={loading}
        className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm font-medium flex items-center gap-1.5 transition-colors"
      >
        <Search className="w-4 h-4" />
        Aplicar
      </button>
    </div>
  );
}
