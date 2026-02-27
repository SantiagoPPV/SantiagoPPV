/**
 * ApprovalRequestModal.tsx — Modal universal de solicitud de autorización
 *
 * Aparece cuando canExecute() devuelve 'needs_approval' y el usuario
 * confirma que quiere proceder con la acción sensible.
 *
 * Fase 8 lo usa en Exportacion.jsx (via ApprovalRequestModalJSX.jsx).
 *
 * Props:
 *   action_key    — clave de la acción (ej: 'exportacion.kanban.advance_without_docs')
 *   context_id    — ID del recurso afectado (embarque_id, corte_id, etc.) — opcional
 *   context_data  — datos legibles para mostrar en la solicitud y en el panel admin
 *   title         — título a mostrar en el modal
 *   description   — descripción de qué va a ocurrir
 *   onClose       — callback al cerrar sin enviar
 *   onApproved    — callback si el usuario ya tiene una aprobación vigente (ejecutar directo)
 *   onRequested   — callback tras enviar la solicitud exitosamente
 *
 * Flujo:
 *   1. Al montar, checkApproval() verifica si ya hay aprobación vigente.
 *      Si hay → llama onApproved() directamente sin mostrar nada.
 *   2. Si no hay → muestra el modal con dos opciones:
 *      a) "Solicitar autorización" → requestApproval() + onRequested()
 *      b) "Cancelar" → onClose()
 */
import React, { useEffect, useState } from 'react';
import { Loader2, Send, ShieldAlert } from 'lucide-react';
import { useApprovals } from './hooks/useApprovals';
import { ACTION_LABELS_MAP } from './actionLabels';
import type { CreateApprovalPayload } from './configTypes';

interface Props {
  action_key: string;
  context_id?: string;
  context_data?: Record<string, unknown>;
  title?: string;
  description?: string;
  onClose: () => void;
  onApproved: () => void;       // hay aprobación vigente → ejecutar directo
  onRequested: (id: string) => void; // solicitud enviada
}

export default function ApprovalRequestModal({
  action_key,
  context_id,
  context_data,
  title,
  description,
  onClose,
  onApproved,
  onRequested,
}: Props) {
  const { checkApproval, requestApproval } = useApprovals();
  const [checking,  setChecking]  = useState(true);
  const [sending,   setSending]   = useState(false);

  const actionInfo = ACTION_LABELS_MAP[action_key];
  const displayTitle = title ?? actionInfo?.label ?? action_key;
  const displayDesc  = description ?? actionInfo?.description ?? '';

  // Al montar: verificar si hay aprobación vigente
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await checkApproval(action_key, context_id);
      if (cancelled) return;
      setChecking(false);
      if (result === 'allowed') {
        // Aprobación vigente — ejecutar sin mostrar modal
        onApproved();
      }
      // Si 'needs_approval': quedarse en el modal
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRequest = async () => {
    setSending(true);
    try {
      const payload: CreateApprovalPayload = {
        action_key,
        context_id,
        context_data,
      };
      const id = await requestApproval(payload);
      onRequested(id);
    } catch {
      // toast ya fue mostrado por requestApproval
    } finally {
      setSending(false);
    }
  };

  // Mientras verifica la aprobación vigente → spinner pequeño
  if (checking) {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
        <div className="bg-[#1A1A1A] rounded-2xl p-8 flex items-center gap-3 shadow-2xl">
          <Loader2 className="w-5 h-5 animate-spin text-[#555]" />
          <span className="text-[#999] text-sm">Verificando permisos…</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-[#1A1A1A] border border-[#333] rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-start gap-4 p-6 border-b border-[#222]">
          <div className="w-10 h-10 rounded-xl bg-[#F59E0B15] border border-[#F59E0B30] flex items-center justify-center flex-shrink-0">
            <ShieldAlert className="w-5 h-5 text-[#F59E0B]" />
          </div>
          <div>
            <h3 className="text-white font-semibold text-base">Acción requiere autorización</h3>
            <p className="text-[#555] text-xs mt-0.5">{displayTitle}</p>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {displayDesc && (
            <p className="text-[#999] text-sm leading-relaxed">{displayDesc}</p>
          )}

          {/* Contexto de la acción */}
          {context_data && Object.keys(context_data).length > 0 && (
            <div className="bg-[#111] rounded-xl px-4 py-3 space-y-2 border border-[#222]">
              <p className="text-[11px] text-[#555] font-semibold uppercase tracking-wider">
                Detalles de la solicitud
              </p>
              {Object.entries(context_data).map(([k, v]) => (
                <div key={k} className="flex justify-between items-center gap-4">
                  <span className="text-[#555] text-xs capitalize">{String(k).replace(/_/g, ' ')}</span>
                  <span className="text-[#ccc] text-xs font-medium text-right">{String(v)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Explicación del flujo */}
          <div className="bg-[#3B82F615] border border-[#3B82F630] rounded-xl p-3">
            <p className="text-[#3B82F6] text-xs leading-relaxed">
              Al solicitar autorización, el administrador recibirá una notificación.
              Una vez aprobada, tendrás <strong>4 horas</strong> para ejecutar la acción.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 pt-0 justify-end">
          <button
            onClick={onClose}
            disabled={sending}
            className="text-sm text-[#666] hover:text-white transition-colors px-4 py-2 rounded-lg hover:bg-[#222]"
          >
            Cancelar
          </button>
          <button
            onClick={handleRequest}
            disabled={sending}
            className="flex items-center gap-2 text-sm bg-[#3B82F6] hover:bg-[#2563EB] disabled:opacity-50 text-white px-5 py-2 rounded-lg transition-colors"
          >
            {sending
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Send className="w-4 h-4" />
            }
            {sending ? 'Enviando…' : 'Solicitar autorización'}
          </button>
        </div>
      </div>
    </div>
  );
}