import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { Package, Loader2, Edit2, Save, X, Power } from 'lucide-react';

export const AdminModulos: React.FC = () => {
  const [modulos, setModulos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState<string | null>(null);
  const [precoEdit, setPrecoEdit] = useState('');
  const [descEdit, setDescEdit] = useState('');

  const fetchModulos = async () => {
    try {
      const res = await api.get('/admin/modulos');
      setModulos(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchModulos();
  }, []);

  const iniciarEdicao = (mod: any) => {
    setEditando(mod.id);
    setPrecoEdit(mod.preco);
    setDescEdit(mod.descricao || '');
  };

  const salvarEdicao = async (id: string) => {
    try {
      await api.patch(`/admin/modulos/${id}`, {
        preco: Number(precoEdit),
        descricao: descEdit,
      });
      setEditando(null);
      fetchModulos();
    } catch (err) {
      alert('Erro ao salvar módulo');
    }
  };

  const toggleStatusModulo = async (mod: any) => {
    if (!window.confirm(`Deseja realmente ${mod.ativo ? 'desativar' : 'ativar'} o módulo "${mod.nome}"? ${mod.ativo ? '\n\nAo desativar, novas empresas não poderão contratá-lo e as atuais poderão perder acesso temporariamente.' : ''}`)) return;
    try {
      await api.patch(`/admin/modulos/${mod.id}`, {
        ativo: !mod.ativo
      });
      fetchModulos();
    } catch (err) {
      alert('Erro ao alterar status do módulo');
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-red-600" size={40} /></div>;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Catálogo de Módulos</h1>
        <p className="text-sm text-gray-500 mt-1">Gerencie os preços e descrições públicas dos módulos do SaaS.</p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {modulos.map(mod => (
          <div key={mod.id} className={`bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col md:flex-row gap-6 transition-all ${!mod.ativo ? 'opacity-60 grayscale-[0.5]' : ''}`}>
            
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-red-50 text-red-600 rounded-lg flex items-center justify-center shrink-0 border border-red-100">
                  <Package size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                    {mod.nome}
                    <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{mod.slug}</span>
                  </h3>
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest">{mod.grupo}</span>
                </div>
              </div>
              
              {editando === mod.id ? (
                <div className="space-y-3 mt-4">
                  <input type="text" value={descEdit} onChange={e => setDescEdit(e.target.value)} className="w-full text-sm border p-2 rounded focus:border-red-500 focus:ring-1 focus:ring-red-500" placeholder="Descrição do módulo..."/>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-500">R$</span>
                    <input type="number" value={precoEdit} onChange={e => setPrecoEdit(e.target.value)} className="w-32 text-sm border p-2 rounded focus:border-red-500 focus:ring-1 focus:ring-red-500"/>
                    <span className="text-sm text-gray-500">/mês</span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-600 mt-2">{mod.descricao || 'Sem descrição cadastrada no momento.'}</p>
              )}
            </div>

            <div className="flex flex-row md:flex-col justify-between items-end md:items-end md:w-48 gap-4 border-t md:border-t-0 md:border-l border-gray-100 pt-4 md:pt-0 md:pl-6">
              
              {!editando || editando !== mod.id ? (
                <div className="w-full text-right">
                  <p className="text-2xl font-extrabold text-gray-900">R$ {Number(mod.preco).toFixed(2)}</p>
                  <p className="text-xs text-gray-400 font-medium">Billed monthly</p>
                </div>
              ) : null}

              <div className="w-full text-right mt-auto">
                <span className="inline-block px-3 py-1 bg-gray-50 rounded-full text-xs font-bold text-gray-600 mb-2 border border-gray-200">
                  {mod._count.tenantModulos} empresas ativas
                </span>
                
                {editando === mod.id ? (
                  <div className="flex justify-end gap-2 mt-2 w-full">
                    <button onClick={() => setEditando(null)} className="p-2 border rounded-lg text-gray-500 hover:bg-gray-50"><X size={16}/></button>
                    <button onClick={() => salvarEdicao(mod.id)} className="p-2 border border-green-200 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg"><Save size={16}/></button>
                  </div>
                ) : (
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => iniciarEdicao(mod)} className="flex-1 flex justify-center items-center gap-2 py-2 border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
                      <Edit2 size={14}/> Editar
                    </button>
                    <button onClick={() => toggleStatusModulo(mod)} className={`flex-1 flex justify-center items-center gap-2 py-2 border rounded-lg text-sm font-semibold transition-colors ${mod.ativo ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-green-200 text-green-600 hover:bg-green-50'}`} title={mod.ativo ? 'Desativar Módulo' : 'Ativar Módulo'}>
                      <Power size={14}/> {mod.ativo ? 'Off' : 'On'}
                    </button>
                  </div>
                )}
              </div>
            </div>

          </div>
        ))}
      </div>
    </div>
  );
};
