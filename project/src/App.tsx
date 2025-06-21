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
import PlanificacionLaboresPage from './components/LaborPlanningPage'
import FormAplicacionesPE from './components/FormAplicacionesP&E'
import PlaneacionPE from './components/PlaneacionP&E'
import ProgramacionPEPage from './components/ProgramaAplicacionesPE' // ← NUEVO

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
            <Route
              path="/"
              element={!session ? <LandingPage /> : <Navigate to="/app/mapa" replace />}
            />
            <Route
              path="/login"
              element={!session ? <LoginPage /> : <Navigate to="/app/mapa" replace />}
            />

            {/* Rutas SIN layout */}
            <Route
              path="/app/labores-map"
              element={session ? <InteractiveMapLabores /> : <Navigate to="/login" replace />}
            />
            <Route
              path="/app/form-labores-map"
              element={session ? <InteractiveMapFormLabores /> : <Navigate to="/login" replace />}
            />

            {/* Rutas CON layout */}
            <Route path="/app" element={session ? <Dashboard /> : <Navigate to="/login" replace />}>
              <Route path="mapa" element={<InteractiveMap />} />
              <Route path="muestreos" element={<SamplingLog />} />
              <Route path="estrategia/personal" element={<PersonalManagement />} />
              <Route path="estrategia/personal/planeacion" element={<PlanificacionLaboresPage />} />
              <Route path="operacion/plagas-enfermedades/planeacion-pe" element={<PlaneacionPE />} />
              <Route path="operacion/plagas-enfermedades/form-aplicaciones-pe" element={<FormAplicacionesPE />} />
              <Route path="operacion/plagas-enfermedades/programacion-pe" element={<ProgramacionPEPage />} /> {/* NUEVA RUTA */}
              <Route path="administracion" element={<AdministrationPage />} />
              <Route path="configuracion" element={<UserConfiguration />} />
              <Route path="reportes" element={<Reports />} />
            </Route>

            {/* Fallback */}
            <Route
              path="*"
              element={<Navigate to={session ? "/app/mapa" : "/login"} replace />}
            />
          </Routes>
        </div>
      </LoadScript>
    </Router>
  )
}

export default App