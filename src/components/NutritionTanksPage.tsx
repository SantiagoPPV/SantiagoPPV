import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import TankVisualizer from '../components/TankVisualizer';
import { Toaster, toast } from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';

// Create Supabase client using .env vars
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const tanksConfig = [
  { id: 1, name: 'Tanque 1', nutrient: 'Biloxi', capacity: 2500, product: 'Sulfatos\nFosfatos\nNitratos\nMicros' },
  { id: 2, name: 'Tanque 2', nutrient: 'Biloxi', capacity: 2500, product: 'Nitrato de calcio\nNitrato de magnesio' },
  { id: 3, name: 'Tanque 3', nutrient: 'AZRA 4s', capacity: 2500, product: 'Sulfatos\nFosfatos\nNitratos\nMicros' },
  { id: 4, name: 'Tanque 4', nutrient: 'AZRA 4s', capacity: 2500, product: 'Nitrato de calcio\nNitrato de magnesio' },
  { id: 5, name: 'Tanque 5', nutrient: 'AZRA 3s y 5s', capacity: 2500, product: 'Sulfatos\nFosfatos\nNitratos\nMicros' },
  { id: 6, name: 'Tanque 6', nutrient: 'AZRA 3s y 5s', capacity: 2500, product: 'Nitrato de calcio\nNitrato de magnesio' },
  { id: 7, name: 'Tanque 7', nutrient: 'AZRA 6s y 7s', capacity: 2500, product: 'Sulfatos\nFosfatos\nNitratos\nMicros' },
  { id: 8, name: 'Tanque 8', nutrient: 'AZRA 6s y 7s', capacity: 2500, product: 'Nitrato de calcio\nNitrato de magnesio' },
  { id: 9, name: 'Ácido', nutrient: '', capacity: 1000, product: '' }, // No product
];

const getISOWeek = (date: Date) => {
  const tempDate = new Date(date);
  tempDate.setDate(tempDate.getDate() + 3 - (tempDate.getDay() + 6) % 7);
  const week1 = new Date(tempDate.getFullYear(), 0, 4);
  return 1 + Math.round(((tempDate.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
};

const NutritionTanksPage = () => {
  const { session } = useAuth();
  const [tankLevels, setTankLevels] = useState<{ [key: number]: number }>({});
  const [tankDates, setTankDates] = useState<{ [key: number]: string }>({});
  const [newLevels, setNewLevels] = useState<{ [key: number]: number }>({});
  const [loading, setLoading] = useState(true);
  const [showBitacora, setShowBitacora] = useState(false);
  const [bitacoraData, setBitacoraData] = useState<any[]>([]);

  useEffect(() => {
    if (session) {
      supabase.auth.setSession(session);
    }
    fetchLatestLevels();
  }, [session]);

  const fetchLatestLevels = async () => {
    try {
      const { data, error } = await supabase
        .from('TanquesNutricion')
        .select('*')
        .order('Timestamp', { ascending: false })
        .range(0, 9999);

      if (error) {
        throw error;
      }

      const levelsMap: { [key: number]: number } = {};
      const datesMap: { [key: number]: string } = {};
      const seenTanks = new Set<number>();
      data.forEach((row) => {
        const tankId = parseInt(row.Tanque);
        if (!seenTanks.has(tankId)) {
          levelsMap[tankId] = row.Nivel || 0;
          datesMap[tankId] = row.Fecha || 'Sin fecha';
          seenTanks.add(tankId);
        }
      });
      setTankLevels(levelsMap);
      setTankDates(datesMap);
    } catch (err) {
      console.error('Error fetching levels:', err);
      toast.error('Error al cargar niveles de tanques');
    } finally {
      setLoading(false);
    }
  };

  const fetchBitacora = async () => {
    try {
      const { data, error } = await supabase
        .from('TanquesNutricion')
        .select('*')
        .eq('Llenado', true) // Only fetch where Llenado is TRUE
        .order('Fecha', { ascending: false })
        .range(0, 9999);

      if (error) {
        throw error;
      }

      setBitacoraData(data);
    } catch (err) {
      console.error('Error fetching bitacora:', err);
      toast.error('Error al cargar bitácora');
    }
  };

  const handleInputChange = (tankId: number, value: string) => {
    let percentage = parseFloat(value);
    if (isNaN(percentage)) {
      percentage = 0;
    }
    percentage = Math.max(0, Math.min(100, percentage));
    setNewLevels((prev) => ({ ...prev, [tankId]: percentage }));
  };

  const submitDailyLevels = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const todayDate = new Date(today);
      const weekNumber = getISOWeek(todayDate);
      const timestamp = new Date().toISOString();
      const inserts = Object.entries(newLevels).map(([tankId, level]) => ({
        Semana: weekNumber,
        Fecha: today,
        Tanque: tankId.toString(), // Store as text to match column
        Nivel: level, // Store as percentage
        Llenado: level === 100 ? true : false, // Set Llenado based on level
        Timestamp: timestamp,
      }));

      const { error } = await supabase.from('TanquesNutricion').insert(inserts);

      if (error) {
        throw error;
      }

      toast.success('Niveles actualizados');
      fetchLatestLevels();
      setNewLevels({});
    } catch (err) {
      console.error('Error saving levels:', err);
      toast.error('Error al guardar niveles');
    }
  };

  if (loading) return <div>Cargando...</div>;

  // Process bitacoraData for the new table format
  const uniqueDates = [...new Set(bitacoraData.map(entry => entry.Fecha))].sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  const bitacoraTable = uniqueDates.map(date => {
    const row: { [key: string]: string } = { Fecha: date };
    bitacoraData
      .filter(entry => entry.Fecha === date)
      .forEach(entry => {
        const tankId = parseInt(entry.Tanque);
        const tankName = tanksConfig.find(t => t.id === tankId)?.name || `Tanque ${tankId}`;
        row[tankName] = 'X';
      });
    return row;
  });

  return (
    <div className="p-8 bg-gray-900 text-white overflow-hidden">
      <Toaster />
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl">Tanques de Nutrición</h1>
        <button
          onClick={() => {
            fetchBitacora();
            setShowBitacora(true);
          }}
          className="bg-green-500 px-4 py-2 rounded text-white"
        >
          Bitacora llenado
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 overflow-hidden">
        {tanksConfig.map((tank) => {
          const percentage = tankLevels[tank.id] || 0;
          const lastDate = tankDates[tank.id] || 'Sin fecha';
          const productLines = tank.product.split('\n');
          return (
            <div key={tank.id} className="bg-gray-800 p-4 rounded-lg flex flex-col">
              <h2 className="text-xl mb-4">
                {tank.name} {tank.nutrient ? `(${tank.nutrient})` : ''}
              </h2>
              <div className="flex">
                <div className="flex-1">
                  <TankVisualizer
                    level={percentage}
                    capacity={tank.capacity}
                    tankId={tank.id}
                  />
                </div>
                <div className="flex-1 pl-4">
                  <p className="text-sm text-gray-400 mb-2">Último registro: {lastDate}</p>
                  {productLines.map((line, index) => (
                    <p key={index} className="text-sm">{line}</p>
                  ))}
                </div>
              </div>
              <input
                type="number"
                min="0"
                max="100"
                value={newLevels[tank.id] || ''}
                placeholder="Porcentaje restante"
                className="mt-4 p-2 bg-gray-700 text-white rounded w-full"
                onChange={(e) => handleInputChange(tank.id, e.target.value)}
                onWheel={(e) => e.currentTarget.blur()} // Prevent scroll change
              />
            </div>
          );
        })}
      </div>
      <button
        onClick={submitDailyLevels}
        className="mt-8 bg-blue-500 px-6 py-2 rounded"
      >
        Guardar Niveles Diarios
      </button>

      {/* Popup for Bitacora */}
      {showBitacora && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg w-[95vw] h-[90vh] overflow-auto">
            <h2 className="text-2xl mb-4">Bitácora de Llenado</h2>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-700">
                  <th className="p-2 border-b">Fecha</th>
                  <th className="p-2 border-b">Tanque 1</th>
                  <th className="p-2 border-b">Tanque 2</th>
                  <th className="p-2 border-b">Tanque 3</th>
                  <th className="p-2 border-b">Tanque 4</th>
                  <th className="p-2 border-b">Tanque 5</th>
                  <th className="p-2 border-b">Tanque 6</th>
                  <th className="p-2 border-b">Tanque 7</th>
                  <th className="p-2 border-b">Tanque 8</th>
                  <th className="p-2 border-b">Ácido</th>
                </tr>
              </thead>
              <tbody>
                {bitacoraTable.map((row, index) => (
                  <tr key={index} className="hover:bg-gray-700">
                    <td className="p-2 border-b">{row.Fecha}</td>
                    <td className="p-2 border-b text-center">{row['Tanque 1'] || ''}</td>
                    <td className="p-2 border-b text-center">{row['Tanque 2'] || ''}</td>
                    <td className="p-2 border-b text-center">{row['Tanque 3'] || ''}</td>
                    <td className="p-2 border-b text-center">{row['Tanque 4'] || ''}</td>
                    <td className="p-2 border-b text-center">{row['Tanque 5'] || ''}</td>
                    <td className="p-2 border-b text-center">{row['Tanque 6'] || ''}</td>
                    <td className="p-2 border-b text-center">{row['Tanque 7'] || ''}</td>
                    <td className="p-2 border-b text-center">{row['Tanque 8'] || ''}</td>
                    <td className="p-2 border-b text-center">{row['Ácido'] || ''}</td>
                  </tr>
                ))}
                {bitacoraTable.length === 0 && (
                  <tr>
                    <td colSpan={10} className="p-2 text-center">No hay registros de llenado</td>
                  </tr>
                )}
              </tbody>
            </table>
            <button
              onClick={() => setShowBitacora(false)}
              className="mt-4 bg-red-500 px-4 py-2 rounded"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NutritionTanksPage;