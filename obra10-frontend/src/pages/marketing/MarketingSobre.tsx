import React from 'react';
import { Link } from 'react-router-dom';

export const MarketingSobre: React.FC = () => {
  return (
    <div>
      <section className="bg-lunardeli-gray py-16 sm:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-lunardeli-red mb-3">
            Sobre
          </p>
          <h1 className="font-display text-4xl sm:text-5xl font-extrabold text-lunardeli-dark max-w-3xl leading-tight">
            Obra 10 nasceu na Lunardeli Engenharia.
          </h1>
          <p className="mt-6 text-lg text-gray-700 max-w-2xl leading-relaxed">
            Leva para o digital o mesmo cuidado que a Lunardeli aplica em projetos
            e obras: qualidade, confiabilidade, segurança, comprometimento e
            evolução.
          </p>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 grid md:grid-cols-[1fr_280px] gap-12 items-start">
        <div className="space-y-6 text-gray-700 leading-relaxed">
          <p>
            O Obra 10 é o sistema de gestão de obras da Lunardeli — feito para
            construtoras e equipes de campo que precisam de diário de obra,
            controle de equipe e visão gerencial sem perder a seriedade da
            engenharia.
          </p>
          <p>
            Os pilares da identidade Lunardeli — <strong>modernidade</strong>,{' '}
            <strong>credibilidade</strong> e <strong>segurança</strong> —
            orientam o produto: interface clara, permissões reais e suporte
            humano quando você precisa.
          </p>
          <p>
            Conheça também a engenharia em{' '}
            <a
              href="https://www.lunardeli.com.br/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-lunardeli-red hover:underline"
            >
              lunardeli.com.br
            </a>
            .
          </p>
          <Link
            to="/contato"
            className="inline-flex mt-4 px-5 py-3 bg-lunardeli-red text-white font-bold rounded-lg hover:bg-lunardeli-deep"
          >
            Falar com a equipe
          </Link>
        </div>
        <div className="bg-white border border-lunardeli-lightGray p-6 text-center">
          <img
            src="/brand/lunardeli-logo.jpg"
            alt="Lunardeli Engenharia"
            className="mx-auto max-h-40 object-contain"
          />
          <p className="mt-4 text-xs text-gray-500 uppercase tracking-wider font-bold">
            Marca-mãe
          </p>
        </div>
      </section>
    </div>
  );
};
