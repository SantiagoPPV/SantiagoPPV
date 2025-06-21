import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import DailyAssignmentView from './DailyAssignmentView';
import {
  ChevronRight,
  Users,
  Briefcase,
  Save,
  Eye,
  X,
  Search,
  ChevronDown,
  ChevronUp,
  CheckSquare,
  Square,
  MinusSquare,
  XCircle
} from 'lucide-react';
import toast from 'react-hot-toast';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
);
 
const TABLE = 'Personal Moray';

interface Worker {
  ID: number;
  Nombre: string;
  Area: string;
  Estado: boolean;
  Labor: string | null;
  Asignado: boolean;
  PendienteGuardar?: boolean; // 👈 NUEVO
}

export default function PersonalManagement() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [selectedWorkers, setSelectedWorkers] = useState<number[]>([]);
  const [selectedAssignedWorkers, setSelectedAssignedWorkers] = useState<number[]>([]);
  const [selectedLabor, setSelectedLabor] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [laborToRemove, setLaborToRemove] = useState<string | null>(null);
  const [searchUnassigned, setSearchUnassigned] = useState('');
  const [searchAssigned, setSearchAssigned] = useState('');
  const [searchLabor, setSearchLabor] = useState('');
  const [openUnassignedLabs, setOpenUnassignedLabs] = useState<Record<string,boolean>>({});
  const [openAssignedLabs, setOpenAssignedLabs] = useState<Record<string,boolean>>({});
  const [laborOptions, setLaborOptions] = useState<string[]>([]);

  useEffect(() => {
    fetchWorkers();
    const chan = supabase
      .channel('personal-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, fetchWorkers)
      .subscribe();
    return () => { supabase.removeChannel(chan) };
  }, []);
useEffect(() => {
  const fetchLaborOptions = async () => {
    try {
      const { data, error } = await supabase
        .from('Labores Personal')
        .select('"Nombre Labor"')
        .eq('Activo', true);

      if (error) throw error;

      const uniqueLabors = [...new Set(data.map(row => row['Nombre Labor']))]
        .sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' })); // orden alfabético español

      setLaborOptions(uniqueLabors);
    } catch (error) {
      console.error('Error al cargar las labores activas:', error);
      toast.error('No se pudieron cargar las labores activas');
    }
  };

  fetchLaborOptions();
}, []);
  async function fetchWorkers() {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from<Worker>(TABLE)
        .select('ID,Nombre,Area,Estado,Labor,Asignado')
        .eq('Estado', true)
        .order('Labor', { ascending: true })
        .order('Nombre', { ascending: true });

      if (error) throw error;
      setWorkers(data!);
    } catch (err) {
      console.error(err);
      toast.error('No se pudo cargar el personal');
    } finally {
      setIsLoading(false);
    }
  }

  function handleAssignLabor() {
  if (!selectedLabor || !selectedWorkers.length) {
    toast.error('Seleccione una labor y al menos un trabajador');
    return;
  }

  setWorkers(ws =>
    ws.map(w =>
      selectedWorkers.includes(w.ID)
        ? {
            ...w,
            Labor: selectedLabor,
            Asignado: true,            // visualmente ya asignado
            PendienteGuardar: true     // aún no se guarda en BD
          }
        : w
    )
  );

  setSelectedWorkers([]);
  setSelectedLabor('');
}

async function handleSaveAssignments() {
  const toSave = workers.filter(w => w.PendienteGuardar);

  if (!toSave.length) {
    toast.error('No hay asignaciones nuevas');
    return;
  }

  setIsSaving(true);

  try {
    for (const worker of toSave) {
      const { error } = await supabase
        .from(TABLE)
        .update({
          Labor: worker.Labor,
          Asignado: true
        })
        .eq('ID', worker.ID);

      if (error) throw error;
    }

    toast.success('Asignaciones guardadas correctamente');

    // Quitar la bandera de pendiente
    setWorkers(ws =>
      ws.map(w => ({
        ...w,
        PendienteGuardar: false
      }))
    );

    fetchWorkers();
  } catch (err) {
    console.error(err);
    toast.error('Error al guardar en la base de datos');
  } finally {
    setIsSaving(false);
  }
}

  const handleRemoveAssignments = (labor: string) => {
    setLaborToRemove(labor);
    setShowConfirmDialog(true);
  };

  const confirmRemoveAssignments = () => {
    if (!laborToRemove) return;
    
    setWorkers(ws =>
      ws.map(w =>
        w.Labor === laborToRemove
          ? { ...w, Labor: null, Asignado: false }
          : w
      )
    );
    setLaborToRemove(null);
    setShowConfirmDialog(false);
  };

  const handleRemoveIndividualAssignment = (workerId: number) => {
    setWorkers(ws =>
      ws.map(w =>
        w.ID === workerId
          ? { ...w, Labor: null, Asignado: false }
          : w
      )
    );
  };

  const handleSelectAllInGroup = (labor: string, workers: Worker[]) => {
    setSelectedWorkers(prev => {
      const workerIds = workers.map(w => w.ID);
      const otherSelected = prev.filter(id => 
        !workerIds.includes(id)
      );
      
      const allSelected = workers.every(w => 
        prev.includes(w.ID)
      );
      
      if (allSelected) {
        return otherSelected;
      }
      
      return [...otherSelected, ...workerIds];
    });
  };

  const handleSelectAllAssignedInGroup = (labor: string, workers: Worker[]) => {
    setSelectedAssignedWorkers(prev => {
      const workerIds = workers.map(w => w.ID);
      const otherSelected = prev.filter(id => 
        !workerIds.includes(id)
      );
      
      const allSelected = workers.every(w => 
        prev.includes(w.ID)
      );
      
      if (allSelected) {
        return otherSelected;
      }
      
      return [...otherSelected, ...workerIds];
    });
  };

  const isGroupSelected = (workers: Worker[]) => {
    return workers.every(w => selectedWorkers.includes(w.ID));
  };

  const isAssignedGroupSelected = (workers: Worker[]) => {
    return workers.every(w => selectedAssignedWorkers.includes(w.ID));
  };

  const isGroupPartiallySelected = (workers: Worker[]) => {
    const selectedCount = workers.filter(w => selectedWorkers.includes(w.ID)).length;
    return selectedCount > 0 && selectedCount < workers.length;
  };

  const isAssignedGroupPartiallySelected = (workers: Worker[]) => {
    const selectedCount = workers.filter(w => selectedAssignedWorkers.includes(w.ID)).length;
    return selectedCount > 0 && selectedCount < workers.length;
  };

    const unassigned = workers
    .filter(w => w.Asignado === false) // solo los no asignados
    .filter(w => 
      w.Nombre.toLowerCase().includes(searchUnassigned.toLowerCase())
    );

  const assigned = workers
    .filter(w => w.Asignado === true) // solo los asignados
    .filter(w =>
      w.Nombre.toLowerCase().includes(searchAssigned.toLowerCase())
    );

  const groupBy = <K extends string>(arr: any[], fn: (x:any)=>K) =>
    arr.reduce<Record<K,any[]>>((acc, x) => {
      const k = fn(x);
      acc[k] ||= [];
      acc[k].push(x);
      return acc;
    }, {} as Record<K,any[]>);

  const unassignedByLabor = groupBy(unassigned, w => w.Labor || 'Sin Labor');
  const assignedByLab = groupBy(assigned, w => w.Labor!);

  return (
    <>
      <div className="min-h-screen bg-[#0D0D0D] p-8">
        <div className="max-w-7xl mx-auto flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold text-white">Programa de Trabajo</h2>
            <p className="text-[#A3A3A3]">Asigne labores al personal activo</p>
          </div>
          <button
  onClick={() => setShowModal(true)}
  className="bg-[#3B82F6] text-white px-6 py-3 rounded-lg flex items-center gap-2"
>
  <Eye className="w-5 h-5"/>
  Ver Programa de Trabajo
</button>
        </div>

        <div className="grid grid-cols-3 gap-8">
          <div className="bg-[#1A1A1A] rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-[#3B82F6]"/>
              <h3 className="text-xl font-semibold text-white">Personal sin Asignar</h3>
            </div>
            <div className="relative mb-4">
              <input
                type="text"
                placeholder="Buscar personal..."
                className="w-full bg-[#262626] text-white pl-10 pr-4 py-2 rounded-lg"
                value={searchUnassigned}
                onChange={e => setSearchUnassigned(e.target.value)}
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A3A3A3]"/>
            </div>
            {isLoading ? (
              <p className="text-center text-[#A3A3A3]">Cargando…</p>
            ) : !Object.keys(unassignedByLabor).length ? (
              <p className="text-center text-[#A3A3A3]">No hay personal sin asignar</p>
            ) : (
              Object.entries(unassignedByLabor).map(([labor, ws]) => (
                <div key={labor} className="mb-4">
                  <button
                    className="flex items-center justify-between w-full"
                    onClick={() =>
                      setOpenUnassignedLabs(prev => ({
                        ...prev,
                        [labor]: !prev[labor],
                      }))
                    }
                  >
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectAllInGroup(labor, ws);
                        }}
                        className="text-[#3B82F6] hover:text-[#2563EB]"
                      >
                        {isGroupSelected(ws) ? (
                          <CheckSquare className="w-5 h-5" />
                        ) : isGroupPartiallySelected(ws) ? (
                          <MinusSquare className="w-5 h-5" />
                        ) : (
                          <Square className="w-5 h-5" />
                        )}
                      </button>
                      <h4 className="text-[#3B82F6] font-medium">
                        {labor} ({ws.length})
                      </h4>
                    </div>
                    {openUnassignedLabs[labor]
                      ? <ChevronUp className="text-[#3B82F6]"/>
                      : <ChevronDown className="text-[#3B82F6]"/>}
                  </button>
                  {openUnassignedLabs[labor] && ws.map(w => (
                    <div
                      key={w.ID}
                      className="flex items-center bg-[#262626] rounded-lg p-4 mt-2 gap-3"
                    >
                      <input
                        type="checkbox"
                        checked={selectedWorkers.includes(w.ID)}
                        onChange={e => {
                          setSelectedWorkers(sel =>
                            e.target.checked
                              ? [...sel, w.ID]
                              : sel.filter(id => id !== w.ID)
                          );
                        }}
                        className="h-4 w-4 text-blue-600"
                      />
                      <span className="text-white">{w.Nombre}</span>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>

          <div className="bg-[#262626] rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-[#3B82F6]"/>
              <h3 className="text-xl font-semibold text-white">Asignar Labor</h3>
            </div>
            <div className="relative">
              <input
                type="text"
                placeholder="Buscar labor..."
                className="w-full bg-[#1A1A1A] text-white pl-10 pr-4 py-2 rounded-lg"
                value={searchLabor}
                onChange={e => setSearchLabor(e.target.value)}
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A3A3A3]"/>
            </div>
            <select
              className="w-full bg-[#1A1A1A] text-white px-4 py-2 rounded-lg"
              value={selectedLabor}
              onChange={e => setSelectedLabor(e.target.value)}
            >
              <option value="">Seleccionar Labor</option>
              {laborOptions
  .filter(l => l.toLowerCase().includes(searchLabor.toLowerCase()))
  .map(labor => (
    <option key={labor} value={labor}>
      {labor}
    </option>
  ))}
            </select>
            <button
              onClick={handleAssignLabor}
              disabled={!selectedLabor || !selectedWorkers.length}
              className="w-full bg-[#3B82F6] text-white py-3 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <ChevronRight className="w-5 h-5"/>
              Asignar Labor
            </button>
          </div>

          <div className="bg-[#1A1A1A] rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-[#3B82F6]"/>
                <h3 className="text-xl font-semibold text-white">Personal Asignado</h3>
              </div>
              <button
                onClick={handleSaveAssignments}
                disabled={isSaving}
                className="bg-[#3B82F6] text-white px-4 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50"
              >
                <Save className="w-4 h-4"/>
                {isSaving ? 'Guardando…' : 'Guardar Asignaciones'}
              </button>
            </div>
            <div className="relative mb-4">
              <input
                type="text"
                placeholder="Buscar personal asignado..."
                className="w-full bg-[#262626] text-white pl-10 pr-4 py-2 rounded-lg"
                value={searchAssigned}
                onChange={e => setSearchAssigned(e.target.value)}
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A3A3A3]"/>
            </div>
            {!Object.keys(assignedByLab).length ? (
              <p className="text-center text-[#A3A3A3]">No hay personal asignado</p>
            ) : (
              Object.entries(assignedByLab).map(([lab, ws]) => (
                <div key={lab} className="mb-4">
                  <div className="flex items-center justify-between w-full mb-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleSelectAllAssignedInGroup(lab, ws)}
                        className="text-[#3B82F6] hover:text-[#2563EB]"
                      >
                        {isAssignedGroupSelected(ws) ? (
                          <CheckSquare className="w-5 h-5" />
                        ) : isAssignedGroupPartiallySelected(ws) ? (
                          <MinusSquare className="w-5 h-5" />
                        ) : (
                          <Square className="w-5 h-5" />
                        )}
                      </button>
                      <h4 className="text-[#3B82F6] font-medium">
                        {lab} ({ws.length})
                      </h4>
                    </div>
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => handleRemoveAssignments(lab)}
                        className="text-[#3B82F6] text-sm hover:underline"
                      >
                        Remover Asignación
                      </button>
                      {openAssignedLabs[lab]
                        ? <ChevronUp className="text-[#3B82F6] cursor-pointer" onClick={() => setOpenAssignedLabs(prev => ({ ...prev, [lab]: false }))}/>
                        : <ChevronDown className="text-[#3B82F6] cursor-pointer" onClick={() => setOpenAssignedLabs(prev => ({ ...prev, [lab]: true }))}/>}
                    </div>
                  </div>
                  {openAssignedLabs[lab] && ws.map(w => (
                    <div
                      key={w.ID}
                      className="bg-[#262626] rounded-lg p-4 mt-2 flex justify-between items-center"
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedAssignedWorkers.includes(w.ID)}
                          onChange={e => {
                            setSelectedAssignedWorkers(sel =>
                              e.target.checked
                                ? [...sel, w.ID]
                                : sel.filter(id => id !== w.ID)
                            );
                          }}
                          className="h-4 w-4 text-blue-600"
                        />
                        <span className="text-white">{w.Nombre}</span>
                      </div>
                      <button
                        onClick={() => handleRemoveIndividualAssignment(w.ID)}
                        className="text-[#A3A3A3] hover:text-white transition-colors"
                      >
                        <XCircle className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

    {showModal && (
  <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center">
    <div className="bg-[#1A1A1A] w-full max-w-6xl h-[90vh] rounded-xl overflow-hidden shadow-xl relative">
      <button
        className="absolute top-4 right-4 text-white hover:text-red-400"
        onClick={() => setShowModal(false)}
      >
        <X className="w-6 h-6" />
      </button>
      <div className="p-6 h-full overflow-y-auto">
        <DailyAssignmentView />
      </div>
    </div>
  </div>
)}
 
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#1A1A1A] rounded-xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-white mb-4">Confirmar Remoción</h3>
            <p className="text-[#A3A3A3] mb-6">
              ¿Está seguro que quiere remover esta asignación de todos los trabajadores?
            </p>
            <div className="flex justify-end gap-4">
              <button
                onClick={() => setShowConfirmDialog(false)}
                className="px-4 py-2 text-[#A3A3A3] hover:text-white"
              >
                Cancelar
              </button>
              <button
                onClick={confirmRemoveAssignments}
                className="bg-[#3B82F6] text-white px-4 py-2 rounded-lg"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}