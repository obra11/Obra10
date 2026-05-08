import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { 
  Building, Users, Key, AlertTriangle, ArrowLeft, Loader2, Ban, PlayCircle, ShieldIcon, 
  Receipt, ClipboardList, Package, DollarSign, Save, Bell, CheckCircle2
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const AdminEmpresaDetalhe: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'visao_geral' | 'dados_cadastrais' | 'faturamento' | 'auditoria'>('visao_geral');
  
  const [empresa, setEmpresa] = useState<any>(null);
  const [cobrancas, setCobrancas] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [loadingForm, setLoadingForm] = useState(false);
  
  // States for Modulos and Cupons
  const [cuponsDisponiveis, setCuponsDisponiveis] = useState<any[]>([]);
  const [cupomSelecionado, setCupomSelecionado] = useState('');
  const [loadingCupom, setLoadingCupom] = useState(false);
  const [loadingModulo, setLoadingModulo] = useState<string | null>(null);
  
  // States for Dados Cadastrais Form
  const [formData, setFormData] = useState({
    razaoSocial: '',
    nomeFantasia: '',
    cnpj: '',
    cpfCnpj: '',
    tipoPessoa: 'JURIDICA',
    email: '',
    telefone: '',
    cep: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    estado: '',
    plano: 'BASICO',
    limiteUsuarios: 5
  });

  const fetchEmpresa = async () => {
    try {
      const res = await api.get(`/admin/empresas/${id}`);
      const data = res.data;
      setEmpresa(data);
      setFormData({
        razaoSocial: data.razaoSocial || '',
        nomeFantasia: data.nomeFantasia || '',
        cnpj: data.cnpj || '',
        cpfCnpj: data.cpfCnpj || '',
        tipoPessoa: data.tipoPessoa || 'JURIDICA',
        email: data.email || '',
        telefone: data.telefone || '',
        cep: data.cep || '',
        logradouro: data.logradouro || '',
        numero: data.numero || '',
        complemento: data.complemento || '',
        bairro: data.bairro || '',
        cidade: data.cidade || '',
        estado: data.estado || '',
        plano: data.plano || 'BASICO',
        limiteUsuarios: data.limiteUsuarios || 5
      });
    } catch (err) {
      alert('Empresa não encontrada');
      navigate('/admin/empresas');
    } finally {
      setLoading(false);
    }
  };

  const fetchCobrancas = async () => {
    try {
      const res = await api.get(`/admin/empresas/${id}/cobrancas`);
      setCobrancas(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const res = await api.get(`/admin/empresas/${id}/audit`);
      setAuditLogs(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchCupons = async () => {
    try {
      const res = await api.get('/admin/cupons');
      setCuponsDisponiveis(res.data.filter((c: any) => c.ativo));
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchEmpresa();
  }, [id]);

  useEffect(() => {
    if (activeTab === 'faturamento') fetchCobrancas();
    if (activeTab === 'auditoria') fetchAuditLogs();
    if (activeTab === 'visao_geral') fetchCupons();
  }, [activeTab]);

  const handleToggleBloqueio = async () => {
    if (!window.confirm(`Deseja ${empresa.ativo ? 'bloquear' : 'desbloquear'} a empresa?`)) return;
    await api.patch(`/admin/empresas/${id}/bloquear`);
    fetchEmpresa();
  };

  const handleResetSenha = async (userId: string) => {
    if (!window.confirm('Resetar a senha deste usuário?')) return;
    try {
      const res = await api.patch(`/admin/usuarios/${userId}/reset-senha`);
      window.prompt(res.data.message, res.data.novaSenhaTemporaria);
    } catch (e) {
      alert('Erro ao resetar senha');
    }
  };

  const handleUpdateDados = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingForm(true);
    try {
      await api.patch(`/admin/empresas/${id}`, formData);
      alert('Dados atualizados com sucesso!');
      fetchEmpresa();
    } catch (e: any) {
      const msg = e.response?.data?.message || 'Erro ao atualizar dados da empresa.';
      alert(Array.isArray(msg) ? msg.join('\n') : msg);
    } finally {
      setLoadingForm(false);
    }
  };

  const handleToggleModulo = async (moduloSlug: string, ativoAtual: boolean) => {
    setLoadingModulo(moduloSlug);
    try {
      if (ativoAtual) {
        if (!window.confirm('Tem certeza que deseja desativar este módulo para esta empresa?')) return;
        await api.delete(`/admin/empresas/${id}/modulos/${moduloSlug}`);
      } else {
        await api.post(`/admin/empresas/${id}/modulos`, { modulos: [moduloSlug] });
      }
      await fetchEmpresa();
    } catch (e: any) {
      alert(e.response?.data?.message || 'Erro ao alterar módulo');
    } finally {
      setLoadingModulo(null);
    }
  };

  const handleVincularCupom = async () => {
    if (!cupomSelecionado) return;
    setLoadingCupom(true);
    try {
      await api.post('/admin/cupons/enviar', { empresaId: id, cupomId: cupomSelecionado });
      setCupomSelecionado('');
      await fetchEmpresa();
      alert('Cupom vinculado com sucesso!');
    } catch (e: any) {
      alert(e.response?.data?.message || 'Erro ao vincular cupom');
    } finally {
      setLoadingCupom(false);
    }
  };

  if (loading || !empresa) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-red-600" size={40} /></div>;

  return (
    <div className="max-w-7xl mx-auto pb-10">
      <button onClick={() => navigate('/admin/empresas')} className="flex items-center text-gray-500 hover:text-gray-900 mb-6 font-medium text-sm transition-colors">
        <ArrowLeft size={16} className="mr-1" /> Voltar para Empresas
      </button>

      <div className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col md:flex-row gap-6 justify-between items-start mb-6 shadow-sm">
        <div className="flex gap-4 items-center">
          <div className="w-16 h-16 bg-gray-100 rounded-xl border flex items-center justify-center text-gray-400">
            <Building size={32} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              {empresa.razaoSocial || empresa.nomeCompleto || 'Construtora'}
              <span className={`text-xs px-2 py-0.5 rounded-full ${empresa.ativo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {empresa.ativo ? 'Ativa' : 'Bloqueada'}
              </span>
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              Documento Principal: {empresa.cpfCnpj || empresa.cnpj || 'Não informado'} • Cadastro: {format(new Date(empresa.createdAt), 'dd/MM/yyyy')}
            </p>
            <div className="flex gap-2 items-center mt-2">
              <div className="text-sm font-semibold uppercase tracking-wider text-red-600 border border-red-200 bg-red-50 rounded px-2 w-max">Plano {empresa.plano}</div>
               {empresa.cupons?.find((c: any) => c.ativo)?.cupom && (
                <div className="text-[11px] font-bold uppercase tracking-wider text-green-700 bg-green-100 border border-green-200 rounded px-2">
                  Cupom: {empresa.cupons.find((c: any) => c.ativo).cupom.codigo} ({empresa.cupons.find((c: any) => c.ativo).cupom.tipo.replace('_', ' ')})
                </div>
               )}
            </div>
          </div>
        </div>
        
        <div className="flex gap-3">
          <button onClick={handleToggleBloqueio} className={`flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-semibold transition-colors ${empresa.ativo ? 'border-red-200 text-red-600 bg-red-50 hover:bg-red-100' : 'bg-gray-900 text-white hover:bg-gray-800'}`}>
            {empresa.ativo ? <><Ban size={16}/> Bloquear Acesso</> : <><PlayCircle size={16}/> Desbloquear</>}
          </button>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex bg-white rounded-xl shadow-sm border border-gray-200 mb-6 overflow-hidden">
        {[
          { id: 'visao_geral', label: 'Visão Geral e Módulos', icon: Package },
          { id: 'dados_cadastrais', label: 'Dados Cadastrais', icon: Building },
          { id: 'faturamento', label: 'Faturamento', icon: Receipt },
          { id: 'auditoria', label: 'Auditoria', icon: ClipboardList }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-colors border-b-2 ${
              activeTab === tab.id ? 'border-red-600 text-red-600 bg-red-50/50' : 'border-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <tab.icon size={18} />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* TABS CONTENT */}

      {/* TAB 1: VISÃO GERAL */}
      {activeTab === 'visao_geral' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="bg-gray-50 px-5 py-4 border-b border-gray-200">
                <h3 className="font-bold text-gray-900 flex items-center gap-2"><Key strokeWidth={2.5} size={18} className="text-gray-400"/> Módulos Contratados</h3>
              </div>
              <div className="p-5 space-y-3">
                {empresa.tenantModulos.length === 0 ? <p className="text-gray-500 text-sm">Nenhum módulo ativo.</p> : null}
                {empresa.tenantModulos.map((tm: any) => (
                  <div key={tm.id} className="flex justify-between items-center p-3 border rounded-lg">
                    <div>
                      <h4 className="font-semibold text-gray-900">{tm.modulo.nome}</h4>
                      <p className="text-xs text-gray-400">Ativado em {format(new Date(tm.dataContratacao), 'dd/MM/yyyy')}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-bold ${tm.ativo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {tm.ativo ? 'ATIVO' : 'DESATIVADO'}
                      </span>
                      <button 
                        onClick={() => handleToggleModulo(tm.modulo.slug, tm.ativo)}
                        disabled={loadingModulo === tm.modulo.slug}
                        className={`text-xs font-semibold px-2 py-1 rounded border transition-colors ${tm.ativo ? 'text-red-600 border-red-200 hover:bg-red-50' : 'text-green-600 border-green-200 hover:bg-green-50'}`}
                      >
                        {loadingModulo === tm.modulo.slug ? <Loader2 size={12} className="animate-spin inline" /> : (tm.ativo ? 'Desativar' : 'Ativar')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="bg-gray-50 px-5 py-4 border-b border-gray-200">
                <h3 className="font-bold text-gray-900 flex items-center gap-2"><AlertTriangle strokeWidth={2.5} size={18} className="text-gray-400"/> Cupons & Vínculos</h3>
              </div>
              <div className="p-5">
                {empresa.cupons.length === 0 ? <p className="text-gray-500 text-sm mb-3">Nenhum cupom resgatado.</p> : null}
                {empresa.cupons.map((c: any) => (
                  <div key={c.id} className="p-3 border border-red-100 bg-red-50 rounded-lg mb-2">
                    <div className="flex justify-between">
                      <span className="font-bold text-red-700">{c.cupom.codigo}</span>
                      <span className="text-xs font-semibold text-red-600 bg-red-100 px-2 py-0.5 rounded">{c.cupom.tipo}</span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">Meses usados: {c.mesesUsados || 0}</p>
                  </div>
                ))}

                <div className="mt-4 pt-4 border-t border-gray-100">
                  <label className="block text-xs font-semibold text-gray-600 mb-2">Vincular Novo Cupom Manualmente</label>
                  <div className="flex gap-2">
                    <select 
                      value={cupomSelecionado}
                      onChange={(e) => setCupomSelecionado(e.target.value)}
                      className="flex-1 px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-red-600 outline-none bg-white"
                    >
                      <option value="">Selecione um cupom...</option>
                      {cuponsDisponiveis.map(c => (
                        <option key={c.id} value={c.id}>{c.codigo} ({c.tipo})</option>
                      ))}
                    </select>
                    <button 
                      onClick={handleVincularCupom}
                      disabled={!cupomSelecionado || loadingCupom}
                      className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-red-700 disabled:opacity-50 flex items-center"
                    >
                      {loadingCupom ? <Loader2 size={16} className="animate-spin" /> : 'Vincular'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="bg-gray-50 px-5 py-4 border-b border-gray-200">
                <h3 className="font-bold text-gray-900 flex items-center gap-2"><Users strokeWidth={2.5} size={18} className="text-gray-400"/> Usuários da Conta</h3>
              </div>
              <ul className="divide-y divide-gray-100">
                {empresa.usuarios.map((u: any) => (
                  <li key={u.id} className="p-4 flex justify-between items-center hover:bg-gray-50">
                    <div>
                      <p className="font-semibold text-sm text-gray-900">{u.nome}</p>
                      <p className="text-xs text-gray-500">{u.email}</p>
                      {u.perfilGlobal === 'SUPER_ADMIN' && <span className="inline-flex mt-1 items-center gap-1 text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold"><ShieldIcon size={10}/> SUPER ADMIN</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      {!u.ativo && <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full font-bold">Bloqueado</span>}
                      <button onClick={() => handleResetSenha(u.id)} title="Resetar Senha" className="p-1.5 text-gray-400 hover:text-blue-600 border border-gray-200 hover:border-blue-200 hover:bg-blue-50 rounded transition-colors"><Key size={14}/></button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DADOS CADASTRAIS */}
      {activeTab === 'dados_cadastrais' && (
        <form onSubmit={handleUpdateDados} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 max-w-4xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            <div className="md:col-span-2">
              <h3 className="text-lg font-bold text-gray-900 border-b pb-2 mb-4">Informações Principais</h3>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Razão Social</label>
              <input type="text" value={formData.razaoSocial} onChange={(e) => setFormData({...formData, razaoSocial: e.target.value})} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-600 outline-none" />
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Nome Fantasia</label>
              <input type="text" value={formData.nomeFantasia} onChange={(e) => setFormData({...formData, nomeFantasia: e.target.value})} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-600 outline-none" />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Tipo de Entidade</label>
              <select value={formData.tipoPessoa} onChange={(e) => setFormData({...formData, tipoPessoa: e.target.value})} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-600 outline-none bg-white">
                <option value="JURIDICA">Pessoa Jurídica (CNPJ)</option>
                <option value="FISICA">Pessoa Física (CPF)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                {formData.tipoPessoa === 'FISICA' ? 'CPF' : 'CNPJ'} (Documento Principal)
              </label>
              <input type="text" value={formData.cpfCnpj} onChange={(e) => setFormData({...formData, cpfCnpj: e.target.value})} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-600 outline-none" />
            </div>

            <div className={formData.tipoPessoa === 'FISICA' ? 'opacity-50 pointer-events-none' : ''}>
              <label className="block text-sm font-semibold text-gray-700 mb-1">CNPJ Secundário (Se aplicável)</label>
              <input type="text" value={formData.cnpj} onChange={(e) => setFormData({...formData, cnpj: e.target.value})} disabled={formData.tipoPessoa === 'FISICA'} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-600 outline-none" />
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">E-mail Principal</label>
              <input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-600 outline-none" />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Telefone</label>
              <input type="text" value={formData.telefone} onChange={(e) => setFormData({...formData, telefone: e.target.value})} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-600 outline-none" />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Plano Atual</label>
              <select value={formData.plano} onChange={(e) => setFormData({...formData, plano: e.target.value})} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-600 outline-none font-bold text-red-700">
                <option value="BASICO">BASICO</option>
                <option value="PRO">PRO</option>
                <option value="ENTERPRISE">ENTERPRISE</option>
              </select>
            </div>

            <div className="md:col-span-2 mt-4">
              <h3 className="text-lg font-bold text-gray-900 border-b pb-2 mb-4">Endereço</h3>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">CEP</label>
              <input type="text" value={formData.cep} onChange={(e) => setFormData({...formData, cep: e.target.value})} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-600 outline-none" />
            </div>
            
            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-1">Logradouro</label>
                <input type="text" value={formData.logradouro} onChange={(e) => setFormData({...formData, logradouro: e.target.value})} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-600 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Número</label>
                <input type="text" value={formData.numero} onChange={(e) => setFormData({...formData, numero: e.target.value})} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-600 outline-none" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Complemento</label>
              <input type="text" value={formData.complemento} onChange={(e) => setFormData({...formData, complemento: e.target.value})} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-600 outline-none" />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Bairro</label>
              <input type="text" value={formData.bairro} onChange={(e) => setFormData({...formData, bairro: e.target.value})} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-600 outline-none" />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Cidade</label>
              <input type="text" value={formData.cidade} onChange={(e) => setFormData({...formData, cidade: e.target.value})} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-600 outline-none" />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Estado (UF)</label>
              <input type="text" maxLength={2} value={formData.estado} onChange={(e) => setFormData({...formData, estado: e.target.value.toUpperCase()})} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-600 outline-none" />
            </div>
            
          </div>

          <div className="mt-8 flex justify-end">
            <button type="submit" disabled={loadingForm} className="bg-red-600 text-white font-bold px-8 py-3 rounded-lg shadow hover:bg-red-700 flex items-center gap-2">
              {loadingForm ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
              Salvar Alterações
            </button>
          </div>
        </form>
      )}

      {/* TAB 3: FATURAMENTO */}
      {activeTab === 'faturamento' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="bg-gray-50 px-5 py-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="font-bold text-gray-900 flex items-center gap-2"><DollarSign strokeWidth={2.5} size={18} className="text-gray-400"/> Faturas & Assinatura (Asaas)</h3>
            {cobrancas.some((c: any) => ['PENDENTE', 'VENCIDO', 'OVERDUE'].includes(c.status)) && (
              <button
                onClick={async () => {
                  if (!window.confirm('Enviar aviso de pagamento pendente para o gestor desta empresa?')) return;
                  try {
                    const res = await api.post(`/admin/empresas/${id}/avisar-gestor`);
                    alert(res.data.message);
                    fetchCobrancas();
                  } catch (err: any) {
                    alert(err?.response?.data?.message || 'Erro ao avisar gestor.');
                  }
                }}
                className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-lg font-semibold text-sm hover:bg-yellow-600 transition-colors shadow-sm"
              >
                <Bell size={16} /> Avisar Gestor
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-white">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Mês de Ref.</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Vencimento</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Valor</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Pagamento</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Link</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Aviso</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {cobrancas.length === 0 && (
                  <tr><td colSpan={7} className="px-6 py-8 text-center text-gray-500 text-sm">Não há histórico de cobranças para esta conta.</td></tr>
                )}
                {cobrancas.map((cob) => (
                  <tr key={cob.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {format(new Date(cob.mesReferencia), "MMMM / yyyy", { locale: ptBR })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {format(new Date(cob.dataVencimento), "dd/MM/yyyy")}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                      R$ {Number(cob.valor).toFixed(2).replace('.', ',')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {cob.dataPagamento ? format(new Date(cob.dataPagamento), "dd/MM/yyyy") : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-bold rounded-full ${
                        cob.status === 'RECEIVED' || cob.status === 'PAGO' ? 'bg-green-100 text-green-800' :
                        cob.status === 'OVERDUE' || cob.status === 'VENCIDA' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {cob.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 font-semibold hover:underline cursor-pointer">
                      {cob.linkPagamento ? <a href={cob.linkPagamento} target="_blank" rel="noreferrer">Fatura ↗</a> : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {cob.notificadoEm ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 px-2 py-1 rounded-full">
                          <CheckCircle2 size={12} /> Avisado
                        </span>
                      ) : ['PENDENTE', 'VENCIDO', 'OVERDUE'].includes(cob.status) ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-400">
                          Pendente
                        </span>
                      ) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: AUDITORIA */}
      {activeTab === 'auditoria' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="bg-gray-50 px-5 py-4 border-b border-gray-200">
            <h3 className="font-bold text-gray-900 flex items-center gap-2"><ClipboardList strokeWidth={2.5} size={18} className="text-gray-400"/> Histórico de Movimentações (Logs)</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-white">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Ação</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Tabela</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Registro Alvo</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Realizado Por</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Data/Hora</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {auditLogs.length === 0 && (
                  <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500 text-sm">Ainda não há histórico de auditoria registrado.</td></tr>
                )}
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 whitespace-nowrap text-sm font-semibold text-gray-900 border-l-4" style={{borderLeftColor: log.acao.includes('DELETE') ? '#ef4444' : log.acao.includes('CREATE') ? '#22c55e' : '#3b82f6'}}>
                      {log.acao}
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap text-sm font-mono text-gray-600 bg-gray-50/50">
                      {log.tabelaAfetada}
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap text-xs text-gray-500" title={log.registroId}>
                      {log.registroId.substring(0, 8)}...
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{log.usuario?.nome || 'Sistema'}</div>
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-500">
                      {format(new Date(log.createdAt), "dd/MM/yyyy HH:mm")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};
