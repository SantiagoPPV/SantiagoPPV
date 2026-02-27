// ✅ CÓDIGO COMPLETO ACTUALIZADO PARA GUARDAR LABOR SECUNDARIA EN AMBAS TABLAS

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
  Area: string;
  Estado: boolean;
}

const AREA_ORDER = ['Administracion', 'FUMIGACION', 'RIEGO', 'SUPERVISOR', 'LABORES'];

function getColorPalette(): string[] {
  return [
    '#FFB6C1', '#FFD700', '#90EE90', '#87CEFA', '#DDA0DD',
    '#FFA07A', '#20B2AA', '#FF69B4', '#A0522D', '#00CED1',
    '#F4A460', '#00FA9A', '#8A2BE2', '#7FFFD4', '#DC143C',
    '#FF7F50', '#9ACD32', '#40E0D0', '#BA55D3', '#FF6347',
  ];
}

export default function DailyAssignmentView() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [personnel, setPersonnel] = useState<Personal[]>([]);
  const [laborColors, setLaborColors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [startDate, setStartDate] = useState(dayjs().subtract(2, 'day'));
  const [endDate, setEndDate] = useState(dayjs().add(4, 'day'));

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data: people } = await supabase
        .from(TABLE_PERSONAL)
        .select('ID,Nombre,Area,Estado')
        .eq('Estado', true)
        .range(0, 9999);

      const { data: plan } = await supabase
        .from(TABLE_ASSIGNMENTS)
        .select('*')
        .gte('Fecha', startDate.format('YYYY-MM-DD'))
        .lte('Fecha', endDate.format('YYYY-MM-DD'))
        .range(0, 9999);

      setPersonnel(people || []);
      setAssignments(plan || []);

      const seen = new Set<string>();
      const uniqueLabors = plan?.flatMap(a => {
        const labores = a.Labor
          ? a.Labor.split(',').map(l => l.trim()).filter(l => l.length > 0)
          : ['Sin labor'];
        return labores.filter(l => {
          if (seen.has(l)) return false;
          seen.add(l);
          return true;
        });
      }) || [];

      const palette = getColorPalette();
      const colorMap: Record<string, string> = {};
      uniqueLabors.forEach((labor, index) => {
        colorMap[labor] = palette[index % palette.length];
      });
      setLaborColors(colorMap);
    } catch (error) {
      console.error('Error al cargar datos:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [startDate, endDate]);

  const handleAddSecondaryLabor = async (nombre: string, nuevaLabor: string) => {
    const hoy = dayjs().format('YYYY-MM-DD');

    // Insertar en PlanAsignaciones
    const { error: assignmentError } = await supabase.from(TABLE_ASSIGNMENTS).insert({
      Fecha: hoy,
      Nombre: nombre,
      Labor: nuevaLabor
    });

    // Insertar en Personal Moray (opcional si requiere actualización adicional)
    const { error: personalError } = await supabase.from(TABLE_PERSONAL).update({
      Labor: nuevaLabor
    }).eq('Nombre', nombre);

    if (assignmentError || personalError) {
      console.error('Error al guardar labor secundaria:', assignmentError || personalError);
    } else {
      fetchData();
    }
  };

  const dateRange = [...Array(endDate.diff(startDate, 'day') + 1)].map((_, i) =>
    startDate.add(i, 'day').format('YYYY-MM-DD')
  );

  const assignmentMap: Record<string, Record<string, string[]>> = {};
  personnel.forEach((p) => {
    assignmentMap[p.Nombre] = {};
    dateRange.forEach((date) => {
      assignmentMap[p.Nombre][date] = [];
    });
  });
  assignments.forEach((a) => {
    const date = dayjs(a.Fecha).format('YYYY-MM-DD');
    const labores = a.Labor
      ? [...new Set(
          a.Labor.split(',').map(l => l.trim()).filter(l => l.length > 0)
        )]
      : ['Sin labor'];
    labores.forEach(lab => {
      if (!assignmentMap[a.Nombre]) assignmentMap[a.Nombre] = {};
      if (!assignmentMap[a.Nombre][date]) assignmentMap[a.Nombre][date] = [];
      assignmentMap[a.Nombre][date].push(lab);
    });
  });

  const groupedByArea: Record<string, Personal[]> = {};
  AREA_ORDER.forEach(area => groupedByArea[area] = []);
  personnel.forEach(p => {
    const area = p.Area?.toUpperCase() || 'OTRO';
    const normalized = AREA_ORDER.includes(area) ? area : 'OTRO';
    if (!groupedByArea[normalized]) groupedByArea[normalized] = [];
    groupedByArea[normalized].push(p);
  });

  const renderTableSection = (area: string, people: Personal[]) => {
    const sortedPeople = [...people].sort((a, b) =>
      a.Nombre.localeCompare(b.Nombre, 'es', { sensitivity: 'base' })
    );

    return (
      <div key={area} className="mb-8">
        <h3 className="text-xl font-semibold text-white mb-2 mt-4">
          {area.charAt(0).toUpperCase() + area.slice(1).toLowerCase()}
        </h3>
        <div className="overflow-x-auto border border-gray-700 rounded-lg">
          <table className="min-w-full table-auto border-collapse text-sm">
            <thead className="bg-[#1A1A1A] text-white sticky top-0 z-10">
              <tr>
                <th className="border border-gray-700 px-4 py-2 text-left sticky left-0 bg-[#1A1A1A] z-20">
                  Personal
                </th>
                {dateRange.map(date => (
                  <th key={date} className="border border-gray-700 px-4 py-2 text-center">
                    {dayjs(date).format('DD/MM')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedPeople.map(({ Nombre }) => (
                <tr key={Nombre}>
                  <td className="border border-gray-700 px-4 py-2 font-medium text-white sticky left-0 bg-[#0D0D0D] z-10 whitespace-nowrap">
                    {Nombre}
                  </td>
                  {dateRange.map(date => {
                    const labores = [...new Set(assignmentMap[Nombre]?.[date] || [])].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
                    return (
                      <td
                        key={`${Nombre}-${date}`}
                        className="border border-gray-700 px-1 py-1 text-center text-white max-w-[200px]"
                      >
                        {labores.length > 0 ? (
                          <div className="flex flex-col gap-1 items-center">
                            {labores.map((labor, i) => (
                              <span
                                key={i}
                                className="px-2 py-1 rounded text-xs font-semibold text-black"
                                style={{ backgroundColor: laborColors[labor] || '#ccc' }}
                              >
                                {labor}
                              </span>
                            ))}
                          </div>
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
      </div>
    );
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'start' | 'end') => {
    const selected = dayjs(e.target.value);
    if (type === 'start') {
      if (endDate.diff(selected, 'day') > 7) {
        setEndDate(selected.add(7, 'day'));
      }
      setStartDate(selected);
    } else {
      if (selected.diff(startDate, 'day') > 7) {
        setStartDate(selected.subtract(7, 'day'));
      }
      setEndDate(selected);
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
        <CalendarDays className="w-5 h-5 text-blue-500" /> Vista de Asignaciones por Día
      </h2>

      <div className="flex gap-4 items-center mb-6">
        <div>
          <label className="block text-white text-sm mb-1">Fecha de inicio:</label>
          <input
            type="date"
            className="px-2 py-1 rounded bg-gray-800 text-white border border-gray-600"
            value={startDate.format('YYYY-MM-DD')}
            onChange={(e) => handleDateChange(e, 'start')}
          />
        </div>
        <div>
          <label className="block text-white text-sm mb-1">Fecha de fin:</label>
          <input
            type="date"
            className="px-2 py-1 rounded bg-gray-800 text-white border border-gray-600"
            value={endDate.format('YYYY-MM-DD')}
            onChange={(e) => handleDateChange(e, 'end')}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="text-center text-gray-400 flex items-center justify-center gap-2">
          <Loader className="animate-spin w-5 h-5" /> Cargando asignaciones...
        </div>
      ) : (
        <div>
          {AREA_ORDER.map(area =>
            groupedByArea[area]?.length > 0 ? renderTableSection(area, groupedByArea[area]) : null
          )}
        </div>
      )}
    </div>
  );
}