import React, { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import {
  Package,
  Drill,
  Users,
  Plus,
  Search,
  Edit2,
  Trash2,
  CheckCircle,
  AlertCircle,
  Tag,
  X,
  Boxes
} from 'lucide-react';

export type TipoInsumo = 'MATERIAL' | 'EQUIPAMENTO' | 'MAO_DE_OBRA';

export interface CatalogoInsumo {
  id: string;
  empresaId: string;
  tipo: TipoInsumo;
  nome: string;
  unidade?: string | null;
  codigo?: string | null;
  observacao?: string | null;
  ativo: boolean;
  createdAt: string;
}

const UNIDADES_SUGERIDAS = [
  'un', 'kg', 'm', 'm²', 'm³', 'l', 'h', 'cx', 'pct', 'saco', 'rolo', 'barras', 'par', 'ton'
];

export const CatalogoPage: React.FC = () => {
  const [items, setItems] = useState<CatalogoInsumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TipoInsumo>('MATERIAL');
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CatalogoInsumo | null>(null);
  const [saving, setSaving] = useState(false);

  // Form Fields
  const [formData, setFormData] = useState({
    tipo: 'MATERIAL' as TipoInsumo,
    nome: '',
    unidade: 'un',
    codigo: '',
    observacao: '',
  });

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchItems = async () => {
    try {
      setLoading(true);
      const res = await api.get('/catalogo');
      setItems(res.data || []);
    } catch (err: any) {
      console.error('Erro ao carregar Cadastro Base:', err);
      showToast('Erro ao carregar o Cadastro Base', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const openCreateModal = (tipo: TipoInsumo = activeTab) => {
    setEditingItem(null);
    setFormData({
      tipo,
      nome: '',
      unidade: tipo === 'MATERIAL' ? 'un' : tipo === 'EQUIPAMENTO' ? 'un' : 'un',
      codigo: '',
      observacao: '',
    });
    setIsModalOpen(true);
  };

  const openEditModal = (item: CatalogoInsumo) => {
    setEditingItem(item);
    setFormData({
      tipo: item.tipo,
      nome: item.nome || '',
      unidade: item.unidade || 'un',
      codigo: item.codigo || '',
      observacao: item.observacao || '',
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome.trim()) {
      showToast('O nome do item é obrigatório', 'error');
      return;
    }

    try {
      setSaving(true);
      if (editingItem) {
        await api.put(`/catalogo/${editingItem.id}`, formData);
        showToast('Item atualizado com sucesso!');
      } else {
        await api.post('/catalogo', formData);
        showToast('Novo item cadastrado com sucesso!');
      }
      setIsModalOpen(false);
      fetchItems();
    } catch (err: any) {
      console.error('Erro ao salvar item:', err);
      showToast('Erro ao salvar item no catálogo', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, nome: string) => {
    if (!window.confirm(`Deseja realmente remover "${nome}" do Cadastro Base?`)) return;

    try {
      await api.delete(`/catalogo/${id}`);
      showToast('Item removido com sucesso!');
      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch (err: any) {
      console.error('Erro ao excluir item:', err);
      showToast('Erro ao excluir item', 'error');
    }
  };

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (item.tipo !== activeTab) return false;
      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase();
      return (
        item.nome.toLowerCase().includes(q) ||
        (item.codigo && item.codigo.toLowerCase().includes(q)) ||
        (item.unidade && item.unidade.toLowerCase().includes(q)) ||
        (item.observacao && item.observacao.toLowerCase().includes(q))
      );
    });
  }, [items, activeTab, searchQuery]);

  const counts = useMemo(() => {
    return {
      MATERIAL: items.filter((i) => i.tipo === 'MATERIAL').length,
      EQUIPAMENTO: items.filter((i) => i.tipo === 'EQUIPAMENTO').length,
      MAO_DE_OBRA: items.filter((i) => i.tipo === 'MAO_DE_OBRA').length,
    };
  }, [items]);

  return (
    <div className="min-h-screen bg-gray-50/50 p-4 md:p-8 space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-bold text-white transition-all ${
            toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-lunardeli-red font-bold text-sm uppercase tracking-wider mb-1">
            <Boxes size={18} />
            <span>Acervo da Empresa</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">
            Cadastro Base
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Cadastre e gerencie o catálogo padronizado de Materiais, Equipamentos e Mão de Obra da sua empresa.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => openCreateModal(activeTab)}
            className="flex items-center gap-2 bg-lunardeli-red hover:bg-red-700 active:bg-red-800 text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-sm transition-all hover:shadow"
          >
            <Plus size={18} />
            <span>
              Cadastrar{' '}
              {activeTab === 'MATERIAL'
                ? 'Material'
                : activeTab === 'EQUIPAMENTO'
                ? 'Equipamento'
                : 'Função'}
            </span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-gray-200 gap-2 md:gap-4 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab('MATERIAL')}
          className={`flex items-center gap-2 px-4 py-3 rounded-t-xl font-bold text-sm transition-all border-b-2 whitespace-nowrap ${
            activeTab === 'MATERIAL'
              ? 'border-lunardeli-red text-lunardeli-red bg-red-50/50'
              : 'border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-100/60'
          }`}
        >
          <Package size={18} />
          <span>Materiais</span>
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-black ${
              activeTab === 'MATERIAL' ? 'bg-lunardeli-red text-white' : 'bg-gray-200 text-gray-700'
            }`}
          >
            {counts.MATERIAL}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('EQUIPAMENTO')}
          className={`flex items-center gap-2 px-4 py-3 rounded-t-xl font-bold text-sm transition-all border-b-2 whitespace-nowrap ${
            activeTab === 'EQUIPAMENTO'
              ? 'border-lunardeli-red text-lunardeli-red bg-red-50/50'
              : 'border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-100/60'
          }`}
        >
          <Drill size={18} />
          <span>Equipamentos</span>
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-black ${
              activeTab === 'EQUIPAMENTO' ? 'bg-lunardeli-red text-white' : 'bg-gray-200 text-gray-700'
            }`}
          >
            {counts.EQUIPAMENTO}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('MAO_DE_OBRA')}
          className={`flex items-center gap-2 px-4 py-3 rounded-t-xl font-bold text-sm transition-all border-b-2 whitespace-nowrap ${
            activeTab === 'MAO_DE_OBRA'
              ? 'border-lunardeli-red text-lunardeli-red bg-red-50/50'
              : 'border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-100/60'
          }`}
        >
          <Users size={18} />
          <span>Mão de Obra / Funções</span>
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-black ${
              activeTab === 'MAO_DE_OBRA' ? 'bg-lunardeli-red text-white' : 'bg-gray-200 text-gray-700'
            }`}
          >
            {counts.MAO_DE_OBRA}
          </span>
        </button>
      </div>

      {/* Controls & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-lunardeli-red focus:border-lunardeli-red bg-white"
            placeholder={`Buscar por ${
              activeTab === 'MATERIAL'
                ? 'material...'
                : activeTab === 'EQUIPAMENTO'
                ? 'equipamento...'
                : 'função ou profissional...'
            }`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="text-xs text-gray-500 font-medium self-end sm:self-center">
          Exibindo <span className="font-bold text-gray-800">{filteredItems.length}</span> itens
        </div>
      </div>

      {/* Content List */}
      {loading ? (
        <div className="p-12 text-center text-gray-400 font-medium">Carregando catálogo...</div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border-2 border-dashed border-gray-200 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center mx-auto">
            {activeTab === 'MATERIAL' ? (
              <Package size={24} />
            ) : activeTab === 'EQUIPAMENTO' ? (
              <Drill size={24} />
            ) : (
              <Users size={24} />
            )}
          </div>
          <h3 className="font-bold text-gray-700 text-base">Nenhum item encontrado</h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">
            {searchQuery
              ? 'Tente ajustar sua busca por palavra-chave.'
              : `Ainda não há ${
                  activeTab === 'MATERIAL'
                    ? 'materiais'
                    : activeTab === 'EQUIPAMENTO'
                    ? 'equipamentos'
                    : 'funções'
                } cadastrados para esta empresa.`}
          </p>
          <button
            onClick={() => openCreateModal(activeTab)}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-lunardeli-red bg-red-50 hover:bg-red-100 px-3 py-2 rounded-lg transition-colors"
          >
            <Plus size={14} /> Cadastrar primeiro item
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:border-lunardeli-red/60 transition-all flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h3 className="font-bold text-gray-900 text-base leading-snug group-hover:text-lunardeli-red transition-colors">
                    {item.nome}
                  </h3>
                  {item.unidade && (
                    <span className="px-2.5 py-0.5 rounded-md bg-gray-100 border border-gray-200 text-gray-700 text-xs font-extrabold uppercase shrink-0">
                      {item.unidade}
                    </span>
                  )}
                </div>

                {item.codigo && (
                  <div className="flex items-center gap-1 text-xs text-gray-500 mb-2 font-mono bg-gray-50 px-2 py-1 rounded border border-gray-100 w-fit">
                    <Tag size={12} className="text-gray-400" />
                    <span>Cód: {item.codigo}</span>
                  </div>
                )}

                {item.observacao && (
                  <p className="text-xs text-gray-600 line-clamp-2 mt-1.5 italic">
                    "{item.observacao}"
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between pt-4 mt-4 border-t border-gray-100">
                <span className="text-[11px] text-gray-400">
                  {new Date(item.createdAt).toLocaleDateString('pt-BR')}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEditModal(item)}
                    className="p-1.5 text-gray-400 hover:text-lunardeli-red hover:bg-red-50 rounded-lg transition-colors"
                    title="Editar item"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(item.id, item.nome)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Excluir item"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Create/Edit */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-lg overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h2 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                {formData.tipo === 'MATERIAL' ? (
                  <Package className="text-lunardeli-red" size={20} />
                ) : formData.tipo === 'EQUIPAMENTO' ? (
                  <Drill className="text-lunardeli-red" size={20} />
                ) : (
                  <Users className="text-lunardeli-red" size={20} />
                )}
                <span>
                  {editingItem ? 'Editar Item do Catálogo' : 'Cadastrar Novo Item'}
                </span>
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              {/* Tipo selector */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Tipo de Insumo
                </label>
                <select
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm bg-white font-medium outline-none focus:ring-2 focus:ring-lunardeli-red"
                  value={formData.tipo}
                  onChange={(e) => setFormData({ ...formData, tipo: e.target.value as TipoInsumo })}
                >
                  <option value="MATERIAL">Material</option>
                  <option value="EQUIPAMENTO">Equipamento</option>
                  <option value="MAO_DE_OBRA">Mão de Obra / Função</option>
                </select>
              </div>

              {/* Nome */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Nome / Descrição <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-lunardeli-red"
                  placeholder={
                    formData.tipo === 'MATERIAL'
                      ? 'Ex: Cimento CP II 50kg'
                      : formData.tipo === 'EQUIPAMENTO'
                      ? 'Ex: Betoneira 400L'
                      : 'Ex: Pedreiro'
                  }
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                />
              </div>

              {/* Unidade & Código */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Unidade Padrão
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      className="w-full border border-gray-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-lunardeli-red"
                      placeholder="Ex: kg, m³, un, h"
                      value={formData.unidade}
                      onChange={(e) => setFormData({ ...formData, unidade: e.target.value })}
                      list="unidades-sugeridas"
                    />
                    <datalist id="unidades-sugeridas">
                      {UNIDADES_SUGERIDAS.map((u) => (
                        <option key={u} value={u} />
                      ))}
                    </datalist>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Código Interno / SINAPI (Opcional)
                  </label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-lunardeli-red"
                    placeholder="Ex: MAT-001 ou 88316"
                    value={formData.codigo}
                    onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                  />
                </div>
              </div>

              {/* Observação */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Observações / Detalhes (Opcional)
                </label>
                <textarea
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-lunardeli-red"
                  placeholder="Informações adicionais sobre especificações, rendimento ou uso..."
                  value={formData.observacao}
                  onChange={(e) => setFormData({ ...formData, observacao: e.target.value })}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-sm transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-lunardeli-red hover:bg-red-700 text-white font-bold rounded-xl text-sm transition-colors shadow-sm disabled:opacity-60"
                >
                  {saving ? 'Salvando...' : editingItem ? 'Atualizar Item' : 'Salvar no Cadastro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CatalogoPage;
