import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { ModuloToggle } from '../../components/ModuloToggle';
import {
  Users, Plus, Trash2, Loader2, User, Mail, Lock, X, ArrowLeft
} from 'lucide-react';

interface Modulo { slug: string; nome: string; }
interface UsuarioModulo { modulo: Modulo; }
interface ObraVinculada { 
  obra: { id: string; nome: string; status: string; }; 
  permissoes?: Record<string, string>;
}
interface Usuario {
  id: string; nome: string; email: string;
  perfilGlobal: string; ativo: boolean; fotoUrl?: string;
  usuarioModulos: UsuarioModulo[];
  userObraRole: ObraVinculada[];
}

const MODULO_LABELS: Record<string, string> = {
  RDO: 'Relatório Diário',
  FVS: 'Ficha de Verificação',
  PROJETOS: 'Projetos/PDFs',
  CONCRETO: 'Concretagem',
  IA: 'Análise IA',
};

export const UserManagement: React.FC = () => {
  useAuth(); // Keep hook for future auth checks
  const navigate = useNavigate();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [tenantModulos, setTenantModulos] = useState<string[]>([]);
  const [obrasPermitidas, setObrasPermitidas] = useState<{id: string, nome: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [uploadingFotoId, setUploadingFotoId] = useState<string | null>(null);
  const [form, setForm] = useState({ nome: '', email: '', senha: '', perfilGlobal: 'USER' });
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [usersRes, tenantRes] = await Promise.all([
        api.get('/usuarios'),
        api.get('/auth/me'),
      ]);
      setUsuarios(usersRes.data);
      // Fetch tenant modules from empresa info
      const meData = tenantRes.data;
      if (meData.obrasPermitidas) {
        setObrasPermitidas(meData.obrasPermitidas);
      }
      // We get available modules from tenant by calling tenants endpoint
      const tenantData = await api.get(`/admin/tenants`).catch(() => null);
      if (tenantData) {
        const myTenant = tenantData.data.find((t: any) => t.id === meData.usuario?.empresaId);
        if (myTenant) {
          setTenantModulos(myTenant.tenantModulos.filter((m: any) => m.ativo).map((m: any) => m.modulo.slug));
        }
      } else {
        // Fallback: offer all modules (user may not be super admin)
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
      await api.post('/usuarios', form);
      setShowForm(false);
      setForm({ nome: '', email: '', senha: '', perfilGlobal: 'USER' });
      await fetchAll();
    } catch (err: any) {
      setFormError(err?.response?.data?.message || 'Erro ao criar usuário.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleToggleObra = async (usuarioId: string, obraId: string, isAssigned: boolean) => {
    setSavingId(usuarioId + obraId);
    try {
      if (isAssigned) {
        await api.delete(`/obras/${obraId}/colaboradores/${usuarioId}`);
      } else {
        await api.post(`/obras/${obraId}/colaboradores`, { usuarioId, permissoes: {} });
      }
      await fetchAll();
    } catch (err: any) {
      alert('Erro ao vincular obra: ' + (err?.response?.data?.message || err.message));
    } finally {
      setSavingId(null);
    }
  };

  const handleUpdateRole = async (usuarioId: string, newRole: string) => {
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

  const handleToggleModuleInsideObra = async (usuarioId: string, obraId: string, slug: string, permissoesAtuais: Record<string, string>) => {
    setSavingId(usuarioId + obraId + slug);
    const novasPermissoes = { ...permissoesAtuais };
    if (novasPermissoes[slug]) {
       delete novasPermissoes[slug];
    } else {
       novasPermissoes[slug] = 'VIEW'; // Concede inicialmente
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

  if (loading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-red-600" size={40} /></div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
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
          <button
            onClick={() => setShowForm(prev => !prev)}
            className="flex shrink-0 items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors"
          >
            <Plus size={16} /> Novo Usuário
          </button>
        </div>

        {/* Create Form */}
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
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Perfil</label>
                <select value={form.perfilGlobal} onChange={e => setForm(p => ({ ...p, perfilGlobal: e.target.value }))} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none bg-white">
                  <option value="USER">Usuário</option>
                  <option value="GESTOR">Gestor</option>
                </select>
              </div>
              <div className="sm:col-span-2 flex justify-end">
                <button type="submit" disabled={formLoading} className="flex items-center gap-2 px-6 py-2.5 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-70">
                  {formLoading ? <><Loader2 size={14} className="animate-spin" />Criando...</> : 'Criar Usuário'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Users List */}
        <div className="space-y-3">
          {usuarios.map(u => {
            return (
              <div key={u.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <label className="cursor-pointer group flex items-center justify-center w-12 h-12 rounded-full overflow-hidden bg-red-50 shrink-0 border border-gray-200 relative transition-all">
                      {uploadingFotoId === u.id ? (
                        <Loader2 className="animate-spin text-red-600" size={18} />
                      ) : u.fotoUrl ? (
                        <>
                           <img src={`${baseURL}${u.fotoUrl}`} alt={u.nome} className="w-full h-full object-cover" />
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
                        <select
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-sm uppercase tracking-wider cursor-pointer outline-none border transition-colors ${u.perfilGlobal === 'GESTOR' ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'}`}
                          value={u.perfilGlobal}
                          onChange={(e) => handleUpdateRole(u.id, e.target.value)}
                        >
                          <option value="USER">COLABORADOR (USER)</option>
                          <option value="GESTOR">GESTOR</option>
                        </select>
                      )}
                    </div>
                  </div>
                  <button onClick={() => handleDelete(u.id, u.nome)} className="text-gray-300 hover:text-red-400 transition-colors shrink-0">
                    <Trash2 size={16} />
                  </button>
                </div>

                {/* Acessos por Obra */}
                <div className="mt-4 pt-4 border-t border-gray-50">
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Acessos por Obra</p>
                  <div className="space-y-3">
                    {obrasPermitidas.length === 0 && (
                      <div className="text-xs text-gray-400 italic">Nenhuma obra na conta.</div>
                    )}
                    {obrasPermitidas.map(obra => {
                      const role = u.userObraRole?.find(r => r.obra.id === obra.id);
                      const isAssigned = !!role;
                      const userPermissoes = (role?.permissoes as Record<string, string>) || {};

                      return (
                        <div key={obra.id} className={`border rounded-lg overflow-hidden transition-all ${isAssigned ? 'border-red-200 shadow-sm' : 'border-gray-200'}`}>
                          {/* Cabeçalho da Obra (Toggle de Vínculo) */}
                          <div className={`flex items-center justify-between p-3 ${isAssigned ? 'bg-red-50/50' : 'bg-gray-50'}`}>
                            <span className={`text-sm font-semibold ${isAssigned ? 'text-gray-900' : 'text-gray-500'}`}>
                              {obra.nome}
                            </span>
                            
                            <label className="relative inline-flex items-center cursor-pointer">
                              {savingId === u.id + obra.id && <Loader2 size={14} className="animate-spin absolute -left-5 text-gray-400" />}
                              <input 
                                type="checkbox" 
                                className="sr-only peer" 
                                checked={isAssigned}
                                disabled={savingId === u.id + obra.id}
                                onChange={() => handleToggleObra(u.id, obra.id, isAssigned)}
                              />
                              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-600"></div>
                            </label>
                          </div>
                          
                          {/* Toggles Individuais e Módulos */}
                          {isAssigned && (
                            <div className="p-3 bg-white border-t border-red-100 flex flex-wrap gap-2">
                               {u.perfilGlobal === 'GESTOR' ? (
                                  <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded-md border border-blue-100">
                                     Acesso Total (Perfil Gestor)
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
