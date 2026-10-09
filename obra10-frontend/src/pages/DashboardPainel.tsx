import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { FileText, Users, LayoutDashboard, Image as ImageIcon, Loader2, ArrowRight, CheckCircle, Clock, AlertCircle, XCircle, ClipboardList, Printer } from 'lucide-react';
import api from '../services/api';
import { format } from 'date-fns';
import { parseUTCDate } from '../utils/date';
import { useNavigate } from 'react-router-dom';
import { MediaGalleryModal } from '../components/MediaGalleryModal';

type RdoStatus = 'RASCUNHO' | 'EM_PREENCHIMENTO' | 'SUBMETIDO' | 'APROVADO' | 'REJEITADO';

const STATUS_CONFIG: Record<RdoStatus, { label: string; color: string; icon: React.ReactNode }> = {
  RASCUNHO:         { label: 'Rascunho',     color: 'bg-gray-100 text-gray-600 border-gray-200',    icon: <FileText size={12} /> },
  EM_PREENCHIMENTO: { label: 'Em Andamento', color: 'bg-blue-50 text-blue-700 border-blue-200',    icon: <Clock size={12} /> },
  SUBMETIDO:        { label: 'Submetido',    color: 'bg-amber-50 text-amber-700 border-amber-200', icon: <AlertCircle size={12} /> },
  APROVADO:         { label: 'Aprovado',     color: 'bg-green-50 text-green-700 border-green-200', icon: <CheckCircle size={12} /> },
  REJEITADO:        { label: 'Reprovado',    color: 'bg-red-50 text-red-700 border-red-200',       icon: <XCircle size={12} /> },
};

const getStatus = (s: string) => STATUS_CONFIG[s as RdoStatus] ?? STATUS_CONFIG.RASCUNHO;

interface GrupoPendencia {
  responsavel: string;
  empresa?: string;
  itens: string[];
}

interface DashboardStats {
  rdosPendentes: number;
  efetivoHoje: number;
  status: string;
  atividadesRecentes: Array<{
    id: string;
    dataReferencia: string;
    status: string;
    descricao: string;
  }>;
  atividadesPendentes?: {
    rdoId: string | null;
    dataReferencia: string | null;
    grupos: GrupoPendencia[];
  };
}

function nomeComparavel(valor: string) {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export const Dashboard: React.FC = () => {
  const { obraAtiva, user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [periodoPendencia, setPeriodoPendencia] = useState<'semana' | 'mes'>('semana');
  const [imprimindoPendencias, setImprimindoPendencias] = useState(false);

  const carregarStats = async () => {
    if (!obraAtiva?.id) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/obras/${obraAtiva.id}/dashboard-painel`);
      setStats(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Erro ao carregar estatísticas do painel.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarStats();
  }, [obraAtiva?.id]);

  const imprimirPendencias = async () => {
    if (!obraAtiva?.id) return;
    const hoje = new Date();
    let de: Date;
    let ate: Date;
    if (periodoPendencia === 'mes') {
      de = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      ate = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    } else {
      const deslocamento = hoje.getDay() === 0 ? 6 : hoje.getDay() - 1;
      de = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - deslocamento);
      ate = new Date(de.getFullYear(), de.getMonth(), de.getDate() + 6);
    }
    const iso = (data: Date) => {
      const mes = String(data.getMonth() + 1).padStart(2, '0');
      const dia = String(data.getDate()).padStart(2, '0');
      return `${data.getFullYear()}-${mes}-${dia}`;
    };
    setImprimindoPendencias(true);
    setError('');
    try {
      const res = await api.get('/rdos/pendencias/pdf', {
        params: { de: iso(de), ate: iso(ate) },
        responseType: 'blob',
      });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Não foi possível gerar o relatório de pendências.');
    } finally {
      setImprimindoPendencias(false);
    }
  };

  return (
    <div className="flex-1 p-6 lg:p-10">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Painel Geral</h1>
            <p className="text-sm text-gray-500 mt-1">Visão geral do canteiro ativo: {obraAtiva?.nome || 'Selecionar Obra'}</p>
          </div>
          {obraAtiva?.id && (
            <button
              onClick={() => setIsGalleryOpen(true)}
              className="bg-lunardeli-red hover:bg-red-700 active:bg-red-800 text-white px-5 py-2.5 rounded-xl flex items-center font-bold shadow-sm transition-colors text-sm self-start md:self-auto gap-2"
            >
              <ImageIcon size={18} /> Galeria de Fotos & Vídeos
            </button>
          )}
        </div>

        {error && (
          <div className="mb-8 p-4 bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <Loader2 size={36} className="animate-spin text-lunardeli-red mb-3" />
            <p className="text-sm font-medium">Carregando informações do painel...</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-4">
                <div className="bg-red-50 p-4 rounded-lg text-lunardeli-red">
                  <FileText size={24} />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">RDOs Pendentes</p>
                  <p className="text-2xl font-bold text-gray-800">{stats?.rdosPendentes ?? 0}</p>
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-4">
                <div className="bg-blue-50 p-4 rounded-lg text-blue-600">
                  <Users size={24} />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Efetivo Hoje</p>
                  <p className="text-2xl font-bold text-gray-800">{stats?.efetivoHoje ?? 0}</p>
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-4">
                <div className="bg-green-50 p-4 rounded-lg text-green-600">
                  <LayoutDashboard size={24} />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Status</p>
                  <p className="text-2xl font-bold text-gray-800">{stats?.status || obraAtiva?.status || 'ATIVA'}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-8">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-800">Atividades pendentes</h2>
                  {stats?.atividadesPendentes?.dataReferencia && (
                    <p className="text-xs text-gray-500 mt-1">
                      Conforme o diário de {format(parseUTCDate(stats.atividadesPendentes.dataReferencia), 'dd/MM/yyyy')}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">O PDF lista o que ainda está aberto na semana ou no mês, por pessoa e empresa.</p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                    {(['semana', 'mes'] as const).map((opcao) => (
                      <button
                        key={opcao}
                        type="button"
                        onClick={() => setPeriodoPendencia(opcao)}
                        className={`px-2.5 py-1.5 text-xs font-semibold ${periodoPendencia === opcao ? 'bg-lunardeli-red text-white' : 'bg-white text-gray-600'}`}
                      >
                        {opcao === 'semana' ? 'Semana' : 'Mês'}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={imprimirPendencias}
                    disabled={imprimindoPendencias}
                    className="text-xs font-bold text-lunardeli-red border border-red-200 bg-red-50 hover:bg-red-100 px-2.5 py-1.5 rounded-lg flex items-center gap-1 disabled:opacity-50"
                  >
                    <Printer size={12} /> {imprimindoPendencias ? 'Gerando...' : 'Imprimir'}
                  </button>
                  {stats?.atividadesPendentes?.rdoId && (
                    <button
                      type="button"
                      onClick={() => navigate(`/obras/${obraAtiva?.id}/rdos/${stats.atividadesPendentes?.rdoId}`)}
                      className="text-xs font-bold text-lunardeli-red hover:underline flex items-center gap-0.5"
                    >
                      Abrir diário <ArrowRight size={12} />
                    </button>
                  )}
                </div>
              </div>
              {!stats?.atividadesPendentes?.grupos?.some((grupo) => grupo.itens.length > 0) ? (
                <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                  <ClipboardList size={40} className="mb-3 opacity-20" />
                  <p className="text-sm">Nenhuma atividade pendente no último diário.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {[...stats.atividadesPendentes.grupos]
                    .sort((a, b) => {
                      const eu = nomeComparavel(user?.nome || '');
                      const peso = (nome: string) => {
                        if (nome === 'Sem responsável') return 2;
                        if (eu && nomeComparavel(nome) === eu) return 0;
                        return 1;
                      };
                      return peso(a.responsavel) - peso(b.responsavel);
                    })
                    .map((grupo) => {
                      const minha = nomeComparavel(grupo.responsavel) === nomeComparavel(user?.nome || '');
                      return (
                        <section
                          key={`${grupo.responsavel}-${grupo.empresa || ''}`}
                          className={`rounded-xl border p-4 ${minha ? 'border-red-200 bg-red-50/40' : 'border-gray-100 bg-gray-50/60'}`}
                        >
                          <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2 mb-3">
                            <span className={`h-7 w-7 rounded-full flex items-center justify-center ${minha ? 'bg-lunardeli-red text-white' : 'bg-white text-gray-500 border border-gray-200'}`}>
                              <Users size={14} />
                            </span>
                            <span>
                              {grupo.responsavel}
                              {grupo.empresa ? <span className="block text-[11px] font-medium text-gray-500">{grupo.empresa}</span> : null}
                            </span>
                            {minha && (
                              <span className="text-[10px] font-bold uppercase tracking-wide text-lunardeli-red">Você</span>
                            )}
                          </h3>
                          <ul className="space-y-2">
                            {grupo.itens.map((item, index) => (
                              <li key={`${grupo.responsavel}-${index}`} className="text-sm text-gray-700 leading-snug pl-3 border-l-2 border-lunardeli-red/40">
                                {item}
                              </li>
                            ))}
                          </ul>
                        </section>
                      );
                    })}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 min-h-[400px] lg:col-span-2">
                <h2 className="text-xl font-bold text-gray-800 mb-6">Atividade Recente</h2>
                {!stats?.atividadesRecentes || stats.atividadesRecentes.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                    <FileText size={48} className="mb-4 opacity-20" />
                    <p className="text-sm">Nenhuma atividade recente registrada nesta obra.</p>
                  </div>
                ) : (
                  <div className="flow-root">
                    <ul className="-mb-8">
                      {stats.atividadesRecentes.map((item, itemIdx) => {
                        const st = getStatus(item.status);
                        return (
                          <li key={item.id}>
                            <div className="relative pb-8">
                              {itemIdx !== stats.atividadesRecentes.length - 1 ? (
                                <span className="absolute top-4 left-5 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true" />
                              ) : null}
                              <div className="relative flex space-x-3 items-start">
                                <div>
                                  <span className="h-10 w-10 rounded-full bg-red-50 flex items-center justify-center ring-8 ring-white text-lunardeli-red">
                                    <FileText size={18} />
                                  </span>
                                </div>
                                <div className="flex-1 min-w-0 pt-1.5 flex justify-between space-x-4">
                                  <div>
                                    <p className="text-sm font-semibold text-gray-800 cursor-pointer hover:text-lunardeli-red transition-colors" onClick={() => navigate(`/obras/${obraAtiva?.id}/rdos/${item.id}`)}>
                                      Diário de Obra — {format(parseUTCDate(item.dataReferencia), 'dd/MM/yyyy')}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1 line-clamp-2" title={item.descricao}>
                                      {item.descricao}
                                    </p>
                                  </div>
                                  <div className="text-right flex flex-col items-end gap-1.5 whitespace-nowrap">
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${st.color}`}>
                                      {st.icon} {st.label}
                                    </span>
                                    <button
                                      onClick={() => navigate(`/obras/${obraAtiva?.id}/rdos/${item.id}`)}
                                      className="text-xs font-bold text-lunardeli-red hover:underline flex items-center gap-0.5"
                                    >
                                      Ver <ArrowRight size={10} />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>

              {/* Quick access cards */}
              <div className="space-y-6">
                <div className="bg-gradient-to-br from-lunardeli-red to-red-700 text-white rounded-xl shadow-md p-6 flex flex-col justify-between h-48">
                  <div>
                    <h3 className="font-bold text-lg">Mídias do Canteiro</h3>
                    <p className="text-xs text-white/80 mt-1.5 leading-relaxed">
                      Acesse todas as fotos e vídeos compartilhados na execução dos diários de obra deste projeto em uma visão única.
                    </p>
                  </div>
                  <button
                    onClick={() => setIsGalleryOpen(true)}
                    className="w-full bg-white text-lunardeli-red hover:bg-gray-100 active:bg-gray-200 transition-colors py-2.5 rounded-lg text-xs font-black text-center shadow-sm uppercase tracking-wider"
                  >
                    Visualizar Galeria
                  </button>
                </div>

                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                  <h3 className="font-bold text-gray-800 text-sm mb-3">Relatórios Dinâmicos</h3>
                  <p className="text-xs text-gray-500 leading-relaxed mb-4">
                    Gere relatórios executivos baseados em IA a partir da listagem de diários.
                  </p>
                  <button
                    onClick={() => navigate(`/obras/${obraAtiva?.id}/rdos`)}
                    className="w-full bg-gray-50 hover:bg-gray-100 border border-gray-200 transition-colors py-2.5 rounded-lg text-xs font-bold text-gray-700 text-center flex items-center justify-center gap-1.5"
                  >
                    Ir para RDOs <ArrowRight size={12} />
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {obraAtiva?.id && (
        <MediaGalleryModal
          isOpen={isGalleryOpen}
          onClose={() => setIsGalleryOpen(false)}
          obraId={obraAtiva.id}
        />
      )}
    </div>
  );
};
