import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import type { SectorConfig } from '../cosechaTypes';

export function useSectores() {
  const [sectores, setSectores] = useState<SectorConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('sectores_variedad')
        .select('*')
        .eq('activo', true)
        .order('sector');

      if (!cancelled) {
        if (error) {
          setError(error.message);
        } else if (data) {
          setSectores(data as SectorConfig[]);
        }
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  /** Obtener config de un sector por nombre */
  const getSector = (sector: string) => sectores.find((s) => s.sector === sector);

  /** Obtener rango de túneles como array [1,2,3,...N] */
  const getTunnelRange = (sector: string): number[] => {
    const s = getSector(sector);
    if (!s) return [];
    return Array.from({ length: s.tunel_final - s.tunel_inicio + 1 }, (_, i) => s.tunel_inicio + i);
  };

  return { sectores, loading, error, getSector, getTunnelRange };
}
