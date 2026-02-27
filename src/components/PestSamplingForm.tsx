import React, { useState, useEffect } from 'react';
import { Plus, Minus, Save, Loader2 } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import toast from 'react-hot-toast';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const SECTOR_TUNNELS = {
  '1A': [1, 16], '1B': [1, 19], '1C': [1, 20], '1D': [1, 19], '1E': [1, 16],
  '2A': [1, 20], '2B': [1, 20], '2C': [1, 20], '2D': [1, 22], '2E': [1, 26],
  '3A': [1, 25], '3B': [1, 20], '3C': [1, 20],
  '4A': [1, 23], '4B': [1, 20], '4C': [1, 20],
  '5A': [1, 22], '5B': [1, 20], '5C': [1, 20],
  '6A': [1, 29], '6B': [15, 28], '6C': [1, 38], '6D': [1, 37],
  '7A': [1, 14], '7B': [1, 29], '7C': [1, 35], '7D': [1, 25], '7E': [1, 19],
  '8A': [1, 25], '8B': [1, 23], '8C': [1, 24], '8D': [1, 20], '8E': [1, 17], '8F': [1, 23],
};

const PEST_OPTIONS = [
  'Trips',
  'Gusano Soldado',
  'Chinche Lygus',
  'Corynespora',
  'Botritis',
  'Roya'
];

interface SamplingEntry {
  Fecha: string;
  Tunel: string;
  Cantidad: string;
}

export default function PestSamplingForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [globalDate, setGlobalDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedPest, setSelectedPest] = useState('');
  const [selectedSector, setSelectedSector] = useState('');
  const [entries, setEntries] = useState<SamplingEntry[]>([{
    Fecha: globalDate,
    Tunel: '',
    Cantidad: ''
  }]);

  // ✅ Nuevo estado para guardar los datos completos
  const [pestData, setPestData] = useState<any[]>([]);

  // ✅ Nueva función para traer todos los registros
  const fetchAllPestData = async () => {
    try {
      const { data, error } = await supabase
        .from('Muestreo Plagas y Enfermedades')
        .select('*')
        .range(0, 9999);

      if (error) throw error;

      setPestData(data); // Guardamos los datos
      console.log('📦 Datos de plagas y enfermedades:', data); // Solo para depuración
    } catch (error) {
      console.error('❌ Error al obtener los datos:', error);
      toast.error('Error al cargar los registros de plagas');
    }
  };

  // ✅ useEffect para ejecutar automáticamente al abrir el formulario
  useEffect(() => {
    fetchAllPestData();
  }, []);

  const addEntry = () => {
    setEntries([...entries, { Fecha: globalDate, Tunel: '', Cantidad: '' }]);
  };

  const removeEntry = (index: number) => {
    if (entries.length > 1) {
      const newEntries = entries.filter((_, i) => i !== index);
      setEntries(newEntries);
    }
  };

  const updateEntry = (index: number, field: keyof SamplingEntry, value: string) => {
    const newEntries = [...entries];
    newEntries[index] = { ...newEntries[index], [field]: value };
    setEntries(newEntries);
  };

  const getTunnelOptions = (sector: string) => {
    const range = SECTOR_TUNNELS[sector as keyof typeof SECTOR_TUNNELS];
    if (!range) return [];
    const [start, end] = range;
    return Array.from({ length: end - start + 1 }, (_, i) => (start + i).toString());
  };

  const validateForm = () => {
    return selectedPest &&
           selectedSector &&
           entries.every(entry =>
             entry.Tunel &&
             entry.Cantidad !== ''
           );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error('Por favor complete todos los campos requeridos');
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase
        .from('Muestreo Plagas y Enfermedades')
        .insert(entries.map(entry => ({
          Fecha: globalDate,
          Plaga: selectedPest,
          Sector: selectedSector,
          Tunel: entry.Tunel,
          Cantidad: parseFloat(entry.Cantidad)
        })));

      if (error) throw error;

      toast.success('Muestreo guardado exitosamente');
      setEntries([{ Fecha: globalDate, Tunel: '', Cantidad: '' }]);
      setSelectedPest('');
      setSelectedSector('');
    } catch (error) {
      toast.error('Error al guardar el muestreo');
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  }; 

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-[#1A1A1A] p-6 rounded-lg">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-lg font-medium text-white mb-1">
              Fecha de Muestreo
            </label>
            <input
              type="date"
              value={globalDate}
              onChange={(e) => {
                setGlobalDate(e.target.value);
                setEntries(entries.map(entry => ({ ...entry, Fecha: e.target.value })));
              }}
              className="w-full bg-[#2A2A2A] border border-[#404040] rounded-md p-2 text-white"
              required
            />
          </div>
          <div>
            <label className="block text-lg font-medium text-white mb-1">
              Plaga
            </label>
            <select
              value={selectedPest}
              onChange={(e) => setSelectedPest(e.target.value)}
              className="w-full bg-[#2A2A2A] border border-[#404040] rounded-md p-2 text-white"
              required
            >
              <option value="">Seleccione una plaga</option>
              {PEST_OPTIONS.map(pest => (
                <option key={pest} value={pest}>{pest}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-lg font-medium text-white mb-1">
              Sector
            </label>
            <select
              value={selectedSector}
              onChange={(e) => setSelectedSector(e.target.value)}
              className="w-full bg-[#2A2A2A] border border-[#404040] rounded-md p-2 text-white"
              required
            >
              <option value="">Seleccione un sector</option>
              {Object.keys(SECTOR_TUNNELS).map(sector => (
                <option key={sector} value={sector}>Sector {sector}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {entries.map((entry, index) => (
        <div key={index} className="bg-[#1A1A1A] p-6 rounded-lg space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-white">Entrada {index + 1}</h3>
            {entries.length > 1 && (
              <button
                type="button"
                onClick={() => removeEntry(index)}
                className="p-2 text-[#A3A3A3] hover:text-white transition-colors"
              >
                <Minus size={20} />
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white mb-1">
                Túnel
              </label>
              <select
                value={entry.Tunel}
                onChange={(e) => updateEntry(index, 'Tunel', e.target.value)}
                className="w-full bg-[#2A2A2A] border border-[#404040] rounded-md p-2 text-white"
                required
                disabled={!selectedSector}
              >
                <option value="">Seleccione un túnel</option>
                {selectedSector && getTunnelOptions(selectedSector).map(tunnel => (
                  <option key={tunnel} value={tunnel}>Túnel {tunnel}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-1">
                Cantidad
              </label>
              <input
                type="number"
                step="0.01"
                value={entry.Cantidad}
                onChange={(e) => updateEntry(index, 'Cantidad', e.target.value)}
                onWheel={(e) => e.currentTarget.blur()}
                className="w-full bg-[#2A2A2A] border border-[#404040] rounded-md p-2 text-white"
                required
                min="0"
                placeholder="0"
              />
            </div>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addEntry}
        className="w-full bg-[#1F1F1F] border border-[#2A2A2A] text-white rounded-xl py-4 flex items-center justify-center gap-2 hover:bg-[#2A2A2A] transition-colors"
      >
        <Plus className="w-5 h-5" />
        Añadir otro registro
      </button>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full bg-[#3B82F6] text-white rounded-xl py-4 flex items-center justify-center gap-2 hover:bg-[#2563EB] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Guardando...</span>
          </>
        ) : (
          <>
            <Save className="w-5 h-5" />
            <span>Guardar Datos</span>
          </>
        )}
      </button>
    </form>
  );
}