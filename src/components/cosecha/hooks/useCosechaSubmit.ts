import { useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import toast from 'react-hot-toast';
import type { CorteEntry, MermaEntry, TIPOS_MERMA } from '../cosechaTypes';

type TipoMerma = (typeof TIPOS_MERMA)[number];

interface SubmitPayload {
  fecha: string;
  cortes: CorteEntry[];
  mermas: MermaEntry[];
}

// Calcula el número de semana ISO (ISOWEEKNUM) de una fecha "YYYY-MM-DD"
function getISOWeek(dateStr: string): number {
  const d = new Date(Date.UTC(
    parseInt(dateStr.slice(0, 4)),
    parseInt(dateStr.slice(5, 7)) - 1,
    parseInt(dateStr.slice(8, 10))
  ));
  const day = d.getUTCDay() || 7;           // lunes=1 … domingo=7
  d.setUTCDate(d.getUTCDate() + 4 - day);   // al jueves de la semana ISO
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

export function useCosechaSubmit() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async ({ fecha, cortes, mermas }: SubmitPayload): Promise<boolean> => {
    setIsSubmitting(true);

    try {
      // ── 1. Insertar cortes ──
      const corteRows = cortes
        .filter((c) => c.sector && c.tunelInicio !== '' && c.tunelFinal !== '' && c.cubetas !== '')
        .map((c) => ({
          fecha,
          Semana: getISOWeek(fecha),
          sector: c.sector,
          variedad: c.variedad,
          tunel_inicio: Number(c.tunelInicio),
          tunel_final: Number(c.tunelFinal),
          cubetas_cosechadas: Number(c.cubetas),
          kg_cosechados: Math.round(Number(c.cubetas) * 2.65 * 100) / 100,
          observaciones: c.observaciones || null,
        }));

      if (corteRows.length === 0) {
        toast.error('Agrega al menos un corte válido');
        setIsSubmitting(false);
        return false;
      }

      const { data: insertedCortes, error: corteError } = await supabase
        .from('cosecha_corte_dia')
        .insert(corteRows)
        .select('id, sector');

      if (corteError) throw corteError;

      // ── 2. Insertar mermas (vinculadas al corte si hay match de sector) ──
      const mermaRows: { corte_id: string | null; fecha: string; sector: string; tipo_merma: string; kg_merma: number }[] = [];

      mermas.forEach((m) => {
        if (!m.sector) return;
        const totalKg = Number(m.totalMermaKg) || 0;
        if (totalKg <= 0) return;

        // Buscar el corte insertado para este sector
        const matchedCorte = insertedCortes?.find((c: any) => c.sector === m.sector);

        Object.entries(m.detalles).forEach(([tipo, pct]) => {
          const pctNum = Number(pct) || 0;
          if (pctNum > 0) {
            mermaRows.push({
              corte_id: matchedCorte?.id || null,
              fecha,
              sector: m.sector,
              tipo_merma: tipo,
              kg_merma: Math.round((pctNum / 100) * totalKg * 100) / 100,
            });
          }
        });
      });

      if (mermaRows.length > 0) {
        const { error: mermaError } = await supabase
          .from('cosecha_merma')
          .insert(mermaRows);

        if (mermaError) throw mermaError;
      }

      toast.success(`Cosecha guardada: ${corteRows.length} corte(s) y ${mermaRows.length} registro(s) de merma`);
      setIsSubmitting(false);
      return true;
    } catch (err: any) {
      console.error('Error guardando cosecha:', err);
      toast.error(err.message || 'Error al guardar cosecha');
      setIsSubmitting(false);
      return false;
    }
  };

  return { submit, isSubmitting };
}