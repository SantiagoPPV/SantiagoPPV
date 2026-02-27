/**
 * useFumigacionAplicaciones.ts
 * Carga aplicaciones registradas con todos sus relacionados.
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import type { FumAplicacion, PersonalFumigacion } from '../fumigacionTypes';

interface UseAplicacionesOptions {
  almacenId: string | null;
  limit?: number;
}

export function useFumigacionAplicaciones({ almacenId, limit = 50 }: UseAplicacionesOptions) {
  const [aplicaciones, setAplicaciones] = useState<FumAplicacion[]>([]);
  const [personal, setPersonal] = useState<PersonalFumigacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!almacenId) return;
    setLoading(true);
    setError(null);

    try {
      const [{ data: aplData, error: aplErr }, { data: persData, error: persErr }] =
        await Promise.all([
          supabase
            .from('fum_aplicaciones')
            .select(`
              *,
              responsable:Users!fum_aplicaciones_responsable_id_fkey(name),
              productos:fum_aplicacion_prods(*),
              docs:fum_aplicacion_docs(*),
              fumigadores:fum_fumigadores_dia(*, personal:"Personal Moray"("ID", "Nombre", "Categoria"))
            `)
            .eq('almacen_id', almacenId)
            .order('fecha_inicio', { ascending: false })
            .limit(limit),

          // Personal que puede fumigar: 'Fumigación' O 'Labores'
          supabase
            .from('Personal Moray')
            .select('"ID", "Nombre", "Categoria", "Estado"')
            .in('Categoria', ['Fumigación', 'Labores'])
            .eq('Estado', 'Activo')
            .order('Nombre'),
        ]);

      if (aplErr) throw aplErr;
      if (persErr) throw persErr;

      setAplicaciones((aplData || []) as FumAplicacion[]);
      setPersonal((persData || []).map((p: any) => ({
        ID: p.ID,
        Nombre: p.Nombre,
        Categoria: p.Categoria,
        Estado: p.Estado,
      })));
    } catch (err: any) {
      console.error('useFumigacionAplicaciones error:', err);
      setError(err.message || 'Error cargando aplicaciones');
    } finally {
      setLoading(false);
    }
  }, [almacenId, limit]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Mutations ──────────────────────────────────────────────────────────────

  const crearAplicacion = async (
    data: Omit<FumAplicacion, 'id' | 'created_at' | 'responsable' | 'productos' | 'docs' | 'fumigadores'>
  ) => {
    const { data: created, error } = await supabase
      .from('fum_aplicaciones')
      .insert(data)
      .select()
      .single();
    if (error) throw error;
    await fetchAll();
    return created;
  };

  const actualizarAplicacion = async (id: string, data: Partial<FumAplicacion>) => {
    const { error } = await supabase.from('fum_aplicaciones').update(data).eq('id', id);
    if (error) throw error;
    await fetchAll();
  };

  const actualizarChecklist = async (
    id: string,
    chk: {
      chk_aspersoras_lavadas?: boolean;
      chk_equipo_guardado?: boolean;
      chk_epp_revisado?: boolean;
      chk_envases_foto?: boolean;
      chk_tambos_llenos?: boolean;
    }
  ) => {
    const { error } = await supabase.from('fum_aplicaciones').update(chk).eq('id', id);
    if (error) throw error;
    // Actualizar localmente sin re-fetch completo
    setAplicaciones(prev => prev.map(a => a.id === id ? { ...a, ...chk } : a));
  };

  const guardarFumigadores = async (
    aplicacionId: string,
    fumigadores: { personal_id: number; fecha: string; tambos_realizados: number; sectores?: string[] }[]
  ) => {
    // Upsert: si ya existe (aplicacion_id, personal_id), actualiza
    const rows = fumigadores.map(f => ({
      aplicacion_id: aplicacionId,
      personal_id: f.personal_id,
      fecha: f.fecha,
      tambos_realizados: f.tambos_realizados,
      sectores: f.sectores || [],
    }));

    const { error } = await supabase
      .from('fum_fumigadores_dia')
      .upsert(rows, { onConflict: 'aplicacion_id,personal_id' });
    if (error) throw error;
    await fetchAll();
  };

  return {
    aplicaciones,
    personal,
    loading,
    error,
    refresh: fetchAll,
    crearAplicacion,
    actualizarAplicacion,
    actualizarChecklist,
    guardarFumigadores,
  };
}