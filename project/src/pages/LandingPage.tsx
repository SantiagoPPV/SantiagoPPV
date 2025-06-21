import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin, BarChart3, ClipboardList } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="py-6 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center">
            <img 
              src="/moray-logo.png" 
              alt="Agrícola Moray" 
              className="h-10 w-auto"
            />
            <h1 className="ml-3 text-xl font-bold">Agrícola Moray</h1>
          </div>
          <Link
            to="/login"
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
          >
            Iniciar Sesión
          </Link>
        </div>
      </header>

      <main className="flex-grow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">
              Sistema de Gestión Agrícola
            </h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Monitoreo en tiempo real, gestión de cultivos y análisis de datos para optimizar su producción agrícola.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-[#1A1A1A] p-6 rounded-lg text-center">
              <MapPin className="w-12 h-12 text-blue-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Mapeo Interactivo</h3>
              <p className="text-gray-400">
                Visualice sus cultivos y monitoree el estado de cada túnel en tiempo real.
              </p>
            </div>

            <div className="bg-[#1A1A1A] p-6 rounded-lg text-center">
              <ClipboardList className="w-12 h-12 text-blue-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Registro de Muestreos</h3>
              <p className="text-gray-400">
                Gestione los datos de plagas, nutrición, riego y cosecha de manera eficiente.
              </p>
            </div>

            <div className="bg-[#1A1A1A] p-6 rounded-lg text-center">
              <BarChart3 className="w-12 h-12 text-blue-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Reportes y Análisis</h3>
              <p className="text-gray-400">
                Obtenga insights valiosos a través de reportes detallados y análisis de datos.
              </p>
            </div>
          </div>
        </div>
      </main>

      <footer className="bg-[#1A1A1A] py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-gray-400">
          <p>© {new Date().getFullYear()} Agrícola Moray. Todos los derechos reservados.</p>
        </div>
      </footer>
    </div>
  );
}