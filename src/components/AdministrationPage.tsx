import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { UserPlus, UserMinus, Search, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
);

interface Worker {
  ID: number;
  Nombre: string;
  Area: string;
  Estado: boolean;
}

export default function AdministrationPage() {
  const [nombre, setNombre] = useState('');
  const [area, setArea] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [activeWorkers, setActiveWorkers] = useState<Worker[]>([]);
  const [selectedWorkers, setSelectedWorkers] = useState<number[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isDeactivating, setIsDeactivating] = useState(false);

  // Estados para actualizar área
  const [updateWorkerId, setUpdateWorkerId] = useState<number | null>(null);
  const [updateArea, setUpdateArea] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    fetchActiveWorkers();

    const channel = supabase
      .channel('personal-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'Personal Moray' },
        () => fetchActiveWorkers()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchActiveWorkers = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('Personal Moray')
        .select('ID, Nombre, Area, Estado')
        .eq('Estado', true)
        .order('Nombre', { ascending: true })
        .range(0, 9999);

      if (error) throw error;
      setActiveWorkers(data || []);
    } catch (error) {
      console.error(error);
      toast.error('Error al cargar el personal activo');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || !area) {
      toast.error('Por favor complete todos los campos');
      return;
    }
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('Personal Moray')
        .insert({ Nombre: nombre.trim(), Area: area, Estado: true, Labores: null });
      if (error) throw error;
      toast.success('Personal registrado exitosamente');
      setNombre('');
      setArea('');
    } catch (error) {
      console.error(error);
      toast.error('Error al registrar el personal');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeactivate = async () => {
    if (selectedWorkers.length === 0) {
      toast.error('Seleccione al menos un trabajador');
      return;
    }
    setIsDeactivating(true);
    try {
      const { error } = await supabase
        .from('Personal Moray')
        .update({ Estado: false })
        .in('ID', selectedWorkers);
      if (error) throw error;
      toast.success('Personal dado de baja exitosamente');
      setSelectedWorkers([]);
    } catch (error) {
      console.error(error);
      toast.error('Error al dar de baja el personal');
    } finally {
      setIsDeactivating(false);
    }
  };

  const handleUpdateArea = async () => {
    if (!updateWorkerId || !updateArea) {
      toast.error('Seleccione un trabajador y un área nueva');
      return;
    }
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('Personal Moray')
        .update({ Area: updateArea })
        .eq('ID', updateWorkerId);
      if (error) throw error;
      toast.success('Área actualizada correctamente');
      setUpdateWorkerId(null);
      setUpdateArea('');
    } catch (error) {
      console.error(error);
      toast.error('Error al actualizar área');
    } finally {
      setIsUpdating(false);
    }
  };

  const filteredWorkers = activeWorkers.filter(w =>
    w.Nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#0D0D0D] p-8">
      <div className="max-w-2xl mx-auto space-y-12">
        {/* Alta de Personal */}
        <div className="bg-[#1A1A1A] rounded-xl p-6">
          <div className="flex items-center gap-2 mb-6">
            <UserPlus className="w-5 h-5 text-[#3B82F6]" />
            <h2 className="text-xl font-semibold text-white">Alta de Personal</h2>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white mb-2">Nombre del trabajador</label>
              <input
                type="text"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                placeholder="Ingrese el nombre completo"
                className="w-full bg-[#262626] text-white px-4 py-2 rounded-lg border border-[#404040] focus:outline-none focus:border-[#3B82F6]"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-2">Área</label>
              <select
                value={area}
                onChange={e => setArea(e.target.value)}
                className="w-full bg-[#262626] text-white px-4 py-2 rounded-lg border border-[#404040] focus:outline-none focus:border-[#3B82F6]"
                required
              >
                <option value="">Seleccione un área</option>
                <option value="Labores">Labores</option>
                <option value="Fumigación">Fumigación</option>
                <option value="Supervisor">Supervisor</option>
                <option value="Riego">Riego</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-[#3B82F6] text-white py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-[#2563EB] disabled:opacity-50"
            >
              {isSubmitting
                ? <Loader2 className="w-5 h-5 animate-spin" />
                : <UserPlus className="w-5 h-5" />}
              {isSubmitting ? 'Registrando...' : 'Dar de Alta'}
            </button>
          </form>
        </div>

        {/* Baja de Personal */}
        <div className="bg-[#1A1A1A] rounded-xl p-6">
          <div className="flex items-center gap-2 mb-6">
            <UserMinus className="w-5 h-5 text-[#3B82F6]" />
            <h2 className="text-xl font-semibold text-white">Dar de Baja Personal</h2>
          </div>
          <div className="space-y-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Buscar personal..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-[#262626] text-white pl-10 pr-4 py-2 rounded-lg border border-[#404040] focus:outline-none focus:border-[#3B82F6]"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A3A3A3]" />
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {isLoading
                ? (
                  <div className="text-center text-[#A3A3A3] py-4">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                    Cargando personal...
                  </div>
                )
                : filteredWorkers.length === 0
                  ? <p className="text-center text-[#A3A3A3] py-4">No se encontró personal activo</p>
                  : filteredWorkers.map(w => (
                    <div key={w.ID} className="flex items-center bg-[#262626] rounded-lg p-4 gap-3">
                      <input
                        type="checkbox"
                        checked={selectedWorkers.includes(w.ID)}
                        onChange={e => {
                          setSelectedWorkers(prev =>
                            e.target.checked
                              ? [...prev, w.ID]
                              : prev.filter(id => id !== w.ID)
                          );
                        }}
                        className="h-4 w-4 text-blue-600"
                      />
                      <div>
                        <span className="text-white">{w.Nombre}</span>
                        <span className="ml-2 text-sm text-[#A3A3A3]">[{w.Area}]</span>
                      </div>
                    </div>
                  ))
              }
            </div>
            <button
              onClick={handleDeactivate}
              disabled={isDeactivating || selectedWorkers.length === 0}
              className="w-full bg-[#3B82F6] text-white py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-[#2563EB] disabled:opacity-50"
            >
              {isDeactivating
                ? <Loader2 className="w-5 h-5 animate-spin" />
                : <UserMinus className="w-5 h-5" />}
              {isDeactivating ? 'Procesando...' : 'Dar de Baja'}
            </button>
          </div>
        </div>

        {/* Actualizar Área de Personal */}
        <div className="bg-[#1A1A1A] rounded-xl p-6">
          <div className="flex items-center gap-2 mb-6">
            <UserPlus className="w-5 h-5 text-[#3B82F6]" />
            <h2 className="text-xl font-semibold text-white">Actualizar Área</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white mb-2">Trabajador</label>
              <select
                value={updateWorkerId ?? ''}
                onChange={e => setUpdateWorkerId(Number(e.target.value) || null)}
                className="w-full bg-[#262626] text-white px-4 py-2 rounded-lg border border-[#404040] focus:outline-none focus:border-[#3B82F6]"
              >
                <option value="">Seleccione un trabajador</option>
                {activeWorkers.map(w => (
                  <option key={w.ID} value={w.ID}>
                    {w.Nombre} [{w.Area}]
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-2">Nueva Área</label>
              <select
                value={updateArea}
                onChange={e => setUpdateArea(e.target.value)}
                className="w-full bg-[#262626] text-white px-4 py-2 rounded-lg border border-[#404040] focus:outline-none focus:border-[#3B82F6]"
              >
                <option value="">Seleccione un área</option>
                <option value="Labores">Labores</option>
                <option value="Fumigación">Fumigación</option>
                <option value="Supervisor">Supervisor</option>
                <option value="Riego">Riego</option>
              </select>
            </div>
            <button
              onClick={handleUpdateArea}
              disabled={isUpdating}
              className="w-full bg-[#3B82F6] text-white py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-[#2563EB] disabled:opacity-50"
            >
              {isUpdating
                ? <Loader2 className="w-5 h-5 animate-spin" />
                : <UserPlus className="w-5 h-5" />}
              {isUpdating ? 'Actualizando...' : 'Actualizar Área'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}