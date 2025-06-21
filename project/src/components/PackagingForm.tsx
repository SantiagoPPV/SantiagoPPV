import React, { useState } from 'react';
import { Plus, Minus, Save, Loader2 } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import toast from 'react-hot-toast';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const PROVIDERS = [
  'Green Vegano',
  'Hortifruit',
  'Fruit Natural',
  'Berries Paradise',
  'Berry Lovers'
];

const PACKAGING_TYPES = [
  '8x18',
  'Pintas',
  '11x12',
  'Jumbo',
  '12x18',
  '6oz',
  '4oz'
];

interface PackagingEntry {
  id: string;
  proveedor: string;
  cantidadCajas: string;
  tipoEmbalaje: string;
}

const initialEntry: PackagingEntry = {
  id: '1',
  proveedor: '',
  cantidadCajas: '',
  tipoEmbalaje: ''
};

export default function PackagingForm() {
  const [samplingDate, setSamplingDate] = useState(new Date().toISOString().split('T')[0]);
  const [entries, setEntries] = useState<PackagingEntry[]>([initialEntry]);
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

  const handleEntryChange = (id: string, field: keyof PackagingEntry, value: string) => {
    setEntries(entries.map(entry => {
      if (entry.id === id) {
        return { ...entry, [field]: value };
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

  const validateForm = () => {
    const newErrors: typeof errors = {
      samplingDate: !samplingDate,
      entries: {}
    };

    entries.forEach(entry => {
      newErrors.entries[entry.id] = {
        proveedor: !entry.proveedor,
        cantidadCajas: !entry.cantidadCajas || parseInt(entry.cantidadCajas) <= 0,
        tipoEmbalaje: !entry.tipoEmbalaje
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
        .from('Muestreos Empaque')
        .insert(
          entries.map(entry => ({
            Fecha: samplingDate,
            Proveedor: entry.proveedor,
            Cantidad_cajas: parseInt(entry.cantidadCajas),
            Tipo_embalaje: entry.tipoEmbalaje
          }))
        );

      if (error) throw error;

      toast.success('Datos de empaque guardados exitosamente');
      setEntries([{ ...initialEntry }]);
    } catch (error) {
      console.error('Error saving packaging data:', error);
      toast.error('Error al guardar los datos de empaque');
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
          Fecha de Empaque
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
            
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">Proveedor</label>
                <select
                  value={entry.proveedor}
                  onChange={(e) => handleEntryChange(entry.id, 'proveedor', e.target.value)}
                  className={getInputClassName(errors.entries[entry.id]?.proveedor || false)}
                >
                  <option value="">Seleccione un proveedor</option>
                  {PROVIDERS.map((provider) => (
                    <option key={provider} value={provider}>
                      {provider}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">Tipo de Embalaje</label>
                <select
                  value={entry.tipoEmbalaje}
                  onChange={(e) => handleEntryChange(entry.id, 'tipoEmbalaje', e.target.value)}
                  className={getInputClassName(errors.entries[entry.id]?.tipoEmbalaje || false)}
                >
                  <option value="">Seleccione un tipo</option>
                  {PACKAGING_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">Cantidad de Cajas</label>
                <input
                  type="number"
                  value={entry.cantidadCajas}
                  onChange={(e) => handleEntryChange(entry.id, 'cantidadCajas', e.target.value)}
                  onWheel={(e) => e.currentTarget.blur()}
                  className={getInputClassName(errors.entries[entry.id]?.cantidadCajas || false)}
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