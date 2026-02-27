import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface Row { sector: string; variedad: string; total_kg: number; num_cortes: number; }
interface Props { data: Row[]; }

export default function ReporteKgSector({ data }: Props) {
  if (data.length === 0) return <p className="text-[#666] text-center py-10">Sin datos para el rango seleccionado.</p>;

  const totalKg = data.reduce((s, r) => s + Number(r.total_kg), 0);
  const chartData = data.map((r) => ({ name: r.sector, kg: Number(Number(r.total_kg).toFixed(1)) }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[#1A1A1A] rounded-xl p-4 border border-[#2A2A2A] text-center">
          <p className="text-xs text-[#888]">Total Kg</p>
          <p className="text-xl font-bold text-blue-400">{totalKg.toLocaleString('es-MX', { maximumFractionDigits: 1 })}</p>
        </div>
        <div className="bg-[#1A1A1A] rounded-xl p-4 border border-[#2A2A2A] text-center">
          <p className="text-xs text-[#888]">Sectores Activos</p>
          <p className="text-xl font-bold text-emerald-400">{data.length}</p>
        </div>
      </div>

      <div className="bg-[#1A1A1A] rounded-xl p-4 border border-[#2A2A2A]">
        <h3 className="text-sm font-medium text-white mb-3">Kg por Sector</h3>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={chartData} margin={{ bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
            <XAxis dataKey="name" tick={{ fill: '#ccc', fontSize: 11 }} angle={-45} textAnchor="end" height={60} />
            <YAxis tick={{ fill: '#888', fontSize: 12 }} />
            <Tooltip contentStyle={{ backgroundColor: '#1A1A1A', border: '1px solid #333', borderRadius: 8 }} formatter={(v: number) => [`${v} kg`]} />
            <Bar dataKey="kg" fill="#22c55e" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-[#1A1A1A] rounded-xl border border-[#2A2A2A] overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#2A2A2A] text-[#888]">
              <th className="px-4 py-3 text-left">Sector</th>
              <th className="px-4 py-3 text-left">Variedad</th>
              <th className="px-4 py-3 text-right">Kg Total</th>
              <th className="px-4 py-3 text-right">Cortes</th>
              <th className="px-4 py-3 text-right">% del Total</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r) => (
              <tr key={r.sector} className="border-b border-[#1F1F1F] hover:bg-[#1F1F1F]">
                <td className="px-4 py-2 text-white font-medium">{r.sector}</td>
                <td className="px-4 py-2 text-[#A3A3A3]">{r.variedad}</td>
                <td className="px-4 py-2 text-right text-white">{Number(r.total_kg).toLocaleString('es-MX', { maximumFractionDigits: 1 })}</td>
                <td className="px-4 py-2 text-right text-[#ccc]">{r.num_cortes}</td>
                <td className="px-4 py-2 text-right text-blue-400">{((Number(r.total_kg) / totalKg) * 100).toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
