import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface Row { variedad: string; total_kg: number; num_sectores: number; promedio_kg_sector: number; }
interface Props { data: Row[]; }

const COLORS = ['#3b82f6', '#22c55e', '#eab308', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899', '#14b8a6'];

export default function ReporteVariedad({ data }: Props) {
  if (data.length === 0) return <p className="text-[#666] text-center py-10">Sin datos por variedad.</p>;

  const totalKg = data.reduce((s, r) => s + Number(r.total_kg), 0);
  const pieData = data.map((r) => ({ name: r.variedad, value: Number(Number(r.total_kg).toFixed(1)) }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[#1A1A1A] rounded-xl p-4 border border-[#2A2A2A]">
          <h3 className="text-sm font-medium text-white mb-3">Distribución por Variedad</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: '#1A1A1A', border: '1px solid #333', borderRadius: 8 }} formatter={(v: number) => [`${v} kg`]} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-[#1A1A1A] rounded-xl border border-[#2A2A2A] overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2A2A2A] text-[#888]">
                <th className="px-4 py-3 text-left">Variedad</th>
                <th className="px-4 py-3 text-right">Kg</th>
                <th className="px-4 py-3 text-right">Sectores</th>
                <th className="px-4 py-3 text-right">Prom Kg/Sector</th>
                <th className="px-4 py-3 text-right">%</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r, i) => (
                <tr key={r.variedad} className="border-b border-[#1F1F1F] hover:bg-[#1F1F1F]">
                  <td className="px-4 py-2 text-white font-medium flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    {r.variedad}
                  </td>
                  <td className="px-4 py-2 text-right text-white">{Number(r.total_kg).toLocaleString('es-MX', { maximumFractionDigits: 1 })}</td>
                  <td className="px-4 py-2 text-right text-[#ccc]">{r.num_sectores}</td>
                  <td className="px-4 py-2 text-right text-[#A3A3A3]">{Number(r.promedio_kg_sector).toFixed(1)}</td>
                  <td className="px-4 py-2 text-right text-blue-400">{((Number(r.total_kg) / totalKg) * 100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
