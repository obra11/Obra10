import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { getImageUrl } from '../../utils/image';
import { ModuloToggle } from '../../components/ModuloToggle';
import {
  Users, Plus, Trash2, Loader2, User, Mail, Lock, X, ArrowLeft, Settings, Shield
} from 'lucide-react';

interface Modulo { slug: string; nome: string; }
interface UsuarioModulo { modulo: Modulo; }
interface ObraVinculada {
  obra: { id: string; nome: string; status: string; };
  permissoes?: Record<string, string>;
}
interface RoleCapabilities {
  gerenciarUsuarios: boolean;
  gerenciarEmpresa: boolean;
  gerenciarFinanceiro: boolean;
  gerenciarCatalogo: boolean;
  criarObra: boolean;
  editarObra: boolean;
  excluirObra: boolean;
  acessoTodasObras: boolean;
  aprovarRdo: boolean;
  criarEditarRdo: boolean;
  verTodosRdos: boolean;
  verSoAprovados: boolean;
  verParcialAprovados: boolean;
  modulosPadrao: Record<string, string>;
}
interface Usuario {
  id: string; nome: string; email: string;
  perfilGlobal: string; ativo: boolean; fotoUrl?: string;
  capabilities?: RoleCapabilities | null;
  capabilitiesEfetivas?: RoleCapabilities;
  usuarioModulos: UsuarioModulo[];
  userObraRole: ObraVinculada[];
}
interface PapelEmpresa {
  id: string;
  tipo: string;
  nome: string;
  capabilities: RoleCapabilities;
  permissoesPadrao?: Record<string, string>;
  editavel: boolean;
}

const MODULO_LABELS: Record<string, string> = {
  RDO: 'Relatório Diário',
  FVS: 'Ficha de Verificação',
  PROJETOS: 'Projetos/PDFs',
  CONCRETO: 'Concretagem',
  IA: 'Análise IA',
};

const FUNCOES = [
  { value: 'GESTOR', label: 'Gestor' },
  { value: 'USER', label: 'Colaborador' },
  { value: 'EXTERNO', label: 'Usuário externo' },
  { value: 'PERSONALIZADO', label: 'Personalizado' },
] as const;

const EMPTY_CAPS: RoleCapabilities = {
  gerenciarUsuarios: false,
  gerenciarEmpresa: false,
  gerenciarFinanceiro: false,
  gerenciarCatalogo: false,
  criarObra: false,
  editarObra: false,
  excluirObra: false,
  acessoTodasObras: false,
  aprovarRdo: false,
  criarEditarRdo: false,
  verTodosRdos: false,
  verSoAprovados: false,
  verParcialAprovados: false,
  modulosPadrao: {},
};

const CAP_LABELS: { key: keyof Omit<RoleCapabilities, 'modulosPadrao'>; label: string; hint: string; group: string }[] = [
  { key: 'gerenciarUsuarios', label: 'Gerenciar usuários', hint: 'Criar, editar e remover usuários da empresa', group: 'Empresa' },
  { key: 'gerenciarEmpresa', label: 'Editar dados da empresa', hint: 'Alterar razão social, contato, endereço e logo', group: 'Empresa' },
  { key: 'gerenciarFinanceiro', label: 'Financeiro e plano', hint: 'Acessar assinatura, cobranças e upgrade de plano', group: 'Empresa' },
  { key: 'gerenciarCatalogo', label: 'Cadastro Base', hint: 'Criar, editar e importar insumos do catálogo', group: 'Empresa' },
  { key: 'criarObra', label: 'Criar nova obra', hint: 'Cadastrar novos canteiros na conta', group: 'Obras' },
  { key: 'editarObra', label: 'Editar obras', hint: 'Alterar nome, endereço, avanço e dados das obras', group: 'Obras' },
  { key: 'excluirObra', label: 'Excluir obras', hint: 'Remover obras da empresa', group: 'Obras' },
  { key: 'acessoTodasObras', label: 'Acesso a todas as obras', hint: 'Vê todas as obras sem vínculo explícito', group: 'Obras' },
  { key: 'aprovarRdo', label: 'Aprovar RDO', hint: 'Pode aprovar e reabrir diários de obra', group: 'RDO' },
  { key: 'criarEditarRdo', label: 'Criar e editar RDO', hint: 'Pode criar e preencher diários', group: 'RDO' },
  { key: 'verTodosRdos', label: 'Ver todos os RDOs', hint: 'Visualiza diários em qualquer status', group: 'RDO' },
  { key: 'verSoAprovados', label: 'Ver só aprovados', hint: 'Restringe a diários aprovados', group: 'RDO' },
  { key: 'verParcialAprovados', label: 'Visualização parcial', hint: 'Só clima e atividades de RDOs aprovados', group: 'RDO' },
];

function roleBadgeClass(perfil: string) {
  switch (perfil) {
    case 'GESTOR': return 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100';
    case 'EXTERNO': return 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100';
    case 'PERSONALIZADO': return 'bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100';
    default: return 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100';
  }
}

function labelPerfil(perfil: string) {
  return FUNCOES.find(f => f.value === perfil)?.label || perfil;
}

export const UserManagement: React.FC = () => {
  useAuth();
  const navigate = useNavigate();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [tenantModulos, setTenantModulos] = useState<string[]>([]);
  const [obrasPermitidas, setObrasPermitidas] = useState<{id: string, nome: string}[]>([]);
  const [papeis, setPapeis] = useState<PapelEmpresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showConfigPapeis, setShowConfigPapeis] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [uploadingFotoId, setUploadingFotoId] = useState<string | null>(null);
  const [form, setForm] = useState({
    nome: '',
    email: '',
    senha: '',
    perfilGlobal: 'USER',
    capabilities: { ...EMPTY_CAPS } as RoleCapabilities,
    modulosPersonalizados: {} as Record<string, string>,
  });
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [editingPersonalizadoId, setEditingPersonalizadoId] = useState<string | null>(null);
  const [personalizadoDraft, setPersonalizadoDraft] = useState<RoleCapabilities>({ ...EMPTY_CAPS });
  const [papelDraft, setPapelDraft] = useState<Record<string, RoleCapabilities>>({});
  const [savingPapel, setSavingPapel] = useState<string | null>(null);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [usersRes, tenantRes, papeisRes] = await Promise.all([
        api.get('/usuarios'),
        api.get('/auth/me'),
        api.get('/usuarios/papeis').catch(() => ({ data: [] })),
      ]);
      setUsuarios(usersRes.data);
      setPapeis(papeisRes.data || []);
      const draft: Record<string, RoleCapabilities> = {};
      for (const p of papeisRes.data || []) {
        draft[p.tipo] = {
          ...EMPTY_CAPS,
          ...(p.capabilities || {}),
          modulosPadrao: {
            ...(p.permissoesPadrao || {}),
            ...((p.capabilities as RoleCapabilities)?.modulosPadrao || {}),
          },
        };
      }
      setPapelDraft(draft);

      const meData = tenantRes.data;
      if (meData.obrasPermitidas) {
        setObrasPermitidas(meData.obrasPermitidas);
      }
      const empresaModulos = meData.empresa?.modulos?.map((m: any) => m.slug);
      if (empresaModulos?.length) {
        setTenantModulos(empresaModulos);
      } else {
        setTenantModulos(['RDO', 'FVS', 'PROJETOS', 'CONCRETO', 'IA']);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormLoading(true);
    try {
      const payload: any = {
        nome: form.nome,
        email: form.email,
        senha: form.senha,
        perfilGlobal: form.perfilGlobal,
      };
      if (form.perfilGlobal === 'PERSONALIZADO') {
        payload.capabilities = {
          ...form.capabilities,
          modulosPadrao: form.modulosPersonalizados,
        };
      }
      await api.post('/usuarios', payload);
      setShowForm(false);
      setForm({
        nome: '', email: '', senha: '', perfilGlobal: 'USER',
        capabilities: { ...EMPTY_CAPS },
        modulosPersonalizados: {},
      });
      await fetchAll();
      alert('Usuário criado. Um e-mail com o link de acesso e a senha foi enviado.');
    } catch (err: any) {
      setFormError(err?.response?.data?.message || 'Erro ao criar usuário.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleReenviarConvite = async (usuarioId: string, email: string) => {
    if (!window.confirm(`Reenviar e-mail de acesso para ${email}?\n\nUma nova senha temporária será gerada e enviada por e-mail.`)) {
      return;
    }
    setSavingId('invite_' + usuarioId);
    try {
      const res = await api.post(`/usuarios/${usuarioId}/reenviar-convite`);
      alert(res.data?.mensagem || `E-mail reenviado para ${email}.`);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Erro ao reenviar e-mail.');
    } finally {
      setSavingId(null);
    }
  };

  const handleToggleObra = async (usuarioId: string, obraId: string, isAssigned: boolean) => {
    setSavingId(usuarioId + obraId);
    try {
      if (isAssigned) {
        await api.delete(`/obras/${obraId}/colaboradores/${usuarioId}`);
      } else {
        const u = usuarios.find(x => x.id === usuarioId);
        const caps = u?.capabilitiesEfetivas || u?.capabilities;
        const permissoes = caps?.modulosPadrao || {};
        await api.post(`/obras/${obraId}/colaboradores`, { usuarioId, permissoes });
      }
      await fetchAll();
    } catch (err: any) {
      alert('Erro ao vincular obra: ' + (err?.response?.data?.message || err.message));
    } finally {
      setSavingId(null);
    }
  };

  const handleUpdateRole = async (usuarioId: string, newRole: string) => {
    if (newRole === 'PERSONALIZADO') {
      const u = usuarios.find(x => x.id === usuarioId);
      setEditingPersonalizadoId(usuarioId);
      setPersonalizadoDraft({
        ...EMPTY_CAPS,
        ...(u?.capabilitiesEfetivas || u?.capabilities || {}),
        modulosPadrao: {
          ...((u?.capabilitiesEfetivas || u?.capabilities)?.modulosPadrao || {}),
        },
      });
      return;
    }
    setSavingId('role_' + usuarioId);
    try {
      await api.patch(`/usuarios/${usuarioId}`, { perfilGlobal: newRole });
      await fetchAll();
    } catch (err: any) {
      alert('Erro ao atualizar perfil: ' + (err?.response?.data?.message || err.message));
    } finally {
      setSavingId(null);
    }
  };

  const handleSavePersonalizado = async () => {
    if (!editingPersonalizadoId) return;
    setSavingId('role_' + editingPersonalizadoId);
    try {
      await api.patch(`/usuarios/${editingPersonalizadoId}`, {
        perfilGlobal: 'PERSONALIZADO',
        capabilities: personalizadoDraft,
      });
      setEditingPersonalizadoId(null);
      await fetchAll();
    } catch (err: any) {
      alert('Erro ao salvar personalizado: ' + (err?.response?.data?.message || err.message));
    } finally {
      setSavingId(null);
    }
  };

  const handleSavePapel = async (tipo: string) => {
    setSavingPapel(tipo);
    try {
      const caps = papelDraft[tipo];
      await api.patch(`/usuarios/papeis/${tipo}`, {
        capabilities: caps,
        permissoesPadrao: caps?.modulosPadrao || {},
      });
      await fetchAll();
    } catch (err: any) {
      alert('Erro ao salvar função: ' + (err?.response?.data?.message || err.message));
    } finally {
      setSavingPapel(null);
    }
  };

  const handleToggleModuleInsideObra = async (usuarioId: string, obraId: string, slug: string, permissoesAtuais: Record<string, string>) => {
    setSavingId(usuarioId + obraId + slug);
    const novasPermissoes = { ...permissoesAtuais };
    if (novasPermissoes[slug]) {
       delete novasPermissoes[slug];
    } else {
       novasPermissoes[slug] = 'VIEW';
    }

    try {
      await api.patch(`/obras/${obraId}/colaboradores/${usuarioId}`, { permissoes: novasPermissoes });
      await fetchAll();
    } catch (e: any) {
      alert('Erro ao alterar permissão: ' + e.message);
    } finally {
      setSavingId(null);
    }
  };

  const handleFotoUpload = async (usuarioId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFotoId(usuarioId);
    const formData = new FormData();
    formData.append('file', file);

    try {
      await api.post(`/upload/usuario/${usuarioId}/foto`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      await fetchAll();
    } catch (err: any) {
      alert('Erro ao fazer upload da foto: ' + (err?.response?.data?.message || err.message));
    } finally {
      setUploadingFotoId(null);
      e.target.value = '';
    }
  };

  const handleDelete = async (id: string, nome: string) => {
    if (!window.confirm(`Deseja remover "${nome}"? Esta ação desativa o acesso imediatamente.`)) return;
    await api.delete(`/usuarios/${id}`);
    await fetchAll();
  };

  const renderCapabilitiesEditor = (
    caps: RoleCapabilities,
    onChange: (next: RoleCapabilities) => void,
    showModulos = true,
  ) => (
    <div className="space-y-4">
      {(['Empresa', 'Obras', 'RDO'] as const).map(group => (
        <div key={group}>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{group}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {CAP_LABELS.filter(item => item.group === group).map(item => (
              <label key={item.key} className="flex items-start gap-2 p-3 border border-gray-200 rounded-lg bg-white cursor-pointer hover:border-red-200">
                <input
                  type="checkbox"
                  className="mt-0.5 rounded border-gray-300 text-red-600 focus:ring-red-500"
                  checked={!!caps[item.key]}
                  onChange={e => onChange({ ...caps, [item.key]: e.target.checked })}
                />
                <span>
                  <span className="block text-sm font-semibold text-gray-800">{item.label}</span>
                  <span className="block text-[11px] text-gray-500">{item.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      ))}
      {showModulos && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Módulos padrão</p>
          <div className="space-y-2">
            {tenantModulos.map(slug => {
              const nivel = caps.modulosPadrao?.[slug] || '';
              const ativo = !!nivel;
              return (
                <div key={slug} className={`border rounded-lg p-3 ${ativo ? 'border-red-200 bg-red-50/30' : 'border-gray-200'}`}>
                  <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ativo}
                      onChange={() => {
                        const next = { ...caps.modulosPadrao };
                        if (ativo) delete next[slug];
                        else next[slug] = slug === 'RDO' ? 'EDIT' : 'VIEW';
                        onChange({ ...caps, modulosPadrao: next });
                      }}
                      className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                    />
                    {MODULO_LABELS[slug] || slug}
                  </label>
                  {ativo && (
                    <select
                      className="mt-2 w-full border border-gray-300 rounded px-2 py-1.5 text-sm bg-white"
                      value={nivel}
                      onChange={e => onChange({
                        ...caps,
                        modulosPadrao: { ...caps.modulosPadrao, [slug]: e.target.value },
                      })}
                    >
                      {slug === 'RDO' ? (
                        <>
                          <option value="VIEW">Visualizar todos os diários</option>
                          <option value="VIEW_APPROVED">Apenas diários aprovados</option>
                          <option value="VIEW_PARTIAL_APPROVED">Visualização parcial (aprovados)</option>
                          <option value="EDIT">Criar e editar diários</option>
                        </>
                      ) : (
                        <>
                          <option value="VIEW">Apenas visualizar</option>
                          <option value="EDIT">Pode editar / criar</option>
                        </>
                      )}
                    </select>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  if (loading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-red-600" size={40} /></div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/dashboard')}
              title="Voltar ao Início"
              className="p-2 -ml-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <ArrowLeft size={24} />
            </button>
            <Users className="text-red-600 border-l border-gray-200 pl-4 h-8" size={32} />
            <div>
              <h1 className="text-2xl font-bold text-gray-900 leading-tight">Gestão de Usuários</h1>
              <p className="text-sm text-gray-500">{usuarios.length} usuários na sua conta</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setShowConfigPapeis(prev => !prev)}
              className="flex shrink-0 items-center justify-center gap-2 px-4 py-2 bg-white text-gray-700 font-semibold rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              <Settings size={16} /> Configurar funções
            </button>
            <button
              onClick={() => setShowForm(prev => !prev)}
              className="flex shrink-0 items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors"
            >
              <Plus size={16} /> Novo Usuário
            </button>
          </div>
        </div>

        {showConfigPapeis && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Shield className="text-red-600" size={20} />
                <h2 className="font-semibold text-gray-900">Configurar funções padrão</h2>
              </div>
              <button onClick={() => setShowConfigPapeis(false)}><X size={18} className="text-gray-400 hover:text-gray-700" /></button>
            </div>
            <p className="text-sm text-gray-500 mb-6">
              Defina o que cada função pode fazer por padrão. Usuários personalizados são configurados individualmente.
            </p>
            <div className="space-y-6">
              {['GESTOR', 'COLABORADOR', 'EXTERNO'].map(tipo => {
                const papel = papeis.find(p => p.tipo === tipo);
                const draft = papelDraft[tipo] || { ...EMPTY_CAPS };
                return (
                  <div key={tipo} className="border border-gray-100 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-gray-800">
                        {papel?.nome || tipo}
                      </h3>
                      <button
                        onClick={() => handleSavePapel(tipo)}
                        disabled={savingPapel === tipo}
                        className="text-sm px-3 py-1.5 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 disabled:opacity-70"
                      >
                        {savingPapel === tipo ? 'Salvando...' : 'Salvar'}
                      </button>
                    </div>
                    {renderCapabilitiesEditor(draft, next => setPapelDraft(prev => ({ ...prev, [tipo]: next })))}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {showForm && (
          <div className="bg-white rounded-xl shadow-sm border border-red-100 p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Novo Usuário</h2>
              <button onClick={() => setShowForm(false)}><X size={18} className="text-gray-400 hover:text-gray-700" /></button>
            </div>
            {formError && <div className="mb-3 p-3 bg-red-50 text-red-700 text-sm rounded-lg border-l-4 border-red-500">{formError}</div>}
            <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Nome</label>
                <div className="relative"><User className="absolute left-3 top-3 text-gray-300" size={14} />
                  <input required value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} className="w-full pl-8 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none" placeholder="João da Silva" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">E-mail</label>
                <div className="relative"><Mail className="absolute left-3 top-3 text-gray-300" size={14} />
                  <input required type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} className="w-full pl-8 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none" placeholder="joao@empresa.com" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Senha</label>
                <div className="relative"><Lock className="absolute left-3 top-3 text-gray-300" size={14} />
                  <input required type="password" value={form.senha} onChange={e => setForm(p => ({ ...p, senha: e.target.value }))} className="w-full pl-8 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none" placeholder="Mínimo 8 caracteres" />
                </div>
                <p className="text-[11px] text-gray-400 mt-1">
                  O colaborador recebe por e-mail o link de acesso e esta senha.
                </p>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Função</label>
                <select value={form.perfilGlobal} onChange={e => setForm(p => ({ ...p, perfilGlobal: e.target.value }))} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none bg-white">
                  {FUNCOES.map(f => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
              </div>
              {form.perfilGlobal === 'PERSONALIZADO' && (
                <div className="sm:col-span-2 border border-violet-100 rounded-xl p-4 bg-violet-50/40">
                  <h3 className="font-semibold text-gray-800 mb-3">Permissões personalizadas</h3>
                  {renderCapabilitiesEditor(
                    { ...form.capabilities, modulosPadrao: form.modulosPersonalizados },
                    next => setForm(p => ({
                      ...p,
                      capabilities: { ...next, modulosPadrao: next.modulosPadrao },
                      modulosPersonalizados: next.modulosPadrao,
                    })),
                  )}
                </div>
              )}
              <div className="sm:col-span-2 flex justify-end">
                <button type="submit" disabled={formLoading} className="flex items-center gap-2 px-6 py-2.5 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-70">
                  {formLoading ? <><Loader2 size={14} className="animate-spin" />Criando...</> : 'Criar Usuário'}
                </button>
              </div>
            </form>
          </div>
        )}

        {editingPersonalizadoId && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[100]">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
              <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <h3 className="text-lg font-bold text-gray-800">Configurar função personalizada</h3>
                <button onClick={() => setEditingPersonalizadoId(null)} className="text-gray-400 hover:text-gray-700">
                  <X size={20} />
                </button>
              </div>
              <div className="p-5 overflow-y-auto">
                {renderCapabilitiesEditor(personalizadoDraft, setPersonalizadoDraft)}
              </div>
              <div className="p-5 border-t border-gray-100 bg-gray-50 flex justify-end gap-2">
                <button onClick={() => setEditingPersonalizadoId(null)} className="px-4 py-2 text-gray-600 font-semibold rounded-lg hover:bg-gray-200">
                  Cancelar
                </button>
                <button
                  onClick={handleSavePersonalizado}
                  disabled={!!savingId}
                  className="px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 disabled:opacity-70"
                >
                  {savingId ? 'Salvando...' : 'Salvar permissões'}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {usuarios.map(u => {
            const acessoTotal = u.capabilitiesEfetivas?.acessoTodasObras || u.perfilGlobal === 'GESTOR';
            return (
              <div key={u.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <label className="cursor-pointer group flex items-center justify-center w-12 h-12 rounded-full overflow-hidden bg-red-50 shrink-0 border border-gray-200 relative transition-all">
                      {uploadingFotoId === u.id ? (
                        <Loader2 className="animate-spin text-red-600" size={18} />
                      ) : u.fotoUrl ? (
                        <>
                           <img src={getImageUrl(u.fotoUrl)} alt={u.nome} className="w-full h-full object-cover" />
                           <div className="absolute inset-0 bg-black/40 hidden group-hover:flex items-center justify-center">
                             <span className="text-[10px] text-white font-bold opacity-100">Foto</span>
                           </div>
                        </>
                      ) : (
                        <User className="text-red-500 group-hover:scale-110 transition-transform" size={20} />
                      )}
                      <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFotoUpload(u.id, e)} />
                    </label>
                    <div>
                      <p className="font-semibold text-gray-900 leading-tight">{u.nome}</p>
                      <p className="text-xs text-gray-400 mb-1">{u.email}</p>
                      {savingId === 'role_' + u.id ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 text-gray-400 inline-flex items-center gap-1">
                          <Loader2 size={10} className="animate-spin" /> ATUALIZANDO...
                        </span>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2">
                          <select
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-sm uppercase tracking-wider cursor-pointer outline-none border transition-colors ${roleBadgeClass(u.perfilGlobal)}`}
                            value={u.perfilGlobal}
                            onChange={(e) => handleUpdateRole(u.id, e.target.value)}
                          >
                            {FUNCOES.map(f => (
                              <option key={f.value} value={f.value}>{f.label}</option>
                            ))}
                          </select>
                          {u.perfilGlobal === 'PERSONALIZADO' && (
                            <button
                              type="button"
                              onClick={() => handleUpdateRole(u.id, 'PERSONALIZADO')}
                              className="text-[10px] font-bold text-violet-700 underline"
                            >
                              Editar permissões
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <button onClick={() => handleDelete(u.id, u.nome)} className="text-gray-300 hover:text-red-400 transition-colors shrink-0">
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleReenviarConvite(u.id, u.email)}
                    disabled={savingId === 'invite_' + u.id}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-lunardeli-red hover:text-red-700 disabled:opacity-60"
                  >
                    {savingId === 'invite_' + u.id ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Mail size={12} />
                    )}
                    Reenviar e-mail de acesso
                  </button>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-50">
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Acessos por Obra</p>
                  <div className="space-y-3">
                    {obrasPermitidas.length === 0 && (
                      <div className="text-xs text-gray-400 italic">Nenhuma obra na conta.</div>
                    )}
                    {obrasPermitidas.map(obra => {
                      const role = u.userObraRole?.find(r => r.obra.id === obra.id);
                      const isAssigned = !!role || acessoTotal;
                      const userPermissoes = (role?.permissoes as Record<string, string>) || {};

                      return (
                        <div key={obra.id} className={`border rounded-lg overflow-hidden transition-all ${isAssigned ? 'border-red-200 shadow-sm' : 'border-gray-200'}`}>
                          <div className={`flex items-center justify-between p-3 ${isAssigned ? 'bg-red-50/50' : 'bg-gray-50'}`}>
                            <span className={`text-sm font-semibold ${isAssigned ? 'text-gray-900' : 'text-gray-500'}`}>
                              {obra.nome}
                            </span>

                            {!acessoTotal && (
                              <label className="relative inline-flex items-center cursor-pointer">
                                {savingId === u.id + obra.id && <Loader2 size={14} className="animate-spin absolute -left-5 text-gray-400" />}
                                <input
                                  type="checkbox"
                                  className="sr-only peer"
                                  checked={!!role}
                                  disabled={savingId === u.id + obra.id}
                                  onChange={() => handleToggleObra(u.id, obra.id, !!role)}
                                />
                                <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-600"></div>
                              </label>
                            )}
                          </div>

                          {isAssigned && (
                            <div className="p-3 bg-white border-t border-red-100 flex flex-wrap gap-2">
                               {acessoTotal ? (
                                  <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded-md border border-blue-100">
                                     Acesso total ({labelPerfil(u.perfilGlobal)})
                                  </span>
                               ) : (
                                  tenantModulos.map(slug => {
                                    const hasMod = !!userPermissoes[slug];
                                    const isLoadingMod = savingId === u.id + obra.id + slug;
                                    return (
                                      <ModuloToggle
                                         key={slug}
                                         slug={slug}
                                         label={MODULO_LABELS[slug] || slug}
                                         isActive={hasMod}
                                         isLoading={isLoadingMod}
                                         onToggle={() => handleToggleModuleInsideObra(u.id, obra.id, slug, userPermissoes)}
                                      />
                                    );
                                  })
                               )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            );
          })}
          {usuarios.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <Users size={48} className="mx-auto mb-3 opacity-30" />
              <p>Nenhum usuário cadastrado ainda.</p>
              <button onClick={() => setShowForm(true)} className="mt-3 text-red-600 font-semibold hover:underline">Criar primeiro usuário</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
