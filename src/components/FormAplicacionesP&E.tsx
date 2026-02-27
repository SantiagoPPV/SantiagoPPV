import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { CalendarDays, UploadCloud } from 'lucide-react';
import dayjs from 'dayjs';
import { useRef } from 'react';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
);

export default function FormAplicacionesPE() {
  const [formData, setFormData] = useState({
    fechaHoraInicio: dayjs().format('YYYY-MM-DDTHH:mm'),
    fechaHoraFin: dayjs().format('YYYY-MM-DDTHH:mm'),
    aplicadores: [] as string[],
    productoBase: '',
    productoSecundario: [] as string[],
    sectores: [] as string[],
    dosisBase: '',
    dosisSecundario: '',
    metodoAplicacion: '',
    ph: '',
    conductividad: '',
    imagenes: [] as File[],
  });
const aplicadoresDropdownRef = useRef<HTMLDivElement>(null);
  const [opcionesAplicadores, setOpcionesAplicadores] = useState<string[]>([]);
  const sectoresDisponibles = ['1A', '1B', '1C', '2A', '2B', '3A', '3B'];
  const [showAplicadoresDropdown, setShowAplicadoresDropdown] = useState(false);
const [productos, setProductos] = useState<string[]>([]);
const [showProductoBaseDropdown, setShowProductoBaseDropdown] = useState(false);
const [showProductoSecDropdown, setShowProductoSecDropdown] = useState(false);
const [busquedaProductoBase, setBusquedaProductoBase] = useState('');
const [busquedaProductoSec, setBusquedaProductoSec] = useState('');

const productoBaseRef = useRef<HTMLDivElement>(null);
const productoSecRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  const fetchProductos = async () => {
    const { data, error } = await supabase
      .from('Productos Moray')
      .select('Nombre')
      .order('Nombre', { ascending: true })
      .range(0, 9999);

    if (!error && data) {
      const nombres = data.map(p => p.Nombre);
      setProductos(nombres);
    }
  };
  fetchProductos();
}, []); 

useEffect(() => {
  const handler = (event: MouseEvent) => {
    if (productoBaseRef.current && !productoBaseRef.current.contains(event.target as Node)) {
      setShowProductoBaseDropdown(false);
    }
    if (productoSecRef.current && !productoSecRef.current.contains(event.target as Node)) {
      setShowProductoSecDropdown(false);
    }
  };
  document.addEventListener('mousedown', handler);
  return () => document.removeEventListener('mousedown', handler);
}, []);
  useEffect(() => {
    const fetchAplicadores = async () => {
      const { data, error } = await supabase
        .from('Personal Moray')
        .select('Nombre, Area')
        .range(0, 9999);

      if (!error && data) {
        const filtrados = data
          .filter(p => p.Area?.toLowerCase().includes('fumigacion'))
          .map(p => p.Nombre);
        setOpcionesAplicadores(filtrados);
      }
    };
    fetchAplicadores();
  }, []);
useEffect(() => {
  const handleClickOutside = (event: MouseEvent) => {
    if (
      aplicadoresDropdownRef.current &&
      !aplicadoresDropdownRef.current.contains(event.target as Node)
    ) {
      setShowAplicadoresDropdown(false);
    }
  };

  document.addEventListener('mousedown', handleClickOutside);
  return () => {
    document.removeEventListener('mousedown', handleClickOutside);
  };
}, []);
  const handleCheckboxChange = (sector: string) => {
    setFormData(prev => ({
      ...prev,
      sectores: prev.sectores.includes(sector)
        ? prev.sectores.filter(s => s !== sector)
        : [...prev.sectores, sector],
    }));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFormData(prev => ({
        ...prev,
        imagenes: Array.from(e.target.files),
      }));
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleAplicadoresChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = Array.from(e.target.selectedOptions, opt => opt.value);
    setFormData(prev => ({
      ...prev,
      aplicadores: selected,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Formulario enviado:', formData);
    // Guardar en Supabase aquí
  };

  return (
    <div className="p-6 max-w-3xl mx-auto text-white bg-[#0D0D0D]">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <CalendarDays className="w-6 h-6 text-blue-500" />
        Registro de Aplicación de P&E
      </h2>

      <form onSubmit={handleSubmit} className="space-y-6">
       {/* Fechas en la misma fila */}
<div className="flex flex-col md:flex-row gap-4">
  <div className="flex-1">
    <label className="block mb-1 text-sm font-medium">Fecha y hora de inicio</label>
    <input
      type="datetime-local"
      name="fechaHoraInicio"
      value={formData.fechaHoraInicio}
      onChange={handleChange}
      className="w-full bg-[#1E1E1E] border border-gray-700 rounded px-3 py-2"
    />
  </div>
  <div className="flex-1">
    <label className="block mb-1 text-sm font-medium">Fecha y hora fin</label>
    <input
      type="datetime-local"
      name="fechaHoraFin"
      value={formData.fechaHoraFin}
      onChange={handleChange}
      className="w-full bg-[#1E1E1E] border border-gray-700 rounded px-3 py-2"
    />
  </div>
</div>

   {/* Aplicadores estilo dropdown con checkboxes */}
<div ref={aplicadoresDropdownRef} className="flex flex-col min-w-[200px] relative">
  <label className="text-sm font-semibold text-white mb-1">Aplicadores</label>
  <button
    onClick={() => setShowAplicadoresDropdown((prev) => !prev)}
    className="bg-[#1A1A1A] text-white border border-[#333] px-4 py-2 rounded text-left w-full"
  >
    {formData.aplicadores.length > 0
      ? formData.aplicadores.join(', ')
      : 'Seleccione uno o más'}
  </button>

  {showAplicadoresDropdown && (
    <div className="absolute z-50 mt-2 bg-[#1A1A1A] border border-[#333] rounded w-full shadow-md max-h-60 overflow-auto">
      {opcionesAplicadores.map((nombre) => (
        <label
          key={nombre}
          className="flex items-center px-4 py-2 text-sm text-white hover:bg-[#2A2A2A]"
        >
          <input
            type="checkbox"
            className="mr-2 accent-blue-500"
            checked={formData.aplicadores.includes(nombre)}
            onChange={() => {
              setFormData((prev) => {
                const selected = new Set(prev.aplicadores);
                if (selected.has(nombre)) {
                  selected.delete(nombre);
                } else {
                  selected.add(nombre);
                }
                return { ...prev, aplicadores: Array.from(selected) };
              });
            }}
          /> 
          {nombre}
        </label>
      ))}
    </div>
  )}
</div>

<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  {/* Producto Base */}
  <div ref={productoBaseRef} className="relative">
    <label className="block mb-1 text-sm font-medium">Producto base</label>
    <div className="flex items-center bg-[#1E1E1E] border border-gray-700 rounded px-3 py-2 w-full">
      <span
        className="mr-2 text-gray-400 cursor-pointer"
        onClick={() => setShowProductoBaseDropdown(prev => !prev)}
      >
        🔍
      </span>
      <input
        type="text"
        className="bg-transparent text-white flex-1 outline-none"
        placeholder="Seleccione producto"
        value={formData.productoBase}
        readOnly
        onClick={() => setShowProductoBaseDropdown(true)}
      />
    </div>

    {showProductoBaseDropdown && (
      <div className="absolute z-50 w-full bg-[#1E1E1E] border border-[#333] mt-2 rounded shadow-lg max-h-60 overflow-y-auto">
        <input
          type="text"
          placeholder="Buscar..."
          value={busquedaProductoBase}
          onChange={(e) => setBusquedaProductoBase(e.target.value)}
          className="w-full px-3 py-2 bg-[#0D0D0D] text-white border-b border-[#444]"
        />
        {productos
          .filter(p => p.toLowerCase().includes(busquedaProductoBase.toLowerCase()))
          .map(p => (
            <div
              key={p}
              className="px-4 py-2 hover:bg-[#2A2A2A] cursor-pointer text-sm"
              onClick={() => {
                setFormData(prev => ({ ...prev, productoBase: p }));
                setShowProductoBaseDropdown(false);
              }}
            >
              {p}
            </div>
          ))}
      </div>
    )}
  </div>

{/* Producto Secundario - MULTI SELECT CHECKBOX CON DISEÑO IGUAL AL PRODUCTO BASE */}
<div ref={productoSecRef} className="relative">
  <label className="block mb-1 text-sm font-medium">Producto secundario</label>
  <div className="flex items-center bg-[#1E1E1E] border border-gray-700 rounded px-3 py-2 w-full">
    <span
      className="mr-2 text-gray-400 cursor-pointer"
      onClick={() => setShowProductoSecDropdown(prev => !prev)}
    >
      🔍
    </span>
    <input
      type="text"
      className="bg-transparent text-gray-400 flex-1 outline-none cursor-pointer"
      placeholder="Seleccione uno o más"
      value={formData.productoSecundario.join(', ')}
      readOnly
      onClick={() => setShowProductoSecDropdown(true)}
    />
  </div>

  {showProductoSecDropdown && (
    <div className="absolute z-50 w-full bg-[#1E1E1E] border border-[#333] mt-2 rounded shadow-lg max-h-60 overflow-y-auto">
      <input
        type="text"
        placeholder="Buscar producto..."
        value={busquedaProductoSec}
        onChange={(e) => setBusquedaProductoSec(e.target.value)}
        className="w-full px-3 py-2 bg-[#0D0D0D] text-white border-b border-[#444]"
      />
      {productos
        .filter((nombre) =>
          nombre.toLowerCase().includes(busquedaProductoSec.toLowerCase())
        )
        .map((nombre) => (
          <label
            key={nombre}
            className="flex items-center px-4 py-2 text-sm text-white hover:bg-[#2A2A2A]"
          >
            <input
              type="checkbox"
              className="mr-2 accent-blue-500"
              checked={formData.productoSecundario.includes(nombre)}
              onChange={() => {
                setFormData((prev) => {
                  const selected = new Set(prev.productoSecundario);
                  if (selected.has(nombre)) {
                    selected.delete(nombre);
                  } else {
                    selected.add(nombre);
                  }
                  return {
                    ...prev,
                    productoSecundario: Array.from(selected),
                  };
                });
              }}
            />
            {nombre}
          </label>
        ))}
    </div>
  )}
</div>
</div>

        {/* Sectores */}
        <div>
          <label className="block mb-2 text-sm font-medium">Sectores aplicados</label>
          <div className="flex flex-wrap gap-4">
            {sectoresDisponibles.map(sector => (
              <label key={sector} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.sectores.includes(sector)}
                  onChange={() => handleCheckboxChange(sector)}
                />
                {sector}
              </label>
            ))}
          </div>
        </div>

        {/* Dosis */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block mb-1 text-sm font-medium">Dosis producto base</label>
            <input
              name="dosisBase"
              value={formData.dosisBase}
              onChange={handleChange}
              className="w-full bg-[#1E1E1E] border border-gray-700 rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block mb-1 text-sm font-medium">Dosis producto secundario</label>
            <input
              name="dosisSecundario"
              value={formData.dosisSecundario}
              onChange={handleChange}
              className="w-full bg-[#1E1E1E] border border-gray-700 rounded px-3 py-2"
            />
          </div>
        </div>

        {/* Método */}
        <div>
          <label className="block mb-1 text-sm font-medium">Método de aplicación</label>
          <input
            name="metodoAplicacion"
            value={formData.metodoAplicacion}
            onChange={handleChange}
            className="w-full bg-[#1E1E1E] border border-gray-700 rounded px-3 py-2"
          />
        </div>

        {/* PH y CE */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block mb-1 text-sm font-medium">pH del caldo</label>
            <input
              name="ph"
              type="number"
              step="0.01"
              value={formData.ph}
              onChange={handleChange}
              className="w-full bg-[#1E1E1E] border border-gray-700 rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block mb-1 text-sm font-medium">C.E. del caldo</label>
            <input
              name="conductividad"
              type="number"
              step="0.01"
              value={formData.conductividad}
              onChange={handleChange}
              className="w-full bg-[#1E1E1E] border border-gray-700 rounded px-3 py-2"
            />
          </div>
        </div>

        {/* Imagen */}
        <div>
          <label className="block mb-1 text-sm font-medium">Evidencia (opcional)</label>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageUpload}
            className="w-full text-sm"
          />
        </div>

        <button
          type="submit"
          className="mt-6 bg-green-600 hover:bg-green-500 text-white font-semibold px-4 py-2 rounded"
        >
          Guardar Aplicación
        </button>
      </form>
    </div>
  );
}