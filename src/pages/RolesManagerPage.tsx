/**
 * RolesManagerPage.tsx — Wrapper de ruta para /app/configuracion/roles
 * Fase 5
 */
import React from 'react';
import { useUsers } from '../components/configuracion/hooks/useUsers';
import RolesManager from '../components/configuracion/RolesManager';

export default function RolesManagerPage() {
  const { users } = useUsers();
  return <RolesManager users={users} />;
}