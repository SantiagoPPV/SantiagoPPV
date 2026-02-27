import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import Header from '../components/Header';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useRef } from 'react';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
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
interface Labor {
  id: number;
  'Nombre Labor': string;
  Activa: boolean;
  'Fecha Inicio'?: string;
  'Fecha Fin'?: string;
  Seccion?: string; // ← importante para mostrar en Activas
}

export default function LaborPlanningPage() {
  const [labores, setLabores] = useState<Labor[]>([]);
  const [loading, setLoading] = useState(true);
  const [newLabor, setNewLabor] = useState('');
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState('');
  const [showActive, setShowActive] = useState(true);
  const [showInactive, setShowInactive] = useState(true);
  const [activatingId, setActivatingId] = useState<number | null>(null);
  const [secciones, setSecciones] = useState<string[]>([]);
  const [tipoPorLabor, setTipoPorLabor] = useState<Record<number, string>>({});
const [seccionesPorLabor, setSeccionesPorLabor] = useState<Record<number, string[]>>({});
  const [dynamicCaminos, setDynamicCaminos] = useState<string[]>([]);
const [dynamicPeriferias, setDynamicPeriferias] = useState<string[]>([]);
  const [editingLaborId, setEditingLaborId] = useState<number | null>(null);
  const [tipoSeleccionado, setTipoSeleccionado] = useState<string[]>([]);
const [showTipoDropdown, setShowTipoDropdown] = useState(false);
const tipoOptions = ['TUNELES', 'CAMINOS', 'PERIFERIA', 'N/A'];
  const [formularioPorLabor, setFormularioPorLabor] = useState<
  Record<number, { inicio: string; fin: string; secciones: string[] }>
>({});
  const [showEditModal, setShowEditModal] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchLabores();
  }, []);

  useEffect(() => {
  const fetchSecciones = async () => {
    try {
      const res = await fetch('/tunnels.json');
      const data = await res.json();

      const caminos: string[] = [];
      const periferias: string[] = [];

      for (const feature of data.features) {
        const name = feature.properties?.name?.trim();
        if (!name) continue;

        if (name.startsWith('Camino')) caminos.push(name);
else if (name.startsWith('Periferia')) periferias.push(name);
      }

      // Guardar en estado para uso posterior si lo deseas
      setDynamicCaminos(caminos.sort());
      setDynamicPeriferias(periferias.sort());
    } catch (err) {
      console.error('Error cargando tunnels.json:', err);
    }
  };

  fetchSecciones();
}, []);
useEffect(() => {
  const handleMessage = (event: MessageEvent) => {
   if (event.data?.type === 'SECCIONES_MAPA' && editingLaborId !== null) {
  // Si la labor es "N/A", forzamos a no guardar secciones ni mostrar polígonos
  if (tipoPorLabor[editingLaborId] === 'N/A') {
    // Borra los polígonos visibles
    window.frames[0]?.postMessage({
      type: 'ACTUALIZAR_POLIGONOS_MAPA',
      secciones: [],
    }, '*');

    setFormularioPorLabor((prev) => ({
      ...prev,
      [editingLaborId]: {
        ...prev[editingLaborId],
        secciones: [],
      },
    }));

    return;
  }

  // Si no es "N/A", aplicar comportamiento normal
  const nuevas = event.data.secciones as string[];
  setFormularioPorLabor((prev) => ({
    ...prev,
    [editingLaborId]: {
      ...prev[editingLaborId],
      secciones: nuevas,
    },
  }));
}
  };

  window.addEventListener('message', handleMessage);
  return () => window.removeEventListener('message', handleMessage);
}, [editingLaborId]);
  
  const fetchLabores = async () => {
    const { data, error } = await supabase
      .from('Labores Personal')
      .select('*')
      .order('"Nombre Labor"', { ascending: true })
      .range(0, 9999);

    if (error) {
      console.error('Error fetching labores:', error);
      return;
    }

    setLabores(data || []);
    setLoading(false);
  };
const tipoDropdownRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  const handleClickOutside = (event: MouseEvent) => {
    if (tipoDropdownRef.current && !tipoDropdownRef.current.contains(event.target as Node)) {
      setShowTipoDropdown(false);
    }
  };

  document.addEventListener('mousedown', handleClickOutside);
  return () => {
    document.removeEventListener('mousedown', handleClickOutside);
  };
}, []);
  
 const toggleLabor = async (id: number, currentState: boolean) => {
  if (!currentState) {
    // Cargar tipo desde Labores Personal
    const { data, error } = await supabase
      .from('Labores Personal')
      .select('Tipo')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching tipo:', error);
      return;
    }

   const tipo = data?.Tipo?.toUpperCase().trim() || '';
setTipoPorLabor(prev => ({ ...prev, [id]: tipo }));

const posiblesSecciones: string[] = [];

if (tipo === 'CAMINOS') {
  if (dynamicCaminos.length === 0) {
    toast.error('Secciones de caminos aún no cargadas');
    return;
  }
  posiblesSecciones.push(...dynamicCaminos);
} else if (tipo === 'TUNELES') {
  posiblesSecciones.push(...Object.keys(SECTOR_TUNNELS));
} else if (tipo === 'PERIFERIA') {
  if (dynamicPeriferias.length === 0) {
    toast.error('Secciones de periferia aún no cargadas');
    return;
  }
  posiblesSecciones.push(...dynamicPeriferias);
} else if (tipo.includes(',')) {
  const tipos = tipo.split(',').map(t => t.trim());

  if (tipos.includes('CAMINOS')) {
    if (dynamicCaminos.length === 0) {
      toast.error('Secciones de caminos aún no cargadas');
      return;
    }
    posiblesSecciones.push(...dynamicCaminos);
  }

  if (tipos.includes('TUNELES')) {
    posiblesSecciones.push(...Object.keys(SECTOR_TUNNELS));
  }

  if (tipos.includes('PERIFERIA')) {
    if (dynamicPeriferias.length === 0) {
      toast.error('Secciones de periferia aún no cargadas');
      return;
    }
    posiblesSecciones.push(...dynamicPeriferias);
  }
}

setSeccionesPorLabor(prev => ({ ...prev, [id]: posiblesSecciones }));
setActivatingId(id);
  }

  // Si está activo, lo desactivamos
  const { error } = await supabase
    .from('Labores Personal')
    .update({ Activo: false, 'Fecha Inicio': null, 'Fecha Fin': null, Seccion: null })
    .eq('id', id);

  if (error) {
    console.error('Error desactivando labor:', error);
    return;
  }

  await fetchLabores();
};

const confirmActivation = async () => {
  const id = activatingId ?? editingLaborId;

  const form = formularioPorLabor[id ?? -1];
  const tipo = tipoPorLabor[id ?? -1] || '';

  // Validación: campos vacíos
  if (!form || !form.inicio || !form.fin) {
    toast.error('Debes seleccionar una fecha de inicio y fin');
    return;
  }

  // Validación: al menos una sección seleccionada si NO es N/A
  if (tipo !== 'N/A' && (!form.secciones || form.secciones.length === 0)) {
    toast.error('Debes seleccionar al menos una sección');
    return;
  }

  // Expandir secciones (túneles)
  const seccionesExpandida = form.secciones.flatMap(sec => {
    if (SECTOR_TUNNELS[sec]) {
      const [start, end] = SECTOR_TUNNELS[sec];
      return Array.from({ length: end - start + 1 }, (_, i) => `${sec} Tunel ${i + start}`);
    }
    return [sec]; // caminos o periferias
  });

  const { error } = await supabase
    .from('Labores Personal')
    .update({
      Activo: true,
      'Fecha Inicio': form.inicio,
      'Fecha Fin': form.fin,
      Seccion: seccionesExpandida.join(','),
    })
    .eq('id', id);

  if (error) {
    console.error('❌ Error al guardar:', error);
    toast.error('Error al guardar');
  } else {
    toast.success('Cambios guardados correctamente');
    setActivatingId(null);
    setEditingLaborId(null);
    setFormularioPorLabor(prev => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
    fetchLabores();
  }
};

const addLabor = async () => {
  const nombreValido = newLabor.trim().length > 0;
  const tipoValido = tipoSeleccionado.length > 0;

  if (!nombreValido || !tipoValido) {
    toast.error('Debes ingresar un nombre y seleccionar al menos un tipo');
    return;
  }

  setAdding(true);

  const { data, error } = await supabase
    .from('Labores Personal')
    .insert([{ 'Nombre Labor': newLabor.trim(), Activo: true, Tipo: tipoSeleccionado.join(', ') }])
    .select();

  if (error) {
    console.error('Error adding labor:', error);
    setAdding(false);
    return;
  }

  if (data) {
    setLabores([...labores, ...data]);
    setNewLabor('');
    setTipoSeleccionado([]);
  }

  setAdding(false);
};

  const filteredLabores = labores.filter((l) =>
    l['Nombre Labor'].toLowerCase().includes(query.toLowerCase())
  );

 const activeLabores = filteredLabores.filter(
  (l) => l.Activo && l.Tipo?.toUpperCase().trim() !== 'N/A'
);

const inactiveLabores = filteredLabores.filter(
  (l) => !l.Activo && l.Tipo?.toUpperCase().trim() !== 'N/A'
);

  return (
    <div className="bg-[#0D0D0D] min-h-screen text-white font-sans">
      <div className="p-8 max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Planeación de Labores</h1>
        <p className="text-[#A3A3A3] mb-6">
          Activa, desactiva o crea nuevas labores disponibles para asignación.
        </p>

       <div className="flex flex-wrap gap-4 mb-4 items-end">
  {/* Campo Nombre Labor */}
  <div className="flex flex-col flex-1 min-w-[200px]">
    <label className="text-sm font-semibold text-white mb-1">Nombre Labor</label>
    <input
      type="text"
      value={newLabor}
      onChange={(e) => {
        const cleaned = e.target.value.toUpperCase().replace(/[^A-Z ]/g, '');
        setNewLabor(cleaned);
      }}
      placeholder="Nueva Labor (Mayúsculas, sin acentos)"
      className="px-4 py-2 rounded-lg bg-[#1A1A1A] border border-[#333] text-white w-full"
    />
  </div>

  {/* Campo Tipo con múltiples opciones */}
<div ref={tipoDropdownRef} className="flex flex-col min-w-[200px] relative">
  <label className="text-sm font-semibold text-white mb-1">Tipo</label>
  <button
    onClick={() => setShowTipoDropdown(!showTipoDropdown)}
    className="bg-[#1A1A1A] text-white border border-[#333] px-4 py-2 rounded text-left w-full"
  >
    {tipoSeleccionado.length > 0 ? tipoSeleccionado.join(', ') : 'Seleccione uno o más'}
  </button>

  {showTipoDropdown && (
    <div className="absolute z-50 mt-2 bg-[#1A1A1A] border border-[#333] rounded w-full shadow-md">
      {tipoOptions.map((tipo) => (
        <label key={tipo} className="flex items-center px-4 py-2 text-sm text-white hover:bg-[#2A2A2A]">
          <input
            type="checkbox"
            className="mr-2 accent-blue-500"
            checked={tipoSeleccionado.includes(tipo)}
           onChange={() => {
  setTipoSeleccionado((prev) => {
    const isSelected = prev.includes(tipo);

    // Si está seleccionado y se vuelve a hacer clic (deselección)
    if (isSelected) {
      return prev.filter((t) => t !== tipo);
    }

    // Si está seleccionando "N/A"
    if (tipo === 'N/A') {
      return ['N/A']; // Solo N/A, borra todos los demás
    }

    // Si "N/A" ya estaba seleccionado, bloquear otros
    if (prev.includes('N/A')) {
      toast.error('No puedes seleccionar otros tipos junto con "N/A"');
      return prev;
    }

    // Validar máximo 3 tipos distintos (excluyendo N/A)
    if (prev.length >= 3) {
      toast.error('Solo puedes seleccionar hasta 3 tipos');
      return prev;
    }

    return [...prev, tipo];
  });
}}
          />
          {tipo}
        </label>
      ))}
    </div>
  )}
</div> 

  {/* Botón Agregar */}
  <div>
    <button
  onClick={addLabor}
  disabled={adding || newLabor.trim() === '' || tipoSeleccionado.length === 0}
  className={`px-5 py-2 rounded-lg text-white font-medium ${
    adding || newLabor.trim() === '' || tipoSeleccionado.length === 0
      ? 'bg-gray-500 cursor-not-allowed'
      : 'bg-blue-600 hover:bg-blue-700'
  }`}
>
  {adding ? 'Agregando...' : 'Agregar'}
</button>
  </div>
</div>

        <input
          type="text"
          placeholder="Buscar labor..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full mb-6 px-4 py-2 rounded-lg bg-[#1A1A1A] border border-[#333] text-white"
        />
       {showEditModal && editingLaborId !== null && (
  <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center">
    <div className="flex w-full max-w-6xl h-[90vh] bg-[#1A1A1A] rounded-lg border border-[#333] overflow-hidden shadow-lg">
      
      {/* Formulario lateral */}
      <div className="w-[320px] p-4 bg-[#1A1A1A] border-r border-[#333] overflow-y-auto">
        <h2 className="text-lg font-semibold text-white mb-4">
  {labores.find(l => l.id === editingLaborId)?.['Nombre Labor'] || 'Editar Labor'}
</h2>

        {/* Fecha Inicio */}
        <div className="mb-3">
          <label className="text-[17px] text-blue-400 mb-1 block">Fecha Inicio</label>
          <input
            type="date"
            value={formularioPorLabor[editingLaborId]?.inicio || ''}
            onChange={(e) =>
              setFormularioPorLabor((prev) => ({
                ...prev,
                [editingLaborId]: {
                  ...prev[editingLaborId],
                  inicio: e.target.value,
                },
              }))
            }
            className="bg-[#1A1A1A] text-white border border-[#333] px-3 py-2 rounded w-full"
          />
        </div>

        {/* Fecha Fin */}
        <div className="mb-4">
          <label className="text-[17px] text-blue-400 mb-1 block">Fecha Fin</label>
          <input
            type="date"
            value={formularioPorLabor[editingLaborId]?.fin || ''}
            onChange={(e) =>
              setFormularioPorLabor((prev) => ({
                ...prev,
                [editingLaborId]: {
                  ...prev[editingLaborId],
                  fin: e.target.value,
                },
              }))
            }
            className="bg-[#1A1A1A] text-white border border-[#333] px-3 py-2 rounded w-full"
          />
        </div>
      {/* TÚNELES */}
{tipoPorLabor[editingLaborId]?.includes('TUNELES') && (
  <div className="mb-4">
    <strong className="block text-[17px] text-blue-400 font-semibold mb-2">Túneles</strong>

    {Object.entries({
      'Etapa 1': Object.keys(SECTOR_TUNNELS).filter(sec => /^[12]/.test(sec)),
      'Etapa 2': Object.keys(SECTOR_TUNNELS).filter(sec => /^[3-5]/.test(sec)),
      'Etapa 3': Object.keys(SECTOR_TUNNELS).filter(sec => /^[67]/.test(sec)),
      'Etapa 4': Object.keys(SECTOR_TUNNELS).filter(sec => /^[8]/.test(sec)),
    }).map(([etapa, seccionesEtapa]) => {
      const allTunnelNames = seccionesEtapa.flatMap(sec => {
        const [start, end] = SECTOR_TUNNELS[sec];
        return Array.from({ length: end - start + 1 }, (_, i) => `${sec} Tunel ${i + start}`);
      });

      const allSelected = allTunnelNames.every(t =>
        (formularioPorLabor[editingLaborId]?.secciones || []).includes(t)
      );

      return (
        <div key={etapa} className="mb-4">
          <label className="flex items-center gap-2 text-sm text-blue-300 mb-2">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={(e) => {
                const selected = new Set(formularioPorLabor[editingLaborId]?.secciones || []);
                if (e.target.checked) {
                  allTunnelNames.forEach(name => selected.add(name));
                } else {
                  allTunnelNames.forEach(name => selected.delete(name));
                }

                setFormularioPorLabor((prev) => ({
                  ...prev,
                  [editingLaborId]: {
                    ...prev[editingLaborId],
                    secciones: Array.from(selected),
                  },
                }));

                window.frames[0]?.postMessage({
                  type: 'ACTUALIZAR_POLIGONOS_MAPA',
                  secciones: Array.from(selected),
                }, '*');
              }}
              className="accent-blue-500"
            />
            <strong>{etapa}</strong>
          </label>

          <div className="grid grid-cols-2 gap-2 pl-2">
            {seccionesEtapa.map(sec => {
              const [start, end] = SECTOR_TUNNELS[sec];
              const tuneles = Array.from({ length: end - start + 1 }, (_, i) => `${sec} Tunel ${i + start}`);
              const allTunelesSelected = tuneles.every(t =>
                (formularioPorLabor[editingLaborId]?.secciones || []).includes(t)
              );

              return (
                <label key={sec} className="flex items-center gap-2 text-sm text-blue-300">
                  <input
                    type="checkbox"
                    checked={allTunelesSelected}
                    onChange={(e) => {
                      const selected = new Set(formularioPorLabor[editingLaborId]?.secciones || []);
                      if (e.target.checked) {
                        selected.add(sec);
                        tuneles.forEach(t => selected.add(t));
                      } else {
                        selected.delete(sec);
                        tuneles.forEach(t => selected.delete(t));
                      }

                      setFormularioPorLabor((prev) => ({
                        ...prev,
                        [editingLaborId]: {
                          ...prev[editingLaborId],
                          secciones: Array.from(selected),
                        },
                      }));

                      window.frames[0]?.postMessage({
                        type: 'ACTUALIZAR_POLIGONOS_MAPA',
                        secciones: Array.from(selected),
                      }, '*');
                    }}
                    className="accent-blue-500"
                  />
                  {sec}
                </label>
              );
            })}
          </div>
        </div>
      );
    })}
  </div>
)}

        {/* Caminos */}
       {tipoPorLabor[editingLaborId]?.includes('CAMINOS') && dynamicCaminos.length > 0 && (
  <div className="mb-4">
    <strong className="block text-[17px] text-blue-400 mb-2">Caminos</strong>

    {Object.entries({
      'Etapa 1': [
        'Camino 1A-1C', 'Camino 1B-1D', 'Camino 1C-2B', 'Camino 1D-1E',
        'Camino 2A-2C', 'Camino 2B-2D', 'Camino 2C-2E',
        'Camino Reservorio-2A', 'Camino Zanja Principal-1A'
      ],
      'Etapa 2': [
        'Camino 3A-4A', 'Camino 3B-4B', 'Camino 3C-4C',
        'Camino 4A-5A', 'Camino 4B-5B', 'Camino 4C-5C'
      ],
      'Etapa 3': [
        'Camino 7A-6B/6C', 'Camino 7B-7A/6B', 'Camino 7C-6D', 'Camino 7D-7C',
        'Camino 7E', 'Camino 7E-7D', 'Camino Lateral derecho 7D-7C', 'Camino 6D-6C',
        'Camino Principal 6s', 'Camino Principal 7s', 'Camino lateral derecho 6D-6C'
      ]
    }).map(([etapa, caminosEtapa]) => {
      const todasSeleccionadas = caminosEtapa.every(c =>
        (formularioPorLabor[editingLaborId]?.secciones || []).includes(c)
      );

      return (
        <div key={etapa} className="mb-4">
          <label className="flex items-center gap-2 text-sm text-blue-300 mb-2">
            <input
              type="checkbox"
              checked={todasSeleccionadas}
              onChange={(e) => {
                const selected = new Set(formularioPorLabor[editingLaborId]?.secciones || []);
                if (e.target.checked) {
                  caminosEtapa.forEach(c => selected.add(c));
                } else {
                  caminosEtapa.forEach(c => selected.delete(c));
                }

                const nuevasSecciones = Array.from(selected);

                setFormularioPorLabor((prev) => ({
                  ...prev,
                  [editingLaborId]: {
                    ...prev[editingLaborId],
                    secciones: nuevasSecciones,
                  },
                }));

                window.frames[0]?.postMessage({
                  type: 'ACTUALIZAR_POLIGONOS_MAPA',
                  secciones: nuevasSecciones,
                }, '*');
              }}
              className="accent-blue-500"
            />
            <strong>{etapa}</strong>
          </label>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 pl-4">
            {caminosEtapa.map(c => (
              <label key={c} className="flex items-center gap-2 text-sm text-blue-300">
                <input
                  type="checkbox"
                  checked={(formularioPorLabor[editingLaborId]?.secciones || []).includes(c)}
                  onChange={(e) => {
                    const selected = new Set(formularioPorLabor[editingLaborId]?.secciones || []);
                    if (e.target.checked) {
                      selected.add(c);
                    } else {
                      selected.delete(c);
                    }

                    const nuevasSecciones = Array.from(selected);

                    setFormularioPorLabor((prev) => ({
                      ...prev,
                      [editingLaborId]: {
                        ...prev[editingLaborId],
                        secciones: nuevasSecciones,
                      },
                    }));

                    window.frames[0]?.postMessage({
                      type: 'ACTUALIZAR_POLIGONOS_MAPA',
                      secciones: nuevasSecciones,
                    }, '*');
                  }}
                  className="accent-blue-500"
                />
                {c}
              </label>
            ))}
          </div>
        </div>
      );
    })}
  </div>
)}

        {/* Periferias */}
      {tipoPorLabor[editingLaborId]?.includes('PERIFERIA') && dynamicPeriferias.length > 0 && (
  <div className="mb-4">
    <strong className="block text-[17px] text-blue-400 mb-2">Periferias</strong>

    {Object.entries({
      'Etapa 1': [
        'Periferia 2E', 'Periferia 2D', 'Periferia 1E',
        'Periferia Camino 2mts 2A/2C-2B/2D',
        'Periferia Camino 2mts 1A/1C/2B-1B/1D/1E',
        'Periferia Canal Biloxi'
      ],
      'Etapa 2': [
        'Periferia 3A', 'Periferia 3B', 'Periferia 3C', 'Periferia Divemex 1', 'Periferia Divemex 2',
        'Periferia Externa 5C', 'Periferia Interna 5C', 'Periferia Externa 5A', 'Periferia Interna 5A',
        'Periferia Externa 5B', 'Periferia Interna 5B', 'Periferia Reyes',
        'Periferia camino 2mts 2da etapa Bs y Cs', 'Periferia canal 2da etapa As y Bs'
      ],
      'Etapa 3': [
        'Periferia 7B', 'Periferia Canal 6C-6D', 'Periferia Canal 7E-7C',
        'Periferia Lateral 7B-6A', 'Periferia Zanja Principal 6A', 'Periferia Zanja Principal 6C'
      ]
    }).map(([etapa, periferiasEtapa]) => {
      const todasSeleccionadas = periferiasEtapa.every(p =>
        (formularioPorLabor[editingLaborId]?.secciones || []).includes(p)
      );

      return (
        <div key={etapa} className="mb-4">
          <label className="flex items-center gap-2 text-sm text-blue-300 mb-2">
            <input
              type="checkbox"
              checked={todasSeleccionadas}
              onChange={(e) => {
                const selected = new Set(formularioPorLabor[editingLaborId]?.secciones || []);
                if (e.target.checked) {
                  periferiasEtapa.forEach(p => selected.add(p));
                } else {
                  periferiasEtapa.forEach(p => selected.delete(p));
                }

                const nuevasSecciones = Array.from(selected);

                setFormularioPorLabor((prev) => ({
                  ...prev,
                  [editingLaborId]: {
                    ...prev[editingLaborId],
                    secciones: nuevasSecciones,
                  },
                }));

                window.frames[0]?.postMessage({
                  type: 'ACTUALIZAR_POLIGONOS_MAPA',
                  secciones: nuevasSecciones,
                }, '*');
              }}
              className="accent-blue-500"
            />
            <strong>{etapa}</strong>
          </label>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 pl-4">
            {periferiasEtapa.map(p => (
              <label key={p} className="flex items-center gap-2 text-sm text-blue-300">
                <input
                  type="checkbox"
                  checked={(formularioPorLabor[editingLaborId]?.secciones || []).includes(p)}
                  onChange={(e) => {
                    const selected = new Set(formularioPorLabor[editingLaborId]?.secciones || []);
                    if (e.target.checked) {
                      selected.add(p);
                    } else {
                      selected.delete(p);
                    }

                    const nuevasSecciones = Array.from(selected);

                    setFormularioPorLabor((prev) => ({
                      ...prev,
                      [editingLaborId]: {
                        ...prev[editingLaborId],
                        secciones: nuevasSecciones,
                      },
                    }));

                    window.frames[0]?.postMessage({
                      type: 'ACTUALIZAR_POLIGONOS_MAPA',
                      secciones: nuevasSecciones,
                    }, '*');
                  }}
                  className="accent-blue-500"
                />
                {p}
              </label>
            ))}
          </div>
        </div>
      );
    })}
  </div>
)}

        {/* Botones */}
        <div className="flex gap-2 mt-2 justify-end">
          <button
            onClick={() => {
              setShowEditModal(false);
              setEditingLaborId(null);
            }}
            className="bg-gray-600 hover:bg-gray-700 text-white text-xs px-3 py-1 rounded"
          >
            Cancelar
          </button>
          <button
            onClick={confirmActivation}
            className="bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1 rounded"
          >
            Guardar
          </button>
        </div>
      </div>

     {/* Mapa de labores */}
<div className="flex-1 min-h-[600px] h-[calc(100vh-4rem)]">
  <iframe
  src={`/#/app/labores-map?laborId=${editingLaborId}&tipo=${tipoPorLabor[editingLaborId]}`}
  className="w-full h-full border-none"
  title="Mapa de Labores"
/>
</div>
    </div>
  </div>
      
)}

    {/* Activas */}
<div className="mb-4">
  <div
    onClick={() => setShowActive(!showActive)}
    className="flex items-center gap-2 cursor-pointer select-none text-[#3B82F6] mb-2"
  >
    <svg
      className={`w-4 h-4 transform transition-transform ${showActive ? 'rotate-90' : 'rotate-0'}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
    <h2 className="text-lg font-semibold">Activa</h2>
  </div>

  {showActive && activeLabores.map((labor) => (
    <div
      key={labor.id}
      className="flex flex-col md:flex-row justify-between items-start md:items-center p-4 bg-[#1A1A1A] rounded-lg border border-[#333] mb-2"
    >
      <div className="w-full md:w-auto">
        <div className="font-semibold text-lg mb-1">{labor['Nombre Labor']}</div>

        <div className="flex flex-col text-sm text-gray-300 space-y-1">
          <div>
            Inicio: {labor['Fecha Inicio'] ?? '—'} &nbsp;|&nbsp; Fin: {labor['Fecha Fin'] ?? '—'}
          </div>
          <div>
            Secciones:{' '}
            <span
              className="ml-1 underline text-gray-100 cursor-pointer"
              onClick={() => alert(labor.Seccion || 'Sin secciones')}
            >
              {labor.Seccion
                ? labor.Seccion.split(',')[0] +
                  (labor.Seccion.split(',').length > 1 ? '...' : '')
                : '—'}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 mt-4 md:mt-0">
        <button
          onClick={async () => {
            const { data, error } = await supabase
              .from('Labores Personal')
              .select('Tipo')
              .eq('id', labor.id)
              .single();

            if (error || !data?.Tipo) {
              toast.error('Error cargando tipo de labor');
              return;
            }

            const tipo = data.Tipo.toUpperCase().trim();
            setTipoPorLabor(prev => ({ ...prev, [labor.id]: tipo }));

            let posiblesSecciones: string[] = [];
            if (tipo.includes('TUNELES')) posiblesSecciones.push(...Object.keys(SECTOR_TUNNELS));
            if (tipo.includes('CAMINOS')) posiblesSecciones.push(...dynamicCaminos);
            if (tipo.includes('PERIFERIA')) posiblesSecciones.push(...dynamicPeriferias);

            setSeccionesPorLabor(prev => ({ ...prev, [labor.id]: posiblesSecciones }));

            const rawSecciones = (labor.Seccion || '').split(',').map(s => s.trim()).filter(Boolean);
            let seleccionadas: string[] = [];

            if (tipo.includes('TUNELES')) {
              const tunelSectores = rawSecciones.map(sec => {
                const match = sec.match(/^([1-8][A-F])\s+Tunel\s+\d+$/i);
                return match ? match[1] : null;
              }).filter(Boolean);
              seleccionadas.push(...tunelSectores);
            }

            if (tipo.includes('CAMINOS')) {
              seleccionadas.push(...rawSecciones.filter(sec => dynamicCaminos.includes(sec)));
            }

            if (tipo.includes('PERIFERIA')) {
              seleccionadas.push(...rawSecciones.filter(sec => dynamicPeriferias.includes(sec)));
            }

            const seccionesLimpias = Array.from(new Set(seleccionadas));

            setFormularioPorLabor(prev => ({
              ...prev,
              [labor.id]: {
                inicio: labor['Fecha Inicio'] || '',
                fin: labor['Fecha Fin'] || '',
                secciones: seccionesLimpias,
              }
            }));

            setSecciones(seccionesLimpias);
            setEditingLaborId(labor.id);
            setShowEditModal(true);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white py-1 px-3 rounded-md"
        >
          Modificar
        </button>

        <button
          onClick={() => toggleLabor(labor.id, labor.Activa)}
          className="px-4 py-1 text-sm bg-green-600 hover:bg-red-700 text-white rounded-lg w-fit"
        >
          Desactivar
        </button>
      </div>
    </div>
  ))}
</div>
      {/* Inactivas */}
<div className="mb-4">
  <div
    onClick={() => setShowInactive(!showInactive)}
    className="flex items-center gap-2 cursor-pointer select-none text-[#3B82F6] mb-2"
  >
    <svg
      className={`w-4 h-4 transform transition-transform ${showInactive ? 'rotate-90' : 'rotate-0'}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
    <h2 className="text-lg font-semibold">Inactivas</h2>
  </div>

  {showInactive && inactiveLabores.map((labor) => (
    <div
      key={labor.id}
      className="flex flex-col p-4 bg-[#1A1A1A] rounded-lg border border-[#333] mb-2"
    >
      <span className="font-semibold mb-2">{labor['Nombre Labor']}</span>

 {activatingId === labor.id ? (
  <div className="grid grid-cols-1 gap-4 mb-2 bg-[#111] p-4 rounded-lg">
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label className="text-[17px] text-blue-400 mb-1 block">Fecha Inicio</label>
    <input
  type="date"
  value={formularioPorLabor[labor.id]?.inicio || ''}
  onChange={(e) => {
    const value = e.target.value;
    setFormularioPorLabor((prev) => ({
      ...prev,
      [labor.id]: {
        ...prev[editingLaborId],
        inicio: value,
        fin: prev[labor.id]?.fin || '',
        secciones: prev[labor.id]?.secciones || [],
      }
    }));
  }}
  className="bg-[#1A1A1A] text-blue-400 border border-[#333] px-3 py-2 rounded w-full"
/>
      </div>
      <div>
        <label className="text-[17px] text-blue-400 mb-1 block">Fecha Fin</label>
        <input
  type="date"
  value={formularioPorLabor[editingLaborId]?.fin || ''}
  onChange={(e) => {
    const value = e.target.value;
    setFormularioPorLabor((prev) => ({
      ...prev,
      [labor.id]: {
        ...prev[labor.id],
        inicio: prev[labor.id]?.inicio || '',
        fin: value,
        secciones: prev[labor.id]?.secciones || [],
      }
    }));
  }}
  className="bg-[#1A1A1A] text-blue-400 border border-[#333] px-3 py-2 rounded w-full"
/>
      </div>
    </div>

{/* SECCIONES */}
<div>
  <label className="text-[17px] text-blue-400 mb-2 block">Secciones</label>

  {/* Túneles agrupados en etapas */}
  {tipoPorLabor[labor.id]?.includes('TUNELES') && Object.entries({
    'Etapa 1': seccionesPorLabor[labor.id]?.filter(sec => /^[12]/.test(sec)),
    'Etapa 2': seccionesPorLabor[labor.id]?.filter(sec => /^[3-5]/.test(sec)),
    'Etapa 3': seccionesPorLabor[labor.id]?.filter(sec => /^[67]/.test(sec)),
    'Etapa 4': seccionesPorLabor[labor.id]?.filter(sec => /^[8]/.test(sec))
  }).map(([etapa, seccionesEtapa]) => (
    seccionesEtapa.length > 0 && (
      <div key={etapa} className="mb-4">
        <label className="flex items-center gap-2 text-sm text-blue-300 mb-2">
          <input
            type="checkbox"
            checked={seccionesEtapa.every(sec =>
              (formularioPorLabor[labor.id]?.secciones || []).includes(sec)
            )}
            onChange={(e) => {
              const selected = new Set(formularioPorLabor[labor.id]?.secciones || []);
              seccionesEtapa.forEach(sec =>
                e.target.checked ? selected.add(sec) : selected.delete(sec)
              );
              setFormularioPorLabor(prev => ({
                ...prev,
                [labor.id]: {
                  ...prev[labor.id],
                  secciones: Array.from(selected),
                }
              }));
            }}
            className="accent-blue-500"
          />
          <strong>{etapa}</strong>
        </label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 pl-4">
          {seccionesEtapa.map(sec => (
            <label key={sec} className="flex items-center gap-2 text-sm text-blue-300">
              <input
                type="checkbox"
                checked={(formularioPorLabor[labor.id]?.secciones || []).includes(sec)}
                onChange={(e) => {
                  const selected = new Set(formularioPorLabor[labor.id]?.secciones || []);
                  if (e.target.checked) {
                    selected.add(sec);
                  } else {
                    selected.delete(sec);
                  }
                  setFormularioPorLabor(prev => ({
                    ...prev,
                    [labor.id]: {
                      ...prev[labor.id],
                      secciones: Array.from(selected),
                    }
                  }));
                }}
                className="accent-blue-500"
              />
              {sec}
            </label>
          ))}
        </div>
      </div>
    )
  ))}

  {/* Caminos */}
  {tipoPorLabor[labor.id]?.includes('CAMINOS') && dynamicCaminos.length > 0 && (
    <div className="mb-4">
      <strong className="block text-sm text-blue-300 mb-2">Caminos</strong>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 pl-4">
        {dynamicCaminos.map(sec => (
          <label key={sec} className="flex items-center gap-2 text-sm text-blue-300">
            <input
              type="checkbox"
              checked={(formularioPorLabor[labor.id]?.secciones || []).includes(sec)}
              onChange={(e) => {
                const selected = new Set(formularioPorLabor[labor.id]?.secciones || []);
                e.target.checked ? selected.add(sec) : selected.delete(sec);
                setFormularioPorLabor(prev => ({
                  ...prev,
                  [labor.id]: {
                    ...prev[labor.id],
                    secciones: Array.from(selected),
                  }
                }));
              }}
              className="accent-blue-500"
            />
            {sec}
          </label>
        ))}
      </div>
    </div>
  )}

 {/* Periferias */}
{tipoPorLabor[labor.id]?.includes('PERIFERIA') && dynamicPeriferias.length > 0 && (
  <div className="mb-4">
    <strong className="block text-sm text-blue-300 mb-2">Periferias</strong>
    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 pl-4">
      {dynamicPeriferias.map(sec => (
        <label key={sec} className="flex items-center gap-2 text-sm text-blue-300">
          <input
            type="checkbox"
            checked={(formularioPorLabor[labor.id]?.secciones || []).includes(sec)}
            onChange={(e) => {
              const prevForm = formularioPorLabor[labor.id] || {
                inicio: '',
                fin: '',
                secciones: [],
              };
              const selected = new Set(prevForm.secciones);
              if (e.target.checked) {
                selected.add(sec);
              } else {
                selected.delete(sec);
              }

              setFormularioPorLabor((prev) => ({
                ...prev,
                [labor.id]: {
                  ...prevForm,
                  secciones: Array.from(selected),
                },
              }));
            }}
            className="accent-blue-500"
          />
          {sec}
        </label>
      ))}
    </div>
  </div>
)}
</div>

   <div className="flex gap-2 mt-4">
  <button
    onClick={async () => {
      const form = formularioPorLabor[labor.id];
      if (!form || !form.inicio || !form.fin || form.secciones.length === 0) {
        alert('Faltan campos por llenar');
        return;
      }

      const seccionesExpandida = form.secciones.flatMap(sec => {
        if (SECTOR_TUNNELS[sec]) {
          const [start, end] = SECTOR_TUNNELS[sec];
          return Array.from({ length: end - start + 1 }, (_, i) => `${sec} Tunel ${i + start}`);
        } else {
          return [sec];
        }
      });

      const { data, error } = await supabase
  .from('Labores Personal')
  .update({
    Activo: true,
    'Fecha Inicio': form.inicio,
    'Fecha Fin': form.fin,
    Seccion: seccionesExpandida.join(','),
  })
  .eq('id', Number(labor.id)) // asegúrate que sea tipo numérico
  .select(); // 👈 Esto devuelve el resultado actualizado

      if (error) {
        console.error('Error activando labor:', error);
        alert('Error al guardar');
      } else {
        setActivatingId(null);
        setFormularioPorLabor(prev => {
          const copy = { ...prev };
          delete copy[labor.id];
          return copy;
        });
      
        fetchLabores();
      }
    }}
    className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg"
  >
    Confirmar
  </button>

  <button
    onClick={() => {
      setActivatingId(null);
      setFormularioPorLabor(prev => {
        const copy = { ...prev };
        delete copy[labor.id];
        return copy;
      });
     
    }}
    className="bg-gray-600 hover:bg-gray-700 text-white text-sm px-4 py-2 rounded-lg"
  >
    Cancelar
  </button>
</div>
  </div>
) : (
<button
  onClick={async () => {
    const { data, error } = await supabase
      .from('Labores Personal')
      .select('Tipo')
      .eq('id', labor.id)
      .single();

    if (error || !data?.Tipo) {
      toast.error('Error cargando tipo de labor');
      return;
    }

    const tipo = data.Tipo.toUpperCase().trim();
    setTipoPorLabor(prev => ({ ...prev, [labor.id]: tipo }));

    let posiblesSecciones: string[] = [];
    if (tipo.includes('TUNELES')) posiblesSecciones.push(...Object.keys(SECTOR_TUNNELS));
    if (tipo.includes('CAMINOS')) posiblesSecciones.push(...dynamicCaminos);
    if (tipo.includes('PERIFERIA')) posiblesSecciones.push(...dynamicPeriferias);

    setSeccionesPorLabor(prev => ({ ...prev, [labor.id]: posiblesSecciones }));

    const rawSecciones = (labor.Seccion || '').split(',').map(s => s.trim()).filter(Boolean);
    let seleccionadas: string[] = [];

    if (tipo.includes('TUNELES')) {
      const tunelSectores = rawSecciones.map(sec => {
        const match = sec.match(/^([1-8][A-F])\s+Tunel\s+\d+$/i);
        return match ? match[1] : null;
      }).filter(Boolean);
      seleccionadas.push(...tunelSectores);
    }

    if (tipo.includes('CAMINOS')) {
      seleccionadas.push(...rawSecciones.filter(sec => dynamicCaminos.includes(sec)));
    }

    if (tipo.includes('PERIFERIA')) {
      seleccionadas.push(...rawSecciones.filter(sec => dynamicPeriferias.includes(sec)));
    }

    const seccionesLimpias = Array.from(new Set(seleccionadas));

    setFormularioPorLabor(prev => ({
      ...prev,
      [labor.id]: {
        inicio: labor['Fecha Inicio'] || '',
        fin: labor['Fecha Fin'] || '',
        secciones: seccionesLimpias,
      }
    }));

    setSecciones(seccionesLimpias);
    setEditingLaborId(labor.id);
    setShowEditModal(true); // 👈 abre el popup
  }}
  className="px-4 py-1 text-sm bg-red-600 hover:bg-green-700 text-white rounded-lg w-fit"
>
  Activar
</button>
      )}
    </div>
  ))}
</div>
      </div> 
    </div>  
  );
} 