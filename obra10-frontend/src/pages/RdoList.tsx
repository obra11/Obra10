import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { rdoService } from '../services/rdo.service';
import { format } from 'date-fns';
import { parseUTCDate } from '../utils/date';
import {
  Plus,
  Search,
  FileText,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  BarChart2,
  X,
  Loader2,
  Users,
  Cloud,
  Calendar,
  CheckSquare,
  Image as ImageIcon,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { MediaGalleryModal } from '../components/MediaGalleryModal';
import api from '../services/api';
import { RdoShareBar } from '../components/RdoShareBar';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';

type RdoStatus =
  | 'RASCUNHO'
  | 'EM_PREENCHIMENTO'
  | 'SUBMETIDO'
  | 'APROVADO'
  | 'REJEITADO';

const STATUS_CONFIG: Record<
  RdoStatus,
  { label: string; color: string; icon: React.ReactNode }
> = {
  RASCUNHO: {
    label: 'Rascunho',
    color: 'bg-gray-100 text-gray-600 border-gray-200',
    icon: <FileText size={12} />,
  },
  EM_PREENCHIMENTO: {
    label: 'Em Andamento',
    color: 'bg-blue-50 text-blue-700 border-blue-200',
    icon: <Clock size={12} />,
  },
  SUBMETIDO: {
    label: 'Submetido',
    color: 'bg-amber-50 text-amber-700 border-amber-200',
    icon: <AlertCircle size={12} />,
  },
  APROVADO: {
    label: 'Aprovado',
    color: 'bg-green-50 text-green-700 border-green-200',
    icon: <CheckCircle size={12} />,
  },
  REJEITADO: {
    label: 'Reprovado',
    color: 'bg-red-50 text-red-700 border-red-200',
    icon: <XCircle size={12} />,
  },
};

const getStatus = (s: string) =>
  STATUS_CONFIG[s as RdoStatus] ?? STATUS_CONFIG.RASCUNHO;

export const RdoList: React.FC = () => {
  const { obraAtiva } = useAuth();
  const navigate = useNavigate();
  const [rdos, setRdos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);

  const permRdo = obraAtiva?.permissoes?.RDO || obraAtiva?.permissoes?.rdo;
  const isReadOnly = permRdo === 'VIEW' || permRdo === 'VIEW_APPROVED' || permRdo === 'VIEW_PARTIAL_APPROVED';

  // Relatório IA
  const [showIAModal, setShowIAModal] = useState(false);
  const [iaDataInicio, setIaDataInicio] = useState('');
  const [iaDataFim, setIaDataFim] = useState('');
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('TODOS');
  const [ordenacao, setOrdenacao] = useState('DATA_DESC');
  const [iaFoco, setIaFoco] = useState('');
  const [iaSecoes, setIaSecoes] = useState<string[]>([]);
  const [iaLoading, setIaLoading] = useState(false);
  const [iaResultado, setIaResultado] = useState<any>(null);
  const [iaError, setIaError] = useState('');

  // Perguntas IA (Dinâmico)
  const [iaPergunta, setIaPergunta] = useState('');
  const [iaResposta, setIaResposta] = useState('');
  const [iaPerguntaLoading, setIaPerguntaLoading] = useState(false);
  const [iaPerguntaError, setIaPerguntaError] = useState('');

  useEffect(() => {
    if (obraAtiva?.id) carregarRdos();
  }, [obraAtiva?.id]);

  const carregarRdos = async () => {
    try {
      setLoading(true);
      setRdos(await rdoService.listarRdos(obraAtiva!.id));
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  };

  const gerarRelatorioIA = async () => {
    if (!iaDataInicio || !iaDataFim) {
      setIaError('Informe início e fim do período.');
      return;
    }
    setIaLoading(true);
    setIaError('');
    setIaResultado(null);
    setIaPergunta('');
    setIaResposta('');
    setIaPerguntaError('');
    try {
      const r = await api.post(
        `/obras/${obraAtiva?.id}/relatorio-ia`,
        { dataInicio: iaDataInicio, dataFim: iaDataFim, foco: iaFoco, secoes: iaSecoes },
        { headers: { 'x-obra-id': obraAtiva?.id } },
      );
      setIaResultado(r.data);
    } catch (e: any) {
      setIaError(e?.response?.data?.message || 'Erro ao gerar relatório.');
    } finally {
      setIaLoading(false);
    }
  };

  const enviarPerguntaIA = async () => {
    if (!iaPergunta.trim() || !iaDataInicio || !iaDataFim) return;
    setIaPerguntaLoading(true);
    setIaPerguntaError('');
    setIaResposta('');
    try {
      const res = await api.post(
        `/obras/${obraAtiva?.id}/relatorio-ia/perguntar`,
        {
          dataInicio: iaDataInicio,
          dataFim: iaDataFim,
          pergunta: iaPergunta,
        },
        {
          headers: { 'x-obra-id': obraAtiva?.id },
        },
      );
      setIaResposta(res.data.resposta || 'Nenhuma resposta retornada pela IA.');
    } catch (e: any) {
      if (e?.response?.status === 429) {
        setIaPerguntaError(
          'Já existe uma pergunta sendo processada para esta obra. Por favor, aguarde.',
        );
      } else {
        setIaPerguntaError(
          e?.response?.data?.message || 'Erro ao consultar a IA.',
        );
      }
    } finally {
      setIaPerguntaLoading(false);
    }
  };

  const fecharIaModal = () => {
    setShowIAModal(false);
    setIaResultado(null);
    setIaError('');
    setIaPergunta('');
    setIaResposta('');
    setIaPerguntaError('');
    setIaFoco('');
    setIaSecoes([]);
  };

  const rdosFiltrados = rdos
    .filter((r) => {
      // 1. Filtrar por status
      if (filtroStatus !== 'TODOS' && r.status !== filtroStatus) {
        return false;
      }

      // 2. Filtrar por texto de busca
      if (!busca.trim()) return true;

      const queryNormalized = busca
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();

      const stConfig = STATUS_CONFIG[r.status as RdoStatus] || STATUS_CONFIG.RASCUNHO;
      const statusLabel = stConfig.label
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

      const dateStr = format(parseUTCDate(r.dataReferencia), 'dd/MM/yyyy');
      const climaManha = (r.dadosExtras?.climaManha || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      const climaTarde = (r.dadosExtras?.climaTarde || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      const climaNoite = (r.dadosExtras?.climaNoite || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      const terreno = (r.dadosExtras?.condicaoTerreno || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

      const searchableText = [
        dateStr,
        `rdo #${r.sequencial}`,
        `rdo ${r.sequencial}`,
        `#${r.sequencial}`,
        String(r.sequencial || ''),
        statusLabel,
        climaManha,
        climaTarde,
        climaNoite,
        terreno,
        r.id,
      ]
        .join(' ')
        .toLowerCase();

      const terms = queryNormalized.split(/\s+/);
      return terms.every((term) => searchableText.includes(term));
    })
    // 3. Ordenar os resultados
    .sort((a, b) => {
      if (ordenacao === 'DATA_DESC') {
        return new Date(b.dataReferencia).getTime() - new Date(a.dataReferencia).getTime();
      }
      if (ordenacao === 'DATA_ASC') {
        return new Date(a.dataReferencia).getTime() - new Date(b.dataReferencia).getTime();
      }
      if (ordenacao === 'NUMERO_DESC') {
        return (b.sequencial || 0) - (a.sequencial || 0);
      }
      if (ordenacao === 'NUMERO_ASC') {
        return (a.sequencial || 0) - (b.sequencial || 0);
      }
      return 0;
    });

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 md:mb-8 gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-lunardeli-dark">
            Diários de Obra
          </h1>
          <p className="text-gray-500 text-xs md:text-sm mt-1">
            Gerencie os relatórios diários do canteiro ativo.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setIsGalleryOpen(true)}
            className="flex items-center gap-2 px-3 md:px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors"
          >
            <ImageIcon size={16} />{' '}
            <span className="hidden sm:inline">Galeria</span> Mídias
          </button>
          {!isReadOnly && (
            <button
              onClick={() => setShowIAModal(true)}
              className="flex items-center gap-2 px-3 md:px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors"
            >
              <BarChart2 size={16} />{' '}
              <span className="hidden sm:inline">Relatório</span> IA
            </button>
          )}
          {!isReadOnly && (
            <button
              onClick={() => navigate(`/obras/${obraAtiva?.id}/rdos/novo`)}
              className="bg-lunardeli-red hover:bg-red-700 active:bg-red-800 text-white px-4 md:px-5 py-2.5 rounded-lg flex items-center font-medium shadow-sm transition-colors"
            >
              <Plus size={18} className="mr-1.5" /> Novo Diário
            </button>
          )}
        </div>
      </div>

      {/* Modal Relatório IA */}
      {showIAModal && (
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm p-0 md:p-4">
          <div className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden max-h-[85dvh] md:max-h-[90vh] flex flex-col">
            <div className="p-4 md:p-5 border-b border-gray-100 flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                  <BarChart2 size={18} className="text-red-600" /> Relatório
                  Executivo — IA
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Consolida RDOs aprovados e gera análise via Claude AI
                </p>
              </div>
              <button
                onClick={fecharIaModal}
                className="p-2.5 hover:bg-gray-100 active:bg-gray-200 rounded-lg transition-colors"
              >
                <X size={18} className="text-gray-400" />
              </button>
            </div>

            <div className="p-4 md:p-5 space-y-4 overflow-y-auto custom-scrollbar flex-1">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Data início
                  </label>
                  <input
                    type="date"
                    value={iaDataInicio}
                    onChange={(e) => setIaDataInicio(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Data fim
                  </label>
                  <input
                    type="date"
                    value={iaDataFim}
                    onChange={(e) => setIaDataFim(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-red-500"
                  />
                </div>
              </div>

              {/* Opções de Customização do Relatório IA */}
              <div className="space-y-3 border-t border-gray-100 pt-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Foco da Análise / Diretriz Especial (Opcional)
                  </label>
                  <input
                    type="text"
                    value={iaFoco}
                    onChange={(e) => setIaFoco(e.target.value)}
                    placeholder="Ex: Focar na escassez de materiais ou atrasos no reboco..."
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Seções de Interesse
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { id: 'resumo', label: 'Resumo Geral' },
                      { id: 'efetivo', label: 'Efetivo / Funcionários' },
                      { id: 'clima', label: 'Clima e Terreno' },
                      { id: 'tarefas', label: 'Tarefas Pendentes' },
                      { id: 'gargalos', label: 'Gargalos e Ocorrências' },
                    ].map((sec) => {
                      const isSelected = iaSecoes.includes(sec.id);
                      return (
                        <button
                          key={sec.id}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setIaSecoes(iaSecoes.filter((s) => s !== sec.id));
                            } else {
                              setIaSecoes([...iaSecoes, sec.id]);
                            }
                          }}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                            isSelected
                              ? 'bg-red-50 border-red-200 text-red-700 font-semibold'
                              : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          {sec.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {iaError && (
                <p className="text-sm text-red-600 bg-red-50 p-3 rounded-xl">
                  {iaError}
                </p>
              )}

              {iaResultado && (
                <div className="space-y-4 pr-2">
                  {iaResultado.cached && (
                    <p className="text-xs text-gray-400 text-center -mt-2">
                      📦 Resultado em cache (últimas 24h)
                    </p>
                  )}

                  {/* Cards Híbridos */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex items-center gap-4">
                      <div className="p-3 bg-blue-100 text-blue-600 rounded-lg shrink-0">
                        <Calendar size={20} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wide truncate">
                          Dias Analisados
                        </p>
                        <p className="text-2xl font-bold text-gray-900">
                          {iaResultado.totalDias || 0}
                        </p>
                      </div>
                    </div>
                    <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl flex items-center gap-4">
                      <div className="p-3 bg-amber-100 text-amber-600 rounded-lg shrink-0">
                        <Users size={20} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wide truncate">
                          Média Efetivo/Dia
                        </p>
                        <p className="text-2xl font-bold text-gray-900">
                          {iaResultado.mediaEfetivoDiario || 0}
                        </p>
                      </div>
                    </div>
                    <div className="bg-cyan-50 border border-cyan-100 p-4 rounded-xl flex items-center gap-4">
                      <div className="p-3 bg-cyan-100 text-cyan-600 rounded-lg shrink-0">
                        <Cloud size={20} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wide truncate">
                          Resumo do Clima
                        </p>
                        <p className="text-sm font-bold text-gray-900 leading-tight truncate">
                          {iaResultado.climaPredominante || '-'}
                        </p>
                        {iaResultado.contagemClima && (
                          <div className="flex gap-2.5 mt-1 text-[10px] text-gray-500 font-bold">
                            {iaResultado.contagemClima.sol > 0 && (
                              <span className="whitespace-nowrap">
                                ☀️ {iaResultado.contagemClima.sol}d
                              </span>
                            )}
                            {iaResultado.contagemClima.chuva > 0 && (
                              <span className="whitespace-nowrap">
                                🌧️ {iaResultado.contagemClima.chuva}d
                              </span>
                            )}
                            {iaResultado.contagemClima.nublado > 0 && (
                              <span className="whitespace-nowrap">
                                ☁️ {iaResultado.contagemClima.nublado}d
                              </span>
                            )}
                            {iaResultado.contagemClima.outros > 0 && (
                              <span className="whitespace-nowrap">
                                💨 {iaResultado.contagemClima.outros}d
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Serviços */}
                    <div className="border border-gray-200 rounded-xl overflow-hidden flex flex-col bg-white">
                      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                        <p className="font-bold text-gray-900 flex items-center gap-2 text-sm">
                          <CheckSquare size={16} className="text-green-600" />{' '}
                          Principais Serviços Executados
                        </p>
                      </div>
                      <div className="p-4 flex-1 h-[280px] overflow-y-auto custom-scrollbar">
                        {!iaResultado.servicosExecutados ||
                        iaResultado.servicosExecutados.length === 0 ? (
                          <p className="text-gray-400 text-sm text-center py-4">
                            Nenhum serviço registrado
                          </p>
                        ) : (
                          <ul className="space-y-2.5">
                            {iaResultado.servicosExecutados.map(
                              (s: string, i: number) => (
                                <li
                                  key={i}
                                  className="text-sm text-gray-700 flex items-start gap-2 leading-snug"
                                >
                                  <span className="text-green-500 mt-[3px] shrink-0">
                                    <CheckCircle size={14} />
                                  </span>{' '}
                                  {s}
                                </li>
                              ),
                            )}
                          </ul>
                        )}
                      </div>
                    </div>

                    {/* Insights IA */}
                    <div className="border border-red-100/60 rounded-xl overflow-hidden flex flex-col bg-white shadow-sm">
                      <div className="bg-red-50 px-4 py-3 border-b border-red-100 flex justify-between items-center">
                        <p className="font-bold text-red-900 flex items-center gap-2 text-sm">
                          <BarChart2 size={16} className="text-red-600" />{' '}
                          Insights Avançados
                        </p>
                        <span className="text-[9px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold tracking-widest">
                          IA
                        </span>
                      </div>
                      <div className="p-4 flex-1 space-y-4 h-[280px] overflow-y-auto custom-scrollbar">
                        <div>
                          <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold mb-1.5">
                            Resumo Executivo
                          </p>
                          <p className="text-sm text-gray-700 leading-relaxed font-medium">
                            {iaResultado.resumoExecutivo}
                          </p>
                        </div>
                        {iaResultado.lembretes?.length > 0 && (
                          <div className="bg-purple-50/50 border border-purple-100 p-3 rounded-lg">
                            <p className="text-xs text-purple-800 uppercase tracking-wide font-bold mb-2 flex items-center gap-1.5">
                              <AlertCircle
                                size={14}
                                className="text-purple-600"
                              />{' '}
                              Lembretes e Alertas
                            </p>
                            <ul className="space-y-1.5">
                              {iaResultado.lembretes.map(
                                (l: string, i: number) => (
                                  <li
                                    key={i}
                                    className="text-sm text-purple-900 leading-tight flex items-start gap-1.5"
                                  >
                                    <span className="text-purple-400 pt-0.5 mt-px text-[10px]">
                                      ▪
                                    </span>{' '}
                                    {l}
                                  </li>
                                ),
                              )}
                            </ul>
                          </div>
                        )}
                        {iaResultado.gargalos?.length > 0 && (
                          <div className="bg-orange-50/50 border border-orange-100 p-3 rounded-lg">
                            <p className="text-xs text-orange-800 uppercase tracking-wide font-bold mb-2 flex items-center gap-1.5">
                              <AlertCircle size={14} /> Gargalos Operacionais
                            </p>
                            <ul className="space-y-1.5">
                              {iaResultado.gargalos.map(
                                (g: string, i: number) => (
                                  <li
                                    key={i}
                                    className="text-sm text-orange-900 leading-tight flex items-start gap-1.5"
                                  >
                                    <span className="text-orange-400 pt-0.5 mt-px text-[10px]">
                                      ▪
                                    </span>{' '}
                                    {g}
                                  </li>
                                ),
                              )}
                            </ul>
                          </div>
                        )}
                        {iaResultado.recomendacoes?.length > 0 && (
                          <div className="bg-blue-50/50 border border-blue-100 p-3 rounded-lg">
                            <p className="text-xs text-blue-800 uppercase tracking-wide font-bold mb-2 flex items-center gap-1.5">
                              <CheckCircle size={14} /> Recomendações
                            </p>
                            <ul className="space-y-1.5">
                              {iaResultado.recomendacoes.map(
                                (r: string, i: number) => (
                                  <li
                                    key={i}
                                    className="text-sm text-blue-900 leading-tight flex items-start gap-1.5"
                                  >
                                    <span className="text-blue-400 pt-0.5 mt-px">
                                      <CheckCircle size={12} />
                                    </span>{' '}
                                    {r}
                                  </li>
                                ),
                              )}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Gráficos de Frequência (Recharts) */}
                  {((iaResultado.topAtividades &&
                    iaResultado.topAtividades.length > 0) ||
                    (iaResultado.topPendencias &&
                      iaResultado.topPendencias.length > 0)) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      {/* Gráfico de Atividades */}
                      {iaResultado.topAtividades &&
                        iaResultado.topAtividades.length > 0 && (
                          <div className="border border-gray-200 rounded-xl p-4 bg-white shadow-sm flex flex-col h-[280px]">
                            <p className="font-bold text-gray-800 text-sm mb-3 flex items-center gap-2">
                              <CheckSquare
                                size={16}
                                className="text-blue-600"
                              />{' '}
                              Atividades mais Repetidas (Dias)
                            </p>
                            <div className="flex-1 w-full text-xs">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                  layout="vertical"
                                  data={iaResultado.topAtividades.slice(0, 5)}
                                  margin={{
                                    top: 5,
                                    right: 20,
                                    left: 10,
                                    bottom: 5,
                                  }}
                                >
                                  <XAxis type="number" hide />
                                  <YAxis
                                    type="category"
                                    dataKey="item"
                                    width={120}
                                    stroke="#6b7280"
                                    fontSize={10}
                                    tickLine={false}
                                    axisLine={false}
                                  />
                                  <Tooltip
                                    contentStyle={{
                                      background: '#fff',
                                      borderRadius: '8px',
                                      border: '1px solid #e5e7eb',
                                    }}
                                    labelStyle={{ fontWeight: 'bold' }}
                                  />
                                  <Bar
                                    dataKey="count"
                                    fill="#3b82f6"
                                    radius={[0, 4, 4, 0]}
                                    barSize={12}
                                  />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                        )}

                      {/* Gráfico de Pendências */}
                      {iaResultado.topPendencias &&
                        iaResultado.topPendencias.length > 0 && (
                          <div className="border border-gray-200 rounded-xl p-4 bg-white shadow-sm flex flex-col h-[280px]">
                            <p className="font-bold text-gray-800 text-sm mb-3 flex items-center gap-2">
                              <AlertCircle
                                size={16}
                                className="text-red-500"
                              />{' '}
                              Pendências e Cobranças (Dias)
                            </p>
                            <div className="flex-1 w-full text-xs">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                  layout="vertical"
                                  data={iaResultado.topPendencias.slice(0, 5)}
                                  margin={{
                                    top: 5,
                                    right: 20,
                                    left: 10,
                                    bottom: 5,
                                  }}
                                >
                                  <XAxis type="number" hide />
                                  <YAxis
                                    type="category"
                                    dataKey="item"
                                    width={120}
                                    stroke="#6b7280"
                                    fontSize={10}
                                    tickLine={false}
                                    axisLine={false}
                                  />
                                  <Tooltip
                                    contentStyle={{
                                      background: '#fff',
                                      borderRadius: '8px',
                                      border: '1px solid #e5e7eb',
                                    }}
                                    labelStyle={{ fontWeight: 'bold' }}
                                  />
                                  <Bar
                                    dataKey="count"
                                    fill="#ef4444"
                                    radius={[0, 4, 4, 0]}
                                    barSize={12}
                                  />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                        )}
                    </div>
                  )}

                  {/* Pesquisa Interativa (Pergunte à IA) */}
                  <div className="border border-gray-200 rounded-xl overflow-hidden bg-white mt-4 shadow-sm">
                    <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                      <p className="font-bold text-gray-900 flex items-center gap-2 text-sm">
                        <Search size={16} className="text-lunardeli-red" />{' '}
                        Pesquisa Interativa (Pergunte à IA)
                      </p>
                      <span className="text-[9px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold tracking-widest">
                        BETA
                      </span>
                    </div>
                    <div className="p-4 space-y-3">
                      <p className="text-xs text-gray-500">
                        Tire dúvidas específicas ou busque ocorrências sobre os
                        relatórios do período selecionado.
                      </p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={iaPergunta}
                          onChange={(e) => setIaPergunta(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') enviarPerguntaIA();
                          }}
                          placeholder="Ex: Houve algum atraso na concretagem? Qual o status da pintura?"
                          disabled={iaPerguntaLoading}
                          className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 outline-none disabled:bg-gray-50"
                        />
                        <button
                          onClick={enviarPerguntaIA}
                          disabled={iaPerguntaLoading || !iaPergunta.trim()}
                          className="bg-red-600 hover:bg-red-700 active:bg-red-800 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-1.5 transition-colors shrink-0"
                        >
                          {iaPerguntaLoading ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            'Perguntar'
                          )}
                        </button>
                      </div>

                      {iaPerguntaError && (
                        <p className="text-xs text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-100">
                          {iaPerguntaError}
                        </p>
                      )}

                      {iaResposta && (
                        <div className="bg-gray-50 border border-gray-200 p-3.5 rounded-xl mt-2">
                          <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">
                            Resposta da IA
                          </p>
                          <p className="text-sm text-gray-800 leading-relaxed font-medium whitespace-pre-wrap">
                            {iaResposta}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

            </div>

            <div 
              className="p-4 border-t border-gray-100 bg-gray-50 flex gap-3 shrink-0"
              style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))' }}
            >
              <button
                type="button"
                onClick={fecharIaModal}
                className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-100 active:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={gerarRelatorioIA}
                disabled={iaLoading}
                className="flex-[2] py-3 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 active:bg-red-800 disabled:opacity-60 flex items-center justify-center gap-2 transition-colors shadow-sm"
              >
                {iaLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Gerando...
                  </>
                ) : iaResultado ? (
                  'Atualizar Relatório'
                ) : (
                  'Gerar Relatório'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-3 md:p-4 border-b border-gray-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between bg-gray-50/50 gap-3">
          <div className="relative w-full max-w-md">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              size={18}
            />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar no diário de obra..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-lunardeli-red/20 focus:border-lunardeli-red text-sm"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-xs md:text-sm bg-white focus:ring-2 focus:ring-lunardeli-red/20"
            >
              <option value="TODOS">Todos os Status</option>
              <option value="RASCUNHO">Rascunho</option>
              <option value="SUBMETIDO">Aguardando Aprovação</option>
              <option value="APROVADO">Aprovado</option>
              <option value="REJEITADO">Rejeitado</option>
            </select>
            <select
              value={ordenacao}
              onChange={(e) => setOrdenacao(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-xs md:text-sm bg-white focus:ring-2 focus:ring-lunardeli-red/20"
            >
              <option value="DATA_DESC">Mais recentes primeiro</option>
              <option value="DATA_ASC">Mais antigos primeiro</option>
              <option value="NUMERO_DESC">Nº RDO: Maior primeiro</option>
              <option value="NUMERO_ASC">Nº RDO: Menor primeiro</option>
            </select>
          </div>
        </div>

        <div className="hidden md:block overflow-x-auto rounded-b-xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                <th className="p-4 font-semibold whitespace-nowrap">Nº RDO</th>
                <th className="p-4 font-semibold whitespace-nowrap">Data</th>
                <th className="p-4 font-semibold">Clima</th>
                <th className="p-4 font-semibold">Terreno</th>
                <th className="p-4 font-semibold">Status</th>
                <th className="p-4 font-semibold text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-400">
                    Carregando diários...
                  </td>
                </tr>
              ) : rdosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center">
                    <FileText
                      className="mx-auto text-gray-300 mb-3"
                      size={40}
                    />
                    <p className="text-gray-500 font-medium">
                      {(busca || filtroStatus !== 'TODOS') ? 'Nenhum resultado encontrado' : 'Comece criando o primeiro RDO'}
                    </p>
                  </td>
                </tr>
              ) : (
                rdosFiltrados.map((rdo, index) => {
                  const st = getStatus(rdo.status);
                  const openUp = index >= 2;
                  return (
                    <tr
                      key={rdo.id}
                      className="hover:bg-gray-50/50 transition-colors"
                    >
                      <td
                        className="p-4 font-bold text-lunardeli-red cursor-pointer text-sm"
                        onClick={() =>
                          navigate(`/obras/${obraAtiva?.id}/rdos/${rdo.id}`)
                        }
                      >
                        #{rdo.sequencial ?? rdo.id.slice(-6).toUpperCase()}
                      </td>
                      <td
                        className="p-4 font-medium text-lunardeli-dark cursor-pointer"
                        onClick={() =>
                          navigate(`/obras/${obraAtiva?.id}/rdos/${rdo.id}`)
                        }
                      >
                        {format(parseUTCDate(rdo.dataReferencia), 'dd/MM/yyyy')}
                      </td>
                      <td
                        className="p-4 text-gray-600 text-sm cursor-pointer"
                        onClick={() =>
                          navigate(`/obras/${obraAtiva?.id}/rdos/${rdo.id}`)
                        }
                      >
                        {rdo.dadosExtras?.climaManha ?? '-'} /{' '}
                        {rdo.dadosExtras?.climaTarde ?? '-'}
                      </td>
                      <td
                        className="p-4 text-gray-600 text-sm cursor-pointer"
                        onClick={() =>
                          navigate(`/obras/${obraAtiva?.id}/rdos/${rdo.id}`)
                        }
                      >
                        {rdo.dadosExtras?.condicaoTerreno ?? '-'}
                      </td>
                      <td
                        className="p-4"
                        onClick={() =>
                          navigate(`/obras/${obraAtiva?.id}/rdos/${rdo.id}`)
                        }
                      >
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${st.color}`}
                        >
                          {st.icon} {st.label}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-end gap-1">
                          <RdoShareBar
                            rdoId={rdo.id}
                            obraId={obraAtiva?.id || ''}
                            rdoLabel={`RDO_${format(
                              parseUTCDate(rdo.dataReferencia),
                              'yyyy-MM-dd',
                            )}`}
                            compact
                            direction={openUp ? 'up' : 'down'}
                          />
                          <button
                            onClick={() =>
                              navigate(`/obras/${obraAtiva?.id}/rdos/${rdo.id}`)
                            }
                            className="px-3 py-1.5 text-xs font-bold text-lunardeli-red hover:bg-red-50 rounded-lg transition-colors"
                          >
                            Abrir →
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="md:hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-400 text-sm">
              Carregando diários...
            </div>
          ) : rdosFiltrados.length === 0 ? (
            <div className="p-10 text-center">
              <FileText className="mx-auto text-gray-300 mb-3" size={36} />
              <p className="text-gray-500 font-medium text-sm">
                {(busca || filtroStatus !== 'TODOS') ? 'Nenhum resultado encontrado' : 'Comece criando o primeiro RDO'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {rdosFiltrados.map((rdo, index) => {
                const st = getStatus(rdo.status);
                const openUp = index >= 2;
                return (
                  <div
                    key={rdo.id}
                    className="px-4 py-3.5 flex items-center gap-3"
                  >
                    {/* Date circle */}
                    <button
                      onClick={() =>
                        navigate(`/obras/${obraAtiva?.id}/rdos/${rdo.id}`)
                      }
                      className="w-12 h-12 rounded-xl bg-gray-100 flex flex-col items-center justify-center shrink-0 active:bg-gray-200"
                    >
                      <span className="text-lg font-black text-lunardeli-dark leading-none">
                        {format(parseUTCDate(rdo.dataReferencia), 'dd')}
                      </span>
                      <span className="text-[9px] font-bold uppercase text-gray-400 leading-tight">
                        {format(parseUTCDate(rdo.dataReferencia), 'MMM')}
                      </span>
                    </button>

                    {/* Info */}
                    <button
                      onClick={() =>
                        navigate(`/obras/${obraAtiva?.id}/rdos/${rdo.id}`)
                      }
                      className="flex-1 min-w-0 text-left"
                    >
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-bold text-lunardeli-red">
                          #{rdo.sequencial ?? rdo.id.slice(-6).toUpperCase()}
                        </span>
                        <span
                          className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold border ${st.color}`}
                        >
                          {st.icon} {st.label}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 truncate">
                        {rdo.dadosExtras?.climaManha
                          ? `${rdo.dadosExtras.climaManha}`
                          : '—'}{' '}
                        · {rdo.dadosExtras?.condicaoTerreno ?? '—'}
                      </p>
                    </button>

                    {/* Share actions */}
                    <RdoShareBar
                      rdoId={rdo.id}
                      obraId={obraAtiva?.id || ''}
                      rdoLabel={`RDO_${format(
                        parseUTCDate(rdo.dataReferencia),
                        'yyyy-MM-dd',
                      )}`}
                      compact
                      direction={openUp ? 'up' : 'down'}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
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
