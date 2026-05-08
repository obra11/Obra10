import React, { useRef, useState, useEffect } from 'react';
import { useAuth, type Obra } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { HardHat, LogOut, Upload, Building2, MapPin, Loader2, Plus, Trash2, Edit2, Users, AlertTriangle, DollarSign, ExternalLink } from 'lucide-react';
import api from '../services/api';

export const CompanyDashboard: React.FC = () => {
  const { user, empresa, obras, logout, setObraAtiva, updateEmpresaLogo, updateObraImage, updateUserPhoto } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingUserPhoto, setUploadingUserPhoto] = useState(false);
  const [uploadingObraId, setUploadingObraId] = useState<string | null>(null);

  const [showNovoModal, setShowNovoModal] = useState(false);
  const [novaObra, setNovaObra] = useState({ nome: '', endereco: '' });
  const [loadingCriar, setLoadingCriar] = useState(false);
  const [loadingExcluirId, setLoadingExcluirId] = useState<string | null>(null);

  const [showEditModal, setShowEditModal] = useState(false);
  const [obraEdit, setObraEdit] = useState<{id: string, nome: string, endereco: string}>({ id: '', nome: '', endereco: '' });
  const [loadingEdit, setLoadingEdit] = useState(false);

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

  const handleEditarObra = async () => {
    if (!obraEdit.nome.trim()) return;
    setLoadingEdit(true);
    try {
      await api.patch(`/obras/${obraEdit.id}`, { nome: obraEdit.nome, endereco: obraEdit.endereco });
      window.location.reload();
    } catch(e: any) {
      alert('Erro ao editar obra: ' + (e?.response?.data?.message || e.message));
    } finally { setLoadingEdit(false); }
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

  const handleExcluirObra = async (id: string, nome: string) => {
    if(!window.confirm(`Você está prestes a excluir a obra "${nome}".\n\nATENÇÃO: Você perderá todos os dados, anexos e RDOs vinculados a ela. Esta ação não pode ser desfeita.\n\nTem certeza que deseja continuar?`)) return;
    setLoadingExcluirId(id);
    try {
      await api.delete(`/obras/${id}`);
      window.location.reload();
    } catch(e: any) {
      alert('Erro ao excluir obra: ' + (e?.response?.data?.message || e.message));
    } finally { setLoadingExcluirId(null); }
  };

  const handleToggleStatus = async (obra: Obra) => {
    if (user?.perfilGlobal !== 'GESTOR') return;
    const nextStatus = 
      obra.status === 'ATIVA' ? 'INATIVA' : 
      obra.status === 'INATIVA' ? 'FINALIZADA' : 
      'ATIVA';
      
    try {
      await api.patch(`/obras/${obra.id}`, { status: nextStatus });
      window.location.reload();
    } catch(e: any) {
      alert('Erro ao alterar status: ' + (e?.response?.data?.message || e.message));
    }
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
      if(fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleObraImageUpload = async (obraId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingObraId(obraId);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await api.post(`/upload/obra/${obraId}/imagem`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      updateObraImage(obraId, response.data.url);
    } catch (err: any) {
      console.error('Erro ao fazer upload da imagem da obra:', err);
      alert('Erro ao fazer upload da capa: ' + (err?.response?.data?.message || err.message));
    } finally {
      setUploadingObraId(null);
      e.target.value = '';
    }
  };

  const baseURL = import.meta.env.VITE_API_URL ?? '';

  return (
    <div className="min-h-screen bg-lunardeli-gray">
      {/* Header Construtora */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 md:h-20 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="relative flex-shrink-0">
              {empresa?.logoUrl ? (
                <img src={`${baseURL}${empresa.logoUrl}`} alt="Logo Empresa" className="h-12 w-auto max-w-[150px] object-contain" />
              ) : (
                <div className="h-12 w-12 bg-gray-100 rounded border-dashed border-2 border-gray-300 flex items-center justify-center text-gray-400">
                  <Building2 size={24} />
                </div>
              )}
            </div>
            
            <div className="border-l pl-4 border-gray-200">
              <div className="flex items-center gap-2">
                <h1 className="text-base md:text-xl font-bold text-lunardeli-dark truncate max-w-[140px] md:max-w-[200px]">{empresa?.nomeFantasia || empresa?.razaoSocial}</h1>
                {user?.perfilGlobal === 'GESTOR' && (
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
                     <img src={`${baseURL}${user.fotoUrl}`} alt="Meu Perfil" className="w-full h-full object-cover" />
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
            {user?.perfilGlobal === 'GESTOR' && (
              <>
                <button onClick={() => navigate('/gestor/usuarios')} className="text-gray-500 flex items-center hover:text-lunardeli-red font-semibold transition-colors" title="Equipe">
                  <Users size={18} className="sm:mr-2" /> <span className="hidden sm:inline">Equipe</span>
                </button>
                <button onClick={() => navigate('/assinatura')} className="text-gray-500 flex items-center hover:text-lunardeli-red font-semibold transition-colors" title="Meu Plano">
                  <Building2 size={18} className="sm:mr-2" /> <span className="hidden sm:inline">Meu Plano</span>
                </button>
              </>
            )}
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
        <div className="flex justify-between items-end mb-8">
            <div>
                <h2 className="text-2xl font-bold text-gray-800">Suas Obras</h2>
                <p className="text-gray-500 text-sm mt-1">Selecione um canteiro de obras para acessar seus módulos e RDOs.</p>
            </div>
            {user?.perfilGlobal === 'GESTOR' && (
              <button onClick={() => setShowNovoModal(true)} className="px-3 md:px-4 py-2.5 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 active:bg-red-800 flex items-center gap-1.5 md:gap-2 text-sm">
                <Plus size={18} /> <span className="hidden sm:inline">Nova </span>Obra
              </button>
            )}
        </div>

        {obras.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center text-gray-500">
            <HardHat size={48} className="mx-auto mb-4 opacity-20" />
            <p>Nenhuma obra vinculada ao seu usuário no momento.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {obras.map(obra => (
              <div key={obra.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow group flex flex-col">
                {/* Obra Cover Image */}
                <div className="h-48 bg-gray-100 relative group/cover">
                  {obra.imageUrl ? (
                    <img src={`${baseURL}${obra.imageUrl}`} alt={obra.nome} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                      <HardHat size={48} className="mb-2 opacity-20" />
                      <span className="text-sm font-medium">Capa da Obra</span>
                    </div>
                  )}
                  
                  {/* Overlay Upload Button was here, moved to Edit Modal */}
                  
                  {/* Status Badge */}
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleToggleStatus(obra); }}
                    title={user?.perfilGlobal === 'GESTOR' ? "Clique para alterar o status" : ""}
                    className={`absolute top-3 left-3 text-white text-[10px] md:text-xs font-bold px-2.5 py-1 rounded-full shadow-sm transition-colors ${
                      obra.status === 'ATIVA' ? 'bg-green-500 hover:bg-green-600' :
                      obra.status === 'INATIVA' ? 'bg-yellow-500 hover:bg-yellow-600' :
                      obra.status === 'FINALIZADA' ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-500'
                    } ${user?.perfilGlobal === 'GESTOR' ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    {obra.status}
                  </button>
                  
                  {/* Editar Badge */}
                  {user?.perfilGlobal === 'GESTOR' && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); setObraEdit({ id: obra.id, nome: obra.nome, endereco: obra.endereco || '' }); setShowEditModal(true); }}
                      className="absolute top-3 right-[88px] md:right-24 bg-blue-500/90 hover:bg-blue-600 text-white p-2.5 rounded-full cursor-pointer shadow-sm transition-all"
                      title="Editar Obra"
                    >
                      <Edit2 size={16} />
                    </button>
                  )}
                  
                  {/* Excluir Badge */}
                  {user?.perfilGlobal === 'GESTOR' && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleExcluirObra(obra.id, obra.nome); }}
                      className="absolute top-3 right-12 bg-red-500/90 hover:bg-red-600 text-white p-2.5 rounded-full cursor-pointer shadow-sm transition-all"
                      title="Excluir Obra"
                    >
                      {loadingExcluirId === obra.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                    </button>
                  )}
                </div>

                {/* Obra Details */}
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
                      className="w-full flex justify-center py-2.5 px-4 rounded-lg bg-gray-50 hover:bg-lunardeli-red hover:text-white transition-colors text-lunardeli-dark font-semibold border border-gray-200 hover:border-transparent"
                    >
                      Acessar Painel
                    </button>
                  </div>
                </div>
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

      {/* Modal Editar Obra */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-xl font-bold mb-4">Editar Obra</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Nome da Obra *</label>
                <input value={obraEdit.nome} onChange={e => setObraEdit({...obraEdit, nome: e.target.value})} className="w-full px-3 py-2 border rounded-lg focus:ring-blue-500 focus:border-blue-500 outline-none" placeholder="Ex: Residencial Lumière" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Endereço (opcional)</label>
                <input value={obraEdit.endereco} onChange={e => setObraEdit({...obraEdit, endereco: e.target.value})} className="w-full px-3 py-2 border rounded-lg focus:ring-blue-500 focus:border-blue-500 outline-none" placeholder="Ex: Av. Paulista, 1000" />
                <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Capa da Obra</label>
                <div className="flex items-center gap-4">
                  <label className="cursor-pointer bg-gray-100 hover:bg-gray-200 border border-gray-300 px-4 py-2 rounded-lg flex items-center gap-2 text-gray-700 font-medium transition-colors">
                    {uploadingObraId === obraEdit.id ? <Loader2 className="animate-spin" size={18} /> : <Upload size={18} />}
                    {uploadingObraId === obraEdit.id ? 'Enviando...' : 'Atualizar Imagem'}
                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handleObraImageUpload(obraEdit.id, e)} />
                  </label>
                  <span className="text-xs text-gray-500">Selecione uma imagem para a capa (JPG, PNG).</span>
                </div>
              </div>
            </div>
            </div>
            <div className="flex gap-3 justify-end mt-6">
              <button onClick={() => setShowEditModal(false)} className="px-4 py-2 text-gray-600 font-semibold hover:bg-gray-100 rounded-lg">Cancelar</button>
              <button onClick={handleEditarObra} disabled={loadingEdit} className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 flex items-center gap-2">
                {loadingEdit ? <Loader2 size={16} className="animate-spin" /> : null} Salvar Obra
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
