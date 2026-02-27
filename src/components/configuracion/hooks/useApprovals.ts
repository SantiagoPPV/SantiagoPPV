/**
 * useApprovals.ts — Cola de autorización (Fase 7 — implementación activa)
 *
 * Maneja:
 *  1. Listar solicitudes pending / historial (admin)
 *  2. Crear solicitud cuando canExecute → 'needs_approval'
 *  3. Aprobar o rechazar (admin) con nota opcional y expires_at +4h
 *  4. Verificar si hay aprobación vigente antes de ejecutar (checkApproval)
 *
 * Polling: refresca pendientes cada 30s mientras la página está activa.
 * Fase futura puede reemplazar el intervalo por Supabase Realtime.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useAuthStore } from '../../../store/useAuthStore';
import type {
  ApprovalRequest,
  CreateApprovalPayload,
  ReviewApprovalPayload,
  PermissionResult,
} from '../configTypes';
import toast from 'react-hot-toast';

const POLL_INTERVAL_MS = 30_000; // 30 segundos

interface UseApprovalsReturn {
  pending: ApprovalRequest[];
  history: ApprovalRequest[];
  pendingCount: number;
  isLoading: boolean;
  requestApproval: (payload: CreateApprovalPayload) => Promise<string>;
  reviewRequest: (payload: ReviewApprovalPayload) => Promise<void>;
  checkApproval: (action_key: string, context_id?: string) => Promise<PermissionResult>;
  refetch: () => Promise<void>;
}

export function useApprovals(): UseApprovalsReturn {
  const [pending,    setPending]    = useState<ApprovalRequest[]>([]);
  const [history,    setHistory]    = useState<ApprovalRequest[]>([]);
  const [isLoading,  setIsLoading]  = useState(true);
  const { user } = useAuthStore();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAll = useCallback(async () => {
    if (!user) { setIsLoading(false); return; }
    setIsLoading(true);
    try {
      // Expirar solicitudes viejas (>24h) antes de cargar
      // RPC puede no existir — se ignora el error con try/catch
      // (supabase.rpc() no es un Promise completo, no tiene .catch())
      try { await supabase.rpc('expire_old_approval_requests'); } catch { /* ignorar */ }

      // Dos queries separadas con filtro explícito de status.
      // Más robusto que select('*') sin filtro — evita problemas de schema cache
      // de PostgREST cuando la tabla fue recreada recientemente.
      const [pendingRes, historyRes] = await Promise.all([
        supabase
          .from('approval_requests')
          .select('*')
          .eq('status', 'pending')
          .order('created_at', { ascending: false }),
        supabase
          .from('approval_requests')
          .select('*')
          .neq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(100),
      ]);

      if (pendingRes.error) {
        console.error('[useApprovals] fetch pending:', pendingRes.error);
        toast.error('Error al cargar solicitudes: ' + pendingRes.error.message);
      } else {
        setPending((pendingRes.data ?? []) as ApprovalRequest[]);
      }

      if (historyRes.error) {
        console.error('[useApprovals] fetch history:', historyRes.error);
      } else {
        setHistory((historyRes.data ?? []) as ApprovalRequest[]);
      }
    } catch (err) {
      console.error('[useApprovals] fetchAll exception:', err);
      toast.error('Error inesperado al cargar solicitudes');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Carga inicial + polling
  useEffect(() => {
    fetchAll();
    timerRef.current = setInterval(fetchAll, POLL_INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetchAll]);

  // ── requestApproval ────────────────────────────────────────────────────────
  const requestApproval = async (payload: CreateApprovalPayload): Promise<string> => {
    if (!user) throw new Error('No hay sesión activa');

    // Admin no necesita solicitar aprobación — ejecuta directo siempre
    if (user.is_admin) {
      toast('Admin: acción ejecutada sin aprobación.', { icon: '✅' });
      return 'admin-bypass';
    }

    // Verificar si ya hay una solicitud pendiente para la misma acción+contexto
    // para no crear duplicados si el usuario hace clic dos veces
    const { data: existing } = await supabase
      .from('approval_requests')
      .select('id')
      .eq('requested_by', user.id)
      .eq('action_key', payload.action_key)
      .eq('status', 'pending')
      .maybeSingle();

    if (existing) {
      toast('Ya tienes una solicitud pendiente para esta acción.', { icon: 'ℹ️' });
      return existing.id as string;
    }

    const { data, error } = await supabase
      .from('approval_requests')
      .insert({
        requested_by: user.id,
        action_key:   payload.action_key,
        context_id:   payload.context_id   ?? null,
        context_data: payload.context_data ?? null,
        status:       'pending',
      })
      .select('id')
      .single();

    if (error) {
      toast.error('Error al enviar la solicitud de autorización');
      throw error;
    }

    toast.success('Solicitud enviada. El administrador recibirá una notificación.');
    await fetchAll();
    return data.id as string;
  };

  // ── autoExecuteApprovedAction ──────────────────────────────────────────────
  /**
   * Ejecuta automáticamente la acción aprobada cuando el admin aprueba.
   * Solo para acciones con operaciones DB simples y bien definidas.
   */
  const autoExecuteApprovedAction = async (request: ApprovalRequest): Promise<void> => {
    const { action_key, context_id, context_data } = request;
    const ctx = context_data as Record<string, string> | null;

    try {
      if (action_key === 'exportacion.kanban.advance_without_docs' && context_id && ctx?.next_status) {
        const nextStatus = ctx.next_status;
        // Actualizar status del embarque
        const { error: embErr } = await supabase
          .from('embarques')
          .update({ status: nextStatus, updated_at: new Date().toISOString() })
          .eq('id', context_id);
        if (embErr) throw embErr;
        // Registrar tracking
        await supabase.from('embarque_tracking').insert({
          embarque_id:   context_id,
          etapa_nueva:   nextStatus,
          notas:         `Avanzado automáticamente tras aprobación del administrador.`,
        });
        toast.success(`🚀 Embarque avanzado automáticamente a ${ctx.etapa_destino ?? nextStatus}`);
      }
      // Aquí se pueden agregar más action_keys en el futuro
    } catch (err) {
      console.error('[autoExecute] Error ejecutando acción:', err);
      toast.error('La acción fue aprobada pero no se pudo ejecutar automáticamente. El usuario deberá ejecutarla manualmente.');
    }
  };

  // ── reviewRequest ──────────────────────────────────────────────────────────
  const reviewRequest = async (payload: ReviewApprovalPayload): Promise<void> => {
    if (!user?.is_admin) {
      toast.error('Solo el administrador puede revisar solicitudes');
      return;
    }

    const isApproved = payload.decision === 'approved';
    const now        = new Date();
    // Al auto-ejecutar, marcamos expires_at = ahora (ya se usó) en lugar de +4h
    const expiresAt  = isApproved
      ? new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString()
      : null;

    const { error } = await supabase
      .from('approval_requests')
      .update({
        status:      payload.decision,
        reviewed_by: user.id,
        reviewed_at: now.toISOString(),
        expires_at:  expiresAt,
        admin_notes: payload.admin_notes ?? null,
      })
      .eq('id', payload.request_id);

    if (error) {
      toast.error('Error al procesar la solicitud');
      throw error;
    }

    // Auto-ejecutar la acción si hay lógica definida para esta action_key
    if (isApproved) {
      const request = [...pending].find(r => r.id === payload.request_id);
      if (request) {
        await autoExecuteApprovedAction(request);
      }
    }

    toast.success(isApproved ? '✅ Solicitud aprobada y acción ejecutada' : '❌ Solicitud rechazada');
    await fetchAll();
  };

  // ── checkApproval ──────────────────────────────────────────────────────────
  /**
   * Verifica si el usuario tiene una aprobación vigente para una acción.
   * Llamar ANTES de ejecutar la acción sensible para ver si ya fue aprobada.
   * Si hay aprobación vigente → 'allowed' (ejecutar sin pedir aprobación de nuevo).
   */
  const checkApproval = async (
    action_key: string,
    context_id?: string,
  ): Promise<PermissionResult> => {
    if (!user) return 'denied';
    if (user.is_admin) return 'allowed';

    let query = supabase
      .from('approval_requests')
      .select('id, expires_at')
      .eq('requested_by', user.id)
      .eq('action_key',   action_key)
      .eq('status',       'approved')
      .gt('expires_at',   new Date().toISOString());

    if (context_id) {
      query = query.eq('context_id', context_id);
    }

    const { data, error } = await query.limit(1);

    if (error || !data?.length) return 'needs_approval';
    return 'allowed';
  };

  return {
    pending,
    history,
    pendingCount: pending.length,
    isLoading,
    requestApproval,
    reviewRequest,
    checkApproval,
    refetch: fetchAll,
  };
}