import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';

export default function Header() {
  const { pathname } = useLocation();
  const { allowedTabs, logout } = useAuthStore();
  const [isOperationOpen, setIsOperationOpen] = useState(false);
  const [showPersonalSubmenu, setShowPersonalSubmenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [showPlagasSubmenu, setShowPlagasSubmenu] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOperationOpen(false);
setShowPersonalSubmenu(false);
setShowPlagasSubmenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isActive = (route: string) =>
    route === '/app/mapa' ? pathname === '/app/mapa' || pathname === '/app' : pathname === route;

  const mainLinks = [
    { to: '/app/mapa', label: 'Mapa', tab: 'Mapa' },
    { to: '/app/muestreos', label: 'Muestreos', tab: 'Muestreos' },
    { to: '/app/reportes', label: 'Reportes', tab: 'Reportes' },
    { to: '/app/configuracion', label: 'Configuración', tab: 'Configuración' }
  ];

  return (
    <header className="bg-[#0D0D0D] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link to="/" className="flex items-center">
              <img src="/assets/Moray logo.png" alt="Agrícola Moray" className="h-10 w-auto object-contain" />
            </Link>
          </div>

          <nav className="flex items-center space-x-8">
            {mainLinks.map((link) =>
              allowedTabs.includes(link.tab) && (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`text-lg transition-colors ${
                    isActive(link.to)
                      ? 'text-white font-medium'
                      : 'text-[#A3A3A3] hover:text-white'
                  }`}
                >
                  {link.label}
                </Link>
              )
            )}

            {/* Menú desplegable Operación */}
            {allowedTabs.includes('Personal') && (
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setIsOperationOpen((prev) => !prev)}
                  className={`text-lg transition-colors ${
                    isOperationOpen ? 'text-white font-medium' : 'text-[#A3A3A3] hover:text-white'
                  }`}
                >
                  Operación
                </button>

               {isOperationOpen && (
  <div className="absolute right-0 mt-2 w-64 bg-[#1A1A1A] border border-[#333] rounded-xl shadow-lg z-50 p-2">
    {/* Submenú: Gestión de Personal */}
    <div className="relative group mb-1">
      <button
        onClick={() => {
  setShowPersonalSubmenu((prev) => !prev);
  setShowPlagasSubmenu(false); // ← cierra el otro
}}
        className="w-full flex justify-between items-center px-4 py-2 hover:bg-[#2A2A2A] rounded-md"
      >
        Gestión de Personal
        <span className="ml-2">{showPersonalSubmenu ? '▾' : '▸'}</span>
      </button>

      {showPersonalSubmenu && (
        <div className="absolute right-full top-0 mr-2 w-64 bg-[#1A1A1A] border border-[#333] rounded-xl shadow-lg z-50 p-2 animate-fadeInLeft">
          <Link
            to="/app/estrategia/personal"
            onClick={() => {
              setIsOperationOpen(false);
              setShowPersonalSubmenu(false);
            }}
            className="block px-4 py-2 hover:bg-[#2A2A2A] rounded-md"
          >
            Programa de Trabajo
          </Link>
          <Link
            to="/app/estrategia/personal/planeacion"
            onClick={() => {
              setIsOperationOpen(false);
              setShowPersonalSubmenu(false);
            }}
            className="block px-4 py-2 hover:bg-[#2A2A2A] rounded-md"
          >
            Planeación de Labores
          </Link>
        </div>
      )}
    </div>

{/* Sección: Plagas y Enfermedades */}
<div className="relative group mt-1">
  <button
    onClick={() => {
      setShowPlagasSubmenu((prev) => !prev);
      setShowPersonalSubmenu(false); // Cierra el otro submenu
    }}
    className="w-full flex justify-between items-center px-4 py-2 hover:bg-[#2A2A2A] rounded-md"
  >
    Plagas y Enfermedades
    <span className="ml-2">{showPlagasSubmenu ? '▾' : '▸'}</span>
  </button>

  {showPlagasSubmenu && (
    <div className="absolute right-full top-0 mr-2 w-64 bg-[#1A1A1A] border border-[#333] rounded-xl shadow-lg z-50 p-2 animate-fadeInLeft">
      <Link
        to="/app/operacion/plagas-enfermedades/planeacion-pe"
        onClick={() => {
          setIsOperationOpen(false);
          setShowPlagasSubmenu(false);
        }}
        className="block px-4 py-2 hover:bg-[#2A2A2A] rounded-md"
      >
        Planeación P&E
      </Link>
      <Link
        to="/app/operacion/plagas-enfermedades/form-aplicaciones-pe"
        onClick={() => {
          setIsOperationOpen(false);
          setShowPlagasSubmenu(false);
        }}
        className="block px-4 py-2 hover:bg-[#2A2A2A] rounded-md"
      >
        Registro Aplicaciones
      </Link>
      <Link
        to="/app/operacion/plagas-enfermedades/programacion-pe"
        onClick={() => {
          setIsOperationOpen(false);
          setShowPlagasSubmenu(false);
        }}
        className="block px-4 py-2 hover:bg-[#2A2A2A] rounded-md"
      >
        Programación P&E
      </Link>
    </div>
  )}
</div>

    <Link
      to="/app/estrategia/administracion"
      onClick={() => setIsOperationOpen(false)}
      className="block px-4 py-2 hover:bg-[#2A2A2A] rounded-md mt-2"
    >
      Administración
    </Link>
  </div>
)} 
              </div>
            )}

            <button
              onClick={logout}
              className="ml-6 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
            >
              Cerrar sesión
            </button>
          </nav>
        </div>
      </div>

      {/* Animación CSS opcional */}
      <style>{`
        @keyframes fadeInLeft {
          from {
            opacity: 0;
            transform: translateX(-10px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        .animate-fadeInLeft {
          animation: fadeInLeft 0.2s ease-out;
        }
      `}</style>
    </header>
  );
}