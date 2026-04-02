import React from 'react';
import { useAuth } from '../context/AuthContext';
import { FileText, Users, LayoutDashboard } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { obraAtiva } = useAuth();

  return (
    <div className="flex-1 p-6 lg:p-10">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">Painel Geral</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-4">
            <div className="bg-red-50 p-4 rounded-lg text-lunardeli-red">
              <FileText size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">RDOs Pendentes</p>
              <p className="text-2xl font-bold text-gray-800">4</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-4">
            <div className="bg-blue-50 p-4 rounded-lg text-blue-600">
              <Users size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Efetivo Hoje</p>
              <p className="text-2xl font-bold text-gray-800">142</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-4">
            <div className="bg-green-50 p-4 rounded-lg text-green-600">
              <LayoutDashboard size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Status</p>
              <p className="text-2xl font-bold text-gray-800">{obraAtiva?.status || 'ATIVA'}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 min-h-[400px]">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Atividade Recente</h2>
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <FileText size={48} className="mb-4 opacity-20" />
            <p>Nenhuma atividade registrada hoje.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
