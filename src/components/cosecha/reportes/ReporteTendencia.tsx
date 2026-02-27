import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface Row {
  semana: number;
  anio: number;
  fecha_inicio: string;
  total_kg: number;
  total_merma_kg: number;
  porcentaje_merma: number;
}

interface Props { data: Row[]; }

export default function ReporteTendencia({ data }: Props) {
  if (data.length === 0) return <p className="text-[#666] text-center py-10">Sin datos de tendencia.</p>;

  const chartData = data.map((r) => ({
    label: `S${r.semana}`,
    kg: Number(Number(r.total_kg).toFixed(1)),
    merma: Number(Number(r.total_merma_kg).toFixed(1)),
    pctMerma: Number(r.porcentaje_merma),
  }));

  return (
    <div className="space-y-6">
      {/* Producción vs Merma */}
      <div className="bg-[#1A1A1A] rounded-xl p-4 border border-[#2A2A2A]">
        <h3 className="text-sm font-medium text-white mb-3">Producción y Merma por Semana (kg)</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
            <XAxis dataKey="label" tick={{ fill: '#ccc', fontSize: 12 }} />
            <YAxis tick={{ fill: '#888', fontSize: 12 }} />
            <Tooltip contentStyle={{ backgroundColor: '#1A1A1A', border: '1px solid #333', borderRadius: 8 }} />
            <Legend />
            <Line type="monotone" dataKey="kg" stroke="#3b82f6" strokeWidth={2} name="Kg Cosechados" dot={{ r: 3 }} />
            <Line type="monotone" dataKey="merma" stroke="#ef4444" strokeWidth={2} name="Kg Merma" dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* % Merma */}
      <div className="bg-[#1A1A1A] rounded-xl p-4 border border-[#2A2A2A]">
        <h3 className="text-sm font-medium text-white mb-3">% Merma por Semana</h3>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
            <XAxis dataKey="label" tick={{ fill: '#ccc', fontSize: 12 }} />
            <YAxis tick={{ fill: '#888', fontSize: 12 }} unit="%" />
            <Tooltip contentStyle={{ backgroundColor: '#1A1A1A', border: '1px solid #333', borderRadius: 8 }} formatter={(v: number) => [`${v}%`]} />
            <Line type="monotone" dataKey="pctMerma" stroke="#eab308" strokeWidth={2} name="% Merma" dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Table */}
      <div className="bg-[#1A1A1A] rounded-xl border border-[#2A2A2A] overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#2A2A2A] text-[#888]">
              <th className="px-4 py-3 text-left">Semana</th>
              <th className="px-4 py-3 text-left">Inicio</th>
              <th className="px-4 py-3 text-right">Kg Cosechados</th>
              <th className="px-4 py-3 text-right">Kg Merma</th>
              <th className="px-4 py-3 text-right">% Merma</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r, i) => (
              <tr key={i} className="border-b border-[#1F1F1F] hover:bg-[#1F1F1F]">
                <td className="px-4 py-2 text-white font-medium">S{r.semana} / {r.anio}</td>
                <td className="px-4 py-2 text-[#A3A3A3]">{r.fecha_inicio}</td>
                <td className="px-4 py-2 text-right text-white">{Number(r.total_kg).toLocaleString('es-MX', { maximumFractionDigits: 1 })}</td>
                <td className="px-4 py-2 text-right text-red-400">{Number(r.total_merma_kg).toLocaleString('es-MX', { maximumFractionDigits: 1 })}</td>
                <td className="px-4 py-2 text-right text-amber-400">{r.porcentaje_merma ?? 0}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
