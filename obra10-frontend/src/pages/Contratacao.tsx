import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import {
  Package, Loader2, CheckCircle, CreditCard, QrCode, ChevronRight, ChevronDown
} from 'lucide-react';

interface SubModulo { slug: string; nome: string; descricao?: string; }

interface Modulo {
  slug: string;
  nome: string;
  sigla?: string;
  grupo: string;
  descricao?: string;
  preco: number;
  submodulos: SubModulo[];
}

const GRUPO_ORDER = ['Operacional', 'Qualidade', 'Gestão', 'Pessoas', 'GERAL'];

const GRUPO_COLORS: Record<string, string> = {
  'Operacional': 'bg-blue-50 text-blue-700 border-blue-200',
  'Qualidade':   'bg-green-50 text-green-700 border-green-200',
  'Gestão':      'bg-purple-50 text-purple-700 border-purple-200',
  'Pessoas':     'bg-orange-50 text-orange-700 border-orange-200',
  'GERAL':       'bg-gray-50 text-gray-700 border-gray-200',
};

export const Contratacao: React.FC = () => {
  const navigate = useNavigate();
  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [formaPagamento, setFormaPagamento] = useState<'PIX' | 'CARTAO'>('PIX');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/modulos').then(r => {
      // Filter out legacy IA module and CONCRETO (now a submodule)
      const filtered = (r.data as Modulo[]).filter(m => m.slug !== 'IA' && m.slug !== 'CONCRETO');
      setModulos(filtered);
      setLoading(false);
    });
  }, []);

  const toggle = (slug: string) => setSelecionados(p =>
    p.includes(slug) ? p.filter(s => s !== slug) : [...p, slug]
  );

  const toggleExpand = (slug: string) => setExpanded(p => ({ ...p, [slug]: !p[slug] }));

  const total = modulos
    .filter(m => selecionados.includes(m.slug))
    .reduce((s, m) => {
      if (m.slug === 'RDO') return s; // first month free
      return s + Number(m.preco);
    }, 0);

  // Group modules by category
  const grupos = GRUPO_ORDER.reduce<Record<string, Modulo[]>>((acc, g) => {
    const ms = modulos.filter(m => m.grupo === g);
    if (ms.length) acc[g] = ms;
    return acc;
  }, {});

  const handleContratar = async () => {
    if (selecionados.length === 0) { setError('Selecione ao menos um módulo.'); return; }
    setSubmitting(true); setError('');
    try {
      const res = await api.post('/cobrancas/contratar', {
        modulosSelecionados: selecionados,
        formaPagamento,
      });
      if (formaPagamento === 'PIX') {
        navigate(`/aguardando-pagamento/${res.data.cobrancaId}`, {
          state: { qrCode: res.data.qrCode, qrCodeBase64: res.data.qrCodeBase64, linkPagamento: res.data.linkPagamento, valor: res.data.valor },
        });
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Erro ao processar contratação.');
    } finally { setSubmitting(false); }
  };

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-red-600" size={40} /></div>;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <Package size={48} className="mx-auto mb-4 text-red-600" />
          <h1 className="text-3xl font-bold text-gray-900">Escolha seus módulos</h1>
          <p className="text-gray-500 mt-2">Pague apenas pelo que usar. RDO grátis no 1º mês!</p>
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-xl border-l-4 border-red-500">{error}</div>}

        {/* Modules grouped by category */}
        <div className="space-y-6 mb-6">
          {Object.entries(grupos).map(([grupo, mods]) => (
            <div key={grupo}>
              <div className={`inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full border mb-3 ${GRUPO_COLORS[grupo] || GRUPO_COLORS['GERAL']}`}>
                {grupo}
              </div>
              <div className="space-y-2">
                {mods.map(m => {
                  const isSelected = selecionados.includes(m.slug);
                  const isFree = m.slug === 'RDO';
                  const hasSubmodulos = m.submodulos?.length > 0;
                  const isExpanded = expanded[m.slug];

                  return (
                    <div key={m.slug} className={`rounded-xl border-2 transition-all ${isSelected ? 'border-red-500 bg-red-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                      <div className="p-4 flex items-center justify-between cursor-pointer" onClick={() => toggle(m.slug)}>
                        <div className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded flex items-center justify-center border-2 shrink-0 ${isSelected ? 'border-red-500 bg-red-500' : 'border-gray-300'}`}>
                            {isSelected && <CheckCircle size={12} className="text-white" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-gray-900">{m.nome}</p>
                              {m.sigla && <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{m.sigla}</span>}
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5">{m.descricao}</p>
                            {hasSubmodulos && (
                              <p className="text-xs text-gray-400 mt-1">
                                Inclui: {m.submodulos.map(s => s.nome).join(', ')}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 ml-4">
                          <div className="text-right">
                            <p className="font-bold text-gray-900">
                              {isFree ? <span className="text-green-600">GRÁTIS</span> : `R$ ${Number(m.preco).toFixed(2)}`}
                              <span className="text-xs text-gray-400 font-normal">/mês</span>
                            </p>
                            {isFree && <p className="text-xs text-gray-400">R$ 49,90/mês após</p>}
                          </div>
                          {hasSubmodulos && (
                            <button
                              onClick={e => { e.stopPropagation(); toggleExpand(m.slug); }}
                              className="p-1 text-gray-400 hover:text-gray-700 rounded transition-colors"
                              title={isExpanded ? 'Recolher submódulos' : 'Ver submódulos inclusos'}
                            >
                              <ChevronDown size={16} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Expanded submodules */}
                      {hasSubmodulos && isExpanded && (
                        <div className="border-t border-gray-100 px-4 pb-4 pt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {m.submodulos.map(s => (
                            <div key={s.slug} className="flex items-start gap-2 text-xs text-gray-600">
                              <CheckCircle size={13} className="text-green-500 mt-0.5 shrink-0" />
                              <div>
                                <span className="font-semibold">{s.nome}</span>
                                {s.descricao && <p className="text-gray-400 mt-0.5">{s.descricao}</p>}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Payment method */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
          <p className="font-semibold text-gray-700 mb-3">Forma de Pagamento</p>
          <div className="flex gap-3">
            {[{ k: 'PIX', label: '🔑 PIX' }, { k: 'CARTAO', label: '💳 Cartão' }].map(({ k, label }) => (
              <button key={k} onClick={() => setFormaPagamento(k as 'PIX' | 'CARTAO')}
                className={`flex-1 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${formaPagamento === k ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 text-gray-500'}`}>
                {label}
              </button>
            ))}
          </div>
          {formaPagamento === 'CARTAO' && (
            <p className="text-xs text-gray-400 mt-3 text-center">
              Os dados do cartão são tokenizados diretamente pelo Asaas (PCI DSS). Nunca passam pelo nosso servidor.
            </p>
          )}
        </div>

        {/* Total + CTA */}
        <div className="bg-white rounded-xl border-2 border-red-100 p-5">
          <div className="flex justify-between items-center mb-4">
            <span className="text-gray-600 font-medium">Total mensal</span>
            <span className="text-2xl font-bold text-gray-900">R$ {total.toFixed(2)}</span>
          </div>
          <button onClick={handleContratar} disabled={submitting || selecionados.length === 0}
            className="w-full py-4 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-all disabled:opacity-60 flex items-center justify-center gap-2">
            {submitting ? <><Loader2 size={18} className="animate-spin" />Processando...</> : <>{formaPagamento === 'PIX' ? <QrCode size={18} /> : <CreditCard size={18} />}Contratar Módulos<ChevronRight size={18} /></>}
          </button>
        </div>
      </div>
    </div>
  );
};
