import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface Row {
  cosechador_id: string;
  cosechador_nombre: string;
  total_cubetas: number;
  total_kg: number;
  dias_trabajados: number;
}

interface Props {
  data: Row[];
}

export default function ReporteKgCosechador({ data }: Props) {
  if (data.length === 0) {
    return <p className="text-[#666] text-center py-10">Sin datos de cosechadores para el rango seleccionado.</p>;
  }

  const totalKg = data.reduce((s, r) => s + Number(r.total_kg), 0);
  const totalCubetas = data.reduce((s, r) => s + Number(r.total_cubetas), 0);

  const chartData = data.slice(0, 20).map((r) => ({
    name: r.cosechador_nombre.length > 15 ? r.cosechador_nombre.slice(0, 15) + '…' : r.cosechador_nombre,
    kg: Number(Number(r.total_kg).toFixed(1)),
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[#1A1A1A] rounded-xl p-4 border border-[#2A2A2A] text-center">
          <p className="text-xs text-[#888]">Total Kg</p>
          <p className="text-xl font-bold text-blue-400">{totalKg.toLocaleString('es-MX', { maximumFractionDigits: 1 })}</p>
        </div>
        <div className="bg-[#1A1A1A] rounded-xl p-4 border border-[#2A2A2A] text-center">
          <p className="text-xs text-[#888]">Total Cubetas</p>
          <p className="text-xl font-bold text-emerald-400">{totalCubetas.toLocaleString()}</p>
        </div>
        <div className="bg-[#1A1A1A] rounded-xl p-4 border border-[#2A2A2A] text-center">
          <p className="text-xs text-[#888]">Cosechadores</p>
          <p className="text-xl font-bold text-purple-400">{data.length}</p>
        </div>
      </div>

      {/* Chart top 20 */}
      <div className="bg-[#1A1A1A] rounded-xl p-4 border border-[#2A2A2A]">
        <h3 className="text-sm font-medium text-white mb-3">Top Cosechadores (kg)</h3>
        <ResponsiveContainer width="100%" height={Math.max(300, chartData.length * 30)}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 110 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
            <XAxis type="number" tick={{ fill: '#888', fontSize: 12 }} />
            <YAxis dataKey="name" type="category" tick={{ fill: '#ccc', fontSize: 11 }} width={100} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1A1A1A', border: '1px solid #333', borderRadius: 8 }}
              formatter={(v: number) => [`${v} kg`, 'Producción']}
            />
            <Bar dataKey="kg" fill="#3b82f6" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Table */}
      <div className="bg-[#1A1A1A] rounded-xl border border-[#2A2A2A] overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#2A2A2A] text-[#888]">
              <th className="px-4 py-3 text-left">#</th>
              <th className="px-4 py-3 text-left">Cosechador</th>
              <th className="px-4 py-3 text-right">Cubetas</th>
              <th className="px-4 py-3 text-right">Kg</th>
              <th className="px-4 py-3 text-right">Días</th>
              <th className="px-4 py-3 text-right">Kg/Día</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r, i) => (
              <tr key={r.cosechador_id} className="border-b border-[#1F1F1F] hover:bg-[#1F1F1F]">
                <td className="px-4 py-2 text-[#666]">{i + 1}</td>
                <td className="px-4 py-2 text-white font-medium">{r.cosechador_nombre}</td>
                <td className="px-4 py-2 text-right text-[#ccc]">{Number(r.total_cubetas).toLocaleString()}</td>
                <td className="px-4 py-2 text-right text-white">{Number(r.total_kg).toLocaleString('es-MX', { maximumFractionDigits: 1 })}</td>
                <td className="px-4 py-2 text-right text-[#A3A3A3]">{r.dias_trabajados}</td>
                <td className="px-4 py-2 text-right text-blue-400">
                  {r.dias_trabajados > 0 ? (Number(r.total_kg) / Number(r.dias_trabajados)).toFixed(1) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
