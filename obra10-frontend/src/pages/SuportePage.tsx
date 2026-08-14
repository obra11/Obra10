import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Headphones,
  Loader2,
  MessageCircle,
  Plus,
  RefreshCw,
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { CHAMADO_CATEGORIAS, SUPPORT_FAQ } from '../data/supportFaq';
import {
  buildSupportWhatsAppMessage,
  openSupportWhatsApp,
} from '../utils/whatsappSupport';

type Tab = 'faq' | 'chamados' | 'novo';

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

  const [assunto, setAssunto] = useState('');
  const [categoria, setCategoria] = useState('TECNICO');
  const [descricao, setDescricao] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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

  const handleWhatsAppRapido = () => {
    const msg = buildSupportWhatsAppMessage({
      nome: user?.nome,
      email: user?.email,
      empresa: empresaNome,
    });
    openSupportWhatsApp(msg);
  };

  const criarChamado = async (abrirWhatsapp: boolean) => {
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
        marcarWhatsapp: abrirWhatsapp,
      });
      const criado = res.data as Chamado;
      setSuccess('Chamado registrado com sucesso.');
      setAssunto('');
      setDescricao('');
      setCategoria('TECNICO');
      if (abrirWhatsapp) {
        openSupportWhatsApp(
          buildSupportWhatsAppMessage({
            nome: user?.nome,
            email: user?.email,
            empresa: empresaNome,
            assunto: criado.assunto,
            categoria: criado.categoria,
            descricao: criado.descricao,
            chamadoId: criado.id,
          }),
        );
      }
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
                FAQ, chamados e contato via WhatsApp
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
                    <div className="px-5 pb-4 text-sm text-gray-600 leading-relaxed">
                      {item.resposta}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
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
                  <li key={c.id} className="px-5 py-4">
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
                      {new Date(c.createdAt).toLocaleString('pt-BR')}
                      {c.usuario?.nome ? ` · ${c.usuario.nome}` : ''}
                    </p>
                    <p className="text-sm text-gray-600 whitespace-pre-wrap line-clamp-3">
                      {c.descricao}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {tab === 'novo' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sm:p-6 space-y-4">
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
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => criarChamado(false)}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 border border-gray-200 rounded-lg font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {saving ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
                Salvar chamado
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => criarChamado(true)}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg disabled:opacity-50"
              >
                <MessageCircle size={18} />
                Salvar e abrir WhatsApp
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SuportePage;
