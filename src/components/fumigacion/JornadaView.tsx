import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuthStore } from '../../store/useAuthStore';
import { JORNADA_FASES } from './fumigacionTypes';
import type { AlertaInventario } from './fumigacionTypes';

interface JornadaViewProps {
  alertas: AlertaInventario[];
  almacenId: string;
  onIrAPrograma: () => void;
  onIrAAplicaciones: () => void;
}

type Clima = 'despejado' | 'parcial' | 'lluvia';

export default function JornadaView({
  alertas,
  almacenId,
  onIrAPrograma,
  onIrAAplicaciones,
}: JornadaViewProps) {
  const { user } = useAuthStore();
  const today = new Date().toISOString().split('T')[0];

  const [clima, setClima] = useState<Clima>('despejado');
  const [responsableId, setResponsableId] = useState<number | null>(null);
  const [supervisores, setSupervisores] = useState<{ ID: number; name: string }[]>([]);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [openFases, setOpenFases] = useState<Set<string>>(new Set(['inicio']));
  const [guardando, setGuardando] = useState(false);
  const [cerrada, setCerrada] = useState(false);
  const [notas, setNotas] = useState('');

  // Items activos (filtrar por lluvia)
  const fasesActivas = JORNADA_FASES.map(f => ({
    ...f,
    items: f.items.filter(i => !i.onlyIfLluvia || clima === 'lluvia'),
  }));

  const totalItems = fasesActivas.reduce((s, f) => s + f.items.length, 0);
  const doneItems = Object.values(checks).filter(Boolean).length;
  const pct = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;

  useEffect(() => {
    // Cargar supervisores
    supabase
      .from('Users')
      .select('"ID", name')
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => {
        if (data) setSupervisores(data.map((u: any) => ({ ID: u.ID, name: u.name })));
      });
    // Preseleccionar usuario actual
    if (user?.id) setResponsableId(Number(user.id));
  }, []);

  // Cargar jornada guardada del día (si existe)
  useEffect(() => {
    if (!almacenId) return;
    supabase
      .from('fum_jornadas')
      .select('*')
      .eq('fecha', today)
      .eq('almacen_id', almacenId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setClima((data.clima as Clima) ?? 'despejado');
        setChecks(data.items_completados ?? {});
        setNotas(data.notas_cierre ?? '');
        if (data.responsable_id) setResponsableId(data.responsable_id);
        if (data.cerrada_at) setCerrada(true);
      });
  }, [almacenId, today]);

  const toggleFase = (id: string) => {
    setOpenFases(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleCheck = (key: string) => {
    if (cerrada) return;
    setChecks(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleCerrar = async () => {
    setGuardando(true);
    try {
      await supabase.from('fum_jornadas').upsert({
        fecha: today,
        almacen_id: almacenId,
        responsable_id: responsableId,
        clima,
        items_completados: checks,
        notas_cierre: notas || null,
        cerrada_at: new Date().toISOString(),
      }, { onConflict: 'fecha,almacen_id' });
      setCerrada(true);
    } catch (err) {
      console.error('Error cerrando jornada:', err);
    } finally {
      setGuardando(false);
    }
  };

  const pendientes = totalItems - doneItems;
  const todayFormatted = new Date().toLocaleDateString('es-MX', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">

      {/* ── Hero card ───────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-emerald-900/20 to-emerald-900/5
        border border-emerald-800/30 rounded-2xl p-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="font-syne text-lg font-extrabold text-[#eceef5] capitalize">
              {todayFormatted}
            </div>
            <div className="text-sm text-[#7b7f9e] mt-1">
              {doneItems}/{totalItems} ítems completados
              {cerrada && (
                <span className="ml-2 px-2 py-0.5 bg-emerald-900/40 text-emerald-400
                  text-[10px] font-bold font-mono rounded-full border border-emerald-800/40">
                  CERRADA
                </span>
              )}
            </div>

            {/* Barra de progreso */}
            <div className="flex items-center gap-3 mt-3">
              <div className="w-40 h-2 bg-[#1c1d2e] rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-400"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="font-mono text-sm font-bold text-emerald-400">{pct}%</span>
            </div>
          </div>

          {/* Selector clima */}
          <div className="flex flex-col gap-2">
            {([
              { key: 'despejado', emoji: '☀️', label: 'Sin lluvia' },
              { key: 'parcial',   emoji: '⛅', label: 'Parcial' },
              { key: 'lluvia',    emoji: '🌧️', label: 'Llovió' },
            ] as { key: Clima; emoji: string; label: string }[]).map(c => (
              <button
                key={c.key}
                onClick={() => setClima(c.key)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs
                  font-semibold transition-all duration-100 ${
                    clima === c.key
                      ? c.key === 'lluvia'
                        ? 'bg-blue-900/30 border-blue-700/40 text-blue-400'
                        : c.key === 'parcial'
                          ? 'bg-[#252638] border-[#2e3050] text-[#7b7f9e]'
                          : 'bg-amber-900/20 border-amber-700/30 text-amber-400'
                      : 'bg-[#0e0f1a] border-[#1c1d2e] text-[#3e4262] hover:border-[#252638]'
                  }`}
              >
                {c.emoji} {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Selector responsable */}
        <select
          value={responsableId ?? ''}
          onChange={e => setResponsableId(e.target.value ? Number(e.target.value) : null)}
          className="mt-3 w-full px-3 py-2 bg-[#0e0f1a] border border-[#1c1d2e] rounded-lg
            text-sm text-[#eceef5] outline-none focus:border-emerald-500 transition-colors"
        >
          <option value="">Seleccionar responsable...</option>
          {supervisores.map(s => (
            <option key={s.ID} value={s.ID}>{s.name}</option>
          ))}
        </select>
      </div>

      {/* ── Alerta urgente inventario ────────────────────────────── */}
      {alertas.length > 0 && (
        <button
          onClick={onIrAPrograma}
          className="w-full flex items-start gap-3 px-4 py-3.5
            bg-red-900/20 border border-red-800/30 rounded-xl text-left
            hover:bg-red-900/30 transition-colors"
        >
          <span className="text-xl mt-0.5">🚨</span>
          <div className="flex-1">
            <div className="text-sm font-bold text-red-400">
              Revisar inventario URGENTE — hoy
            </div>
            <div className="text-xs text-[#7b7f9e] mt-1">
              {alertas.length} producto{alertas.length > 1 ? 's' : ''} sin stock suficiente
              para los próximos 3 días.{' '}
              <span className="text-red-400/70">{alertas.map(a => a.producto_nombre).join(', ')}</span>
            </div>
          </div>
          <span className="text-[#3e4262] text-sm">→</span>
        </button>
      )}

      {/* ── Fases del checklist ──────────────────────────────────── */}
      {fasesActivas.map(fase => {
        const doneFase = fase.items.filter(i => checks[i.key]).length;
        const isOpen = openFases.has(fase.id);

        return (
          <div key={fase.id}
            className="bg-[#181929] border border-[#1c1d2e] rounded-xl overflow-hidden">
            <button
              onClick={() => toggleFase(fase.id)}
              className="w-full flex items-center justify-between px-4 py-3.5
                hover:bg-[#1c1d2e] transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-base">{fase.icon}</span>
                <div className="text-left">
                  <div className="font-syne text-sm font-bold text-[#eceef5]">{fase.label}</div>
                  <div className="text-[11px] text-[#7b7f9e] mt-0.5">
                    {doneFase}/{fase.items.length} completados
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {/* Mini ring */}
                <svg className="w-7 h-7 -rotate-90" viewBox="0 0 28 28">
                  <circle cx="14" cy="14" r="11" fill="none" stroke="#1c1d2e" strokeWidth="3" />
                  {doneFase > 0 && (
                    <circle
                      cx="14" cy="14" r="11"
                      fill="none" stroke="#10b981" strokeWidth="3"
                      strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * 11}
                      strokeDashoffset={2 * Math.PI * 11 * (1 - doneFase / fase.items.length)}
                      className="transition-all duration-400"
                    />
                  )}
                </svg>
                <svg
                  className={`w-4 h-4 text-[#3e4262] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                  viewBox="0 0 16 16" fill="none"
                >
                  <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
            </button>

            {isOpen && (
              <div className="border-t border-[#1c1d2e] divide-y divide-[#1c1d2e]">
                {fase.items.map(item => {
                  const done = checks[item.key];
                  return (
                    <button
                      key={item.key}
                      onClick={() => {
                        if (item.link && item.key === 'registrar_aplic') {
                          onIrAAplicaciones();
                        } else if (item.link && (item.key === 'prog_dia' || item.key === 'verificar_inv' || item.key === 'rev_inventario')) {
                          onIrAPrograma();
                        } else {
                          toggleCheck(item.key);
                        }
                      }}
                      className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors
                        ${done ? 'bg-emerald-900/10' : 'hover:bg-[#0e0f1a]'}`}
                    >
                      <div
                        className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center
                          flex-shrink-0 transition-all ${
                            done ? 'bg-emerald-500 border-emerald-500' : 'border-[#252638]'
                          }`}
                      >
                        {done && (
                          <svg viewBox="0 0 12 12" className="w-3 h-3" fill="none"
                            stroke="black" strokeWidth="2.5" strokeLinecap="round">
                            <polyline points="2,6 5,9 10,3" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className={`text-sm font-medium ${done ? 'text-[#7b7f9e] line-through' : 'text-[#eceef5]'}`}>
                          {item.label}
                          {item.onlyIfLluvia && (
                            <span className="ml-2 px-1.5 py-0.5 bg-blue-900/30 text-blue-400/70
                              text-[9px] font-bold font-mono rounded border border-blue-800/20">
                              🌧 si llovió
                            </span>
                          )}
                        </div>
                        {item.link && (
                          <div className="text-xs text-emerald-500 mt-0.5 font-semibold">
                            {item.link}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* ── Cierre de jornada ───────────────────────────────────── */}
      <div className="bg-[#181929] border border-[#1c1d2e] rounded-xl p-5">
        {pendientes > 0 && !cerrada && (
          <div className="flex items-center gap-2 px-3 py-2.5 bg-amber-900/20
            border border-amber-800/30 rounded-lg text-xs text-amber-400 font-medium mb-4">
            ⚠ {pendientes} ítem{pendientes > 1 ? 's' : ''} sin completar.
            Puedes cerrar la jornada de todas formas.
          </div>
        )}

        {cerrada ? (
          <div className="text-center py-4">
            <div className="text-3xl mb-2">✅</div>
            <div className="font-syne text-base font-bold text-emerald-400">Jornada cerrada</div>
            <div className="text-xs text-[#7b7f9e] mt-1">
              {doneItems}/{totalItems} ítems completados
            </div>
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-4 text-center">
              <div>
                <div className="font-syne text-2xl font-extrabold text-emerald-400">{doneItems}</div>
                <div className="text-[10px] text-[#3e4262] uppercase tracking-wider mt-0.5">Completados</div>
              </div>
              <div>
                <div className={`font-syne text-2xl font-extrabold ${pendientes > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {pendientes}
                </div>
                <div className="text-[10px] text-[#3e4262] uppercase tracking-wider mt-0.5">Pendientes</div>
              </div>
              <div>
                <div className="font-syne text-2xl font-extrabold text-blue-400">{pct}%</div>
                <div className="text-[10px] text-[#3e4262] uppercase tracking-wider mt-0.5">Avance</div>
              </div>
            </div>

            <textarea
              value={notas}
              onChange={e => setNotas(e.target.value)}
              rows={2}
              placeholder="Notas de cierre (opcional)..."
              className="w-full px-3 py-2.5 bg-[#0e0f1a] border border-[#1c1d2e] rounded-lg
                text-sm text-[#eceef5] outline-none focus:border-emerald-500 resize-none
                transition-colors mb-3"
            />

            <button
              onClick={handleCerrar}
              disabled={guardando}
              className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400
                disabled:opacity-60 text-black font-syne text-sm font-bold
                transition-colors flex items-center justify-center gap-2"
            >
              {guardando ? (
                <>
                  <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  Cerrando jornada…
                </>
              ) : pendientes === 0 ? '✅ Cerrar jornada' : '🔒 Cerrar con pendientes'}
            </button>
          </>
        )}
      </div>

      <div className="h-6" /> {/* Bottom padding */}
    </div>
  );
}