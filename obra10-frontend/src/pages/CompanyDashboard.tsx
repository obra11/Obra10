import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useAuth, type Obra } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { HardHat, LogOut, Upload, Building2, MapPin, Loader2, Plus, Edit2, Users, AlertTriangle, DollarSign, ExternalLink, User, Boxes, Search, LayoutGrid, Grid, List, Headphones } from 'lucide-react';
import api from '../services/api';
import { getImageUrl } from '../utils/image';

export const CompanyDashboard: React.FC = () => {
  const { user, empresa, obras, logout, setObraAtiva, updateEmpresaLogo, updateUserPhoto } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingUserPhoto, setUploadingUserPhoto] = useState(false);

  const isGestor = user?.perfilGlobal === 'GESTOR' || user?.perfilGlobal === 'SUPER_ADMIN';
  const canManageUsers =
    user?.capabilities?.gerenciarUsuarios === true || isGestor;
  const canManageEmpresa =
    user?.capabilities?.gerenciarEmpresa === true || isGestor;
  const canManageFinanceiro =
    user?.capabilities?.gerenciarFinanceiro === true || isGestor;
  const canCriarObra =
    user?.capabilities?.criarObra === true || isGestor;
  const [showNovoModal, setShowNovoModal] = useState(false);
  const [novaObra, setNovaObra] = useState({ nome: '', endereco: '' });
  const [loadingCriar, setLoadingCriar] = useState(false);

  // Filtros e Modos de Visualização das Obras
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('TODOS');
  const [viewMode, setViewMode] = useState<'grid' | 'compact' | 'list'>(() => {
    return (localStorage.getItem('obras_view_mode') as any) || 'grid';
  });

  const handleSetViewMode = (mode: 'grid' | 'compact' | 'list') => {
    setViewMode(mode);
    localStorage.setItem('obras_view_mode', mode);
  };

  const filteredObras = useMemo(() => {
    return obras.filter((obra) => {
      const matchSearch =
        !searchQuery.trim() ||
        obra.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (obra.endereco && obra.endereco.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchStatus =
        statusFilter === 'TODOS' ||
        (obra.status || 'ATIVA').toUpperCase() === statusFilter.toUpperCase();

      return matchSearch && matchStatus;
    });
  }, [obras, searchQuery, statusFilter]);


  const [showEditEmpresaModal, setShowEditEmpresaModal] = useState(false);
  const [empresaEdit, setEmpresaEdit] = useState({ 
    nomeFantasia: empresa?.nomeFantasia || empresa?.razaoSocial || '',
    telefone: empresa?.telefone || '',
    email: empresa?.email || '',
    cep: empresa?.cep || '',
    logradouro: empresa?.logradouro || '',
    numero: empresa?.numero || '',
    complemento: empresa?.complemento || '',
    bairro: empresa?.bairro || '',
    cidade: empresa?.cidade || '',
    estado: empresa?.estado || ''
  });
  const [loadingEditEmpresa, setLoadingEditEmpresa] = useState(false);

  // Cobranças pendentes (banner de aviso)
  const [cobrancasPendentes, setCobrancasPendentes] = useState<any[]>([]);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  useEffect(() => {
    api.get('/minha-empresa/cobrancas-pendentes')
      .then(res => setCobrancasPendentes(res.data))
      .catch(() => {}); // silenciar erro se não houver cobranças
  }, []);

  const handleCriarObra = async () => {
    if (!novaObra.nome.trim()) return;
    setLoadingCriar(true);
    try {
      await api.post('/obras', novaObra);
      window.location.reload();
    } catch(e: any) {
      alert('Erro ao criar obra: ' + (e?.response?.data?.message || e.message));
    } finally { setLoadingCriar(false); }
  };

  const handleEditarEmpresa = async () => {
    if (!empresaEdit.nomeFantasia.trim()) return;
    setLoadingEditEmpresa(true);
    try {
      await api.patch('/tenants/minha-empresa', empresaEdit);
      window.location.reload();
    } catch(e: any) {
      alert('Erro ao editar empresa: ' + (e?.response?.data?.message || e.message));
    } finally { setLoadingEditEmpresa(false); }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleObraSelect = (obra: Obra) => {
    setObraAtiva(obra);
    navigate(`/obras/${obra.id}/dashboard`);
  };

  const handleUserPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploadingUserPhoto(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await api.post(`/upload/usuario/${user.id}/foto`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      updateUserPhoto(response.data.url);
    } catch (err: any) {
      console.error('Erro ao fazer upload da foto:', err);
      alert('Erro ao atualizar foto de perfil: ' + (err?.response?.data?.message || err.message));
    } finally {
      setUploadingUserPhoto(false);
      e.target.value = '';
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !empresa) return;

    setUploadingLogo(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await api.post(`/upload/empresa/${empresa.id}/logo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      updateEmpresaLogo(response.data.url);
    } catch (err: any) {
      console.error('Erro ao fazer upload da logo:', err);
      alert('Erro ao fazer upload da logo: ' + (err?.response?.data?.message || err.message));
    } finally {
      setUploadingLogo(false);
      e.target.value = '';
      if(fileInputRef.current) fileInputRef.current.value = '';
    }
  };



  // const baseURL = import.meta.env.VITE_API_URL ?? '';

  return (
    <div className="min-h-screen bg-lunardeli-gray">
      {/* Header Construtora */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 md:h-20 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="relative flex-shrink-0">
              {canManageEmpresa ? (
                <label title="Alterar Logotipo da Empresa" className="relative cursor-pointer group flex items-center justify-center h-12 w-12 sm:w-auto sm:max-w-[150px] rounded overflow-hidden transition-all hover:ring-2 hover:ring-lunardeli-red shrink-0">
                  {uploadingLogo ? (
                    <div className="h-12 w-12 bg-gray-100 rounded flex items-center justify-center">
                      <Loader2 className="animate-spin text-lunardeli-red" size={24} />
                    </div>
                  ) : empresa?.logoUrl ? (
                    <>
                      <img src={getImageUrl(empresa.logoUrl)} alt="Logo Empresa" className="h-12 w-auto max-w-[150px] object-contain" />
                      <div className="absolute inset-0 bg-black/50 hidden group-hover:flex items-center justify-center transition-all">
                        <span className="text-[9px] text-white font-bold uppercase tracking-wider">Logo</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="h-12 w-12 bg-gray-100 rounded border-dashed border-2 border-gray-300 flex items-center justify-center text-gray-400 group-hover:bg-gray-200">
                        <Building2 size={24} />
                      </div>
                      <div className="absolute inset-0 bg-black/50 hidden group-hover:flex items-center justify-center transition-all">
                        <span className="text-[9px] text-white font-bold uppercase tracking-wider">Logo</span>
                      </div>
                    </>
                  )}
                  <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
                </label>
              ) : empresa?.logoUrl ? (
                <img src={getImageUrl(empresa.logoUrl)} alt="Logo Empresa" className="h-12 w-auto max-w-[150px] object-contain" />
              ) : (
                <div className="h-12 w-12 bg-gray-100 rounded border-dashed border-2 border-gray-300 flex items-center justify-center text-gray-400">
                  <Building2 size={24} />
                </div>
              )}
            </div>
            
            <div className="border-l pl-4 border-gray-200">
              <div className="flex items-center gap-2">
                <h1 className="text-base md:text-xl font-bold text-lunardeli-dark truncate max-w-[140px] md:max-w-[200px]">{empresa?.nomeFantasia || empresa?.razaoSocial}</h1>
                {canManageEmpresa && (
                  <button onClick={() => { 
                    setEmpresaEdit({ 
                      nomeFantasia: empresa?.nomeFantasia || empresa?.razaoSocial || '',
                      telefone: empresa?.telefone || '',
                      email: empresa?.email || '',
                      cep: empresa?.cep || '',
                      logradouro: empresa?.logradouro || '',
                      numero: empresa?.numero || '',
                      complemento: empresa?.complemento || '',
                      bairro: empresa?.bairro || '',
                      cidade: empresa?.cidade || '',
                      estado: empresa?.estado || ''
                    }); 
                    setShowEditEmpresaModal(true); 
                  }} className="text-gray-400 hover:text-lunardeli-red transition-colors shrink-0" title="Editar Empresa">
                    <Edit2 size={16} />
                  </button>
                )}
              </div>
              {/* Active Cupom Badge */}
              {empresa?.cupons && empresa.cupons.find((c: any) => c.ativo)?.cupom && (
                <div className="mt-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-green-700 bg-green-100 border border-green-200 rounded px-1.5 py-0.5" title="Cupom de Desconto Ativo">
                    Cupom: {empresa.cupons.find((c: any) => c.ativo).cupom.codigo}
                  </span>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-2 sm:space-x-6">
            
            {/* User Profile Area */}
            <div className="flex items-center gap-3 mr-1 sm:mr-4 border-r pr-1 sm:pr-4 border-gray-200">
              <div className="text-right hidden sm:block">
                 <p className="text-sm font-bold text-gray-800 leading-tight">{user?.nome}</p>
                 <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">{user?.perfilGlobal}</p>
              </div>
              <label title="Alterar Foto de Perfil" className="relative cursor-pointer group flex items-center justify-center w-10 h-10 rounded-full overflow-hidden bg-gray-100 border border-gray-300 transition-all hover:border-lunardeli-red shadow-sm shrink-0">
                {uploadingUserPhoto ? (
                  <Loader2 className="animate-spin text-lunardeli-red" size={16} />
                ) : user?.fotoUrl ? (
                  <>
                     <img src={getImageUrl(user.fotoUrl)} alt="Meu Perfil" className="w-full h-full object-cover" />
                     <div className="absolute inset-0 bg-black/50 hidden group-hover:flex items-center justify-center transition-all">
                       <span className="text-[9px] text-white font-bold uppercase tracking-wider">Foto</span>
                     </div>
                  </>
                ) : (
                  <>
                     <span className="text-sm font-bold text-gray-600 group-hover:hidden">
                        {user?.nome?.charAt(0).toUpperCase()}
                     </span>
                     <div className="absolute inset-0 bg-gray-200 hidden group-hover:flex items-center justify-center transition-all">
                       <span className="text-[9px] text-gray-700 font-bold uppercase tracking-wider">Foto</span>
                     </div>
                  </>
                )}
                <input type="file" className="hidden" accept="image/*" onChange={handleUserPhotoUpload} />
              </label>
            </div>
            <button onClick={() => navigate('/catalogo')} className="text-gray-500 flex items-center hover:text-lunardeli-red font-semibold transition-colors" title="Cadastro Base">
              <Boxes size={18} className="sm:mr-2 text-lunardeli-red" /> <span className="hidden sm:inline">Cadastro Base</span>
            </button>
            {canManageUsers && (
              <button onClick={() => navigate('/gestor/usuarios')} className="text-gray-500 flex items-center hover:text-lunardeli-red font-semibold transition-colors" title="Equipe">
                <Users size={18} className="sm:mr-2" /> <span className="hidden sm:inline">Equipe</span>
              </button>
            )}
            {canManageFinanceiro && (
              <button onClick={() => navigate('/assinatura')} className="text-gray-500 flex items-center hover:text-lunardeli-red font-semibold transition-colors" title="Meu Plano">
                <Building2 size={18} className="sm:mr-2" /> <span className="hidden sm:inline">Meu Plano</span>
              </button>
            )}
            <button onClick={() => navigate('/suporte')} className="text-gray-500 flex items-center hover:text-lunardeli-red font-semibold transition-colors" title="Central de Suporte">
              <Headphones size={18} className="sm:mr-2" /> <span className="hidden sm:inline">Suporte</span>
            </button>
            <button onClick={() => navigate('/perfil')} className="text-gray-500 flex items-center hover:text-lunardeli-red font-semibold transition-colors" title="Meu Perfil">
              <User size={18} className="sm:mr-2" /> <span className="hidden sm:inline">Perfil</span>
            </button>
            <button onClick={handleLogout} className="flex items-center text-gray-500 hover:text-lunardeli-red font-medium transition-colors" title="Sair">
              <LogOut size={18} className="sm:mr-2" /> <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
      </header>

      {/* Banner de Cobranças Pendentes */}
      {cobrancasPendentes.length > 0 && !bannerDismissed && (
        <div className="bg-gradient-to-r from-yellow-50 to-red-50 border-b border-yellow-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="bg-yellow-100 p-2 rounded-full">
                  <AlertTriangle className="text-yellow-600" size={20} />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">
                    <DollarSign size={14} className="inline text-red-600 -mt-0.5" /> Você possui {cobrancasPendentes.length} cobrança(s) pendente(s)
                  </p>
                  <p className="text-xs text-gray-600">
                    Valor total: R$ {cobrancasPendentes.reduce((acc: number, c: any) => acc + Number(c.valor), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    {cobrancasPendentes.some((c: any) => c.notificadoEm) && (
                      <span className="text-red-600 font-semibold ml-2">• O administrador solicitou a regularização</span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {cobrancasPendentes[0]?.linkPagamento && (
                  <a 
                    href={cobrancasPendentes[0].linkPagamento} 
                    target="_blank" 
                    rel="noreferrer"
                    className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors"
                  >
                    <ExternalLink size={14} /> Pagar Agora
                  </a>
                )}
                <button 
                  onClick={() => setBannerDismissed(true)}
                  className="text-gray-400 hover:text-gray-600 text-xs px-2 py-1"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex justify-between items-end mb-6">
            <div>
                <h2 className="text-2xl font-bold text-gray-800">Suas Obras</h2>
                <p className="text-gray-500 text-sm mt-1">Selecione um canteiro de obras para acessar seus módulos e RDOs.</p>
            </div>
            {canCriarObra && (
              <button onClick={() => setShowNovoModal(true)} className="px-3 md:px-4 py-2.5 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 active:bg-red-800 flex items-center gap-1.5 md:gap-2 text-sm shrink-0">
                <Plus size={18} /> <span className="hidden sm:inline">Nova </span>Obra
              </button>
            )}
        </div>

        {/* Toolbar de Busca, Filtro e Visualização */}
        {obras.length > 0 && (
          <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-sm mb-6 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            {/* Campo de Busca */}
            <div className="relative flex-1">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar obra por nome ou endereço..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-lunardeli-red focus:border-lunardeli-red outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs font-bold"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Filtro por Status */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-700 outline-none focus:ring-2 focus:ring-lunardeli-red"
              >
                <option value="TODOS">Todos os Status ({obras.length})</option>
                <option value="ATIVA">Ativas ({obras.filter(o => (o.status || 'ATIVA') === 'ATIVA').length})</option>
                <option value="INATIVA">Inativas ({obras.filter(o => o.status === 'INATIVA').length})</option>
                <option value="FINALIZADA">Finalizadas ({obras.filter(o => o.status === 'FINALIZADA').length})</option>
              </select>

              {/* Botões de Modo de Visualização */}
              <div className="flex items-center bg-gray-100 p-1 rounded-lg border border-gray-200">
                <button
                  type="button"
                  onClick={() => handleSetViewMode('grid')}
                  className={`px-2.5 py-1.5 rounded text-xs font-bold flex items-center gap-1.5 transition-all ${
                    viewMode === 'grid'
                      ? 'bg-white text-lunardeli-red shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                  title="Grade Grande (Cards)"
                >
                  <LayoutGrid size={15} />
                  <span className="hidden sm:inline">Cards</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSetViewMode('compact')}
                  className={`px-2.5 py-1.5 rounded text-xs font-bold flex items-center gap-1.5 transition-all ${
                    viewMode === 'compact'
                      ? 'bg-white text-lunardeli-red shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                  title="Grade Compacta (Miniaturas)"
                >
                  <Grid size={15} />
                  <span className="hidden sm:inline">Miniaturas</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSetViewMode('list')}
                  className={`px-2.5 py-1.5 rounded text-xs font-bold flex items-center gap-1.5 transition-all ${
                    viewMode === 'list'
                      ? 'bg-white text-lunardeli-red shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                  title="Lista Detalhada"
                >
                  <List size={15} />
                  <span className="hidden sm:inline">Lista</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Exibição das Obras */}
        {obras.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center text-gray-500">
            <HardHat size={48} className="mx-auto mb-4 opacity-20" />
            <p>Nenhuma obra vinculada ao seu usuário no momento.</p>
          </div>
        ) : filteredObras.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center text-gray-500">
            <Search size={48} className="mx-auto mb-4 opacity-20" />
            <p className="font-semibold text-gray-700">Nenhuma obra encontrada com os filtros selecionados.</p>
            <button
              onClick={() => { setSearchQuery(''); setStatusFilter('TODOS'); }}
              className="mt-3 text-sm text-lunardeli-red hover:underline font-bold"
            >
              Limpar busca e filtros
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          /* Modo 1: Grade Grande (Cards Grandes) */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredObras.map(obra => (
              <div key={obra.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow group flex flex-col">
                <div className="h-48 bg-gray-100 relative group/cover">
                  {obra.imageUrl ? (
                    <img src={getImageUrl(obra.imageUrl)} alt={obra.nome} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                      <HardHat size={48} className="mb-2 opacity-20" />
                      <span className="text-sm font-medium">Capa da Obra</span>
                    </div>
                  )}
                  <div 
                    className={`absolute top-3 left-3 text-white text-[10px] md:text-xs font-bold px-2.5 py-1 rounded-full shadow-sm ${
                      obra.status === 'ATIVA' ? 'bg-green-500' :
                      obra.status === 'INATIVA' ? 'bg-yellow-500' :
                      obra.status === 'FINALIZADA' ? 'bg-red-500' : 'bg-gray-500'
                    }`}
                  >
                    {obra.status || 'ATIVA'}
                  </div>
                </div>

                <div className="p-5 flex-1 flex flex-col">
                  <h3 className="text-lg font-bold text-gray-800 mb-2 truncate">{obra.nome}</h3>
                  {obra.endereco && (
                    <div className="flex items-start text-gray-500 text-sm mb-4">
                      <MapPin size={16} className="mr-1 mt-0.5 flex-shrink-0" />
                      <span className="line-clamp-2">{obra.endereco}</span>
                    </div>
                  )}
                  
                  <div className="mt-auto pt-4 border-t border-gray-100">
                    <button 
                      onClick={() => handleObraSelect(obra)}
                      className="w-full flex justify-center py-2.5 px-4 rounded-lg bg-gray-50 hover:bg-lunardeli-red hover:text-white transition-colors text-lunardeli-dark font-semibold border border-gray-200 hover:border-transparent text-sm"
                    >
                      Acessar Painel
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : viewMode === 'compact' ? (
          /* Modo 2: Grade Compacta (Miniaturas) */
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredObras.map(obra => (
              <div key={obra.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-all flex flex-col">
                <div className="h-28 bg-gray-100 relative">
                  {obra.imageUrl ? (
                    <img src={getImageUrl(obra.imageUrl)} alt={obra.nome} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      <HardHat size={28} className="opacity-20" />
                    </div>
                  )}
                  <div 
                    className={`absolute top-2 left-2 text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow-sm ${
                      obra.status === 'ATIVA' ? 'bg-green-500' :
                      obra.status === 'INATIVA' ? 'bg-yellow-500' :
                      obra.status === 'FINALIZADA' ? 'bg-red-500' : 'bg-gray-500'
                    }`}
                  >
                    {obra.status || 'ATIVA'}
                  </div>
                </div>

                <div className="p-3.5 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-gray-800 truncate mb-1" title={obra.nome}>{obra.nome}</h3>
                    {obra.endereco ? (
                      <p className="text-xs text-gray-500 flex items-center gap-1 mb-3 truncate" title={obra.endereco}>
                        <MapPin size={12} className="shrink-0" />
                        <span className="truncate">{obra.endereco}</span>
                      </p>
                    ) : (
                      <div className="mb-3" />
                    )}
                  </div>

                  <button 
                    onClick={() => handleObraSelect(obra)}
                    className="w-full py-1.5 px-3 rounded-lg bg-gray-50 hover:bg-lunardeli-red hover:text-white transition-colors text-lunardeli-dark font-semibold border border-gray-200 hover:border-transparent text-xs text-center"
                  >
                    Acessar Painel
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Modo 3: Lista Detalhada (Tabela / Linhas Horizontais) */
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden divide-y divide-gray-100">
            {filteredObras.map(obra => (
              <div key={obra.id} className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-gray-50/80 transition-colors">
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden shrink-0 border border-gray-200 relative">
                    {obra.imageUrl ? (
                      <img src={getImageUrl(obra.imageUrl)} alt={obra.nome} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <HardHat size={20} className="opacity-30" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="text-base font-bold text-gray-800 truncate">{obra.nome}</h3>
                      <span 
                        className={`text-[9px] font-bold px-2 py-0.5 rounded-full text-white shrink-0 ${
                          obra.status === 'ATIVA' ? 'bg-green-500' :
                          obra.status === 'INATIVA' ? 'bg-yellow-500' :
                          obra.status === 'FINALIZADA' ? 'bg-red-500' : 'bg-gray-500'
                        }`}
                      >
                        {obra.status || 'ATIVA'}
                      </span>
                    </div>
                    {obra.endereco && (
                      <p className="text-xs text-gray-500 flex items-center gap-1 truncate">
                        <MapPin size={13} className="shrink-0 text-gray-400" />
                        <span className="truncate">{obra.endereco}</span>
                      </p>
                    )}
                  </div>
                </div>

                <button 
                  onClick={() => handleObraSelect(obra)}
                  className="w-full sm:w-auto px-4 py-2 bg-gray-50 hover:bg-lunardeli-red hover:text-white border border-gray-200 hover:border-transparent rounded-lg font-semibold text-gray-700 text-xs transition-all text-center shrink-0"
                >
                  Acessar Painel →
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Modal Nova Obra */}
      {showNovoModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-xl font-bold mb-4">Cadastrar Nova Obra</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Nome da Obra *</label>
                <input value={novaObra.nome} onChange={e => setNovaObra({...novaObra, nome: e.target.value})} className="w-full px-3 py-2 border rounded-lg focus:ring-red-500 focus:border-red-500 outline-none" placeholder="Ex: Residencial Lumière" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Endereço (opcional)</label>
                <input value={novaObra.endereco} onChange={e => setNovaObra({...novaObra, endereco: e.target.value})} className="w-full px-3 py-2 border rounded-lg focus:ring-red-500 focus:border-red-500 outline-none" placeholder="Ex: Av. Paulista, 1000" />
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-6">
              <button onClick={() => setShowNovoModal(false)} className="px-4 py-2 text-gray-600 font-semibold hover:bg-gray-100 rounded-lg">Cancelar</button>
              <button onClick={handleCriarObra} disabled={loadingCriar} className="px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 flex items-center gap-2">
                {loadingCriar ? <Loader2 size={16} className="animate-spin" /> : null} Salvar Obra
              </button>
            </div>
          </div>
        </div>
      )}



      {/* Modal Editar Empresa */}
      {showEditEmpresaModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 my-8">
            <h3 className="text-xl font-bold mb-4 border-b pb-2">Configurações da Empresa</h3>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Razão Social (Somente Leitura)</label>
                  <input value={empresa?.razaoSocial || ''} disabled className="w-full px-3 py-2 border rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Documento Principal (Somente Leitura)</label>
                  <input value={empresa?.cpfCnpj || empresa?.cnpj || ''} disabled className="w-full px-3 py-2 border rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Nome Fantasia *</label>
                  <input value={empresaEdit.nomeFantasia} onChange={e => setEmpresaEdit({...empresaEdit, nomeFantasia: e.target.value})} className="w-full px-3 py-2 border rounded-lg focus:ring-blue-500 focus:border-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Telefone</label>
                  <input value={empresaEdit.telefone} onChange={e => setEmpresaEdit({...empresaEdit, telefone: e.target.value})} className="w-full px-3 py-2 border rounded-lg focus:ring-blue-500 focus:border-blue-500 outline-none" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t pt-4">
                <div className="md:col-span-1">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">CEP</label>
                  <input value={empresaEdit.cep} onChange={e => setEmpresaEdit({...empresaEdit, cep: e.target.value})} className="w-full px-3 py-2 border rounded-lg focus:ring-blue-500 focus:border-blue-500 outline-none" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Logradouro</label>
                  <input value={empresaEdit.logradouro} onChange={e => setEmpresaEdit({...empresaEdit, logradouro: e.target.value})} className="w-full px-3 py-2 border rounded-lg focus:ring-blue-500 focus:border-blue-500 outline-none" />
                </div>
                <div className="md:col-span-1">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Número</label>
                  <input value={empresaEdit.numero} onChange={e => setEmpresaEdit({...empresaEdit, numero: e.target.value})} className="w-full px-3 py-2 border rounded-lg focus:ring-blue-500 focus:border-blue-500 outline-none" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Bairro</label>
                  <input value={empresaEdit.bairro} onChange={e => setEmpresaEdit({...empresaEdit, bairro: e.target.value})} className="w-full px-3 py-2 border rounded-lg focus:ring-blue-500 focus:border-blue-500 outline-none" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Cidade</label>
                  <input value={empresaEdit.cidade} onChange={e => setEmpresaEdit({...empresaEdit, cidade: e.target.value})} className="w-full px-3 py-2 border rounded-lg focus:ring-blue-500 focus:border-blue-500 outline-none" />
                </div>
                <div className="md:col-span-1">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">UF</label>
                  <input value={empresaEdit.estado} maxLength={2} onChange={e => setEmpresaEdit({...empresaEdit, estado: e.target.value.toUpperCase()})} className="w-full px-3 py-2 border rounded-lg focus:ring-blue-500 focus:border-blue-500 outline-none" />
                </div>
              </div>

              <div className="border-t pt-4">
                <label className="block text-sm font-semibold text-gray-700 mb-1">Logo da Empresa</label>
                <div className="flex items-center gap-4">
                  <label className="cursor-pointer bg-gray-100 hover:bg-gray-200 border border-gray-300 px-4 py-2 rounded-lg flex items-center gap-2 text-gray-700 font-medium transition-colors">
                    {uploadingLogo ? <Loader2 className="animate-spin" size={18} /> : <Upload size={18} />}
                    {uploadingLogo ? 'Enviando...' : 'Atualizar Logo'}
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleLogoUpload} />
                  </label>
                  <span className="text-xs text-gray-500">JPG, PNG. Max 2MB.</span>
                </div>
              </div>
            </div>
            
            <div className="flex gap-3 justify-end mt-6 border-t pt-4">
              <button onClick={() => setShowEditEmpresaModal(false)} className="px-4 py-2 text-gray-600 font-semibold hover:bg-gray-100 rounded-lg">Cancelar</button>
              <button onClick={handleEditarEmpresa} disabled={loadingEditEmpresa} className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 flex items-center gap-2">
                {loadingEditEmpresa ? <Loader2 size={16} className="animate-spin" /> : null} Salvar Cadastro
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
