import React, { useState, useEffect } from 'react';
import { Loader2, X, Shield, ShieldAlert } from 'lucide-react';
import api from '../services/api';

interface ModalColaboradorObraProps {
  obraId: string;
  colaboradorEdit: any | null; // se null = modo Adição
  onClose: () => void;
  onSuccess: () => void;
}

export const ModalColaboradorObra: React.FC<ModalColaboradorObraProps> = ({ obraId, colaboradorEdit, onClose, onSuccess }) => {
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [saving, setSaving] = useState(false);

  // State do formulário
  const [selectedUserId, setSelectedUserId] = useState('');
  
  // permissoes form state: { "RDO": "EDIT", "FVS": "VIEW" }
  const [permissoes, setPermissoes] = useState<Record<string, string>>({});

  const modulosDisponiveis = [
    { slug: 'RDO', nome: 'Diário de Obra (RDO)' },
    { slug: 'FVS', nome: 'Ficha de Verificação (FVS)' },
    { slug: 'PROJETOS', nome: 'Gestão de Projetos' }
  ];

  useEffect(() => {
    // Carregar usuários da empresa para o select
    const fetchUsuarios = async () => {
      try {
        const res = await api.get('/usuarios');
        setUsuarios(res.data);
      } catch (err: any) {
        console.error('Erro ao buscar usuários', err);
      } finally {
        setLoadingUsers(false);
      }
    };
    fetchUsuarios();

    if (colaboradorEdit) {
      setSelectedUserId(colaboradorEdit.usuario.id);
      setPermissoes(colaboradorEdit.permissoes || {});
    }
  }, [colaboradorEdit]);

  const handleToggleModulo = (slug: string) => {
    setPermissoes(prev => {
      const next = { ...prev };
      if (next[slug]) {
        delete next[slug]; // Remove acesso
      } else {
        next[slug] = 'VIEW'; // Valor padrão ao habilitar
      }
      return next;
    });
  };

  const handleChangeNivel = (slug: string, nivel: string) => {
    setPermissoes(prev => ({ ...prev, [slug]: nivel }));
  };

  const handleSave = async () => {
    if (!colaboradorEdit && !selectedUserId) {
      alert('Selecione um usuário.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        usuarioId: selectedUserId,
        permissoes: permissoes
      };

      if (colaboradorEdit) {
        // Edit
        await api.patch(`/obras/${obraId}/colaboradores/${selectedUserId}`, payload);
      } else {
        // Create
        await api.post(`/obras/${obraId}/colaboradores`, payload);
      }
      onSuccess();
    } catch (err: any) {
      alert('Erro ao salvar colaborador: ' + (err?.response?.data?.message || err.message));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
          <h3 className="text-xl font-bold text-gray-800 flex items-center">
            {colaboradorEdit ? 'Editar Permissões' : 'Adicionar Colaborador'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 bg-white p-1 rounded-md shadow-sm border border-gray-200">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {/* USER SELECTION */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-1">Usuário</label>
            {colaboradorEdit ? (
              <div className="px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-gray-700 font-medium">
                {colaboradorEdit.usuario.nome} ({colaboradorEdit.usuario.email})
              </div>
            ) : (
              <select 
                value={selectedUserId} 
                onChange={(e) => setSelectedUserId(e.target.value)}
                disabled={loadingUsers}
                className="w-full px-3 py-2 border rounded-lg focus:ring-red-500 focus:border-red-500 outline-none bg-white font-medium text-gray-700"
              >
                <option value="">Selecione um usuário da empresa...</option>
                {usuarios.map(u => (
                  <option key={u.id} value={u.id}>{u.nome} ({u.email})</option>
                ))}
              </select>
            )}
            {loadingUsers && !colaboradorEdit && <p className="text-xs text-gray-500 mt-1 animate-pulse">Carregando usuários...</p>}
          </div>

          <div className="border-t border-gray-200 pt-6">
            <h4 className="font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-100">Controle de Módulos da Obra</h4>
            
            <div className="space-y-4">
              {modulosDisponiveis.map(mod => {
                const currentUserData = usuarios.find(u => u.id === selectedUserId);
                const activeModulosGlobais = currentUserData 
                  ? currentUserData.usuarioModulos?.map((um: any) => um.modulo.slug) || []
                  : [];
                
                // GESTOR has access to everything implicitly if we don't track it, but we should rely on activeModulosGlobais
                // Se a lista de usuários ainda não carregou ou o cara não selecionou ninguém, bloqueia
                const temPermissaoGlobal = (!selectedUserId) || activeModulosGlobais.includes(mod.slug);

                const temAcesso = !!permissoes[mod.slug] && temPermissaoGlobal;
                const nivel = permissoes[mod.slug] || 'VIEW';

                return (
                  <div key={mod.slug} className={`border rounded-lg p-4 transition-colors ${!temPermissaoGlobal ? 'border-gray-100 bg-gray-50 opacity-60' : temAcesso ? 'border-red-200 bg-red-50/30' : 'border-gray-200 bg-white'}`}>
                    <div className="flex items-center justify-between mb-2">
                       <label className={`flex items-center font-bold select-none ${!temPermissaoGlobal ? 'text-gray-400 cursor-not-allowed' : 'text-gray-700 cursor-pointer'}`}>
                         <input 
                           type="checkbox" 
                           checked={temAcesso}
                           disabled={!temPermissaoGlobal}
                           onChange={() => handleToggleModulo(mod.slug)}
                           className="mr-3 w-4 h-4 text-red-600 rounded border-gray-300 focus:ring-red-500 disabled:opacity-50"
                         />
                         {mod.nome}
                         {!temPermissaoGlobal && selectedUserId && (
                           <span className="ml-2 text-[10px] font-normal tracking-wide text-red-500 bg-red-50 px-2 py-0.5 rounded-sm border border-red-100 uppercase">
                             Bloqueado no Perfil Global
                           </span>
                         )}
                       </label>
                    </div>

                    {temAcesso && temPermissaoGlobal && (
                      <div className="ml-7 mt-3 flex items-center gap-4 p-3 bg-white rounded-md border border-red-100 shadow-sm">
                        <label className="flex items-center cursor-pointer text-sm font-medium text-gray-600">
                          <input 
                            type="radio" 
                            name={`nivel_${mod.slug}`} 
                            value="VIEW" 
                            checked={nivel === 'VIEW'} 
                            onChange={() => handleChangeNivel(mod.slug, 'VIEW')}
                            className="mr-2 text-blue-500 focus:ring-blue-500"
                          />
                          <Shield size={16} className="text-blue-500 mr-1"/> Apenas Visualizar
                        </label>
                        <label className="flex items-center cursor-pointer text-sm font-medium text-gray-600">
                          <input 
                            type="radio" 
                            name={`nivel_${mod.slug}`} 
                            value="EDIT" 
                            checked={nivel === 'EDIT'} 
                            onChange={() => handleChangeNivel(mod.slug, 'EDIT')}
                            className="mr-2 text-green-500 focus:ring-green-500"
                          />
                          <ShieldAlert size={16} className="text-green-500 mr-1"/> Pode Editar / Criar
                        </label>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-gray-100 bg-gray-50 flex gap-3 justify-end shrink-0">
          <button 
            onClick={onClose} 
            className="px-5 py-2.5 text-gray-600 font-bold hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button 
            onClick={handleSave} 
            disabled={saving || (!colaboradorEdit && !selectedUserId)} 
            className="px-5 py-2.5 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center transition-colors shadow-sm"
          >
            {saving ? <Loader2 size={18} className="animate-spin mr-2" /> : null} 
            {colaboradorEdit ? 'Salvar Permissões' : 'Adicionar à Obra'}
          </button>
        </div>

      </div>
    </div>
  );
};
