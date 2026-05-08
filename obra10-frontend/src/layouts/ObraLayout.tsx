import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  LogOut, Settings, LayoutDashboard, Users, FileText, ArrowLeft, BarChart2, Loader2,
  Beaker, ClipboardCheck, Home, Package, Calendar, Clock, Layers, Files, ShieldCheck, Heart, BadgeDollarSign
} from 'lucide-react';
import api from '../services/api';
import { getImageUrl } from '../utils/image';

const MODULE_ICONS: Record<string, any> = {
  RDO: FileText,
  CTRL_TEC: Beaker,
  PQO: ClipboardCheck,
  CLIENTES: Home,
  ESTOQUE: Package,
  PLANEJAMENTO: Calendar,
  PONTUALIDADE: Clock,
  PROJETOS: Layers,
  DOCUMENTOS: Files,
  SEGURANCA: ShieldCheck,
  SOCIAL: Heart,
  VENDAS: BadgeDollarSign,
};

export const ObraLayout: React.FC = () => {
  const { logout, obraAtiva, empresa, setObraAtiva, user, updateUserPhoto } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [uploadingUserPhoto, setUploadingUserPhoto] = useState(false);

  // Hide bottom nav when the user is inside DiarioDeObra (it has its own floating action bar)
  const isInsideDiario = /\/rdos\/(novo|[a-f0-9-]+)$/i.test(location.pathname);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleBackToCompany = () => {
    setObraAtiva(null);
    navigate('/dashboard');
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
      alert('Erro ao atualizar foto de perfil: ' + (err?.response?.data?.message || err.message));
    } finally {
      setUploadingUserPhoto(false);
      e.target.value = '';
    }
  };

  const hasPerm = (slug: string) => {
    if (!obraAtiva || !obraAtiva.minhasPermissoes) return false;
    if (obraAtiva.minhasPermissoes.includes('SUPER')) return true;
    return obraAtiva.minhasPermissoes.includes(slug);
  };

  // Static permanent items
  const baseItems = [
    { name: 'Painel Geral', icon: LayoutDashboard, path: `/obras/${obraAtiva?.id}/dashboard`, visible: true },
  ];

  // Dynamic module items based on what the company contracted AND what the user has permission for
  const moduleItems = (empresa?.modulos || [])
    .filter(m => hasPerm(m.slug)) // Most items require permission in the Obra
    .map(m => ({
      name: m.nome,
      slug: m.slug,
      icon: MODULE_ICONS[m.slug] || Package,
      path: `/obras/${obraAtiva?.id}/${m.slug === 'RDO' ? 'rdos' : m.slug.toLowerCase()}`,
      visible: true
    }));

  // Special case items: Dashboard RDO (only if RDO is active and has perm)
  const extraItems = [];
  if (hasPerm('RDO')) {
    extraItems.push({ name: 'Dashboard RDO', icon: BarChart2, path: `/obras/${obraAtiva?.id}/rdos/dashboard`, visible: true });
  }

  // Final permanent items
  const footerItems = [
    { name: 'Efetivo', icon: Users, path: `/obras/${obraAtiva?.id}/efetivo`, visible: true },
    { name: 'Configurações', icon: Settings, path: `/obras/${obraAtiva?.id}/configuracoes`, visible: hasPerm('SUPER') },
  ];

  const menuItems = [...baseItems, ...moduleItems, ...extraItems, ...footerItems].filter(item => item.visible);

  // const baseURL = import.meta.env.VITE_API_URL ?? '';

  return (
    <div className="flex min-h-screen bg-lunardeli-gray font-sans">
      {/* Sidebar Desktop */}
      <aside className="w-64 bg-lunardeli-dark text-white flex-col hidden md:flex shrink-0 shadow-2xl z-10 transition-all duration-300">
        
        {/* Brand Area */}
        <div className="h-20 flex flex-col justify-center px-4 bg-black/30 border-b border-white/10 relative overflow-hidden">
             <div className="flex items-center justify-between mb-1 z-10">
                <button title="Voltar" onClick={handleBackToCompany} className="p-1.5 -ml-1.5 hover:bg-white/10 rounded-md text-gray-400 hover:text-white transition-colors">
                  <ArrowLeft size={18} />
                </button>
                <div className="flex-1 min-w-0 pl-2">
                   <span className="text-[11px] font-bold tracking-widest uppercase block text-lunardeli-red truncate">{empresa?.razaoSocial}</span>
                   <span className="text-sm font-semibold text-white block truncate">{obraAtiva?.nome || 'Obra Indefinida'}</span>
                </div>
             </div>
        </div>

        {/* Obra Cover Thumbnail (Optional touch of design) */}
        {obraAtiva?.imageUrl && (
            <div className="h-20 w-full relative">
               <img src={getImageUrl(obraAtiva.imageUrl)} className="w-full h-full object-cover opacity-30" alt="Capa" />
               <div className="absolute inset-0 bg-gradient-to-t from-lunardeli-dark to-transparent"></div>
            </div>
        )}
        
        <nav className="flex-1 py-6 px-3 space-y-1.5 overflow-y-auto">
          {menuItems.map(item => {
            const isActive = location.pathname.startsWith(item.path);
            return (
              <button 
                key={item.name}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center px-3 py-3 rounded-lg font-medium transition-all duration-200 ${
                  isActive 
                    ? 'bg-lunardeli-red text-white shadow-md shadow-lunardeli-red/20' 
                    : 'text-gray-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <item.icon className="mr-3 shrink-0" size={20} strokeWidth={isActive ? 2.5 : 2} />
                {item.name}
              </button>
            )
          })}
        </nav>

        <div className="p-3 border-t border-white/10 bg-black/20 flex flex-col gap-2">
            
            {/* User Profile Info */}
            <div className="flex items-center gap-3 px-2 py-2">
              <label title="Alterar Foto de Perfil" className="relative cursor-pointer group flex items-center justify-center w-10 h-10 rounded-full overflow-hidden bg-white/10 border border-white/20 transition-all hover:border-lunardeli-red shrink-0 shadow-md">
                {uploadingUserPhoto ? (
                  <Loader2 className="animate-spin text-white" size={16} />
                ) : user?.fotoUrl ? (
                  <>
                     <img src={getImageUrl(user.fotoUrl)} alt="Meu Perfil" className="w-full h-full object-cover" />
                     <div className="absolute inset-0 bg-black/60 hidden group-hover:flex items-center justify-center transition-all">
                       <span className="text-[9px] text-white font-bold uppercase tracking-wider">Foto</span>
                     </div>
                  </>
                ) : (
                  <>
                     <span className="text-sm font-bold text-white group-hover:hidden">
                        {user?.nome?.charAt(0).toUpperCase()}
                     </span>
                     <div className="absolute inset-0 bg-white/20 hidden group-hover:flex items-center justify-center transition-all">
                       <span className="text-[9px] text-white font-bold uppercase tracking-wider">Foto</span>
                     </div>
                  </>
                )}
                <input type="file" className="hidden" accept="image/*" onChange={handleUserPhotoUpload} />
              </label>
              
              <div className="flex-1 min-w-0">
                 <p className="text-sm font-semibold text-white truncate">{user?.nome}</p>
                 <p className="text-[10px] text-gray-400 uppercase tracking-widest truncate">{user?.perfilGlobal}</p>
              </div>
            </div>

            <button 
              onClick={handleLogout}
              className="flex w-full items-center px-3 py-2.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors font-medium text-sm"
            >
              <LogOut className="mr-3" size={18} />
              Sair do sistema
            </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header Mobile */}
        <header className="h-14 bg-white shadow-sm flex items-center justify-between px-4 md:hidden shrink-0 z-10 relative">
          <div className="flex items-center text-lunardeli-dark min-w-0">
            <button onClick={handleBackToCompany} className="p-2.5 -ml-2 mr-1 text-gray-500 hover:text-lunardeli-red active:bg-gray-100 rounded-lg">
               <ArrowLeft size={20} />
            </button>
             <div className="min-w-0">
                <span className="text-[10px] font-bold uppercase text-lunardeli-red block truncate leading-tight">{empresa?.razaoSocial}</span>
                <span className="font-bold text-sm truncate block leading-tight">{obraAtiva?.nome || 'Obra Indefinida'}</span>
             </div>
          </div>
          
          <div className="flex items-center gap-2">
            <label className="relative cursor-pointer flex items-center justify-center w-9 h-9 rounded-full overflow-hidden bg-gray-100 border border-gray-300 shrink-0">
               {uploadingUserPhoto ? (
                 <Loader2 className="animate-spin text-lunardeli-red" size={14} />
               ) : user?.fotoUrl ? (
                 <img src={getImageUrl(user.fotoUrl)} alt="Meu Perfil" className="w-full h-full object-cover" />
               ) : (
                 <span className="text-xs font-bold text-gray-600">{user?.nome?.charAt(0).toUpperCase()}</span>
               )}
               <input type="file" className="hidden" accept="image/*" onChange={handleUserPhotoUpload} />
            </label>
            <button onClick={handleLogout} className="text-gray-500 hover:text-lunardeli-red p-2.5 shrink-0 active:bg-gray-100 rounded-lg">
              <LogOut size={20} />
            </button>
          </div>
        </header>

        {/* Dynamic Nested Content — add bottom padding on mobile for bottom nav */}
        <div className="flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)] md:pb-0">
          <div className={`md:pb-0 ${isInsideDiario ? 'pb-0' : 'pb-20'}`}>
            <Outlet />
          </div>
        </div>
      </main>

      {/* ═══ Bottom Navigation Bar — Mobile Only ═══ */}
      {/* Hidden when inside DiarioDeObra since it has its own floating action bar */}
      {!isInsideDiario && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-[0_-2px_10px_rgba(0,0,0,0.06)]" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
          <div className="flex items-center justify-around h-16 px-1">
            {menuItems.slice(0, 5).map(item => {
              const isActive = location.pathname.startsWith(item.path);
              return (
                <button
                  key={item.name}
                  onClick={() => navigate(item.path)}
                  className={`flex flex-col items-center justify-center flex-1 h-full min-w-0 relative transition-colors ${
                    isActive ? 'text-lunardeli-red' : 'text-gray-400'
                  }`}
                >
                  {/* Active indicator bar */}
                  {isActive && (
                    <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[3px] bg-lunardeli-red rounded-b-full" />
                  )}
                  <item.icon size={22} strokeWidth={isActive ? 2.5 : 1.8} className="shrink-0" />
                  <span className={`text-[10px] mt-0.5 leading-tight truncate max-w-full px-1 ${isActive ? 'font-bold' : 'font-medium'}`}>
                    {item.name}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
};

