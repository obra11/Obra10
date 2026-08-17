import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
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
  Boxes,
  ArrowLeft,
  Download,
  Upload,
  FileSpreadsheet,
  FileJson,
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

type ImportRow = {
  tipo: TipoInsumo;
  nome: string;
  unidade?: string;
  codigo?: string;
  observacao?: string;
};

/** Unidades comuns em obra — valor gravado + rótulo na UI */
const UNIDADES_OPCOES: { value: string; label: string; grupo: string }[] = [
  // Contagem
  { value: 'un', label: 'un — unidade', grupo: 'Contagem' },
  { value: 'par', label: 'par', grupo: 'Contagem' },
  { value: 'jogo', label: 'jogo', grupo: 'Contagem' },
  { value: 'kit', label: 'kit', grupo: 'Contagem' },
  { value: 'cx', label: 'cx — caixa', grupo: 'Contagem' },
  { value: 'pct', label: 'pct — pacote', grupo: 'Contagem' },
  { value: 'dz', label: 'dz — dúzia', grupo: 'Contagem' },
  { value: 'cento', label: 'cento (100 un)', grupo: 'Contagem' },
  { value: 'milheiro', label: 'milheiro', grupo: 'Contagem' },
  // Massa
  { value: 'kg', label: 'kg — quilograma', grupo: 'Massa' },
  { value: 'g', label: 'g — grama', grupo: 'Massa' },
  { value: 'ton', label: 'ton — tonelada', grupo: 'Massa' },
  { value: 'saco', label: 'saco', grupo: 'Massa' },
  // Comprimento / área / volume
  { value: 'mm', label: 'mm — milímetro', grupo: 'Dimensão' },
  { value: 'cm', label: 'cm — centímetro', grupo: 'Dimensão' },
  { value: 'm', label: 'm — metro linear', grupo: 'Dimensão' },
  { value: 'm²', label: 'm² — metro quadrado', grupo: 'Dimensão' },
  { value: 'm³', label: 'm³ — metro cúbico', grupo: 'Dimensão' },
  { value: 'barra', label: 'barra', grupo: 'Dimensão' },
  { value: 'barras', label: 'barras', grupo: 'Dimensão' },
  { value: 'rolo', label: 'rolo', grupo: 'Dimensão' },
  { value: 'folha', label: 'folha / chapa', grupo: 'Dimensão' },
  { value: 'placa', label: 'placa', grupo: 'Dimensão' },
  // Volume líquido
  { value: 'ml', label: 'ml — mililitro', grupo: 'Volume' },
  { value: 'l', label: 'l — litro', grupo: 'Volume' },
  { value: 'lata', label: 'lata', grupo: 'Volume' },
  { value: 'galão', label: 'galão', grupo: 'Volume' },
  { value: 'balde', label: 'balde', grupo: 'Volume' },
  // Tempo / mão de obra
  { value: 'min', label: 'min — minuto', grupo: 'Tempo' },
  { value: 'h', label: 'h — hora', grupo: 'Tempo' },
  { value: 'vh', label: 'vh — homem-hora', grupo: 'Tempo' },
  { value: 'dia', label: 'dia', grupo: 'Tempo' },
  { value: 'diária', label: 'diária', grupo: 'Tempo' },
  { value: 'semana', label: 'semana', grupo: 'Tempo' },
  { value: 'mês', label: 'mês', grupo: 'Tempo' },
  // Equipamento / locação
  { value: 'serviço', label: 'serviço', grupo: 'Serviço' },
  { value: 'vb', label: 'vb — verba', grupo: 'Serviço' },
];

const UNIDADES_SUGERIDAS = UNIDADES_OPCOES.map((u) => u.value);

const UNIDADE_GRUPOS = Array.from(
  new Set(UNIDADES_OPCOES.map((u) => u.grupo)),
);

const TIPOS_VALIDOS: TipoInsumo[] = ['MATERIAL', 'EQUIPAMENTO', 'MAO_DE_OBRA'];

function normalizarTipo(raw: unknown): TipoInsumo | null {
  const v = String(raw || '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_');

  if (TIPOS_VALIDOS.includes(v as TipoInsumo)) return v as TipoInsumo;
  if (['MATERIAL', 'MATERIAIS', 'MAT'].includes(v)) return 'MATERIAL';
  if (['EQUIPAMENTO', 'EQUIPAMENTOS', 'EQP', 'EQUIP'].includes(v)) return 'EQUIPAMENTO';
  if (
    ['MAO_DE_OBRA', 'MAO_OBRA', 'MAO-DE-OBRA', 'FUNCAO', 'FUNCOES', 'MAO', 'MDO'].includes(v)
  ) {
    return 'MAO_DE_OBRA';
  }
  return null;
}

function pickField(row: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const found = Object.keys(row).find(
      (k) => k.trim().toLowerCase() === key.toLowerCase(),
    );
    if (found != null && row[found] != null && String(row[found]).trim() !== '') {
      return String(row[found]).trim();
    }
  }
  return '';
}

function toExportRows(items: CatalogoInsumo[]) {
  return items.map((i) => ({
    tipo: i.tipo,
    nome: i.nome,
    unidade: i.unidade || '',
    codigo: i.codigo || '',
    observacao: i.observacao || '',
  }));
}

export const CatalogoPage: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<CatalogoInsumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TipoInsumo>('MATERIAL');
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CatalogoInsumo | null>(null);
  const [saving, setSaving] = useState(false);

  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importFileName, setImportFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [atualizarExistentes, setAtualizarExistentes] = useState(true);
  const [importResult, setImportResult] = useState<{
    criados: number;
    atualizados: number;
    ignorados: number;
    erros: Array<{ linha: number; mensagem: string }>;
  } | null>(null);

  const [formData, setFormData] = useState({
    tipo: 'MATERIAL' as TipoInsumo,
    nome: '',
    unidade: 'un',
    codigo: '',
    observacao: '',
  });
  const [unidadeCustom, setUnidadeCustom] = useState(false);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), type === 'error' ? 6000 : 3500);
  };

  const apiErrorMessage = (err: any, fallback: string) => {
    const msg = err?.response?.data?.message;
    if (Array.isArray(msg)) return msg.join(' · ');
    if (typeof msg === 'string' && msg.trim()) return msg;
    return fallback;
  };

  const fetchItems = async () => {
    try {
      setLoading(true);
      const res = await api.get('/catalogo');
      setItems(res.data || []);
    } catch (err: any) {
      console.error('Erro ao carregar Cadastro Base:', err);
      showToast(apiErrorMessage(err, 'Erro ao carregar o Cadastro Base'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const openCreateModal = (tipo: TipoInsumo = activeTab) => {
    setEditingItem(null);
    const unidadePadrao =
      tipo === 'MAO_DE_OBRA' ? 'h' : tipo === 'EQUIPAMENTO' ? 'un' : 'un';
    setFormData({
      tipo,
      nome: '',
      unidade: unidadePadrao,
      codigo: '',
      observacao: '',
    });
    setUnidadeCustom(false);
    setIsModalOpen(true);
  };

  const openEditModal = (item: CatalogoInsumo) => {
    setEditingItem(item);
    const unidade = item.unidade || 'un';
    setFormData({
      tipo: item.tipo,
      nome: item.nome || '',
      unidade,
      codigo: item.codigo || '',
      observacao: item.observacao || '',
    });
    setUnidadeCustom(!UNIDADES_SUGERIDAS.includes(unidade));
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
      showToast(apiErrorMessage(err, 'Erro ao salvar item no catálogo'), 'error');
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
      showToast(apiErrorMessage(err, 'Erro ao excluir item'), 'error');
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

  const exportExcel = (scope: 'all' | 'tab' = 'all') => {
    const source = scope === 'tab' ? items.filter((i) => i.tipo === activeTab) : items;
    if (source.length === 0) {
      showToast('Não há itens para exportar.', 'error');
      return;
    }
    const rows = toExportRows(source);
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Cadastro Base');
    const stamp = new Date().toISOString().slice(0, 10);
    const suffix = scope === 'tab' ? `_${activeTab.toLowerCase()}` : '';
    XLSX.writeFile(wb, `Cadastro_Base${suffix}_${stamp}.xlsx`);
    setExportMenuOpen(false);
    showToast(`Exportados ${rows.length} item(ns) em Excel.`);
  };

  const exportJson = (scope: 'all' | 'tab' = 'all') => {
    const source = scope === 'tab' ? items.filter((i) => i.tipo === activeTab) : items;
    if (source.length === 0) {
      showToast('Não há itens para exportar.', 'error');
      return;
    }
    const payload = {
      versao: 1,
      origem: 'obra10-cadastro-base',
      exportadoEm: new Date().toISOString(),
      itens: toExportRows(source),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    const suffix = scope === 'tab' ? `_${activeTab.toLowerCase()}` : '';
    a.href = url;
    a.download = `Cadastro_Base${suffix}_${stamp}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExportMenuOpen(false);
    showToast(`Exportados ${source.length} item(ns) em JSON.`);
  };

  const downloadTemplate = () => {
    const sample = [
      {
        tipo: 'MATERIAL',
        nome: 'Cimento CP II',
        unidade: 'kg',
        codigo: 'MAT-001',
        observacao: 'Saco 50kg',
      },
      {
        tipo: 'EQUIPAMENTO',
        nome: 'Betoneira 400L',
        unidade: 'un',
        codigo: 'EQP-001',
        observacao: '',
      },
      {
        tipo: 'MAO_DE_OBRA',
        nome: 'Pedreiro',
        unidade: 'un',
        codigo: 'MDO-001',
        observacao: 'Oficial',
      },
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(sample);
    XLSX.utils.book_append_sheet(wb, ws, 'Modelo');
    XLSX.writeFile(wb, 'Modelo_Importacao_Cadastro_Base.xlsx');
  };

  const parseImportRows = (rawList: any[]): { rows: ImportRow[]; errors: string[] } => {
    const rows: ImportRow[] = [];
    const errors: string[] = [];

    rawList.forEach((raw, idx) => {
      const linha = idx + 2; // + header
      const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
      const tipo = normalizarTipo(
        pickField(obj, ['tipo', 'type', 'categoria']) || raw?.tipo,
      );
      const nome = pickField(obj, ['nome', 'name', 'descricao', 'descrição', 'item']);
      if (!tipo) {
        errors.push(`Linha ${linha}: tipo inválido (use MATERIAL, EQUIPAMENTO ou MAO_DE_OBRA).`);
        return;
      }
      if (!nome) {
        errors.push(`Linha ${linha}: nome obrigatório.`);
        return;
      }
      rows.push({
        tipo,
        nome,
        unidade: pickField(obj, ['unidade', 'unit', 'un']) || undefined,
        codigo: pickField(obj, ['codigo', 'código', 'code', 'sinapi']) || undefined,
        observacao:
          pickField(obj, ['observacao', 'observação', 'obs', 'detalhes', 'notes']) ||
          undefined,
      });
    });

    return { rows, errors };
  };

  const handleImportFile = async (file: File) => {
    setImportResult(null);
    setImportFileName(file.name);
    const ext = file.name.split('.').pop()?.toLowerCase();

    try {
      if (ext === 'json') {
        const text = await file.text();
        const parsed = JSON.parse(text);
        const list = Array.isArray(parsed)
          ? parsed
          : Array.isArray(parsed?.itens)
            ? parsed.itens
            : Array.isArray(parsed?.items)
              ? parsed.items
              : null;
        if (!list) {
          setImportRows([]);
          setImportErrors([
            'JSON inválido. Use um array de itens ou { "itens": [...] } no formato do Obra 10.',
          ]);
          return;
        }
        const { rows, errors } = parseImportRows(list);
        setImportRows(rows);
        setImportErrors(errors);
        return;
      }

      if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        const { rows, errors } = parseImportRows(json as any[]);
        setImportRows(rows);
        setImportErrors(errors);
        return;
      }

      setImportRows([]);
      setImportErrors(['Formato não suportado. Use .xlsx, .xls, .csv ou .json.']);
    } catch (err: any) {
      setImportRows([]);
      setImportErrors([err?.message || 'Falha ao ler o arquivo.']);
    }
  };

  const confirmImport = async () => {
    if (importRows.length === 0) {
      showToast('Nenhum item válido para importar.', 'error');
      return;
    }
    try {
      setImporting(true);
      const res = await api.post('/catalogo/importar', {
        itens: importRows,
        atualizarExistentes,
      });
      setImportResult(res.data);
      await fetchItems();
      const { criados, atualizados, ignorados, erros } = res.data;
      showToast(
        `Importação concluída: ${criados} criados, ${atualizados} atualizados` +
          (ignorados ? `, ${ignorados} ignorados` : '') +
          (erros?.length ? `, ${erros.length} erro(s)` : ''),
      );
    } catch (err: any) {
      console.error('Erro na importação:', err);
      showToast(
        err?.response?.data?.message || 'Erro ao importar Cadastro Base',
        'error',
      );
    } finally {
      setImporting(false);
    }
  };

  const openImportModal = () => {
    setIsImportOpen(true);
    setImportRows([]);
    setImportErrors([]);
    setImportFileName('');
    setImportResult(null);
    setAtualizarExistentes(true);
  };

  return (
    <div className="min-h-screen bg-gray-50/50 p-4 md:p-8 space-y-6">
      {toast && (
        <div
          className={`fixed top-5 right-5 z-[200] flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-bold text-white transition-all ${
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
            Cadastre, importe e exporte o catálogo padronizado de Materiais, Equipamentos e Mão de Obra.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3.5 py-2.5 rounded-xl font-bold text-sm transition-all"
            title="Voltar"
          >
            <ArrowLeft size={18} />
            <span>Voltar</span>
          </button>

          <button
            onClick={openImportModal}
            className="flex items-center gap-2 bg-white border border-gray-200 hover:border-lunardeli-red/40 hover:bg-red-50 text-gray-800 px-3.5 py-2.5 rounded-xl font-bold text-sm transition-all"
          >
            <Upload size={18} className="text-lunardeli-red" />
            <span>Importar</span>
          </button>

          <div className="relative">
            <button
              onClick={() => setExportMenuOpen((v) => !v)}
              className="flex items-center gap-2 bg-white border border-gray-200 hover:border-lunardeli-red/40 hover:bg-red-50 text-gray-800 px-3.5 py-2.5 rounded-xl font-bold text-sm transition-all"
            >
              <Download size={18} className="text-lunardeli-red" />
              <span>Exportar</span>
            </button>
            {exportMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-[90]"
                  onClick={() => setExportMenuOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-xl shadow-xl z-[100] overflow-hidden">
                  <button
                    onClick={() => exportExcel('all')}
                    className="w-full flex items-center gap-2 px-4 py-3 text-left text-sm hover:bg-gray-50 font-medium text-gray-800"
                  >
                    <FileSpreadsheet size={16} className="text-green-600" />
                    Excel — catálogo completo
                  </button>
                  <button
                    onClick={() => exportExcel('tab')}
                    className="w-full flex items-center gap-2 px-4 py-3 text-left text-sm hover:bg-gray-50 font-medium text-gray-800"
                  >
                    <FileSpreadsheet size={16} className="text-green-600" />
                    Excel — aba atual
                  </button>
                  <button
                    onClick={() => exportJson('all')}
                    className="w-full flex items-center gap-2 px-4 py-3 text-left text-sm hover:bg-gray-50 font-medium text-gray-800 border-t border-gray-100"
                  >
                    <FileJson size={16} className="text-amber-600" />
                    JSON — catálogo completo
                  </button>
                  <button
                    onClick={() => exportJson('tab')}
                    className="w-full flex items-center gap-2 px-4 py-3 text-left text-sm hover:bg-gray-50 font-medium text-gray-800"
                  >
                    <FileJson size={16} className="text-amber-600" />
                    JSON — aba atual
                  </button>
                </div>
              </>
            )}
          </div>

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

      {/* Tabs */}
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

      {/* Search */}
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

      {/* List */}
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
              : `Ainda não há itens nesta aba. Cadastre manualmente ou importe um arquivo Excel/JSON.`}
          </p>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <button
              onClick={() => openCreateModal(activeTab)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-lunardeli-red bg-red-50 hover:bg-red-100 px-3 py-2 rounded-lg transition-colors"
            >
              <Plus size={14} /> Cadastrar primeiro item
            </button>
            <button
              onClick={openImportModal}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-lg transition-colors"
            >
              <Upload size={14} /> Importar arquivo
            </button>
          </div>
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Unidade Padrão
                  </label>
                  <select
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm bg-white outline-none focus:ring-2 focus:ring-lunardeli-red"
                    value={
                      unidadeCustom || !UNIDADES_SUGERIDAS.includes(formData.unidade)
                        ? '__outra__'
                        : formData.unidade
                    }
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === '__outra__') {
                        setUnidadeCustom(true);
                        setFormData({ ...formData, unidade: '' });
                      } else {
                        setUnidadeCustom(false);
                        setFormData({ ...formData, unidade: v });
                      }
                    }}
                  >
                    {UNIDADE_GRUPOS.map((grupo) => (
                      <optgroup key={grupo} label={grupo}>
                        {UNIDADES_OPCOES.filter((u) => u.grupo === grupo).map((u) => (
                          <option key={u.value} value={u.value}>
                            {u.label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                    <option value="__outra__">Outra (digitar)…</option>
                  </select>
                  {(unidadeCustom || !UNIDADES_SUGERIDAS.includes(formData.unidade)) && (
                    <input
                      type="text"
                      className="mt-2 w-full border border-gray-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-lunardeli-red"
                      placeholder="Digite a unidade (ex: sc, pç, kWh)"
                      value={formData.unidade}
                      onChange={(e) => setFormData({ ...formData, unidade: e.target.value })}
                      autoFocus
                    />
                  )}
                  <p className="text-[11px] text-gray-400 mt-1">
                    Ex.: kg, m³, saco, h, diária — ou escolha “Outra” para personalizar.
                  </p>
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

      {/* Modal Import */}
      {isImportOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 shrink-0">
              <h2 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                <Upload className="text-lunardeli-red" size={20} />
                Importar Cadastro Base
              </h2>
              <button
                onClick={() => setIsImportOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto">
              <p className="text-sm text-gray-600">
                Importe de outro sistema ou de um backup do próprio Obra 10.
                Formatos: <strong>Excel (.xlsx/.xls)</strong>, <strong>CSV</strong> ou{' '}
                <strong>JSON</strong>. Colunas: <code>tipo</code>, <code>nome</code>,{' '}
                <code>unidade</code>, <code>codigo</code>, <code>observacao</code>.
              </p>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={downloadTemplate}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-lg"
                >
                  <FileSpreadsheet size={14} /> Baixar modelo Excel
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-lunardeli-red hover:bg-red-700 px-3 py-2 rounded-lg"
                >
                  <Upload size={14} /> Selecionar arquivo
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv,.json,application/json,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleImportFile(f);
                    e.target.value = '';
                  }}
                />
              </div>

              {importFileName && (
                <p className="text-xs text-gray-500">
                  Arquivo: <span className="font-semibold text-gray-800">{importFileName}</span>
                </p>
              )}

              <label className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={atualizarExistentes}
                  onChange={(e) => setAtualizarExistentes(e.target.checked)}
                />
                <span>
                  Atualizar itens já existentes (mesmo <strong>código</strong> ou mesmo{' '}
                  <strong>tipo + nome</strong>). Se desmarcar, duplicatas são ignoradas.
                </span>
              </label>

              {importErrors.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 space-y-1 max-h-28 overflow-y-auto">
                  {importErrors.slice(0, 12).map((e, i) => (
                    <div key={i}>• {e}</div>
                  ))}
                  {importErrors.length > 12 && (
                    <div>… e mais {importErrors.length - 12} aviso(s).</div>
                  )}
                </div>
              )}

              {importRows.length > 0 && (
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="px-3 py-2 bg-gray-50 text-xs font-bold text-gray-700 flex justify-between">
                    <span>Pré-visualização ({importRows.length} válidos)</span>
                  </div>
                  <div className="max-h-48 overflow-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-white sticky top-0">
                        <tr className="text-left text-gray-500 border-b">
                          <th className="px-3 py-2">Tipo</th>
                          <th className="px-3 py-2">Nome</th>
                          <th className="px-3 py-2">Un.</th>
                          <th className="px-3 py-2">Cód.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importRows.slice(0, 50).map((r, i) => (
                          <tr key={i} className="border-b border-gray-50">
                            <td className="px-3 py-1.5 font-mono text-[10px]">{r.tipo}</td>
                            <td className="px-3 py-1.5 font-medium text-gray-800">{r.nome}</td>
                            <td className="px-3 py-1.5">{r.unidade || '—'}</td>
                            <td className="px-3 py-1.5">{r.codigo || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {importRows.length > 50 && (
                      <p className="text-[11px] text-gray-400 px-3 py-2">
                        Mostrando 50 de {importRows.length}…
                      </p>
                    )}
                  </div>
                </div>
              )}

              {importResult && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-900">
                  <p className="font-bold mb-1">Resultado</p>
                  <p>
                    {importResult.criados} criados · {importResult.atualizados} atualizados ·{' '}
                    {importResult.ignorados} ignorados
                    {importResult.erros?.length
                      ? ` · ${importResult.erros.length} erro(s)`
                      : ''}
                  </p>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-100 flex justify-end gap-2 shrink-0 bg-white">
              <button
                type="button"
                onClick={() => setIsImportOpen(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-sm"
              >
                Fechar
              </button>
              <button
                type="button"
                disabled={importing || importRows.length === 0}
                onClick={confirmImport}
                className="px-5 py-2 bg-lunardeli-red hover:bg-red-700 text-white font-bold rounded-xl text-sm disabled:opacity-60"
              >
                {importing ? 'Importando...' : `Confirmar importação (${importRows.length})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CatalogoPage;
