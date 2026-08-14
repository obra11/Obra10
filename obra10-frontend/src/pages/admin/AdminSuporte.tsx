import React, { useEffect, useState } from 'react';
import { Headphones, Loader2, RefreshCw, Send, X } from 'lucide-react';
import api from '../../services/api';

type Mensagem = {
  id: string;
  corpo: string;
  autorTipo: 'USUARIO' | 'SUPORTE';
  createdAt: string;
  autor?: { id: string; nome: string; email: string };
};

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
  mensagens?: Mensagem[];
  _count?: { mensagens: number };
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
  const [selecionado, setSelecionado] = useState<Chamado | null>(null);
  const [loadingDetalhe, setLoadingDetalhe] = useState(false);
  const [resposta, setResposta] = useState('');
  const [enviando, setEnviando] = useState(false);

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

  const abrirDetalhe = async (id: string) => {
    setLoadingDetalhe(true);
    setResposta('');
    try {
      const res = await api.get(`/suporte/chamados/${id}`);
      setSelecionado(res.data);
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Erro ao abrir chamado.');
    } finally {
      setLoadingDetalhe(false);
    }
  };

  const atualizarStatus = async (id: string, status: string) => {
    setUpdatingId(id);
    try {
      await api.patch(`/suporte/chamados/${id}`, { status });
      await load();
      if (selecionado?.id === id) await abrirDetalhe(id);
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Erro ao atualizar status.');
    } finally {
      setUpdatingId(null);
    }
  };

  const enviarResposta = async () => {
    if (!selecionado || resposta.trim().length < 1) return;
    setEnviando(true);
    try {
      const res = await api.post(`/suporte/chamados/${selecionado.id}/mensagens`, {
        corpo: resposta.trim(),
      });
      setSelecionado(res.data);
      setResposta('');
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Erro ao enviar resposta.');
    } finally {
      setEnviando(false);
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
            <p className="text-sm text-gray-500">
              Chamados de todas as empresas — clique para responder
            </p>
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
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Atualizado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {chamados.map((c) => (
                  <tr
                    key={c.id}
                    className="align-top hover:bg-red-50/40 cursor-pointer"
                    onClick={() => abrirDetalhe(c.id)}
                  >
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-900">{c.assunto}</p>
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                        {c.mensagens?.[0]?.corpo || c.descricao}
                      </p>
                      {c.status === 'ABERTO' && (
                        <span className="inline-block mt-1 text-[10px] font-bold uppercase tracking-wide text-red-700 bg-red-100 px-1.5 py-0.5 rounded">
                          Novo
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {c.empresa?.nomeFantasia || c.empresa?.razaoSocial || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-900">{c.usuario?.nome}</p>
                      <p className="text-xs text-gray-500">{c.usuario?.email}</p>
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
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
                      {new Date(c.updatedAt || c.createdAt).toLocaleString('pt-BR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {(selecionado || loadingDetalhe) && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-2xl sm:rounded-2xl shadow-xl max-h-[92vh] flex flex-col">
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-100">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wider text-red-600 mb-1">
                  {selecionado?.empresa?.nomeFantasia ||
                    selecionado?.empresa?.razaoSocial ||
                    '…'}
                </p>
                <h2 className="text-lg font-bold text-gray-900 truncate">
                  {selecionado?.assunto || 'Carregando…'}
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {selecionado?.usuario?.nome} · {selecionado?.usuario?.email}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelecionado(null)}
                className="p-2 text-gray-400 hover:text-gray-700 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 bg-gray-50">
              {loadingDetalhe || !selecionado ? (
                <div className="py-16 flex justify-center text-gray-400">
                  <Loader2 className="animate-spin" size={28} />
                </div>
              ) : (
                (
                  selecionado.mensagens?.length
                    ? selecionado.mensagens
                    : [
                        {
                          id: 'seed',
                          corpo: selecionado.descricao,
                          autorTipo: 'USUARIO' as const,
                          createdAt: selecionado.createdAt,
                          autor: selecionado.usuario
                            ? {
                                id: '',
                                nome: selecionado.usuario.nome,
                                email: selecionado.usuario.email,
                              }
                            : undefined,
                        },
                      ]
                ).map((m) => {
                  const suporte = m.autorTipo === 'SUPORTE';
                  return (
                    <div
                      key={m.id}
                      className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm ${
                        suporte
                          ? 'ml-auto bg-red-600 text-white'
                          : 'mr-auto bg-white border border-gray-200 text-gray-800'
                      }`}
                    >
                      <p className="text-[10px] font-bold uppercase tracking-wide opacity-80 mb-1">
                        {suporte ? 'Suporte Obra 10' : m.autor?.nome || 'Cliente'}
                      </p>
                      <p className="whitespace-pre-wrap leading-relaxed">{m.corpo}</p>
                      <p className={`text-[10px] mt-2 ${suporte ? 'text-red-100' : 'text-gray-400'}`}>
                        {new Date(m.createdAt).toLocaleString('pt-BR')}
                      </p>
                    </div>
                  );
                })
              )}
            </div>

            {selecionado && (
              <div className="px-5 py-4 border-t border-gray-100 bg-white space-y-3">
                <textarea
                  value={resposta}
                  onChange={(e) => setResposta(e.target.value)}
                  rows={3}
                  placeholder="Escreva a resposta para o cliente…"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setSelecionado(null)}
                    className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 rounded-lg"
                  >
                    Fechar
                  </button>
                  <button
                    type="button"
                    disabled={enviando || !resposta.trim()}
                    onClick={enviarResposta}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-bold rounded-lg"
                  >
                    {enviando ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    Enviar resposta
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSuporte;
