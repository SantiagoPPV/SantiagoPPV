import { useState, useCallback } from 'react';
import { supabase } from '../../../lib/supabaseClient';

interface DateRange {
  desde: string;
  hasta: string;
}

export function useCosechaReportes() {
  const [loading, setLoading] = useState(false);

  // ── Merma por sector y tipo ──
  const fetchMerma = useCallback(async (range: DateRange, sector?: string) => {
    setLoading(true);
    const { data, error } = await supabase.rpc('rpt_merma_por_sector_tipo', {
      p_fecha_inicio: range.desde,
      p_fecha_fin: range.hasta,
      p_sector: sector || null,
    });
    setLoading(false);
    if (error) throw error;
    return data || [];
  }, []);

  // ── Kg por cosechador ──
  const fetchKgCosechador = useCallback(async (range: DateRange) => {
    setLoading(true);
    const { data, error } = await supabase.rpc('rpt_kg_por_cosechador', {
      p_fecha_inicio: range.desde,
      p_fecha_fin: range.hasta,
    });
    setLoading(false);
    if (error) throw error;
    return data || [];
  }, []);

  // ── Kg por sector ──
  const fetchKgSector = useCallback(async (range: DateRange) => {
    setLoading(true);
    const { data, error } = await supabase.rpc('rpt_kg_por_sector', {
      p_fecha_inicio: range.desde,
      p_fecha_fin: range.hasta,
    });
    setLoading(false);
    if (error) throw error;
    return data || [];
  }, []);

  // ── Tendencia semanal ──
  const fetchTendencia = useCallback(async (semanas = 12) => {
    setLoading(true);
    const { data, error } = await supabase.rpc('rpt_tendencia_semanal', {
      p_semanas: semanas,
    });
    setLoading(false);
    if (error) throw error;
    return data || [];
  }, []);

  // ── Producción por variedad ──
  const fetchVariedad = useCallback(async (range: DateRange) => {
    setLoading(true);
    const { data, error } = await supabase.rpc('rpt_produccion_por_variedad', {
      p_fecha_inicio: range.desde,
      p_fecha_fin: range.hasta,
    });
    setLoading(false);
    if (error) throw error;
    return data || [];
  }, []);

  // ── Comparativo semanal ──
  const fetchComparativo = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('rpt_comparativo_semanal');
    setLoading(false);
    if (error) throw error;
    return data || [];
  }, []);

  // ── Merma vs Producción ──
  const fetchMermaVsProduccion = useCallback(async (range: DateRange) => {
    setLoading(true);
    const { data, error } = await supabase.rpc('rpt_merma_vs_produccion', {
      p_fecha_inicio: range.desde,
      p_fecha_fin: range.hasta,
    });
    setLoading(false);
    if (error) throw error;
    return data || [];
  }, []);

  return {
    loading,
    fetchMerma,
    fetchKgCosechador,
    fetchKgSector,
    fetchTendencia,
    fetchVariedad,
    fetchComparativo,
    fetchMermaVsProduccion,
  };
}
