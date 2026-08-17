import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  ArrowLeft, User, Phone, Lock, Loader2, CheckCircle, AlertCircle, Eye, EyeOff,
  Headphones, Shield, Check, X,
} from 'lucide-react';
import { AppVersionBadge } from '../components/AppVersionBadge';
import api from '../services/api';

const PERFIL_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Administrador',
  GESTOR: 'Gestor',
  USER: 'Colaborador',
  COLABORADOR: 'Colaborador',
  EXTERNO: 'Usuário externo',
  PERSONALIZADO: 'Personalizado',
};

const PERFIL_HINTS: Record<string, string> = {
  SUPER_ADMIN: 'Acesso total à plataforma Obra 10 (administração).',
  GESTOR: 'Administra a empresa, obras, usuários e módulos contratados.',
  USER: 'Colaborador com permissões definidas pela função padrão.',
  COLABORADOR: 'Colaborador com permissões definidas pela função padrão.',
  EXTERNO: 'Acesso restrito, em geral somente visualização de conteúdos aprovados.',
  PERSONALIZADO: 'Permissões configuradas individualmente pelo gestor.',
};

const CAP_ITEMS: { key: string; label: string; group: string }[] = [
  { key: 'gerenciarUsuarios', label: 'Gerenciar usuários', group: 'Empresa' },
  { key: 'gerenciarEmpresa', label: 'Editar dados da empresa', group: 'Empresa' },
  { key: 'gerenciarFinanceiro', label: 'Financeiro e plano', group: 'Empresa' },
  { key: 'gerenciarCatalogo', label: 'Cadastro Base', group: 'Empresa' },
  { key: 'criarObra', label: 'Criar nova obra', group: 'Obras' },
  { key: 'editarObra', label: 'Editar obras', group: 'Obras' },
  { key: 'excluirObra', label: 'Excluir obras', group: 'Obras' },
  { key: 'acessoTodasObras', label: 'Acesso a todas as obras', group: 'Obras' },
  { key: 'aprovarRdo', label: 'Aprovar RDO', group: 'RDO' },
  { key: 'criarEditarRdo', label: 'Criar e editar RDO', group: 'RDO' },
  { key: 'verTodosRdos', label: 'Ver todos os RDOs', group: 'RDO' },
  { key: 'verSoAprovados', label: 'Ver só RDOs aprovados', group: 'RDO' },
  { key: 'verParcialAprovados', label: 'Visualização parcial de RDO', group: 'RDO' },
];

const MODULO_NIVEL: Record<string, string> = {
  EDIT: 'Editar',
  VIEW: 'Visualizar',
  VIEW_APPROVED: 'Só aprovados',
  APPROVE: 'Aprovar',
  NONE: 'Sem acesso',
};

function perfilBadgeClass(perfil: string) {
  switch (perfil) {
    case 'SUPER_ADMIN':
      return 'bg-red-50 text-red-700 border-red-200';
    case 'GESTOR':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'EXTERNO':
      return 'bg-amber-50 text-amber-800 border-amber-200';
    case 'PERSONALIZADO':
      return 'bg-violet-50 text-violet-700 border-violet-200';
    default:
      return 'bg-gray-50 text-gray-700 border-gray-200';
  }
}

export const Perfil: React.FC = () => {
  const navigate = useNavigate();
  const { user, empresa, fetchSession } = useAuth();

  const [nome, setNome] = useState(user?.nome || '');
  const [telefone, setTelefone] = useState('');

  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const perfil = user?.perfilGlobal || '';
  const caps = user?.capabilities || {};

  const permissoesPorGrupo = useMemo(() => {
    const groups: Record<string, { key: string; label: string; ativo: boolean }[]> = {};
    for (const item of CAP_ITEMS) {
      if (!groups[item.group]) groups[item.group] = [];
      groups[item.group].push({
        key: item.key,
        label: item.label,
        ativo: Boolean((caps as Record<string, unknown>)[item.key]),
      });
    }
    return groups;
  }, [caps]);

  const modulosPadrao = caps.modulosPadrao || {};
  const temModulos = Object.keys(modulosPadrao).length > 0;

  useEffect(() => {
    if (user) {
      setNome(user.nome);
      api.get('/auth/meus-dados')
        .then(res => {
          const tel = res.data?.dadosPessoais?.telefone || '';
          // Evita exibir e-mail no campo de telefone (dado legado/incorreto)
          if (tel && tel.includes('@')) {
            setTelefone('');
          } else {
            setTelefone(tel);
          }
        })
        .catch(err => console.error('Erro ao buscar dados do usuário:', err));
    }
  }, [user]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg('');
    setErrorMsg('');

    if (novaSenha || confirmarSenha || senhaAtual) {
      if (!senhaAtual) {
        setErrorMsg('Você precisa informar sua senha atual para alterar a senha.');
        return;
      }
      if (novaSenha.length < 6) {
        setErrorMsg('A nova senha deve ter pelo menos 6 caracteres.');
        return;
      }
      if (novaSenha !== confirmarSenha) {
        setErrorMsg('As senhas digitadas não coincidem.');
        return;
      }
    }

    setLoading(true);

    try {
      const payload: any = {
        nome,
        telefone: telefone || null,
      };

      if (novaSenha) {
        payload.senhaAtual = senhaAtual;
        payload.novaSenha = novaSenha;
      }

      await api.patch('/usuarios/perfil', payload);
      await fetchSession();

      setSenhaAtual('');
      setNovaSenha('');
      setConfirmarSenha('');

      setSuccessMsg('Perfil atualizado com sucesso!');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.response?.data?.message || 'Erro ao atualizar perfil.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-lunardeli-gray p-6">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center text-gray-500 hover:text-red-600 mb-6 font-semibold transition-colors"
        >
          <ArrowLeft size={20} className="mr-2" /> Voltar ao Painel
        </button>

        <h1 className="text-3xl font-bold text-lunardeli-dark flex items-center mb-8">
          <User className="mr-3 text-red-600" size={32}/> Meu Perfil
        </h1>

        <button
          type="button"
          onClick={() => navigate('/suporte')}
          className="w-full mb-6 bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:border-lunardeli-red/40 hover:shadow-md transition-all text-left flex items-center gap-4 group"
        >
          <div className="w-12 h-12 rounded-xl bg-lunardeli-red/10 text-lunardeli-red flex items-center justify-center group-hover:bg-lunardeli-red group-hover:text-white transition-colors">
            <Headphones size={24} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-lunardeli-dark">Central de Suporte</p>
            <p className="text-sm text-gray-500">FAQ, abrir chamado e falar no WhatsApp</p>
          </div>
        </button>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6">
          <div className="flex items-start gap-3 mb-4 border-b pb-3">
            <div className="w-10 h-10 rounded-lg bg-lunardeli-red/10 text-lunardeli-red flex items-center justify-center shrink-0">
              <Shield size={20} />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-gray-800">Tipo de usuário e permissões</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Definidos pelo gestor da conta. Você não altera essas informações aqui.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="text-sm font-semibold text-gray-600">Função:</span>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${perfilBadgeClass(perfil)}`}>
              {PERFIL_LABELS[perfil] || perfil || '—'}
            </span>
          </div>
          <p className="text-sm text-gray-500 mb-5">
            {PERFIL_HINTS[perfil] || 'Permissões conforme a função atribuída na empresa.'}
            {empresa?.razaoSocial || empresa?.nomeFantasia
              ? ` Conta: ${empresa.nomeFantasia || empresa.razaoSocial}.`
              : ''}
          </p>

          <div className="space-y-5">
            {Object.entries(permissoesPorGrupo).map(([grupo, itens]) => (
              <div key={grupo}>
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">{grupo}</h3>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {itens.map((item) => (
                    <li
                      key={item.key}
                      className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 border ${
                        item.ativo
                          ? 'bg-green-50/60 border-green-100 text-gray-800'
                          : 'bg-gray-50 border-gray-100 text-gray-400'
                      }`}
                    >
                      {item.ativo ? (
                        <Check size={14} className="text-green-600 shrink-0" strokeWidth={2.5} />
                      ) : (
                        <X size={14} className="text-gray-300 shrink-0" />
                      )}
                      <span className={item.ativo ? 'font-medium' : ''}>{item.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            {temModulos && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Módulos</h3>
                <ul className="flex flex-wrap gap-2">
                  {Object.entries(modulosPadrao).map(([slug, nivel]) => (
                    <li
                      key={slug}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700"
                    >
                      <span className="text-lunardeli-red">{slug}</span>
                      <span className="text-gray-400">·</span>
                      <span>{MODULO_NIVEL[nivel] || nivel}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {successMsg && (
          <div className="mb-6 p-4 bg-green-50 border-l-4 border-green-500 text-green-700 text-sm font-medium rounded-r-md flex items-center gap-2">
            <CheckCircle size={18} />
            {successMsg}
          </div>
        )}

        {errorMsg && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-lunardeli-red text-red-700 text-sm font-medium rounded-r-md flex items-center gap-2">
            <AlertCircle size={18} />
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSaveProfile} className="space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Informações Pessoais</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">E-mail (Não alterável)</label>
                <input
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="w-full px-3 py-2 border rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Nome Completo *</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <User size={18} />
                  </div>
                  <input
                    type="text"
                    value={nome}
                    onChange={e => setNome(e.target.value)}
                    required
                    className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-lunardeli-red focus:border-lunardeli-red transition-all outline-none"
                    placeholder="Seu nome"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Telefone / WhatsApp</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <Phone size={18} />
                  </div>
                  <input
                    type="text"
                    value={telefone}
                    onChange={e => setTelefone(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-lunardeli-red focus:border-lunardeli-red transition-all outline-none"
                    placeholder="Ex: (11) 99999-9999"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Alterar Senha</h2>
            <p className="text-gray-500 text-xs mb-4">Preencha estes campos apenas se desejar cadastrar uma nova senha.</p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Senha Atual</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <Lock size={18} />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={senhaAtual}
                    onChange={e => setSenhaAtual(e.target.value)}
                    className="w-full pl-10 pr-10 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-lunardeli-red focus:border-lunardeli-red transition-all outline-none"
                    placeholder="Senha antiga"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Nova Senha</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <Lock size={18} />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={novaSenha}
                    onChange={e => setNovaSenha(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-lunardeli-red focus:border-lunardeli-red transition-all outline-none"
                    placeholder="Mínimo 6 caracteres"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Confirmar Nova Senha</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <Lock size={18} />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmarSenha}
                    onChange={e => setConfirmarSenha(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-lunardeli-red focus:border-lunardeli-red transition-all outline-none"
                    placeholder="Confirme a nova senha"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  Salvando Alterações...
                </>
              ) : (
                'Salvar Alterações'
              )}
            </button>
          </div>
        </form>

        <div className="mt-6">
          <AppVersionBadge />
        </div>
      </div>
    </div>
  );
};
