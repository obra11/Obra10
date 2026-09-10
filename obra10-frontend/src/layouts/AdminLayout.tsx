import React, { useEffect, useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Building2, Users, Package, Ticket, LogOut, ToggleLeft, Headphones, Wallet, Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Obra10Logo } from '../components/Obra10Logo';

const NAV_ITEMS = [
  { to: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/admin/financeiro', icon: Wallet, label: 'Financeiro' },
  { to: '/admin/empresas', icon: Building2, label: 'Empresas' },
  { to: '/admin/usuarios', icon: Users, label: 'Usuários' },
  { to: '/admin/modulos', icon: Package, label: 'Módulos' },
  { to: '/admin/cupons', icon: Ticket, label: 'Cupons' },
  { to: '/admin/features', icon: ToggleLeft, label: 'Features' },
  { to: '/admin/suporte', icon: Headphones, label: 'Suporte' },
] as const;

function navLinkClass(isActive: boolean) {
  return `flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-colors ${
    isActive
      ? 'bg-red-50 text-red-700 border border-red-100'
      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
  }`;
}

export const AdminLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileOpen]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const currentItem =
    NAV_ITEMS.find((item) => location.pathname.startsWith(item.to)) ?? NAV_ITEMS[0];

  const userBlock = (
    <>
      <div className="flex items-center gap-3 mb-4 min-w-0">
        <div className="w-10 h-10 rounded-full bg-gray-100 border flex items-center justify-center font-bold text-gray-600 shrink-0">
          {user?.nome.charAt(0)}
        </div>
        <div className="overflow-hidden min-w-0">
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
    </>
  );

  return (
    <div className="min-h-screen bg-[#F5F5F5] flex flex-col md:flex-row">
      <header className="md:hidden sticky top-0 z-40 bg-white border-b border-gray-200">
        <div className="h-14 px-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Obra10Logo size={28} />
            <div className="min-w-0">
              <p className="text-[10px] font-bold tracking-widest text-red-600 uppercase leading-none">
                Super Admin
              </p>
              <p className="text-sm font-bold text-gray-900 truncate">{currentItem.label}</p>
            </div>
          </div>
          <button
            type="button"
            className="p-2.5 -mr-1 text-gray-600 active:bg-gray-100 rounded-lg shrink-0"
            onClick={() => setMobileOpen((open) => !open)}
            aria-label={mobileOpen ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </header>

      {mobileOpen && (
        <div className="md:hidden fixed inset-0 top-14 z-40">
          <button
            type="button"
            aria-label="Fechar menu"
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <nav className="relative bg-white border-b border-gray-200 shadow-lg max-h-[calc(100dvh-3.5rem)] overflow-y-auto px-3 py-3">
            <div className="flex flex-col gap-1">
              {NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => navLinkClass(isActive)}
                >
                  <item.icon size={18} className="shrink-0" />
                  {item.label}
                </NavLink>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-gray-100">{userBlock}</div>
          </nav>
        </div>
      )}

      <aside className="hidden md:flex w-64 bg-white border-r border-gray-200 flex-col shrink-0">
        <div className="p-4 border-b border-gray-100 flex items-center gap-3">
          <Obra10Logo size={32} />
          <div>
            <h1 className="font-extrabold text-gray-900 tracking-tight leading-none text-lg">OBRA 10</h1>
            <span className="text-[10px] font-bold tracking-widest text-red-600 uppercase">Super Admin</span>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => navLinkClass(isActive)}
            >
              <item.icon size={18} className="shrink-0" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-100">{userBlock}</div>
      </aside>

      <main className="flex-1 p-4 md:p-8 overflow-y-auto min-w-0">
        <Outlet />
      </main>
    </div>
  );
};
