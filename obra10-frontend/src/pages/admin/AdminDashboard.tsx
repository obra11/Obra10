import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { Building2, Users, HardHat, FileSpreadsheet, DollarSign, Loader2, AlertTriangle, AlertCircle, Info, TrendingUp, TrendingDown, Activity, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Metricas {
  totalEmpresas: number;
  empresasAtivas: number;
  totalUsuarios: number;
  totalObras: number;
  totalRdos: number;
  receitaMensal: number;
  cobrancasPendentes: number;
  modulosMaisContratados: { codigo: string; nome: string; total: number }[];
  empresasRecentes: {
    id: string;
    razaoSocial: string;
    nomeFantasia: string;
    createdAt: string;
    ativo: boolean;
    plano: string;
  }[];
  // Novos
  receitaMesAnterior: number;
  variacaoReceita: number;
  ticketMedio: number;
  receitaPorModulo: { codigo: string; nome: string; receita: number; totalEmpresas: number }[];
  inadimplencia: { vencidas5dias: number; vencidas15dias: number; vencidas30dias: number; valorTotalInadimplente: number };
  usuariosAtivos7dias: number;
  taxaAtivacao: number;
  rdosSemana: number;
  rdosSemanaAnterior: number;
  mediaRdosPorObra: number;
  topEmpresasUso: { nome: string; totalRdos: number; ultimoRdo: string | null }[];
  alertas: { tipo: string; mensagem: string; empresaId?: string; cupomId?: string; gravidade: 'ALTA' | 'MEDIA' | 'BAIXA' }[];
}

export const AdminDashboard: React.FC = () => {
  const [metricas, setMetricas] = useState<Metricas | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/admin/metricas')
      .then(res => setMetricas(res.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading || !metricas) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="animate-spin text-red-600" size={40} />
      </div>
    );
  }

  // Defaults defensivos para campos novos
  const taxaAtivacao = metricas.taxaAtivacao ?? 0;
  const usuariosAtivos7dias = metricas.usuariosAtivos7dias ?? 0;
  const variacaoReceita = metricas.variacaoReceita ?? 0;
  const ticketMedio = metricas.ticketMedio ?? 0;
  const rdosSemana = metricas.rdosSemana ?? 0;
  const rdosSemanaAnterior = metricas.rdosSemanaAnterior ?? 0;
  const mediaRdosPorObra = metricas.mediaRdosPorObra ?? 0;
  const receitaPorModulo = metricas.receitaPorModulo ?? [];
  const topEmpresasUso = metricas.topEmpresasUso ?? [];
  const alertas = metricas.alertas ?? [];
  const inadimplencia = metricas.inadimplencia ?? { vencidas5dias: 0, vencidas15dias: 0, vencidas30dias: 0, valorTotalInadimplente: 0 };

  const statCards = [
    { label: 'Empresas Ativas', value: `${metricas.empresasAtivas} / ${metricas.totalEmpresas}`, icon: Building2, color: 'text-blue-600', bg: 'bg-blue-50' },
    { 
      label: 'Usuários', 
      value: metricas.totalUsuarios, 
      subtext: `${usuariosAtivos7dias} ativos (${taxaAtivacao.toFixed(1)}%) nos últimos 7d`,
      icon: Users, color: 'text-purple-600', bg: 'bg-purple-50' 
    },
    { label: 'Obras Ativas', value: metricas.totalObras, icon: HardHat, color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: 'Total RDOs', value: metricas.totalRdos, icon: FileSpreadsheet, color: 'text-gray-600', bg: 'bg-gray-50' },
    { 
      label: 'Receita Mensal', 
      value: `R$ ${metricas.receitaMensal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 
      badge: {
        value: Math.abs(variacaoReceita),
        isPositive: variacaoReceita >= 0
      },
      icon: DollarSign, color: 'text-green-600', bg: 'bg-green-50' 
    },
  ];

  const getAlertIcon = (gravidade: string) => {
    if (gravidade === 'ALTA') return <AlertCircle className="text-red-500" size={20} />;
    if (gravidade === 'MEDIA') return <AlertTriangle className="text-yellow-500" size={20} />;
    return <Info className="text-blue-500" size={20} />;
  };

  const getAlertBg = (gravidade: string) => {
    if (gravidade === 'ALTA') return 'bg-red-50 border-red-200 hover:bg-red-100/50';
    if (gravidade === 'MEDIA') return 'bg-yellow-50 border-yellow-200 hover:bg-yellow-100/50';
    return 'bg-blue-50 border-blue-200 hover:bg-blue-100/50';
  };

  const rdosVariacao = rdosSemanaAnterior > 0 
    ? ((rdosSemana - rdosSemanaAnterior) / rdosSemanaAnterior) * 100 
    : (rdosSemana > 0 ? 100 : 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Visão Geral</h1>
        <p className="text-gray-500 text-sm mt-1">Bem-vindo ao centro de controle da plataforma Obra 10.</p>
      </div>

      {/* Seção 2: Alertas Operacionais */}
      {alertas.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <AlertTriangle className="text-red-600" size={20}/> Alertas Operacionais
          </h2>
          <div className="grid grid-cols-1 gap-2">
            {alertas.map((alerta, idx) => (
              <div 
                key={idx} 
                onClick={() => {
                  if (alerta.empresaId) navigate(`/admin/empresas/${alerta.empresaId}`);
                  else if (alerta.cupomId) navigate('/admin/cupons');
                  else if (alerta.tipo === 'INADIMPLENCIA') navigate('/admin/empresas');
                }}
                className={`flex items-start md:items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${getAlertBg(alerta.gravidade)}`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 md:mt-0">{getAlertIcon(alerta.gravidade)}</div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{alerta.mensagem}</p>
                  </div>
                </div>
                <div className="hidden md:flex flex-shrink-0">
                   <ExternalLink size={16} className="text-gray-400" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Seção 1: Grid de Estatísticas Gerais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {statCards.map((stat, idx) => (
          <div key={idx} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 pl-4 relative overflow-hidden group">
            <div className={`absolute top-0 left-0 w-1 h-full rounded-l-xl ${stat.bg.replace('bg-', 'bg-').replace('-50', '-500')}`} />
            <div className="flex justify-between">
              <div className="w-full">
                <p className="text-sm font-medium text-gray-500 mb-1">{stat.label}</p>
                <div className="flex items-center justify-between w-full">
                  <h3 className="text-2xl font-bold text-gray-900">{stat.value}</h3>
                  <div className={`p-2 rounded-lg ${stat.bg}`}>
                    <stat.icon className={`w-5 h-5 ${stat.color}`} />
                  </div>
                </div>
                {stat.badge && (
                  <div className={`flex items-center gap-1 mt-1 text-xs font-semibold ${stat.badge.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                    {stat.badge.isPositive ? <TrendingUp size={14}/> : <TrendingDown size={14}/>}
                    {stat.badge.isPositive ? '↑' : '↓'} {stat.badge.value.toFixed(1)}% vs último mês
                  </div>
                )}
                {stat.subtext && (
                  <p className="text-xs text-gray-500 mt-1">{stat.subtext}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Seção 3: Receita e Engajamento */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Lado Esquerdo: Receita */}
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex flex-col gap-6">
          <div className="flex items-center border-b pb-4">
            <div className="w-12 h-12 bg-green-50 text-green-600 rounded-full flex items-center justify-center mr-4">
              <DollarSign size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Ticket Médio (Mensal)</p>
              <h2 className="text-3xl font-bold text-gray-900">R$ {ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}<span className="text-sm font-normal text-gray-500 ml-1">/ empresa ativa</span></h2>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wider">Receita por Módulo (Estimada)</h3>
            <div className="space-y-3">
              {receitaPorModulo.slice(0, 4).map(mod => (
                <div key={mod.codigo} className="flex justify-between items-center bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-gray-900">{mod.nome}</span>
                    <span className="text-xs text-gray-500">{mod.totalEmpresas} empresas ativas</span>
                  </div>
                  <span className="text-sm font-bold text-green-700">R$ {mod.receita.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
             <h3 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wider">Inadimplência</h3>
             <div className="grid grid-cols-3 gap-2">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-center">
                  <p className="text-xs font-semibold text-yellow-800 mb-1">5+ Dias</p>
                  <p className="text-xl font-bold text-yellow-600">{inadimplencia.vencidas5dias}</p>
                </div>
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-center">
                  <p className="text-xs font-semibold text-orange-800 mb-1">15+ Dias</p>
                  <p className="text-xl font-bold text-orange-600">{inadimplencia.vencidas15dias}</p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                  <p className="text-xs font-semibold text-red-800 mb-1">30+ Dias</p>
                  <p className="text-xl font-bold text-red-600">{inadimplencia.vencidas30dias}</p>
                </div>
             </div>
             {inadimplencia.valorTotalInadimplente > 0 && (
               <p className="text-xs text-center text-red-600 font-semibold mt-2">Valor Total Inadimplente: R$ {inadimplencia.valorTotalInadimplente.toLocaleString('pt-BR', { minimumFractionDigits:2 })}</p>
             )}
          </div>
        </div>

        {/* Lado Direito: Engajamento */}
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex flex-col gap-6">
          <div className="flex items-center border-b pb-4 justify-between">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mr-4">
                <Activity size={24} />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Engajamento Semanal (RDOs)</p>
                <div className="flex items-end gap-2">
                   <h2 className="text-3xl font-bold text-gray-900">{rdosSemana}</h2>
                   <span className={`flex items-center mb-1 text-sm font-bold ${rdosVariacao >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                     {rdosVariacao >= 0 ? <TrendingUp size={16} className="mr-1"/> : <TrendingDown size={16} className="mr-1"/>}
                     {Math.abs(rdosVariacao).toFixed(0)}% vs semana ant.
                   </span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold text-gray-500">MÉDIA GLOBAL</p>
              <h3 className="text-xl font-bold text-gray-900">{mediaRdosPorObra.toFixed(1)} <span className="text-sm font-normal text-gray-500">/ obra</span></h3>
            </div>
          </div>

          <div>
             <h3 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wider">Top 5 Empresas por Volume do RDO</h3>
             <div className="space-y-2">
                {topEmpresasUso.map((emp, i) => (
                  <div key={i} className="flex justify-between items-center hover:bg-gray-50 p-2 rounded transition-colors border-b border-gray-50 last:border-0">
                    <div className="flex items-center gap-3">
                      <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${i === 0 ? 'bg-yellow-100 text-yellow-700' : i === 1 ? 'bg-gray-200 text-gray-700' : i === 2 ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-600'}`}>{i+1}º</span>
                      <div>
                        <p className="text-sm font-bold text-gray-900">{emp.nome}</p>
                        <p className="text-[10px] text-gray-500 uppercase">Último: {emp.ultimoRdo ? format(new Date(emp.ultimoRdo), 'dd/MM/yyyy') : 'N/A'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-lunardeli-red">{emp.totalRdos}</span>
                      <span className="text-xs text-gray-500 ml-1">RDOs</span>
                    </div>
                  </div>
                ))}
             </div>
          </div>
        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gráfico de Módulos */}
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm lg:col-span-1">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Adoção de Módulos</h2>
          <div className="space-y-4">
            {metricas.modulosMaisContratados.map((m) => {
              const perc = Math.max(0, Math.min(100, Math.round((m.total / (metricas.totalEmpresas || 1)) * 100)));
              return (
                <div key={m.codigo}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-semibold text-gray-700">{m.nome}</span>
                    <span className="text-gray-500">{m.total} ativ.</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2.5">
                    <div className="bg-red-600 h-2.5 rounded-full" style={{ width: `${perc}%` }}></div>
                  </div>
                </div>
              );
            })}
            {metricas.modulosMaisContratados.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">Nenhum módulo ativado.</p>
            )}
          </div>
        </div>

        {/* Empresas recentes */}
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm lg:col-span-2 overflow-hidden">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Construtoras Recentes</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Empresa</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Plano</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data Cadastro</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {metricas.empresasRecentes.map(emp => (
                  <tr key={emp.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/admin/empresas/${emp.id}`)}>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{emp.nomeFantasia || emp.razaoSocial}</div>
                      <div className="text-xs text-gray-500 uppercase">{emp.id.substring(0, 8)}...</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                        {emp.plano}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {format(new Date(emp.createdAt), "dd 'de' MMM, yyyy", { locale: ptBR })}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-center">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${emp.ativo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {emp.ativo ? 'Ativa' : 'Bloqueada'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
