import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useParams } from 'react-router-dom';
import api from '../../services/api';
import { Users, Loader2, Edit2, Trash2, Shield, Plus } from 'lucide-react';
import { ModalColaboradorObra } from '../../components/ModalColaboradorObra';

interface Colaborador {
  id: string;
  perfil: { id: number, nomeInterno: string };
  usuario: { id: string, nome: string, email: string, perfilGlobal: string };
  permissoes: any;
}

export const Efetivo: React.FC = () => {
  const { user } = useAuth();
  const { obraId } = useParams();
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showModal, setShowModal] = useState(false);
  const [colaboradorEdit, setColaboradorEdit] = useState<Colaborador | null>(null);

  const fetchColaboradores = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/obras/${obraId}/colaboradores`);
      setColaboradores(res.data);
    } catch (e: any) {
      alert('Erro ao carregar colaboradores: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (obraId) fetchColaboradores();
  }, [obraId]);

  const handleExcluir = async (usuarioId: string) => {
    if (!window.confirm('Tem certeza que deseja remover este colaborador da obra?')) return;
    try {
      await api.delete(`/obras/${obraId}/colaboradores/${usuarioId}`);
      fetchColaboradores();
    } catch(e: any) {
      alert('Erro ao excluir: ' + (e?.response?.data?.message || e.message));
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 md:mb-8 gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-800 flex items-center">
            <Users className="mr-3 text-lunardeli-red shrink-0" /> Gestão de Efetivo
          </h1>
          <p className="text-gray-500 mt-1 text-sm">Gerencie quem tem acesso a esta obra e suas permissões.</p>
        </div>
        {user?.perfilGlobal === 'GESTOR' && (
          <button 
            onClick={() => { setColaboradorEdit(null); setShowModal(true); }}
            className="px-4 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 flex items-center shadow-sm shrink-0"
          >
            <Plus size={18} className="mr-2"/> Adicionar Colaborador
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center p-10"><Loader2 className="animate-spin text-red-500" size={32} /></div>
      ) : colaboradores.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center text-gray-500">
          Nenhum colaborador vinculado a esta obra no momento.
        </div>
      ) : (
        <>
          {/* ═══ Desktop Table ═══ */}
          <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-4 text-sm font-semibold text-gray-600">Usuário</th>
                    <th className="px-6 py-4 text-sm font-semibold text-gray-600">Cargo / Perfil</th>
                    <th className="px-6 py-4 text-sm font-semibold text-gray-600">Permissões de Módulo</th>
                    {user?.perfilGlobal === 'GESTOR' && <th className="px-6 py-4 text-right text-sm font-semibold text-gray-600">Ações</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {colaboradores.map(c => (
                    <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-gray-800">{c.usuario.nome}</div>
                        <div className="text-sm text-gray-500">{c.usuario.email}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {c.perfil.nomeInterno}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2">
                          {['GESTOR', 'SUPER_ADMIN'].includes(c.usuario.perfilGlobal) ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 shadow-sm">
                              <Shield size={12} className="mr-1" />
                              Acesso Total da Obra
                            </span>
                          ) : (
                            <>
                              {Object.keys(c.permissoes || {}).map(mod => (
                                <span key={mod} className="inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold bg-gray-100 text-gray-700 shadow-sm border border-gray-200">
                                  <Shield size={12} className={`mr-1 ${c.permissoes[mod] === 'EDIT' ? 'text-green-500' : 'text-yellow-500'}`} />
                                  {mod}: {c.permissoes[mod] === 'EDIT' ? 'Edição' : 'Visualização'}
                                </span>
                              ))}
                              {(!c.permissoes || Object.keys(c.permissoes).length === 0) && (
                                 <span className="text-gray-400 text-xs italic">Nenhuma permissão especial</span>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                      {user?.perfilGlobal === 'GESTOR' && (
                        <td className="px-6 py-4 text-right space-x-2">
                          <button onClick={() => { setColaboradorEdit(c); setShowModal(true); }} className="p-2 text-gray-400 hover:text-blue-600 bg-gray-50 hover:bg-blue-50 rounded-lg transition-colors" title="Editar Permissões">
                            <Edit2 size={16} />
                          </button>
                          <button onClick={() => handleExcluir(c.usuario.id)} className="p-2 text-gray-400 hover:text-red-600 bg-gray-50 hover:bg-red-50 rounded-lg transition-colors" title="Remover Colaborador">
                            <Trash2 size={16} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ═══ Mobile Cards ═══ */}
          <div className="md:hidden space-y-3">
            {colaboradores.map(c => (
              <div key={c.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="min-w-0">
                    <p className="font-bold text-gray-800 truncate">{c.usuario.nome}</p>
                    <p className="text-sm text-gray-500 truncate">{c.usuario.email}</p>
                  </div>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 shrink-0 ml-2">
                    {c.perfil.nomeInterno}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {['GESTOR', 'SUPER_ADMIN'].includes(c.usuario.perfilGlobal) ? (
                    <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                      <Shield size={12} className="mr-1" /> Acesso Total
                    </span>
                  ) : (
                    <>
                      {Object.keys(c.permissoes || {}).map(mod => (
                        <span key={mod} className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-semibold bg-gray-100 text-gray-700 border border-gray-200">
                          <Shield size={10} className={`mr-1 ${c.permissoes[mod] === 'EDIT' ? 'text-green-500' : 'text-yellow-500'}`} />
                          {mod}
                        </span>
                      ))}
                      {(!c.permissoes || Object.keys(c.permissoes).length === 0) && (
                        <span className="text-gray-400 text-xs italic">Sem permissões</span>
                      )}
                    </>
                  )}
                </div>
                {user?.perfilGlobal === 'GESTOR' && (
                  <div className="flex gap-2 pt-3 border-t border-gray-100">
                    <button onClick={() => { setColaboradorEdit(c); setShowModal(true); }} className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg active:bg-blue-100">
                      <Edit2 size={14} /> Editar
                    </button>
                    <button onClick={() => handleExcluir(c.usuario.id)} className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg active:bg-red-100">
                      <Trash2 size={14} /> Remover
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {showModal && (
        <ModalColaboradorObra 
          obraId={obraId!}
          colaboradorEdit={colaboradorEdit}
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); fetchColaboradores(); }}
        />
      )}
    </div>
  );
};
