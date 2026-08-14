import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ClipboardCheck, ShieldCheck, Sparkles } from 'lucide-react';
import { Obra10Logo } from '../../components/Obra10Logo';

const BENEFICIOS = [
  {
    icon: ClipboardCheck,
    title: 'RDO no canteiro',
    text: 'Diários digitais com aprovação, anexos e histórico — sem papel perdido.',
  },
  {
    icon: ShieldCheck,
    title: 'Controle e permissões',
    text: 'Funções personalizadas por obra e empresa, com rastreabilidade.',
  },
  {
    icon: Sparkles,
    title: 'IA a serviço da obra',
    text: 'Luna responde com dados reais do diário e apoio técnico confiável.',
  },
];

export const MarketingHome: React.FC = () => {
  return (
    <div>
      {/* Hero */}
      <section className="relative min-h-[calc(100vh-4rem)] flex items-center overflow-hidden bg-lunardeli-dark text-white">
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              'linear-gradient(120deg, rgba(176,16,32,0.85) 0%, rgba(27,27,27,0.92) 55%), url(/brand/lunardeli-logo.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(229,25,44,0.35),_transparent_55%)]" />

        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-20 w-full">
          <div className="animate-mkt-fade-up">
            <Obra10Logo size={48} withWordmark wordmarkClassName="text-white" />
          </div>
          <h1 className="mt-8 font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight max-w-3xl leading-[1.05] animate-mkt-fade-up [animation-delay:120ms]">
            Gestão inteligente no canteiro de obras.
          </h1>
          <p className="mt-5 text-lg sm:text-xl text-white/85 max-w-xl leading-relaxed animate-mkt-fade-up [animation-delay:220ms]">
            Modernidade, credibilidade e segurança para acompanhar execução,
            RDOs e equipe — com a marca Lunardeli.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-3 animate-mkt-fade-up [animation-delay:320ms]">
            <Link
              to="/register"
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-lunardeli-red hover:bg-lunardeli-deep text-white font-bold rounded-lg transition-colors"
            >
              Começar <ArrowRight size={18} />
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center justify-center px-6 py-3.5 border border-white/40 hover:bg-white/10 text-white font-semibold rounded-lg transition-colors"
            >
              Área do cliente
            </Link>
          </div>
        </div>
      </section>

      {/* Benefícios */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-lunardeli-red mb-3">
          Por que Obra 10
        </p>
        <h2 className="font-display text-3xl sm:text-4xl font-bold text-lunardeli-dark max-w-2xl">
          Feito para quem vive obra — não para planilha improvisada.
        </h2>
        <div className="mt-12 grid gap-10 md:grid-cols-3">
          {BENEFICIOS.map((b) => (
            <div key={b.title} className="border-t-2 border-lunardeli-red pt-6">
              <b.icon className="text-lunardeli-red mb-4" size={28} />
              <h3 className="font-display text-xl font-bold mb-2">{b.title}</h3>
              <p className="text-gray-600 text-sm leading-relaxed">{b.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Módulos teaser */}
      <section className="bg-lunardeli-gray py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-10">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-lunardeli-red mb-3">
                Módulos
              </p>
              <h2 className="font-display text-3xl font-bold">
                Contrate só o que a obra precisa.
              </h2>
            </div>
            <Link
              to="/produto"
              className="inline-flex items-center gap-2 text-sm font-bold text-lunardeli-red hover:underline"
            >
              Ver produto <ArrowRight size={16} />
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            {['RDO', 'FVS', 'Concretagem', 'IA Luna'].map((nome) => (
              <div
                key={nome}
                className="bg-white border border-lunardeli-lightGray px-5 py-6 font-display font-bold text-lg"
              >
                {nome}
              </div>
            ))}
          </div>
          <div className="mt-10">
            <Link
              to="/precos"
              className="inline-flex items-center gap-2 px-5 py-3 bg-lunardeli-dark text-white font-bold rounded-lg hover:bg-black transition-colors"
            >
              Ver preços <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="relative overflow-hidden bg-lunardeli-red text-white py-20">
        <div className="absolute right-0 top-0 opacity-20 pointer-events-none">
          <img src="/brand/lunardeli-simbolo.jpg" alt="" className="w-64 h-64 object-contain invert" />
        </div>
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold max-w-xl">
            Comece hoje. Seu canteiro no controle.
          </h2>
          <p className="mt-4 text-white/90 max-w-lg">
            Crie a conta da empresa ou acesse a área do cliente se já for usuário.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Link
              to="/register"
              className="inline-flex justify-center px-6 py-3.5 bg-white text-lunardeli-red font-bold rounded-lg hover:bg-gray-100"
            >
              Criar conta
            </Link>
            <Link
              to="/contato"
              className="inline-flex justify-center px-6 py-3.5 border border-white/50 font-semibold rounded-lg hover:bg-white/10"
            >
              Falar conosco
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};
