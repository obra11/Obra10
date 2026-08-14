import React, { useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { Obra10Logo } from '../components/Obra10Logo';
import { useAuth } from '../context/AuthContext';

const NAV = [
  { to: '/produto', label: 'Produto' },
  { to: '/precos', label: 'Preços' },
  { to: '/sobre', label: 'Sobre' },
  { to: '/contato', label: 'Contato' },
];

export const MarketingLayout: React.FC = () => {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const { isAuthenticated, user } = useAuth();
  const painelTo =
    user?.perfilGlobal === 'SUPER_ADMIN' ? '/admin/dashboard' : '/dashboard';

  React.useEffect(() => {
    setOpen(false);
    const titles: Record<string, string> = {
      '/': 'Obra 10 — Gestão de Obras',
      '/produto': 'Produto — Obra 10',
      '/precos': 'Preços — Obra 10',
      '/sobre': 'Sobre — Obra 10',
      '/contato': 'Contato — Obra 10',
    };
    document.title = titles[location.pathname] || 'Obra 10';
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-white text-lunardeli-dark font-sans">
      <header className="sticky top-0 z-40 border-b border-lunardeli-lightGray/80 bg-white/95 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link to="/" className="shrink-0 flex items-center" aria-label="Obra 10 início">
            <Obra10Logo size={32} withWordmark wordmarkClassName="text-lunardeli-dark" />
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `px-3 py-2 text-sm font-semibold rounded-lg transition-colors ${
                    isActive
                      ? 'text-lunardeli-red'
                      : 'text-lunardeli-charcoal hover:text-lunardeli-red'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-2">
            {isAuthenticated ? (
              <Link
                to={painelTo}
                className="px-4 py-2.5 text-sm font-bold text-white bg-lunardeli-red hover:bg-lunardeli-deep rounded-lg transition-colors"
              >
                Ir para o painel
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="px-3 py-2 text-sm font-semibold text-lunardeli-charcoal hover:text-lunardeli-red"
                >
                  Área do cliente
                </Link>
                <Link
                  to="/register"
                  className="px-4 py-2.5 text-sm font-bold text-white bg-lunardeli-red hover:bg-lunardeli-deep rounded-lg transition-colors"
                >
                  Começar
                </Link>
              </>
            )}
          </div>

          <button
            type="button"
            className="md:hidden p-2 text-lunardeli-charcoal"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? 'Fechar menu' : 'Abrir menu'}
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {open && (
          <div className="md:hidden border-t border-lunardeli-lightGray bg-white px-4 py-4 space-y-1">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="block px-3 py-3 text-sm font-semibold text-lunardeli-dark rounded-lg hover:bg-lunardeli-gray"
              >
                {item.label}
              </Link>
            ))}
            {isAuthenticated ? (
              <Link
                to={painelTo}
                className="block text-center px-3 py-3 text-sm font-bold text-white bg-lunardeli-red rounded-lg"
              >
                Ir para o painel
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="block px-3 py-3 text-sm font-semibold text-lunardeli-charcoal"
                >
                  Área do cliente
                </Link>
                <Link
                  to="/register"
                  className="block text-center px-3 py-3 text-sm font-bold text-white bg-lunardeli-red rounded-lg"
                >
                  Começar
                </Link>
              </>
            )}
          </div>
        )}
      </header>

      <main>
        <Outlet />
      </main>

      <footer className="border-t border-lunardeli-lightGray bg-lunardeli-gray">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 grid gap-8 md:grid-cols-[1.2fr_1fr_1fr]">
          <div>
            <Obra10Logo size={28} withWordmark wordmarkClassName="text-lunardeli-dark" />
            <p className="mt-4 text-sm text-gray-600 max-w-sm leading-relaxed">
              Gestão de obras com modernidade, credibilidade e segurança —
              nascido na Lunardeli Engenharia.
            </p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">
              Site
            </p>
            <div className="space-y-2 text-sm font-medium">
              {NAV.map((item) => (
                <Link key={item.to} to={item.to} className="block hover:text-lunardeli-red">
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">
              Cliente
            </p>
            <div className="space-y-2 text-sm font-medium">
              {isAuthenticated ? (
                <Link to={painelTo} className="block hover:text-lunardeli-red">
                  Ir para o painel
                </Link>
              ) : (
                <>
                  <Link to="/login" className="block hover:text-lunardeli-red">
                    Área do cliente
                  </Link>
                  <Link to="/register" className="block hover:text-lunardeli-red">
                    Criar conta
                  </Link>
                </>
              )}
              <a
                href="mailto:contato@obra10.com.br"
                className="block hover:text-lunardeli-red"
              >
                contato@obra10.com.br
              </a>
            </div>
            <div className="mt-6 flex items-center gap-3">
              <img
                src="/brand/lunardeli-simbolo.jpg"
                alt="Lunardeli Engenharia"
                className="h-9 w-auto object-contain"
              />
              <p className="text-xs text-gray-500 leading-snug">
                Um produto
                <br />
                <span className="font-semibold text-lunardeli-charcoal">
                  Lunardeli Engenharia
                </span>
              </p>
            </div>
          </div>
        </div>
        <div className="border-t border-lunardeli-lightGray/80 py-4 text-center text-xs text-gray-500">
          © {new Date().getFullYear()} Obra 10 · Lunardeli Engenharia. Todos os direitos
          reservados.
        </div>
      </footer>
    </div>
  );
};
