/**
 * ApprovalQueue.tsx — Cola de solicitudes de autorización
 *
 * Fase 7 conecta este componente al hook useApprovals.
 * Este scaffold tiene toda la estructura visual lista:
 *   - Tab "Pendientes" con botones Aprobar/Rechazar
 *   - Tab "Historial" con estado de solicitudes pasadas
 *   - Loading state y estado vacío
 *
 * Lo que Fase 7 agrega:
 *   1. Descomentar useApprovals()
 *   2. Conectar pendingCount al badge del Header (ya tiene el TODO en Header.tsx)
 *   3. Modal de confirmación con nota del admin
 *   4. Polling o Supabase Realtime para actualización en vivo
 *
 * Solo visible para usuarios con is_admin = true (controlado en ConfigLayout).
 */
import React, { useState } from 'react';
import { CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react';
import type { ApprovalRequest, ReviewApprovalPayload } from './configTypes';
import { ACTION_LABELS_MAP } from './actionLabels';
import { useApprovals } from './hooks/useApprovals';

type QueueTab = 'pendientes' | 'historial';

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ApprovalRequest['status'] }) {
  const map = {
    pending:  { label: 'Pendiente', cls: 'bg-[#F59E0B15] text-[#F59E0B]', icon: '⏳' },
    approved: { label: 'Aprobada',  cls: 'bg-[#10B98115] text-[#10B981]', icon: '✅' },
    rejected: { label: 'Rechazada', cls: 'bg-[#EF444415] text-[#EF4444]', icon: '❌' },
    expired:  { label: 'Expirada',  cls: 'bg-[#33333380] text-[#666]',    icon: '🕰️' },
  } as const;
  const s = map[status];
  return (
    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${s.cls}`}>
      {s.icon} {s.label}
    </span>
  );
}

// ─── Tarjeta de solicitud ─────────────────────────────────────────────────────

interface RequestCardProps {
  request: ApprovalRequest;
  showActions: boolean;
  onApprove?: (id: string, note?: string) => void;
  onReject?: (id: string, note?: string) => void;
}

function RequestCard({ request, showActions, onApprove, onReject }: RequestCardProps) {
  const [noteInput, setNoteInput] = useState('');
  const [showNoteFor, setShowNoteFor] = useState<'approve' | 'reject' | null>(null);

  const action = ACTION_LABELS_MAP[request.action_key];
  const contextData = request.context_data as Record<string, string> | null;

  const handleAction = (type: 'approve' | 'reject') => {
    if (showNoteFor === type) {
      // Segunda vez: confirmar con nota
      if (type === 'approve') onApprove?.(request.id, noteInput || undefined);
      else onReject?.(request.id, noteInput || undefined);
      setShowNoteFor(null);
      setNoteInput('');
    } else {
      setShowNoteFor(type);
    }
  };

  return (
    <div className="bg-[#111] border border-[#222] rounded-xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white font-medium">
            {action?.label ?? request.action_key}
          </p>
          <p className="text-[11px] text-[#555] mt-0.5">
            {action?.module ?? '—'} · {new Date(request.created_at).toLocaleString('es-MX')}
          </p>
        </div>
        <StatusBadge status={request.status} />
      </div>

      {/* Contexto */}
      {contextData && Object.keys(contextData).length > 0 && (
        <div className="bg-[#0a0a0a] rounded-lg px-3 py-2 text-xs space-y-1">
          {Object.entries(contextData).map(([k, v]) => (
            <div key={k} className="flex gap-2">
              <span className="text-[#555] capitalize">{k}:</span>
              <span className="text-[#ccc]">{String(v)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Nota del admin (si fue revisada) */}
      {request.admin_notes && (
        <div className="text-xs text-[#999] italic border-l-2 border-[#333] pl-3">
          "{request.admin_notes}"
        </div>
      )}

      {/* Botones de acción */}
      {showActions && (
        <>
          {showNoteFor && (
            <input
              type="text"
              placeholder="Nota opcional para el usuario…"
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              className="w-full bg-[#1A1A1A] text-white text-xs px-3 py-2 rounded-lg border border-[#333] focus:outline-none focus:border-[#3B82F6]"
            />
          )}
          <div className="flex gap-2">
            <button
              onClick={() => handleAction('approve')}
              className="flex items-center gap-1.5 text-xs bg-[#10B98120] hover:bg-[#10B98130] text-[#10B981] px-3 py-1.5 rounded-lg transition-colors"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              {showNoteFor === 'approve' ? 'Confirmar aprobación' : 'Aprobar'}
            </button>
            <button
              onClick={() => handleAction('reject')}
              className="flex items-center gap-1.5 text-xs bg-[#EF444420] hover:bg-[#EF444430] text-[#EF4444] px-3 py-1.5 rounded-lg transition-colors"
            >
              <XCircle className="w-3.5 h-3.5" />
              {showNoteFor === 'reject' ? 'Confirmar rechazo' : 'Rechazar'}
            </button>
            {showNoteFor && (
              <button onClick={() => setShowNoteFor(null)} className="text-xs text-[#555] hover:text-white px-2">
                Cancelar
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function ApprovalQueue() {
  const [activeTab, setActiveTab] = useState<QueueTab>('pendientes');
  const { pending, history, isLoading, reviewRequest } = useApprovals();

  const handleApprove = async (requestId: string, note?: string) => {
    await reviewRequest({ request_id: requestId, decision: 'approved', admin_notes: note });
  };

  const handleReject = async (requestId: string, note?: string) => {
    await reviewRequest({ request_id: requestId, decision: 'rejected', admin_notes: note });
  };

  const tabs: { id: QueueTab; label: string; count?: number }[] = [
    { id: 'pendientes', label: 'Pendientes', count: pending.length },
    { id: 'historial',  label: 'Historial' },
  ];

  const currentList = activeTab === 'pendientes' ? pending : history;

  return (
    <div className="p-6 max-w-3xl">
      {/* Cabecera */}
      <div className="mb-6">
        <h2 className="text-white font-semibold text-lg">Solicitudes de Autorización</h2>
        <p className="text-[#555] text-sm mt-1">
          Revisa y actúa sobre las acciones que requieren aprobación de administrador.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-[#222] mb-5">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${
              activeTab === tab.id
                ? 'border-[#3B82F6] text-white'
                : 'border-transparent text-[#555] hover:text-[#999]'
            }`}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className="bg-[#EF4444] text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {tab.count > 9 ? '9+' : tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Contenido */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-[#555]" />
        </div>
      ) : currentList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-[#555]">
          <Clock className="w-8 h-8 mb-3 opacity-50" />
          <p className="text-sm">
            {activeTab === 'pendientes'
              ? 'No hay solicitudes pendientes'
              : 'Sin historial de solicitudes'}
          </p>
          {activeTab === 'pendientes' && (
            <p className="text-xs mt-1 text-[#444]">
              Las solicitudes aparecerán aquí cuando un usuario intente realizar una acción sensible
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {currentList.map((req) => (
            <RequestCard
              key={req.id}
              request={req}
              showActions={activeTab === 'pendientes'}
              onApprove={handleApprove}
              onReject={handleReject}
            />
          ))}
        </div>
      )}
    </div>
  );
}