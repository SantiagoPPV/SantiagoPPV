import { NavLink, Outlet, Navigate, useLocation } from 'react-router-dom';

const tabs = [
  { to: '/app/operacion/cosecha/registro', label: 'Registro de Cosecha', icon: '📝' },
  { to: '/app/operacion/cosecha/reportes', label: 'Reportes de Cosecha', icon: '📊' },
];

export default function CosechaLayout() {
  const { pathname } = useLocation();

  if (pathname === '/app/operacion/cosecha') {
    return <Navigate to="/app/operacion/cosecha/registro" replace />;
  }

  return (
    <div>
      <div className="border-b border-[#2a2a3e] bg-[#111118]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex gap-0" aria-label="Cosecha tabs">
            {tabs.map((tab) => {
              const isActive = pathname.startsWith(tab.to);
              return (
                <NavLink
                  key={tab.to}
                  to={tab.to}
                  className={`
                    flex items-center gap-2 px-6 py-3 text-sm font-semibold transition-all
                    border-b-[2.5px] whitespace-nowrap
                    ${isActive
                      ? 'border-blue-500 text-white'
                      : 'border-transparent text-[#666680] hover:text-[#9999b0] hover:border-[#3a3a52]'
                    }
                  `}
                >
                  <span>{tab.icon}</span>
                  {tab.label}
                </NavLink>
              );
            })}
          </nav>
        </div>
      </div>

      <Outlet />
    </div>
  );
}
