import React, { useState, useMemo } from 'react';
import { Save, Loader2 } from 'lucide-react';
import { useSectores } from './hooks/useSectores';
import { useCosechaSubmit } from './hooks/useCosechaSubmit';
import CorteDelDiaForm from './CorteDelDiaForm';
import MermaCampoForm from './MermaCampoForm';
import ResumenDiario from './ResumenDiario';
import { emptyCorteEntry, emptyMermaEntry } from './cosechaTypes';
import type { CorteEntry, MermaEntry, TipoMerma } from './cosechaTypes';

export default function RegistroCosecha() {
  const { sectores, loading: sectoresLoading, getSector, getTunnelRange } = useSectores();
  const { submit, isSubmitting } = useCosechaSubmit();

  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [cortes, setCortes] = useState<CorteEntry[]>([emptyCorteEntry()]);
  const [mermas, setMermas] = useState<MermaEntry[]>([emptyMermaEntry()]);

  // ── Corte handlers ──
  const handleCorteChange = (uid: string, field: keyof CorteEntry, value: any) => {
    setCortes((prev) =>
      prev.map((c) => {
        if (c.uid !== uid) return c;
        const updated = { ...c, [field]: value };
        // Auto-completar variedad y resetear túneles al cambiar sector
        if (field === 'sector') {
          const cfg = getSector(value);
          updated.variedad = cfg?.variedad || '';
          updated.tunelInicio = '';
          updated.tunelFinal = '';
        }
        return updated;
      })
    );
  };

  const addCorte = () => setCortes((prev) => [...prev, emptyCorteEntry()]);
  const removeCorte = (uid: string) => setCortes((prev) => (prev.length > 1 ? prev.filter((c) => c.uid !== uid) : prev));

  // ── Merma handlers ──
  const handleMermaSectorChange = (uid: string, sector: string) => {
    setMermas((prev) => prev.map((m) => (m.uid === uid ? { ...m, sector } : m)));
  };

  const handleMermaTotalChange = (uid: string, value: number | '') => {
    setMermas((prev) => prev.map((m) => (m.uid === uid ? { ...m, totalMermaKg: value } : m)));
  };

  const handleMermaDetailChange = (uid: string, tipo: TipoMerma, value: number | '') => {
    setMermas((prev) =>
      prev.map((m) => {
        if (m.uid !== uid) return m;
        return { ...m, detalles: { ...m.detalles, [tipo]: value } };
      })
    );
  };

  const addMerma = () => setMermas((prev) => [...prev, emptyMermaEntry()]);
  const removeMerma = (uid: string) => setMermas((prev) => (prev.length > 1 ? prev.filter((m) => m.uid !== uid) : prev));

  // ── Resumen calculado ──
  const summary = useMemo(() => {
    const validCortes = cortes.filter((c) => c.sector && c.kgCosechados !== '');
    const totalKg = validCortes.reduce((s, c) => s + Number(c.kgCosechados), 0);
    const sectoresSet = new Set(validCortes.map((c) => c.sector));
    const tunelesCount = validCortes.reduce((s, c) => {
      const ini = Number(c.tunelInicio) || 0;
      const fin = Number(c.tunelFinal) || 0;
      return s + Math.max(fin - ini + 1, 0);
    }, 0);

    let totalMermaKg = 0;
    mermas.forEach((m) => {
      totalMermaKg += Number(m.totalMermaKg) || 0;
    });

    const mermaPercent = totalKg > 0 ? (totalMermaKg / totalKg) * 100 : 0;

    return { totalKg, sectoresCount: sectoresSet.size, tunelesCount, totalMermaKg, mermaPercent };
  }, [cortes, mermas]);

  // Map de kg cosechados por sector (para % merma en el form de merma)
  const totalKgBySector = useMemo(() => {
    const map: Record<string, number> = {};
    cortes.forEach((c) => {
      if (c.sector && c.kgCosechados !== '') {
        map[c.sector] = (map[c.sector] || 0) + Number(c.kgCosechados);
      }
    });
    return map;
  }, [cortes]);

  // ── Submit ──
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await submit({ fecha, cortes, mermas });
    if (success) {
      setCortes([emptyCorteEntry()]);
      setMermas([emptyMermaEntry()]);
    }
  };

  if (sectoresLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-[#A3A3A3]">
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Cargando catálogo de sectores…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0D0D0D] text-white p-4 sm:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-1">Registro de Cosecha</h1>
          <p className="text-[#A3A3A3]">Capture el corte del día, kilogramos y merma de campo</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Fecha */}
          <div className="bg-[#1A1A1A] p-5 rounded-xl border border-[#2A2A2A]">
            <label className="block text-sm font-medium text-[#A3A3A3] mb-1.5">Fecha de Cosecha</label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              className="w-full sm:w-64 bg-[#1F1F1F] border border-[#2A2A2A] text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Corte del día */}
          <CorteDelDiaForm
            entries={cortes}
            sectores={sectores}
            onAdd={addCorte}
            onRemove={removeCorte}
            onChange={handleCorteChange}
            getSector={getSector}
            getTunnelRange={getTunnelRange}
          />

          {/* Merma */}
          <MermaCampoForm
            entries={mermas}
            sectores={sectores}
            onAdd={addMerma}
            onRemove={removeMerma}
            onChange={handleMermaSectorChange}
            onTotalChange={handleMermaTotalChange}
            onDetailChange={handleMermaDetailChange}
            totalKgBySector={totalKgBySector}
          />

          {/* Resumen */}
          <ResumenDiario {...summary} />

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl py-4 flex items-center justify-center gap-2 font-semibold transition-colors"
          >
            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            {isSubmitting ? 'Guardando…' : 'Guardar Registro de Cosecha'}
          </button>
        </form>
      </div>
    </div>
  );
}
