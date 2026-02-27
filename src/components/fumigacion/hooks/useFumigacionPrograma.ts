/**
 * useFumigacionPrograma.ts
 * Carga el programa de fumigación + datos de inventario para calcular alertas.
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import type {
  FumPrograma,
  FumProgramaEnriquecida,
  ProductoMoray,
  AlertaInventario,
} from '../fumigacionTypes';

interface InventarioItem {
  id: string;
  nombre: string;
  stock_actual: number;
  unidad: string;
  almacen_id: string;
}

interface UseProgramaOptions {
  almacenId: string | null;
  semanas?: number[];          // filtrar por semanas específicas
  diasAlertaAnticipacion?: number; // cuántos días adelante revisar alertas (default: 3)
}

export function useFumigacionPrograma({
  almacenId,
  semanas,
  diasAlertaAnticipacion = 3,
}: UseProgramaOptions) {
  const [programa, setPrograma] = useState<FumProgramaEnriquecida[]>([]);
  const [productos, setProductos] = useState<ProductoMoray[]>([]);
  const [inventario, setInventario] = useState<InventarioItem[]>([]);
  const [alertas, setAlertas] = useState<AlertaInventario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!almacenId) return;
    setLoading(true);
    setError(null);

    try {
      // 1. Cargar programa
      let qPrograma = supabase
        .from('fum_programa')
        .select('*, responsable:Users!fum_programa_responsable_id_fkey(name)')
        .eq('almacen_id', almacenId)
        .order('fecha', { ascending: true })
        .order('variedad', { ascending: true });

      if (semanas?.length) {
        qPrograma = qPrograma.in('semana', semanas);
      }

      const [{ data: progData, error: progErr }, { data: prodData, error: prodErr }, { data: invData, error: invErr }] =
        await Promise.all([
          qPrograma,
          supabase
            .from('Productos Moray')
            .select('id, Nombre, categoria, unidad, dosis_ref_200l, costo_unitario, activo')
            .eq('activo', true)
            .order('Nombre'),
          supabase
            .from('inventario_items')
            .select('id, nombre, stock_actual, unidad, almacen_id')
            .eq('almacen_id', almacenId),
        ]);

      if (progErr) throw progErr;
      if (prodErr) throw prodErr;
      if (invErr) throw invErr;

      const prodList: ProductoMoray[] = (prodData || []).map((p: any) => ({
        id: p.id,
        Nombre: p.Nombre,
        categoria: p.categoria || 'Otro',
        unidad: p.unidad || 'mL',
        dosis_ref_200l: p.dosis_ref_200l,
        costo_unitario: p.costo_unitario || 0,
        activo: p.activo ?? true,
      }));

      const invList: InventarioItem[] = (invData || []).map((i: any) => ({
        id: i.id,
        nombre: i.nombre,
        stock_actual: i.stock_actual || 0,
        unidad: i.unidad || '',
        almacen_id: i.almacen_id,
      }));

      // 2. Enriquecer programa con inventario
      const enriquecida: FumProgramaEnriquecida[] = (progData || []).map((p: FumPrograma) => {
        const prod = prodList.find(pr => pr.Nombre.toLowerCase() === p.producto_nombre.toLowerCase());
        const invItem = invList.find(i => i.nombre.toLowerCase() === p.producto_nombre.toLowerCase());

        const total = (p.dosis_200l * p.tambos) / 1000;
        const stock = invItem?.stock_actual ?? 0;
        const vinculado = invItem !== undefined;
        const necesidad = Math.max(0, total - stock);

        return {
          ...p,
          total_producto: Math.round(total * 1000) / 1000,
          stock_inventario: stock,
          inventario_vinculado: vinculado,
          necesidad: Math.round(necesidad * 1000) / 1000,
          costo_estimado: Math.round(total * (prod?.costo_unitario ?? 0) * 100) / 100,
          costo_unitario: prod?.costo_unitario ?? 0,
          unidad_producto: prod?.unidad ?? 'mL',
          categoria_producto: prod?.categoria ?? 'Otro',
        };
      });

      // 3. Calcular alertas (próximos N días)
      const hoy = new Date();
      const limiteAlerta = new Date(hoy);
      limiteAlerta.setDate(limiteAlerta.getDate() + diasAlertaAnticipacion);
      const hoyStr = hoy.toISOString().split('T')[0];
      const limiteStr = limiteAlerta.toISOString().split('T')[0];

      const proximasFums = enriquecida.filter(p =>
        p.fecha >= hoyStr && p.fecha <= limiteStr && p.estatus === 'programada'
      );

      // Agrupar necesidades por producto
      const necesidadesPorProd: Record<string, { necesidad: number; fechas: string[]; stock: number; unidad: string }> = {};
      for (const fum of proximasFums) {
        if (fum.necesidad > 0) {
          if (!necesidadesPorProd[fum.producto_nombre]) {
            necesidadesPorProd[fum.producto_nombre] = {
              necesidad: 0,
              fechas: [],
              stock: fum.stock_inventario,
              unidad: fum.unidad_producto,
            };
          }
          necesidadesPorProd[fum.producto_nombre].necesidad += fum.necesidad;
          if (!necesidadesPorProd[fum.producto_nombre].fechas.includes(fum.fecha)) {
            necesidadesPorProd[fum.producto_nombre].fechas.push(fum.fecha);
          }
        }
      }

      const alertasList: AlertaInventario[] = Object.entries(necesidadesPorProd).map(([nombre, data]) => ({
        producto_nombre: nombre,
        necesidad_total: Math.round(data.necesidad * 1000) / 1000,
        stock_actual: data.stock,
        deficit: Math.round(data.necesidad * 1000) / 1000,
        unidad: data.unidad,
        fechas_afectadas: data.fechas,
      }));

      setPrograma(enriquecida);
      setProductos(prodList);
      setInventario(invList);
      setAlertas(alertasList);
    } catch (err: any) {
      console.error('useFumigacionPrograma error:', err);
      setError(err.message || 'Error cargando programa');
    } finally {
      setLoading(false);
    }
  }, [almacenId, semanas?.join(','), diasAlertaAnticipacion]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Mutations ──────────────────────────────────────────────────────────────

  const crearEntrada = async (data: Omit<FumPrograma,
    'id' | 'created_at' | 'updated_at' | 'responsable' | 'sheets_synced_at'
  >) => {
    const { error } = await supabase.from('fum_programa').insert(data);
    if (error) throw error;
    await fetchAll();
  };

  const actualizarEntrada = async (id: string, data: Partial<FumPrograma>) => {
    const { error } = await supabase.from('fum_programa').update(data).eq('id', id);
    if (error) throw error;
    await fetchAll();
  };

  const eliminarEntrada = async (id: string) => {
    const { error } = await supabase.from('fum_programa').delete().eq('id', id);
    if (error) throw error;
    await fetchAll();
  };

  /** Elimina múltiples entradas en una sola operación */
  const eliminarVarios = async (ids: string[]) => {
    if (ids.length === 0) return;
    const { error } = await supabase.from('fum_programa').delete().in('id', ids);
    if (error) throw error;
    await fetchAll();
  };

  /** Cambia el estatus de múltiples entradas */
  const actualizarEstatusVarios = async (
    ids: string[],
    estatus: FumPrograma['estatus']
  ) => {
    if (ids.length === 0) return;
    const { error } = await supabase
      .from('fum_programa')
      .update({ estatus })
      .in('id', ids);
    if (error) throw error;
    await fetchAll();
  };

  return {
    programa,
    productos,
    inventario,
    alertas,
    loading,
    error,
    refresh: fetchAll,
    crearEntrada,
    actualizarEntrada,
    eliminarEntrada,
    eliminarVarios,
    actualizarEstatusVarios,
  };
}