import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Login } from '../pages/Login';
import { Register } from '../pages/Register';
import { Dashboard } from '../pages/DashboardPainel';
import { ProtectedRoute } from './ProtectedRoute';
import { useAuth } from '../context/AuthContext';

import { CompanyDashboard } from '../pages/CompanyDashboard';
import { AdminPanel } from '../pages/admin/AdminPanel';
import { ModulosCatalogo } from '../pages/admin/ModulosCatalogo';
import { UserManagement } from '../pages/gestor/UserManagement';
import { Financeiro } from '../pages/gestor/Financeiro';

import { ObraLayout } from '../layouts/ObraLayout';
import { RdoList } from '../pages/RdoList';
import { RdoDashboard } from '../pages/RdoDashboard';
import { DiarioDeObra } from '../pages/DiarioDeObra';

import { VerificarEmail } from '../pages/VerificarEmail';
import { Contratacao } from '../pages/Contratacao';
import { AguardandoPagamento } from '../pages/AguardandoPagamento';
import { Precos } from '../pages/Precos';
import { Assinatura } from '../pages/Assinatura';
import { Efetivo } from '../pages/obras/Efetivo';

export const AppRoutes: React.FC = () => {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route
        path="/"
        element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />}
      />

      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />}
      />

      {/* === PUBLIC === */}
      <Route path="/register" element={<Register />} />
      <Route path="/precos" element={<Precos />} />
      <Route path="/verificar-email" element={<VerificarEmail />} />
      <Route path="/diario-de-obra" element={<DiarioDeObra />} />

      {/* === SUPER ADMIN === */}
      <Route path="/admin" element={<ProtectedRoute><AdminPanel /></ProtectedRoute>} />
      <Route path="/admin/modulos" element={<ProtectedRoute><ModulosCatalogo /></ProtectedRoute>} />

      {/* === GESTOR === */}
      <Route path="/gestor/usuarios" element={<ProtectedRoute><UserManagement /></ProtectedRoute>} />
      <Route path="/gestor/financeiro" element={<ProtectedRoute><Financeiro /></ProtectedRoute>} />

      {/* === CONTRATAÇÃO / BILLING === */}
      <Route path="/contratacao" element={<ProtectedRoute><Contratacao /></ProtectedRoute>} />
      <Route path="/aguardando-pagamento/:id" element={<ProtectedRoute><AguardandoPagamento /></ProtectedRoute>} />
      <Route path="/assinatura" element={<ProtectedRoute><Assinatura /></ProtectedRoute>} />

      {/* === MAIN DASHBOARD === */}
      <Route path="/dashboard" element={<ProtectedRoute><CompanyDashboard /></ProtectedRoute>} />

      <Route path="/obras/:obraId/*" element={<ProtectedRoute><ObraLayout /></ProtectedRoute>}>
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="rdos" element={<RdoList />} />
        <Route path="rdos/novo" element={<DiarioDeObra />} />
        <Route path="rdos/:rdoId" element={<DiarioDeObra />} />
        <Route path="rdos/dashboard" element={<RdoDashboard />} />
        <Route path="efetivo" element={<Efetivo />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
