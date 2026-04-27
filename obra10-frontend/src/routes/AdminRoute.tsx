import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loader2 } from 'lucide-react';

export const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#F5F5F5]">
        <Loader2 className="animate-spin text-red-600" size={40} />
      </div>
    );
  }

  if (!isAuthenticated || user?.perfilGlobal !== 'SUPER_ADMIN') {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};
