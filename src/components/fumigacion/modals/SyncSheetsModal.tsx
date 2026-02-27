/**
 * SyncSheetsModal.tsx — Modal de sincronización con Google Sheets
 * Agrícola Moray ERP — Fase 2
 *
 * Pantallas:
 *  1. CONFIG   → Spreadsheet ID + pestaña + fila inicio + filtro de SEMANA
 *  2. SYNCING  → Spinner
 *  3. RESULT   → Resumen creadas / actualizadas / errores
 */
import React, { useState, useEffect } from 'react';
import {
  getSheetsConfig,
  saveSheetsConfig,
  syncFromSheets,
  extractSpreadsheetId,
} from '../../../services/googleSheetsSync';
import type { SheetsConfig, SyncResult } from '../../../services/googleSheetsSync';

interface SyncSheetsModalProps {
  almacenId: string;
  almacenNombre: string;
  /** Semanas que ya existen en fum_programa (para mostrar selector rápido) */
  semanasDisponibles: number[];
  onClose: () => void;
  onSyncComplete: () => void;
}

type Screen = 'config' | 'syncing' | 'result';

export default function SyncSheetsModal({
  almacenId,
  almacenNombre,
  semanasDisponibles,
  onClose,
  onSyncComplete,
}: SyncSheetsModalProps) {
  const [screen,       setScreen]       = useState<Screen>('config');
  const [loadingConfig,setLoadingConfig] = useState(true);
  const [config,       setConfig]        = useState<SheetsConfig | null>(null);

  // ── Campos del form ────────────────────────────────────────────────
  const [urlOrId,      setUrlOrId]      = useState('');
  const [sheetName,    setSheetName]    = useState('Programa');
  const [dataStartRow, setDataStartRow] = useState('2');
  const [dryRun,       setDryRun]       = useState(false);

  // ── Filtro de semana ───────────────────────────────────────────────
  // null = todas las semanas, number = solo esa semana
  const [soloSemana, setSoloSemana] = useState<number | null>(null);

  // ── Resultado ──────────────────────────────────────────────────────
  const [result,     setResult]     = useState<SyncResult | null>(null);
  const [syncError,  setSyncError]  = useState<string | null>(null);
  const [formError,  setFormError]  = useState<string | null>(null);

  useEffect(() => {
    getSheetsConfig(almacenId).then(cfg => {
      if (cfg) {
        setConfig(cfg);
        setUrlOrId(cfg.spreadsheet_id);
        setSheetName(cfg.sheet_name);
        setDataStartRow(String(cfg.data_start_row));
      }
      setLoadingConfig(false);
    });
  }, [almacenId]);

  const handleSync = async () => {
    setFormError(null);

    const spreadsheetId = extractSpreadsheetId(urlOrId);
    if (!spreadsheetId) {
      setFormError('URL o ID del Spreadsheet inválido.');
      return;
    }

    const startRow = parseInt(dataStartRow) || 2;
    if (startRow < 1 || startRow > 100) {
      setFormError('La fila de inicio debe estar entre 1 y 100.');
      return;
    }

    try {
      await saveSheetsConfig(almacenId, {
        spreadsheetId,
        sheetName: sheetName.trim() || 'Programa',
        dataStartRow: startRow,
      });
    } catch (err: any) {
      setFormError(`Error guardando config: ${err.message}`);
      return;
    }

    setScreen('syncing');
    setSyncError(null);

    try {
      const res = await syncFromSheets(
        {
          almacenId,
          spreadsheetId,
          sheetName: sheetName.trim() || 'Programa',
          dataStartRow: startRow,
          dryRun,
          // Filtro de semana: lo mandamos al backend si está activo
          filterSemana: soloSemana ?? undefined,
        },
        onSyncComplete,
      );
      setResult(res);
      setScreen('result');
    } catch (err: any) {
      setSyncError(err.message ?? 'Error desconocido');
      setScreen('result');
    }
  };

  // ── Semana rápida: calcula la próxima semana del año actual
  const semanaActual = (() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    return Math.ceil(((now.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7);
  })();

  const semanasOpciones: number[] = semanasDisponibles.length > 0
    ? semanasDisponibles
    : Array.from({ length: 10 }, (_, i) => semanaActual + i);

  return (
    <>
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40"
        onClick={screen !== 'syncing' ? onClose : undefined}
      />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-[520px] bg-[#12131e] border border-[#252638] rounded-2xl
          shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">

          {/* ── Header ──────────────────────────────────────────── */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-[#1c1d2e]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#0e3a25] text-base">
                📊
              </div>
              <div>
                <div className="font-syne font-extrabold text-[#eceef5] text-sm">
                  Sync Google Sheets
                </div>
                <div className="text-[10px] text-[#3e4262] mt-px">{almacenNombre}</div>
              </div>
            </div>
            {screen !== 'syncing' && (
              <button onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#252638]
                  text-[#7b7f9e] hover:text-[#eceef5] hover:bg-[#181929] transition-colors text-sm">
                ✕
              </button>
            )}
          </div>

          {/* ════════════════════════════════════════════════════ */}
          {/* Screen: CONFIG                                       */}
          {/* ════════════════════════════════════════════════════ */}
          {screen === 'config' && (
            <div className="px-6 py-5 space-y-5 overflow-y-auto max-h-[80vh]">

              {/* Banner */}
              <div className="flex items-start gap-3 px-4 py-3 bg-blue-900/10 border border-blue-800/20 rounded-xl">
                <span className="text-sm mt-0.5 flex-shrink-0">ℹ️</span>
                <div className="text-[11px] text-blue-300/80 space-y-1">
                  <div>
                    <strong>Columnas esperadas:</strong> A=Semana · B=Fecha (DD/MM/YYYY) · C=Variedad ·
                    D=Producto · E=Dosis/200L · I=Método · J=Tambos
                  </div>
                  <div>
                    El Sheets debe estar <strong>compartido como Lector</strong> con el email de la Service Account.
                  </div>
                </div>
              </div>

              {/* Último sync */}
              {config?.last_synced_at && (
                <div className="flex items-center gap-2 px-3 py-2 bg-emerald-900/10 border border-emerald-800/20 rounded-lg">
                  <span className="text-emerald-400 text-xs">✓</span>
                  <span className="text-[11px] text-emerald-400/80">
                    Último sync: {new Date(config.last_synced_at).toLocaleString('es-MX')}
                    {config.last_sync_rows != null && ` · ${config.last_sync_rows} filas`}
                  </span>
                </div>
              )}

              {/* Spreadsheet ID */}
              <div>
                <label className="block text-[11px] font-bold text-[#7b7f9e] uppercase tracking-wider mb-2">
                  URL o ID del Google Spreadsheet *
                </label>
                <input
                  type="text"
                  value={urlOrId}
                  onChange={e => { setUrlOrId(e.target.value); setFormError(null); }}
                  placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs.../edit"
                  className="w-full px-3 py-2.5 bg-[#0e0f1a] border border-[#252638] rounded-lg
                    text-[#eceef5] text-xs font-mono outline-none focus:border-emerald-500 transition-colors
                    placeholder:text-[#2e3050]"
                />
                <div className="text-[10px] text-[#3e4262] mt-1.5">
                  Pega la URL completa o solo el ID entre <code>/d/</code> y <code>/edit</code>
                </div>
              </div>

              {/* Pestaña + fila */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#7b7f9e] uppercase tracking-wider mb-2">
                    Nombre de la pestaña
                  </label>
                  <input
                    type="text"
                    value={sheetName}
                    onChange={e => setSheetName(e.target.value)}
                    placeholder="Programa"
                    className="w-full px-3 py-2.5 bg-[#0e0f1a] border border-[#252638] rounded-lg
                      text-[#eceef5] text-sm outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#7b7f9e] uppercase tracking-wider mb-2">
                    1ª fila de datos
                  </label>
                  <input
                    type="number" min="1" max="100"
                    value={dataStartRow}
                    onChange={e => setDataStartRow(e.target.value)}
                    className="w-full px-3 py-2.5 bg-[#0e0f1a] border border-[#252638] rounded-lg
                      text-[#eceef5] text-sm font-mono outline-none focus:border-emerald-500 transition-colors"
                  />
                  <div className="text-[10px] text-[#3e4262] mt-1">fila 1 = encabezados</div>
                </div>
              </div>

              {/* ── FILTRO DE SEMANA ─────────────────────────── */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[11px] font-bold text-[#7b7f9e] uppercase tracking-wider">
                    Filtrar por semana
                  </label>
                  {soloSemana !== null && (
                    <button
                      onClick={() => setSoloSemana(null)}
                      className="text-[10px] text-[#3e4262] hover:text-[#7b7f9e] transition-colors">
                      Limpiar → importar todas
                    </button>
                  )}
                </div>

                {/* Badge informativo */}
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border mb-3 text-[11px] transition-all ${
                  soloSemana !== null
                    ? 'bg-amber-900/15 border-amber-700/30 text-amber-300'
                    : 'bg-[#0e0f1a] border-[#1c1d2e] text-[#3e4262]'
                }`}>
                  <span>{soloSemana !== null ? '🔍' : '📋'}</span>
                  {soloSemana !== null
                    ? `Solo se importarán filas donde Semana = ${soloSemana}`
                    : 'Se importarán todas las semanas del Sheets'}
                </div>

                {/* Selector visual de semanas */}
                <div className="flex flex-wrap gap-1.5">
                  {semanasOpciones.map(s => (
                    <button
                      key={s}
                      onClick={() => setSoloSemana(soloSemana === s ? null : s)}
                      className={`px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all duration-100 ${
                        soloSemana === s
                          ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                          : 'bg-[#0e0f1a] border-[#252638] text-[#7b7f9e] hover:border-[#2e3050] hover:text-[#eceef5]'
                      }`}>
                      S{s}
                    </button>
                  ))}

                  {/* Input manual para semana no listada */}
                  <div className="flex items-center gap-1.5 pl-1">
                    <span className="text-[10px] text-[#3e4262]">otra:</span>
                    <input
                      type="number"
                      min="1" max="53"
                      value={soloSemana !== null && !semanasOpciones.includes(soloSemana) ? soloSemana : ''}
                      onChange={e => {
                        const v = parseInt(e.target.value);
                        setSoloSemana(v >= 1 && v <= 53 ? v : null);
                      }}
                      placeholder="—"
                      className="w-12 px-2 py-1.5 bg-[#0e0f1a] border border-[#252638] rounded-lg
                        text-[#eceef5] text-[11px] font-mono text-center outline-none
                        focus:border-amber-500 transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* Dry run toggle */}
              <div className="flex items-center gap-3 px-3 py-2.5 bg-[#0e0f1a] border border-[#1c1d2e] rounded-lg">
                <button
                  onClick={() => setDryRun(v => !v)}
                  className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${
                    dryRun ? 'bg-amber-500' : 'bg-[#252638]'
                  }`}>
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                    dryRun ? 'translate-x-4' : ''
                  }`}/>
                </button>
                <div>
                  <div className="text-xs font-semibold text-[#eceef5]">Modo simulación (dry run)</div>
                  <div className="text-[10px] text-[#3e4262]">
                    Muestra cuántas filas se importarían sin escribir en la base de datos
                  </div>
                </div>
              </div>

              {/* Error */}
              {formError && (
                <div className="px-3 py-2.5 bg-red-900/20 border border-red-800/30 rounded-lg text-sm text-red-400">
                  {formError}
                </div>
              )}

              {/* Acciones */}
              <div className="flex gap-2 pt-1">
                <button onClick={onClose}
                  className="px-4 py-2.5 rounded-lg border border-[#252638] text-[#7b7f9e]
                    text-sm font-semibold hover:bg-[#181929] transition-colors">
                  Cancelar
                </button>
                <button
                  onClick={handleSync}
                  disabled={!urlOrId.trim() || loadingConfig}
                  className="flex-1 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400
                    disabled:opacity-50 disabled:cursor-not-allowed text-black text-sm font-bold
                    transition-colors flex items-center justify-center gap-2">
                  {dryRun
                    ? '🔍 Simular sync'
                    : soloSemana !== null
                      ? `📊 Sync semana ${soloSemana}`
                      : '📊 Sincronizar todas'}
                </button>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════ */}
          {/* Screen: SYNCING                                      */}
          {/* ════════════════════════════════════════════════════ */}
          {screen === 'syncing' && (
            <div className="px-6 py-12 flex flex-col items-center gap-5">
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 rounded-full border-4 border-[#1c1d2e]"/>
                <div className="absolute inset-0 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin"/>
                <div className="absolute inset-0 flex items-center justify-center text-2xl">📊</div>
              </div>
              <div className="text-center">
                <div className="font-syne font-bold text-[#eceef5] text-base">
                  {soloSemana !== null ? `Importando semana ${soloSemana}…` : 'Sincronizando…'}
                </div>
                <div className="text-xs text-[#7b7f9e] mt-2 max-w-xs">
                  Leyendo el Google Sheets e importando filas a la base de datos.
                </div>
              </div>
              <div className="w-full max-w-xs space-y-2">
                {['Autenticando con Google...', 'Leyendo programa del Sheets...', 'Importando a fum_programa...'].map((step, i) => (
                  <div key={i} className="flex items-center gap-2 text-[11px] text-[#3e4262]">
                    <span className="w-4 h-4 rounded-full border border-[#252638] flex items-center justify-center
                      text-[9px] flex-shrink-0 animate-pulse">{i + 1}</span>
                    {step}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════ */}
          {/* Screen: RESULT                                       */}
          {/* ════════════════════════════════════════════════════ */}
          {screen === 'result' && (
            <div className="px-6 py-5 space-y-4">

              {syncError && (
                <div className="flex items-start gap-3 px-4 py-3 bg-red-900/20 border border-red-800/30 rounded-xl">
                  <span className="text-red-400 text-lg flex-shrink-0">✕</span>
                  <div>
                    <div className="text-sm font-bold text-red-400">Error en la sincronización</div>
                    <div className="text-xs text-red-400/70 mt-1">{syncError}</div>
                    <div className="text-[10px] text-[#3e4262] mt-2">
                      Verifica el secret GOOGLE_SERVICE_ACCOUNT_JSON y que el Sheets esté compartido.
                    </div>
                  </div>
                </div>
              )}

              {result && !syncError && (
                <>
                  <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
                    result.dry_run
                      ? 'bg-amber-900/20 border-amber-800/30'
                      : result.errores.length === 0
                        ? 'bg-emerald-900/20 border-emerald-800/30'
                        : 'bg-yellow-900/20 border-yellow-800/30'
                  }`}>
                    <span className="text-2xl flex-shrink-0">
                      {result.dry_run ? '🔍' : result.errores.length === 0 ? '✅' : '⚠️'}
                    </span>
                    <div>
                      <div className="text-sm font-bold text-[#eceef5]">
                        {result.dry_run ? 'Simulación completada' : 'Sync completado'}
                        {soloSemana !== null && <span className="ml-2 text-[11px] font-mono text-amber-400">— semana {soloSemana}</span>}
                      </div>
                      <div className="text-[10px] text-[#7b7f9e] mt-0.5">
                        {new Date(result.synced_at).toLocaleString('es-MX')}
                        {result.total_filas_leidas != null && ` · ${result.total_filas_leidas} filas leídas`}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: result.dry_run ? 'A importar' : 'Creadas',    value: result.creadas,      color: 'text-emerald-400', bg: 'bg-emerald-900/10 border-emerald-800/20' },
                      { label: 'Actualizadas', value: result.actualizadas,   color: 'text-blue-400',    bg: 'bg-blue-900/10 border-blue-800/20'     },
                      { label: 'Sin cambios',  value: result.sin_cambios,    color: 'text-[#7b7f9e]',   bg: 'bg-[#0e0f1a] border-[#1c1d2e]'         },
                    ].map(s => (
                      <div key={s.label} className={`${s.bg} border rounded-xl p-3 text-center`}>
                        <div className={`font-mono text-2xl font-bold ${s.color}`}>{s.value}</div>
                        <div className="text-[10px] text-[#3e4262] uppercase tracking-wider mt-1">{s.label}</div>
                      </div>
                    ))}
                  </div>

                  {result.errores.length > 0 && (
                    <div className="bg-[#0e0f1a] border border-[#1c1d2e] rounded-xl p-3">
                      <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider mb-2">
                        Advertencias ({result.errores.length})
                      </div>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {result.errores.map((e, i) => (
                          <div key={i} className="text-[10px] text-[#7b7f9e] font-mono leading-relaxed">· {e}</div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              <div className="flex gap-2 pt-1">
                {result && !result.dry_run && !syncError ? (
                  <button onClick={onClose}
                    className="flex-1 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400
                      text-black text-sm font-bold transition-colors">
                    Cerrar — ver programa actualizado
                  </button>
                ) : (
                  <>
                    <button onClick={onClose}
                      className="px-4 py-2.5 rounded-lg border border-[#252638] text-[#7b7f9e]
                        text-sm font-semibold hover:bg-[#181929] transition-colors">
                      Cerrar
                    </button>
                    <button
                      onClick={() => { setSyncError(null); setResult(null); setScreen('config'); }}
                      className="flex-1 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400
                        text-black text-sm font-bold transition-colors">
                      {syncError ? 'Reintentar' : 'Sync real'}
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}