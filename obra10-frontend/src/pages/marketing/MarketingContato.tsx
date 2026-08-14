import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, MessageCircle, Mail } from 'lucide-react';
import api from '../../services/api';
import { openSupportWhatsApp, buildSupportWhatsAppMessage } from '../../utils/whatsappSupport';

export const MarketingContato: React.FC = () => {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [sending, setSending] = useState(false);
  const [ok, setOk] = useState('');
  const [error, setError] = useState('');

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setOk('');
    setError('');
    if (!nome.trim() || !email.trim() || !mensagem.trim()) {
      setError('Preencha nome, e-mail e mensagem.');
      return;
    }
    setSending(true);
    try {
      await api.post('/contato', {
        nome: nome.trim(),
        email: email.trim(),
        telefone: telefone.trim() || undefined,
        mensagem: mensagem.trim(),
      });
      setOk('Mensagem enviada. Retornamos em contato@obra10.com.br.');
      setNome('');
      setEmail('');
      setTelefone('');
      setMensagem('');
    } catch (err: any) {
      // Fallback mailto se API falhar
      const subject = encodeURIComponent(`Contato Obra 10 — ${nome.trim()}`);
      const body = encodeURIComponent(
        `Nome: ${nome.trim()}\nE-mail: ${email.trim()}\nTelefone: ${telefone.trim()}\n\n${mensagem.trim()}`,
      );
      window.location.href = `mailto:contato@obra10.com.br?subject=${subject}&body=${body}`;
      setOk('Abrimos seu e-mail para envio. Se preferir, use o WhatsApp.');
    } finally {
      setSending(false);
    }
  };

  const wa = () => {
    openSupportWhatsApp(
      buildSupportWhatsAppMessage({
        nome: nome || 'Visitante do site',
        email,
        assunto: 'Contato pelo site Obra 10',
        descricao: mensagem || 'Gostaria de saber mais sobre o Obra 10.',
      }),
    );
  };

  return (
    <div>
      <section className="bg-lunardeli-dark text-white py-16 sm:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-red-300 mb-3">
            Contato
          </p>
          <h1 className="font-display text-4xl sm:text-5xl font-extrabold max-w-2xl">
            Fale com a equipe Obra 10.
          </h1>
          <p className="mt-4 text-white/80 max-w-xl">
            Respostas em <strong>contato@obra10.com.br</strong> ou pelo WhatsApp
            de suporte.
          </p>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 grid lg:grid-cols-2 gap-12">
        <form onSubmit={enviar} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border-l-4 border-lunardeli-red text-red-700 text-sm">
              {error}
            </div>
          )}
          {ok && (
            <div className="p-3 bg-green-50 border-l-4 border-green-600 text-green-800 text-sm">
              {ok}
            </div>
          )}
          <div>
            <label className="block text-sm font-semibold mb-1">Nome</label>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-full border border-lunardeli-lightGray rounded-lg px-3 py-2.5 outline-none focus:border-lunardeli-red"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-lunardeli-lightGray rounded-lg px-3 py-2.5 outline-none focus:border-lunardeli-red"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Telefone</label>
            <input
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              className="w-full border border-lunardeli-lightGray rounded-lg px-3 py-2.5 outline-none focus:border-lunardeli-red"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Mensagem</label>
            <textarea
              rows={5}
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              className="w-full border border-lunardeli-lightGray rounded-lg px-3 py-2.5 outline-none focus:border-lunardeli-red"
            />
          </div>
          <button
            type="submit"
            disabled={sending}
            className="inline-flex items-center gap-2 px-6 py-3 bg-lunardeli-red hover:bg-lunardeli-deep text-white font-bold rounded-lg disabled:opacity-60"
          >
            {sending ? <Loader2 className="animate-spin" size={18} /> : <Mail size={18} />}
            Enviar mensagem
          </button>
        </form>

        <div className="space-y-6">
          <div className="border border-lunardeli-lightGray p-6">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
              E-mail
            </p>
            <a
              href="mailto:contato@obra10.com.br"
              className="text-lg font-semibold text-lunardeli-red hover:underline"
            >
              contato@obra10.com.br
            </a>
          </div>
          <div className="border border-lunardeli-lightGray p-6">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">
              WhatsApp
            </p>
            <button
              type="button"
              onClick={wa}
              className="inline-flex items-center gap-2 px-5 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg"
            >
              <MessageCircle size={18} /> Falar no WhatsApp
            </button>
          </div>
          <p className="text-sm text-gray-600">
            Já é cliente?{' '}
            <Link to="/login" className="font-semibold text-lunardeli-red hover:underline">
              Acesse a Área do cliente
            </Link>
            .
          </p>
        </div>
      </section>
    </div>
  );
};
