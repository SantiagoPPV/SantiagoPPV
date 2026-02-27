import React from 'react';

interface Props {
  totalKg: number;
  sectoresCount: number;
  tunelesCount: number;
  totalMermaKg: number;
  mermaPercent: number;
}

const cards = [
  { key: 'kg', label: 'Total Kg', color: 'text-blue-400', format: (v: number) => v.toLocaleString('es-MX', { maximumFractionDigits: 1 }) },
  { key: 'sectores', label: 'Sectores', color: 'text-emerald-400', format: (v: number) => v.toString() },
  { key: 'tuneles', label: 'Túneles', color: 'text-purple-400', format: (v: number) => v.toString() },
  { key: 'mermaKg', label: 'Merma Kg', color: 'text-amber-400', format: (v: number) => v.toLocaleString('es-MX', { maximumFractionDigits: 2 }) },
  { key: 'mermaPct', label: '% Merma', color: 'text-red-400', format: (v: number) => `${v.toFixed(1)}%` },
];

export default function ResumenDiario({ totalKg, sectoresCount, tunelesCount, totalMermaKg, mermaPercent }: Props) {
  const values: Record<string, number> = {
    kg: totalKg,
    sectores: sectoresCount,
    tuneles: tunelesCount,
    mermaKg: totalMermaKg,
    mermaPct: mermaPercent,
  };

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-white flex items-center gap-2">
        <span className="w-1.5 h-5 bg-emerald-500 rounded-full" />
        Resumen del Día
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {cards.map((c) => (
          <div key={c.key} className="bg-[#1A1A1A] rounded-xl p-4 border border-[#2A2A2A] text-center">
            <p className="text-xs text-[#888] mb-1">{c.label}</p>
            <p className={`text-xl font-bold ${c.color}`}>{c.format(values[c.key])}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
