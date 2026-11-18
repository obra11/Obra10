import React from 'react';
import { useLocation } from 'react-router-dom';
import { Construction } from 'lucide-react';

export const ModuloIndisponivel: React.FC = () => {
  const { pathname } = useLocation();
  const slug = pathname.split('/').filter(Boolean).pop()?.toUpperCase();

  return (
    <div className="p-6 max-w-xl mx-auto">
      <div className="bg-white border border-gray-100 rounded-2xl p-8 text-center">
        <div className="w-12 h-12 mx-auto rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center mb-4">
          <Construction size={22} />
        </div>
        <h1 className="text-xl font-bold text-gray-900">Módulo em preparação</h1>
        <p className="text-sm text-gray-500 mt-2">
          {slug ? `A tela de ${slug} ainda não está no ar neste canteiro.` : 'Esta tela ainda não está no ar.'}{' '}
          Estoque e entrega de EPI já funcionam no menu da obra.
        </p>
      </div>
    </div>
  );
};

export default ModuloIndisponivel;
