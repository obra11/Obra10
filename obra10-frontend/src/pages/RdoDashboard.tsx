import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, BarChart2, TrendingUp, Users, PieChart as PieIcon, RefreshCcw } from 'lucide-react';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line,
} from 'recharts';
import api from '../services/api';

const COLORS = ['#dc2626', '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899', '#f97316', '#06b6d4', '#84cc16'];

const MOTIVO_LABELS: Record<string, string> = {
  FALTA_MATERIAL: 'Falta Material',
  FALTA_MAO_DE_OBRA: 'Falta M.O.',
  CHUVA: 'Chuva',
  EQUIPAMENTO_INDISPONIVEL: 'Equip. Indisp.',
  AGUARDANDO_APROVACAO: 'Ag. Aprovação',
  PROJETO_NAO_LIBERADO: 'Proj. não liberado',
  RETRABALHO: 'Retrabalho',
  INTERFERENCIA_TERCEIROS: 'Interferência',
  OUTROS: 'Outros',
};

interface StatsData {
  totalRdos: number;
  rdosAprovados: number;
  totalTarefas: number;
  tarefasExecutadas: number;
  motivosNaoExecucao: Array<{ motivo: string; total: number }>;
  horasPorFuncao: Array<{ funcao: string; horas: number }>;
  execucaoPorSemana: Array<{ semana: string; executadas: number; naoExecutadas: number }>;
}

export const RdoDashboard: React.FC = () => {
  const { obraAtiva } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dataInicio, setDataInicio] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [dataFim] = useState(new Date().toISOString().split('T')[0]);

  const carregarStats = async () => {
    if (!obraAtiva?.id) return;
    setLoading(true); setError('');
    try {
      const r = await api.get(`/rdos/stats`, {
        headers: { 'x-obra-id': obraAtiva.id },
        params: { obraId: obraAtiva.id, dataInicio, dataFim },
      });
      setStats(r.data);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Erro ao carregar estatísticas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregarStats(); }, [obraAtiva?.id, dataInicio]);

  const taxaExecucao = stats ? Math.round((stats.tarefasExecutadas / (stats.totalTarefas || 1)) * 100) : 0;

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <BarChart2 size={24} className="text-red-600" /> Dashboard RDO
            </h1>
            <p className="text-gray-500 text-sm mt-0.5">Análise operacional dos diários de obra</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          <span className="text-gray-400 text-sm">até hoje</span>
          <button onClick={carregarStats} className="p-2 hover:bg-gray-100 rounded-lg border border-gray-200">
            <RefreshCcw size={16} className="text-gray-500" />
          </button>
        </div>
      </div>

      {error && <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>}

      {loading ? (
        <div className="flex items-center justify-center h-64 text-gray-400">
          <RefreshCcw size={32} className="animate-spin mr-3" /> Carregando estatísticas...
        </div>
      ) : stats ? (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total RDOs', value: stats.totalRdos, icon: <BarChart2 size={20} />, color: 'bg-blue-50 text-blue-700' },
              { label: 'RDOs Aprovados', value: stats.rdosAprovados, icon: <TrendingUp size={20} />, color: 'bg-green-50 text-green-700' },
              { label: 'Total Tarefas', value: stats.totalTarefas, icon: <PieIcon size={20} />, color: 'bg-purple-50 text-purple-700' },
              { label: 'Taxa Execução', value: `${taxaExecucao}%`, icon: <Users size={20} />, color: taxaExecucao >= 80 ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700' },
            ].map(kpi => (
              <div key={kpi.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl ${kpi.color} mb-3`}>
                  {kpi.icon}
                </div>
                <p className="text-2xl font-bold text-gray-900">{kpi.value}</p>
                <p className="text-sm text-gray-500 mt-0.5">{kpi.label}</p>
              </div>
            ))}
          </div>

          {/* Gráficos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pizza — Motivos de não execução */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <PieIcon size={18} className="text-red-600" /> Gargalos — Motivos de Não Execução
              </h3>
              {stats.motivosNaoExecucao.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={stats.motivosNaoExecucao.map(m => ({ name: MOTIVO_LABELS[m.motivo] ?? m.motivo, value: m.total }))}
                      cx="50%" cy="50%" outerRadius={90} dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false} fontSize={10}
                    >
                      {stats.motivosNaoExecucao.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-64 flex items-center justify-center text-gray-400 text-sm">🎉 Nenhuma não-execução no período</div>
              )}
            </div>

            {/* Barras — Horas por função */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Users size={18} className="text-blue-600" /> Efetivo por Função
              </h3>
              {stats.horasPorFuncao.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={stats.horasPorFuncao} margin={{ left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="funcao" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" height={50} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="horas" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Trabalhadores" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-64 flex items-center justify-center text-gray-400 text-sm">Sem dados de efetivo no período</div>
              )}
            </div>
          </div>

          {/* Linha — Execução acumulada por semana */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <TrendingUp size={18} className="text-green-600" /> Execução Acumulada por Semana
            </h3>
            {stats.execucaoPorSemana.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={stats.execucaoPorSemana} margin={{ left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="semana" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="executadas" stroke="#16a34a" strokeWidth={2} dot={{ r: 4 }} name="Executadas" />
                  <Line type="monotone" dataKey="naoExecutadas" stroke="#dc2626" strokeWidth={2} dot={{ r: 4 }} name="Não Executadas" strokeDasharray="5 5" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-400 text-sm">Sem dados de tarefas no período</div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};
