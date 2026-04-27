import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Building2, Users, Package, Ticket, LogOut, ToggleLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const AdminLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { to: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/admin/empresas', icon: Building2, label: 'Empresas' },
    { to: '/admin/usuarios', icon: Users, label: 'Usuários' },
    { to: '/admin/modulos', icon: Package, label: 'Módulos' },
    { to: '/admin/cupons', icon: Ticket, label: 'Cupons' },
    { to: '/admin/features', icon: ToggleLeft, label: 'Features' },
  ];

  return (
    <div className="min-h-screen bg-[#F5F5F5] flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-white border-b md:border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-100 flex items-center gap-3">
          <div className="w-8 h-8 bg-red-600 rounded flex items-center justify-center shrink-0">
            <svg viewBox="0 0 512 512" className="w-5 h-5 text-white fill-current" preserveAspectRatio="xMidYMid meet">
              <path d="M256 80c-80 0-144 64-144 144v16h-32v48h32v16c0 16 8 24 24 24h240c16 0 24-8 24-24v-16h32v-48h-32v-16c0-80-64-144-144-144z" />
            </svg>
          </div>
          <div>
            <h1 className="font-extrabold text-gray-900 tracking-tight leading-none text-lg">OBRA 10</h1>
            <span className="text-[10px] font-bold tracking-widest text-red-600 uppercase">Super Admin</span>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 flex flex-row md:flex-col gap-2 overflow-x-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-colors whitespace-nowrap md:whitespace-normal ${
                  isActive
                    ? 'bg-red-50 text-red-700 border border-red-100'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`
              }
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-gray-100 border flex items-center justify-center font-bold text-gray-600">
              {user?.nome.charAt(0)}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-semibold text-gray-900 truncate">{user?.nome}</p>
              <p className="text-xs text-gray-500 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <LogOut size={16} />
            Sair
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
};
