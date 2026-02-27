import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface MermaRow {
  sector: string;
  tipo_merma: string;
  total_kg: number;
  porcentaje_del_sector: number;
}

interface Props {
  data: MermaRow[];
}

const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#8b5cf6', '#ec4899', '#64748b', '#14b8a6', '#f43f5e', '#a855f7'];

export default function ReporteMerma({ data }: Props) {
  if (data.length === 0) {
    return <p className="text-[#666] text-center py-10">Sin datos de merma para el rango seleccionado.</p>;
  }

  // Agrupar por tipo para gráfica global
  const porTipo: Record<string, number> = {};
  data.forEach((r) => { porTipo[r.tipo_merma] = (porTipo[r.tipo_merma] || 0) + r.total_kg; });
  const chartData = Object.entries(porTipo)
    .map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }))
    .sort((a, b) => b.value - a.value);

  const totalMerma = chartData.reduce((s, c) => s + c.value, 0);

  // Agrupar por sector para tabla
  const sectores = [...new Set(data.map((d) => d.sector))].sort();

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[#1A1A1A] rounded-xl p-4 border border-[#2A2A2A] text-center">
          <p className="text-xs text-[#888]">Total Merma</p>
          <p className="text-xl font-bold text-red-400">{totalMerma.toLocaleString('es-MX', { maximumFractionDigits: 1 })} kg</p>
        </div>
        <div className="bg-[#1A1A1A] rounded-xl p-4 border border-[#2A2A2A] text-center">
          <p className="text-xs text-[#888]">Tipo Principal</p>
          <p className="text-xl font-bold text-amber-400">{chartData[0]?.name || '—'}</p>
        </div>
        <div className="bg-[#1A1A1A] rounded-xl p-4 border border-[#2A2A2A] text-center">
          <p className="text-xs text-[#888]">Sectores Afectados</p>
          <p className="text-xl font-bold text-blue-400">{sectores.length}</p>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-[#1A1A1A] rounded-xl p-4 border border-[#2A2A2A]">
        <h3 className="text-sm font-medium text-white mb-3">Merma por Tipo (kg)</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 120 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
            <XAxis type="number" tick={{ fill: '#888', fontSize: 12 }} />
            <YAxis dataKey="name" type="category" tick={{ fill: '#ccc', fontSize: 11 }} width={110} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1A1A1A', border: '1px solid #333', borderRadius: 8 }}
              labelStyle={{ color: '#fff' }}
              formatter={(v: number) => [`${v} kg`, 'Merma']}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {chartData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Tabla por sector */}
      <div className="bg-[#1A1A1A] rounded-xl border border-[#2A2A2A] overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#2A2A2A] text-[#888]">
              <th className="px-4 py-3 text-left">Sector</th>
              <th className="px-4 py-3 text-left">Tipo Merma</th>
              <th className="px-4 py-3 text-right">Kg</th>
              <th className="px-4 py-3 text-right">% del Sector</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i} className="border-b border-[#1F1F1F] hover:bg-[#1F1F1F]">
                <td className="px-4 py-2 text-white font-medium">{row.sector}</td>
                <td className="px-4 py-2 text-[#ccc]">{row.tipo_merma}</td>
                <td className="px-4 py-2 text-right text-white">{Number(row.total_kg).toFixed(2)}</td>
                <td className="px-4 py-2 text-right text-[#A3A3A3]">{row.porcentaje_del_sector}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
