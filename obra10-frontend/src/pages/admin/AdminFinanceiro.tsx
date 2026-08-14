import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Loader2,
  Plus,
  Trash2,
  Wallet,
  Gift,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import api from '../../services/api';

type Tab = 'resumo' | 'recebimentos' | 'fluxo' | 'projecao' | 'despesas';

const money = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    PAGO: 'bg-green-50 text-green-700 border-green-200',
    PENDENTE: 'bg-amber-50 text-amber-700 border-amber-200',
    VENCIDO: 'bg-red-50 text-red-700 border-red-200',
    OVERDUE: 'bg-red-50 text-red-700 border-red-200',
  };
  return map[status] || 'bg-gray-50 text-gray-600 border-gray-200';
};

export const AdminFinanceiro: React.FC = () => {
  const [tab, setTab] = useState<Tab>('resumo');
  const [loading, setLoading] = useState(true);
  const [resumo, setResumo] = useState<any>(null);
  const [recebimentos, setRecebimentos] = useState<any>(null);
  const [fluxo, setFluxo] = useState<any>(null);
  const [projecao, setProjecao] = useState<any>(null);
  const [despesas, setDespesas] = useState<any[]>([]);
  const [statusFiltro, setStatusFiltro] = useState('');
  const [horizonte, setHorizonte] = useState(90);
  const [showDespesa, setShowDespesa] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    descricao: '',
    valor: '',
    data: new Date().toISOString().slice(0, 10),
    categoria: 'outro',
    recorrente: false,
    observacao: '',
  });

  const loadResumo = useCallback(async () => {
    const res = await api.get('/admin/financeiro/resumo');
    setResumo(res.data);
  }, []);

  const loadRecebimentos = useCallback(async () => {
    const params: any = { page: 1, pageSize: 50 };
    if (statusFiltro) params.status = statusFiltro;
    const res = await api.get('/admin/financeiro/recebimentos', { params });
    setRecebimentos(res.data);
  }, [statusFiltro]);

  const loadFluxo = useCallback(async () => {
    const res = await api.get('/admin/financeiro/fluxo-caixa', {
      params: { granularidade: 'mes' },
    });
    setFluxo(res.data);
  }, []);

  const loadProjecao = useCallback(async () => {
    const res = await api.get('/admin/financeiro/projecao', {
      params: { dias: horizonte },
    });
    setProjecao(res.data);
  }, [horizonte]);

  const loadDespesas = useCallback(async () => {
    const res = await api.get('/admin/financeiro/despesas');
    setDespesas(res.data);
  }, []);

  useEffect(() => {
    setLoading(true);
    const load = async () => {
      try {
        if (tab === 'resumo') await loadResumo();
        if (tab === 'recebimentos') await loadRecebimentos();
        if (tab === 'fluxo') await loadFluxo();
        if (tab === 'projecao') await loadProjecao();
        if (tab === 'despesas') await loadDespesas();
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [tab, loadResumo, loadRecebimentos, loadFluxo, loadProjecao, loadDespesas]);

  const handleCriarDespesa = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/admin/financeiro/despesas', {
        descricao: form.descricao,
        valor: Number(form.valor),
        data: form.data,
        categoria: form.categoria,
        recorrente: form.recorrente,
        observacao: form.observacao || undefined,
      });
      setShowDespesa(false);
      setForm({
        descricao: '',
        valor: '',
        data: new Date().toISOString().slice(0, 10),
        categoria: 'outro',
        recorrente: false,
        observacao: '',
      });
      await loadDespesas();
      if (tab === 'resumo') await loadResumo();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Erro ao criar despesa');
    } finally {
      setSaving(false);
    }
  };

  const handleExcluirDespesa = async (id: string) => {
    if (!window.confirm('Excluir esta despesa?')) return;
    try {
      await api.delete(`/admin/financeiro/despesas/${id}`);
      await loadDespesas();
    } catch {
      alert('Erro ao excluir despesa');
    }
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'resumo', label: 'Resumo' },
    { id: 'recebimentos', label: 'Recebimentos' },
    { id: 'fluxo', label: 'Fluxo de caixa' },
    { id: 'projecao', label: 'Projeção' },
    { id: 'despesas', label: 'Despesas' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">
            Financeiro
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Recebimentos, fluxo de caixa e projeção da plataforma
          </p>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors ${
              tab === t.id
                ? 'bg-red-600 text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <Loader2 className="animate-spin mr-2" size={22} />
          Carregando...
        </div>
      ) : (
        <>
          {tab === 'resumo' && resumo && (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {[
                {
                  label: 'Recebido no período',
                  value: money(resumo.recebido),
                  sub: `${resumo.recebidoCount} cobranças`,
                  icon: TrendingUp,
                  color: 'text-green-600 bg-green-50',
                },
                {
                  label: 'Bonificado no período',
                  value: money(resumo.bonificado || 0),
                  sub: `${resumo.bonificadoCount || 0} cortesia(s)`,
                  icon: Gift,
                  color: 'text-purple-600 bg-purple-50',
                },
                {
                  label: 'A receber',
                  value: money(resumo.aReceber),
                  sub: `${resumo.aReceberCount} pendentes`,
                  icon: DollarSign,
                  color: 'text-amber-600 bg-amber-50',
                },
                {
                  label: 'Vencido',
                  value: money(resumo.vencido),
                  sub: `${resumo.vencidoCount} cobranças`,
                  icon: AlertTriangle,
                  color: 'text-red-600 bg-red-50',
                },
                {
                  label: 'Saídas no período',
                  value: money(resumo.saidas),
                  sub: `${resumo.saidasCount} despesas`,
                  icon: TrendingDown,
                  color: 'text-gray-700 bg-gray-100',
                },
                {
                  label: 'Saldo líquido',
                  value: money(resumo.saldoLiquido),
                  sub: 'recebido − saídas (sem bonificações)',
                  icon: Wallet,
                  color:
                    resumo.saldoLiquido >= 0
                      ? 'text-green-700 bg-green-50'
                      : 'text-red-700 bg-red-50',
                },
              ].map((card) => (
                <div
                  key={card.label}
                  className="bg-white border border-gray-200 rounded-xl p-4"
                >
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${card.color}`}
                  >
                    <card.icon size={18} />
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    {card.label}
                  </p>
                  <p className="text-xl font-extrabold text-gray-900 mt-1">
                    {card.value}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">{card.sub}</p>
                </div>
              ))}
            </div>
          )}

          {tab === 'recebimentos' && recebimentos && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-3 items-center">
                <select
                  value={statusFiltro}
                  onChange={(e) => setStatusFiltro(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                >
                  <option value="">Todos os status</option>
                  <option value="PENDENTE">Pendente</option>
                  <option value="VENCIDO">Vencido</option>
                  <option value="PAGO">Pago</option>
                </select>
                <div className="text-xs text-gray-500 flex flex-wrap gap-3">
                  <span>Aging em dia: {money(recebimentos.aging?.em_dia || 0)}</span>
                  <span>1–7d: {money(recebimentos.aging?.['1_7'] || 0)}</span>
                  <span>8–30d: {money(recebimentos.aging?.['8_30'] || 0)}</span>
                  <span>30+: {money(recebimentos.aging?.['30_mais'] || 0)}</span>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                      <tr>
                        <th className="px-4 py-3">Empresa</th>
                        <th className="px-4 py-3">Referência</th>
                        <th className="px-4 py-3">Valor</th>
                        <th className="px-4 py-3">Vencimento</th>
                        <th className="px-4 py-3">Pagamento</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Forma</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {recebimentos.items?.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                            Nenhuma cobrança encontrada
                          </td>
                        </tr>
                      )}
                      {recebimentos.items?.map((item: any) => (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <Link
                              to={`/admin/empresas/${item.empresaId}`}
                              className="font-semibold text-red-600 hover:underline"
                            >
                              {item.empresaNome}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {format(new Date(item.mesReferencia), 'MMM/yyyy', {
                              locale: ptBR,
                            })}
                          </td>
                          <td className="px-4 py-3 font-semibold">
                            {money(item.valor)}
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {format(new Date(item.dataVencimento), 'dd/MM/yyyy')}
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {item.dataPagamento
                              ? format(new Date(item.dataPagamento), 'dd/MM/yyyy')
                              : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded-full border text-xs font-bold ${statusBadge(item.status)}`}
                            >
                              {item.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            <span
                              className={
                                item.formaPagamento === 'BONIFICACAO'
                                  ? 'font-bold text-purple-700'
                                  : undefined
                              }
                            >
                              {item.formaPagamento === 'BONIFICACAO'
                                ? 'Bonificação'
                                : item.formaPagamento}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="px-4 py-3 border-t text-xs text-gray-500">
                  {recebimentos.total} cobrança(s)
                </div>
              </div>
            </div>
          )}

          {tab === 'fluxo' && fluxo && (
            <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6">
              <h2 className="font-bold text-gray-900 mb-4">
                Entradas × saídas (mensal)
              </h2>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={fluxo.serie || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis dataKey="periodo" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip
                      formatter={(value: any) => money(Number(value || 0))}
                    />
                    <Legend />
                    <Bar dataKey="entradas" name="Entradas" fill="#16a34a" radius={4} />
                    <Bar dataKey="saidas" name="Saídas" fill="#dc2626" radius={4} />
                    <Line
                      type="monotone"
                      dataKey="saldoAcumulado"
                      name="Saldo acumulado"
                      stroke="#111827"
                      strokeWidth={2}
                      dot={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {tab === 'projecao' && projecao && (
            <div className="space-y-4">
              <div className="flex gap-2">
                {[30, 90].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setHorizonte(d)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${
                      horizonte === d
                        ? 'bg-gray-900 text-white'
                        : 'bg-white border border-gray-200 text-gray-600'
                    }`}
                  >
                    {d} dias
                  </button>
                ))}
              </div>

              <div className="grid sm:grid-cols-3 gap-4">
                <div className="bg-white border rounded-xl p-4">
                  <p className="text-xs text-gray-500 font-semibold uppercase">
                    Entradas esperadas
                  </p>
                  <p className="text-xl font-extrabold text-green-700 mt-1">
                    {money(projecao.totalEntradasEsperadas)}
                  </p>
                </div>
                <div className="bg-white border rounded-xl p-4">
                  <p className="text-xs text-gray-500 font-semibold uppercase">
                    Saídas previstas
                  </p>
                  <p className="text-xl font-extrabold text-red-700 mt-1">
                    {money(projecao.totalSaidasPrevistas)}
                  </p>
                </div>
                <div className="bg-white border rounded-xl p-4">
                  <p className="text-xs text-gray-500 font-semibold uppercase">
                    Saldo projetado
                  </p>
                  <p className="text-xl font-extrabold text-gray-900 mt-1">
                    {money(projecao.saldoProjetado)}
                  </p>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6">
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={projecao.serie || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                      <XAxis dataKey="data" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip
                        formatter={(value: any) => money(Number(value || 0))}
                      />
                      <Legend />
                      <Bar dataKey="entradas" name="A receber" fill="#16a34a" />
                      <Bar dataKey="saidas" name="Saídas" fill="#dc2626" />
                      <Line
                        type="monotone"
                        dataKey="saldoAcumulado"
                        name="Saldo"
                        stroke="#111827"
                        strokeWidth={2}
                        dot={false}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b font-bold text-sm">
                  Eventos projetados
                </div>
                <div className="max-h-80 overflow-y-auto divide-y">
                  {(projecao.eventos || []).slice(0, 80).map((ev: any, idx: number) => (
                    <div
                      key={`${ev.origem}-${idx}`}
                      className="px-4 py-2.5 flex items-center justify-between gap-3 text-sm"
                    >
                      <div>
                        <p className="font-medium text-gray-900">{ev.descricao}</p>
                        <p className="text-xs text-gray-500">
                          {format(new Date(ev.data + 'T12:00:00'), 'dd/MM/yyyy')} ·{' '}
                          {ev.tipo === 'entrada' ? 'Entrada' : 'Saída'}
                        </p>
                      </div>
                      <p
                        className={`font-bold ${
                          ev.tipo === 'entrada' ? 'text-green-700' : 'text-red-700'
                        }`}
                      >
                        {ev.tipo === 'entrada' ? '+' : '−'}
                        {money(ev.valor)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'despesas' && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowDespesa(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-lg"
                >
                  <Plus size={16} /> Nova despesa
                </button>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-4 py-3">Data</th>
                      <th className="px-4 py-3">Descrição</th>
                      <th className="px-4 py-3">Categoria</th>
                      <th className="px-4 py-3">Valor</th>
                      <th className="px-4 py-3">Recorrente</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {despesas.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                          Nenhuma despesa cadastrada
                        </td>
                      </tr>
                    )}
                    {despesas.map((d) => (
                      <tr key={d.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          {format(new Date(d.data), 'dd/MM/yyyy')}
                        </td>
                        <td className="px-4 py-3 font-medium">{d.descricao}</td>
                        <td className="px-4 py-3 text-gray-600 capitalize">
                          {d.categoria}
                        </td>
                        <td className="px-4 py-3 font-semibold text-red-700">
                          {money(d.valor)}
                        </td>
                        <td className="px-4 py-3">{d.recorrente ? 'Sim' : 'Não'}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleExcluirDespesa(d.id)}
                            className="p-2 text-gray-400 hover:text-red-600"
                            title="Excluir"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {showDespesa && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <form
            onSubmit={handleCriarDespesa}
            className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4"
          >
            <h3 className="text-lg font-bold">Nova despesa</h3>
            <div>
              <label className="text-xs font-semibold text-gray-500">Descrição</label>
              <input
                required
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500">Valor</label>
                <input
                  required
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={form.valor}
                  onChange={(e) => setForm({ ...form, valor: e.target.value })}
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500">Data</label>
                <input
                  required
                  type="date"
                  value={form.data}
                  onChange={(e) => setForm({ ...form, data: e.target.value })}
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500">Categoria</label>
              <select
                value={form.categoria}
                onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              >
                <option value="infra">Infra</option>
                <option value="marketing">Marketing</option>
                <option value="pessoal">Pessoal</option>
                <option value="impostos">Impostos</option>
                <option value="outro">Outro</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.recorrente}
                onChange={(e) =>
                  setForm({ ...form, recorrente: e.target.checked })
                }
              />
              Recorrente (projeta mensalmente)
            </label>
            <div>
              <label className="text-xs font-semibold text-gray-500">
                Observação
              </label>
              <textarea
                value={form.observacao}
                onChange={(e) => setForm({ ...form, observacao: e.target.value })}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                rows={2}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDespesa(false)}
                className="px-4 py-2 text-sm font-semibold text-gray-600 bg-gray-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 text-sm font-bold text-white bg-red-600 rounded-lg disabled:opacity-60"
              >
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
