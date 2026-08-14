import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Loader2 } from 'lucide-react';
import api from '../../services/api';

type Modulo = { slug: string; nome: string; descricao: string; preco?: string };

export const MarketingProduto: React.FC = () => {
  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/modulos')
      .then((r) => setModulos(r.data || []))
      .catch(() => setModulos([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <section className="bg-lunardeli-dark text-white py-16 sm:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-red-300 mb-3">
            Produto
          </p>
          <h1 className="font-display text-4xl sm:text-5xl font-extrabold max-w-3xl leading-tight">
            Módulos pensados para o dia a dia da obra.
          </h1>
          <p className="mt-5 text-white/80 max-w-2xl text-lg">
            Ative o que precisa, por obra e por equipe. RDO, qualidade, concretagem
            e inteligência artificial no mesmo ambiente.
          </p>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
        {loading ? (
          <div className="flex justify-center py-20 text-gray-400">
            <Loader2 className="animate-spin" size={32} />
          </div>
        ) : (
          <div className="space-y-0 divide-y divide-lunardeli-lightGray border-y border-lunardeli-lightGray">
            {(modulos.length
              ? modulos
              : [
                  {
                    slug: 'RDO',
                    nome: 'Relatório Diário de Obra',
                    descricao:
                      'Registre clima, efetivo, atividades e anexos com fluxo de aprovação.',
                  },
                  {
                    slug: 'FVS',
                    nome: 'Ficha de Verificação',
                    descricao: 'Checklist de qualidade alinhado ao canteiro.',
                  },
                  {
                    slug: 'IA',
                    nome: 'Análise com IA',
                    descricao: 'Luna consulta diários e fontes técnicas confiáveis.',
                  },
                ]
            ).map((m) => (
              <div
                key={m.slug}
                className="py-8 sm:py-10 sm:grid sm:grid-cols-[220px_1fr] gap-6"
              >
                <p className="text-xs font-bold uppercase tracking-wider text-lunardeli-red mb-2 sm:mb-0">
                  {m.slug}
                </p>
                <div>
                  <h2 className="font-display text-2xl font-bold text-lunardeli-dark">
                    {m.nome}
                  </h2>
                  <p className="mt-2 text-gray-600 leading-relaxed max-w-2xl">
                    {m.descricao}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-12 flex flex-wrap gap-3">
          <Link
            to="/precos"
            className="inline-flex items-center gap-2 px-5 py-3 bg-lunardeli-red text-white font-bold rounded-lg hover:bg-lunardeli-deep"
          >
            Ver preços <ArrowRight size={16} />
          </Link>
          <Link
            to="/register"
            className="inline-flex items-center gap-2 px-5 py-3 border border-lunardeli-lightGray font-semibold rounded-lg hover:border-lunardeli-red"
          >
            Criar conta
          </Link>
        </div>
      </section>
    </div>
  );
};
