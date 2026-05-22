import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading, user, empresa } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex bg-lunardeli-gray min-h-screen items-center justify-center">
         <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-lunardeli-red"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (user?.perfilGlobal === 'SUPER_ADMIN') {
    return <Navigate to="/admin/dashboard" replace />;
  }

  const precisaContratar =
    empresa && empresa.cobrancasCount === 0 && empresa.planoAtivo !== true;

  const rotasIsentas = [
    '/contratacao',
    '/aguardando-pagamento',
    '/verificar-email',
  ];

  const estaEmRotaIsenta = rotasIsentas.some(rota =>
    location.pathname.startsWith(rota)
  );

  if (precisaContratar && !estaEmRotaIsenta) {
    return <Navigate to="/contratacao" replace />;
  }

  return <>{children}</>;
};
