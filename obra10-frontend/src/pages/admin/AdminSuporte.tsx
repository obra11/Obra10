import React, { useEffect, useState } from 'react';
import { Headphones, Loader2, RefreshCw } from 'lucide-react';
import api from '../../services/api';

type Chamado = {
  id: string;
  assunto: string;
  categoria: string;
  descricao: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  usuario?: { nome: string; email: string };
  empresa?: { razaoSocial?: string; nomeFantasia?: string };
};

const STATUS_OPTIONS = [
  'ABERTO',
  'EM_ANDAMENTO',
  'AGUARDANDO_USUARIO',
  'RESOLVIDO',
  'FECHADO',
];

const STATUS_LABEL: Record<string, string> = {
  ABERTO: 'Aberto',
  EM_ANDAMENTO: 'Em andamento',
  AGUARDANDO_USUARIO: 'Aguardando usuário',
  RESOLVIDO: 'Resolvido',
  FECHADO: 'Fechado',
};

export const AdminSuporte: React.FC = () => {
  const [chamados, setChamados] = useState<Chamado[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const qs = statusFilter ? `?status=${statusFilter}` : '';
      const res = await api.get(`/suporte/admin/chamados${qs}`);
      setChamados(res.data);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Erro ao listar chamados.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [statusFilter]);

  const atualizarStatus = async (id: string, status: string) => {
    setUpdatingId(id);
    try {
      await api.patch(`/suporte/chamados/${id}`, { status });
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Erro ao atualizar status.');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-red-50 text-red-700 flex items-center justify-center">
            <Headphones size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900">Suporte</h1>
            <p className="text-sm text-gray-500">Chamados de todas as empresas</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
          >
            <option value="">Todos os status</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={load}
            className="p-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg">{error}</div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center text-gray-400">
            <Loader2 className="animate-spin" size={28} />
          </div>
        ) : chamados.length === 0 ? (
          <div className="p-12 text-center text-gray-500 text-sm">
            Nenhum chamado encontrado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">Assunto</th>
                  <th className="px-4 py-3">Empresa</th>
                  <th className="px-4 py-3">Usuário</th>
                  <th className="px-4 py-3">Categoria</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Criado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {chamados.map((c) => (
                  <tr key={c.id} className="align-top hover:bg-gray-50/80">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-900">{c.assunto}</p>
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                        {c.descricao}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {c.empresa?.nomeFantasia || c.empresa?.razaoSocial || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-900">{c.usuario?.nome}</p>
                      <p className="text-xs text-gray-500">{c.usuario?.email}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{c.categoria}</td>
                    <td className="px-4 py-3">
                      <select
                        value={c.status}
                        disabled={updatingId === c.id}
                        onChange={(e) => atualizarStatus(c.id, e.target.value)}
                        className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-white disabled:opacity-50"
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>
                            {STATUS_LABEL[s]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {new Date(c.createdAt).toLocaleString('pt-BR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminSuporte;
