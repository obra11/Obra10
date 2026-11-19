import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Copy,
  Headphones,
  Loader2,
  MessageCircle,
  RefreshCw,
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { CHAMADO_CATEGORIAS, SUPPORT_FAQ } from '../data/supportFaq';
import {
  MCP_CLIENT_STEPS,
  MCP_CONNECT_GUIDE,
  MCP_TOKEN_CURL,
  MCP_URL,
} from '../data/mcpConnect';
import {
  buildSupportWhatsAppMessage,
  openSupportWhatsApp,
} from '../utils/whatsappSupport';
import { appVersionSupportLine } from '../appVersion';
import { AppVersionBadge } from '../components/AppVersionBadge';
import { InstallAppCard } from '../components/InstallAppCard';

type Tab = 'faq' | 'chamados' | 'novo';

type Mensagem = {
  id: string;
  corpo: string;
  autorTipo: 'USUARIO' | 'SUPORTE';
  createdAt: string;
  autor?: { id: string; nome: string; email: string };
};

type Chamado = {
  id: string;
  assunto: string;
  categoria: string;
  descricao: string;
  status: string;
  whatsappEnviadoEm?: string | null;
  createdAt: string;
  updatedAt: string;
  usuario?: { id: string; nome: string; email: string };
  empresa?: { id: string; razaoSocial?: string; nomeFantasia?: string };
  mensagens?: Mensagem[];
};

const STATUS_LABEL: Record<string, string> = {
  ABERTO: 'Aberto',
  EM_ANDAMENTO: 'Em andamento',
  AGUARDANDO_USUARIO: 'Aguardando você',
  RESOLVIDO: 'Resolvido',
  FECHADO: 'Fechado',
};

const STATUS_COLOR: Record<string, string> = {
  ABERTO: 'bg-yellow-50 text-yellow-800 border-yellow-200',
  EM_ANDAMENTO: 'bg-blue-50 text-blue-800 border-blue-200',
  AGUARDANDO_USUARIO: 'bg-orange-50 text-orange-800 border-orange-200',
  RESOLVIDO: 'bg-green-50 text-green-800 border-green-200',
  FECHADO: 'bg-gray-100 text-gray-600 border-gray-200',
};

export const SuportePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, empresa } = useAuth();
  const [tab, setTab] = useState<Tab>('faq');
  const [faqOpen, setFaqOpen] = useState<string | null>(SUPPORT_FAQ[0]?.id ?? null);

  const [chamados, setChamados] = useState<Chamado[]>([]);
  const [loadingLista, setLoadingLista] = useState(false);
  const [abrindoId, setAbrindoId] = useState<string | null>(null);

  const [assunto, setAssunto] = useState('');
  const [categoria, setCategoria] = useState('TECNICO');
  const [descricao, setDescricao] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  const copiar = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
    }
  };

  const empresaNome =
    empresa?.nomeFantasia || empresa?.razaoSocial || 'Minha empresa';

  const carregarChamados = useCallback(async () => {
    setLoadingLista(true);
    try {
      const res = await api.get('/suporte/chamados');
      setChamados(res.data);
    } catch {
      setError('Não foi possível carregar seus chamados.');
    } finally {
      setLoadingLista(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'chamados') carregarChamados();
  }, [tab, carregarChamados]);

  const mensagemDoChamado = (c: Partial<Chamado>) =>
    buildSupportWhatsAppMessage({
      nome: user?.nome,
      email: user?.email,
      empresa: empresaNome,
      assunto: c.assunto,
      categoria: c.categoria,
      descricao: c.descricao,
      chamadoId: c.id,
      appVersion: appVersionSupportLine(),
    });

  const handleWhatsAppRapido = () => {
    openSupportWhatsApp(mensagemDoChamado({}));
  };

  const continuarChamadoNoWhatsApp = async (id: string) => {
    setAbrindoId(id);
    setError('');
    try {
      const res = await api.get(`/suporte/chamados/${id}`);
      const chamado = res.data as Chamado;
      try {
        await api.patch(`/suporte/chamados/${id}`, { marcarWhatsapp: true });
      } catch {
        /* o WhatsApp ainda abre mesmo se o carimbo falhar */
      }
      openSupportWhatsApp(mensagemDoChamado(chamado));
    } catch {
      setError('Não foi possível abrir o chamado no WhatsApp.');
    } finally {
      setAbrindoId(null);
    }
  };

  const criarChamado = async () => {
    setError('');
    setSuccess('');
    if (assunto.trim().length < 3 || descricao.trim().length < 5) {
      setError('Preencha assunto (mín. 3) e descrição (mín. 5 caracteres).');
      return;
    }
    setSaving(true);
    try {
      const res = await api.post('/suporte/chamados', {
        assunto: assunto.trim(),
        categoria,
        descricao: descricao.trim(),
        marcarWhatsapp: true,
      });
      const criado = res.data as Chamado;
      setSuccess('Chamado registrado. Abrindo o WhatsApp para conversar com o suporte.');
      setAssunto('');
      setDescricao('');
      setCategoria('TECNICO');
      openSupportWhatsApp(mensagemDoChamado(criado));
      setTab('chamados');
      await carregarChamados();
    } catch (e: any) {
      setError(
        e?.response?.data?.message || 'Erro ao salvar o chamado. Tente novamente.',
      );
    } finally {
      setSaving(false);
    }
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'faq', label: 'FAQ' },
    { id: 'chamados', label: 'Meus chamados' },
    { id: 'novo', label: 'Novo chamado' },
  ];

  return (
    <div className="min-h-screen bg-lunardeli-gray">
      <div className="max-w-3xl mx-auto px-4 py-6 sm:py-10">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center text-sm font-semibold text-gray-500 hover:text-lunardeli-red mb-4"
        >
          <ArrowLeft size={16} className="mr-1" /> Voltar
        </button>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-lunardeli-red text-white flex items-center justify-center">
              <Headphones size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-lunardeli-dark">
                Central de Suporte
              </h1>
              <p className="text-sm text-gray-500">
                FAQ e chamados — o atendimento é pelo WhatsApp
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleWhatsAppRapido}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-colors"
          >
            <MessageCircle size={18} />
            Falar no WhatsApp
          </button>
        </div>

        <div className="mb-6 space-y-3">
          <InstallAppCard />
          <AppVersionBadge />
        </div>

        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors ${
                tab === t.id
                  ? 'bg-lunardeli-red text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-lunardeli-red/40'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border-l-4 border-lunardeli-red text-red-700 text-sm rounded-r">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 bg-green-50 border-l-4 border-green-500 text-green-800 text-sm rounded-r">
            {success}
          </div>
        )}

        {tab === 'faq' && (
          <>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-lunardeli-red mb-1">
              Integração
            </p>
            <h2 className="text-lg font-bold text-lunardeli-dark mb-2">
              ChatGPT, Claude e Gemini (MCP)
            </h2>
            <p className="text-sm text-gray-600 mb-3">
              Servidor remoto só de leitura, com o mesmo login do Obra 10. A empresa sai do token — não cruza construtora.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 mb-4">
              <code className="flex-1 text-xs bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 break-all">
                {MCP_URL}
              </code>
              <button
                type="button"
                onClick={() => copiar('url', MCP_URL)}
                className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 hover:border-lunardeli-red/40"
              >
                <Copy size={14} /> {copied === 'url' ? 'Copiado' : 'Copiar URL'}
              </button>
              <button
                type="button"
                onClick={() => copiar('curl', MCP_TOKEN_CURL)}
                className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 hover:border-lunardeli-red/40"
              >
                <Copy size={14} /> {copied === 'curl' ? 'Copiado' : 'Copiar curl do token'}
              </button>
            </div>
            <ul className="space-y-3">
              {MCP_CLIENT_STEPS.map((step) => (
                <li key={step.id}>
                  <p className="text-sm font-bold text-lunardeli-dark">{step.title}</p>
                  <p className="text-sm text-gray-600 leading-relaxed">{step.body}</p>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => copiar('guia', MCP_CONNECT_GUIDE)}
              className="mt-4 text-sm font-semibold text-lunardeli-red"
            >
              {copied === 'guia' ? 'Guia copiado' : 'Copiar o guia completo'}
            </button>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-100 overflow-hidden">
            {SUPPORT_FAQ.map((item) => {
              const open = faqOpen === item.id;
              return (
                <div key={item.id}>
                  <button
                    type="button"
                    onClick={() => setFaqOpen(open ? null : item.id)}
                    className="w-full flex items-start justify-between gap-3 px-5 py-4 text-left hover:bg-gray-50"
                  >
                    <div>
                      {item.categoria && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-lunardeli-red">
                          {item.categoria}
                        </span>
                      )}
                      <p className="font-semibold text-lunardeli-dark">{item.pergunta}</p>
                    </div>
                    {open ? (
                      <ChevronUp className="shrink-0 text-gray-400 mt-1" size={18} />
                    ) : (
                      <ChevronDown className="shrink-0 text-gray-400 mt-1" size={18} />
                    )}
                  </button>
                  {open && (
                    <div className="px-5 pb-4 text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                      {item.resposta}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          </>
        )}

        {tab === 'chamados' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-700">Histórico</p>
              <button
                type="button"
                onClick={carregarChamados}
                className="text-gray-500 hover:text-lunardeli-red p-2 rounded-lg"
                title="Atualizar"
              >
                <RefreshCw size={16} className={loadingLista ? 'animate-spin' : ''} />
              </button>
            </div>
            {loadingLista ? (
              <div className="p-10 flex justify-center text-gray-400">
                <Loader2 className="animate-spin" size={28} />
              </div>
            ) : chamados.length === 0 ? (
              <div className="p-10 text-center text-gray-500 text-sm">
                Nenhum chamado ainda.{' '}
                <button
                  type="button"
                  className="text-lunardeli-red font-semibold"
                  onClick={() => setTab('novo')}
                >
                  Abrir o primeiro
                </button>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {chamados.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => continuarChamadoNoWhatsApp(c.id)}
                      disabled={abrindoId === c.id}
                      className="w-full text-left px-5 py-4 hover:bg-gray-50 transition-colors disabled:opacity-60"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2 mb-1">
                        <p className="font-semibold text-lunardeli-dark">{c.assunto}</p>
                        <span
                          className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                            STATUS_COLOR[c.status] || STATUS_COLOR.FECHADO
                          }`}
                        >
                          {STATUS_LABEL[c.status] || c.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mb-2">
                        {c.categoria} ·{' '}
                        {new Date(c.updatedAt || c.createdAt).toLocaleString('pt-BR')}
                        {c.usuario?.nome ? ` · ${c.usuario.nome}` : ''}
                      </p>
                      <p className="text-sm text-gray-600 whitespace-pre-wrap line-clamp-2">
                        {c.descricao}
                      </p>
                      <p className="text-xs font-semibold text-green-700 mt-2 inline-flex items-center gap-1">
                        <MessageCircle size={12} />
                        {abrindoId === c.id ? 'Abrindo WhatsApp…' : 'Continuar no WhatsApp'}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {tab === 'novo' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sm:p-6 space-y-4">
            <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
              O chamado fica registrado aqui e a conversa abre direto no WhatsApp com o suporte Obra 10.
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Assunto
              </label>
              <input
                value={assunto}
                onChange={(e) => setAssunto(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-lunardeli-red/40"
                placeholder="Ex.: PIX pago e módulos não liberaram"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Categoria
              </label>
              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-lunardeli-red/40 bg-white"
              >
                {CHAMADO_CATEGORIAS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Descrição
              </label>
              <textarea
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                rows={5}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-lunardeli-red/40 resize-y"
                placeholder="Conte o que aconteceu, o que já tentou e como reproduzir o problema."
              />
            </div>
            <div className="pt-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => criarChamado()}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg disabled:opacity-50"
              >
                {saving ? <Loader2 className="animate-spin" size={18} /> : <MessageCircle size={18} />}
                Abrir chamado no WhatsApp
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SuportePage;
