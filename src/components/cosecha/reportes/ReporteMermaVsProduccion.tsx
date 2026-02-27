import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface Row { sector: string; kg_cosechados: number; kg_merma: number; porcentaje_merma: number; }
interface Props { data: Row[]; }

export default function ReporteMermaVsProduccion({ data }: Props) {
  if (data.length === 0) return <p className="text-[#666] text-center py-10">Sin datos para el rango seleccionado.</p>;

  const chartData = data.map((r) => ({
    name: r.sector,
    pct: Number(r.porcentaje_merma) || 0,
  }));

  const avgMerma = data.length > 0
    ? data.reduce((s, r) => s + (Number(r.porcentaje_merma) || 0), 0) / data.length
    : 0;

  const getColor = (pct: number) => pct > 5 ? '#ef4444' : pct > 3 ? '#eab308' : '#22c55e';

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[#1A1A1A] rounded-xl p-4 border border-[#2A2A2A] text-center">
          <p className="text-xs text-[#888]">Promedio % Merma</p>
          <p className={`text-xl font-bold ${avgMerma > 5 ? 'text-red-400' : avgMerma > 3 ? 'text-amber-400' : 'text-emerald-400'}`}>
            {avgMerma.toFixed(1)}%
          </p>
        </div>
        <div className="bg-[#1A1A1A] rounded-xl p-4 border border-[#2A2A2A] text-center">
          <p className="text-xs text-[#888]">Peor Sector</p>
          <p className="text-xl font-bold text-red-400">{data[0]?.sector || '—'} ({data[0]?.porcentaje_merma || 0}%)</p>
        </div>
      </div>

      <div className="bg-[#1A1A1A] rounded-xl p-4 border border-[#2A2A2A]">
        <h3 className="text-sm font-medium text-white mb-3">% Merma por Sector</h3>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={chartData} margin={{ bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
            <XAxis dataKey="name" tick={{ fill: '#ccc', fontSize: 11 }} angle={-45} textAnchor="end" height={60} />
            <YAxis tick={{ fill: '#888', fontSize: 12 }} unit="%" />
            <Tooltip contentStyle={{ backgroundColor: '#1A1A1A', border: '1px solid #333', borderRadius: 8 }} formatter={(v: number) => [`${v}%`]} />
            <Bar dataKey="pct" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, i) => <Cell key={i} fill={getColor(entry.pct)} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-[#1A1A1A] rounded-xl border border-[#2A2A2A] overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#2A2A2A] text-[#888]">
              <th className="px-4 py-3 text-left">Sector</th>
              <th className="px-4 py-3 text-right">Kg Cosechados</th>
              <th className="px-4 py-3 text-right">Kg Merma</th>
              <th className="px-4 py-3 text-right">% Merma</th>
              <th className="px-4 py-3 text-center">Estado</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r) => {
              const pct = Number(r.porcentaje_merma) || 0;
              return (
                <tr key={r.sector} className="border-b border-[#1F1F1F] hover:bg-[#1F1F1F]">
                  <td className="px-4 py-2 text-white font-medium">{r.sector}</td>
                  <td className="px-4 py-2 text-right text-white">{Number(r.kg_cosechados).toLocaleString('es-MX', { maximumFractionDigits: 1 })}</td>
                  <td className="px-4 py-2 text-right text-red-400">{Number(r.kg_merma).toLocaleString('es-MX', { maximumFractionDigits: 1 })}</td>
                  <td className="px-4 py-2 text-right font-medium" style={{ color: getColor(pct) }}>{pct.toFixed(1)}%</td>
                  <td className="px-4 py-2 text-center">
                    <span className="px-2 py-0.5 rounded-full text-xs" style={{ backgroundColor: getColor(pct) + '22', color: getColor(pct) }}>
                      {pct > 5 ? 'Crítico' : pct > 3 ? 'Alerta' : 'Normal'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
