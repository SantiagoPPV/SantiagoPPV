/**
 * ApprovalQueuePage.tsx — Wrapper de ruta para /app/configuracion/solicitudes
 * Fase 5 scaffold → Fase 7 activa
 *
 * Guard: solo admin puede acceder. Si no es admin, redirige a usuarios.
 */
import React from 'react';
import { Navigate } from 'react-router-dom';
import { usePermissions } from '../hooks/usePermissions';
import ApprovalQueue from '../components/configuracion/ApprovalQueue';

export default function ApprovalQueuePage() {
  const { isAdmin, isLoaded } = usePermissions();

  if (!isLoaded) return null;
  if (!isAdmin) return <Navigate to="/app/configuracion/usuarios" replace />;

  return <ApprovalQueue />;
}