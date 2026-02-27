import React, { useState } from 'react';
import { DataGrid, Column, textEditor } from 'react-data-grid';
import '../styles/react-data-grid.css';
 interface FilaPlaneacion {
  id: number;
  semana: number;
  fecha: string;
  variedad: string;
  producto: string;
  dosis: number;
  total: number;
  inventario: number;
  necesidad: number;
  metodoAplicacion: string;
  tambos: number;
  compra: number;
  presentacion: number;
  proveedor: string;
  estatus: string;
  costoUnitario: number;
  totalCompra: number;
  costoAplicacion: number;
  observaciones: string;
}

export default function PlaneacionPEPage() {
  const [rows, setRows] = useState<FilaPlaneacion[]>([
    {
      id: 1,
      semana: 22,
      fecha: '2025-05-27',
      variedad: '',
      producto: '',
      dosis: 0,
      total: 0,
      inventario: 0,
      necesidad: 0,
      metodoAplicacion: '',
      tambos: 0,
      compra: 0,
      presentacion: 0,
      proveedor: '',
      estatus: 'BODEGA',
      costoUnitario: 0,
      totalCompra: 0,
      costoAplicacion: 0,
      observaciones: ''
    }
  ]);

  const handleRowChange = (updatedRow: FilaPlaneacion, index: number) => {
    const updatedRows = [...rows];
    updatedRows[index] = updatedRow;
    setRows(updatedRows);
  };

  const agregarFila = () => {
    const newRow: FilaPlaneacion = {
      id: rows.length + 1,
      semana: 0,
      fecha: '',
      variedad: '',
      producto: '',
      dosis: 0,
      total: 0,
      inventario: 0,
      necesidad: 0,
      metodoAplicacion: '',
      tambos: 0,
      compra: 0,
      presentacion: 0,
      proveedor: '',
      estatus: 'BODEGA',
      costoUnitario: 0,
      totalCompra: 0,
      costoAplicacion: 0,
      observaciones: ''
    };
    setRows([...rows, newRow]);
  };

const columns: Column<FilaPlaneacion>[] = [
  {
    key: 'id',
    name: '#',
    width: 40,
    resizable: false,
    frozen: true
  },
  { key: 'semana', name: 'Semana', editor: textEditor },
  { key: 'fecha', name: 'Fecha', editor: textEditor },
  { key: 'variedad', name: 'Variedad', editor: textEditor },
  { key: 'producto', name: 'Productos', editor: textEditor },
  { key: 'dosis', name: 'Dosis Por 200 litros', editor: textEditor },
  { key: 'total', name: 'Total', editor: textEditor },
  { key: 'inventario', name: 'Inventario', editor: textEditor },
  { key: 'necesidad', name: 'Necesidad', editor: textEditor },
  { key: 'metodoAplicacion', name: 'Método Aplicación', editor: textEditor },
  { key: 'tambos', name: 'Tambos', editor: textEditor },
  { key: 'compra', name: 'Compra', editor: textEditor },
  { key: 'presentacion', name: 'Presentación (kg, lts)', editor: textEditor },
  { key: 'proveedor', name: 'Proveedor', editor: textEditor },
  { key: 'estatus', name: 'Estatus', editor: textEditor },
  { key: 'costoUnitario', name: 'Costo unitario', editor: textEditor },
  { key: 'totalCompra', name: 'Total', editor: textEditor },
  { key: 'costoAplicacion', name: 'Costo por aplicación', editor: textEditor },
  { key: 'observaciones', name: 'Observaciones', editor: textEditor }
];

  return (
    <div className="h-screen flex flex-col p-4 bg-[#0D0D0D] text-white">
      <h2 className="text-2xl font-bold mb-4">Planeación de Plagas y Enfermedades</h2>

      <div className="flex-1 overflow-auto mb-4">
  <DataGrid
    className="rdg"
    columns={columns}
    rows={rows.map((row, index) => ({ ...row, id: index + 1 }))}
    onRowsChange={(newRows) => setRows(newRows)}
    enableCellCopyPaste
    defaultColumnOptions={{
      resizable: true,
      sortable: false
    }}
    style={{ height: 'calc(100vh - 160px)' }} // Ajusta altura
  />
</div>

      <div className="mt-4">
        <button
          onClick={agregarFila}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded"
        >
          + Agregar fila
        </button>
      </div>
    </div>
  );
}