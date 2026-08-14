import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import {
  Package, Loader2, CheckCircle, CreditCard, QrCode, ChevronRight, ChevronDown, Tag, X
} from 'lucide-react';
import {
  PACOTE_KEYS,
  PACOTES_OBRAS,
  precoComPacote,
  resolvePacoteObras,
} from '../utils/pacotesObras';
import type { PacoteObras } from '../utils/pacotesObras';

interface SubModulo { slug: string; nome: string; descricao?: string; }

interface Modulo {
  slug: string;
  nome: string;
  sigla?: string;
  grupo: string;
  descricao?: string;
  preco: number;
  precoAnual?: number;
  submodulos: SubModulo[];
}

interface CupomValidado {
  valido: boolean;
  tipo: string;
  valor: number | null;
  mesesGratuitos: number | null;
  duracaoMeses: number | null;
  descricao: string;
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
  const [searchParams] = useSearchParams();
  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [formaPagamento, setFormaPagamento] = useState<'PIX' | 'CARTAO'>('PIX');
  const [periodicidade, setPeriodicidade] = useState<'MENSAL' | 'ANUAL'>('MENSAL');
  const [pacoteObras, setPacoteObras] = useState<PacoteObras>(() =>
    resolvePacoteObras(
      searchParams.get('pacote') ||
        (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('pacoteObras') : null),
    ),
  );
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Coupon state
  const [codigoCupom, setCodigoCupom] = useState('');
  const [cupomValidado, setCupomValidado] = useState<CupomValidado | null>(null);
  const [cupomErro, setCupomErro] = useState('');
  const [validandoCupom, setValidandoCupom] = useState(false);

  useEffect(() => {
    api.get('/modulos').then(r => {
      const filtered = (r.data as Modulo[]).filter(m => m.slug !== 'IA' && m.slug !== 'CONCRETO');
      setModulos(filtered);
      setLoading(false);
    });
  }, []);

  const toggle = (slug: string) => setSelecionados(p =>
    p.includes(slug) ? p.filter(s => s !== slug) : [...p, slug]
  );

  const toggleExpand = (slug: string) => setExpanded(p => ({ ...p, [slug]: !p[slug] }));

  const precoModulo = (m: Modulo) => {
    let base = Number(m.preco);
    if (periodicidade === 'ANUAL') {
      const anual = Number(m.precoAnual || 0);
      base = anual > 0 ? anual : Number(m.preco) * 11;
    }
    return precoComPacote(base, pacoteObras);
  };

  // Base total (before coupon)
  const totalBase = modulos
    .filter(m => selecionados.includes(m.slug))
    .reduce((s, m) => s + precoModulo(m), 0);

  // Total after coupon
  const calcularTotalComDesconto = () => {
    if (!cupomValidado) return totalBase;
    switch (cupomValidado.tipo) {
      case 'GRATUIDADE':
        return 0;
      case 'DESCONTO_FIXO':
        return Math.max(totalBase - (cupomValidado.valor || 0), 0);
      case 'DESCONTO_PERCENTUAL':
        return Math.max(totalBase - totalBase * ((cupomValidado.valor || 0) / 100), 0);
      default:
        return totalBase;
    }
  };

  const total = calcularTotalComDesconto();
  const temDesconto = cupomValidado && total < totalBase;
  const pacoteInfo = PACOTES_OBRAS[pacoteObras];

  // Group modules by category
  const grupos = GRUPO_ORDER.reduce<Record<string, Modulo[]>>((acc, g) => {
    const ms = modulos.filter(m => m.grupo === g);
    if (ms.length) acc[g] = ms;
    return acc;
  }, {});

  const handleValidarCupom = async () => {
    if (!codigoCupom.trim()) return;
    setValidandoCupom(true);
    setCupomErro('');
    setCupomValidado(null);
    try {
      const res = await api.post('/cobrancas/validar-cupom', { codigo: codigoCupom.trim() });
      setCupomValidado(res.data);
    } catch (err: any) {
      setCupomErro(err?.response?.data?.message || 'Cupom inválido.');
    } finally {
      setValidandoCupom(false);
    }
  };

  const handleRemoverCupom = () => {
    setCupomValidado(null);
    setCodigoCupom('');
    setCupomErro('');
  };

  const handleContratar = async () => {
    if (selecionados.length === 0) { setError('Selecione ao menos um módulo.'); return; }
    setSubmitting(true); setError('');
    try {
      const res = await api.post('/cobrancas/contratar', {
        modulosSelecionados: selecionados,
        formaPagamento,
        periodicidade,
        pacoteObras,
        cupom: cupomValidado ? codigoCupom.trim() : undefined,
      });

      // If coupon zeroed the value, modules are already active
      if (res.data.status === 'PAGO' || res.data.valor === 0) {
        window.location.href = '/dashboard';
        return;
      }

      navigate(`/aguardando-pagamento/${res.data.cobrancaId}`, {
        state: {
          qrCode: res.data.qrCode,
          qrCodeBase64: res.data.qrCodeBase64,
          linkPagamento: res.data.linkPagamento,
          valor: res.data.valor,
          method: formaPagamento === 'CARTAO' ? 'paypal' : 'pix',
        },
      });
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
          <p className="text-gray-500 mt-2">
            Preços a partir da tabela cadastrada (pacote até 5 obras). Ajuste o pacote conforme o número de obras.
          </p>
        </div>

        {/* Pacote de obras */}
        <div className="grid sm:grid-cols-3 gap-2 mb-4">
          {PACOTE_KEYS.map((key) => {
            const p = PACOTES_OBRAS[key];
            const selected = pacoteObras === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setPacoteObras(key)}
                className={`text-left p-4 rounded-xl border-2 transition-all ${
                  selected
                    ? 'border-red-500 bg-red-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <p className="font-bold text-gray-900 text-sm">{p.label}</p>
                <p className="text-xs text-gray-500 mt-1">{p.descricao}</p>
                <p className="text-[11px] font-semibold text-gray-400 mt-2">
                  {key === 'ATE_5' ? 'Preço de tabela' : key === 'ATE_3' ? '−20% sobre a tabela' : '+50% sobre a tabela'}
                </p>
              </button>
            );
          })}
        </div>

        {/* Periodicidade */}
        <div className="bg-white rounded-xl border border-gray-200 p-2 mb-6 flex gap-2">
          <button
            type="button"
            onClick={() => setPeriodicidade('MENSAL')}
            className={`flex-1 py-3 rounded-lg text-sm font-bold transition-colors ${
              periodicidade === 'MENSAL'
                ? 'bg-red-600 text-white'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Mensal
          </button>
          <button
            type="button"
            onClick={() => setPeriodicidade('ANUAL')}
            className={`flex-1 py-3 rounded-lg text-sm font-bold transition-colors ${
              periodicidade === 'ANUAL'
                ? 'bg-red-600 text-white'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Anual
            <span className="block text-[10px] font-semibold opacity-80 mt-0.5">
              Economize ~1 mês
            </span>
          </button>
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
                              R$ {precoModulo(m).toFixed(2)}
                              <span className="text-xs text-gray-400 font-normal">
                                /{periodicidade === 'ANUAL' ? 'ano' : 'mês'}
                              </span>
                            </p>
                            {periodicidade === 'ANUAL' && Number(m.preco) > 0 && (
                              <p className="text-[10px] text-gray-400">
                                equiv. R$ {(precoModulo(m) / 12).toFixed(2)}/mês
                              </p>
                            )}
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

        {/* Coupon Code */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
          <p className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Tag size={16} className="text-gray-400" />
            Código de desconto
          </p>

          {cupomValidado ? (
            <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-4 py-3">
              <div>
                <p className="font-bold text-green-700 text-sm flex items-center gap-1.5">
                  <CheckCircle size={14} />
                  {codigoCupom.toUpperCase()}
                </p>
                <p className="text-xs text-green-600 mt-0.5">{cupomValidado.descricao}</p>
              </div>
              <button
                onClick={handleRemoverCupom}
                className="p-1.5 text-green-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Remover cupom"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                value={codigoCupom}
                onChange={e => { setCodigoCupom(e.target.value.toUpperCase()); setCupomErro(''); }}
                placeholder="Ex: BETA50"
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-mono uppercase tracking-wider focus:outline-none focus:border-red-400 focus:ring-1 focus:ring-red-200 transition-all"
                onKeyDown={e => e.key === 'Enter' && handleValidarCupom()}
              />
              <button
                onClick={handleValidarCupom}
                disabled={validandoCupom || !codigoCupom.trim()}
                className="px-5 py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-gray-800 disabled:opacity-40 transition-all flex items-center gap-1.5"
              >
                {validandoCupom ? <Loader2 size={14} className="animate-spin" /> : <Tag size={14} />}
                Aplicar
              </button>
            </div>
          )}

          {cupomErro && (
            <p className="text-xs text-red-600 mt-2 flex items-center gap-1">
              <X size={12} /> {cupomErro}
            </p>
          )}
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
          <p className="text-xs text-gray-500 mb-2">
            Pacote: <span className="font-semibold text-gray-700">{pacoteInfo.label}</span>
          </p>
          <div className="flex justify-between items-center mb-4">
            <span className="text-gray-600 font-medium">
              Total {periodicidade === 'ANUAL' ? 'anual' : 'mensal'}
            </span>
            <div className="text-right">
              {temDesconto && (
                <span className="text-sm text-gray-400 line-through mr-2">
                  R$ {totalBase.toFixed(2)}
                </span>
              )}
              <span className={`text-2xl font-bold ${temDesconto ? 'text-green-600' : 'text-gray-900'}`}>
                {total === 0 ? 'GRÁTIS' : `R$ ${total.toFixed(2)}`}
              </span>
            </div>
          </div>
          {temDesconto && cupomValidado && (
            <div className="mb-4 flex items-center gap-1.5 text-xs text-green-600 bg-green-50 px-3 py-2 rounded-lg">
              <Tag size={12} />
              <span className="font-semibold">{cupomValidado.descricao}</span>
            </div>
          )}
          <button onClick={handleContratar} disabled={submitting || selecionados.length === 0}
            className="w-full py-4 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-all disabled:opacity-60 flex items-center justify-center gap-2">
            {submitting ? <><Loader2 size={18} className="animate-spin" />Processando...</> : <>{formaPagamento === 'PIX' ? <QrCode size={18} /> : <CreditCard size={18} />}Contratar Módulos<ChevronRight size={18} /></>}
          </button>
        </div>
      </div>
    </div>
  );
};
