import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { Loader2, ArrowRight } from 'lucide-react';
import {
  PLANOS,
  PLANO_KEYS,
  labelPlano,
  pacoteDoPlano,
  precoComPacote,
  resumoPlano,
} from '../utils/pacotesObras';
import type { PlanoNome } from '../utils/pacotesObras';

interface Modulo {
  slug: string;
  nome: string;
  descricao: string;
  preco: string | number;
  precoAnual?: string | number;
}

export const Precos: React.FC = () => {
  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodicidade, setPeriodicidade] = useState<'MENSAL' | 'ANUAL'>('MENSAL');
  const [plano, setPlano] = useState<PlanoNome>('PRO');

  useEffect(() => {
    api
      .get('/modulos')
      .then((r) => {
        setModulos(r.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const pacoteObras = pacoteDoPlano(plano);

  const precoDe = (m: Modulo) => {
    const mensal = parseFloat(String(m.preco || '0'));
    const anual = parseFloat(String(m.precoAnual || '0'));
    const base = periodicidade === 'ANUAL' ? (anual > 0 ? anual : mensal * 11) : mensal;
    return precoComPacote(base, pacoteObras);
  };

  const total = modulos.reduce((s, m) => s + precoDe(m), 0);

  return (
    <div>
      <section className="bg-lunardeli-dark text-white py-16 sm:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-red-300 mb-3">
            Preços
          </p>
          <h1 className="font-display text-4xl sm:text-5xl font-extrabold max-w-3xl leading-tight">
            Preços simples e transparentes.
          </h1>
          <p className="mt-5 text-white/80 text-lg max-w-2xl">
            Escolha o plano (Básico, Pro ou Enterprise), mensal ou anual, e pague só pelos
            módulos que a obra precisa. O Pro usa os preços de tabela.
          </p>
          <div className="mt-8 flex flex-col gap-4">
            <div className="grid sm:grid-cols-3 gap-2">
              {PLANO_KEYS.map((key) => {
                const selected = plano === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setPlano(key)}
                    className={`text-left px-4 py-3 rounded-lg border transition-colors ${
                      selected
                        ? 'bg-white text-lunardeli-dark border-white'
                        : 'bg-white/5 text-white border-white/20 hover:bg-white/10'
                    }`}
                  >
                    <p className="text-sm font-bold">Plano {PLANOS[key].label}</p>
                    <p className={`text-xs mt-0.5 ${selected ? 'text-gray-500' : 'text-white/70'}`}>
                      {resumoPlano(key)}
                    </p>
                  </button>
                );
              })}
            </div>
            <div className="inline-flex bg-white/10 rounded-lg p-1 gap-1 w-max">
              <button
                type="button"
                onClick={() => setPeriodicidade('MENSAL')}
                className={`px-5 py-2.5 rounded-md text-sm font-bold transition-colors ${
                  periodicidade === 'MENSAL' ? 'bg-white text-lunardeli-dark' : 'text-white/80'
                }`}
              >
                Mensal
              </button>
              <button
                type="button"
                onClick={() => setPeriodicidade('ANUAL')}
                className={`px-5 py-2.5 rounded-md text-sm font-bold transition-colors ${
                  periodicidade === 'ANUAL' ? 'bg-white text-lunardeli-dark' : 'text-white/80'
                }`}
              >
                Anual
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
        {loading ? (
          <div className="flex justify-center py-20 text-gray-400">
            <Loader2 className="animate-spin" size={36} />
          </div>
        ) : (
          <>
            <div className="divide-y divide-lunardeli-lightGray border-y border-lunardeli-lightGray">
              {modulos.map((m) => {
                const valor = precoDe(m);
                const mensal = parseFloat(String(m.preco || '0'));
                return (
                  <div
                    key={m.slug}
                    className="py-8 sm:grid sm:grid-cols-[1fr_auto] gap-6 items-start"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h2 className="font-display text-xl font-bold text-lunardeli-dark">
                          {m.nome}
                        </h2>
                        {m.slug === 'RDO' && (
                          <span className="text-[10px] font-bold uppercase tracking-wider bg-green-100 text-green-800 px-2 py-0.5 rounded">
                            1º mês grátis
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 leading-relaxed max-w-2xl">
                        {m.descricao}
                      </p>
                    </div>
                    <div className="mt-3 sm:mt-0 sm:text-right shrink-0">
                      <p className="font-display text-2xl font-extrabold text-lunardeli-dark">
                        R$ {valor.toFixed(2).replace('.', ',')}
                      </p>
                      <p className="text-xs text-gray-500">
                        /{periodicidade === 'ANUAL' ? 'ano' : 'mês'} · Plano {labelPlano(plano)}
                      </p>
                      {periodicidade === 'ANUAL' && mensal > 0 && (
                        <p className="text-[11px] text-gray-400 mt-1">
                          mensal tabela: R$ {mensal.toFixed(2).replace('.', ',')}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-12 bg-lunardeli-red text-white px-6 sm:px-10 py-10">
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold">
                Comece agora
              </h2>
              <p className="mt-2 text-white/90 text-sm sm:text-base max-w-xl">
                {modulos.length
                  ? `Plano ${labelPlano(plano)}: R$ ${total.toFixed(2).replace('.', ',')}/${periodicidade === 'ANUAL' ? 'ano' : 'mês'} (todos os módulos) — escolha só o que precisa no cadastro.`
                  : 'Crie sua conta e escolha os módulos no onboarding.'}
              </p>
              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <Link
                  to={`/register?pacote=${pacoteObras}&plano=${plano}`}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-lunardeli-red font-bold rounded-lg hover:bg-gray-100"
                >
                  Criar conta <ArrowRight size={18} />
                </Link>
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center px-6 py-3 border border-white/50 font-semibold rounded-lg hover:bg-white/10"
                >
                  Área do cliente
                </Link>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
};
