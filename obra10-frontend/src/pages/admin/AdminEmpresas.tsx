import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { Search, Loader2, Building, AlertTriangle, Plus, X, User, Mail, Lock, Phone, FileText, Bell, BellRing } from 'lucide-react';

interface EmpresaGridItem {
  id: string;
  razaoSocial: string | null;
  nomeFantasia: string | null;
  cnpj: string | null;
  plano: string;
  ativo: boolean;
  createdAt: string;
  totalObras: number;
  totalUsuarios: number;
  totalModulos: number;
  statusPagamento: string;
}

const INITIAL_FORM = {
  razaoSocial: '',
  nomeFantasia: '',
  documento: '',
  tipoPessoa: 'JURIDICA' as 'JURIDICA' | 'FISICA',
  plano: 'BASICO' as string,
  telefone: '',
  email: '',
  gestorNome: '',
  gestorEmail: '',
  gestorSenha: '',
  gestorTelefone: '',
};

export const AdminEmpresas: React.FC = () => {
  const [empresas, setEmpresas] = useState<EmpresaGridItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [avisandoId, setAvisandoId] = useState<string | null>(null);
  const [avisandoTodos, setAvisandoTodos] = useState(false);
  const navigate = useNavigate();

  const fetchEmpresas = async () => {
    try {
      const res = await api.get('/admin/empresas');
      setEmpresas(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmpresas();
  }, []);

  const handleToggleBloqueio = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Tem certeza que deseja alterar o status de bloqueio desta empresa? Os usuários dela perderão/ganharão acesso imediato.')) return;
    
    try {
      await api.patch(`/admin/empresas/${id}/bloquear`);
      fetchEmpresas();
    } catch (err) {
      alert('Erro ao bloquear/desbloquear empresa.');
    }
  };

  const handleCriarEmpresa = async () => {
    setError('');
    if (!form.razaoSocial.trim()) { setError('Razão Social é obrigatória.'); return; }
    if (!form.documento.trim()) { setError('Documento (CPF/CNPJ) é obrigatório.'); return; }
    if (!form.gestorNome.trim()) { setError('Nome do Gestor é obrigatório.'); return; }
    if (!form.gestorEmail.trim()) { setError('Email do Gestor é obrigatório.'); return; }
    if (!form.gestorSenha.trim() || form.gestorSenha.length < 6) { setError('Senha do Gestor deve ter no mínimo 6 caracteres.'); return; }
    
    setSaving(true);
    try {
      await api.post('/admin/empresas', form);
      setShowModal(false);
      setForm(INITIAL_FORM);
      fetchEmpresas();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Erro ao criar empresa.');
    } finally {
      setSaving(false);
    }
  };

  const filtered = empresas.filter(emp => {
    const term = search.toLowerCase();
    return (
      emp.razaoSocial?.toLowerCase().includes(term) ||
      emp.nomeFantasia?.toLowerCase().includes(term) ||
      emp.cnpj?.replace(/\D/g, '').includes(term.replace(/\D/g, ''))
    );
  });

  const handleAvisarGestor = async (empresaId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setAvisandoId(empresaId);
    try {
      const res = await api.post(`/admin/empresas/${empresaId}/avisar-gestor`);
      alert(res.data.message);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Erro ao avisar gestor.');
    } finally {
      setAvisandoId(null);
    }
  };

  const handleAvisarTodos = async () => {
    if (!window.confirm('Enviar aviso de pagamento pendente para TODOS os gestores com cobranças pendentes?')) return;
    setAvisandoTodos(true);
    try {
      const res = await api.post('/admin/empresas/avisar-todos');
      alert(res.data.message);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Erro ao avisar.');
    } finally {
      setAvisandoTodos(false);
    }
  };

  const temPendentes = empresas.some(e => ['PENDENTE', 'VENCIDO', 'OVERDUE'].includes(e.statusPagamento));

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Locatários</h1>
          <p className="text-sm text-gray-500 mt-1">Gerencie as construtoras cadastradas na plataforma.</p>
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-72">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={18} className="text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-red-500 focus:border-red-500 sm:text-sm transition-colors"
              placeholder="Buscar por nome, CPF ou CNPJ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg font-semibold text-sm hover:bg-red-700 transition-colors shadow-sm whitespace-nowrap"
          >
            <Plus size={18} /> Nova Empresa
          </button>
          {temPendentes && (
            <button
              onClick={handleAvisarTodos}
              disabled={avisandoTodos}
              className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-lg font-semibold text-sm hover:bg-yellow-600 transition-colors shadow-sm whitespace-nowrap disabled:opacity-50"
            >
              {avisandoTodos ? <Loader2 size={16} className="animate-spin" /> : <BellRing size={16} />}
              Avisar Todos
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-red-600" size={40} /></div>
      ) : (
        <div className="bg-white shadow-sm rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Construtora</th>
                  <th scope="col" className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th scope="col" className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Módulos</th>
                  <th scope="col" className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Obras</th>
                  <th scope="col" className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Pgto. Recente</th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filtered.map((emp) => (
                  <tr 
                    key={emp.id} 
                    onClick={() => navigate(`/admin/empresas/${emp.id}`)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center bg-gray-100 rounded-lg text-gray-500 border border-gray-200">
                          <Building size={20} />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{emp.nomeFantasia || emp.razaoSocial}</div>
                          <div className="text-xs text-gray-500">{emp.cnpj || 'Documento não informado'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`px-2 py-1 inline-flex text-xs leading-4 font-semibold rounded-full ${emp.ativo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {emp.ativo ? 'Ativa' : 'Bloqueada'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                      <span className="font-medium text-gray-900">{emp.totalModulos}</span> mods
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                      <span className="font-medium text-gray-900">{emp.totalObras}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                      <span className={`font-semibold ${emp.statusPagamento === 'PAGO' ? 'text-green-600' : emp.statusPagamento === 'PENDENTE' ? 'text-yellow-600' : 'text-gray-500'}`}>
                        {emp.statusPagamento}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        {['PENDENTE', 'VENCIDO', 'OVERDUE'].includes(emp.statusPagamento) && (
                          <button
                            onClick={(e) => handleAvisarGestor(emp.id, e)}
                            disabled={avisandoId === emp.id}
                            className="px-3 py-1.5 rounded-lg font-medium transition-colors border bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100 disabled:opacity-50 flex items-center gap-1"
                          >
                            {avisandoId === emp.id ? <Loader2 size={14} className="animate-spin" /> : <Bell size={14} />}
                            Avisar
                          </button>
                        )}
                        <button
                          onClick={(e) => handleToggleBloqueio(emp.id, e)}
                          className={`px-3 py-1.5 rounded-lg font-medium transition-colors border ${emp.ativo ? 'bg-white text-red-600 border-red-200 hover:bg-red-50' : 'bg-gray-900 text-white border-transparent hover:bg-gray-800'}`}
                        >
                          {emp.ativo ? 'Bloquear' : 'Desbloquear'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {filtered.length === 0 && (
              <div className="p-8 text-center text-gray-500 flex flex-col items-center">
                <AlertTriangle size={32} className="text-gray-400 mb-2" />
                <p>Nenhuma empresa encontrada correspondente aos filtros.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Cadastrar Empresa + Gestor */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white rounded-t-2xl z-10">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Cadastrar Nova Empresa</h2>
                <p className="text-xs text-gray-500 mt-0.5">Criar empresa e seu gestor responsável</p>
              </div>
              <button onClick={() => { setShowModal(false); setError(''); setForm(INITIAL_FORM); }} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={22} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm font-medium">
                  {error}
                </div>
              )}

              {/* Seção: Dados da Empresa */}
              <div>
                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Building size={16} className="text-red-600" /> Dados da Empresa
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Razão Social *</label>
                    <input
                      type="text"
                      value={form.razaoSocial}
                      onChange={(e) => setForm({ ...form, razaoSocial: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-red-500 focus:border-red-500 outline-none"
                      placeholder="Ex: Lunardeli Engenharia Ltda"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Nome Fantasia</label>
                    <input
                      type="text"
                      value={form.nomeFantasia}
                      onChange={(e) => setForm({ ...form, nomeFantasia: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-red-500 focus:border-red-500 outline-none"
                      placeholder="Ex: Lunardeli Engenharia"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Tipo de Pessoa</label>
                    <select
                      value={form.tipoPessoa}
                      onChange={(e) => setForm({ ...form, tipoPessoa: e.target.value as 'JURIDICA' | 'FISICA' })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-red-500 focus:border-red-500 outline-none bg-white"
                    >
                      <option value="JURIDICA">Pessoa Jurídica (CNPJ)</option>
                      <option value="FISICA">Pessoa Física (CPF)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1 flex items-center gap-1">
                      <FileText size={12} /> {form.tipoPessoa === 'FISICA' ? 'CPF' : 'CNPJ'} *
                    </label>
                    <input
                      type="text"
                      value={form.documento}
                      onChange={(e) => setForm({ ...form, documento: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-red-500 focus:border-red-500 outline-none"
                      placeholder={form.tipoPessoa === 'FISICA' ? '000.000.000-00' : '00.000.000/0001-00'}
                      maxLength={18}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Plano</label>
                    <select
                      value={form.plano}
                      onChange={(e) => setForm({ ...form, plano: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-red-500 focus:border-red-500 outline-none bg-white"
                    >
                      <option value="BASICO">Básico</option>
                      <option value="PRO">Pro</option>
                      <option value="ENTERPRISE">Enterprise</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Telefone da Empresa</label>
                    <input
                      type="text"
                      value={form.telefone}
                      onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-red-500 focus:border-red-500 outline-none"
                      placeholder="(00) 00000-0000"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Email da Empresa</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-red-500 focus:border-red-500 outline-none"
                      placeholder="empresa@dominio.com"
                    />
                  </div>
                </div>
              </div>

              {/* Divisor */}
              <div className="border-t border-gray-200" />

              {/* Seção: Dados do Gestor */}
              <div>
                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <User size={16} className="text-blue-600" /> Gestor Responsável
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-gray-600 mb-1 flex items-center gap-1">
                      <User size={12} /> Nome Completo *
                    </label>
                    <input
                      type="text"
                      value={form.gestorNome}
                      onChange={(e) => setForm({ ...form, gestorNome: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-red-500 focus:border-red-500 outline-none"
                      placeholder="Nome do gestor"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1 flex items-center gap-1">
                      <Mail size={12} /> Email de Acesso *
                    </label>
                    <input
                      type="email"
                      value={form.gestorEmail}
                      onChange={(e) => setForm({ ...form, gestorEmail: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-red-500 focus:border-red-500 outline-none"
                      placeholder="gestor@email.com"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1 flex items-center gap-1">
                      <Lock size={12} /> Senha Inicial *
                    </label>
                    <input
                      type="text"
                      value={form.gestorSenha}
                      onChange={(e) => setForm({ ...form, gestorSenha: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-red-500 focus:border-red-500 outline-none"
                      placeholder="Mínimo 6 caracteres"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-gray-600 mb-1 flex items-center gap-1">
                      <Phone size={12} /> Telefone do Gestor
                    </label>
                    <input
                      type="text"
                      value={form.gestorTelefone}
                      onChange={(e) => setForm({ ...form, gestorTelefone: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-red-500 focus:border-red-500 outline-none"
                      placeholder="(00) 00000-0000"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl sticky bottom-0">
              <p className="text-[11px] text-gray-400">Todos os módulos serão ativados automaticamente.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowModal(false); setError(''); setForm(INITIAL_FORM); }}
                  className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCriarEmpresa}
                  disabled={saving}
                  className="px-6 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                  {saving ? 'Criando...' : 'Criar Empresa'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
