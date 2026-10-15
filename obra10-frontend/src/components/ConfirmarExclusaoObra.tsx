import React from 'react';
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import { confirmouExclusao } from '../utils/confirmouExclusao';

type Props = {
  nome: string;
  detalhe?: string;
  email?: string;
  confirmWord: string;
  onConfirmWord: (valor: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
  loading: boolean;
};

export const ConfirmarExclusaoObra: React.FC<Props> = ({
  nome,
  detalhe,
  email,
  confirmWord,
  onConfirmWord,
  onCancel,
  onConfirm,
  loading,
}) => {
  const podeConfirmar = confirmouExclusao(confirmWord);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[100]">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-fade-in">
        <div className="p-6">
          <div className="flex items-center gap-2 text-red-600 mb-4">
            <AlertTriangle size={24} />
            <h3 className="text-lg font-bold">Você tem certeza absoluta?</h3>
          </div>

          <div className="text-sm text-gray-600 space-y-3">
            <p>
              Esta ação não pode ser desfeita. Todos os dados da obra{' '}
              <strong>{nome}</strong> serão excluídos permanentemente.
            </p>
            {detalhe && (
              <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                {detalhe}
              </p>
            )}
            {email && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-800 flex items-start gap-2">
                <AlertTriangle className="shrink-0 mt-0.5" size={14} />
                <span>
                  <strong>Importante:</strong> Um e-mail de confirmação será enviado para{' '}
                  <strong>{email}</strong> assim que a exclusão for concluída.
                </span>
              </div>
            )}
            <p>
              Para confirmar, digite a palavra{' '}
              <strong className="text-red-600 select-all">EXCLUIR</strong> no campo abaixo:
            </p>
          </div>

          <input
            type="text"
            value={confirmWord}
            onChange={(e) => onConfirmWord(e.target.value)}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none mt-4 font-bold uppercase tracking-wider text-center text-red-600 bg-red-50/50"
            placeholder="Digite EXCLUIR"
          />
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-gray-600 font-semibold hover:bg-gray-100 rounded-lg text-sm transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!podeConfirmar || loading}
            className="px-5 py-2 bg-red-600 hover:bg-red-700 active:bg-red-800 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold rounded-lg text-sm flex items-center gap-1.5 transition-colors shadow-sm"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
            Confirmar Exclusão
          </button>
        </div>
      </div>
    </div>
  );
};
