import React from 'react'
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { LoadScript } from '@react-google-maps/api'
import { Toaster } from 'react-hot-toast'
import { useAuth } from './hooks/useAuth'
// Páginas
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import Dashboard from './pages/Dashboard'
// Vistas con Layout
import PersonalManagement from './components/PersonalManagement'
import AdministrationPage from './components/AdministrationPage'
import InteractiveMap from './components/InteractiveMap'
import SamplingLog from './components/SamplingLog'
import Reports from './components/Reports'
import UserConfiguration from './pages/UserConfiguration'
import RolesManagerPage from './pages/RolesManagerPage'
import ApprovalQueuePage from './pages/ApprovalQueuePage'
import PlanificacionLaboresPage from './components/LaborPlanningPage'
import PackagingForm from './components/PackagingForm'
import NutritionTanksPage from './components/NutritionTanksPage'
import InventoryModule from './components/InventoryModule'
import ConfigLayout from './components/ConfigLayout'
import CosechaLayout from './components/cosecha/CosechaLayout'
import RegistroCosecha from './components/cosecha/RegistroCosecha'
import ReportesCosecha from './components/cosecha/ReportesCosecha'
import InventoryConfigPage from './components/InventoryConfigPage'
// ── NUEVO ──
import Exportacion from './components/Exportacion'
import FinanzasModule from './components/FinanzasModule'
import FumigacionModule from './components/fumigacion/FumigacionModule'
// Vistas SIN layout (independientes)
import InteractiveMapLabores from './components/InteractiveMapLabores'
import InteractiveMapFormLabores from './components/InteractiveMapFormLabores'

function App() {
  const { session, loading } = useAuth()
  if (loading) {
    return (
      <div className="min-h-screen bg-pattern flex items-center justify-center">
        <div className="text-white text-xl">Cargando aplicación…</div>
      </div>
    )
  }
  return (
    <Router>
      <LoadScript googleMapsApiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}>
        <div className="min-h-screen bg-pattern text-white">
          <Toaster position="top-right" />
          <Routes>
            {/* Rutas públicas */}
            <Route path="/" element={!session ? <LandingPage /> : <Navigate to="/app/mapa" replace />} />
            <Route path="/login" element={!session ? <LoginPage /> : <Navigate to="/app/mapa" replace />} />

            {/* Rutas SIN layout */}
            <Route path="/app/labores-map" element={session ? <InteractiveMapLabores /> : <Navigate to="/login" replace />} />
            <Route path="/app/form-labores-map" element={session ? <InteractiveMapFormLabores /> : <Navigate to="/login" replace />} />

            {/* Rutas CON layout */}
            <Route path="/app" element={session ? <Dashboard /> : <Navigate to="/login" replace />}>
              <Route path="mapa" element={<InteractiveMap />} />
              <Route path="muestreos" element={<SamplingLog />} />
              <Route path="estrategia/personal" element={<PersonalManagement />} />
              <Route path="estrategia/personal/planeacion" element={<PlanificacionLaboresPage />} />
              <Route path="operacion/nutricion/tanques" element={<NutritionTanksPage />} />
              <Route path="operacion/fumigacion" element={<FumigacionModule />} />
              <Route path="administracion" element={<AdministrationPage />} />
              <Route path="reportes" element={<Reports />} />
              <Route path="operacion/empaque" element={<PackagingForm />} />
              <Route path="operacion/inventario" element={<InventoryModule />} />

              {/* ── Finanzas ── */}
              <Route path="finanzas" element={<FinanzasModule />} />

              {/* ── NUEVO: Exportación ── */}
              <Route path="operacion/exportacion" element={<Exportacion />} />

              {/* ── Cosecha con sub-tabs ── */}
              <Route path="operacion/cosecha" element={<CosechaLayout />}>
                <Route index element={<Navigate to="registro" replace />} />
                <Route path="registro" element={<RegistroCosecha />} />
                <Route path="reportes" element={<ReportesCosecha />} />
              </Route>

              <Route path="configuracion" element={<ConfigLayout />}>
                <Route index element={<Navigate to="usuarios" replace />} />
                <Route path="usuarios" element={<UserConfiguration />} />
                <Route path="roles" element={<RolesManagerPage />} />
                <Route path="solicitudes" element={<ApprovalQueuePage />} />
              </Route>
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to={session ? "/app/mapa" : "/login"} replace />} />
          </Routes>
        </div>
      </LoadScript>
    </Router>
  )
}
export default App