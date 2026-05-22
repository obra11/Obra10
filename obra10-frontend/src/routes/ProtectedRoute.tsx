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

  // Redirect to contracting if tenant has no billing setup/history
  if (
    user?.perfilGlobal !== 'SUPER_ADMIN' &&
    empresa &&
    empresa.cobrancasCount === 0 &&
    location.pathname !== '/contratacao' &&
    !location.pathname.startsWith('/aguardando-pagamento/')
  ) {
    return <Navigate to="/contratacao" replace />;
  }

  // Redirect to payment if tenant has billing history but has never completed a payment (first payment pending)
  if (
    user?.perfilGlobal !== 'SUPER_ADMIN' &&
    empresa &&
    typeof empresa.cobrancasCount === 'number' &&
    empresa.cobrancasCount > 0 &&
    empresa.cobrancasPagasCount === 0 &&
    empresa.lastPendingCobrancaId &&
    location.pathname !== '/contratacao' &&
    !location.pathname.startsWith('/aguardando-pagamento/')
  ) {
    return <Navigate to={`/aguardando-pagamento/${empresa.lastPendingCobrancaId}`} replace />;
  }

  return <>{children}</>;
};
