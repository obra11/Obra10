import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { HardHat, Loader2, Package, Plus, Trash2 } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

interface EstoqueItem {
  id: string;
  nome: string;
  unidade: string;
  caNumero?: string | null;
  saldo: number | string;
  tipo: string;
}

interface EntregaItem {
  nome: string;
  quantidade: number | string;
  unidade?: string;
  caNumero?: string | null;
}

interface Entrega {
  id: string;
  data: string;
  colaboradorNome: string;
  colaboradorCpf?: string | null;
  colaboradorFuncao?: string | null;
  observacao?: string | null;
  itens: EntregaItem[];
  criadoPor?: { nome: string };
}

const hoje = () => new Date().toISOString().slice(0, 10);
const num = (v: any) => Number(v || 0);

export const EpiEntregasPage: React.FC = () => {
  const { obraId } = useParams();
  const navigate = useNavigate();
  const { empresa } = useAuth();
  const [entregas, setEntregas] = useState<Entrega[]>([]);
  const [epis, setEpis] = useState<EstoqueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    data: hoje(),
    colaboradorNome: '',
    colaboradorCpf: '',
    colaboradorFuncao: '',
    observacao: '',
  });
  const [linhas, setLinhas] = useState([{ itemId: '', nome: '', quantidade: '1', caNumero: '' }]);

  const temEstoque = (empresa?.modulos || []).some((m: any) =>
    ['MATERIAIS', 'ESTOQUE', 'EPI', 'SEGURANCA'].includes(m.slug),
  );

  const carregar = async () => {
    try {
      setLoading(true);
      const [entRes, epiRes] = await Promise.all([
        api.get('/epi/entregas'),
        api.get('/estoque/itens', { params: { tipo: 'EPI' } }).catch(() => ({ data: [] })),
      ]);
      setEntregas(entRes.data || []);
      setEpis(epiRes.data || []);
      setErro('');
    } catch (e: any) {
      setErro(e?.response?.data?.message || 'Não foi possível carregar as entregas de EPI.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
  }, [obraId]);

  const abrirNova = () => {
    setForm({ data: hoje(), colaboradorNome: '', colaboradorCpf: '', colaboradorFuncao: '', observacao: '' });
    setLinhas([{ itemId: epis[0]?.id || '', nome: epis[0]?.nome || '', quantidade: '1', caNumero: epis[0]?.caNumero || '' }]);
    setModal(true);
  };

  const escolherItem = (idx: number, itemId: string) => {
    const found = epis.find((e) => e.id === itemId);
    setLinhas((prev) =>
      prev.map((l, i) =>
        i === idx
          ? {
              itemId,
              nome: found?.nome || l.nome,
              quantidade: l.quantidade,
              caNumero: found?.caNumero || '',
            }
          : l,
      ),
    );
  };

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.colaboradorNome.trim()) return;
    setSaving(true);
    try {
      await api.post('/epi/entregas', {
        data: form.data,
        colaboradorNome: form.colaboradorNome.trim(),
        colaboradorCpf: form.colaboradorCpf.trim() || undefined,
        colaboradorFuncao: form.colaboradorFuncao.trim() || undefined,
        observacao: form.observacao.trim() || undefined,
        itens: linhas
          .filter((l) => (l.nome || '').trim() && Number(l.quantidade) > 0)
          .map((l) => ({
            itemId: l.itemId || undefined,
            nome: l.nome.trim(),
            quantidade: Number(l.quantidade),
            caNumero: l.caNumero.trim() || undefined,
          })),
      });
      setModal(false);
      await carregar();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Erro ao registrar a entrega.');
    } finally {
      setSaving(false);
    }
  };

  const totalItens = useMemo(
    () => entregas.reduce((s, e) => s + (e.itens?.length || 0), 0),
    [entregas],
  );

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto pb-24">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Entrega de EPI</h1>
          <p className="text-sm text-gray-500 mt-1">
            Ficha de entrega (NR-6). Se o item está no estoque, a entrega dá baixa automática.
          </p>
        </div>
        <div className="flex gap-2">
          {temEstoque && (
            <button
              type="button"
              onClick={() => navigate(`/obras/${obraId}/estoque`)}
              className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-1.5"
            >
              <Package size={16} /> Estoque
            </button>
          )}
          <button
            type="button"
            onClick={abrirNova}
            className="px-3 py-2 rounded-lg bg-lunardeli-red text-white text-sm font-semibold hover:bg-red-700 flex items-center gap-1.5"
          >
            <Plus size={16} /> Nova entrega
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <p className="text-xs text-gray-500">Entregas</p>
          <p className="text-2xl font-black text-gray-900">{entregas.length}</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <p className="text-xs text-gray-500">Itens entregues</p>
          <p className="text-2xl font-black text-gray-900">{totalItens}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-500 gap-2">
          <Loader2 className="animate-spin" size={18} /> Carregando entregas…
        </div>
      ) : erro ? (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 text-sm">{erro}</div>
      ) : entregas.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-8 text-center text-sm text-gray-500">
          Nenhuma entrega registrada nesta obra. Toque em Nova entrega para a primeira ficha.
        </div>
      ) : (
        <div className="space-y-3">
          {entregas.map((ent) => (
            <div key={ent.id} className="bg-white border border-gray-100 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
                  <HardHat size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-gray-900 truncate">{ent.colaboradorNome}</p>
                  <p className="text-xs text-gray-500">
                    {format(new Date(ent.data), 'dd/MM/yyyy')}
                    {ent.colaboradorFuncao ? ` · ${ent.colaboradorFuncao}` : ''}
                    {ent.colaboradorCpf ? ` · CPF ${ent.colaboradorCpf}` : ''}
                  </p>
                  <ul className="mt-2 text-sm text-gray-700 space-y-0.5">
                    {ent.itens.map((item, i) => (
                      <li key={i}>
                        {num(item.quantidade)} {item.unidade || 'un'} · {item.nome}
                        {item.caNumero ? ` (CA ${item.caNumero})` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-end md:items-center justify-center p-0 md:p-4">
          <form
            onSubmit={salvar}
            className="bg-white w-full max-w-lg rounded-t-2xl md:rounded-2xl p-5 space-y-3 max-h-[90vh] overflow-y-auto"
          >
            <h2 className="font-bold text-gray-900">Nova entrega de EPI</h2>
            <input
              type="date"
              required
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={form.data}
              onChange={(e) => setForm({ ...form, data: e.target.value })}
            />
            <input
              required
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="Nome de quem recebeu"
              value={form.colaboradorNome}
              onChange={(e) => setForm({ ...form, colaboradorNome: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                className="border rounded-lg px-3 py-2 text-sm"
                placeholder="Função"
                value={form.colaboradorFuncao}
                onChange={(e) => setForm({ ...form, colaboradorFuncao: e.target.value })}
              />
              <input
                className="border rounded-lg px-3 py-2 text-sm"
                placeholder="CPF (opcional)"
                value={form.colaboradorCpf}
                onChange={(e) => setForm({ ...form, colaboradorCpf: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <p className="text-xs font-bold uppercase text-gray-500">Itens</p>
              {linhas.map((linha, idx) => (
                <div key={idx} className="border border-gray-100 rounded-lg p-3 space-y-2">
                  {epis.length > 0 ? (
                    <select
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                      value={linha.itemId}
                      onChange={(e) => escolherItem(idx, e.target.value)}
                    >
                      <option value="">Outro / avulso</option>
                      {epis.map((epi) => (
                        <option key={epi.id} value={epi.id}>
                          {epi.nome} (saldo {num(epi.saldo)} {epi.unidade})
                        </option>
                      ))}
                    </select>
                  ) : null}
                  <input
                    required
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    placeholder="Nome do EPI"
                    value={linha.nome}
                    onChange={(e) =>
                      setLinhas((prev) => prev.map((l, i) => (i === idx ? { ...l, nome: e.target.value } : l)))
                    }
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      min="0.001"
                      step="0.001"
                      className="border rounded-lg px-3 py-2 text-sm"
                      placeholder="Qtd"
                      value={linha.quantidade}
                      onChange={(e) =>
                        setLinhas((prev) =>
                          prev.map((l, i) => (i === idx ? { ...l, quantidade: e.target.value } : l)),
                        )
                      }
                    />
                    <input
                      className="border rounded-lg px-3 py-2 text-sm"
                      placeholder="CA"
                      value={linha.caNumero}
                      onChange={(e) =>
                        setLinhas((prev) =>
                          prev.map((l, i) => (i === idx ? { ...l, caNumero: e.target.value } : l)),
                        )
                      }
                    />
                  </div>
                  {linhas.length > 1 && (
                    <button
                      type="button"
                      className="text-xs font-semibold text-red-600 flex items-center gap-1"
                      onClick={() => setLinhas((prev) => prev.filter((_, i) => i !== idx))}
                    >
                      <Trash2 size={12} /> Remover
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                className="text-sm font-semibold text-lunardeli-red"
                onClick={() => setLinhas((prev) => [...prev, { itemId: '', nome: '', quantidade: '1', caNumero: '' }])}
              >
                + Outro EPI
              </button>
            </div>

            <textarea
              className="w-full border rounded-lg px-3 py-2 text-sm"
              rows={2}
              placeholder="Observação (opcional)"
              value={form.observacao}
              onChange={(e) => setForm({ ...form, observacao: e.target.value })}
            />

            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setModal(false)} className="flex-1 py-2.5 rounded-lg border font-semibold text-sm">
                Cancelar
              </button>
              <button disabled={saving} className="flex-1 py-2.5 rounded-lg bg-lunardeli-red text-white font-semibold text-sm disabled:opacity-60">
                {saving ? 'Salvando…' : 'Registrar entrega'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default EpiEntregasPage;
