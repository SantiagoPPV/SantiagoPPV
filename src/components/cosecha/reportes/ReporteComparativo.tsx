import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface Row {
  sector: string;
  kg_semana_actual: number;
  kg_semana_anterior: number;
  diferencia: number;
  porcentaje_cambio: number | null;
}

interface Props { data: Row[]; }

export default function ReporteComparativo({ data }: Props) {
  if (data.length === 0) return <p className="text-[#666] text-center py-10">Sin datos comparativos.</p>;

  const chartData = data.map((r) => ({
    name: r.sector,
    actual: Number(Number(r.kg_semana_actual).toFixed(1)),
    anterior: Number(Number(r.kg_semana_anterior).toFixed(1)),
  }));

  const totalActual = data.reduce((s, r) => s + Number(r.kg_semana_actual), 0);
  const totalAnterior = data.reduce((s, r) => s + Number(r.kg_semana_anterior), 0);
  const globalChange = totalAnterior > 0 ? ((totalActual - totalAnterior) / totalAnterior) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[#1A1A1A] rounded-xl p-4 border border-[#2A2A2A] text-center">
          <p className="text-xs text-[#888]">Semana Actual</p>
          <p className="text-xl font-bold text-blue-400">{totalActual.toLocaleString('es-MX', { maximumFractionDigits: 0 })} kg</p>
        </div>
        <div className="bg-[#1A1A1A] rounded-xl p-4 border border-[#2A2A2A] text-center">
          <p className="text-xs text-[#888]">Semana Anterior</p>
          <p className="text-xl font-bold text-[#A3A3A3]">{totalAnterior.toLocaleString('es-MX', { maximumFractionDigits: 0 })} kg</p>
        </div>
        <div className="bg-[#1A1A1A] rounded-xl p-4 border border-[#2A2A2A] text-center">
          <p className="text-xs text-[#888]">Cambio Global</p>
          <p className={`text-xl font-bold ${globalChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {globalChange >= 0 ? '+' : ''}{globalChange.toFixed(1)}%
          </p>
        </div>
      </div>

      <div className="bg-[#1A1A1A] rounded-xl p-4 border border-[#2A2A2A]">
        <h3 className="text-sm font-medium text-white mb-3">Comparativo por Sector</h3>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={chartData} margin={{ bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
            <XAxis dataKey="name" tick={{ fill: '#ccc', fontSize: 11 }} angle={-45} textAnchor="end" height={60} />
            <YAxis tick={{ fill: '#888', fontSize: 12 }} />
            <Tooltip contentStyle={{ backgroundColor: '#1A1A1A', border: '1px solid #333', borderRadius: 8 }} />
            <Legend />
            <Bar dataKey="actual" fill="#3b82f6" name="Semana Actual" radius={[4, 4, 0, 0]} />
            <Bar dataKey="anterior" fill="#4b5563" name="Semana Anterior" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-[#1A1A1A] rounded-xl border border-[#2A2A2A] overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#2A2A2A] text-[#888]">
              <th className="px-4 py-3 text-left">Sector</th>
              <th className="px-4 py-3 text-right">Sem. Actual (kg)</th>
              <th className="px-4 py-3 text-right">Sem. Anterior (kg)</th>
              <th className="px-4 py-3 text-right">Diferencia</th>
              <th className="px-4 py-3 text-right">% Cambio</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r) => {
              const diff = Number(r.diferencia);
              const pct = r.porcentaje_cambio;
              return (
                <tr key={r.sector} className="border-b border-[#1F1F1F] hover:bg-[#1F1F1F]">
                  <td className="px-4 py-2 text-white font-medium">{r.sector}</td>
                  <td className="px-4 py-2 text-right text-white">{Number(r.kg_semana_actual).toLocaleString('es-MX', { maximumFractionDigits: 1 })}</td>
                  <td className="px-4 py-2 text-right text-[#A3A3A3]">{Number(r.kg_semana_anterior).toLocaleString('es-MX', { maximumFractionDigits: 1 })}</td>
                  <td className="px-4 py-2 text-right">
                    <span className={`inline-flex items-center gap-1 ${diff > 0 ? 'text-emerald-400' : diff < 0 ? 'text-red-400' : 'text-[#666]'}`}>
                      {diff > 0 ? <TrendingUp className="w-3 h-3" /> : diff < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                      {diff > 0 ? '+' : ''}{diff.toFixed(1)}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <span className={pct !== null ? (Number(pct) >= 0 ? 'text-emerald-400' : 'text-red-400') : 'text-[#666]'}>
                      {pct !== null ? `${Number(pct) >= 0 ? '+' : ''}${pct}%` : '—'}
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
