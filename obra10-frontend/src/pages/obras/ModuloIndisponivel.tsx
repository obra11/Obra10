import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Box } from 'lucide-react';

export const ModuloIndisponivel: React.FC = () => {
  const navigate = useNavigate();
  const { obraId } = useParams();

  return (
    <div className="flex h-full min-h-[60vh] items-center justify-center p-6 text-center">
      <div className="max-w-md">
        <p className="font-display text-lg font-bold text-lunardeli-dark">
          Este módulo ainda não está disponível nesta obra
        </p>
        <p className="mt-2 text-sm text-gray-500">
          Para abrir PDF, DWG, IFC e planilha, use o visualizador de arquivos.
        </p>
        {obraId && (
          <button
            type="button"
            onClick={() => navigate(`/obras/${obraId}/visualizador`)}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-lunardeli-red px-4 py-2.5 text-sm font-semibold text-white"
          >
            <Box size={16} />
            Abrir visualizador
          </button>
        )}
      </div>
    </div>
  );
};
