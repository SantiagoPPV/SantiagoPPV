import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { getISOWeek } from 'date-fns';
import { Filter } from 'lucide-react';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

interface SamplingData {
  Fecha: string;
  Plaga: string;
  Sector: string;
  Tunel: number;
  Cantidad: number;
}

export default function Reports() {
  const [data, setData] = useState<SamplingData[]>([]);
  const [filters, setFilters] = useState({
    pest: '',
    week: '',
    sector: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const { data: nutrientData, error } = await supabase
      .from('Muestreos Nutricion')
      .select('*');

    if (error) {
      console.error('Error fetching data:', error);
      return;
    }

    const processedData = nutrientData.map(row => ({
      ...row,
      week: getISOWeek(new Date(row.Fecha))
    }));

    setData(processedData);
  }

  const filteredData = data.filter(row => {
    const rowWeek = getISOWeek(new Date(row.Fecha));
    return (
      (!filters.pest || row.Plaga === filters.pest) &&
      (!filters.week || rowWeek === parseInt(filters.week)) &&
      (!filters.sector || row.Sector === filters.sector)
    );
  });

  const uniqueValues = {
    pests: [...new Set(data.map(row => row.Plaga))],
    weeks: [...new Set(data.map(row => getISOWeek(new Date(row.Fecha))))],
    sectors: [...new Set(data.map(row => row.Sector))]
  };

  return (
    <div className="min-h-screen bg-[#0D0D0D] text-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">Reportes de Muestreo</h2>
          <p className="text-[#A3A3A3]">Análisis de datos de muestreos</p>
        </div>

        <div className="bg-[#1F1F1F] rounded-xl p-6 mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-5 h-5 text-[#3B82F6]" />
            <h3 className="text-xl font-semibold">Filtros</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <select
              value={filters.pest}
              onChange={(e) => setFilters({ ...filters, pest: e.target.value })}
              className="bg-[#0D0D0D] border border-[#2A2A2A] rounded-lg px-4 py-2 text-white"
            >
              <option value="">Todas las Plagas</option>
              {uniqueValues.pests.map(pest => (
                <option key={pest} value={pest}>{pest}</option>
              ))}
            </select>

            <select
              value={filters.week}
              onChange={(e) => setFilters({ ...filters, week: e.target.value })}
              className="bg-[#0D0D0D] border border-[#2A2A2A] rounded-lg px-4 py-2 text-white"
            >
              <option value="">Todas las Semanas</option>
              {uniqueValues.weeks.map(week => (
                <option key={week} value={week}>Semana {week}</option>
              ))}
            </select>

            <select
              value={filters.sector}
              onChange={(e) => setFilters({ ...filters, sector: e.target.value })}
              className="bg-[#0D0D0D] border border-[#2A2A2A] rounded-lg px-4 py-2 text-white"
            >
              <option value="">Todos los Sectores</option>
              {uniqueValues.sectors.map(sector => (
                <option key={sector} value={sector}>{sector}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="bg-[#1F1F1F] rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-[#2A2A2A]">
              <tr>
                <th className="px-6 py-4 text-left">Plaga</th>
                <th className="px-6 py-4 text-left">Fecha</th>
                <th className="px-6 py-4 text-left">Semana</th>
                <th className="px-6 py-4 text-left">Sector</th>
                <th className="px-6 py-4 text-left">Túnel</th>
                <th className="px-6 py-4 text-left">Cantidad</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2A2A2A]">
              {filteredData.map((row, index) => (
                <tr key={index} className="hover:bg-[#2A2A2A]">
                  <td className="px-6 py-4">{row.Plaga}</td>
                  <td className="px-6 py-4">{new Date(row.Fecha).toLocaleDateString()}</td>
                  <td className="px-6 py-4">{getISOWeek(new Date(row.Fecha))}</td>
                  <td className="px-6 py-4">{row.Sector}</td>
                  <td className="px-6 py-4">{row.Tunel}</td>
                  <td className="px-6 py-4">{row.Cantidad}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}