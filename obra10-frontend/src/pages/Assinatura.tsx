import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CreditCard,
  ShieldCheck,
  Clock,
  Users,
  Package,
  Building2,
  Loader2,
  Filter,
  CheckCircle,
  QrCode,
} from 'lucide-react';
import api from '../services/api';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  labelPlano,
  PLANOS,
  PLANO_KEYS,
  pacoteDoPlano,
  precoModuloPorPacote,
  resolvePlano,
  resumoPlano,
} from '../utils/pacotesObras';
import type { PlanoNome } from '../utils/pacotesObras';

const money = (v: number) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface ModuloCatalogo {
  slug: string;
  nome: string;
  descricao?: string;
  preco: number;
  precoAnual?: number;
  precoBasico?: number;
  precoAnualBasico?: number;
  precoEnterprise?: number;
  precoAnualEnterprise?: number;
}

export const Assinatura: React.FC = () => {
  const navigate = useNavigate();
  const [dados, setDados] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [planoSelecionado, setPlanoSelecionado] = useState<PlanoNome>('PRO');
  const [modulosCatalogo, setModulosCatalogo] = useState<ModuloCatalogo[]>([]);
  const [modulosSelecionados, setModulosSelecionados] = useState<string[]>([]);
  const [periodicidade, setPeriodicidade] = useState<'MENSAL' | 'ANUAL'>('MENSAL');
  const [formaPagamento, setFormaPagamento] = useState<'PIX' | 'CARTAO'>('PIX');
  const [upgradeError, setUpgradeError] = useState('');

  const [cobrancas, setCobrancas] = useState<any[]>([]);
  const [loadingCobrancas, setLoadingCobrancas] = useState(false);
  const [filtroInicio, setFiltroInicio] = useState('');
  const [filtroFim, setFiltroFim] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');

  const [loadingModuloSlug, setLoadingModuloSlug] = useState<string | null>(null);

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    try {
      const response = await api.get('/tenants/meu-plano');
      setDados(response.data);
      setPlanoSelecionado(resolvePlano(response.data.plano));
      setCobrancas(response.data.historicoCobrancas || []);
    } catch (err) {
      console.error(err);
      alert('Erro ao carregar dados do plano.');
    } finally {
      setLoading(false);
    }
  };

  const handleDesativarModulo = async (slug: string, nome: string) => {
    if (
      !window.confirm(
        `Desativar o módulo "${nome}"?\n\nEle deixa de aparecer como ativo e não entra nas próximas cobranças.`,
      )
    ) {
      return;
    }
    setLoadingModuloSlug(slug);
    try {
      await api.delete(`/tenants/meu-plano/modulos/${slug}`);
      await carregarDados();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Erro ao desativar módulo.');
    } finally {
      setLoadingModuloSlug(null);
    }
  };

  const abrirModalAlterar = async () => {
    setUpgradeError('');
    setPlanoSelecionado(resolvePlano(dados?.plano));
    setPeriodicidade('MENSAL');
    setFormaPagamento('PIX');
    const ativos = (dados?.modulos || [])
      .filter((m: any) => m.ativo)
      .map((m: any) => m.slug as string);
    setModulosSelecionados(ativos);
    setShowUpgradeModal(true);
    try {
      const res = await api.get('/modulos');
      const filtered = (res.data as ModuloCatalogo[]).filter(
        (m) => m.slug !== 'IA' && m.slug !== 'CONCRETO',
      );
      setModulosCatalogo(filtered);
    } catch {
      setUpgradeError('Não foi possível carregar os módulos.');
    }
  };

  const carregarCobrancas = async (override?: {
    inicio?: string;
    fim?: string;
    status?: string;
  }) => {
    setLoadingCobrancas(true);
    try {
      const params: Record<string, string> = {};
      const inicio = override?.inicio ?? filtroInicio;
      const fim = override?.fim ?? filtroFim;
      const status = override?.status ?? filtroStatus;
      if (inicio) params.inicio = inicio;
      if (fim) params.fim = fim;
      if (status) params.status = status;
      const res = await api.get('/tenants/meu-plano/cobrancas', { params });
      setCobrancas(res.data.items || []);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Erro ao carregar histórico de cobranças.');
    } finally {
      setLoadingCobrancas(false);
    }
  };

  const handleAplicarCupomCobranca = async (cobrancaId: string, codigo: string) => {
    try {
      const res = await api.post(`/cobrancas/${cobrancaId}/aplicar-cupom`, { codigo });
      alert(res.data.mensagem);
      carregarDados();
      carregarCobrancas();
    } catch (err: any) {
      alert('Erro ao aplicar cupom: ' + (err.response?.data?.message || err.message));
    }
  };

  const slugsAtivos = new Set(
    (dados?.modulos || []).filter((m: any) => m.ativo).map((m: any) => m.slug),
  );
  const modulosNovos = modulosSelecionados.filter((s) => !slugsAtivos.has(s));
  const pacoteSelecionado = pacoteDoPlano(planoSelecionado);
  const totalNovos = modulosCatalogo
    .filter((m) => modulosNovos.includes(m.slug))
    .reduce(
      (sum, m) => sum + precoModuloPorPacote(m, pacoteSelecionado, periodicidade),
      0,
    );

  const toggleModulo = (slug: string) => {
    // Módulos já ativos ficam travados (não desativa por aqui)
    if (slugsAtivos.has(slug)) return;
    setModulosSelecionados((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );
  };

  const handleUpgrade = async () => {
    const mudouPlano = planoSelecionado !== dados?.plano;
    if (!mudouPlano && modulosNovos.length === 0) {
      setUpgradeError('Selecione outro plano ou adicione pelo menos um módulo novo.');
      return;
    }

    setUpgrading(true);
    setUpgradeError('');
    try {
      if (mudouPlano) {
        await api.post('/tenants/meu-plano/upgrade', { plano: planoSelecionado });
      }

      if (modulosNovos.length > 0) {
        const res = await api.post('/cobrancas/contratar', {
          modulosSelecionados: modulosNovos,
          formaPagamento,
          periodicidade,
          pacoteObras: pacoteSelecionado,
        });

        if (res.data.status === 'PAGO' || res.data.valor === 0) {
          alert('Plano/módulos atualizados com sucesso!');
          setShowUpgradeModal(false);
          carregarDados();
          return;
        }

        setShowUpgradeModal(false);
        navigate(`/aguardando-pagamento/${res.data.cobrancaId}`, {
          state: {
            qrCode: res.data.qrCode,
            qrCodeBase64: res.data.qrCodeBase64,
            linkPagamento: res.data.linkPagamento,
            valor: res.data.valor,
            method: formaPagamento === 'CARTAO' ? 'paypal' : 'pix',
          },
        });
        return;
      }

      alert('Plano atualizado com sucesso!');
      setShowUpgradeModal(false);
      carregarDados();
    } catch (e: any) {
      setUpgradeError(
        e?.response?.data?.message || 'Erro ao atualizar plano/módulos.',
      );
    } finally {
      setUpgrading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-10 flex justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600" />
      </div>
    );
  }

  const planoAtual = resolvePlano(dados?.plano);
  const temMensal = Number(dados?.valorMensal || 0) > 0;
  const temAnual = Number(dados?.valorAnual || 0) > 0;
  const usuariosIlimitados =
    planoAtual === 'ENTERPRISE' || Number(dados?.limiteUsuarios) >= 999999;

  return (
    <div className="min-h-screen bg-lunardeli-gray p-6">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center text-gray-500 hover:text-red-600 mb-6 font-semibold"
        >
          <ArrowLeft size={20} className="mr-2" /> Voltar ao Painel
        </button>

        <h1 className="text-3xl font-bold text-lunardeli-dark flex items-center mb-8">
          <CreditCard className="mr-3 text-red-600" size={32} /> Meu Plano e Contrato
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-8">
          <div className="flex flex-col items-start">
            <h2 className="text-lg font-semibold text-gray-500 mb-1">Seu Plano Atual</h2>
            <p className="text-4xl font-extrabold text-gray-800">{labelPlano(planoAtual)}</p>
            <p className="text-sm text-gray-500 mt-1">{resumoPlano(planoAtual)}</p>

            <div className="mt-4 bg-red-50 border border-red-100 rounded-xl px-4 py-3 w-full">
              <p className="text-xs font-bold uppercase tracking-wide text-red-700 mb-1">
                Valor do plano
              </p>
              <p className="text-2xl font-extrabold text-lunardeli-dark">
                {money(dados?.valorPlano || 0)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {temMensal && temAnual
                  ? `${money(dados.valorMensal)}/mês + ${money(dados.valorAnual)}/ano (módulos ativos)`
                  : temAnual
                    ? 'Total anual dos módulos ativos (com pacote de obras)'
                    : 'Total mensal dos módulos ativos (com pacote de obras)'}
              </p>
            </div>

            <div className="flex items-center mt-3 text-sm text-gray-600 bg-gray-50 p-2 rounded w-max border mb-4">
              <ShieldCheck size={16} className="text-green-500 mr-2" /> Status:{' '}
              <span className="font-bold ml-1">{dados?.ativo ? 'Ativo' : 'Inativo'}</span>{' '}
              {dados?.suspensa && (
                <span className="text-red-500 font-bold ml-1">(Suspenso)</span>
              )}
            </div>
            <button
              onClick={abrirModalAlterar}
              className="px-4 py-2 bg-lunardeli-red text-white font-bold rounded-lg hover:bg-red-700 transition-colors"
            >
              Alterar Plano
            </button>
          </div>
          <div className="flex flex-col justify-center space-y-4">
            <div className="flex items-center text-gray-700">
              <Building2 className="text-gray-400 mr-3" size={20} />
              <span>
                Limite de obras:{' '}
                <strong>
                  {dados?.limiteObras == null ? 'Ilimitado' : `até ${dados.limiteObras}`}
                </strong>
              </span>
            </div>
            <div className="flex items-center text-gray-700">
              <Users className="text-gray-400 mr-3" size={20} />
              <span>
                Limite de Usuários:{' '}
                <strong>
                  {usuariosIlimitados
                    ? `${dados?.usuariosAtivos} / Ilimitado`
                    : `${dados?.usuariosAtivos} / ${dados?.limiteUsuarios}`}
                </strong>
              </span>
            </div>
            <div className="flex items-center text-gray-700">
              <Clock className="text-gray-400 mr-3" size={20} />
              <span>
                Cliente desde:{' '}
                <strong>{format(new Date(dados?.createdAt), 'dd/MM/yyyy')}</strong>
              </span>
            </div>
          </div>
        </div>

        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
          <Package className="mr-2" size={24} /> Módulos Contratados
        </h2>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-8">
          {dados?.modulos?.length === 0 ? (
            <div className="p-6 text-gray-500 text-center">Nenhum módulo ativo.</div>
          ) : (
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-sm font-semibold text-gray-600">Módulo</th>
                  <th className="px-6 py-3 text-sm font-semibold text-gray-600">Valor</th>
                  <th className="px-6 py-3 text-sm font-semibold text-gray-600">Status</th>
                  <th className="px-6 py-3 text-sm font-semibold text-gray-600">Vencimento</th>
                  <th className="px-6 py-3 text-sm font-semibold text-gray-600">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {dados?.modulos?.map((m: any) => (
                  <tr key={m.slug} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-800">
                      {m.nome}{' '}
                      <span className="text-xs text-gray-400 ml-2 border rounded px-1">
                        {m.slug}
                      </span>
                      {m.disponivelNoCatalogo === false && (
                        <span className="ml-2 text-[10px] font-bold uppercase text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                          Indisponível — sem cobrança
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-gray-800">
                      {m.ativo && m.disponivelNoCatalogo !== false ? (
                        <>
                          {money(m.valor)}
                          <span className="text-xs font-normal text-gray-400 ml-1">
                            /{m.periodicidade === 'ANUAL' ? 'ano' : 'mês'}
                          </span>
                        </>
                      ) : (
                        <span className="text-gray-400 font-normal">R$ 0,00</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {m.ativo ? (
                        <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold">
                          Ativo
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-bold">
                          Inativo
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-600 text-sm">
                      {m.expiresAt
                        ? format(new Date(m.expiresAt), 'dd/MM/yyyy')
                        : 'Renovação Mensal'}
                    </td>
                    <td className="px-6 py-4">
                      {m.ativo ? (
                        <button
                          type="button"
                          onClick={() => handleDesativarModulo(m.slug, m.nome)}
                          disabled={loadingModuloSlug === m.slug}
                          className="text-xs font-bold text-red-600 border border-red-200 hover:bg-red-50 px-2.5 py-1.5 rounded-lg disabled:opacity-50"
                        >
                          {loadingModuloSlug === m.slug ? (
                            <Loader2 size={12} className="animate-spin inline" />
                          ) : (
                            'Desativar'
                          )}
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4">
          <h2 className="text-xl font-bold text-gray-800">Histórico de Cobranças</h2>
          <p className="text-xs text-gray-500">{cobrancas.length} registro(s)</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
            <div className="flex-1">
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                De (referência)
              </label>
              <input
                type="month"
                value={filtroInicio}
                onChange={(e) => setFiltroInicio(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                Até (referência)
              </label>
              <input
                type="month"
                value={filtroFim}
                onChange={(e) => setFiltroFim(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                Status
              </label>
              <select
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
              >
                <option value="">Todos</option>
                <option value="PAGO">Pago</option>
                <option value="PENDENTE">Pendente</option>
                <option value="VENCIDO">Vencido</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => carregarCobrancas()}
                disabled={loadingCobrancas}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-bold rounded-lg hover:bg-gray-800 disabled:opacity-50"
              >
                {loadingCobrancas ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Filter size={16} />
                )}
                Filtrar
              </button>
              <button
                type="button"
                onClick={() => {
                  setFiltroInicio('');
                  setFiltroFim('');
                  setFiltroStatus('');
                  carregarCobrancas({ inicio: '', fim: '', status: '' });
                }}
                disabled={loadingCobrancas}
                className="px-4 py-2 border border-gray-200 text-sm font-semibold rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                Limpar
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {loadingCobrancas ? (
            <div className="p-8 flex justify-center text-gray-400">
              <Loader2 className="animate-spin" size={28} />
            </div>
          ) : cobrancas.length === 0 ? (
            <div className="p-6 text-gray-500 text-center">
              Nenhuma cobrança encontrada para o filtro selecionado.
            </div>
          ) : (
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-sm font-semibold text-gray-600">Referência</th>
                  <th className="px-6 py-3 text-sm font-semibold text-gray-600">Valor</th>
                  <th className="px-6 py-3 text-sm font-semibold text-gray-600">Vencimento</th>
                  <th className="px-6 py-3 text-sm font-semibold text-gray-600">Pagamento</th>
                  <th className="px-6 py-3 text-sm font-semibold text-gray-600">Status</th>
                  <th className="px-6 py-3 text-sm font-semibold text-gray-600">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {cobrancas.map((c: any) => (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-gray-700 capitalize">
                      {format(new Date(c.mesReferencia), 'MMMM / yyyy', { locale: ptBR })}
                    </td>
                    <td className="px-6 py-4 font-semibold">{money(c.valor)}</td>
                    <td className="px-6 py-4 text-gray-600">
                      {format(new Date(c.dataVencimento), 'dd/MM/yyyy')}
                    </td>
                    <td className="px-6 py-4 text-gray-600 text-sm">
                      {c.dataPagamento
                        ? format(new Date(c.dataPagamento), 'dd/MM/yyyy')
                        : '—'}
                      {c.formaPagamento && (
                        <span
                          className={`block text-[10px] font-bold uppercase mt-0.5 ${
                            c.formaPagamento === 'BONIFICACAO'
                              ? 'text-purple-600'
                              : 'text-gray-400'
                          }`}
                        >
                          {c.formaPagamento === 'BONIFICACAO'
                            ? 'Bonificação'
                            : c.formaPagamento}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-bold ${
                          c.status === 'PAGO'
                            ? 'bg-green-100 text-green-700'
                            : c.status === 'VENCIDO'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-yellow-100 text-yellow-700'
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm flex items-center gap-2 flex-wrap">
                      {c.status !== 'PAGO' ? (
                        <>
                          <button
                            onClick={() =>
                              navigate(`/aguardando-pagamento/${c.id}`, { state: c })
                            }
                            className="px-3 py-1.5 bg-green-600 text-white rounded-lg font-bold text-xs hover:bg-green-700 transition-colors shadow-sm"
                          >
                            Pagar
                          </button>
                          <button
                            onClick={() => {
                              const cupom = prompt('Digite o código do cupom de desconto:');
                              if (cupom) handleAplicarCupomCobranca(c.id, cupom);
                            }}
                            className="px-3 py-1.5 bg-gray-900 text-white rounded-lg font-bold text-xs hover:bg-gray-800 transition-colors shadow-sm"
                          >
                            Aplicar Cupom
                          </button>
                        </>
                      ) : c.notaPdfUrl ? (
                        <a
                          href={c.notaPdfUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded-lg font-bold text-xs hover:bg-red-100"
                        >
                          Nota fiscal
                        </a>
                      ) : (
                        <span className="text-gray-400 text-xs">
                          {c.statusNota ? `NF: ${c.statusNota}` : 'Sem ações'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showUpgradeModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-2xl font-black mb-2 text-lunardeli-dark">
              Alterar plano e módulos
            </h3>
            <p className="text-gray-500 mb-5 text-sm">
              Escolha o plano (número de obras) e, se quiser, adicione novos módulos.
            </p>

            <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">
              Plano
            </p>
            <div className="space-y-3 mb-6">
              {PLANO_KEYS.map((opt) => {
                const info = PLANOS[opt];
                return (
                  <div
                    key={opt}
                    onClick={() => setPlanoSelecionado(opt)}
                    className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${
                      planoSelecionado === opt
                        ? 'border-red-600 bg-red-50'
                        : 'border-gray-200 hover:border-red-300'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="font-bold text-lg text-gray-800">{info.label}</h4>
                        <p className="text-sm text-gray-500 mt-1">{resumoPlano(opt)}</p>
                      </div>
                      <div
                        className={`h-6 w-6 rounded-full border-2 flex items-center justify-center ${
                          planoSelecionado === opt ? 'border-red-600' : 'border-gray-300'
                        }`}
                      >
                        {planoSelecionado === opt && (
                          <div className="h-3 w-3 rounded-full bg-red-600" />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">
              Módulos
            </p>
            <p className="text-xs text-gray-400 mb-3">
              Módulos já ativos aparecem marcados e não podem ser desativados aqui. Marque
              novos para contratar.
            </p>
            <div className="space-y-2 mb-5 max-h-56 overflow-y-auto border border-gray-100 rounded-xl p-2">
              {modulosCatalogo.length === 0 ? (
                <p className="text-sm text-gray-400 p-3 text-center">Carregando módulos...</p>
              ) : (
                modulosCatalogo.map((m) => {
                  const ativo = slugsAtivos.has(m.slug);
                  const selected = modulosSelecionados.includes(m.slug);
                  const preco = precoModuloPorPacote(m, pacoteSelecionado, periodicidade);
                  return (
                    <button
                      key={m.slug}
                      type="button"
                      onClick={() => toggleModulo(m.slug)}
                      disabled={ativo}
                      className={`w-full text-left p-3 rounded-lg border flex items-center justify-between gap-3 transition-colors ${
                        selected
                          ? 'border-red-500 bg-red-50'
                          : 'border-gray-200 hover:border-gray-300'
                      } ${ativo ? 'opacity-80 cursor-default' : ''}`}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div
                          className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${
                            selected
                              ? 'border-red-500 bg-red-500'
                              : 'border-gray-300'
                          }`}
                        >
                          {selected && <CheckCircle size={12} className="text-white" />}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 text-sm">{m.nome}</p>
                          {ativo && (
                            <span className="text-[10px] font-bold uppercase text-green-700">
                              Já contratado
                            </span>
                          )}
                          {m.descricao && (
                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                              {m.descricao}
                            </p>
                          )}
                        </div>
                      </div>
                      <p className="text-sm font-bold text-gray-800 shrink-0">
                        {money(preco)}
                        <span className="text-[10px] font-normal text-gray-400">
                          /{periodicidade === 'ANUAL' ? 'ano' : 'mês'}
                        </span>
                      </p>
                    </button>
                  );
                })
              )}
            </div>

            {modulosNovos.length > 0 && (
              <>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setPeriodicidade('MENSAL')}
                    className={`py-2.5 rounded-lg text-sm font-bold ${
                      periodicidade === 'MENSAL'
                        ? 'bg-red-600 text-white'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    Mensal
                  </button>
                  <button
                    type="button"
                    onClick={() => setPeriodicidade('ANUAL')}
                    className={`py-2.5 rounded-lg text-sm font-bold ${
                      periodicidade === 'ANUAL'
                        ? 'bg-red-600 text-white'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    Anual
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setFormaPagamento('PIX')}
                    className={`py-2.5 rounded-lg border-2 text-sm font-semibold ${
                      formaPagamento === 'PIX'
                        ? 'border-red-500 bg-red-50 text-red-700'
                        : 'border-gray-200 text-gray-500'
                    }`}
                  >
                    PIX
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormaPagamento('CARTAO')}
                    className={`py-2.5 rounded-lg border-2 text-sm font-semibold ${
                      formaPagamento === 'CARTAO'
                        ? 'border-red-500 bg-red-50 text-red-700'
                        : 'border-gray-200 text-gray-500'
                    }`}
                  >
                    Cartão
                  </button>
                </div>
                <div className="mb-4 flex justify-between items-center bg-gray-50 rounded-lg px-4 py-3">
                  <span className="text-sm text-gray-600">
                    Novos módulos ({modulosNovos.length})
                  </span>
                  <span className="text-lg font-extrabold text-gray-900">
                    {money(totalNovos)}
                  </span>
                </div>
              </>
            )}

            {upgradeError && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg border-l-4 border-red-500">
                {upgradeError}
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowUpgradeModal(false)}
                className="px-4 py-2 font-bold text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={handleUpgrade}
                disabled={
                  upgrading ||
                  (planoSelecionado === dados?.plano && modulosNovos.length === 0)
                }
                className="px-6 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {upgrading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Salvando...
                  </>
                ) : modulosNovos.length > 0 ? (
                  <>
                    {formaPagamento === 'PIX' ? <QrCode size={16} /> : <CreditCard size={16} />}
                    Confirmar e cobrar
                  </>
                ) : (
                  'Confirmar plano'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
