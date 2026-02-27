import React, { useState } from 'react';
import { Plus, Minus, Save, Loader2 } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import toast from 'react-hot-toast';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const SECTOR_TUNNELS: Record<string, [number, number]> = {
  '1A': [1, 16], '1B': [1, 19], '1C': [1, 20], '1D': [1, 19], '1E': [1, 16],
  '2A': [1, 20], '2B': [1, 20], '2C': [1, 20], '2D': [1, 22], '2E': [1, 26],
  '3A': [1, 25], '3B': [1, 20], '3C': [1, 20],
  '4A': [1, 23], '4B': [1, 20], '4C': [1, 20],
  '5A': [1, 22], '5B': [1, 20], '5C': [1, 20],
  '6A': [1, 29], '6B': [15, 28], '6C': [1, 38], '6D': [1, 37],
  '7A': [1, 14], '7B': [1, 29], '7C': [1, 35], '7D': [1, 25], '7E': [1, 19],
  '8A': [1, 25], '8B': [1, 23], '8C': [1, 24], '8D': [1, 20], '8E': [1, 17], '8F': [1, 23],
};

interface HarvestEntry {
  id: string;
  sector: string;
  tunelInicio: string;
  tunelFinal: string;
  cantidadCubetas: string;
}

const initialEntry: HarvestEntry = {
  id: '1',
  sector: '',
  tunelInicio: '',
  tunelFinal: '',
  cantidadCubetas: ''
};

export default function HarvestForm() {
  const [samplingDate, setSamplingDate] = useState(new Date().toISOString().split('T')[0]);
  const [entries, setEntries] = useState<HarvestEntry[]>([initialEntry]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{
    samplingDate?: boolean;
    entries: { [key: string]: { [key: string]: boolean } };
  }>({
    entries: {}
  });

  const handleAddEntry = () => {
    setEntries([...entries, {
      ...initialEntry,
      id: (entries.length + 1).toString()
    }]);
  };

  const handleRemoveEntry = (id: string) => {
    if (entries.length > 1) {
      setEntries(entries.filter(entry => entry.id !== id));
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.entries[id];
        return newErrors;
      });
    }
  };

  const handleEntryChange = (id: string, field: keyof HarvestEntry, value: string) => {
    setEntries(entries.map(entry => {
      if (entry.id === id) {
        const updatedEntry = { ...entry, [field]: value };
        if (field === 'sector') {
          updatedEntry.tunelInicio = '';
          updatedEntry.tunelFinal = '';
        }
        return updatedEntry;
      }
      return entry;
    }));

    setErrors(prev => ({
      ...prev,
      entries: {
        ...prev.entries,
        [id]: {
          ...prev.entries[id],
          [field]: false
        }
      }
    }));
  };

const getTunnelOptions = (sector: string) => {
  const range = SECTOR_TUNNELS[sector as keyof typeof SECTOR_TUNNELS];
  if (!range) return [];
  const [start, end] = range;
  return Array.from({ length: end - start + 1 }, (_, i) => (start + i).toString());
};

  const validateForm = () => {
    const newErrors: typeof errors = {
      samplingDate: !samplingDate,
      entries: {}
    };

    entries.forEach(entry => {
      newErrors.entries[entry.id] = {
        sector: !entry.sector,
        tunelInicio: !entry.tunelInicio,
        tunelFinal: !entry.tunelFinal,
        cantidadCubetas: !entry.cantidadCubetas || parseInt(entry.cantidadCubetas) <= 0
      };
    });

    setErrors(newErrors);

    return !newErrors.samplingDate && 
           Object.values(newErrors.entries).every(entry => 
             Object.values(entry).every(value => !value)
           );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error('Por favor complete todos los campos requeridos');
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('Muestreos Cosecha')
        .insert(
          entries.map(entry => ({
            Fecha: samplingDate,
            Sector: entry.sector,
            Tunel_inicio: parseInt(entry.tunelInicio),
            Tunel_final: parseInt(entry.tunelFinal),
            Cantidad_cubetas: parseInt(entry.cantidadCubetas)
          }))
        );

      if (error) throw error;

      toast.success('Datos de cosecha guardados exitosamente');
      setEntries([{ ...initialEntry }]);
    } catch (error) {
      console.error('Error saving harvest data:', error);
      toast.error('Error al guardar los datos de cosecha');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getInputClassName = (hasError: boolean) => `
    w-full bg-[#1F1F1F] border ${hasError ? 'border-red-500' : 'border-[#2A2A2A]'}
    text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2
    ${hasError ? 'focus:ring-red-500' : 'focus:ring-[#3B82F6]'}
    ${hasError ? 'animate-shake' : ''}
  `;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-[#1A1A1A] p-6 rounded-lg">
        <label className="block text-lg font-medium text-white mb-1">
          Fecha de Cosecha
        </label>
        <input
          type="date"
          value={samplingDate}
          onChange={(e) => {
            setSamplingDate(e.target.value);
            setErrors(prev => ({ ...prev, samplingDate: false }));
          }}
          className={getInputClassName(errors.samplingDate || false)}
        />
      </div>

      <div className="space-y-4">
        {entries.map((entry) => (
          <div key={entry.id} className="bg-[#1A1A1A] p-6 rounded-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-white">Entrada {entry.id}</h3>
              {entries.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleRemoveEntry(entry.id)}
                  className="text-[#A3A3A3] hover:text-white transition-colors"
                >
                  <Minus className="w-5 h-5" />
                </button>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">Sector</label>
                <select
                  value={entry.sector}
                  onChange={(e) => handleEntryChange(entry.id, 'sector', e.target.value)}
                  className={getInputClassName(errors.entries[entry.id]?.sector || false)}
                >
                  <option value="">Seleccione un sector</option>
                  {Object.keys(SECTOR_TUNNELS).map((sector) => (
                    <option key={sector} value={sector}>
                      Sector {sector}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">Túnel Inicial</label>
                <select
                  value={entry.tunelInicio}
                  onChange={(e) => handleEntryChange(entry.id, 'tunelInicio', e.target.value)}
                  className={getInputClassName(errors.entries[entry.id]?.tunelInicio || false)}
                  disabled={!entry.sector}
                >
                  <option value="">Seleccione un túnel</option>
                  {entry.sector && getTunnelOptions(entry.sector).map(tunnel => (
                    <option key={tunnel} value={tunnel}>Túnel {tunnel}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">Túnel Final</label>
                <select
                  value={entry.tunelFinal}
                  onChange={(e) => handleEntryChange(entry.id, 'tunelFinal', e.target.value)}
                  className={getInputClassName(errors.entries[entry.id]?.tunelFinal || false)}
                  disabled={!entry.sector}
                >
                  <option value="">Seleccione un túnel</option>
                  {entry.sector && getTunnelOptions(entry.sector).map(tunnel => (
                    <option key={tunnel} value={tunnel}>Túnel {tunnel}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">Cantidad de Cubetas</label>
                <input
                  type="number"
                  value={entry.cantidadCubetas}
                  onChange={(e) => handleEntryChange(entry.id, 'cantidadCubetas', e.target.value)}
                  onWheel={(e) => e.currentTarget.blur()}
                  className={getInputClassName(errors.entries[entry.id]?.cantidadCubetas || false)}
                  min="1"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={handleAddEntry}
        className="w-full bg-[#1F1F1F] border border-[#2A2A2A] text-white rounded-xl py-4 flex items-center justify-center gap-2 hover:bg-[#2A2A2A] transition-colors"
      >
        <Plus className="w-5 h-5" />
        Añadir otro registro
      </button>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-[#3B82F6] text-white rounded-xl py-4 flex items-center justify-center gap-2 hover:bg-[#2563EB] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <Save className="w-5 h-5" />
        )}
        {isSubmitting ? 'Guardando...' : 'Guardar Datos'}
      </button>
    </form>
  );
}