import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { CreditCard, Loader2, CheckCircle, Clock, XCircle, AlertCircle, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';

interface Cobranca {
  id: string; status: string; formaPagamento: string;
  valor: number; mesReferencia: string; dataVencimento: string;
  dataPagamento?: string; linkPagamento?: string;
}

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, { label: string; color: string; Icon: any }> = {
    PAGO: { label: 'Pago', color: 'bg-green-50 text-green-700 border-green-200', Icon: CheckCircle },
    PENDENTE: { label: 'Pendente', color: 'bg-yellow-50 text-yellow-700 border-yellow-200', Icon: Clock },
    VENCIDO: { label: 'Vencido', color: 'bg-red-50 text-red-700 border-red-200', Icon: XCircle },
    CANCELADO: { label: 'Cancelado', color: 'bg-gray-100 text-gray-500 border-gray-200', Icon: AlertCircle },
  };
  const s = map[status] || map.CANCELADO;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${s.color}`}>
      <s.Icon size={12} />{s.label}
    </span>
  );
};

export const Financeiro: React.FC = () => {
  const navigate = useNavigate();
  const [cobrancas, setCobrancas] = useState<Cobranca[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [pagarLoading, setPagarLoading] = useState(false);

  const fetchData = async (p: number) => {
    setLoading(true);
    try {
      const res = await api.get(`/cobrancas/minha-empresa?page=${p}&limit=12`);
      setCobrancas(res.data.items);
      setTotal(res.data.total);
      setPages(res.data.pages);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(page); }, [page]);

  const mesLabel = (date: string) =>
    new Date(date).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  // Determine se existe débito pendente/vencido (qualquer página buscada)
  const temDebito = cobrancas.some(c => c.status === 'PENDENTE' || c.status === 'VENCIDO');

  const handlePagarDebito = async () => {
    setPagarLoading(true);
    try {
      // ✅ CRITICAL FIX: fetch only the tenant's ACTIVE modules — not the full catalog
      const modRes = await api.get('/cobrancas/modulos-ativos');
      const modulos = modRes.data as { slug: string }[];
      if (modulos.length === 0) {
        alert('Nenhum módulo ativo encontrado. Entre em contato com o suporte.');
        return;
      }
      // Re-contract with only the already-active modules via PIX
      const res = await api.post('/cobrancas/contratar', {
        modulosSelecionados: modulos.map((m: any) => m.slug),
        formaPagamento: 'PIX',
      });
      navigate(`/aguardando-pagamento/${res.data.cobrancaId}`, {
        state: {
          qrCode: res.data.qrCode,
          qrCodeBase64: res.data.qrCodeBase64,
          linkPagamento: res.data.linkPagamento,
          valor: res.data.valor,
        },
      });
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Erro ao gerar novo pagamento.';
      alert(msg);
    } finally { setPagarLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <CreditCard className="text-red-600" size={28} />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Histórico Financeiro</h1>
              <p className="text-sm text-gray-500">{total} cobranças no total</p>
            </div>
          </div>
          {/* 🔴 Pagar débito — visible when PENDENTE or VENCIDO exists */}
          {temDebito && !loading && (
            <button
              onClick={handlePagarDebito}
              disabled={pagarLoading}
              className="flex items-center gap-2 px-5 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-all disabled:opacity-70 shadow-lg shadow-red-200 animate-pulse"
            >
              {pagarLoading
                ? <><Loader2 size={16} className="animate-spin" />Gerando PIX...</>
                : <><AlertTriangle size={16} />Pagar débito</>
              }
            </button>
          )}
        </div>

        {/* Debt alert banner */}
        {temDebito && !loading && (
          <div className="mb-5 bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
            <AlertTriangle size={20} className="text-red-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-800">Pagamento pendente</p>
              <p className="text-xs text-red-600">Regularize seu pagamento para evitar suspensão da conta.</p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-red-600" size={40} /></div>
        ) : cobrancas.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <CreditCard size={48} className="mx-auto mb-3 opacity-30" />
            <p>Nenhuma cobrança registrada ainda.</p>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-4">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['Mês', 'Valor', 'Forma', 'Status', 'Vencimento', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {cobrancas.map(c => (
                    <tr key={c.id} className={`hover:bg-gray-50 transition-colors ${c.status === 'VENCIDO' ? 'bg-red-50/30' : ''}`}>
                      <td className="px-4 py-4 text-sm font-medium text-gray-900 capitalize">{mesLabel(c.mesReferencia)}</td>
                      <td className="px-4 py-4 text-sm font-bold text-gray-900">R$ {Number(c.valor).toFixed(2)}</td>
                      <td className="px-4 py-4 text-xs text-gray-500">{c.formaPagamento}</td>
                      <td className="px-4 py-4"><StatusBadge status={c.status} /></td>
                      <td className="px-4 py-4 text-xs text-gray-500">
                        {new Date(c.dataVencimento).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-4 py-4">
                        {c.linkPagamento && (c.status === 'PENDENTE' || c.status === 'VENCIDO') && (
                          <a href={c.linkPagamento} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-red-600 font-semibold hover:underline whitespace-nowrap">
                            Pagar PIX →
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pages > 1 && (
              <div className="flex items-center justify-center gap-3">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="p-2 rounded-lg border border-gray-200 hover:bg-gray-100 disabled:opacity-40 transition-all">
                  <ChevronLeft size={16} />
                </button>
                <span className="text-sm text-gray-600 font-medium">{page} / {pages}</span>
                <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
                  className="p-2 rounded-lg border border-gray-200 hover:bg-gray-100 disabled:opacity-40 transition-all">
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
