import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { Search, Loader2, Key, AlertTriangle, ShieldAlert } from 'lucide-react';

export const AdminUsuarios: React.FC = () => {
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterPerfil, setFilterPerfil] = useState<string>('ALL');

  const fetchUsuarios = async () => {
    try {
      const res = await api.get('/admin/usuarios');
      setUsuarios(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsuarios();
  }, []);

  const handleToggleBloqueio = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja bloquear/desbloquear este usuário?')) return;
    try {
      await api.patch(`/admin/usuarios/${id}/bloquear`);
      fetchUsuarios();
    } catch (err) {
      alert('Erro ao bloquear usuário');
    }
  };

  const handleResetSenha = async (userId: string) => {
    if (!window.confirm('Gerar nova senha temporária para este usuário?')) return;
    try {
      const res = await api.patch(`/admin/usuarios/${userId}/reset-senha`);
      window.prompt(res.data.message, res.data.novaSenhaTemporaria);
    } catch (e) {
      alert('Erro ao resetar senha');
    }
  };

  const filtered = usuarios.filter(u => {
    const term = search.toLowerCase();
    const matchSearch = u.nome.toLowerCase().includes(term) ||
      u.email.toLowerCase().includes(term) ||
      u.empresa?.razaoSocial?.toLowerCase().includes(term);
    
    let matchStatus = true;
    if (filterStatus === 'ATIVO') matchStatus = u.ativo === true;
    if (filterStatus === 'BLOQUEADO') matchStatus = u.ativo === false;

    let matchPerfil = true;
    if (filterPerfil !== 'ALL') matchPerfil = u.perfilGlobal === filterPerfil;

    return matchSearch && matchStatus && matchPerfil;
  });

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gerir Usuários globais</h1>
          <p className="text-sm text-gray-500 mt-1">Busca cross-tenant por todos os usuários.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={18} className="text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500 sm:text-sm"
              placeholder="Nome, email ou empresa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select 
            value={filterPerfil} 
            onChange={e => setFilterPerfil(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500"
          >
            <option value="ALL">Todos os Perfis</option>
            <option value="SUPER_ADMIN">Super Admin</option>
            <option value="GESTOR">Gestor</option>
            <option value="USER">Usuário (Peão)</option>
          </select>

          <select 
            value={filterStatus} 
            onChange={e => setFilterStatus(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500"
          >
            <option value="ALL">Todos os Status</option>
            <option value="ATIVO">Ativos</option>
            <option value="BLOQUEADO">Bloqueados</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-red-600" size={40} /></div>
      ) : (
        <div className="bg-white shadow-sm rounded-xl border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Usuário</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Empresa</th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Perfil</th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filtered.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{u.nome}</div>
                    <div className="text-xs text-gray-500">{u.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{u.empresa?.nomeFantasia || u.empresa?.razaoSocial}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${u.perfilGlobal === 'SUPER_ADMIN' ? 'bg-red-100 text-red-800 border border-red-200' : 'bg-gray-100 text-gray-800'}`}>
                      {u.perfilGlobal === 'SUPER_ADMIN' && <ShieldAlert size={12} className="mr-1 mt-0.5" />}
                      {u.perfilGlobal}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${u.ativo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {u.ativo ? 'Ativo' : 'Bloqueado'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                    <button onClick={() => handleResetSenha(u.id)} className="text-gray-500 hover:text-blue-600 transition-colors" title="Resetar Senha">
                      <Key size={18} />
                    </button>
                    <button onClick={() => handleToggleBloqueio(u.id)} className="text-gray-500 hover:text-red-600 transition-colors ml-4" title={u.ativo ? 'Bloquear' : 'Desbloquear'}>
                      <AlertTriangle size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="p-8 text-center text-gray-500">Nenhum usuário correspondente encontrado.</div>
          )}
        </div>
      )}
    </div>
  );
};
