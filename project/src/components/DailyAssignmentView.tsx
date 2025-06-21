import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { CalendarDays, Loader } from 'lucide-react';
import dayjs from 'dayjs';
import 'dayjs/locale/es';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
);

const TABLE_ASSIGNMENTS = 'PlanAsignaciones';
const TABLE_PERSONAL = 'Personal Moray';

interface Assignment {
  id: number;
  Fecha: string;
  Nombre: string;
  Labor: string;
}

interface Personal {
  ID: number;
  Nombre: string;
  Labor: string | null;
  Estado: boolean; // true = activo, false = baja
}

export default function DailyAssignmentView() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [personnel, setPersonnel] = useState<Personal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [startDate, setStartDate] = useState(dayjs().subtract(2, 'day'));
  const [endDate, setEndDate] = useState(dayjs().add(4, 'day'));
  const [openCells, setOpenCells] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchData();
  }, [startDate, endDate]);

  const fetchData = async () => {
    setIsLoading(true);
    try {  
      const { data: people, error: errPeople } = await supabase
        .from(TABLE_PERSONAL)
        .select('ID,Nombre,Labor,Estado');

      const { data: plan, error: errPlan } = await supabase
  .from('PlanAsignaciones')
  .select('*')
  .gte('Fecha', startDate.format('YYYY-MM-DD'))
  .lte('Fecha', endDate.format('YYYY-MM-DD'));

      if (errPeople || errPlan) throw errPeople || errPlan;

      setPersonnel(people || []);
      setAssignments(plan || []);
    } catch (error) {
      console.error('Error al cargar datos:', error);
    } finally {
      setIsLoading(false);
    }
  };

  function groupByLabor(): Record<string, string[]> {
    const grouped: Record<string, string[]> = {};
    for (const { Labor } of assignments) {
      const labor = Labor || 'Sin Labor';
      if (!grouped[labor]) grouped[labor] = [];
    }
    return grouped;
  }

  function getCellKey(labor: string, date: string) {
    return `${labor}__${date}`;
  }

  function toggleCell(labor: string, date: string) {
    const key = getCellKey(labor, date);
    setOpenCells(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  }

  function isCellOpen(labor: string, date: string) {
    return openCells[getCellKey(labor, date)];
  }

  const dateRange = [...Array(endDate.diff(startDate, 'day') + 1)].map((_, i) =>
    startDate.add(i, 'day').format('YYYY-MM-DD')
  );

 const laborCountsByDate = assignments.reduce((acc, curr) => {
  const labor = curr.Labor || 'Sin Labor';
  const date = dayjs(curr.Fecha).format('YYYY-MM-DD');
  acc[labor] ||= {};
  acc[labor][date] ||= 0;
  acc[labor][date] += 1;
  return acc;
}, {} as Record<string, Record<string, number>>);

const sortedLaborCounts = Object.entries(laborCountsByDate).sort(([a], [b]) =>
  a.localeCompare(b, 'es', { sensitivity: 'base' })
);

  const getEstado = (nombre: string): boolean =>
    personnel.find(p => p.Nombre === nombre)?.Estado ?? true;

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
        <CalendarDays className="w-5 h-5 text-blue-500" />
        Vista de Asignaciones por Día
      </h2>

      {isLoading ? (
        <div className="text-center text-gray-400 flex items-center justify-center gap-2">
          <Loader className="animate-spin w-5 h-5" />
          Cargando asignaciones...
        </div>
      ) : (
        <div className="overflow-x-auto border border-gray-700 rounded-lg">
          <table className="min-w-full table-auto border-collapse text-sm">
            <thead className="bg-[#1A1A1A] text-white sticky top-0 z-10">
              <tr>
                <th className="border border-gray-700 px-4 py-2 text-left">Labor</th>
                {dateRange.map(date => (
                  <th key={date} className="border border-gray-700 px-4 py-2 text-center">
                    {dayjs(date).format('DD/MM')}
                  </th>
                ))}
              </tr>
            </thead>
           <tbody>
  {sortedLaborCounts.map(([labor, fechas]) => (
    <tr key={labor}>
      <td className="border border-gray-700 px-4 py-2 font-semibold text-white sticky left-0 bg-[#0D0D0D] z-10">
        {labor}
      </td>
      {dateRange.map(date => {
        const count = fechas[date] || 0;

        return (
          <td key={`${labor}-${date}`} className="border border-gray-700 px-2 py-2 text-center text-white">
            {count > 0 ? (
              <span className="text-sm font-medium">{count}</span>
            ) : (
              <span className="text-gray-500">—</span>
            )}
          </td>
        );
      })}
    </tr>
  ))}
</tbody>
          </table>
        </div>
      )}
    </div>
  );
}