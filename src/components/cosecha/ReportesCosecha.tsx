import React, { useState, useCallback } from 'react';
import { Loader2, Download } from 'lucide-react';
import { useSectores } from './hooks/useSectores';
import { useCosechaReportes } from './hooks/useCosechaReportes';
import FiltroFechas from './reportes/FiltroFechas';
import ReporteMerma from './reportes/ReporteMerma';
import ReporteKgCosechador from './reportes/ReporteKgCosechador';
import ReporteKgSector from './reportes/ReporteKgSector';
import ReporteTendencia from './reportes/ReporteTendencia';
import ReporteVariedad from './reportes/ReporteVariedad';
import ReporteComparativo from './reportes/ReporteComparativo';
import ReporteMermaVsProduccion from './reportes/ReporteMermaVsProduccion';

type ReportType = 'merma' | 'cosechador' | 'sector' | 'tendencia' | 'variedad' | 'comparativo' | 'mermaVsProd';

const REPORT_TABS: { id: ReportType; label: string; icon: string }[] = [
  { id: 'merma', label: 'Merma', icon: '🔴' },
  { id: 'cosechador', label: 'Kg / Cosechador', icon: '👤' },
  { id: 'sector', label: 'Kg / Sector', icon: '📍' },
  { id: 'tendencia', label: 'Tendencia Semanal', icon: '📈' },
  { id: 'variedad', label: 'Por Variedad', icon: '🫐' },
  { id: 'comparativo', label: 'Comparativo', icon: '⚖️' },
  { id: 'mermaVsProd', label: '% Merma vs Prod.', icon: '📉' },
];

// Helper: default date range (last 30 days)
const today = new Date().toISOString().split('T')[0];
const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

export default function ReportesCosecha() {
  const { sectores } = useSectores();
  const reportes = useCosechaReportes();

  const [activeReport, setActiveReport] = useState<ReportType>('merma');
  const [desde, setDesde] = useState(thirtyDaysAgo);
  const [hasta, setHasta] = useState(today);
  const [sector, setSector] = useState('');
  const [data, setData] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);

  const fetchReport = useCallback(async () => {
    try {
      let result: any[] = [];
      const range = { desde, hasta };

      switch (activeReport) {
        case 'merma':
          result = await reportes.fetchMerma(range, sector || undefined);
          break;
        case 'cosechador':
          result = await reportes.fetchKgCosechador(range);
          break;
        case 'sector':
          result = await reportes.fetchKgSector(range);
          break;
        case 'tendencia':
          result = await reportes.fetchTendencia(12);
          break;
        case 'variedad':
          result = await reportes.fetchVariedad(range);
          break;
        case 'comparativo':
          result = await reportes.fetchComparativo();
          break;
        case 'mermaVsProd':
          result = await reportes.fetchMermaVsProduccion(range);
          break;
      }

      setData(result);
      setLoaded(true);
    } catch (err) {
      console.error('Error fetching report:', err);
      setData([]);
    }
  }, [activeReport, desde, hasta, sector, reportes]);

  const handleTabChange = (tab: ReportType) => {
    setActiveReport(tab);
    setData([]);
    setLoaded(false);
  };

  // ── Export CSV ──
  const exportCSV = () => {
    if (data.length === 0) return;
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map((r) => Object.values(r).join(','));
    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte_${activeReport}_${desde}_${hasta}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const noDateFilter = activeReport === 'tendencia' || activeReport === 'comparativo';

  return (
    <div className="min-h-screen bg-[#0D0D0D] text-white p-4 sm:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-1">Reportes de Cosecha</h1>
          <p className="text-[#A3A3A3]">Seleccione un reporte, configure filtros y presione Aplicar</p>
        </div>

        {/* Report tabs */}
        <div className="flex flex-wrap gap-2">
          {REPORT_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
                activeReport === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-[#1A1A1A] text-[#A3A3A3] hover:bg-[#222] border border-[#2A2A2A]'
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Filters */}
        {!noDateFilter && (
          <FiltroFechas
            desde={desde}
            hasta={hasta}
            sector={sector}
            sectores={sectores}
            onDesdeChange={setDesde}
            onHastaChange={setHasta}
            onSectorChange={setSector}
            onApply={fetchReport}
            loading={reportes.loading}
          />
        )}

        {noDateFilter && (
          <div className="flex gap-3">
            <button
              onClick={fetchReport}
              disabled={reportes.loading}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg px-5 py-2.5 text-sm font-medium transition-colors"
            >
              {reportes.loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Cargar Reporte'}
            </button>
            {activeReport === 'tendencia' && (
              <span className="text-[#666] text-sm self-center">Últimas 12 semanas</span>
            )}
            {activeReport === 'comparativo' && (
              <span className="text-[#666] text-sm self-center">Semana actual vs. anterior</span>
            )}
          </div>
        )}

        {/* Loading */}
        {reportes.loading && (
          <div className="flex items-center justify-center py-10 text-[#A3A3A3]">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Cargando reporte…
          </div>
        )}

        {/* Report content */}
        {!reportes.loading && loaded && (
          <>
            {/* Export button */}
            {data.length > 0 && (
              <div className="flex justify-end">
                <button
                  onClick={exportCSV}
                  className="bg-[#1A1A1A] border border-[#2A2A2A] text-[#A3A3A3] hover:text-white rounded-lg px-4 py-2 text-sm flex items-center gap-1.5 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Exportar CSV
                </button>
              </div>
            )}

            {activeReport === 'merma' && <ReporteMerma data={data} />}
            {activeReport === 'cosechador' && <ReporteKgCosechador data={data} />}
            {activeReport === 'sector' && <ReporteKgSector data={data} />}
            {activeReport === 'tendencia' && <ReporteTendencia data={data} />}
            {activeReport === 'variedad' && <ReporteVariedad data={data} />}
            {activeReport === 'comparativo' && <ReporteComparativo data={data} />}
            {activeReport === 'mermaVsProd' && <ReporteMermaVsProduccion data={data} />}
          </>
        )}

        {!reportes.loading && !loaded && (
          <div className="text-center py-16 text-[#555]">
            <p className="text-lg">Presione "Aplicar" o "Cargar Reporte" para ver los resultados</p>
          </div>
        )}
      </div>
    </div>
  );
}
