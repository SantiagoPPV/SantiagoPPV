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
  Seccion?: string; // ← importante para mostrar en Activas
}

export default function LaborForm() {
  const [labores, setLabores] = useState<Labor[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [showActive, setShowActive] = useState(true);
  const [secciones, setSecciones] = useState<string[]>([]);
  const [tipoPorLabor, setTipoPorLabor] = useState<Record<number, string>>({});
const [seccionesPorLabor, setSeccionesPorLabor] = useState<Record<number, string[]>>({});
  const [dynamicCaminos, setDynamicCaminos] = useState<string[]>([]);
const [dynamicPeriferias, setDynamicPeriferias] = useState<string[]>([]);
  const [editingLaborId, setEditingLaborId] = useState<number | null>(null);
  const [formularioPorLabor, setFormularioPorLabor] = useState<
  Record<number, { secciones: string[] }>
>({});
  const [caminosCompletos, setCaminosCompletos] = useState<string[]>([]);
  const [modoEliminar, setModoEliminar] = useState(false);
  const [sectoresPlaneados, setSectoresPlaneados] = useState<string[]>([]);
  const [sectoresCompletos, setSectoresCompletos] = useState<string[]>([]);
  const [periferiasCompletas, setPeriferiasCompletas] = useState<string[]>([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const navigate = useNavigate();

  function extraerSectoresDeSecciones(secciones: string[]): string[] {
  const sectores = new Set<string>();
  secciones.forEach(s => {
    const match = s.match(/^([1-8][A-F])\s+Tunel\s+\d+$/);
    if (match) {
      sectores.add(match[1]);
    }
  });
  return Array.from(sectores).sort();
}
  function getTunnelOptions(sector: string): string[] {
  if (!sector || !SECTOR_TUNNELS[sector]) return [];

  const [start, end] = SECTOR_TUNNELS[sector];
  return Array.from({ length: end - start + 1 }, (_, i) => (i + start).toString());
}
 useEffect(() => {
  const fetchAllData = async () => {
    const [laboresResp, muestreoResp] = await Promise.all([
      supabase.from('Labores Personal').select('*').eq('Activo', true).range(0, 9999),
      supabase.from('Muestreos Labores').select('Seccion, "Nombre Labor"').range(0, 9999)
    ]);

    if (laboresResp.error || muestreoResp.error) {
      toast.error('Error al cargar datos');
      return;
    }

    // Filtrar labores que no sean tipo N/A
  const laborData = laboresResp.data
  .filter(l => l.Tipo?.toUpperCase().trim() !== 'N/A')
  .sort((a, b) => a['Nombre Labor'].localeCompare(b['Nombre Labor']));

    const sectores = new Set<string>();
    const tuneles = new Set<string>();

    const todasSecciones = laborData
      .flatMap(l => (l.Seccion || '').split(','))
      .map(s => s.trim())
      .filter(s => /^([1-8][A-F])\s+Tunel\s+\d+$/.test(s));

    todasSecciones.forEach(t => tuneles.add(t));

    setSectoresPlaneados(Array.from(sectores).sort());
    setLabores(laborData); // ← ya filtrado
    setLoading(false);
  };

  fetchAllData();
}, []);
 useEffect(() => {
  const fetchSectoresCompletos = async () => {
    if (!editingLaborId) return;

    const labor = labores.find(l => l.id === editingLaborId);
    if (!labor) return;

    const { data, error } = await supabase
      .from('Muestreos Labores')
      .select('Seccion')
      .eq('Nombre Labor', labor['Nombre Labor'])
      .range(0, 9999);

    if (error) {
      console.error('Error cargando muestreos:', error);
      return;
    }

    const tunelesPorSector: Record<string, Set<number>> = {};

    data?.forEach(row => {
      (row.Seccion || '')
        .split(',')
        .map(s => s.trim())
        .forEach(sec => {
          const match = sec.match(/^([1-8][A-F])\s+Tunel\s+(\d+)$/);
          if (match) {
            const sector = match[1];
            const num = parseInt(match[2], 10);
            if (!tunelesPorSector[sector]) {
              tunelesPorSector[sector] = new Set();
            }
            tunelesPorSector[sector].add(num);
          }
        });
    });

    const completos: string[] = [];
    for (const [sector, [start, end]] of Object.entries(SECTOR_TUNNELS)) {
      const esperado = new Set(Array.from({ length: end - start + 1 }, (_, i) => i + start));
      if (tunelesPorSector[sector] && esperado.size === tunelesPorSector[sector].size &&
          [...esperado].every(t => tunelesPorSector[sector].has(t))) {
        completos.push(sector);
      }
    }

    setSectoresCompletos(completos);
  };

  fetchSectoresCompletos();
}, [editingLaborId]);
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
  const fetchPeriferiasCompletas = async () => {
    if (!editingLaborId) return;

    const labor = labores.find(l => l.id === editingLaborId);
    if (!labor) return;

    const { data, error } = await supabase
      .from('Muestreos Labores')
      .select('Seccion')
      .eq('Nombre Labor', labor['Nombre Labor'])
      .range(0, 9999);

    if (error) {
      console.error('Error cargando muestreos de periferias:', error);
      return;
    }

    const registrados = new Set<string>();
    data?.forEach(row => {
      (row.Seccion || '')
        .split(',')
        .map(s => s.trim())
        .forEach(sec => {
          if (sec.startsWith('Periferia')) registrados.add(sec);
        });
    });

    setPeriferiasCompletas(Array.from(registrados));
  };

  fetchPeriferiasCompletas();
}, [editingLaborId]);
  useEffect(() => {
  const fetchCaminosCompletos = async () => {
    if (!editingLaborId) return;

    const labor = labores.find(l => l.id === editingLaborId);
    if (!labor) return;

    const { data, error } = await supabase
      .from('Muestreos Labores')
      .select('Seccion')
      .eq('Nombre Labor', labor['Nombre Labor'])
      .range(0, 9999);

    if (error) {
      console.error('Error cargando muestreos de caminos:', error);
      return;
    }

    const registrados = new Set<string>();
    data?.forEach(row => {
      (row.Seccion || '')
        .split(',')
        .map(s => s.trim())
        .forEach(sec => {
          if (sec.startsWith('Camino')) registrados.add(sec);
        });
    });

    setCaminosCompletos(Array.from(registrados));
  };

  fetchCaminosCompletos();
}, [editingLaborId]);
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
    .eq('Activo', true) // ← igual que fetchAllData
    .range(0, 9999);

  if (error) {
    console.error('Error fetching labores:', error);
    return;
  }

  // Filtrar labores tipo N/A y ordenar alfabéticamente
  const filtradas = (data || [])
    .filter(l => l.Tipo?.toUpperCase().trim() !== 'N/A')
    .sort((a, b) => a['Nombre Labor'].localeCompare(b['Nombre Labor']));

  setLabores(filtradas);
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
  
 

 const confirmActivation = async () => {
  const id = editingLaborId;

  const form = formularioPorLabor[id ?? -1];
  if (!form || form.secciones.length === 0 || !id) {
    console.warn('Faltan campos para activar o editar la labor');
    return;
  }

  const seccionesExpandida = form.secciones.flatMap(sec => {
    if (SECTOR_TUNNELS[sec]) {
      const [start, end] = SECTOR_TUNNELS[sec];
      return Array.from({ length: end - start + 1 }, (_, i) => `${sec} Tunel ${i + start}`);
    }
    return [sec];
  });

  const nombreLabor = labores.find(l => l.id === id)?.['Nombre Labor'] || '';
  const seccionesTexto = seccionesExpandida.join(', ');
  const fechaActual = new Date().toISOString().split('T')[0];

  const { error: insertError } = await supabase
    .from('Muestreos Labores')
    .insert({
      'Nombre Labor': nombreLabor,
      Fecha: fechaActual,
      Seccion: seccionesTexto,
    });

  if (insertError) {
    console.error('❌ Error al insertar en Muestreos Labores:', insertError);
    toast.error('Error al guardar el muestreo');
    return;
  }

  toast.success('Muestreo guardado');
  setShowEditModal(false);
  setEditingLaborId(null);
  setModoEliminar(false);
  fetchLabores();
};
const handleDeleteMuestreos = async (nombreLabor: string, tunelesAEliminar: string[]) => {
  try {
    const { data, error } = await supabase
      .from('Muestreos Labores')
      .select('ID, Seccion') // 👈 CAMBIO: usar 'ID' (en mayúsculas)
      .eq('Nombre Labor', nombreLabor);

    if (error) throw error;

    const updates = [];
    const deletions = [];

    for (const row of data) {
      const id = row.ID; // 👈 CAMBIO: usar 'ID' en vez de 'id'
      const seccionesOriginales = (row.Seccion || '').split(',').map(s => s.trim()).filter(Boolean);
      const seccionesRestantes = seccionesOriginales.filter(s => !tunelesAEliminar.includes(s));

      if (seccionesRestantes.length === 0) {
        deletions.push(id);
      } else {
        updates.push({ id, Seccion: seccionesRestantes.join(', ') });
      }
    }

    if (deletions.length > 0) {
      const { error: delError } = await supabase
        .from('Muestreos Labores')
        .delete()
        .in('ID', deletions); // 👈 CAMBIO: usar 'ID' aquí también
      if (delError) throw delError;
    }

    for (const upd of updates) {
      const { error: updError } = await supabase
        .from('Muestreos Labores')
        .update({ Seccion: upd.Seccion })
        .eq('ID', upd.id); // 👈 CAMBIO: usar 'ID'
      if (updError) throw updError;
    }

    toast.success('Registros actualizados');
    fetchLabores();
    setShowEditModal(false);
    setModoEliminar(false);
    setEditingLaborId(null);
  } catch (err) {
    console.error('❌ Error en eliminación parcial:', err);
    toast.error('Error al actualizar registros');
  }
};
  const filteredLabores = labores.filter((l) =>
    l['Nombre Labor'].toLowerCase().includes(query.toLowerCase())
  );

  const activeLabores = filteredLabores.filter((l) => l.Activo); // ← corregido
  

  return (
    <div className="bg-[#0D0D0D] min-h-screen text-white font-sans">
      <div className="p-8 max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Registro de labores</h1>
<p className="text-[#A3A3A3] mb-6">
  Registra los avances diarios de las labores.
</p>

      <div className="flex flex-wrap gap-4 mb-4 items-end">
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

       
       {/* TÚNELES */}
{tipoPorLabor[editingLaborId]?.includes('TUNELES') && (
  <div className="mb-4">
    <strong className="block text-[17px] text-blue-400 font-semibold mb-2">Túneles</strong>

    {(() => {
      const seccionesLabor = formularioPorLabor[editingLaborId]?.secciones || [];

      const sectoresPlaneadosLabor = Array.from(
        new Set(
          labores
            .find(l => l.id === editingLaborId)
            ?.Seccion?.split(',')
            .map(s => s.trim())
            .map(s => {
              const match = s.match(/^([1-8][A-F])\s+Tunel\s+\d+$/);
              return match?.[1] || null;
            })
            .filter(Boolean) || []
        )
      );

      const agrupadosPorEtapa = {
        'Etapa 1': sectoresPlaneadosLabor.filter(sec => /^[12]/.test(sec)),
        'Etapa 2': sectoresPlaneadosLabor.filter(sec => /^[3-5]/.test(sec)),
        'Etapa 3': sectoresPlaneadosLabor.filter(sec => /^[67]/.test(sec)),
        'Etapa 4': sectoresPlaneadosLabor.filter(sec => /^[8]/.test(sec)),
      };

      return Object.entries(agrupadosPorEtapa).map(([etapa, seccionesEtapa]) => {
        const allTunnelNames = seccionesEtapa.flatMap(sec => {
          const [start, end] = SECTOR_TUNNELS[sec];
          return Array.from({ length: end - start + 1 }, (_, i) => `${sec} Tunel ${i + start}`);
        });

        const allSelected = allTunnelNames.every(t =>
          seccionesLabor.includes(t)
        );

        return (
          <div key={etapa} className="mb-4">
            <label className="flex items-center gap-2 text-sm text-blue-300 mb-2">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(e) => {
                  const selected = new Set(seccionesLabor);
                  if (e.target.checked) {
                    allTunnelNames.forEach(name => selected.add(name));
                  } else {
                    allTunnelNames.forEach(name => selected.delete(name));
                  }

                  const actualizadas = Array.from(selected);
                  setFormularioPorLabor((prev) => ({
                    ...prev,
                    [editingLaborId]: {
                      ...prev[editingLaborId],
                      secciones: actualizadas,
                    },
                  }));

                  window.frames[0]?.postMessage({
                    type: 'ACTUALIZAR_POLIGONOS_MAPA',
                    secciones: actualizadas,
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
                const todosMarcados = tuneles.every(t => seccionesLabor.includes(t));

                return (
                  <label key={sec} className="flex items-center gap-2 text-sm text-blue-300">
                    <input
                      type="checkbox"
                      checked={todosMarcados}
                      onChange={(e) => {
                        const selected = new Set(seccionesLabor);
                        if (e.target.checked) {
                          tuneles.forEach(t => selected.add(t));
                        } else {
                          tuneles.forEach(t => selected.delete(t));
                        }

                        const actualizadas = Array.from(selected);

                        setFormularioPorLabor((prev) => ({
                          ...prev,
                          [editingLaborId]: {
                            ...prev[editingLaborId],
                            secciones: actualizadas,
                          },
                        }));

                        window.frames[0]?.postMessage({
                          type: 'ACTUALIZAR_POLIGONOS_MAPA',
                          secciones: actualizadas,
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
      });
    })()}
  </div>
)}

        {/* Caminos */}
{tipoPorLabor[editingLaborId]?.includes('CAMINOS') && dynamicCaminos.length > 0 && (
  <div className="mb-4">
    <strong className="block text-[17px] text-blue-400 font-semibold mb-2">Caminos</strong>

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
      const seccionesLabor = formularioPorLabor[editingLaborId]?.secciones || [];
      const todasSeleccionadas = caminosEtapa.every(c => seccionesLabor.includes(c));

      return (
        <div key={etapa} className="mb-4">
          <label className="flex items-center gap-2 text-sm text-blue-300 mb-2">
            <input
              type="checkbox"
              checked={todasSeleccionadas}
              onChange={(e) => {
                const selected = new Set(seccionesLabor);
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
            {caminosEtapa.map(c => {
              const isChecked = seccionesLabor.includes(c);

              return (
                <label key={c} className="flex items-center gap-2 text-sm text-blue-300">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) => {
                      const selected = new Set(seccionesLabor);
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
              );
            })}
          </div>
        </div>
      );
    })}
  </div>
)}

     {/* Periferias */}
{tipoPorLabor[editingLaborId]?.includes('PERIFERIA') && dynamicPeriferias.length > 0 && (
  <div className="mb-4">
    <strong className="block text-[17px] text-blue-400 font-semibold mb-2">Periferias</strong>

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
      const seccionesLabor = formularioPorLabor[editingLaborId]?.secciones || [];

      const todasSeleccionadas = periferiasEtapa.every(p =>
        seccionesLabor.includes(p)
      );

      return (
        <div key={etapa} className="mb-4">
          <label className="flex items-center gap-2 text-sm text-blue-300 mb-2">
            <input
              type="checkbox"
              checked={todasSeleccionadas}
              onChange={(e) => {
                const selected = new Set(seccionesLabor);
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
                  estilo: 'verde',
                }, '*');
              }}
              className="accent-blue-500"
            />
            <strong>{etapa}</strong>
          </label>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 pl-4">
            {periferiasEtapa.map(p => {
              const isChecked = seccionesLabor.includes(p);

              return (
                <label key={p} className="flex items-center gap-2 text-sm text-blue-300">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) => {
                      const selected = new Set(seccionesLabor);
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
              );
            })}
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
      setModoEliminar(false); // también reinicia el modo
    }}
    className="bg-gray-600 hover:bg-gray-700 text-white text-xs px-3 py-1 rounded"
  >
    Cancelar
  </button>

  {modoEliminar ? (
   <button
  onClick={async () => {
    const id = editingLaborId;
    const nombreLabor = labores.find(l => l.id === id)?.['Nombre Labor'] || '';
    const tunelesSeleccionados = formularioPorLabor[id ?? -1]?.secciones || [];

    if (!nombreLabor || tunelesSeleccionados.length === 0) {
      toast.error('Selecciona al menos un túnel para eliminar');
      return;
    }

    await handleDeleteMuestreos(nombreLabor, tunelesSeleccionados);
  }}
  className="bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-1 rounded"
>
  Eliminar registros
</button>
  ) : (
    <button
      onClick={async () => {
        await confirmActivation();
        setShowEditModal(false);
        setEditingLaborId(null);
        setModoEliminar(false);
      }}
      className="bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1 rounded"
    >
      Guardar
    </button>
  )}
</div>
      </div>

     {/* Mapa de labores */}
<div className="flex-1 min-h-[600px] h-[calc(100vh-4rem)]">
  <iframe
  src={`/#/app/form-labores-map?laborId=${editingLaborId}&tipo=${tipoPorLabor[editingLaborId]}`}
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
  {/* AGREGAR REGISTRO */}
  <button
    onClick={async () => {
      const { data: tipoData, error: tipoError } = await supabase
        .from('Labores Personal')
        .select('Tipo')
        .eq('id', labor.id)
        .single();

      if (tipoError || !tipoData?.Tipo) {
        toast.error('Error cargando tipo de labor');
        return;
      }

      const tipo = tipoData.Tipo.toUpperCase().trim();
      setTipoPorLabor(prev => ({ ...prev, [labor.id]: tipo }));

      const { data, error } = await supabase
        .from('Muestreos Labores')
        .select('Seccion')
        .eq('Nombre Labor', labor['Nombre Labor']);

      if (error || !data) {
        toast.error('Error cargando secciones');
        return;
      }

      const secciones = data.flatMap(r =>
        (r.Seccion || '').split(',').map(s => s.trim()).filter(Boolean)
      );
      const unicas = Array.from(new Set(secciones));

      setFormularioPorLabor(prev => ({
        ...prev,
        [labor.id]: { secciones: unicas }
      }));

      setEditingLaborId(labor.id);
      setShowEditModal(true);
      setModoEliminar(false);

      // Mostrar polígonos en verde
      window.frames[0]?.postMessage({
        type: 'ACTUALIZAR_POLIGONOS_MAPA',
        secciones: unicas,
        estilo: 'verde',
      }, '*');

      // Completar visuales
      const tunelesPorSector: Record<string, Set<number>> = {};
      unicas.forEach(sec => {
        const match = sec.match(/^([1-8][A-F])\s+Tunel\s+(\d+)$/);
        if (match) {
          const sector = match[1];
          const num = parseInt(match[2], 10);
          if (!tunelesPorSector[sector]) tunelesPorSector[sector] = new Set();
          tunelesPorSector[sector].add(num);
        }
      });

      const completos: string[] = [];
      for (const [sector, [start, end]] of Object.entries(SECTOR_TUNNELS)) {
        const esperado = new Set(Array.from({ length: end - start + 1 }, (_, i) => i + start));
        if (tunelesPorSector[sector] &&
            esperado.size === tunelesPorSector[sector].size &&
            [...esperado].every(t => tunelesPorSector[sector].has(t))) {
          completos.push(sector);
        }
      }

      setSectoresCompletos(completos);
      setCaminosCompletos(unicas.filter(s => s.startsWith('Camino')));
      setPeriferiasCompletas(unicas.filter(s => s.startsWith('Periferia')));
    }}
    className="bg-blue-600 hover:bg-blue-700 text-white py-1 px-3 rounded-md"
  >
    Agregar Registro
  </button>

  {/* ELIMINAR REGISTRO */}
  <button
    onClick={async () => {
      const { data: tipoData, error: tipoError } = await supabase
        .from('Labores Personal')
        .select('Tipo')
        .eq('id', labor.id)
        .single();

      if (tipoError || !tipoData?.Tipo) {
        toast.error('Error cargando tipo de labor');
        return;
      }

      const tipo = tipoData.Tipo.toUpperCase().trim();
      setTipoPorLabor(prev => ({ ...prev, [labor.id]: tipo }));

      const { data, error } = await supabase
        .from('Muestreos Labores')
        .select('Seccion')
        .eq('Nombre Labor', labor['Nombre Labor']);

      if (error || !data || data.length === 0) {
        toast.error('No hay registros para eliminar');
        return;
      }

      const secciones = data.flatMap(r =>
        (r.Seccion || '').split(',').map(s => s.trim()).filter(Boolean)
      );
      const unicas = Array.from(new Set(secciones));

      setFormularioPorLabor(prev => ({
        ...prev,
        [labor.id]: { secciones: unicas }
      }));

      setEditingLaborId(labor.id);
      setShowEditModal(true);
      setModoEliminar(true);

      // Mostrar polígonos en naranja
      window.frames[0]?.postMessage({
        type: 'ACTUALIZAR_POLIGONOS_MAPA',
        secciones: unicas,
        estilo: 'Naranja',
      }, '*');

      // Completar visuales
      const tunelesPorSector: Record<string, Set<number>> = {};
      unicas.forEach(sec => {
        const match = sec.match(/^([1-8][A-F])\s+Tunel\s+(\d+)$/);
        if (match) {
          const sector = match[1];
          const num = parseInt(match[2], 10);
          if (!tunelesPorSector[sector]) tunelesPorSector[sector] = new Set();
          tunelesPorSector[sector].add(num);
        }
      });

      const completos: string[] = [];
      for (const [sector, [start, end]] of Object.entries(SECTOR_TUNNELS)) {
        const esperado = new Set(Array.from({ length: end - start + 1 }, (_, i) => i + start));
        if (tunelesPorSector[sector] &&
            esperado.size === tunelesPorSector[sector].size &&
            [...esperado].every(t => tunelesPorSector[sector].has(t))) {
          completos.push(sector);
        }
      }

      setSectoresCompletos(completos);
      setCaminosCompletos(unicas.filter(s => s.startsWith('Camino')));
      setPeriferiasCompletas(unicas.filter(s => s.startsWith('Periferia')));
    }}
    className="bg-red-600 hover:bg-red-700 text-white py-1 px-3 rounded-md"
  >
    Eliminar registros
  </button>
</div>      
    </div> 
  ))}
  
</div>
   
      </div> 
    </div>  
  );
}  