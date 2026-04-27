import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import {
  ToggleLeft, ToggleRight, Plus, X, Loader2, Building, Zap, FlaskConical, Package,
  ChevronDown, ChevronUp, Trash2
} from 'lucide-react';

interface FeatureFlag {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  tipo: string;
  versao: string;
  createdAt: string;
  _count: { empresas: number };
  empresas: { id: string; ativo: boolean; empresa: { id: string; razaoSocial: string; nomeFantasia: string | null } }[];
}

const TIPO_ICON: Record<string, any> = {
  MODULO: Package,
  FUNCIONALIDADE: Zap,
  EXPERIMENTAL: FlaskConical,
};

const TIPO_COLOR: Record<string, string> = {
  MODULO: 'bg-blue-100 text-blue-700',
  FUNCIONALIDADE: 'bg-purple-100 text-purple-700',
  EXPERIMENTAL: 'bg-yellow-100 text-yellow-700',
};

const INITIAL_FORM = {
  codigo: '',
  nome: '',
  descricao: '',
  tipo: 'MODULO',
  versao: '1.0',
};

export const AdminFeatures: React.FC = () => {
  const [features, setFeatures] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toggling, setToggling] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Para atribuir empresas
  const [showEmpresaModal, setShowEmpresaModal] = useState<string | null>(null);
  const [allEmpresas, setAllEmpresas] = useState<any[]>([]);
  const [selectedEmpresas, setSelectedEmpresas] = useState<string[]>([]);
  const [savingEmpresas, setSavingEmpresas] = useState(false);

  const fetchFeatures = async () => {
    try {
      const res = await api.get('/admin/features');
      setFeatures(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchFeatures(); }, []);

  const handleCriar = async () => {
    setError('');
    if (!form.codigo.trim()) { setError('Código é obrigatório.'); return; }
    if (!form.nome.trim()) { setError('Nome é obrigatório.'); return; }
    setSaving(true);
    try {
      await api.post('/admin/features', form);
      setShowModal(false);
      setForm(INITIAL_FORM);
      fetchFeatures();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Erro ao criar feature.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id: string) => {
    setToggling(id);
    try {
      await api.patch(`/admin/features/${id}/toggle`);
      fetchFeatures();
    } catch (err) {
      alert('Erro ao alternar feature.');
    } finally {
      setToggling(null);
    }
  };

  const handleOpenEmpresaModal = async (featureId: string) => {
    setShowEmpresaModal(featureId);
    try {
      const res = await api.get('/admin/empresas');
      setAllEmpresas(res.data);
      // Pre-select already assigned
      const feature = features.find(f => f.id === featureId);
      const assigned = feature?.empresas.filter(e => e.ativo).map(e => e.empresa.id) || [];
      setSelectedEmpresas(assigned);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSalvarEmpresas = async () => {
    if (!showEmpresaModal) return;
    setSavingEmpresas(true);
    try {
      await api.post(`/admin/features/${showEmpresaModal}/empresas`, {
        empresaIds: selectedEmpresas
      });
      setShowEmpresaModal(null);
      fetchFeatures();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Erro ao atribuir empresas.');
    } finally {
      setSavingEmpresas(false);
    }
  };

  const handleRemoverEmpresa = async (featureId: string, empresaId: string) => {
    try {
      await api.delete(`/admin/features/${featureId}/empresas/${empresaId}`);
      fetchFeatures();
    } catch (err) {
      alert('Erro ao remover acesso.');
    }
  };

  const toggleEmpresaSelection = (id: string) => {
    setSelectedEmpresas(prev =>
      prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
    );
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Feature Flags</h1>
          <p className="text-sm text-gray-500 mt-1">Controle de funcionalidades com rollout gradual.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg font-semibold text-sm hover:bg-red-700 transition-colors shadow-sm"
        >
          <Plus size={18} /> Nova Feature
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-red-600" size={40} /></div>
      ) : features.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center text-gray-500">
          <FlaskConical size={48} className="mx-auto mb-4 opacity-20" />
          <p className="font-medium">Nenhuma feature flag criada.</p>
          <p className="text-sm mt-1">Crie sua primeira feature flag para controlar funcionalidades.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {features.map((feat) => {
            const isExpanded = expanded === feat.id;
            const TipoIcon = TIPO_ICON[feat.tipo] || Package;
            const empresasAtivas = feat.empresas.filter(e => e.ativo);

            return (
              <div key={feat.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between p-5">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <button
                      onClick={() => handleToggle(feat.id)}
                      disabled={toggling === feat.id}
                      className="flex-shrink-0"
                    >
                      {toggling === feat.id ? (
                        <Loader2 size={28} className="animate-spin text-gray-400" />
                      ) : feat.ativo ? (
                        <ToggleRight size={32} className="text-green-500" />
                      ) : (
                        <ToggleLeft size={32} className="text-gray-300" />
                      )}
                    </button>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-gray-900">{feat.codigo}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${TIPO_COLOR[feat.tipo]}`}>
                          <TipoIcon size={10} className="inline -mt-0.5 mr-0.5" />
                          {feat.tipo}
                        </span>
                        <span className="text-[10px] text-gray-400 font-mono">v{feat.versao}</span>
                      </div>
                      <p className="text-sm text-gray-600 mt-0.5 truncate">{feat.nome}</p>
                      {feat.descricao && <p className="text-xs text-gray-400 truncate">{feat.descricao}</p>}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 ml-4">
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${feat.ativo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {feat.ativo ? '🌐 Global ON' : '🔒 OFF'}
                    </span>

                    <button
                      onClick={() => handleOpenEmpresaModal(feat.id)}
                      className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors"
                    >
                      <Building size={14} /> {empresasAtivas.length}
                    </button>

                    <button
                      onClick={() => setExpanded(isExpanded ? null : feat.id)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>
                  </div>
                </div>

                {isExpanded && empresasAtivas.length > 0 && (
                  <div className="border-t border-gray-100 px-5 py-3 bg-gray-50">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Empresas com acesso individual</p>
                    <div className="flex flex-wrap gap-2">
                      {empresasAtivas.map(ef => (
                        <div key={ef.id} className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
                          <Building size={12} className="text-gray-400" />
                          <span className="font-medium text-gray-700">{ef.empresa.nomeFantasia || ef.empresa.razaoSocial}</span>
                          <button
                            onClick={() => handleRemoverEmpresa(feat.id, ef.empresa.id)}
                            className="text-red-400 hover:text-red-600 ml-1"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Nova Feature */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">Nova Feature Flag</h2>
              <button onClick={() => { setShowModal(false); setError(''); setForm(INITIAL_FORM); }} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm font-medium">{error}</div>}

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Código *</label>
                <input
                  type="text"
                  value={form.codigo}
                  onChange={(e) => setForm({ ...form, codigo: e.target.value.toUpperCase().replace(/\s+/g, '_') })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-red-500 focus:border-red-500 outline-none font-mono"
                  placeholder="FVS_V1, RDO_AUTOSAVE..."
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Nome *</label>
                <input
                  type="text"
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-red-500 focus:border-red-500 outline-none"
                  placeholder="Ficha de Verificação de Serviço"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Descrição</label>
                <textarea
                  value={form.descricao}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-red-500 focus:border-red-500 outline-none resize-none"
                  rows={2}
                  placeholder="Descrição opcional..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Tipo</label>
                  <select
                    value={form.tipo}
                    onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-red-500 focus:border-red-500 outline-none bg-white"
                  >
                    <option value="MODULO">Módulo</option>
                    <option value="FUNCIONALIDADE">Funcionalidade</option>
                    <option value="EXPERIMENTAL">Experimental</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Versão</label>
                  <input
                    type="text"
                    value={form.versao}
                    onChange={(e) => setForm({ ...form, versao: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-red-500 focus:border-red-500 outline-none font-mono"
                    placeholder="1.0"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
              <button onClick={() => { setShowModal(false); setError(''); setForm(INITIAL_FORM); }} className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={handleCriar} disabled={saving} className="px-6 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2">
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                {saving ? 'Criando...' : 'Criar Feature'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Atribuir Empresas */}
      {showEmpresaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">Rollout Gradual</h2>
              <button onClick={() => setShowEmpresaModal(null)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              <p className="text-sm text-gray-500 mb-4">Selecione as empresas que terão acesso a esta feature mesmo com a flag global desligada.</p>
              <div className="space-y-2">
                {allEmpresas.map(emp => (
                  <label key={emp.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={selectedEmpresas.includes(emp.id)}
                      onChange={() => toggleEmpresaSelection(emp.id)}
                      className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-900">{emp.nomeFantasia || emp.razaoSocial}</span>
                      <span className="text-xs text-gray-400 ml-2">{emp.cnpj}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex justify-between items-center px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
              <span className="text-xs text-gray-500">{selectedEmpresas.length} empresa(s) selecionada(s)</span>
              <button onClick={handleSalvarEmpresas} disabled={savingEmpresas} className="px-6 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2">
                {savingEmpresas ? <Loader2 size={16} className="animate-spin" /> : null}
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
