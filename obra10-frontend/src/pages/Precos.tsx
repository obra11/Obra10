import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { Loader2, ChevronRight, Zap } from 'lucide-react';

interface Modulo { slug: string; nome: string; descricao: string; preco: string; }

const ICONS: Record<string, string> = { RDO: '📋', FVS: '✅', PROJETOS: '📁', CONCRETO: '🏗️', IA: '🤖' };

export const Precos: React.FC = () => {
  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { api.get('/modulos').then(r => { setModulos(r.data); setLoading(false); }); }, []);

  const total = modulos.reduce((s, m) => s + parseFloat(m.preco), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-red-950">
      {/* Hero */}
      <div className="text-center py-20 px-4">
        <div className="inline-flex items-center gap-2 bg-red-500/20 border border-red-500/30 rounded-full px-4 py-1.5 text-red-300 text-sm font-medium mb-6">
          <Zap size={14} />Pagamento por módulo — só use o que precisa
        </div>
        <h1 className="text-5xl font-black text-white mb-4 leading-tight">
          Preços simples<br /><span className="text-red-400">e transparentes</span>
        </h1>
        <p className="text-gray-400 text-lg max-w-xl mx-auto">
          Sem contrato de fidelidade. Ative ou desative módulos a qualquer momento.
          RDO grátis no primeiro mês para novos tenants.
        </p>
      </div>

      {/* Cards */}
      {loading ? (
        <div className="flex justify-center pb-20"><Loader2 size={40} className="animate-spin text-red-400" /></div>
      ) : (
        <div className="max-w-5xl mx-auto px-4 pb-16">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {modulos.map((m) => {
              const isFree = m.slug === 'RDO';
              return (
                <div key={m.slug} className="relative bg-gray-800/60 border border-gray-700 rounded-2xl p-6 hover:border-red-500/50 transition-all group">
                  {isFree && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                      1º MÊS GRÁTIS
                    </div>
                  )}
                  <div className="text-4xl mb-3">{ICONS[m.slug] || '📦'}</div>
                  <h3 className="text-lg font-bold text-white mb-1">{m.nome}</h3>
                  <p className="text-gray-400 text-sm mb-4 leading-relaxed">{m.descricao}</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black text-white">R$ {parseFloat(m.preco).toFixed(2).replace('.', ',')}</span>
                    <span className="text-gray-500 text-sm">/mês</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* CTA */}
          <div className="bg-gradient-to-r from-red-600 to-red-700 rounded-2xl p-8 text-center">
            <h2 className="text-2xl font-bold text-white mb-2">Comece agora</h2>
            <p className="text-red-200 mb-6 text-sm">Acesso a todos os {modulos.length} módulos por R$ {total.toFixed(2)}/mês</p>
            <Link to="/register"
              className="inline-flex items-center gap-2 bg-white text-red-600 font-bold px-8 py-4 rounded-xl hover:bg-gray-100 transition-all">
              Criar conta grátis<ChevronRight size={20} />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};
