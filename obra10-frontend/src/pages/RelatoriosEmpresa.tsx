import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  FileText,
  Loader2,
  Search,
  Building2,
  Calendar,
  CheckCircle,
  Clock,
  AlertCircle,
  XCircle,
} from 'lucide-react';
import api from '../services/api';
import { useAuth, type Obra } from '../context/AuthContext';

type RdoStatus =
  | 'RASCUNHO'
  | 'EM_PREENCHIMENTO'
  | 'SUBMETIDO'
  | 'APROVADO'
  | 'REJEITADO';

type RelatorioItem = {
  id: string;
  obraId: string;
  obraNome: string;
  dataReferencia: string;
  dataFim?: string | null;
  tipoRelatorio?: string | null;
  status: string;
  sequencial: number;
  criadorNome: string;
  createdAt: string;
};

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

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('pt-BR');
}

function formatPeriodo(item: RelatorioItem): string {
  const inicio = formatDate(item.dataReferencia);
  if (String(item.tipoRelatorio || '').toUpperCase() === 'PERIODO' && item.dataFim) {
    return `${inicio} — ${formatDate(item.dataFim)}`;
  }
  return inicio;
}

export const RelatoriosEmpresa: React.FC = () => {
  const navigate = useNavigate();
  const { obras, setObraAtiva } = useAuth();
  const [items, setItems] = useState<RelatorioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('TODOS');
  const [obraFilter, setObraFilter] = useState('TODAS');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .get('/rdos/empresa')
      .then((res) => {
        if (!cancelled) setItems(Array.isArray(res.data) ? res.data : []);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err?.response?.data?.message ||
              'Não foi possível carregar os relatórios.',
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const obrasOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of items) {
      if (r.obraId) map.set(r.obraId, r.obraNome || r.obraId);
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((r) => {
      if (statusFilter !== 'TODOS' && r.status !== statusFilter) return false;
      if (obraFilter !== 'TODAS' && r.obraId !== obraFilter) return false;
      if (!q) return true;
      return (
        r.obraNome?.toLowerCase().includes(q) ||
        r.criadorNome?.toLowerCase().includes(q) ||
        String(r.sequencial).includes(q) ||
        formatPeriodo(r).toLowerCase().includes(q)
      );
    });
  }, [items, search, statusFilter, obraFilter]);

  const openRdo = (item: RelatorioItem) => {
    const obra: Obra =
      obras.find((o) => o.id === item.obraId) || {
        id: item.obraId,
        nome: item.obraNome,
        status: 'ATIVA',
      };
    setObraAtiva(obra);
    navigate(`/obras/${item.obraId}/rdos/${item.id}`);
  };

  return (
    <div className="min-h-screen bg-lunardeli-gray">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 text-lunardeli-red font-bold text-sm uppercase tracking-wider mb-1">
              <FileText size={18} />
              <span>Empresa</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">
              Relatórios
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Todos os diários de obra das suas obras, em ordem cronológica.
            </p>
          </div>
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3.5 py-2.5 rounded-xl font-bold text-sm transition-all shrink-0"
          >
            <ArrowLeft size={18} />
            <span>Voltar</span>
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4 flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por obra, autor ou nº…"
              className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-lunardeli-red/30"
            />
          </div>
          <select
            value={obraFilter}
            onChange={(e) => setObraFilter(e.target.value)}
            className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white"
          >
            <option value="TODAS">Todas as obras</option>
            {obrasOptions.map(([id, nome]) => (
              <option key={id} value={id}>
                {nome}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white"
          >
            <option value="TODOS">Todos os status</option>
            <option value="RASCUNHO">Rascunho</option>
            <option value="EM_PREENCHIMENTO">Em Andamento</option>
            <option value="SUBMETIDO">Submetido</option>
            <option value="APROVADO">Aprovado</option>
            <option value="REJEITADO">Reprovado</option>
          </select>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-20 text-gray-500">
              <Loader2 className="animate-spin" size={22} />
              Carregando relatórios…
            </div>
          ) : error ? (
            <div className="py-16 text-center text-red-600 text-sm font-medium px-4">
              {error}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-gray-500 text-sm">
              Nenhum relatório encontrado.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500 border-b border-gray-100">
                    <th className="px-4 py-3 font-bold">Nº</th>
                    <th className="px-4 py-3 font-bold">Obra</th>
                    <th className="px-4 py-3 font-bold">Data</th>
                    <th className="px-4 py-3 font-bold">Tipo</th>
                    <th className="px-4 py-3 font-bold">Status</th>
                    <th className="px-4 py-3 font-bold">Autor</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => {
                    const st =
                      STATUS_CONFIG[item.status as RdoStatus] ||
                      STATUS_CONFIG.RASCUNHO;
                    const isPeriodo =
                      String(item.tipoRelatorio || '').toUpperCase() ===
                      'PERIODO';
                    return (
                      <tr
                        key={item.id}
                        onClick={() => openRdo(item)}
                        className="border-b border-gray-50 hover:bg-red-50/40 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3 font-bold text-gray-800 whitespace-nowrap">
                          #{item.sequencial}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 text-gray-800 font-medium">
                            <Building2
                              size={14}
                              className="text-lunardeli-red shrink-0"
                            />
                            <span className="truncate max-w-[220px]">
                              {item.obraNome}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5">
                            <Calendar size={13} className="text-gray-400" />
                            {formatPeriodo(item)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded border ${
                              isPeriodo
                                ? 'bg-violet-50 text-violet-700 border-violet-200'
                                : 'bg-slate-50 text-slate-600 border-slate-200'
                            }`}
                          >
                            {isPeriodo ? 'Período' : 'Dia'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded border ${st.color}`}
                          >
                            {st.icon}
                            {st.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600 truncate max-w-[160px]">
                          {item.criadorNome}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {!loading && !error && filtered.length > 0 && (
            <div className="px-4 py-3 text-xs text-gray-400 border-t border-gray-50">
              {filtered.length} relatório(s)
              {items.length >= 500 ? ' (limite de 500 mais recentes)' : ''}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
