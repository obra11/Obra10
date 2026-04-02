import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { rdoService } from '../services/rdo.service';
import { format } from 'date-fns';
import { Plus, Search, FileText, CheckCircle, Clock, XCircle, AlertCircle, BarChart2, X, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

type RdoStatus = 'RASCUNHO' | 'EM_PREENCHIMENTO' | 'SUBMETIDO' | 'APROVADO' | 'REJEITADO';

const STATUS_CONFIG: Record<RdoStatus, { label: string; color: string; icon: React.ReactNode }> = {
  RASCUNHO:         { label: 'Rascunho',     color: 'bg-gray-100 text-gray-600 border-gray-200',    icon: <FileText size={12} /> },
  EM_PREENCHIMENTO: { label: 'Em Andamento', color: 'bg-blue-50 text-blue-700 border-blue-200',    icon: <Clock size={12} /> },
  SUBMETIDO:        { label: 'Submetido',    color: 'bg-amber-50 text-amber-700 border-amber-200', icon: <AlertCircle size={12} /> },
  APROVADO:         { label: 'Aprovado',     color: 'bg-green-50 text-green-700 border-green-200', icon: <CheckCircle size={12} /> },
  REJEITADO:        { label: 'Reprovado',    color: 'bg-red-50 text-red-700 border-red-200',       icon: <XCircle size={12} /> },
};

const getStatus = (s: string) => STATUS_CONFIG[s as RdoStatus] ?? STATUS_CONFIG.RASCUNHO;

export const RdoList: React.FC = () => {
  const { obraAtiva } = useAuth();
  const navigate = useNavigate();
  const [rdos, setRdos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');

  // Relatório IA
  const [showIAModal, setShowIAModal] = useState(false);
  const [iaDataInicio, setIaDataInicio] = useState('');
  const [iaDataFim, setIaDataFim] = useState('');
  const [iaLoading, setIaLoading] = useState(false);
  const [iaResultado, setIaResultado] = useState<any>(null);
  const [iaError, setIaError] = useState('');

  useEffect(() => { if (obraAtiva?.id) carregarRdos(); }, [obraAtiva?.id]);

  const carregarRdos = async () => {
    try {
      setLoading(true);
      setRdos(await rdoService.listarRdos(obraAtiva!.id));
    } catch { /* silent */ } finally { setLoading(false); }
  };

  const gerarRelatorioIA = async () => {
    if (!iaDataInicio || !iaDataFim) { setIaError('Informe início e fim do período.'); return; }
    setIaLoading(true); setIaError(''); setIaResultado(null);
    try {
      const r = await api.post(`/obras/${obraAtiva?.id}/relatorio-ia`,
        { dataInicio: iaDataInicio, dataFim: iaDataFim },
        { headers: { 'x-obra-id': obraAtiva?.id } },
      );
      setIaResultado(r.data);
    } catch (e: any) {
      setIaError(e?.response?.data?.message || 'Erro ao gerar relatório.');
    } finally { setIaLoading(false); }
  };

  const rdosFiltrados = rdos.filter(r =>
    format(new Date(r.dataReferencia), 'dd/MM/yyyy').includes(busca) ||
    r.status?.toLowerCase().includes(busca.toLowerCase()),
  );

  return (
    <div className="p-6 md:p-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-lunardeli-dark">Diários de Obra</h1>
          <p className="text-gray-500 text-sm mt-1">Gerencie os relatórios diários do canteiro ativo.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowIAModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            <BarChart2 size={16} /> Relatório IA
          </button>
          <button onClick={() => navigate(`/obras/${obraAtiva?.id}/rdos/novo`)}
            className="bg-lunardeli-red hover:bg-red-700 text-white px-5 py-2.5 rounded-lg flex items-center font-medium shadow-sm transition-colors">
            <Plus size={18} className="mr-2" /> Novo Diário
          </button>
        </div>
      </div>

      {/* Modal Relatório IA */}
      {showIAModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                  <BarChart2 size={18} className="text-red-600" /> Relatório Executivo — IA
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">Consolida RDOs aprovados e gera análise via Claude AI</p>
              </div>
              <button onClick={() => { setShowIAModal(false); setIaResultado(null); setIaError(''); }}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                <X size={18} className="text-gray-400" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Data início</label>
                  <input type="date" value={iaDataInicio} onChange={e => setIaDataInicio(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-red-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Data fim</label>
                  <input type="date" value={iaDataFim} onChange={e => setIaDataFim(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-red-500" />
                </div>
              </div>

              {iaError && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-xl">{iaError}</p>}

              {iaResultado && (
                <div className="space-y-3 max-h-72 overflow-y-auto">
                  {iaResultado.cached && <p className="text-xs text-gray-400 text-center">📦 Resultado em cache (últimas 24h)</p>}
                  <div className="p-3 bg-gray-50 rounded-xl text-sm">
                    <p className="font-semibold mb-1">Resumo Executivo</p>
                    <p className="text-gray-700">{iaResultado.resumoExecutivo}</p>
                  </div>
                  {iaResultado.gargalos?.length > 0 && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm">
                      <p className="font-semibold mb-1 text-amber-800">🚧 Gargalos</p>
                      <ul className="space-y-0.5">{iaResultado.gargalos.map((g: string, i: number) => <li key={i} className="text-amber-700">• {g}</li>)}</ul>
                    </div>
                  )}
                  {iaResultado.recomendacoes?.length > 0 && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm">
                      <p className="font-semibold mb-1 text-blue-800">💡 Recomendações</p>
                      <ul className="space-y-0.5">{iaResultado.recomendacoes.map((r: string, i: number) => <li key={i} className="text-blue-700">• {r}</li>)}</ul>
                    </div>
                  )}
                </div>
              )}

              <button onClick={gerarRelatorioIA} disabled={iaLoading}
                className="w-full py-2.5 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 disabled:opacity-60 flex items-center justify-center gap-2 transition-colors">
                {iaLoading ? <><Loader2 size={16} className="animate-spin" /> Gerando...</> : 'Gerar Relatório'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabela */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center bg-gray-50/50">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input type="text" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por data ou status..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-lunardeli-red/20 focus:border-lunardeli-red" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                <th className="p-4 font-semibold whitespace-nowrap">Data</th>
                <th className="p-4 font-semibold">Clima</th>
                <th className="p-4 font-semibold">Terreno</th>
                <th className="p-4 font-semibold">Status</th>
                <th className="p-4 font-semibold text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={5} className="p-8 text-center text-gray-400">Carregando diários...</td></tr>
              ) : rdosFiltrados.length === 0 ? (
                <tr><td colSpan={5} className="p-12 text-center">
                  <FileText className="mx-auto text-gray-300 mb-3" size={40} />
                  <p className="text-gray-500 font-medium">{busca ? 'Nenhum resultado' : 'Comece criando o primeiro RDO'}</p>
                </td></tr>
              ) : rdosFiltrados.map(rdo => {
                const st = getStatus(rdo.status);
                return (
                  <tr key={rdo.id} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="p-4 font-medium text-lunardeli-dark">{format(new Date(rdo.dataReferencia), 'dd/MM/yyyy')}</td>
                    <td className="p-4 text-gray-600 text-sm">{rdo.dadosExtras?.climaManha ?? '-'} / {rdo.dadosExtras?.climaTarde ?? '-'}</td>
                    <td className="p-4 text-gray-600 text-sm">{rdo.dadosExtras?.condicaoTerreno ?? '-'}</td>
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${st.color}`}>
                        {st.icon} {st.label}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <button onClick={() => navigate(`/obras/${obraAtiva?.id}/rdos/${rdo.id}`)}
                        className="text-lunardeli-red hover:text-red-800 font-medium text-sm transition-colors opacity-0 group-hover:opacity-100">
                        Visualizar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
