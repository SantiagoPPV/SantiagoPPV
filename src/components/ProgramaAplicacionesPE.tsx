import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { getISOWeek } from 'date-fns';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const etapas: Record<string, string[]> = {
  'Etapa 1': ['1A', '1B', '1C', '1D', '1E', '2A', '2B', '2C', '2D', '2E'],
  'Etapa 2': ['3A', '3B', '3C', '4A', '4B', '4C', '5A', '5B', '5C'],
  'Etapa 3': ['6A', '6B', '6C', '6D', '7A', '7B', '7C', '7D', '7E', '8A', '8B', '8C', '8D', '8E', '8F']
};

export default function PlaneacionPEForm() {
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [sectoresSeleccionados, setSectoresSeleccionados] = useState<string[]>([]);
  const [productoBase, setProductoBase] = useState('');
  const [productosSecundariosSeleccionados, setProductosSecundariosSeleccionados] = useState<string[]>([]);
  const [productosBaseDisponibles, setProductosBaseDisponibles] = useState<string[]>([]);
  const [productosSecundariosDisponibles, setProductosSecundariosDisponibles] = useState<string[]>([]);
  const [tablaDatos, setTablaDatos] = useState<{ productoBase: string, productoSecundario: string, dosis: string, metodo: string }[]>([]);

  const getSectorGeneral = (sectores: string[]): string => {
    const allEtapa1 = etapas['Etapa 1'];
    const allEtapa2 = etapas['Etapa 2'];
    const allEtapa3 = etapas['Etapa 3'];

    if (sectores.every(s => allEtapa1.includes(s))) return 'BILOXI';
    if (sectores.every(s => ['3A', '3B', '3C', '5A', '5B', '5C'].includes(s))) return 'AZRA 3S Y 5S';
    if (sectores.every(s => ['4A', '4B', '4C'].includes(s))) return 'AZRA 4S';
    if (sectores.every(s => allEtapa3.includes(s))) return 'AZRA 6S Y 7S';

    if (sectores.some(s => allEtapa3.includes(s))) return 'AZRA 6S Y 7S';
    if (sectores.some(s => allEtapa2.includes(s))) return 'AZRA 3S Y 5S';
    if (sectores.some(s => allEtapa1.includes(s))) return 'BILOXI';
    return '';
  };

  useEffect(() => {
    const fetchProductos = async () => {
      if (!fechaInicio || sectoresSeleccionados.length === 0) {
        setProductosBaseDisponibles([]);
        setProductosSecundariosDisponibles([]);
        return;
      }
 
      const week = getISOWeek(new Date(fechaInicio));
      const sectorGeneral = getSectorGeneral(sectoresSeleccionados);

      const { data, error } = await supabase
        .from('PlanFumigacion')
        .select('ProductoBase, ProductoSecundario')
        .eq('Semana', week)
        .eq('Sector', sectorGeneral)
        .range(0, 9999);

      if (error) {
        console.error('Error fetching filtered products:', error);
        return;
      }

      const baseSet = new Set<string>();
      const secundarioSet = new Set<string>();

      data?.forEach((row) => {
        if (row.ProductoBase && row.ProductoBase !== 'N/A') {
          baseSet.add(row.ProductoBase);
        }
        if (row.ProductoSecundario && row.ProductoSecundario !== 'N/A') {
          secundarioSet.add(row.ProductoSecundario);
        }
      });

      setProductosBaseDisponibles(Array.from(baseSet));
      setProductosSecundariosDisponibles(Array.from(secundarioSet));
    }; 

    fetchProductos();
  }, [fechaInicio, sectoresSeleccionados]);
 
 useEffect(() => {
  const fetchTablaDatos = async () => {
    if (!productoBase || sectoresSeleccionados.length === 0) {
      setTablaDatos([]);
      return;
    }

    const week = getISOWeek(new Date(fechaInicio));
    const sectorGeneral = getSectorGeneral(sectoresSeleccionados);

    const { data, error } = await supabase
      .from('PlanFumigacion')
      .select('ProductoBase, ProductoSecundario, Dosis, "Metodo Aplicacion"')
      .eq('Semana', week)
      .eq('Sector', sectorGeneral)
      .range(0, 9999);

    if (error) {
      console.error('Error fetching tabla datos:', error);
      return;
    }

    const tabla = [];

    // Fila base con dosis y método si existe
    const filaBase = data?.find(row =>
      row.ProductoBase === productoBase &&
      (!row.ProductoSecundario || row.ProductoSecundario === 'N/A')
    );

    if (filaBase) {
      tabla.push({
        productoBase: filaBase.ProductoBase,
        productoSecundario: '',
        dosis: filaBase.Dosis || '',
        metodo: filaBase["Metodo Aplicacion"] || ''
      });
    }

    // Agregar cada producto secundario con su dosis y método
  const secundarios = productosSecundariosSeleccionados.map(sec => {
  const row = data?.find(r =>
    r.ProductoBase === productoBase &&
    r.ProductoSecundario === sec
  );
  return {
    productoBase: '', // solo la primera fila lleva el nombre del producto base
    productoSecundario: sec,
    dosis: row?.Dosis || '',
    metodo: row?.MetodoAplicacion || row?.["Metodo Aplicacion"] || ''
     
  };
});

    setTablaDatos([...tabla, ...secundarios]);
  };
  fetchTablaDatos(); 
}, [productoBase, productosSecundariosSeleccionados, fechaInicio, sectoresSeleccionados]);

  const handleSectorToggle = (sector: string) => {
    setSectoresSeleccionados(prev =>
      prev.includes(sector) ? prev.filter(s => s !== sector) : [...prev, sector]
    );
  };

  const toggleEtapa = (etapa: string) => {
    const sectoresEtapa = etapas[etapa];
    const todosSeleccionados = sectoresEtapa.every(s => sectoresSeleccionados.includes(s));
    setSectoresSeleccionados(prev =>
      todosSeleccionados
        ? prev.filter(s => !sectoresEtapa.includes(s))
        : [...prev, ...sectoresEtapa.filter(s => !prev.includes(s))]
    );
  };

  const handleCheckboxChange = (value: string) => {
    setProductosSecundariosSeleccionados(prev =>
      prev.includes(value) ? prev.filter(p => p !== value) : [...prev, value]
    );
  };

  return (
    <div className="min-h-screen bg-[#0D0D0D] py-8 px-4 text-white">
      <div className="max-w-4xl mx-auto bg-[#1A1A1A] p-6 rounded-lg shadow-md border border-gray-700">
        <h2 className="text-2xl font-bold mb-6">📅 Programación de Plagas y Enfermedades</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block mb-1 font-medium">Fecha y hora de inicio</label>
            <input
              type="datetime-local"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              className="w-full bg-[#111] border border-gray-600 rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block mb-1 font-medium">Fecha y hora de fin</label>
            <input
              type="datetime-local"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              className="w-full bg-[#111] border border-gray-600 rounded px-3 py-2"
            />
          </div>
        </div>

        <div className="mb-6">
          <label className="block mb-2 font-medium">Túneles</label>
          <div className="grid grid-cols-3 gap-4">
            {Object.entries(etapas).map(([etapa, sectores]) => (
              <div key={etapa}>
                <label className="block font-semibold mb-2 text-blue-400">
                  <input
                    type="checkbox"
                    checked={sectores.every(s => sectoresSeleccionados.includes(s))}
                    onChange={() => toggleEtapa(etapa)}
                    className="mr-2 accent-blue-600"
                  />
                  {etapa}
                </label>
                <div className="grid grid-cols-2 gap-1 pl-4">
                  {sectores.map(sector => (
                    <label key={sector} className="inline-flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={sectoresSeleccionados.includes(sector)}
                        onChange={() => handleSectorToggle(sector)}
                        className="form-checkbox accent-blue-600"
                      />
                      <span>{sector}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block mb-1 font-medium">Producto base</label>
            <select
              value={productoBase}
              onChange={(e) => setProductoBase(e.target.value)}
              className="w-full bg-[#111] border border-gray-600 rounded px-3 py-2"
            >
              <option value="">Seleccione producto base</option>
              {productosBaseDisponibles.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block mb-1 font-medium">Producto secundario</label>
            <div className="bg-[#111] border border-gray-600 rounded px-3 py-2 max-h-[150px] overflow-y-auto">
              {productosSecundariosDisponibles.map(p => (
                <label key={p} className="block mb-1">
                  <input
                    type="checkbox"
                    className="mr-2 accent-blue-600"
                    checked={productosSecundariosSeleccionados.includes(p)}
                    onChange={() => handleCheckboxChange(p)}
                  />
                  {p}
                </label>
              ))}
            </div>
          </div>
        </div>

        {tablaDatos.length > 0 && (
          <div className="overflow-x-auto border border-gray-600 rounded mt-6">
            <table className="min-w-full text-left">
              <thead className="bg-[#222] text-white">
                <tr>
                  <th className="px-4 py-2 border-b border-gray-700">Producto Base</th>
                  <th className="px-4 py-2 border-b border-gray-700">Producto Secundario</th>
                  <th className="px-4 py-2 border-b border-gray-700">Dosis</th>
                  <th className="px-4 py-2 border-b border-gray-700">Método Aplicación</th>
                </tr>
              </thead>
            <tbody>
  {tablaDatos.map((fila, index) => (
    <tr key={index} className="hover:bg-[#2A2A2A]">
      <td className="px-4 py-2 border-b border-gray-700">
        {index === 0 ? fila.productoBase : ''}
      </td>
      <td className="px-4 py-2 border-b border-gray-700">
        {fila.productoSecundario}
      </td>
      <td className="px-4 py-2 border-b border-gray-700">
        {fila.dosis}
      </td>
      <td className="px-4 py-2 border-b border-gray-700">
        {fila.metodo}
      </td>
    </tr>
  ))}
</tbody>
            </table>
          </div>
        )}

        <button
          onClick={() => {
            console.log({
              fechaInicio,
              fechaFin,
              sectoresSeleccionados,
              productoBase,
              productosSecundariosSeleccionados
            });
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded mt-6"
        >
          Guardar programación
        </button>
      </div>
    </div>
  );
}