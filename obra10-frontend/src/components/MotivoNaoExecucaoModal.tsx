import React, { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';

export type MotivoNaoExecucao =
  | 'FALTA_MATERIAL'
  | 'FALTA_MAO_DE_OBRA'
  | 'CHUVA'
  | 'EQUIPAMENTO_INDISPONIVEL'
  | 'AGUARDANDO_APROVACAO'
  | 'PROJETO_NAO_LIBERADO'
  | 'RETRABALHO'
  | 'INTERFERENCIA_TERCEIROS'
  | 'OUTROS';

const MOTIVOS: { value: MotivoNaoExecucao; label: string; emoji: string }[] = [
  { value: 'FALTA_MATERIAL', label: 'Falta de Material', emoji: '📦' },
  { value: 'FALTA_MAO_DE_OBRA', label: 'Falta de Mão de Obra', emoji: '👷' },
  { value: 'CHUVA', label: 'Chuva / Clima', emoji: '🌧️' },
  { value: 'EQUIPAMENTO_INDISPONIVEL', label: 'Equipamento Indisponível', emoji: '🔧' },
  { value: 'AGUARDANDO_APROVACAO', label: 'Aguardando Aprovação', emoji: '⏳' },
  { value: 'PROJETO_NAO_LIBERADO', label: 'Projeto Não Liberado', emoji: '📋' },
  { value: 'RETRABALHO', label: 'Retrabalho', emoji: '🔄' },
  { value: 'INTERFERENCIA_TERCEIROS', label: 'Interferência de Terceiros', emoji: '🚧' },
  { value: 'OUTROS', label: 'Outros', emoji: '📝' },
];

interface Props {
  tarefaDescricao: string;
  statusExecucao: 'PARCIAL' | 'NAO_EXECUTADO';
  onConfirm: (motivo: MotivoNaoExecucao, texto?: string) => void;
  onCancel: () => void;
}

/**
 * Modal de motivo de não execução.
 * Chips configuráveis (enum MotivoNaoExecucao) + texto livre opcional.
 * Bloqueia confirmação até selecionar ao menos um motivo.
 */
export const MotivoNaoExecucaoModal: React.FC<Props> = ({ tarefaDescricao, statusExecucao, onConfirm, onCancel }) => {
  const [motivoSelecionado, setMotivoSelecionado] = useState<MotivoNaoExecucao | null>(null);
  const [textoLivre, setTextoLivre] = useState('');

  const label = statusExecucao === 'NAO_EXECUTADO' ? 'Não Executado' : 'Parcialmente Executado';
  const cor = statusExecucao === 'NAO_EXECUTADO' ? 'text-red-700 bg-red-50 border-red-200' : 'text-amber-700 bg-amber-50 border-amber-200';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="p-5 border-b border-gray-100 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle size={18} className="text-amber-500" />
              <h3 className="font-bold text-gray-900">Motivo de Não Execução</h3>
            </div>
            <p className="text-sm text-gray-600">Tarefa: <span className="font-medium">{tarefaDescricao}</span></p>
            <span className={`inline-block mt-1.5 text-xs font-semibold px-2 py-0.5 rounded-full border ${cor}`}>{label}</span>
          </div>
          <button onClick={onCancel} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={18} className="text-gray-400" />
          </button>
        </div>

        {/* Chips de motivo */}
        <div className="p-5 space-y-4">
          <p className="text-sm font-medium text-gray-700">Selecione o motivo:</p>
          <div className="flex flex-wrap gap-2">
            {MOTIVOS.map(m => (
              <button
                key={m.value}
                onClick={() => setMotivoSelecionado(motivoSelecionado === m.value ? null : m.value)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${
                  motivoSelecionado === m.value
                    ? 'border-red-500 bg-red-50 text-red-700 shadow-sm'
                    : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-gray-300'
                }`}
              >
                <span>{m.emoji}</span>
                {m.label}
              </button>
            ))}
          </div>

          {/* Texto livre (opcional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Detalhes adicionais <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <textarea
              rows={2}
              value={textoLivre}
              onChange={e => setTextoLivre(e.target.value)}
              placeholder="Descreva o obstáculo com mais detalhes..."
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
            />
          </div>
        </div>

        {/* Ações */}
        <div className="p-5 pt-0 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => motivoSelecionado && onConfirm(motivoSelecionado, textoLivre || undefined)}
            disabled={!motivoSelecionado}
            className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Confirmar Motivo
          </button>
        </div>
      </div>
    </div>
  );
};
