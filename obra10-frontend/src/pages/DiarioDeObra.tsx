import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import {
  ClipboardList, CloudSun, Users, Hammer, Drill,
  CheckSquare, FileSpreadsheet, Paperclip, MessageSquare, ShieldCheck,
  Plus, Trash2, Video, FileText, Image as ImageIcon, Save, Send, RotateCcw
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */
type RdoStatus = 'rascunho' | 'pendente' | 'aprovado' | 'rejeitado';

interface Pessoa {
  nome: string;
  funcao: string;
  empresa: string;
}

interface Profissional {
  nome: string;
  quantidade: number;
}

interface MaterialItem {
  material: string;
  qtd: string;
  unidade: string;
  observacao: string;
}

interface EquipamentoItem {
  equipamento: string;
  qtd: string;
  status: string;
}

interface Foto {
  file: File;
  preview: string;
  legenda: string;
}

interface VideoFile {
  file: File;
  legenda: string;
}

interface Anexo {
  file: File;
  descricao: string;
}

/* ═══════════════════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════════════════ */
const WEATHER_OPTIONS = [
  { emoji: '☀️', label: 'Sol' },
  { emoji: '⛅', label: 'Parc. nublado' },
  { emoji: '☁️', label: 'Nublado' },
  { emoji: '🌦️', label: 'Chuva leve' },
  { emoji: '🌧️', label: 'Chuva forte' },
  { emoji: '⛈️', label: 'Tempestade' },
  { emoji: '💨', label: 'Ventania' },
];

const DEFAULT_PROFISSIONAIS = [
  'Pedreiro', 'Servente', 'Carpinteiro', 'Armador',
  'Eletricista', 'Encanador', 'Pintor', 'Gesseiro',
  'Azulejista', 'Mestre de obras', 'Engenheiro', 'Técnico de segurança',
];

const UNIDADES = ['kg', 'un', 'm', 'm²', 'm³', 'saco', 'litro', 'peça', 'caixa'];
const EQUIP_STATUS = ['Operando', 'Parado', 'Manutenção'];

function generateRdoNumber(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `RDO-${y}${m}${d}-001`;
}


function getFileExt(name: string): string {
  const parts = name.split('.');
  return parts.length > 1 ? parts.pop()!.toUpperCase() : 'FILE';
}

/* ═══════════════════════════════════════════════════════════════
   Render Helpers
   ═══════════════════════════════════════════════════════════════ */
const SectionContainer = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-100 border-t-[3px] border-t-lunardeli-red/80">{children}</div>
);

const SectionTitle = ({ icon: Icon, title, badge }: { icon: any; title: string; badge?: React.ReactNode }) => (
  <h2 className="text-base md:text-lg font-bold text-gray-900 mb-4 md:mb-5 flex items-center gap-2">
    <Icon className="text-lunardeli-red shrink-0" size={20} />
    <span className="truncate">{title}</span>
    {badge}
  </h2>
);

const InputField = ({ label, type = 'text', ...props }: any) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
    <input type={type} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-lunardeli-red focus:border-lunardeli-red transition-colors outline-none disabled:bg-gray-50 disabled:text-gray-500" {...props} />
  </div>
);

/* ═══════════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════════ */
export const DiarioDeObra: React.FC = () => {
  const { obraId, rdoId } = useParams<{ obraId: string; rdoId: string }>();
  const navigate = useNavigate();
  const [initLoading, setInitLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rdoIdAtual, setRdoIdAtual] = useState<string | null>(rdoId || null);

  const [status, setStatus] = useState<RdoStatus>('rascunho');
  const [toast, setToast] = useState<string | null>(null);
  const [rdoNumberStr, setRdoNumberStr] = useState<string>(generateRdoNumber());
  const [motivoRejeicaoBackend, setMotivoRejeicaoBackend] = useState<string>('');

  // ── Colaboradores da obra (para select de aprovador) ──
  interface Colaborador { id: string; nome: string; email: string; perfilGlobal: string; }
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [aprovadorIdSelecionado, setAprovadorIdSelecionado] = useState('');

  // ── Seção 1 ── Informações gerais
  const today = new Date().toISOString().split('T')[0];
  const [data, setData] = useState(today);
  const [nomeObra, setNomeObra] = useState('');
  const [responsavel, setResponsavel] = useState('');

  useEffect(() => {
    if (!obraId) {
      setRdoNumberStr('RDO #1 (Preview)');
      setInitLoading(false);
      return;
    }

    const headers = { 'x-obra-id': obraId };

    // Buscar colaboradores da obra para o selector de aprovador
    api.get(`/obras/${obraId}/colaboradores`, { headers })
      .then(res => {
        const mapped = (res.data || []).map((r: any) => ({
          id: r.usuario?.id || r.id,
          nome: r.usuario?.nome || r.nome,
          email: r.usuario?.email || r.email,
          perfilGlobal: r.usuario?.perfilGlobal || r.perfilGlobal,
        }));
        setColaboradores(mapped);
      })
      .catch(() => {/* silencioso */});

    if (rdoId) {
      // Carregar RDO existente
      api.get(`/rdos/${rdoId}`, { headers })
        .then(res => {
          const rdo = res.data;
          const extras = rdo.dadosExtras || {};
          setNomeObra(rdo.obra?.nome || '');
          setRdoNumberStr(`RDO #${rdo.id.slice(-6).toUpperCase()}`);
          setData(extras.data || rdo.dataReferencia?.split('T')[0] || today);
          setResponsavel(extras.responsavel || '');
          setClimaManha(extras.climaManha || '');
          setClimaTarde(extras.climaTarde || '');
          setClimaNoite(extras.climaNoite || '');
          setTempMin(extras.tempMin || '');
          setTempMax(extras.tempMax || '');
          setPessoas(extras.pessoas?.length ? extras.pessoas : [{ nome: '', funcao: '', empresa: '' }]);
          setProfissionais(extras.profissionais || []);
          setMateriais(extras.materiais || []);
          setEquipamentos(extras.equipamentos || []);
          setAtividadesExecutadas(extras.atividadesExecutadas || '');
          setAtividadesPendentes(extras.atividadesPendentes || '');
          setObservacoes(extras.observacoes || '');
          setAprovadorIdSelecionado(rdo.aprovadorId || '');

          // Mapear status do backend para status do componente
          const statusMap: Record<string, RdoStatus> = {
            RASCUNHO: 'rascunho', EM_PREENCHIMENTO: 'rascunho',
            SUBMETIDO: 'pendente', APROVADO: 'aprovado', REJEITADO: 'rejeitado',
          };
          setStatus(statusMap[rdo.status] || 'rascunho');
          if (rdo.rejeitadoMotivo) setMotivoRejeicaoBackend(rdo.rejeitadoMotivo);
          setInitLoading(false);
        })
        .catch(err => {
          console.error('Erro ao carregar RDO:', err);
          setInitLoading(false);
        });
    } else {
      // Novo RDO — buscar apenas o setup
      api.get('/rdos/setup', { headers })
        .then(res => {
          setNomeObra(res.data.obraNome);
          setRdoNumberStr(`RDO #${res.data.nextSequencial}`);
          setInitLoading(false);
        })
        .catch(() => setInitLoading(false));
    }
  }, [obraId, rdoId]);

  // ── Seção 2 ── Condições climáticas
  const [climaManha, setClimaManha] = useState('');
  const [climaTarde, setClimaTarde] = useState('');
  const [climaNoite, setClimaNoite] = useState('');
  const [tempMin, setTempMin] = useState('');
  const [tempMax, setTempMax] = useState('');

  // ── Seção 3 ── Presentes na vistoria
  const [pessoas, setPessoas] = useState<Pessoa[]>([{ nome: '', funcao: '', empresa: '' }]);

  // ── Seção 4 ── Efetivo
  const [profissionais, setProfissionais] = useState<Profissional[]>([]);
  const [selectedProfissional, setSelectedProfissional] = useState('');
  const [novoProfissional, setNovoProfissional] = useState('');
  const [selectedQuantidade, setSelectedQuantidade] = useState<number | string>(1);

  // ── Seção 5 ── Materiais & Equipamentos
  const [materiais, setMateriais] = useState<MaterialItem[]>([]);
  const [equipamentos, setEquipamentos] = useState<EquipamentoItem[]>([]);

  // ── Seção 6 ── Atividades executadas
  const [atividadesExecutadas, setAtividadesExecutadas] = useState('');

  // ── Seção 7 ── Atividades pendentes
  const [atividadesPendentes, setAtividadesPendentes] = useState('');

  // ── Seção 8 ── Mídias
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [videos, setVideos] = useState<VideoFile[]>([]);
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const fotoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const anexoInputRef = useRef<HTMLInputElement>(null);

  // ── Seção 9 ── Observações
  const [observacoes, setObservacoes] = useState('');

  // ── Seção 10 ── Validação
  const [motivoRejeicao, setMotivoRejeicao] = useState('');
  const [dataAprovacao, setDataAprovacao] = useState('');

  // ── Toast helper ──
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  // ── Computed values ──
  const totalEfetivo = profissionais.reduce((s, p) => s + p.quantidade, 0);
  const totalAnexos = fotos.length + videos.length + anexos.length;

  // Cleanup blob URLs
  useEffect(() => {
    return () => fotos.forEach(f => URL.revokeObjectURL(f.preview));
  }, []);

  const statusLabels: Record<RdoStatus, string> = {
    rascunho: 'Rascunho',
    pendente: 'Pendente aprovação',
    aprovado: 'Aprovado',
    rejeitado: 'Rejeitado',
  };

  const statusBadgeColor: Record<RdoStatus, string> = {
    rascunho: 'bg-gray-100 text-gray-700 border-gray-200',
    pendente: 'bg-amber-100 text-amber-800 border-amber-200',
    aprovado: 'bg-green-100 text-green-800 border-green-200',
    rejeitado: 'bg-red-100 text-red-800 border-red-200',
  };

  // ── Handlers ──
  // (Pessoas, Efetivo, Materiais, Mídias, etc.)
  const handlePessoaChange = (idx: number, field: keyof Pessoa, val: string) => {
    setPessoas(prev => prev.map((p, i) => i === idx ? { ...p, [field]: val } : p));
  };
  const handleProfQty = (idx: number, delta: number) => {
    setProfissionais(prev => prev.map((p, i) => i === idx ? { ...p, quantidade: Math.max(0, p.quantidade + delta) } : p));
  };
  const handleAddProfissional = () => {
    let nome = selectedProfissional;
    if (selectedProfissional === 'outro') {
       nome = novoProfissional.trim();
    }
    if (!nome || profissionais.some(p => p.nome.toLowerCase() === nome.toLowerCase())) return;
    const qtd = typeof selectedQuantidade === 'string' ? parseInt(selectedQuantidade) : selectedQuantidade;
    setProfissionais(prev => [...prev, { nome, quantidade: isNaN(qtd) || qtd < 1 ? 1 : qtd }]);
    setSelectedProfissional('');
    setNovoProfissional('');
    setSelectedQuantidade(1);
  };

  const handleProfQtyDirect = (idx: number, val: string) => {
    const v = parseInt(val) || 0;
    setProfissionais(prev => prev.map((pr, i) => i === idx ? { ...pr, quantidade: Math.max(0, v) } : pr));
  };
  const handleMaterialChange = (idx: number, field: keyof MaterialItem, val: string) => {
    setMateriais(prev => prev.map((m, i) => i === idx ? { ...m, [field]: val } : m));
  };
  const handleEquipChange = (idx: number, field: keyof EquipamentoItem, val: string) => {
    setEquipamentos(prev => prev.map((e, i) => i === idx ? { ...e, [field]: val } : e));
  };
  const handleFotosDrop = (files: File[]) => {
    setFotos(prev => [...prev, ...files.map(f => ({ file: f, preview: URL.createObjectURL(f), legenda: '' }))]);
  };
  const handleFotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFotosDrop(Array.from(e.target.files || []));
    e.target.value = '';
  };

  const handleVideosDrop = (files: File[]) => {
    setVideos(prev => [...prev, ...files.map(f => ({ file: f, legenda: '' }))]);
  };
  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleVideosDrop(Array.from(e.target.files || []));
    e.target.value = '';
  };

  const handleAnexosDrop = (files: File[]) => {
    setAnexos(prev => [...prev, ...files.map(f => ({ file: f, descricao: '' }))]);
  };
  const handleAnexoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleAnexosDrop(Array.from(e.target.files || []));
    e.target.value = '';
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  // ── Builder do payload JSON ──
  const buildDadosExtras = () => ({
    versao: 1,
    data,
    responsavel,
    climaManha,
    climaTarde,
    climaNoite,
    tempMin,
    tempMax,
    pessoas,
    profissionais,
    materiais,
    equipamentos,
    atividadesExecutadas,
    atividadesPendentes,
    observacoes,
  });

  // ── Salvar Rascunho ──
  const handleSalvarRascunho = async () => {
    if (!obraId) return;
    setSaving(true);
    try {
      const headers = { 'x-obra-id': obraId };
      const dadosExtras = buildDadosExtras();

      if (!rdoIdAtual) {
        // Criar RDO novo
        const res = await api.post('/rdos', { dataReferencia: data, dadosExtras }, { headers });
        setRdoIdAtual(res.data.id);
        navigate(`/obras/${obraId}/rdos/${res.data.id}`, { replace: true });
        showToast('💾 Rascunho criado!');
      } else {
        // Atualizar rascunho existente
        await api.put(`/rdos/${rdoIdAtual}/rascunho`, { dadosExtras }, { headers });
        showToast('💾 Rascunho salvo!');
      }
    } catch (err: any) {
      showToast(`❌ Erro ao salvar: ${err?.response?.data?.message || 'tente novamente'}`);
    } finally {
      setSaving(false);
    }
  };

  // ── Enviar para aprovação ──
  const handleEnviar = async () => {
    if (!obraId) return;
    setSaving(true);
    try {
      const headers = { 'x-obra-id': obraId };
      let idParaSubmeter = rdoIdAtual;

      // Salvar rascunho primeiro se ainda não existe
      if (!idParaSubmeter) {
        const res = await api.post('/rdos', { dataReferencia: data, dadosExtras: buildDadosExtras() }, { headers });
        idParaSubmeter = res.data.id;
        setRdoIdAtual(idParaSubmeter);
      } else {
        await api.put(`/rdos/${idParaSubmeter}/rascunho`, { dadosExtras: buildDadosExtras() }, { headers });
      }

      // Submeter com aprovador selecionado
      await api.put(`/rdos/${idParaSubmeter}/submeter`,
        { aprovadorIdSelecionado: aprovadorIdSelecionado || undefined },
        { headers },
      );
      setStatus('pendente');
      showToast('📤 Enviado para aprovação!');
    } catch (err: any) {
      showToast(`❌ ${err?.response?.data?.message || 'Erro ao enviar'}`);
    } finally {
      setSaving(false);
    }
  };

  // ── Aprovar ──
  const handleAprovar = async () => {
    if (!obraId || !rdoIdAtual) return;
    try {
      await api.put(`/rdos/${rdoIdAtual}/aprovar`, {}, { headers: { 'x-obra-id': obraId } });
      setStatus('aprovado');
      setDataAprovacao(new Date().toLocaleDateString('pt-BR'));
      showToast('✅ RDO Aprovado!');
    } catch (err: any) {
      showToast(`❌ ${err?.response?.data?.message || 'Erro ao aprovar'}`);
    }
  };

  // ── Rejeitar ──
  const handleRejeitar = async () => {
    if (!obraId || !rdoIdAtual || !motivoRejeicao.trim()) return;
    try {
      await api.put(`/rdos/${rdoIdAtual}/rejeitar`, { motivo: motivoRejeicao }, { headers: { 'x-obra-id': obraId } });
      setStatus('rejeitado');
      showToast('❌ RDO Rejeitado.');
    } catch (err: any) {
      showToast(`❌ ${err?.response?.data?.message || 'Erro ao rejeitar'}`);
    }
  };

  // ── Revisar (reabrir após rejeição) ──
  const handleRevisar = async () => {
    if (!obraId || !rdoIdAtual) return;
    try {
      await api.put(`/rdos/${rdoIdAtual}/revisar`, {}, { headers: { 'x-obra-id': obraId } });
      setStatus('rascunho');
      setMotivoRejeicao('');
      showToast('🔄 RDO reaberto para revisão.');
    } catch (err: any) {
      showToast(`❌ ${err?.response?.data?.message || 'Erro ao revisar'}`);
    }
  };

  // ── Render Helpers (movidos para o escopo global) ──

  const renderWeatherShift = (label: string, stateVal: string, setter: (v: string) => void) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      <div className="relative">
        <select
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-lunardeli-red focus:border-lunardeli-red bg-white appearance-none text-gray-700"
          value={stateVal}
          onChange={(e) => setter(e.target.value)}
        >
          <option value="" disabled>Selecione...</option>
          {WEATHER_OPTIONS.map(opt => (
            <option key={opt.label} value={opt.label}>{opt.emoji} {opt.label}</option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
           <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/></svg>
        </div>
      </div>
    </div>
  );

  /* ═══════════════════════════════════════════════════════════════
     Main Render
     ═══════════════════════════════════════════════════════════════ */
  return (
    <div className="min-h-screen bg-lunardeli-gray font-sans pb-40 md:pb-20 relative">
      {/* Toast — Responsive */}
      {toast && (
        <div className="fixed top-4 left-4 right-4 md:left-auto md:right-6 md:top-6 md:max-w-sm z-[60] px-4 py-3 bg-white border-l-4 border-lunardeli-red shadow-lg rounded-lg text-sm font-semibold animate-bounce">
          {toast}
        </div>
      )}

      {/* Header Sticky */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 md:px-8 py-3 md:py-4 flex flex-row items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg md:text-2xl font-bold text-gray-900 tracking-tight truncate">Diário de Obra</h1>
            <p className="text-xs md:text-sm text-gray-500 font-medium truncate">{initLoading ? 'Carregando...' : `${rdoNumberStr}`}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`px-2.5 py-1 rounded-full text-[10px] md:text-xs font-bold border whitespace-nowrap ${statusBadgeColor[status]}`}>
              {statusLabels[status].toUpperCase()}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-3 md:px-8 py-5 md:py-8 space-y-4 md:space-y-6">

        {/* 1. Informações */}
        <SectionContainer>
          <SectionTitle icon={ClipboardList} title="1. Informações gerais" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputField label="Data" type="date" value={data} onChange={(e: any) => setData(e.target.value)} />
            <InputField label="Número RDO" value={rdoNumberStr} disabled />
            <div className="sm:col-span-2">
               <InputField label="Nome da obra" value={nomeObra} onChange={(e: any) => setNomeObra(e.target.value)} placeholder="Ex: Edifício Residencial Solar" />
            </div>
            <div className="sm:col-span-2">
               <InputField label="Responsável técnico" value={responsavel} onChange={(e: any) => setResponsavel(e.target.value)} placeholder="Nome do engenheiro ou responsável" />
            </div>
          </div>
        </SectionContainer>

        {/* 2. Condições Climáticas */}
        <SectionContainer>
          <SectionTitle icon={CloudSun} title="2. Condições climáticas" />
          <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 mb-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {renderWeatherShift('Manhã', climaManha, setClimaManha)}
            {renderWeatherShift('Tarde', climaTarde, setClimaTarde)}
            {renderWeatherShift('Noite', climaNoite, setClimaNoite)}
          </div>
          <div className="grid grid-cols-2 gap-4">
             <InputField label="Temperatura mínima (°C)" type="number" value={tempMin} onChange={(e: any) => setTempMin(e.target.value)} placeholder="Ex: 18" />
             <InputField label="Temperatura máxima (°C)" type="number" value={tempMax} onChange={(e: any) => setTempMax(e.target.value)} placeholder="Ex: 32" />
          </div>
        </SectionContainer>

        {/* 3. Presentes na vistoria */}
        <SectionContainer>
          <SectionTitle icon={Users} title="3. Presentes na vistoria" />
          <div className="space-y-3">
            {pessoas.map((p, i) => (
              <div key={i} className="flex flex-col sm:flex-row gap-3 items-start sm:items-end p-4 bg-gray-50 rounded-xl border border-gray-200">
                <div className="flex-1 w-full"><InputField label="Nome" value={p.nome} onChange={(e: any) => handlePessoaChange(i, 'nome', e.target.value)} placeholder="Nome completo" /></div>
                <div className="flex-1 w-full"><InputField label="Função" value={p.funcao} onChange={(e: any) => handlePessoaChange(i, 'funcao', e.target.value)} placeholder="Ex: Engenheiro" /></div>
                <div className="flex-1 w-full"><InputField label="Empresa" value={p.empresa} onChange={(e: any) => handlePessoaChange(i, 'empresa', e.target.value)} placeholder="Ex: Obra 10" /></div>
                <button type="button" onClick={() => setPessoas(prev => prev.filter((_, idx) => idx !== i))} className="p-2 mb-0.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={18} /></button>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setPessoas(prev => [...prev, { nome: '', funcao: '', empresa: '' }])} className="mt-4 flex items-center gap-2 text-sm font-semibold text-lunardeli-red hover:text-red-700">
            <Plus size={16} /> Adicionar pessoa
          </button>
        </SectionContainer>

        {/* 4. Efetivo */}
        <SectionContainer>
          <SectionTitle icon={Hammer} title="4. Efetivo de mão de obra" badge={<span className="ml-2 px-2.5 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">{totalEfetivo} trabalhadores</span>} />
          <div className="flex flex-col sm:flex-row gap-3 items-end mb-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
             <div className="flex-1 w-full">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Profissional</label>
                <div className="relative">
                   <select
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-lunardeli-red focus:border-lunardeli-red bg-white appearance-none text-gray-700"
                      value={selectedProfissional}
                      onChange={(e) => setSelectedProfissional(e.target.value)}
                   >
                      <option value="" disabled>Selecione um profissional...</option>
                      {DEFAULT_PROFISSIONAIS.filter(
                        p => !profissionais.some(added => added.nome.toLowerCase() === p.toLowerCase())
                      ).map(p => <option key={p} value={p}>{p}</option>)}
                      <option value="outro" className="font-bold text-lunardeli-red">Outro (Digitar manualmente)...</option>
                   </select>
                   <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
                      <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/></svg>
                   </div>
                </div>
             </div>

             {selectedProfissional === 'outro' && (
                <div className="flex-1 w-full">
                   <label className="block text-sm font-medium text-gray-700 mb-1.5">Nome da função</label>
                   <input type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-lunardeli-red outline-none" value={novoProfissional} onChange={e => setNovoProfissional(e.target.value)} placeholder="Ex: Operador de Munck" />
                </div>
             )}

             <div className="w-full sm:w-24">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Qtd</label>
                <input type="number" min="1" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-lunardeli-red text-center outline-none" value={selectedQuantidade} onChange={e => setSelectedQuantidade(e.target.value)} />
             </div>

             <button type="button" onClick={handleAddProfissional} disabled={!selectedProfissional || (selectedProfissional === 'outro' && !novoProfissional.trim())} className="w-full sm:w-auto px-4 py-2 bg-lunardeli-red text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed">
                Adicionar
             </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
             {profissionais.length === 0 && (
                <div className="col-span-1 border-2 border-dashed border-gray-200 rounded-lg p-6 flex items-center justify-center text-gray-400 text-sm font-medium">Nenhum profissional em campo</div>
             )}
             {profissionais.map((p, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
                   <span className="text-sm font-medium text-gray-700">{p.nome}</span>
                   <div className="flex items-center gap-2">
                      <button onClick={() => handleProfQty(i, -1)} className="w-7 h-7 flex items-center justify-center bg-gray-50 border border-gray-300 rounded hover:bg-gray-100 text-gray-600 font-bold">−</button>
                      <input type="number" min="0" value={p.quantidade} onChange={e => handleProfQtyDirect(i, e.target.value)} className="w-12 text-center text-sm font-semibold border border-gray-300 rounded py-1 outline-none focus:border-lunardeli-red" />
                      <button onClick={() => handleProfQty(i, 1)} className="w-7 h-7 flex items-center justify-center bg-gray-50 border border-gray-300 rounded hover:bg-gray-100 text-gray-600 font-bold">+</button>
                      <button onClick={() => setProfissionais(prev => prev.filter((_, idx) => idx !== i))} className="p-1.5 text-red-400 hover:text-red-500 rounded"><Trash2 size={16}/></button>
                   </div>
                </div>
             ))}
          </div>
        </SectionContainer>

        {/* 5. Materiais e Equipamentos */}
        <SectionContainer>
          <SectionTitle icon={Drill} title="5. Materiais e equipamentos" />
          
          <div className="mb-6">
            <h3 className="text-sm font-bold text-gray-800 mb-3">Materiais utilizados</h3>
            <div className="space-y-2">
              {materiais.map((m, i) => (
                <div key={i} className="flex flex-col sm:flex-row gap-2 items-start sm:items-center p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <input className="flex-[2] min-w-0 border-gray-300 rounded px-3 py-1.5 text-sm outline-none focus:border-lunardeli-red border" placeholder="Material..." value={m.material} onChange={e => handleMaterialChange(i, 'material', e.target.value)} />
                  <input className="w-full sm:w-20 border-gray-300 rounded px-2 py-1.5 text-sm outline-none focus:border-lunardeli-red border" placeholder="Qtd" value={m.qtd} onChange={e => handleMaterialChange(i, 'qtd', e.target.value)} />
                  <select className="w-full sm:w-24 border-gray-300 rounded px-2 py-1.5 text-sm outline-none focus:border-lunardeli-red border bg-white" value={m.unidade} onChange={e => handleMaterialChange(i, 'unidade', e.target.value)}>
                    {UNIDADES.map(u => <option key={u}>{u}</option>)}
                  </select>
                  <input className="flex-[2] min-w-0 border-gray-300 rounded px-3 py-1.5 text-sm outline-none focus:border-lunardeli-red border" placeholder="Nota..." value={m.observacao} onChange={e => handleMaterialChange(i, 'observacao', e.target.value)} />
                  <button onClick={() => setMateriais(prev => prev.filter((_, idx) => idx !== i))} className="p-1.5 text-red-500 hover:bg-red-50 rounded"><Trash2 size={16}/></button>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => setMateriais(prev => [...prev, { material: '', qtd: '', unidade: 'un', observacao: '' }])} className="mt-3 text-sm font-semibold text-lunardeli-red hover:text-red-700">+ Adicionar material</button>
          </div>

          <div>
             <h3 className="text-sm font-bold text-gray-800 mb-3">Equipamentos do dia</h3>
             <div className="space-y-2">
               {equipamentos.map((eq, i) => (
                  <div key={i} className="flex flex-col sm:flex-row gap-2 items-start sm:items-center p-3 bg-gray-50 border border-gray-200 rounded-lg">
                     <input className="flex-[2] min-w-0 border-gray-300 rounded px-3 py-1.5 text-sm outline-none focus:border-lunardeli-red border" placeholder="Equipamento..." value={eq.equipamento} onChange={e => handleEquipChange(i, 'equipamento', e.target.value)} />
                     <input className="w-full sm:w-24 border-gray-300 rounded px-2 py-1.5 text-sm outline-none focus:border-lunardeli-red border" placeholder="Qtd" value={eq.qtd} onChange={e => handleEquipChange(i, 'qtd', e.target.value)} />
                     <select className="w-full sm:flex-[1] border-gray-300 rounded px-2 py-1.5 text-sm outline-none focus:border-lunardeli-red border bg-white" value={eq.status} onChange={e => handleEquipChange(i, 'status', e.target.value)}>
                        {EQUIP_STATUS.map(s => <option key={s}>{s}</option>)}
                     </select>
                     <button onClick={() => setEquipamentos(prev => prev.filter((_, idx) => idx !== i))} className="p-1.5 text-red-500 hover:bg-red-50 rounded"><Trash2 size={16}/></button>
                  </div>
               ))}
             </div>
             <button type="button" onClick={() => setEquipamentos(prev => [...prev, { equipamento: '', qtd: '', status: 'Operando' }])} className="mt-3 text-sm font-semibold text-lunardeli-red hover:text-red-700">+ Adicionar equipamento</button>
          </div>
        </SectionContainer>

        {/* 6 & 7. Atividades */}
        <div className="flex flex-col gap-6">
           <SectionContainer>
             <SectionTitle icon={CheckSquare} title="6. Atividades Executadas" />
             <textarea rows={8} className="w-full border border-gray-300 rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-lunardeli-red resize-y" placeholder="- Concretagem...&#10;- Alvenaria..." value={atividadesExecutadas} onChange={e => setAtividadesExecutadas(e.target.value)}></textarea>
           </SectionContainer>
           
           <SectionContainer>
             <SectionTitle icon={FileSpreadsheet} title="7. Atividades Pendentes" />
             <textarea rows={8} className="w-full border border-gray-300 rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-lunardeli-red resize-y" placeholder="O que faltou concluir..." value={atividadesPendentes} onChange={e => setAtividadesPendentes(e.target.value)}></textarea>
           </SectionContainer>
        </div>

        {/* 8. Mídias e Anexos */}
        <SectionContainer>
          <SectionTitle icon={Paperclip} title="8. Mídias e Anexos" />
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             {/* Fotos */}
             <div 
                className="bg-gray-50 border border-gray-200 rounded-xl p-4 transition-colors hover:border-lunardeli-red border-dashed drag-active:bg-red-50"
                onDragOver={onDragOver}
                onDrop={(e) => { e.preventDefault(); handleFotosDrop(Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'))); }}
             >
                <div className="flex justify-between items-center mb-4">
                   <h3 className="font-bold text-gray-800 flex items-center gap-1.5"><ImageIcon size={16}/> Fotos</h3>
                   <input type="file" multiple accept="image/*" ref={fotoInputRef} className="hidden" onChange={handleFotoUpload} capture="environment" />
                   <button onClick={() => fotoInputRef.current?.click()} className="text-xs font-semibold text-lunardeli-red hover:underline">+ Upload</button>
                </div>
                <div className="space-y-3">
                   {fotos.map((f, i) => (
                      <div key={i} className="bg-white border border-gray-200 rounded-lg overflow-hidden flex flex-col">
                         <img src={f.preview} alt="" className="w-full h-24 object-cover" />
                         <div className="p-2 flex gap-1 items-center bg-gray-50">
                            <input className="flex-1 text-xs px-2 py-1 border rounded" placeholder="Legenda..." value={f.legenda} onChange={e => setFotos(prev => prev.map((item, idx) => idx === i ? { ...item, legenda: e.target.value } : item))} />
                            <button onClick={() => setFotos(prev => prev.filter((_, idx) => idx !== i))} className="text-red-500 p-1"><Trash2 size={14}/></button>
                         </div>
                      </div>
                   ))}
                   {fotos.length === 0 && <div className="text-xs text-center text-gray-400 py-4 border-2 border-dashed border-gray-200 rounded-lg">Nenhuma foto</div>}
                </div>
             </div>

             {/* Videos */}
             <div 
                className="bg-gray-50 border border-gray-200 rounded-xl p-4 transition-colors hover:border-lunardeli-red border-dashed"
                onDragOver={onDragOver}
                onDrop={(e) => { e.preventDefault(); handleVideosDrop(Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('video/'))); }}
             >
                <div className="flex justify-between items-center mb-4">
                   <h3 className="font-bold text-gray-800 flex items-center gap-1.5"><Video size={16}/> Vídeos</h3>
                   <input type="file" multiple accept="video/*" ref={videoInputRef} className="hidden" onChange={handleVideoUpload} capture="environment" />
                   <button onClick={() => videoInputRef.current?.click()} className="text-xs font-semibold text-lunardeli-red hover:underline">+ Upload</button>
                </div>
                <div className="space-y-2">
                   {videos.map((v, i) => (
                      <div key={i} className="bg-white border border-gray-200 p-2 rounded-lg flex items-center gap-2">
                         <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{v.file.name}</p>
                            <input className="w-full text-xs px-1.5 py-1 border border-gray-100 rounded mt-1 bg-gray-50" placeholder="Legenda..." value={v.legenda} onChange={e => setVideos(prev => prev.map((item, idx) => idx === i ? { ...item, legenda: e.target.value } : item))} />
                         </div>
                         <button onClick={() => setVideos(prev => prev.filter((_, idx) => idx !== i))} className="text-red-500 p-1"><Trash2 size={14}/></button>
                      </div>
                   ))}
                   {videos.length === 0 && <div className="text-xs text-center text-gray-400 py-4 border-2 border-dashed border-gray-200 rounded-lg">Nenhum vídeo</div>}
                </div>
             </div>

             {/* Documentos */}
             <div 
                className="bg-gray-50 border border-gray-200 rounded-xl p-4 transition-colors hover:border-lunardeli-red border-dashed"
                onDragOver={onDragOver}
                onDrop={(e) => { e.preventDefault(); handleAnexosDrop(Array.from(e.dataTransfer.files)); }}
             >
                <div className="flex justify-between items-center mb-4">
                   <h3 className="font-bold text-gray-800 flex items-center gap-1.5"><FileText size={16}/> Outros anexos</h3>
                   <input type="file" multiple ref={anexoInputRef} className="hidden" onChange={handleAnexoUpload} />
                   <button onClick={() => anexoInputRef.current?.click()} className="text-xs font-semibold text-lunardeli-red hover:underline">+ Upload</button>
                </div>
                <div className="space-y-2">
                   {anexos.map((a, i) => (
                      <div key={i} className="bg-white border border-gray-200 p-2 rounded-lg flex items-center gap-2">
                         <span className="shrink-0 bg-blue-100 text-blue-700 text-[10px] font-bold px-1.5 py-0.5 rounded">{getFileExt(a.file.name)}</span>
                         <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{a.file.name}</p>
                            <input className="w-full text-xs px-1.5 py-1 border border-gray-100 rounded mt-1 bg-gray-50" placeholder="Info..." value={a.descricao} onChange={e => setAnexos(prev => prev.map((item, idx) => idx === i ? { ...item, descricao: e.target.value } : item))} />
                         </div>
                         <button onClick={() => setAnexos(prev => prev.filter((_, idx) => idx !== i))} className="text-red-500 p-1"><Trash2 size={14}/></button>
                      </div>
                   ))}
                   {anexos.length === 0 && <div className="text-xs text-center text-gray-400 py-4 border-2 border-dashed border-gray-200 rounded-lg">Nenhum anexo</div>}
                </div>
             </div>
          </div>
        </SectionContainer>

        {/* 9. Observações */}
        <SectionContainer>
          <SectionTitle icon={MessageSquare} title="9. Observações gerais" />
          <textarea rows={4} className="w-full border border-gray-300 rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-lunardeli-red" placeholder="Detalhes adicionais, comentários, paralisações..." value={observacoes} onChange={e => setObservacoes(e.target.value)}></textarea>
        </SectionContainer>

        {/* 10. Validação e Aprovação */}
        <SectionContainer>
          <SectionTitle icon={ShieldCheck} title="10. Validação e Aprovação" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 p-6 rounded-xl border border-gray-200">
             <div className="space-y-4">

               {/* Seletor de aprovador — visível somente em rascunho */}
               {status === 'rascunho' && (
                 <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1.5">
                     Enviar para aprovação de
                   </label>
                   <div className="relative">
                     <select
                       className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-lunardeli-red focus:border-lunardeli-red bg-white appearance-none text-gray-700"
                       value={aprovadorIdSelecionado}
                       onChange={e => setAprovadorIdSelecionado(e.target.value)}
                     >
                       <option value="">— Selecionar aprovador (opcional) —</option>
                       {colaboradores.map(c => (
                         <option key={c.id} value={c.id}>{c.nome} ({c.perfilGlobal})</option>
                       ))}
                     </select>
                     <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
                       <svg className="fill-current h-4 w-4" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/></svg>
                     </div>
                   </div>
                   {aprovadorIdSelecionado && (
                     <p className="text-xs text-green-600 mt-1 font-medium">
                       ✉️ Um e-mail será enviado ao aprovador selecionado.
                     </p>
                   )}
                 </div>
               )}

               <div className="space-y-3">
                 {status === 'rascunho' && (
                   <div className="flex gap-3">
                     <button
                       onClick={handleEnviar}
                       disabled={saving}
                       className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-lunardeli-red text-white text-sm font-bold rounded-lg hover:bg-red-700 shadow-sm transition-colors disabled:opacity-60"
                     >
                       <Send size={16} /> {saving ? 'Enviando...' : 'Enviar para aprovação'}
                     </button>
                     <button
                       onClick={handleSalvarRascunho}
                       disabled={saving}
                       className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-bold rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-60"
                     >
                       <Save size={16} /> {saving ? 'Salvando...' : 'Salvar'}
                     </button>
                   </div>
                 )}

                 {status === 'pendente' && (
                   <div className="space-y-4">
                     <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm font-medium">
                       ⏳ Aguardando aprovação do gestor.
                     </div>
                     <div className="flex gap-3">
                       <button onClick={handleAprovar} className="flex-1 px-4 py-2 bg-green-600 text-white text-sm font-bold rounded-lg hover:bg-green-700 shadow-sm transition-colors text-center">
                         ✅ Aprovar RDO
                       </button>
                       <button
                         onClick={handleRejeitar}
                         disabled={!motivoRejeicao.trim()}
                         className={`px-4 py-2 ${motivoRejeicao.trim() ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-gray-200 text-gray-500 cursor-not-allowed'} text-sm font-bold rounded-lg transition-colors`}
                       >
                         ❌ Reprovar
                       </button>
                     </div>
                     <textarea
                       className="w-full border border-gray-300 p-2 text-sm rounded bg-white"
                       rows={2}
                       placeholder="Motivo da reprovação (obrigatório para reprovar)"
                       value={motivoRejeicao}
                       onChange={e => setMotivoRejeicao(e.target.value)}
                     />
                   </div>
                 )}

                 {status === 'aprovado' && (
                   <div className="p-4 bg-green-100 border border-green-300 rounded-lg text-green-800">
                     <p className="font-bold flex items-center gap-2"><ShieldCheck size={18}/> RDO Aprovado</p>
                     <p className="text-sm mt-1 opacity-80">{dataAprovacao}</p>
                   </div>
                 )}

                 {status === 'rejeitado' && (
                   <div className="p-4 bg-red-100 border border-red-300 rounded-lg text-red-800 space-y-3">
                     <div>
                       <p className="font-bold flex items-center gap-2 text-red-900">❌ RDO Reprovado</p>
                       <p className="text-sm mt-1">{motivoRejeicaoBackend || motivoRejeicao}</p>
                     </div>
                     <button onClick={handleRevisar} className="flex items-center gap-2 text-sm font-bold text-red-700 hover:underline">
                       <RotateCcw size={14}/> Revisar e Reenviar
                     </button>
                   </div>
                 )}
               </div>
             </div>

             {/* Resumo do RDO */}
             <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col justify-center">
                 <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-4 text-center">Resumo do RDO</h4>
                 <div className="grid grid-cols-2 gap-4 text-center">
                    <div>
                       <div className="text-3xl font-black text-lunardeli-red">{totalEfetivo}</div>
                       <div className="text-xs font-medium text-gray-500 mt-1">Trabalhadores</div>
                    </div>
                    <div>
                       <div className="text-3xl font-black text-gray-800">{totalAnexos}</div>
                       <div className="text-xs font-medium text-gray-500 mt-1">Arquivos anexos</div>
                    </div>
                    <div>
                       <div className="text-3xl font-black text-blue-600">{materiais.length}</div>
                       <div className="text-xs font-medium text-gray-500 mt-1">Materiais</div>
                    </div>
                    <div>
                       <div className="text-3xl font-black text-purple-600">{equipamentos.length}</div>
                       <div className="text-xs font-medium text-gray-500 mt-1">Equipamentos</div>
                    </div>
                 </div>
                 {rdoIdAtual && (
                   <p className="text-center text-xs text-gray-400 mt-4 font-mono">{rdoIdAtual.slice(-8).toUpperCase()}</p>
                 )}
             </div>
          </div>
        </SectionContainer>
        
      </div>

      {/* ═══ Mobile Floating Action Bar ═══ */}
      {status === 'rascunho' && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-[0_-4px_16px_rgba(0,0,0,0.08)]" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
          <div className="flex items-center gap-2 px-4 py-3">
            <button
              onClick={handleSalvarRascunho}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-3 bg-white border-2 border-gray-200 text-gray-700 text-sm font-bold rounded-xl active:bg-gray-50 transition-colors disabled:opacity-60"
            >
              <Save size={18} /> {saving ? '...' : 'Salvar'}
            </button>
            <button
              onClick={handleEnviar}
              disabled={saving}
              className="flex-[2] flex items-center justify-center gap-2 px-3 py-3 bg-lunardeli-red text-white text-sm font-bold rounded-xl active:bg-red-700 shadow-sm transition-colors disabled:opacity-60"
            >
              <Send size={18} /> {saving ? 'Enviando...' : 'Enviar p/ aprovação'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DiarioDeObra;
