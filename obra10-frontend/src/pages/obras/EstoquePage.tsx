import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  HardHat,
  Loader2,
  Package,
  Plus,
  Search,
} from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

type TipoItem = 'MATERIAL' | 'EPI';
type TipoMov = 'ENTRADA' | 'SAIDA' | 'AJUSTE';

interface EstoqueItem {
  id: string;
  tipo: TipoItem;
  nome: string;
  unidade: string;
  codigo?: string | null;
  caNumero?: string | null;
  estoqueMinimo: number | string;
  saldo: number | string;
  ativo: boolean;
}

const num = (v: any) => Number(v || 0);

export const EstoquePage: React.FC = () => {
  const { obraId } = useParams();
  const navigate = useNavigate();
  const { empresa } = useAuth();
  const [itens, setItens] = useState<EstoqueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState<'TODOS' | TipoItem>('TODOS');
  const [busca, setBusca] = useState('');
  const [saving, setSaving] = useState(false);

  const [itemModal, setItemModal] = useState(false);
  const [form, setForm] = useState({
    tipo: 'MATERIAL' as TipoItem,
    nome: '',
    unidade: 'un',
    codigo: '',
    caNumero: '',
    estoqueMinimo: '0',
  });

  const [movModal, setMovModal] = useState<EstoqueItem | null>(null);
  const [mov, setMov] = useState({ tipo: 'ENTRADA' as TipoMov, quantidade: '', observacao: '' });

  const temEpi = (empresa?.modulos || []).some((m: any) =>
    ['EPI', 'SEGURANCA', 'MATERIAIS', 'ESTOQUE'].includes(m.slug),
  );

  const carregar = async () => {
    try {
      setLoading(true);
      const res = await api.get('/estoque/itens');
      setItens(res.data || []);
      setErro('');
    } catch (e: any) {
      setErro(e?.response?.data?.message || 'Não foi possível carregar o estoque.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
  }, [obraId]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return itens.filter((i) => {
      if (tipoFiltro !== 'TODOS' && i.tipo !== tipoFiltro) return false;
      if (!q) return true;
      return (
        i.nome.toLowerCase().includes(q) ||
        (i.codigo || '').toLowerCase().includes(q) ||
        (i.caNumero || '').toLowerCase().includes(q)
      );
    });
  }, [itens, tipoFiltro, busca]);

  const abrirNovo = (tipo: TipoItem = tipoFiltro === 'EPI' ? 'EPI' : 'MATERIAL') => {
    setForm({ tipo, nome: '', unidade: tipo === 'EPI' ? 'un' : 'un', codigo: '', caNumero: '', estoqueMinimo: '0' });
    setItemModal(true);
  };

  const salvarItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome.trim()) return;
    setSaving(true);
    try {
      await api.post('/estoque/itens', {
        tipo: form.tipo,
        nome: form.nome.trim(),
        unidade: form.unidade.trim() || 'un',
        codigo: form.codigo.trim() || undefined,
        caNumero: form.caNumero.trim() || undefined,
        estoqueMinimo: Number(form.estoqueMinimo || 0),
      });
      setItemModal(false);
      await carregar();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Erro ao salvar item.');
    } finally {
      setSaving(false);
    }
  };

  const salvarMov = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!movModal) return;
    setSaving(true);
    try {
      await api.post(`/estoque/itens/${movModal.id}/movimentos`, {
        tipo: mov.tipo,
        quantidade: Number(mov.quantidade),
        observacao: mov.observacao.trim() || undefined,
      });
      setMovModal(null);
      await carregar();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Erro ao registrar movimento.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto pb-24">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Controle de estoque</h1>
          <p className="text-sm text-gray-500 mt-1">Entrada, saída e saldo dos materiais e EPIs desta obra.</p>
        </div>
        <div className="flex gap-2">
          {temEpi && (
            <button
              type="button"
              onClick={() => navigate(`/obras/${obraId}/epi`)}
              className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Entregas de EPI
            </button>
          )}
          <button
            type="button"
            onClick={() => abrirNovo()}
            className="px-3 py-2 rounded-lg bg-lunardeli-red text-white text-sm font-semibold hover:bg-red-700 flex items-center gap-1.5"
          >
            <Plus size={16} /> Novo item
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="flex rounded-lg border border-gray-200 overflow-hidden shrink-0">
          {(['TODOS', 'MATERIAL', 'EPI'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTipoFiltro(t)}
              className={`px-3 py-2 text-xs font-bold ${
                tipoFiltro === t ? 'bg-lunardeli-red text-white' : 'bg-white text-gray-600'
              }`}
            >
              {t === 'TODOS' ? 'Todos' : t === 'EPI' ? 'EPI' : 'Materiais'}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar item, código ou CA"
            className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-lunardeli-red"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-500 gap-2">
          <Loader2 className="animate-spin" size={18} /> Carregando estoque…
        </div>
      ) : erro ? (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 text-sm">{erro}</div>
      ) : filtrados.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-8 text-center text-sm text-gray-500">
          Nenhum item neste filtro. Cadastre o primeiro material ou EPI da obra.
        </div>
      ) : (
        <div className="space-y-2">
          {filtrados.map((item) => {
            const saldo = num(item.saldo);
            const min = num(item.estoqueMinimo);
            const baixo = min > 0 && saldo <= min;
            return (
              <div
                key={item.id}
                className="bg-white border border-gray-100 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3"
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                  item.tipo === 'EPI' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-lunardeli-red'
                }`}>
                  {item.tipo === 'EPI' ? <HardHat size={18} /> : <Package size={18} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900 truncate">{item.nome}</p>
                    {baixo && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                        <AlertTriangle size={10} /> Saldo baixo
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {item.tipo === 'EPI' ? 'EPI' : 'Material'} · {item.unidade}
                    {item.codigo ? ` · ${item.codigo}` : ''}
                    {item.caNumero ? ` · CA ${item.caNumero}` : ''}
                  </p>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-4">
                  <div className="text-right">
                    <p className={`text-lg font-black ${baixo ? 'text-amber-700' : 'text-gray-900'}`}>
                      {saldo}
                    </p>
                    <p className="text-[11px] text-gray-400">mín. {min}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setMov({ tipo: 'ENTRADA', quantidade: '', observacao: '' });
                      setMovModal(item);
                    }}
                    className="px-3 py-2 rounded-lg border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50"
                  >
                    Movimentar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {itemModal && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-end md:items-center justify-center p-0 md:p-4">
          <form
            onSubmit={salvarItem}
            className="bg-white w-full max-w-lg rounded-t-2xl md:rounded-2xl p-5 space-y-3"
          >
            <h2 className="font-bold text-gray-900">Novo item de estoque</h2>
            <select
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={form.tipo}
              onChange={(e) => setForm({ ...form, tipo: e.target.value as TipoItem })}
            >
              <option value="MATERIAL">Material</option>
              <option value="EPI">EPI</option>
            </select>
            <input
              required
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="Nome"
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                className="border rounded-lg px-3 py-2 text-sm"
                placeholder="Unidade"
                value={form.unidade}
                onChange={(e) => setForm({ ...form, unidade: e.target.value })}
              />
              <input
                className="border rounded-lg px-3 py-2 text-sm"
                placeholder="Estoque mínimo"
                type="number"
                min={0}
                step="0.001"
                value={form.estoqueMinimo}
                onChange={(e) => setForm({ ...form, estoqueMinimo: e.target.value })}
              />
            </div>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="Código (opcional)"
              value={form.codigo}
              onChange={(e) => setForm({ ...form, codigo: e.target.value })}
            />
            {form.tipo === 'EPI' && (
              <input
                className="w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="CA — certificado de aprovação (opcional)"
                value={form.caNumero}
                onChange={(e) => setForm({ ...form, caNumero: e.target.value })}
              />
            )}
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setItemModal(false)} className="flex-1 py-2.5 rounded-lg border font-semibold text-sm">
                Cancelar
              </button>
              <button disabled={saving} className="flex-1 py-2.5 rounded-lg bg-lunardeli-red text-white font-semibold text-sm disabled:opacity-60">
                {saving ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </form>
        </div>
      )}

      {movModal && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-end md:items-center justify-center p-0 md:p-4">
          <form
            onSubmit={salvarMov}
            className="bg-white w-full max-w-lg rounded-t-2xl md:rounded-2xl p-5 space-y-3"
          >
            <h2 className="font-bold text-gray-900">Movimentar {movModal.nome}</h2>
            <p className="text-xs text-gray-500">Saldo atual: {num(movModal.saldo)} {movModal.unidade}</p>
            <select
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={mov.tipo}
              onChange={(e) => setMov({ ...mov, tipo: e.target.value as TipoMov })}
            >
              <option value="ENTRADA">Entrada</option>
              <option value="SAIDA">Saída</option>
              <option value="AJUSTE">Ajuste (saldo final)</option>
            </select>
            <input
              required
              type="number"
              step="0.001"
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder={mov.tipo === 'AJUSTE' ? 'Novo saldo' : 'Quantidade'}
              value={mov.quantidade}
              onChange={(e) => setMov({ ...mov, quantidade: e.target.value })}
            />
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="Observação (opcional)"
              value={mov.observacao}
              onChange={(e) => setMov({ ...mov, observacao: e.target.value })}
            />
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setMovModal(null)} className="flex-1 py-2.5 rounded-lg border font-semibold text-sm">
                Cancelar
              </button>
              <button disabled={saving} className="flex-1 py-2.5 rounded-lg bg-lunardeli-red text-white font-semibold text-sm disabled:opacity-60">
                {saving ? 'Salvando…' : 'Registrar'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default EstoquePage;
