import React, { useState, useEffect } from 'react';
import { Plus, Minus, Save, Loader2 } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import toast from 'react-hot-toast';
import { getISOWeek } from 'date-fns';

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
  '7A': [1, 14], '7B': [1, 29], '7C': [1, 35], '7D': [1, 25], '7E': [1, 19], '8A': [1, 25], '8B': [1, 23], '8C': [1, 24], '8D': [1, 20], '8E': [1, 17], '8F': [1, 23],
};

interface IrrigationEntry {
  id: string;
  tunel: string;
  tiempo: string;
  mililitros: string;
}

interface PressureEntry {
  id: string;
  sector: string;
  presion: string;
  hora: string;
}

interface ProbetaEntry {
  id: string;
  sector: string;
  mililitros: string;
  hora: 'Inicio del día' | 'Fin del día';
}

const initialIrrigationEntry: IrrigationEntry = {
  id: '1',
  tunel: '',
  tiempo: '',
  mililitros: ''
};

const initialPressureEntry: PressureEntry = {
  id: '1',
  sector: '',
  presion: '',
  hora: '12:00'
};

const initialProbetaEntry: ProbetaEntry = {
  id: '1',
  sector: '',
  mililitros: '',
  hora: 'Inicio del día'
};

interface IrrigationFormProps {
  initialTab?: 'aforos' | 'presiones' | 'probetas';
}

export default function IrrigationForm({ initialTab = 'aforos' }: IrrigationFormProps) {
  const [activeTab, setActiveTab] = useState<'aforos' | 'presiones' | 'probetas'>(initialTab);
  const [samplingDate, setSamplingDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedSector, setSelectedSector] = useState('');
  const [irrigationEntries, setIrrigationEntries] = useState<IrrigationEntry[]>([initialIrrigationEntry]);
  const [pressureEntries, setPressureEntries] = useState<PressureEntry[]>([initialPressureEntry]);
  const [probetaEntries, setProbetaEntries] = useState<ProbetaEntry[]>([initialProbetaEntry]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{
    samplingDate?: boolean;
    sector?: boolean;
    entries: { [key: string]: { [key: string]: boolean } };
  }>({
    entries: {}
  });

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const handleAddEntry = () => {
    if (activeTab === 'aforos') {
      setIrrigationEntries([
        ...irrigationEntries,
        { ...initialIrrigationEntry, id: String(irrigationEntries.length + 1) }
      ]);
    } else if (activeTab === 'presiones') {
      setPressureEntries([
        ...pressureEntries,
        { ...initialPressureEntry, id: String(pressureEntries.length + 1) }
      ]);
    } else {
      setProbetaEntries([
        ...probetaEntries,
        { ...initialProbetaEntry, id: String(probetaEntries.length + 1) }
      ]);
    }
  };

  const handleRemoveEntry = (id: string) => {
    if (activeTab === 'aforos' && irrigationEntries.length > 1) {
      setIrrigationEntries(irrigationEntries.filter(e => e.id !== id));
    } else if (activeTab === 'presiones' && pressureEntries.length > 1) {
      setPressureEntries(pressureEntries.filter(e => e.id !== id));
    } else if (activeTab === 'probetas' && probetaEntries.length > 1) {
      setProbetaEntries(probetaEntries.filter(e => e.id !== id));
    }
  };

  const handleIrrigationEntryChange = (id: string, field: keyof IrrigationEntry, value: string) => {
    setIrrigationEntries(irrigationEntries.map(entry => {
      if (entry.id === id) {
        return { ...entry, [field]: value };
      }
      return entry;
    }));
  };

  const handlePressureEntryChange = (id: string, field: keyof PressureEntry, value: string) => {
    setPressureEntries(pressureEntries.map(entry => 
      entry.id === id ? { ...entry, [field]: value } : entry
    ));
  };

  const handleProbetaEntryChange = (id: string, field: keyof ProbetaEntry, value: string) => {
    setProbetaEntries(probetaEntries.map(entry => 
      entry.id === id ? { ...entry, [field]: value as any } : entry
    ));
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
      sector: activeTab === 'aforos' && !selectedSector,
      entries: {}
    };

    if (activeTab === 'aforos') {
      irrigationEntries.forEach(e => {
        newErrors.entries[e.id] = {
          tunel: !e.tunel,
          tiempo: !e.tiempo || parseInt(e.tiempo) <= 0,
          mililitros: !e.mililitros || parseInt(e.mililitros) <= 0
        };
      });
    } else if (activeTab === 'presiones') {
      pressureEntries.forEach(e => {
        newErrors.entries[e.id] = {
          sector: !e.sector,
          presion: !e.presion || parseFloat(e.presion) <= 0,
          hora: !e.hora
        };
      });
    } else {
      probetaEntries.forEach(e => {
        newErrors.entries[e.id] = {
          sector: !e.sector,
          mililitros: !e.mililitros || parseInt(e.mililitros) <= 0,
          hora: !e.hora
        };
      });
    }

    setErrors(newErrors);

    return !newErrors.samplingDate &&
           !newErrors.sector &&
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
      if (activeTab === 'aforos') {
        const { error } = await supabase
          .from('Muestreos Aforos Riego')
          .insert(
            irrigationEntries.map(entry => {
              const tiempo = parseInt(entry.tiempo);
              const mililitros = parseInt(entry.mililitros);
              return {
                Fecha: samplingDate,
                Sector: selectedSector,
                Tunel: parseInt(entry.tunel),
                Tiempo: tiempo,
                Mililitros: mililitros,
                Semana: getISOWeek(new Date(samplingDate)),
                CaudalGotero: Math.round((mililitros / tiempo) * 60 * 10) / 10
              };
            })
          );

        if (error) throw error;
        toast.success('Datos de aforo guardados exitosamente');
        setIrrigationEntries([initialIrrigationEntry]);
        setSelectedSector('');
      } else if (activeTab === 'presiones') {
        const { error } = await supabase
          .from('Muestreos Presiones')
          .insert(
            pressureEntries.map(entry => ({
              Fecha: samplingDate,
              Sector: entry.sector,
              Presion: parseFloat(entry.presion),
              Horario: entry.hora
            }))
          );

        if (error) throw error;
        toast.success('Datos de presión guardados exitosamente');
        setPressureEntries([initialPressureEntry]);
      } else {
        const { error } = await supabase
  .from('Muestreos Probetas')
  .insert(
    probetaEntries.map(entry => ({
      Fecha: samplingDate,
      Sector: entry.sector,
      Mililitros: parseInt(entry.mililitros),
      Semana: getISOWeek(new Date(samplingDate))
    }))
  );

        if (error) throw error;
        toast.success('Datos de probeta guardados exitosamente');
        setProbetaEntries([initialProbetaEntry]);
      }
    } catch (err) {
      console.error(err);
      toast.error(`Error al guardar los datos de ${activeTab}`);
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
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-lg font-medium text-white mb-1">
              Fecha de Muestreo
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

          {activeTab === 'aforos' && (
            <div>
              <label className="block text-lg font-medium text-white mb-1">
                Sector
              </label>
              <select
                value={selectedSector}
                onChange={(e) => {
                  setSelectedSector(e.target.value);
                  setErrors(prev => ({ ...prev, sector: false }));
                }}
                className={getInputClassName(errors.sector || false)}
              >
                <option value="">Seleccione un sector</option>
                {Object.keys(SECTOR_TUNNELS).map((sector) => (
                  <option key={sector} value={sector}>
                    Sector {sector}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {activeTab === 'aforos' && irrigationEntries.map((entry) => (
          <div key={entry.id} className="bg-[#1A1A1A] p-6 rounded-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-white">Entrada {entry.id}</h3>
              {irrigationEntries.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleRemoveEntry(entry.id)}
                  className="text-[#A3A3A3] hover:text-white transition-colors"
                >
                  <Minus className="w-5 h-5" />
                </button>
              )}
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">Túnel</label>
                <select
                  value={entry.tunel}
                  onChange={(e) => handleIrrigationEntryChange(entry.id, 'tunel', e.target.value)}
                  className={getInputClassName(errors.entries[entry.id]?.tunel || false)}
                  disabled={!selectedSector}
                >
                  <option value="">Seleccione un túnel</option>
                  {selectedSector && getTunnelOptions(selectedSector).map(tunnel => (
                    <option key={tunnel} value={tunnel}>Túnel {tunnel}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">Tiempo (s)</label>
                <input
  type="number"
  value={entry.tiempo}
  onChange={(e) => handleIrrigationEntryChange(entry.id, 'tiempo', e.target.value)}
  onWheel={(e) => e.currentTarget.blur()}
  className={getInputClassName(errors.entries[entry.id]?.tiempo || false)}
  min="1"
/>
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">Mililitros</label>
                <input
  type="number"
  value={entry.mililitros}
  onChange={(e) => handleIrrigationEntryChange(entry.id, 'mililitros', e.target.value)}
  onWheel={(e) => e.currentTarget.blur()}
  className={getInputClassName(errors.entries[entry.id]?.mililitros || false)}
  min="1"
/>
              </div>
            </div>
          </div>
        ))}

        {activeTab === 'presiones' && pressureEntries.map((entry) => (
          <div key={entry.id} className="bg-[#1A1A1A] p-6 rounded-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Entrada {entry.id}</h3>
              {pressureEntries.length > 1 && (
                <button type="button" onClick={() => handleRemoveEntry(entry.id)}>
                  <Minus className="w-5 h-5 text-[#A3A3A3] hover:text-white"/>
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-2">Sector</label>
                <select
                  value={entry.sector}
                  onChange={e => handlePressureEntryChange(entry.id, 'sector', e.target.value)}
                  className={getInputClassName(errors.entries[entry.id]?.sector || false)}
                >
                  <option value="">Seleccione un sector</option>
                  {Object.keys(SECTOR_TUNNELS).map(s => (
                    <option key={s} value={s}>Sector {s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm mb-2">Presión</label>
                <input
                  type="number"
                  step="0.1"
                  value={entry.presion}
                  onChange={e => handlePressureEntryChange(entry.id, 'presion', e.target.value)}
                  onWheel={(e) => e.currentTarget.blur()}
                  className={getInputClassName(errors.entries[entry.id]?.presion || false)}
                  min="0"
                  placeholder="0.0"
                />
              </div>
            </div>
          </div>
        ))}

        {activeTab === 'probetas' && probetaEntries.map((entry) => (
          <div key={entry.id} className="bg-[#1A1A1A] p-6 rounded-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Entrada {entry.id}</h3>
              {probetaEntries.length > 1 && (
                <button type="button" onClick={() => handleRemoveEntry(entry.id)}>
                  <Minus className="w-5 h-5 text-[#A3A3A3] hover:text-white"/>
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-2">Sector</label>
                <select
                  value={entry.sector}
                  onChange={e => handleProbetaEntryChange(entry.id, 'sector', e.target.value)}
                  className={getInputClassName(errors.entries[entry.id]?.sector || false)}
                >
                  <option value="">Seleccione un sector</option>
                  {Object.keys(SECTOR_TUNNELS).map(s => (
                    <option key={s} value={s}>Sector {s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm mb-2">Mililitros</label>
                <input
                  type="number"
                  value={entry.mililitros}
                  onChange={e => handleProbetaEntryChange(entry.id, 'mililitros', e.target.value)}
                  onWheel={(e) => e.currentTarget.blur()}
                  className={getInputClassName(errors.entries[entry.id]?.mililitros || false)}
                  min="0"
                  placeholder="0"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={handleAddEntry}
        className="w-full bg-[#1F1F1F] border border-[#2A2A2A] rounded-xl py-4 flex items-center justify-center gap-2 hover:bg-[#2A2A2A]"
      >
        <Plus className="w-5 h-5" /> Añadir otro registro
      </button>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-[#3B82F6] rounded-xl py-4 flex items-center justify-center gap-2 hover:bg-[#2563EB] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting
          ? <Loader2 className="w-5 h-5 animate-spin" />
          : <Save className="w-5 h-5" />
        }
        {isSubmitting ? 'Guardando...' : 'Guardar Datos'}
      </button>
    </form>
  );
}