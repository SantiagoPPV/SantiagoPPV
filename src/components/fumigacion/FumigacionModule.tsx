/**
 * FumigacionModule.tsx — Shell principal del módulo de Fumigación
 * Agrícola Moray ERP
 *
 * Fase 1: CRUD completo del programa, aplicaciones, jornada y catálogo.
 * Fase 2 (pendiente): Botón "Sincronizar con Google Sheets" usando Sheets API.
 *   Los campos sheets_sync_id, sheets_range, sheets_synced_at ya están en la DB.
 *   El servicio de sync irá en /src/services/googleSheetsSync.ts
 */
import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { usePermissions } from '../../hooks/usePermissions';
import { useFumigacionPrograma } from './hooks/useFumigacionPrograma';
import { useFumigacionAplicaciones } from './hooks/useFumigacionAplicaciones';
import ProgramaView from './ProgramaView';
import AplicacionesView from './AplicacionesView';
import JornadaView from './JornadaView';
import CatalogoView from './CatalogoView';
import NuevaEntradaModal from './modals/NuevaEntradaModal';
import SyncSheetsModal from './modals/SyncSheetsModal';
import type { FumTab, FumProgramaEnriquecida } from './fumigacionTypes';

interface Almacen {
  id: string;
  nombre: string;
  slug: string;
  activo: boolean;
}

const RANCHO_NAV_KEY: Record<string, string> = {
  moray:   'inventario.rancho.moray',
  mojave:  'inventario.rancho.mojave',
  lapena:  'inventario.rancho.lapena',
};

const RANCHO_COLOR: Record<string, string> = {
  moray:  '#10b981',
  mojave: '#f59e0b',
  lapena: '#6366f1',
};

export default function FumigacionModule() {
  const { canView, isAdmin } = usePermissions();
  const [tab, setTab] = useState<FumTab>('programa');
  const [almacenes, setAlmacenes] = useState<Almacen[]>([]);
  const [almacenActivo, setAlmacenActivo] = useState<Almacen | null>(null);
  const [showRanchoMenu, setShowRanchoMenu] = useState(false);
  // Edición de fila del programa al hacer click en la tabla
  const [editandoRow, setEditandoRow] = useState<FumProgramaEnriquecida | null>(null);
  // Fase 2: modal de sync con Google Sheets
  const [showSync, setShowSync] = useState(false);

  // ── Cargar almacenes con permisos ────────────────────────────────
  useEffect(() => {
    supabase
      .from('almacenes')
      .select('*')
      .eq('activo', true)
      .order('nombre')
      .then(({ data }) => {
        const todos = data || [];
        const visibles = isAdmin
          ? todos
          : todos.filter((a: Almacen) => canView(RANCHO_NAV_KEY[a.slug] ?? ''));
        setAlmacenes(visibles);
        if (visibles.length > 0) setAlmacenActivo(visibles[0]);
      });
  }, [isAdmin]);

  // ── Data hooks ───────────────────────────────────────────────────
  const {
    programa, productos, alertas, loading: loadingProg,
    crearEntrada, actualizarEntrada, eliminarEntrada,
    eliminarVarios, actualizarEstatusVarios,
    refresh: refreshProg,
  } = useFumigacionPrograma({ almacenId: almacenActivo?.id ?? null });

  const {
    aplicaciones, personal, loading: loadingAplic,
    crearAplicacion, actualizarAplicacion, actualizarChecklist, guardarFumigadores,
  } = useFumigacionAplicaciones({ almacenId: almacenActivo?.id ?? null });

  if (!almacenActivo) {
    return (
      <div className="flex flex-col items-center justify-center h-60 text-[#3e4262]">
        <div className="text-4xl mb-3">🌫️</div>
        <div className="text-sm font-semibold text-[#7b7f9e]">Cargando módulo de fumigación…</div>
      </div>
    );
  }

  const accentColor = RANCHO_COLOR[almacenActivo.slug] ?? '#10b981';

  return (
    <div className="flex flex-col h-full bg-[#08090f] text-[#eceef5]">

      {/* ── Topbar ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-3.5
        bg-[#0e0f1a] border-b border-[#1c1d2e] flex-shrink-0">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-base"
            style={{ background: `linear-gradient(135deg, #064e3b, ${accentColor})` }}
          >
            🌫️
          </div>
          <div>
            <div className="font-syne font-extrabold text-base text-[#eceef5]">
              Fumiga<span style={{ color: accentColor }}>ción</span>
            </div>
            <div className="text-[10px] font-mono text-[#3e4262] uppercase tracking-wider">
              {new Date().toLocaleDateString('es-MX', {
                weekday: 'short', day: 'numeric', month: 'short',
              }).toUpperCase()}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Alertas badge */}
          {alertas.length > 0 && (
            <button
              onClick={() => setTab('programa')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold
                bg-red-900/20 border border-red-800/30 text-red-400
                animate-pulse"
            >
              ⚠ {alertas.length} sin stock
            </button>
          )}

          {/* Rancho selector */}
          <div className="relative">
            <button
              onClick={() => setShowRanchoMenu(!showRanchoMenu)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold
                transition-all"
              style={{
                background: `${accentColor}15`,
                borderColor: `${accentColor}40`,
                color: accentColor,
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: accentColor }} />
              {almacenActivo.nombre}
              <svg className="w-3 h-3" viewBox="0 0 10 10" fill="none">
                <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>

            {showRanchoMenu && (
              <div
                className="absolute right-0 top-full mt-1.5 bg-[#181929] border border-[#252638]
                  rounded-xl overflow-hidden shadow-2xl z-50 min-w-[160px]"
                onMouseLeave={() => setShowRanchoMenu(false)}
              >
                {almacenes.map(a => {
                  const color = RANCHO_COLOR[a.slug] ?? '#10b981';
                  return (
                    <button
                      key={a.id}
                      onClick={() => { setAlmacenActivo(a); setShowRanchoMenu(false); }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold
                        hover:bg-[#1c1d2e] transition-colors text-left"
                      style={{ color: almacenActivo.id === a.id ? color : '#7b7f9e' }}
                    >
                      <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                      {a.nombre}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Botón Sync Google Sheets — Fase 2 ✅ */}
          <button
            onClick={() => setShowSync(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#252638]
              text-xs font-semibold text-[#7b7f9e] hover:text-[#eceef5] hover:border-[#2e3050]
              transition-all duration-150"
            title="Sincronizar con Google Sheets"
          >
            📊 Sync Sheets
          </button>
        </div>
      </div>

      {/* ── Alerta banner ──────────────────────────────────────── */}
      {alertas.length > 0 && tab === 'programa' && (
        <div className="flex items-start gap-3 px-4 py-2.5 flex-shrink-0
          bg-red-950/30 border-b border-red-900/30">
          <span className="text-sm mt-0.5">🚨</span>
          <div className="flex-1">
            <span className="text-xs font-bold text-red-400 uppercase tracking-wider">
              Inventario insuficiente — próximas 72h
            </span>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {alertas.map(a => (
                <span
                  key={a.producto_nombre}
                  className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded
                    bg-red-900/30 border border-red-800/30 text-red-300"
                >
                  {a.producto_nombre} · {a.deficit.toFixed(2)} {a.unidad}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Tab nav ─────────────────────────────────────────────── */}
      <div
        className="flex border-b border-[#1c1d2e] flex-shrink-0 bg-[#0e0f1a]"
        style={{ ['--accent' as any]: accentColor }}
      >
        {([
          { key: 'programa',     icon: '📅', label: 'Programa' },
          { key: 'aplicaciones', icon: '✅', label: 'Aplicaciones' },
          { key: 'jornada',      icon: '📋', label: 'Jornada' },
          { key: 'catalogo',     icon: '🧪', label: 'Catálogo' },
        ] as { key: FumTab; icon: string; label: string }[]).map(t => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="flex items-center gap-2 px-5 py-3.5 text-sm font-medium
                border-b-[2.5px] -mb-px transition-all duration-150"
              style={{
                color: active ? accentColor : '#3e4262',
                borderBottomColor: active ? accentColor : 'transparent',
              }}
            >
              <span className="text-sm">{t.icon}</span>
              {t.label}
              {/* Badge de alertas en tab jornada */}
              {t.key === 'jornada' && alertas.length > 0 && (
                <span className="px-1.5 py-px rounded-full text-[10px] font-bold
                  bg-red-900/40 text-red-400 font-mono">
                  {alertas.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Vistas ──────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {tab === 'programa' && (
          <ProgramaView
            programa={programa}
            productos={productos}
            alertas={alertas}
            almacenId={almacenActivo.id}
            loading={loadingProg}
            onCrear={crearEntrada}
            onActualizar={actualizarEntrada}
            onEliminar={eliminarEntrada}
            onEliminarVarios={eliminarVarios}
            onActualizarEstatusVarios={actualizarEstatusVarios}
            onVerDetalle={(row) => setEditandoRow(row)}
          />
        )}

        {/* Modal de edición de fila del programa (click en tabla) */}
        {editandoRow && (
          <NuevaEntradaModal
            almacenId={almacenActivo.id}
            productos={productos}
            initialData={editandoRow}
            onClose={() => setEditandoRow(null)}
            onSave={async (data) => {
              await actualizarEntrada(editandoRow.id, data);
              setEditandoRow(null);
            }}
          />
        )}

        {tab === 'aplicaciones' && (
          <AplicacionesView
            aplicaciones={aplicaciones}
            personal={personal}
            productos={productos}
            loading={loadingAplic}
            almacenId={almacenActivo.id}
            onCrear={crearAplicacion}
            onActualizar={actualizarAplicacion}
            onActualizarChecklist={actualizarChecklist}
            onGuardarFumigadores={guardarFumigadores}
          />
        )}

        {tab === 'jornada' && (
          <JornadaView
            alertas={alertas}
            almacenId={almacenActivo.id}
            onIrAPrograma={() => setTab('programa')}
            onIrAAplicaciones={() => setTab('aplicaciones')}
          />
        )}

        {tab === 'catalogo' && (
          <CatalogoView
            productos={productos}
            onRefresh={refreshProg}
          />
        )}
      </div>

      {/* ── Sync Sheets Modal — Fase 2 ───────────────────────────── */}
      {showSync && almacenActivo && (
        <SyncSheetsModal
          almacenId={almacenActivo.id}
          almacenNombre={almacenActivo.nombre}
          semanasDisponibles={[...new Set(programa.map(p => p.semana))].sort((a,b) => a-b)}
          onClose={() => setShowSync(false)}
          onSyncComplete={() => { refreshProg(); setTab('programa'); }}
        />
      )}
    </div>
  );
}