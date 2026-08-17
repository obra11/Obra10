import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import {
  ClipboardList, CloudSun, Users, Hammer, Drill,
  CheckSquare, FileSpreadsheet, Paperclip, MessageSquare, ShieldCheck,
  Plus, Trash2, Video, FileText, Image as ImageIcon, Save, Send, RotateCcw, ArrowLeft,
  ChevronDown, ChevronUp, Maximize2, Minimize2, Camera, FolderOpen, Images
} from 'lucide-react';
import { format } from 'date-fns';
import { parseUTCDate } from '../utils/date';
import { RdoShareBar } from '../components/RdoShareBar';
import { AutoResizeTextarea } from '../components/AutoResizeTextarea';
import { useAuth } from '../context/AuthContext';
import { persistCapturedMediaList } from '../utils/persistCapturedMedia';
import {
  generateUUID,
  saveOfflineAttachment,
  getOfflineAttachments,
  deleteOfflineAttachment,
  updateRdoId,
  incrementarTentativa,
  updateOfflineAttachmentLegenda,
  saveOfflineRdoDraft,
  getOfflineRdoDraft,
  deleteOfflineRdoDraft,
  getPendingOfflineRdoDrafts,
  offlineDraftKey,
  type OfflineRdoDraft,
} from '../utils/offlineStorage';

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
  offlineId?: string;
  isOfflinePending?: boolean;
  uploadFalhou?: boolean;
  isUploading?: boolean;
}

interface VideoFile {
  file: File;
  legenda: string;
  offlineId?: string;
  isOfflinePending?: boolean;
  uploadFalhou?: boolean;
  isUploading?: boolean;
}

interface Anexo {
  file: File;
  descricao: string;
  offlineId?: string;
  isOfflinePending?: boolean;
  uploadFalhou?: boolean;
  isUploading?: boolean;
}

interface SavedFile {
  id: string;
  nomeOriginal: string;
  urlS3: string;
  mimeType: string;
}

interface AtividadeExecutadaItem {
  descricao: string;
  status: 'em andamento' | 'pausado' | 'finalizada';
}

interface ObservacaoItem {
  descricao: string;
}

interface AtividadePendenteItem {
  descricao: string;
  responsavel: string;
}

/** Converte texto legado (string) ou array no formato estruturado de observações. */
function parseObservacoes(raw: unknown): ObservacaoItem[] {
  if (typeof raw === 'string') {
    return raw
      .split(/\r?\n/)
      .map(line => line.trim().replace(/^[-*•\d.]+\s*/, '').trim())
      .filter(Boolean)
      .map(descricao => ({ descricao }));
  }
  if (Array.isArray(raw)) {
    return raw.map((item: any) =>
      typeof item === 'string'
        ? { descricao: item }
        : { descricao: item?.descricao || '' },
    );
  }
  return [];
}

/** Converte texto legado (string) ou array no formato estruturado de pendências. */
function parseAtividadesPendentes(raw: unknown): AtividadePendenteItem[] {
  if (typeof raw === 'string') {
    return raw
      .split(/\r?\n/)
      .map(line => line.trim().replace(/^[-*•\d.]+\s*/, '').trim())
      .filter(Boolean)
      .map(descricao => ({ descricao, responsavel: '' }));
  }
  if (Array.isArray(raw)) {
    return raw.map((item: any) =>
      typeof item === 'string'
        ? { descricao: item, responsavel: '' }
        : { descricao: item?.descricao || '', responsavel: item?.responsavel || '' },
    );
  }
  return [];
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
const CollapsibleSection = ({
  icon: Icon,
  title,
  badge,
  children,
  isCollapsed = false,
  onToggle,
}: {
  icon: any;
  title: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
  isCollapsed?: boolean;
  onToggle?: () => void;
}) => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-100 border-t-[3px] border-t-lunardeli-red/80 overflow-hidden transition-all">
    <div
      onClick={onToggle}
      className={`p-4 md:px-6 md:py-4 flex items-center justify-between gap-3 cursor-pointer select-none hover:bg-gray-50/80 transition-colors ${isCollapsed ? '' : 'border-b border-gray-100'}`}
    >
      <h2 className="text-base md:text-lg font-bold text-gray-900 flex items-center gap-2 min-w-0">
        <Icon className="text-lunardeli-red shrink-0" size={20} />
        <span className="truncate">{title}</span>
        {badge}
      </h2>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggle?.();
        }}
        className="p-1.5 text-gray-400 hover:text-lunardeli-red hover:bg-red-50 rounded-lg transition-colors shrink-0"
        title={isCollapsed ? 'Expandir seção' : 'Recolher seção'}
      >
        {isCollapsed ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
      </button>
    </div>
    {!isCollapsed && <div className="p-4 md:p-6 pt-3 md:pt-5">{children}</div>}
  </div>
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
  const { user, obras } = useAuth();
  const tempRdoId = useRef(rdoId || generateUUID());
  const [initLoading, setInitLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rdoIdAtual, setRdoIdAtual] = useState<string | null>(rdoId || null);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );
  const [draftPendingSync, setDraftPendingSync] = useState(false);
  const [lastLocalSaveAt, setLastLocalSaveAt] = useState<string | null>(null);
  const autosaveReady = useRef(false);
  const syncingDraftRef = useRef(false);

  const [status, setStatus] = useState<RdoStatus>('rascunho');
  const [toast, setToast] = useState<string | null>(null);
  const [rdoNumberStr, setRdoNumberStr] = useState<string>(generateRdoNumber());
  const [motivoRejeicaoBackend, setMotivoRejeicaoBackend] = useState<string>('');

  // ── Estado de seções recolhidas / minimizadas ──
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const toggleSection = (key: string) => setCollapsedSections(prev => ({ ...prev, [key]: !prev[key] }));
  const expandAllSections = () => setCollapsedSections({});
  const collapseAllSections = () => setCollapsedSections({
    sec1: true, sec2: true, sec3: true, sec4: true, sec5: true,
    sec6: true, sec7: true, sec8: true, sec9: true, sec10: true
  });

  const obraAtual = (user as any)?.obrasPermitidas?.find((o: any) => (o.obraId || o.id) === obraId) || obras?.find((o: any) => o.id === obraId);
  const permRdo = obraAtual?.permissoes?.RDO || obraAtual?.permissoes?.rdo;
  const isGestorOrAdmin =
    user?.perfilGlobal === 'SUPER_ADMIN' ||
    user?.capabilities?.aprovarRdo === true ||
    user?.capabilities?.acessoTodasObras === true ||
    user?.perfilGlobal === 'GESTOR' ||
    (user as any)?.role === 'GESTOR' ||
    (user as any)?.role === 'SUPER_ADMIN';
  const isReadOnly = permRdo === 'VIEW' || permRdo === 'VIEW_APPROVED' || permRdo === 'VIEW_PARTIAL_APPROVED' || (status !== 'rascunho' && !isGestorOrAdmin);
  const isPartialView = permRdo === 'VIEW_PARTIAL_APPROVED';

  // ── Colaboradores da obra (para select de aprovador) ──
  interface Colaborador { id: string; nome: string; email: string; perfilGlobal: string; }
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [aprovadorIdSelecionado, setAprovadorIdSelecionado] = useState('');

  // ── Catálogo de Insumos da Empresa ──
  const [catalogoProfissionais, setCatalogoProfissionais] = useState<string[]>(DEFAULT_PROFISSIONAIS);
  const [catalogoMateriais, setCatalogoMateriais] = useState<{ id: string; nome: string; unidade?: string }[]>([]);
  const [catalogoEquipamentos, setCatalogoEquipamentos] = useState<{ id: string; nome: string }[]>([]);

  useEffect(() => {
    api.get('/catalogo')
      .then((res) => {
        const items: any[] = res.data || [];
        const maos = items.filter((i) => i.tipo === 'MAO_DE_OBRA').map((i) => i.nome);
        if (maos.length > 0) {
          const merged = Array.from(new Set([...maos, ...DEFAULT_PROFISSIONAIS]));
          setCatalogoProfissionais(merged);
        }
        const mats = items.filter((i) => i.tipo === 'MATERIAL');
        if (mats.length > 0) setCatalogoMateriais(mats);
        const equips = items.filter((i) => i.tipo === 'EQUIPAMENTO');
        if (equips.length > 0) setCatalogoEquipamentos(equips);
      })
      .catch(() => {});
  }, []);

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

    if (!rdoId && (permRdo === 'VIEW' || permRdo === 'VIEW_APPROVED' || permRdo === 'VIEW_PARTIAL_APPROVED')) {
      alert('Você não tem permissão para criar diários de obra.');
      navigate(`/obras/${obraId}/rdos`);
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
        .then(async (res) => {
          const rdo = res.data;
          const extras = rdo.dadosExtras || {};
          setNomeObra(rdo.obra?.nome || '');
          setRdoNumberStr(`RDO #${rdo.sequencial ?? rdo.id.slice(-6).toUpperCase()}`);
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
          // Tratar atividades executadas estruturadas/texto antigo
          let parsedAtividades: AtividadeExecutadaItem[] = [];
          const rawAtv = extras.atividadesExecutadas;
          if (typeof rawAtv === 'string') {
            parsedAtividades = rawAtv
              .split(/\r?\n/)
              .map(line => line.trim().replace(/^[-*•\d.]+\s*/, '').trim())
              .filter(Boolean)
              .map(line => ({ descricao: line, status: 'em andamento' as const }));
          } else if (Array.isArray(rawAtv)) {
            parsedAtividades = rawAtv;
          }
          setAtividadesExecutadas(parsedAtividades);

          setAtividadesPendentes(parseAtividadesPendentes(extras.atividadesPendentes));
          setObservacoes(parseObservacoes(extras.observacoes || extras.observacoesGerais));
          setAprovadorIdSelecionado(rdo.aprovadorId || '');
          setSavedFiles(rdo.anexos || []);

          // Mapear status do backend para status do componente
          const statusMap: Record<string, RdoStatus> = {
            RASCUNHO: 'rascunho', EM_PREENCHIMENTO: 'rascunho',
            SUBMETIDO: 'pendente', APROVADO: 'aprovado', REJEITADO: 'rejeitado',
          };
          setStatus(statusMap[rdo.status] || 'rascunho');
          if (rdo.rejeitadoMotivo) setMotivoRejeicaoBackend(rdo.rejeitadoMotivo);

          // Se houver rascunho local pendente de sync, prevalece o do aparelho
          try {
            const local = await getOfflineRdoDraft(offlineDraftKey(obraId, rdoId));
            if (local?.pendingSync && local.dadosExtras) {
              const le = local.dadosExtras;
              setData(le.data || extras.data || today);
              setResponsavel(le.responsavel || '');
              setClimaManha(le.climaManha || '');
              setClimaTarde(le.climaTarde || '');
              setClimaNoite(le.climaNoite || '');
              setTempMin(le.tempMin || '');
              setTempMax(le.tempMax || '');
              setPessoas(le.pessoas?.length ? le.pessoas : [{ nome: '', funcao: '', empresa: '' }]);
              setProfissionais(le.profissionais || []);
              setMateriais(le.materiais || []);
              setEquipamentos(le.equipamentos || []);
              const rawLocalAtv = le.atividadesExecutadas;
              if (Array.isArray(rawLocalAtv)) setAtividadesExecutadas(rawLocalAtv);
              setAtividadesPendentes(parseAtividadesPendentes(le.atividadesPendentes));
              setObservacoes(parseObservacoes(le.observacoes || le.observacoesGerais));
              if (local.aprovadorId) setAprovadorIdSelecionado(local.aprovadorId);
              setDraftPendingSync(true);
              setLastLocalSaveAt(local.updatedAt);
            }
          } catch { /* ignore */ }

          setInitLoading(false);
          autosaveReady.current = true;
        })
        .catch(async (err) => {
          console.error('Erro ao carregar RDO:', err);
          try {
            const local = await getOfflineRdoDraft(offlineDraftKey(obraId, rdoId));
            if (local?.dadosExtras) {
              const le = local.dadosExtras;
              setData(le.data || today);
              setResponsavel(le.responsavel || '');
              setClimaManha(le.climaManha || '');
              setClimaTarde(le.climaTarde || '');
              setClimaNoite(le.climaNoite || '');
              setTempMin(le.tempMin || '');
              setTempMax(le.tempMax || '');
              setPessoas(le.pessoas?.length ? le.pessoas : [{ nome: '', funcao: '', empresa: '' }]);
              setProfissionais(le.profissionais || []);
              setMateriais(le.materiais || []);
              setEquipamentos(le.equipamentos || []);
              if (Array.isArray(le.atividadesExecutadas)) setAtividadesExecutadas(le.atividadesExecutadas);
              setAtividadesPendentes(parseAtividadesPendentes(le.atividadesPendentes));
              setObservacoes(parseObservacoes(le.observacoes || le.observacoesGerais));
              if (local.aprovadorId) setAprovadorIdSelecionado(local.aprovadorId);
              if (local.rdoNumberStr) setRdoNumberStr(local.rdoNumberStr);
              if (local.nomeObra) setNomeObra(local.nomeObra);
              setDraftPendingSync(!!local.pendingSync);
              setLastLocalSaveAt(local.updatedAt);
              setInitLoading(false);
              autosaveReady.current = true;
              setToast('📴 Sem conexão — abrindo cópia salva no aparelho.');
              return;
            }
          } catch { /* ignore */ }
          alert(err?.response?.data?.message || 'Erro ao carregar RDO.');
          navigate(`/obras/${obraId}/rdos`);
        });
    } else {
      // Novo RDO — buscar apenas o setup e RDOs anteriores
      const finishNew = async (obraNome?: string, nextSeq?: number) => {
        if (obraNome) setNomeObra(obraNome);
        if (nextSeq) setRdoNumberStr(`RDO #${nextSeq}`);
        try {
          const local = await getOfflineRdoDraft(offlineDraftKey(obraId, null));
          if (local?.dadosExtras) {
            const le = local.dadosExtras;
            setData(le.data || today);
            setResponsavel(le.responsavel || '');
            setClimaManha(le.climaManha || '');
            setClimaTarde(le.climaTarde || '');
            setClimaNoite(le.climaNoite || '');
            setTempMin(le.tempMin || '');
            setTempMax(le.tempMax || '');
            setPessoas(le.pessoas?.length ? le.pessoas : [{ nome: '', funcao: '', empresa: '' }]);
            setProfissionais(le.profissionais || []);
            setMateriais(le.materiais || []);
            setEquipamentos(le.equipamentos || []);
            if (Array.isArray(le.atividadesExecutadas)) setAtividadesExecutadas(le.atividadesExecutadas);
            setAtividadesPendentes(parseAtividadesPendentes(le.atividadesPendentes));
            setObservacoes(parseObservacoes(le.observacoes || le.observacoesGerais));
            if (local.aprovadorId) setAprovadorIdSelecionado(local.aprovadorId);
            if (local.rdoNumberStr) setRdoNumberStr(local.rdoNumberStr);
            if (local.nomeObra) setNomeObra(local.nomeObra);
            if (local.tempId) tempRdoId.current = local.tempId;
            setDraftPendingSync(!!local.pendingSync);
            setLastLocalSaveAt(local.updatedAt);
            setToast('📴 Rascunho local restaurado neste aparelho.');
          }
        } catch { /* ignore */ }
        setInitLoading(false);
        autosaveReady.current = true;
      };

      api.get('/rdos/setup', { headers })
        .then(res => finishNew(res.data.obraNome, res.data.nextSequencial))
        .catch(() => finishNew());

      api.get('/rdos', { headers })
        .then(res => {
          setPreviousRdos(res.data || []);
        })
        .catch(() => {/* silent */});
    }
  }, [obraId, rdoId, permRdo, navigate]);

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
  const [atividadesExecutadas, setAtividadesExecutadas] = useState<AtividadeExecutadaItem[]>([]);

  // ── Seção 8 ── Atividades pendentes
  const [atividadesPendentes, setAtividadesPendentes] = useState<AtividadePendenteItem[]>([]);

  // ── Seção 9 ── Mídias
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [videos, setVideos] = useState<VideoFile[]>([]);
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const [savedFiles, setSavedFiles] = useState<SavedFile[]>([]);
  const fotoCameraInputRef = useRef<HTMLInputElement>(null);
  const fotoGalleryInputRef = useRef<HTMLInputElement>(null);
  const fotoFilesInputRef = useRef<HTMLInputElement>(null);
  const videoCameraInputRef = useRef<HTMLInputElement>(null);
  const videoGalleryInputRef = useRef<HTMLInputElement>(null);
  const videoFilesInputRef = useRef<HTMLInputElement>(null);
  const anexoInputRef = useRef<HTMLInputElement>(null);
  const [mediaPicker, setMediaPicker] = useState<null | 'foto' | 'video'>(null);

  // ── Clonagem/Cópia de RDO Anterior ──
  const [previousRdos, setPreviousRdos] = useState<any[]>([]);
  const [selectedBaseRdoId, setSelectedBaseRdoId] = useState('');

  // ── Seção 7 ── Observações gerais
  const [observacoes, setObservacoes] = useState<ObservacaoItem[]>([]);

  // ── Seção 10 ── Validação
  const [motivoRejeicao, setMotivoRejeicao] = useState('');
  const [dataAprovacao, setDataAprovacao] = useState('');

  // ── Toast helper ──
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  // Helper para obter URL de visualização de arquivos
  const getFileUrl = (urlS3: string) => {
    if (!urlS3) return '';
    if (urlS3.startsWith('http://') || urlS3.startsWith('https://')) {
      return urlS3;
    }
    const apiBase = import.meta.env.VITE_API_URL ?? '';
    const cleanBase = apiBase.endsWith('/') ? apiBase.slice(0, -1) : apiBase;
    const cleanPath = urlS3.startsWith('/') ? urlS3 : `/${urlS3}`;
    return `${cleanBase}${cleanPath}`;
  };

  const handleDeleteAnexo = async (anexoId: string) => {
    if (!window.confirm('Deseja realmente excluir este anexo permanentemente?')) return;
    try {
      await api.delete(`/anexos/${anexoId}`);
      setSavedFiles(prev => prev.filter(item => item.id !== anexoId));
      showToast('🗑️ Anexo removido com sucesso.');
    } catch (err: any) {
      showToast(`❌ Erro ao remover anexo: ${err?.response?.data?.message || 'tente novamente'}`);
    }
  };

  const readFileAsArrayBuffer = (file: File): Promise<ArrayBuffer> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });
  };

  const marcarEnviandoLocal = (offlineId: string) => {
    setFotos(prev => prev.map(f => f.offlineId === offlineId ? { ...f, isUploading: true, uploadFalhou: false } : f));
    setVideos(prev => prev.map(v => v.offlineId === offlineId ? { ...v, isUploading: true, uploadFalhou: false } : v));
    setAnexos(prev => prev.map(a => a.offlineId === offlineId ? { ...a, isUploading: true, uploadFalhou: false } : a));
  };

  const marcarFalhaLocal = (offlineId: string) => {
    setFotos(prev => prev.map(f => f.offlineId === offlineId ? { ...f, isUploading: false, uploadFalhou: true } : f));
    setVideos(prev => prev.map(v => v.offlineId === offlineId ? { ...v, isUploading: false, uploadFalhou: true } : v));
    setAnexos(prev => prev.map(a => a.offlineId === offlineId ? { ...a, isUploading: false, uploadFalhou: true } : a));
  };

  const removerPendenteLocal = (offlineId: string) => {
    setFotos(prev => prev.filter(f => f.offlineId !== offlineId));
    setVideos(prev => prev.filter(v => v.offlineId !== offlineId));
    setAnexos(prev => prev.filter(a => a.offlineId !== offlineId));
  };

  const syncOfflineFiles = async (rdoIdAlvo: string) => {
    if (!navigator.onLine || !rdoIdAlvo || !obraId) return;

    try {
      const realFiles = await getOfflineAttachments(rdoIdAlvo);
      const tempFiles = tempRdoId.current !== rdoIdAlvo ? await getOfflineAttachments(tempRdoId.current) : [];
      const filesToSync = [...realFiles, ...tempFiles];

      for (const item of filesToSync) {
        if (item.tentativas >= 3) {
          marcarFalhaLocal(item.id);
          continue;
        }

        marcarEnviandoLocal(item.id);

        const file = new File([item.dados], item.nomeArquivo, { type: item.mimeType });
        const formData = new FormData();
        formData.append('file', file);
        if (item.legenda) {
          formData.append('legenda', item.legenda);
        }

        try {
          const res = await api.post(`/upload/obra/${obraId}/rdo/${rdoIdAlvo}/fotos`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            timeout: 180000,
          });

          if (res.data?.anexo) {
             setSavedFiles(prev => {
               if (prev.some(a => a.id === res.data.anexo.id)) return prev;
               return [...prev, res.data.anexo];
             });
          }
          await deleteOfflineAttachment(item.id);
          removerPendenteLocal(item.id);
        } catch (err) {
          console.error('Erro de upload ao sincronizar:', err);
          await incrementarTentativa(item.id);
          marcarFalhaLocal(item.id);
        }
      }
    } catch (e) {
      console.error('Erro ao ler do IndexedDB para sincronização:', e);
    }
  };

  const handleSaveSavedFileLegenda = async (anexoId: string, value: string) => {
    if (!navigator.onLine) {
      showToast('⚠️ Sem conexão para salvar a legenda agora.');
      return;
    }
    try {
      await api.patch(`/anexos/${anexoId}`, { legenda: value });
      showToast('✏️ Legenda atualizada.');
    } catch (err) {
      console.error('Erro ao salvar legenda no servidor:', err);
      showToast('❌ Erro ao salvar legenda.');
    }
  };

  const handleDeletePendingFoto = async (idx: number, offlineId?: string) => {
    if (offlineId) {
      await deleteOfflineAttachment(offlineId);
    }
    setFotos(prev => prev.filter((_, i) => i !== idx));
  };

  const handleDeletePendingVideo = async (idx: number, offlineId?: string) => {
    if (offlineId) {
      await deleteOfflineAttachment(offlineId);
    }
    setVideos(prev => prev.filter((_, i) => i !== idx));
  };

  const handleDeletePendingAnexo = async (idx: number, offlineId?: string) => {
    if (offlineId) {
      await deleteOfflineAttachment(offlineId);
    }
    setAnexos(prev => prev.filter((_, i) => i !== idx));
  };

  const handleImportarBaseRdo = async () => {
    if (!selectedBaseRdoId || !obraId) return;
    try {
      const headers = { 'x-obra-id': obraId };
      const res = await api.get(`/rdos/${selectedBaseRdoId}`, { headers });
      const rdo = res.data;
      const extras = rdo.dadosExtras || {};

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
      setObservacoes(parseObservacoes(extras.observacoes || extras.observacoesGerais));

      let parsedAtividades: AtividadeExecutadaItem[] = [];
      const rawAtv = extras.atividadesExecutadas;
      if (typeof rawAtv === 'string') {
        parsedAtividades = rawAtv
          .split(/\r?\n/)
          .map(line => line.trim().replace(/^[-*•\d.]+\s*/, '').trim())
          .filter(Boolean)
          .map(line => ({ descricao: line, status: 'em andamento' as const }));
      } else if (Array.isArray(rawAtv)) {
        parsedAtividades = rawAtv;
      }
      setAtividadesExecutadas(parsedAtividades);
      setAtividadesPendentes(parseAtividadesPendentes(extras.atividadesPendentes));

      showToast('⚡ Dados importados com sucesso do RDO base!');
    } catch (err: any) {
      showToast('❌ Erro ao importar RDO base.');
    }
  };

  // ── Computed values ──
  const totalEfetivo = profissionais.reduce((s, p) => s + p.quantidade, 0);
  const totalAnexos = savedFiles.length + fotos.length + videos.length + anexos.length;

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
  const mediaRdoKey = () => rdoIdAtual || tempRdoId.current;

  const guessVideoMime = (file: File) => {
    if (file.type && file.type.startsWith('video/')) return file.type;
    const n = (file.name || '').toLowerCase();
    if (n.endsWith('.mov')) return 'video/quicktime';
    if (n.endsWith('.webm')) return 'video/webm';
    if (n.endsWith('.3gp')) return 'video/3gpp';
    if (n.endsWith('.m4v')) return 'video/x-m4v';
    if (n.endsWith('.mkv')) return 'video/x-matroska';
    if (n.endsWith('.avi')) return 'video/x-msvideo';
    return 'video/mp4';
  };

  /** Sempre grava mídia no IndexedDB (online ou offline) para não perder ao salvar sem rede. */
  const persistMediaFileToIdb = async (
    file: File,
    tipo: 'foto' | 'video' | 'anexo',
    legenda?: string,
  ): Promise<string> => {
    const offlineId = generateUUID();
    const buffer = await readFileAsArrayBuffer(file);
    const mimeType =
      tipo === 'video'
        ? guessVideoMime(file)
        : file.type || (tipo === 'foto' ? 'image/jpeg' : 'application/octet-stream');
    const nomeArquivo =
      file.name ||
      `${tipo}-${Date.now()}.${tipo === 'video' ? (mimeType === 'video/quicktime' ? 'mov' : 'mp4') : tipo === 'foto' ? 'jpg' : 'bin'}`;

    await saveOfflineAttachment({
      id: offlineId,
      rdoId: mediaRdoKey(),
      tipo,
      nomeArquivo,
      mimeType,
      dados: buffer,
      previewUrl: tipo === 'foto' ? URL.createObjectURL(file) : undefined,
      tentativas: 0,
      criadoEm: new Date().toISOString(),
      legenda: legenda || '',
    });
    return offlineId;
  };

  /** Garante que tudo que está só na memória também vá para o IndexedDB (antes de salvar offline). */
  const flushPendingMediaToIdb = async () => {
    const nextFotos = [...fotos];
    for (let i = 0; i < nextFotos.length; i++) {
      if (nextFotos[i].offlineId) continue;
      try {
        const offlineId = await persistMediaFileToIdb(
          nextFotos[i].file,
          'foto',
          nextFotos[i].legenda,
        );
        nextFotos[i] = {
          ...nextFotos[i],
          offlineId,
          isOfflinePending: true,
          uploadFalhou: false,
        };
      } catch (err) {
        console.error('Falha ao persistir foto local:', err);
      }
    }
    setFotos(nextFotos);

    const nextVideos = [...videos];
    for (let i = 0; i < nextVideos.length; i++) {
      if (nextVideos[i].offlineId) continue;
      try {
        const offlineId = await persistMediaFileToIdb(
          nextVideos[i].file,
          'video',
          nextVideos[i].legenda,
        );
        nextVideos[i] = {
          ...nextVideos[i],
          offlineId,
          isOfflinePending: true,
          uploadFalhou: false,
        };
      } catch (err) {
        console.error('Falha ao persistir vídeo local:', err);
      }
    }
    setVideos(nextVideos);

    const nextAnexos = [...anexos];
    for (let i = 0; i < nextAnexos.length; i++) {
      if (nextAnexos[i].offlineId) continue;
      try {
        const offlineId = await persistMediaFileToIdb(
          nextAnexos[i].file,
          'anexo',
          nextAnexos[i].descricao,
        );
        nextAnexos[i] = {
          ...nextAnexos[i],
          offlineId,
          isOfflinePending: true,
          uploadFalhou: false,
        };
      } catch (err) {
        console.error('Falha ao persistir anexo local:', err);
      }
    }
    setAnexos(nextAnexos);
  };

  const hydratePendingMediaFromIdb = useCallback(async () => {
    const keys = new Set<string>();
    keys.add(tempRdoId.current);
    if (rdoIdAtual) keys.add(rdoIdAtual);
    if (rdoId) keys.add(rdoId);

    const seen = new Set<string>();
    const loadedFotos: Foto[] = [];
    const loadedVideos: VideoFile[] = [];
    const loadedAnexos: Anexo[] = [];

    for (const key of keys) {
      const items = await getOfflineAttachments(key);
      for (const item of items) {
        if (seen.has(item.id)) continue;
        seen.add(item.id);
        const blob = new Blob([item.dados], { type: item.mimeType });
        const file = new File([blob], item.nomeArquivo, { type: item.mimeType });
        if (item.tipo === 'foto') {
          loadedFotos.push({
            file,
            preview: URL.createObjectURL(blob),
            legenda: item.legenda || '',
            offlineId: item.id,
            isOfflinePending: true,
            uploadFalhou: (item.tentativas || 0) >= 3,
          });
        } else if (item.tipo === 'video') {
          loadedVideos.push({
            file,
            legenda: item.legenda || '',
            offlineId: item.id,
            isOfflinePending: true,
            uploadFalhou: (item.tentativas || 0) >= 3,
          });
        } else {
          loadedAnexos.push({
            file,
            descricao: item.legenda || '',
            offlineId: item.id,
            isOfflinePending: true,
            uploadFalhou: (item.tentativas || 0) >= 3,
          });
        }
      }
    }

    if (loadedFotos.length) {
      setFotos((prev) => {
        const ids = new Set(prev.map((p) => p.offlineId).filter(Boolean));
        return [...prev, ...loadedFotos.filter((f) => !ids.has(f.offlineId))];
      });
    }
    if (loadedVideos.length) {
      setVideos((prev) => {
        const ids = new Set(prev.map((p) => p.offlineId).filter(Boolean));
        return [...prev, ...loadedVideos.filter((v) => !ids.has(v.offlineId))];
      });
    }
    if (loadedAnexos.length) {
      setAnexos((prev) => {
        const ids = new Set(prev.map((p) => p.offlineId).filter(Boolean));
        return [...prev, ...loadedAnexos.filter((a) => !ids.has(a.offlineId))];
      });
    }
  }, [rdoIdAtual, rdoId]);

  const handleFotosDrop = async (files: File[]) => {
    for (const file of files) {
      try {
        const preview = URL.createObjectURL(file);
        const offlineId = await persistMediaFileToIdb(file, 'foto');
        setFotos((prev) => [
          ...prev,
          {
            file,
            preview,
            legenda: '',
            offlineId,
            isOfflinePending: true,
            uploadFalhou: false,
          },
        ]);
      } catch (err) {
        console.error('Erro ao guardar foto no aparelho:', err);
        showToast('⚠️ Não foi possível guardar a foto no aparelho.');
      }
    }
  };
  const handleFotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter(
      (f) => f.type.startsWith('image/') || /\.(jpe?g|png|webp|heic|gif|bmp)$/i.test(f.name),
    );
    handleFotosDrop(files);
    e.target.value = '';
  };

  /** Upload pela câmera: também grava cópia no aparelho (galeria/arquivos). */
  const handleFotoCameraUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter(
      (f) => f.type.startsWith('image/') || /\.(jpe?g|png|webp|heic|gif|bmp)$/i.test(f.name),
    );
    e.target.value = '';
    if (files.length === 0) return;

    const result = await persistCapturedMediaList(files, 'image');
    handleFotosDrop(files);

    if (result === 'shared') {
      showToast('📷 Use "Salvar Imagem" para guardar na Galeria.');
    } else if (result === 'downloaded') {
      showToast('📷 Cópia da foto salva no aparelho.');
    } else if (result === 'failed') {
      showToast('⚠️ Não foi possível salvar a foto na Galeria do aparelho.');
    }
  };

  const handleVideosDrop = async (files: File[]) => {
    for (const file of files) {
      try {
        const mimeType = guessVideoMime(file);
        const nomeArquivo =
          file.name ||
          `video-${Date.now()}.${mimeType === 'video/quicktime' ? 'mov' : 'mp4'}`;
        const fileNorm = file.type
          ? file
          : new File([file], nomeArquivo, { type: mimeType });
        const offlineId = await persistMediaFileToIdb(fileNorm, 'video');
        setVideos((prev) => [
          ...prev,
          {
            file: fileNorm,
            legenda: '',
            offlineId,
            isOfflinePending: true,
            uploadFalhou: false,
          },
        ]);
      } catch (err) {
        console.error('Erro ao guardar vídeo no aparelho:', err);
        showToast('⚠️ Não foi possível guardar o vídeo no aparelho.');
      }
    }
  };
  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter(
      (f) => f.type.startsWith('video/') || /\.(mp4|mov|webm|avi|mkv|3gp)$/i.test(f.name),
    );
    handleVideosDrop(files);
    e.target.value = '';
  };

  /** Gravação pela câmera: também grava cópia no aparelho (galeria/arquivos). */
  const handleVideoCameraUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter(
      (f) => f.type.startsWith('video/') || /\.(mp4|mov|webm|avi|mkv|3gp)$/i.test(f.name),
    );
    e.target.value = '';
    if (files.length === 0) return;

    const result = await persistCapturedMediaList(files, 'video');
    handleVideosDrop(files);

    if (result === 'shared') {
      showToast('🎥 Use "Salvar Vídeo" para guardar na Galeria.');
    } else if (result === 'downloaded') {
      showToast('🎥 Cópia do vídeo salva no aparelho.');
    } else if (result === 'failed') {
      showToast('⚠️ Não foi possível salvar o vídeo na Galeria do aparelho.');
    }
  };

  const handleAnexosDrop = async (files: File[]) => {
    for (const file of files) {
      try {
        const offlineId = await persistMediaFileToIdb(file, 'anexo');
        setAnexos((prev) => [
          ...prev,
          {
            file,
            descricao: '',
            offlineId,
            isOfflinePending: true,
            uploadFalhou: false,
          },
        ]);
      } catch (err) {
        console.error('Erro ao guardar anexo no aparelho:', err);
        showToast('⚠️ Não foi possível guardar o documento no aparelho.');
      }
    }
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

  const persistDraftLocal = useCallback(async (opts?: { pendingSync?: boolean }) => {
    if (!obraId || isReadOnly || status !== 'rascunho') return;
    const pendingSync = opts?.pendingSync ?? draftPendingSync;
    const localKey = offlineDraftKey(obraId, rdoIdAtual);
    const draft: OfflineRdoDraft = {
      localKey,
      obraId,
      rdoId: rdoIdAtual,
      tempId: tempRdoId.current,
      dadosExtras: buildDadosExtras(),
      aprovadorId: aprovadorIdSelecionado || undefined,
      pendingSync,
      updatedAt: new Date().toISOString(),
      rdoNumberStr,
      nomeObra,
    };
    await saveOfflineRdoDraft(draft);
    setLastLocalSaveAt(draft.updatedAt);
    if (pendingSync) setDraftPendingSync(true);
  }, [
    obraId, isReadOnly, status, draftPendingSync, rdoIdAtual,
    aprovadorIdSelecionado, rdoNumberStr, nomeObra,
    data, responsavel, climaManha, climaTarde, climaNoite, tempMin, tempMax,
    pessoas, profissionais, materiais, equipamentos,
    atividadesExecutadas, atividadesPendentes, observacoes,
  ]);

  // Autosave contínuo no aparelho (protege perda sem sinal / fechamento acidental)
  useEffect(() => {
    if (!autosaveReady.current || !obraId || isReadOnly || status !== 'rascunho' || initLoading) return;
    const timer = window.setTimeout(() => {
      persistDraftLocal().catch((err) => console.warn('Autosave local falhou:', err));
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [
    persistDraftLocal, obraId, isReadOnly, status, initLoading,
    data, responsavel, climaManha, climaTarde, climaNoite, tempMin, tempMax,
    pessoas, profissionais, materiais, equipamentos,
    atividadesExecutadas, atividadesPendentes, observacoes, aprovadorIdSelecionado,
  ]);

  // Monitorar conexão e sincronizar rascunhos pendentes
  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => {
      setIsOnline(false);
      // Ao perder rede, força gravar mídias ainda só em memória
      flushPendingMediaToIdb().catch((err) =>
        console.warn('Flush offline de mídias falhou:', err),
      );
      persistDraftLocal({ pendingSync: true }).catch(() => undefined);
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [persistDraftLocal]);

  const syncPendingDraftToServer = useCallback(async (draft: OfflineRdoDraft) => {
    if (!draft.obraId || syncingDraftRef.current) return false;
    syncingDraftRef.current = true;
    try {
      const headers = { 'x-obra-id': draft.obraId };
      const dataRef = draft.dadosExtras?.data || new Date().toISOString().split('T')[0];
      let serverId = draft.rdoId;

      if (!serverId) {
        const res = await api.post('/rdos', { dataReferencia: dataRef, dadosExtras: draft.dadosExtras }, { headers });
        serverId = res.data.id;
        await updateRdoId(draft.tempId, serverId!);
        await deleteOfflineRdoDraft(draft.localKey);
        await saveOfflineRdoDraft({
          ...draft,
          localKey: offlineDraftKey(draft.obraId, serverId),
          rdoId: serverId!,
          pendingSync: false,
          updatedAt: new Date().toISOString(),
        });
        if (obraId === draft.obraId && (!rdoIdAtual || rdoIdAtual === draft.rdoId)) {
          setRdoIdAtual(serverId!);
          setDraftPendingSync(false);
          navigate(`/obras/${draft.obraId}/rdos/${serverId}`, { replace: true });
        }
      } else {
        await api.put(`/rdos/${serverId}/rascunho`, { dadosExtras: draft.dadosExtras }, { headers });
        await saveOfflineRdoDraft({
          ...draft,
          pendingSync: false,
          updatedAt: new Date().toISOString(),
        });
        if (rdoIdAtual === serverId) setDraftPendingSync(false);
      }

      await syncOfflineFiles(serverId!);
      return true;
    } catch (err) {
      console.error('Falha ao sincronizar rascunho offline:', err);
      return false;
    } finally {
      syncingDraftRef.current = false;
    }
  }, [obraId, rdoIdAtual, navigate]);

  useEffect(() => {
    if (!isOnline || !obraId) return;
    (async () => {
      try {
        const pending = await getPendingOfflineRdoDrafts();
        const mine = pending.filter((d) => d.obraId === obraId);
        if (mine.length === 0) return;
        let ok = 0;
        for (const draft of mine) {
          const synced = await syncPendingDraftToServer(draft);
          if (synced) ok += 1;
        }
        if (ok > 0) {
          showToast(`☁️ ${ok} rascunho(s) do aparelho sincronizado(s) com a plataforma.`);
          if (rdoIdAtual) await syncOfflineFiles(rdoIdAtual);
        }
      } catch (err) {
        console.warn('Sync automático de rascunhos falhou:', err);
      }
    })();
  }, [isOnline, obraId, rdoIdAtual, syncPendingDraftToServer, showToast]);

  // Restaura fotos/vídeos/docs pendentes do IndexedDB ao abrir o RDO
  useEffect(() => {
    if (initLoading || !obraId) return;
    let cancelled = false;
    (async () => {
      try {
        if (!cancelled) await hydratePendingMediaFromIdb();
      } catch (err) {
        console.warn('Falha ao restaurar mídias locais:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initLoading, obraId, rdoIdAtual, rdoId, hydratePendingMediaFromIdb]);

  const uploadMidas = async (rdoIdAlvo: string) => {
    if (!obraId) return;

    let successCount = 0;
    let failCount = 0;
    const novosAnexos: SavedFile[] = [];
    const totalFiles = fotos.length + videos.length + anexos.length;
    let fileIndex = 0;

    const fotosRestantes: typeof fotos = [];
    const videosRestantes: typeof videos = [];
    const anexosRestantes: typeof anexos = [];

    const uploadTimeoutMs = 180000; // 3 min — vídeos de celular

    // 1. Fotos
    for (const f of fotos) {
      fileIndex++;
      const formData = new FormData();
      formData.append('file', f.file);
      if (f.legenda) {
        formData.append('legenda', f.legenda);
      }
      try {
        setToast(`⏳ Fazendo upload das mídias... (${fileIndex}/${totalFiles})`);
        const res = await api.post(`/upload/obra/${obraId}/rdo/${rdoIdAlvo}/fotos`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: uploadTimeoutMs,
        });
        if (res.data?.anexo) {
          novosAnexos.push(res.data.anexo);
        }
        if (f.offlineId) {
          try {
            await deleteOfflineAttachment(f.offlineId);
          } catch { /* ignore */ }
        }
        successCount++;
      } catch (err: any) {
        console.error('Erro ao subir foto:', f.file.name, err);
        fotosRestantes.push(f);
        failCount++;
      }
    }

    // 2. Vídeos
    for (const v of videos) {
      fileIndex++;
      const formData = new FormData();
      // Garante MIME/nome úteis para iOS (.mov sem type)
      const rawName = v.file.name || `video-${Date.now()}.mp4`;
      const mime =
        v.file.type ||
        (rawName.toLowerCase().endsWith('.mov')
          ? 'video/quicktime'
          : rawName.toLowerCase().endsWith('.webm')
            ? 'video/webm'
            : 'video/mp4');
      const fileToSend =
        v.file.type === mime
          ? v.file
          : new File([v.file], rawName, { type: mime });
      formData.append('file', fileToSend);
      if (v.legenda) {
        formData.append('legenda', v.legenda);
      }
      try {
        setToast(`⏳ Fazendo upload das mídias... (${fileIndex}/${totalFiles})`);
        const res = await api.post(`/upload/obra/${obraId}/rdo/${rdoIdAlvo}/fotos`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: uploadTimeoutMs,
        });
        if (res.data?.anexo) {
          novosAnexos.push(res.data.anexo);
        }
        if (v.offlineId) {
          try {
            await deleteOfflineAttachment(v.offlineId);
          } catch { /* ignore */ }
        }
        successCount++;
      } catch (err: any) {
        console.error('Erro ao subir vídeo:', v.file.name, err);
        videosRestantes.push(v);
        failCount++;
      }
    }

    // 3. Anexos
    for (const a of anexos) {
      fileIndex++;
      const formData = new FormData();
      formData.append('file', a.file);
      if (a.descricao) {
        formData.append('legenda', a.descricao);
      }
      try {
        setToast(`⏳ Fazendo upload das mídias... (${fileIndex}/${totalFiles})`);
        const res = await api.post(`/upload/obra/${obraId}/rdo/${rdoIdAlvo}/fotos`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: uploadTimeoutMs,
        });
        if (res.data?.anexo) {
          novosAnexos.push(res.data.anexo);
        }
        if (a.offlineId) {
          try {
            await deleteOfflineAttachment(a.offlineId);
          } catch { /* ignore */ }
        }
        successCount++;
      } catch (err: any) {
        console.error('Erro ao subir anexo:', a.file.name, err);
        anexosRestantes.push(a);
        failCount++;
      }
    }

    // Só remove da fila o que realmente subiu
    setFotos(fotosRestantes);
    setVideos(videosRestantes);
    setAnexos(anexosRestantes);

    if (novosAnexos.length > 0) {
      setSavedFiles((prev) => [...prev, ...novosAnexos]);
    }

    if (successCount > 0) {
      setTimeout(
        () => showToast(`✅ ${successCount} arquivo(s) anexado(s) com sucesso!`),
        500,
      );
    }
    if (failCount > 0) {
      setTimeout(
        () =>
          showToast(
            `⚠️ ${failCount} arquivo(s) não foram enviados. Verifique a conexão e tente salvar de novo.`,
          ),
        800,
      );
    }
  };

  // ── Salvar Rascunho ──
  const handleSalvarRascunho = async () => {
    if (!obraId) return;
    setSaving(true);
    try {
      // Sem sinal: grava no aparelho e marca para sync posterior
      if (!navigator.onLine) {
        await flushPendingMediaToIdb();
        await persistDraftLocal({ pendingSync: true });
        const midias =
          fotos.length + videos.length + anexos.length;
        showToast(
          midias > 0
            ? `📴 Sem sinal — rascunho e ${midias} mídia(s) salvos no aparelho. Sincronizam ao voltar a conexão.`
            : '📴 Sem sinal — rascunho salvo no aparelho. Será enviado ao voltar a conexão.',
        );
        return;
      }

      const headers = { 'x-obra-id': obraId };
      const dadosExtras = buildDadosExtras();

      if (!rdoIdAtual) {
        // Criar RDO novo
        const res = await api.post('/rdos', { dataReferencia: data, dadosExtras }, { headers });
        const newId = res.data.id;
        setRdoIdAtual(newId);
        await updateRdoId(tempRdoId.current, newId);
        await uploadMidas(newId);
        await syncOfflineFiles(newId);
        await deleteOfflineRdoDraft(offlineDraftKey(obraId, null));
        await saveOfflineRdoDraft({
          localKey: offlineDraftKey(obraId, newId),
          obraId,
          rdoId: newId,
          tempId: tempRdoId.current,
          dadosExtras,
          aprovadorId: aprovadorIdSelecionado || undefined,
          pendingSync: false,
          updatedAt: new Date().toISOString(),
          rdoNumberStr,
          nomeObra,
        });
        setDraftPendingSync(false);
        navigate(`/obras/${obraId}/rdos/${newId}`, { replace: true });
        showToast('💾 Rascunho criado!');
      } else {
        // Atualizar rascunho existente
        await api.put(`/rdos/${rdoIdAtual}/rascunho`, { dadosExtras }, { headers });
        await uploadMidas(rdoIdAtual!);
        await syncOfflineFiles(rdoIdAtual!);
        await saveOfflineRdoDraft({
          localKey: offlineDraftKey(obraId, rdoIdAtual),
          obraId,
          rdoId: rdoIdAtual,
          tempId: tempRdoId.current,
          dadosExtras,
          aprovadorId: aprovadorIdSelecionado || undefined,
          pendingSync: false,
          updatedAt: new Date().toISOString(),
          rdoNumberStr,
          nomeObra,
        });
        setDraftPendingSync(false);
        showToast('💾 Rascunho salvo!');
      }
    } catch (err: any) {
      // Rede falhou no meio: salva localmente mesmo assim
      try {
        await flushPendingMediaToIdb();
        await persistDraftLocal({ pendingSync: true });
        showToast(
          '📴 Sem conexão estável — rascunho e mídias guardados no aparelho para sincronizar depois.',
        );
      } catch {
        showToast(`❌ Erro ao salvar: ${err?.response?.data?.message || 'tente novamente'}`);
      }
    } finally {
      setSaving(false);
    }
  };

  // ── Enviar para aprovação ──
  const handleEnviar = async () => {
    if (!obraId) return;
    if (!navigator.onLine) {
      await flushPendingMediaToIdb();
      await persistDraftLocal({ pendingSync: true });
      showToast(
        '📴 Sem sinal — rascunho e mídias salvos no aparelho. Conecte-se para enviar à aprovação.',
      );
      return;
    }
    setSaving(true);
    try {
      const headers = { 'x-obra-id': obraId };
      let idParaSubmeter = rdoIdAtual;

      // Salvar rascunho primeiro se ainda não existe
      if (!idParaSubmeter) {
        const res = await api.post('/rdos', { dataReferencia: data, dadosExtras: buildDadosExtras() }, { headers });
        idParaSubmeter = res.data.id;
        setRdoIdAtual(idParaSubmeter);
        await updateRdoId(tempRdoId.current, idParaSubmeter!);
        await deleteOfflineRdoDraft(offlineDraftKey(obraId, null));
      } else {
        await api.put(`/rdos/${idParaSubmeter}/rascunho`, { dadosExtras: buildDadosExtras() }, { headers });
      }

      await uploadMidas(idParaSubmeter!);
      await syncOfflineFiles(idParaSubmeter!);

      // Submeter com aprovador selecionado
      await api.put(`/rdos/${idParaSubmeter}/submeter`,
        { aprovadorIdSelecionado: aprovadorIdSelecionado || undefined },
        { headers },
      );
      setStatus('pendente');
      setDraftPendingSync(false);
      await deleteOfflineRdoDraft(offlineDraftKey(obraId, idParaSubmeter));
      showToast('📤 Enviado para aprovação!');
    } catch (err: any) {
      try {
        await persistDraftLocal({ pendingSync: true });
        showToast('📴 Falha de rede — rascunho guardado no aparelho. Tente enviar de novo com sinal.');
      } catch {
        showToast(`❌ ${err?.response?.data?.message || 'Erro ao enviar'}`);
      }
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

  // ── Reabrir (reabrir aprovado/submetido por gestor) ──
  const handleReabrir = async () => {
    if (!obraId || !rdoIdAtual) return;
    if (!window.confirm('Deseja realmente reabrir este RDO? Ele voltará para o status de Rascunho.')) return;
    try {
      setSaving(true);
      await api.put(`/rdos/${rdoIdAtual}/reabrir`, {}, { headers: { 'x-obra-id': obraId } });
      setStatus('rascunho');
      showToast('🔄 RDO reaberto com sucesso!');
      window.location.reload();
    } catch (err: any) {
      showToast(`❌ ${err?.response?.data?.message || 'Erro ao reabrir RDO'}`);
    } finally {
      setSaving(false);
    }
  };

  // ── Render Helpers (movidos para o escopo global) ──

  const renderWeatherShift = (label: string, stateVal: string, setter: (v: string) => void) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      <div className="relative">
        <select
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-lunardeli-red focus:border-lunardeli-red bg-white appearance-none text-gray-700 disabled:bg-gray-50 disabled:text-gray-500"
          value={stateVal}
          onChange={(e) => setter(e.target.value)}
          disabled={isReadOnly}
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
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => {
                const targetObraId = obraId || obraAtual?.id;
                if (targetObraId) {
                  navigate(`/obras/${targetObraId}/rdos`);
                } else {
                  navigate('/dashboard');
                }
              }}
              className="flex items-center gap-1.5 px-3 py-2 text-xs md:text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-red-50 hover:text-lunardeli-red rounded-lg transition-colors border border-gray-200 shrink-0"
              title="Voltar para a lista de RDOs"
            >
              <ArrowLeft size={16} />
              <span className="hidden sm:inline">Voltar para RDOs</span>
              <span className="sm:hidden">Voltar</span>
            </button>
            <div className="min-w-0">
              <h1 className="text-lg md:text-2xl font-bold text-gray-900 tracking-tight truncate">Diário de Obra</h1>
              <p className="text-xs md:text-sm text-gray-500 font-medium truncate">{initLoading ? 'Carregando...' : `${rdoNumberStr}`}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
            {!isOnline && (
              <span className="px-2.5 py-1 rounded-full text-[10px] md:text-xs font-bold border whitespace-nowrap bg-amber-50 text-amber-800 border-amber-200">
                SEM SINAL
              </span>
            )}
            {draftPendingSync && (
              <span className="px-2.5 py-1 rounded-full text-[10px] md:text-xs font-bold border whitespace-nowrap bg-blue-50 text-blue-800 border-blue-200">
                AGUARDANDO SYNC
              </span>
            )}
            {(fotos.length + videos.length + anexos.length) > 0 && status === 'rascunho' && (
              <span className="px-2.5 py-1 rounded-full text-[10px] md:text-xs font-bold border whitespace-nowrap bg-violet-50 text-violet-800 border-violet-200">
                {fotos.length + videos.length + anexos.length} MÍDIA(S) NO APARELHO
              </span>
            )}
            {isOnline && lastLocalSaveAt && !draftPendingSync && status === 'rascunho' && (
              <span className="hidden sm:inline px-2.5 py-1 rounded-full text-[10px] md:text-xs font-medium border whitespace-nowrap bg-gray-50 text-gray-500 border-gray-200">
                Cópia local ok
              </span>
            )}
            <span className={`px-2.5 py-1 rounded-full text-[10px] md:text-xs font-bold border whitespace-nowrap ${statusBadgeColor[status]}`}>
              {statusLabels[status].toUpperCase()}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-3 md:px-8 py-5 md:py-8 space-y-4 md:space-y-6">

        {/* Copiar RDO anterior */}
        {!rdoId && previousRdos.length > 0 && (
          <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-100 border-t-[3px] border-t-lunardeli-red/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-gray-800 text-sm">Copiar Dados de RDO Anterior</h3>
              <p className="text-xs text-gray-500 mt-0.5">Use um diário anterior desta obra como modelo para preencher este RDO.</p>
            </div>
            <div className="flex w-full sm:w-auto items-center gap-2">
              <select
                className="flex-1 sm:flex-initial border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-lunardeli-red focus:border-lunardeli-red bg-white appearance-none text-gray-700 font-medium outline-none"
                value={selectedBaseRdoId}
                onChange={(e) => setSelectedBaseRdoId(e.target.value)}
              >
                <option value="">Selecione um diário...</option>
                {previousRdos.map(r => (
                  <option key={r.id} value={r.id}>
                    RDO #{r.sequencial ?? r.id.slice(-6).toUpperCase()} ({format(parseUTCDate(r.dataReferencia), 'dd/MM/yyyy')})
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleImportarBaseRdo}
                disabled={!selectedBaseRdoId}
                className="bg-lunardeli-red hover:bg-red-700 active:bg-red-800 text-white font-bold px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-50 shrink-0 shadow-sm"
              >
                Importar
              </button>
            </div>
          </div>
        )}

        {/* Toolbar de Controle de Seções */}
        <div className="flex items-center justify-between px-1 py-1">
          <span className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Seções do Diário</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={expandAllSections}
              className="text-xs font-semibold text-gray-600 hover:text-lunardeli-red hover:bg-white px-2.5 py-1 rounded-lg border border-gray-200 shadow-sm transition-all flex items-center gap-1"
              title="Expandir todas as seções"
            >
              <Maximize2 size={13} /> Expandir todos
            </button>
            <button
              type="button"
              onClick={collapseAllSections}
              className="text-xs font-semibold text-gray-600 hover:text-lunardeli-red hover:bg-white px-2.5 py-1 rounded-lg border border-gray-200 shadow-sm transition-all flex items-center gap-1"
              title="Recolher todas as seções"
            >
              <Minimize2 size={13} /> Recolher todos
            </button>
          </div>
        </div>

        {/* 1. Informações */}
        <CollapsibleSection
          icon={ClipboardList}
          title="1. Informações gerais"
          isCollapsed={!!collapsedSections.sec1}
          onToggle={() => toggleSection('sec1')}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputField label="Data" type="date" value={data} onChange={(e: any) => setData(e.target.value)} disabled={isReadOnly} />
            <InputField label="Número RDO" value={rdoNumberStr} disabled />
            <div className="sm:col-span-2">
               <InputField label="Nome da obra" value={nomeObra} onChange={(e: any) => setNomeObra(e.target.value)} placeholder="Ex: Edifício Residencial Solar" disabled={isReadOnly} />
            </div>
            <div className="sm:col-span-2">
               <InputField label="Responsável técnico" value={responsavel} onChange={(e: any) => setResponsavel(e.target.value)} placeholder="Nome do engenheiro ou responsável" disabled={isReadOnly} />
            </div>
          </div>
        </CollapsibleSection>

        {/* 2. Condições Climáticas */}
        <CollapsibleSection
          icon={CloudSun}
          title="2. Condições climáticas"
          isCollapsed={!!collapsedSections.sec2}
          onToggle={() => toggleSection('sec2')}
        >
          <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 mb-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {renderWeatherShift('Manhã', climaManha, setClimaManha)}
            {renderWeatherShift('Tarde', climaTarde, setClimaTarde)}
            {renderWeatherShift('Noite', climaNoite, setClimaNoite)}
          </div>
          <div className="grid grid-cols-2 gap-4">
             <InputField label="Temperatura mínima (°C)" type="number" value={tempMin} onChange={(e: any) => setTempMin(e.target.value)} placeholder="Ex: 18" disabled={isReadOnly} />
             <InputField label="Temperatura máxima (°C)" type="number" value={tempMax} onChange={(e: any) => setTempMax(e.target.value)} placeholder="Ex: 32" disabled={isReadOnly} />
          </div>
        </CollapsibleSection>

        {/* 3. Presentes na vistoria */}
        {!isPartialView && (
          <CollapsibleSection
            icon={Users}
            title="3. Presentes na vistoria"
            isCollapsed={!!collapsedSections.sec3}
            onToggle={() => toggleSection('sec3')}
          >
            <div className="space-y-3">
              {pessoas.map((p, i) => (
                <div key={i} className="flex flex-col sm:flex-row gap-3 items-start sm:items-end p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <div className="flex-1 w-full"><InputField label="Nome" value={p.nome} onChange={(e: any) => handlePessoaChange(i, 'nome', e.target.value)} placeholder="Nome completo" disabled={isReadOnly} /></div>
                  <div className="flex-1 w-full"><InputField label="Função" value={p.funcao} onChange={(e: any) => handlePessoaChange(i, 'funcao', e.target.value)} placeholder="Ex: Engenheiro" disabled={isReadOnly} /></div>
                  <div className="flex-1 w-full"><InputField label="Empresa" value={p.empresa} onChange={(e: any) => handlePessoaChange(i, 'empresa', e.target.value)} placeholder="Ex: Obra 10" disabled={isReadOnly} /></div>
                  <button type="button" onClick={() => setPessoas(prev => prev.filter((_, idx) => idx !== i))} className="p-2 mb-0.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" disabled={isReadOnly}><Trash2 size={18} /></button>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => setPessoas(prev => [...prev, { nome: '', funcao: '', empresa: '' }])} className="mt-4 flex items-center gap-2 text-sm font-semibold text-lunardeli-red hover:text-red-700 disabled:opacity-50" disabled={isReadOnly}>
              <Plus size={16} /> Adicionar pessoa
            </button>
          </CollapsibleSection>
        )}

        {/* 4. Efetivo */}
        {!isPartialView && (
          <CollapsibleSection
            icon={Hammer}
            title="4. Efetivo de mão de obra"
            badge={<span className="ml-2 px-2.5 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">{totalEfetivo} trabalhadores</span>}
            isCollapsed={!!collapsedSections.sec4}
            onToggle={() => toggleSection('sec4')}
          >
            <div className="flex flex-col sm:flex-row gap-3 items-end mb-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
               <div className="flex-1 w-full">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Profissional</label>
                  <div className="relative">
                     <select
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-lunardeli-red focus:border-lunardeli-red bg-white appearance-none text-gray-700 disabled:bg-gray-50 disabled:text-gray-500"
                        value={selectedProfissional}
                        onChange={(e) => setSelectedProfissional(e.target.value)}
                        disabled={isReadOnly}
                     >
                        <option value="" disabled>Selecione um profissional...</option>
                        {catalogoProfissionais.filter(
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
                     <input type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-lunardeli-red outline-none disabled:bg-gray-50 disabled:text-gray-500" value={novoProfissional} onChange={e => setNovoProfissional(e.target.value)} placeholder="Ex: Operador de Munck" disabled={isReadOnly} />
                  </div>
               )}

               <div className="w-full sm:w-24">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Qtd</label>
                  <input type="number" min="1" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-lunardeli-red text-center outline-none disabled:bg-gray-50 disabled:text-gray-500" value={selectedQuantidade} onChange={e => setSelectedQuantidade(e.target.value)} disabled={isReadOnly} />
               </div>

               <button type="button" onClick={handleAddProfissional} disabled={isReadOnly || !selectedProfissional || (selectedProfissional === 'outro' && !novoProfissional.trim())} className="w-full sm:w-auto px-4 py-2 bg-lunardeli-red text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed">
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
                         <button onClick={() => handleProfQty(i, -1)} className="w-7 h-7 flex items-center justify-center bg-gray-50 border border-gray-300 rounded hover:bg-gray-100 text-gray-600 font-bold disabled:opacity-50 disabled:cursor-not-allowed" disabled={isReadOnly}>−</button>
                         <input type="number" min="0" value={p.quantidade} onChange={e => handleProfQtyDirect(i, e.target.value)} className="w-12 text-center text-sm font-semibold border border-gray-300 rounded py-1 outline-none focus:border-lunardeli-red disabled:bg-gray-50 disabled:text-gray-500" disabled={isReadOnly} />
                         <button onClick={() => handleProfQty(i, 1)} className="w-7 h-7 flex items-center justify-center bg-gray-50 border border-gray-300 rounded hover:bg-gray-100 text-gray-600 font-bold disabled:opacity-50 disabled:cursor-not-allowed" disabled={isReadOnly}>+</button>
                         <button onClick={() => setProfissionais(prev => prev.filter((_, idx) => idx !== i))} className="p-1.5 text-red-400 hover:text-red-500 rounded disabled:opacity-50" disabled={isReadOnly}><Trash2 size={16}/></button>
                      </div>
                   </div>
                ))}
             </div>
          </CollapsibleSection>
        )}

        {/* 5. Materiais e Equipamentos */}
        {!isPartialView && (
          <CollapsibleSection
            icon={Drill}
            title="5. Materiais e equipamentos"
            isCollapsed={!!collapsedSections.sec5}
            onToggle={() => toggleSection('sec5')}
          >
            <div className="mb-6">
              <h3 className="text-sm font-bold text-gray-800 mb-3">Materiais utilizados</h3>
              <div className="space-y-2">
                {materiais.map((m, i) => (
                  <div key={i} className="flex flex-col sm:flex-row gap-2 items-start sm:items-center p-3 bg-gray-50 border border-gray-200 rounded-lg">
                    <input 
                      className="flex-[2] min-w-0 border-gray-300 rounded px-3 py-1.5 text-sm outline-none focus:border-lunardeli-red border disabled:bg-gray-50" 
                      placeholder="Material..." 
                      value={m.material} 
                      onChange={e => {
                        const val = e.target.value;
                        handleMaterialChange(i, 'material', val);
                        const matched = catalogoMateriais.find(c => c.nome.toLowerCase() === val.toLowerCase());
                        if (matched?.unidade) {
                          handleMaterialChange(i, 'unidade', matched.unidade);
                        }
                      }} 
                      list="lista-catalogo-materiais"
                      disabled={isReadOnly} 
                    />
                    <datalist id="lista-catalogo-materiais">
                      {catalogoMateriais.map(mat => <option key={mat.id} value={mat.nome} />)}
                    </datalist>
                    <input className="w-full sm:w-20 border-gray-300 rounded px-2 py-1.5 text-sm outline-none focus:border-lunardeli-red border disabled:bg-gray-50" placeholder="Qtd" value={m.qtd} onChange={e => handleMaterialChange(i, 'qtd', e.target.value)} disabled={isReadOnly} />
                    <select className="w-full sm:w-24 border-gray-300 rounded px-2 py-1.5 text-sm outline-none focus:border-lunardeli-red border bg-white disabled:bg-gray-50" value={m.unidade} onChange={e => handleMaterialChange(i, 'unidade', e.target.value)} disabled={isReadOnly}>
                      {UNIDADES.map(u => <option key={u}>{u}</option>)}
                    </select>
                    <input className="flex-[2] min-w-0 border-gray-300 rounded px-3 py-1.5 text-sm outline-none focus:border-lunardeli-red border disabled:bg-gray-50" placeholder="Nota..." value={m.observacao} onChange={e => handleMaterialChange(i, 'observacao', e.target.value)} disabled={isReadOnly} />
                    <button onClick={() => setMateriais(prev => prev.filter((_, idx) => idx !== i))} className="p-1.5 text-red-500 hover:bg-red-50 rounded disabled:opacity-50" disabled={isReadOnly}><Trash2 size={16}/></button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => setMateriais(prev => [...prev, { material: '', qtd: '', unidade: 'un', observacao: '' }])} className="mt-3 text-sm font-semibold text-lunardeli-red hover:text-red-700 disabled:opacity-50" disabled={isReadOnly}>+ Adicionar material</button>
            </div>
            <div>
               <h3 className="text-sm font-bold text-gray-800 mb-3">Equipamentos do dia</h3>
               <div className="space-y-2">
                 {equipamentos.map((eq, i) => (
                    <div key={i} className="flex flex-col sm:flex-row gap-2 items-start sm:items-center p-3 bg-gray-50 border border-gray-200 rounded-lg">
                       <input 
                          className="flex-[2] min-w-0 border-gray-300 rounded px-3 py-1.5 text-sm outline-none focus:border-lunardeli-red border disabled:bg-gray-50" 
                          placeholder="Equipamento..." 
                          value={eq.equipamento} 
                          onChange={e => handleEquipChange(i, 'equipamento', e.target.value)} 
                          list="lista-catalogo-equipamentos"
                          disabled={isReadOnly} 
                       />
                       <datalist id="lista-catalogo-equipamentos">
                          {catalogoEquipamentos.map(eqItem => <option key={eqItem.id} value={eqItem.nome} />)}
                       </datalist>
                       <input className="w-full sm:w-24 border-gray-300 rounded px-2 py-1.5 text-sm outline-none focus:border-lunardeli-red border disabled:bg-gray-50" placeholder="Qtd" value={eq.qtd} onChange={e => handleEquipChange(i, 'qtd', e.target.value)} disabled={isReadOnly} />
                       <select className="w-full sm:flex-[1] border-gray-300 rounded px-2 py-1.5 text-sm outline-none focus:border-lunardeli-red border bg-white disabled:bg-gray-50" value={eq.status} onChange={e => handleEquipChange(i, 'status', e.target.value)} disabled={isReadOnly}>
                          {EQUIP_STATUS.map(s => <option key={s}>{s}</option>)}
                       </select>
                       <button onClick={() => setEquipamentos(prev => prev.filter((_, idx) => idx !== i))} className="p-1.5 text-red-500 hover:bg-red-50 rounded disabled:opacity-50" disabled={isReadOnly}><Trash2 size={16}/></button>
                    </div>
                 ))}
               </div>
               <button type="button" onClick={() => setEquipamentos(prev => [...prev, { equipamento: '', qtd: '', status: 'Operando' }])} className="mt-3 text-sm font-semibold text-lunardeli-red hover:text-red-700 disabled:opacity-50" disabled={isReadOnly}>+ Adicionar equipamento</button>
             </div>
          </CollapsibleSection>
        )}

        {/* 6 & 7. Atividades */}
        <div className="flex flex-col gap-6">
           <CollapsibleSection
             icon={CheckSquare}
             title="6. Atividades Executadas"
             isCollapsed={!!collapsedSections.sec6}
             onToggle={() => toggleSection('sec6')}
           >
             <div className="space-y-3">
               {atividadesExecutadas.map((atv, i) => (
                  <div key={i} className="flex flex-col sm:flex-row gap-2 items-start p-3 bg-gray-50 border border-gray-200 rounded-lg">
                    <AutoResizeTextarea
                      minRows={2}
                      className="flex-1 min-w-0 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-lunardeli-red focus:border-lunardeli-red bg-white"
                      placeholder="Descrição detalhada da atividade executada..."
                      value={atv.descricao}
                      onChange={e => {
                        const newVal = e.target.value;
                        setAtividadesExecutadas(prev => prev.map((item, idx) => idx === i ? { ...item, descricao: newVal } : item));
                      }}
                      disabled={isReadOnly}
                    />
                    <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 pt-0.5">
                   <select 
                     className="w-full sm:w-40 border border-gray-300 rounded px-2 py-1.5 text-sm outline-none focus:border-lunardeli-red bg-white text-gray-700 font-medium" 
                     value={atv.status} 
                     onChange={e => {
                       const newVal = e.target.value as 'em andamento' | 'pausado' | 'finalizada';
                       setAtividadesExecutadas(prev => prev.map((item, idx) => idx === i ? { ...item, status: newVal } : item));
                     }}
                     disabled={isReadOnly}
                   >
                     <option value="em andamento">Em andamento</option>
                     <option value="pausado">Pausado</option>
                     <option value="finalizada">Finalizada</option>
                   </select>
                   <button 
                     type="button"
                     onClick={() => setAtividadesExecutadas(prev => prev.filter((_, idx) => idx !== i))} 
                     className="p-1.5 text-red-500 hover:bg-red-50 rounded self-end sm:self-auto shrink-0"
                     title="Remover atividade"
                     disabled={isReadOnly}
                   >
                     <Trash2 size={16}/>
                   </button>
                 </div>
                  </div>
                ))}
               {atividadesExecutadas.length === 0 && (
                 <div className="text-center py-6 border-2 border-dashed border-gray-200 rounded-lg text-gray-400 text-sm">
                   Nenhuma atividade adicionada. Clique abaixo para acrescentar.
                 </div>
               )}
               <button 
                 type="button" 
                 onClick={() => setAtividadesExecutadas(prev => [...prev, { descricao: '', status: 'em andamento' }])} 
                 className="text-sm font-semibold text-lunardeli-red hover:text-red-700 flex items-center gap-1 mt-1 disabled:opacity-50"
                 disabled={isReadOnly}
               >
                 + Adicionar atividade
               </button>
             </div>
           </CollapsibleSection>
           
           {!isPartialView && (
             <CollapsibleSection
               icon={MessageSquare}
               title="7. Observações gerais"
               isCollapsed={!!collapsedSections.sec7}
               onToggle={() => toggleSection('sec7')}
             >
               <div className="space-y-3">
                 {observacoes.map((obs, i) => (
                   <div key={i} className="flex flex-col sm:flex-row gap-2 items-start p-3 bg-gray-50 border border-gray-200 rounded-lg">
                     <AutoResizeTextarea
                       minRows={2}
                       className="flex-1 min-w-0 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-lunardeli-red focus:border-lunardeli-red bg-white"
                       placeholder="Detalhes adicionais, comentários, paralisações..."
                       value={obs.descricao}
                       onChange={e => {
                         const newVal = e.target.value;
                         setObservacoes(prev => prev.map((item, idx) => idx === i ? { ...item, descricao: newVal } : item));
                       }}
                       disabled={isReadOnly}
                     />
                     <button
                       type="button"
                       onClick={() => setObservacoes(prev => prev.filter((_, idx) => idx !== i))}
                       className="p-1.5 text-red-500 hover:bg-red-50 rounded shrink-0"
                       title="Remover observação"
                       disabled={isReadOnly}
                     >
                       <Trash2 size={16}/>
                     </button>
                   </div>
                 ))}
                 {observacoes.length === 0 && (
                   <div className="text-center py-6 border-2 border-dashed border-gray-200 rounded-lg text-gray-400 text-sm">
                     Nenhuma observação adicionada. Clique abaixo para acrescentar.
                   </div>
                 )}
                 <button
                   type="button"
                   onClick={() => setObservacoes(prev => [...prev, { descricao: '' }])}
                   className="text-sm font-semibold text-lunardeli-red hover:text-red-700 flex items-center gap-1 mt-1 disabled:opacity-50"
                   disabled={isReadOnly}
                 >
                   + Adicionar observação
                 </button>
               </div>
             </CollapsibleSection>
           )}

           {!isPartialView && (
             <CollapsibleSection
               icon={FileSpreadsheet}
               title="8. Atividades Pendentes"
               isCollapsed={!!collapsedSections.sec8}
               onToggle={() => toggleSection('sec8')}
             >
               <div className="space-y-3">
                 {atividadesPendentes.map((atv, i) => (
                   <div key={i} className="flex flex-col gap-2 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                     <div className="flex flex-col sm:flex-row gap-2 items-start">
                       <AutoResizeTextarea
                         minRows={2}
                         className="flex-1 min-w-0 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-lunardeli-red focus:border-lunardeli-red bg-white"
                         placeholder="Descrição da atividade pendente..."
                         value={atv.descricao}
                         onChange={e => {
                           const newVal = e.target.value;
                           setAtividadesPendentes(prev => prev.map((item, idx) => idx === i ? { ...item, descricao: newVal } : item));
                         }}
                         disabled={isReadOnly}
                       />
                       <button
                         type="button"
                         onClick={() => setAtividadesPendentes(prev => prev.filter((_, idx) => idx !== i))}
                         className="p-1.5 text-red-500 hover:bg-red-50 rounded shrink-0"
                         title="Remover atividade pendente"
                         disabled={isReadOnly}
                       >
                         <Trash2 size={16}/>
                       </button>
                     </div>
                     <input
                       className="w-full sm:w-72 border border-gray-300 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-lunardeli-red focus:border-lunardeli-red bg-white disabled:bg-gray-50"
                       placeholder="Responsável pela atividade..."
                       value={atv.responsavel}
                       onChange={e => {
                         const newVal = e.target.value;
                         setAtividadesPendentes(prev => prev.map((item, idx) => idx === i ? { ...item, responsavel: newVal } : item));
                       }}
                       disabled={isReadOnly}
                     />
                   </div>
                 ))}
                 {atividadesPendentes.length === 0 && (
                   <div className="text-center py-6 border-2 border-dashed border-gray-200 rounded-lg text-gray-400 text-sm">
                     Nenhuma atividade pendente. Clique abaixo para acrescentar.
                   </div>
                 )}
                 <button
                   type="button"
                   onClick={() => setAtividadesPendentes(prev => [...prev, { descricao: '', responsavel: '' }])}
                   className="text-sm font-semibold text-lunardeli-red hover:text-red-700 flex items-center gap-1 mt-1 disabled:opacity-50"
                   disabled={isReadOnly}
                 >
                   + Adicionar atividade pendente
                 </button>
               </div>
             </CollapsibleSection>
           )}
        </div>

        {/* 9. Mídias e Anexos */}
        {!isPartialView && (
          <CollapsibleSection
            icon={Paperclip}
            title="9. Mídias e Anexos"
            isCollapsed={!!collapsedSections.sec9}
            onToggle={() => toggleSection('sec9')}
          >
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
               {/* Fotos */}
               <div 
                  className="bg-gray-50 border border-gray-200 rounded-xl p-4 transition-colors hover:border-lunardeli-red border-dashed drag-active:bg-red-50"
                  onDragOver={onDragOver}
                  onDrop={(e) => { e.preventDefault(); if (isReadOnly) return; handleFotosDrop(Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'))); }}
               >
                  <div className="flex justify-between items-center mb-4 relative">
                     <h3 className="font-bold text-gray-800 flex items-center gap-1.5"><ImageIcon size={16}/> Fotos</h3>
                     <input type="file" accept="image/*" ref={fotoCameraInputRef} className="hidden" onChange={handleFotoCameraUpload} capture="environment" />
                     <input type="file" multiple accept="image/*" ref={fotoGalleryInputRef} className="hidden" onChange={handleFotoUpload} />
                     <input type="file" multiple accept=".jpg,.jpeg,.png,.webp,.heic,.gif,image/*" ref={fotoFilesInputRef} className="hidden" onChange={handleFotoUpload} />
                     <button
                       type="button"
                       onClick={() => setMediaPicker(prev => prev === 'foto' ? null : 'foto')}
                       className="text-xs font-semibold text-lunardeli-red hover:underline disabled:opacity-50"
                       disabled={isReadOnly}
                     >
                       + Upload
                     </button>
                     {mediaPicker === 'foto' && (
                       <>
                         <button type="button" className="fixed inset-0 z-[90] bg-black/30" aria-label="Fechar" onClick={() => setMediaPicker(null)} />
                         <div className="absolute right-0 top-8 z-[100] w-56 rounded-xl bg-white shadow-xl border border-gray-100 overflow-hidden divide-y divide-gray-50">
                           <button
                             type="button"
                             className="w-full flex items-center gap-2.5 px-3.5 py-3 text-left text-sm text-gray-800 hover:bg-gray-50"
                             onClick={() => { setMediaPicker(null); fotoCameraInputRef.current?.click(); }}
                           >
                             <Camera size={16} className="text-lunardeli-red shrink-0" />
                             <span>
                               <span className="font-semibold block">Tirar foto</span>
                               <span className="text-[11px] text-gray-500">Abrir a câmera</span>
                             </span>
                           </button>
                           <button
                             type="button"
                             className="w-full flex items-center gap-2.5 px-3.5 py-3 text-left text-sm text-gray-800 hover:bg-gray-50"
                             onClick={() => { setMediaPicker(null); fotoGalleryInputRef.current?.click(); }}
                           >
                             <Images size={16} className="text-lunardeli-red shrink-0" />
                             <span>
                               <span className="font-semibold block">Galeria</span>
                               <span className="text-[11px] text-gray-500">Fotos do aparelho</span>
                             </span>
                           </button>
                           <button
                             type="button"
                             className="w-full flex items-center gap-2.5 px-3.5 py-3 text-left text-sm text-gray-800 hover:bg-gray-50"
                             onClick={() => { setMediaPicker(null); fotoFilesInputRef.current?.click(); }}
                           >
                             <FolderOpen size={16} className="text-lunardeli-red shrink-0" />
                             <span>
                               <span className="font-semibold block">Arquivos / nuvem</span>
                               <span className="text-[11px] text-gray-500">Pastas, Drive, etc.</span>
                             </span>
                           </button>
                         </div>
                       </>
                     )}
                  </div>
                  <div className="space-y-3">
                     {/* Saved Fotos */}
                     {savedFiles.filter(a => a.mimeType?.startsWith('image/')).map((sf) => (
                        <div key={sf.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden flex flex-col relative group">
                           <a href={getFileUrl(sf.urlS3)} target="_blank" rel="noopener noreferrer">
                              <img src={getFileUrl(sf.urlS3)} alt={sf.nomeOriginal || 'Foto'} className="w-full h-24 object-cover hover:opacity-90 transition-opacity" />
                           </a>
                           <div className="p-2 flex flex-col gap-1.5 bg-green-50 border-t border-gray-100">
                              <div className="flex items-center gap-1.5 w-full">
                                 <input 
                                    className="flex-1 text-xs px-2 py-1 border rounded bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-lunardeli-red" 
                                    placeholder="Legenda..." 
                                    value={sf.nomeOriginal || ''} 
                                    onChange={e => {
                                       const newVal = e.target.value;
                                       setSavedFiles(prev => prev.map(item => item.id === sf.id ? { ...item, nomeOriginal: newVal } : item));
                                    }}
                                    onBlur={() => handleSaveSavedFileLegenda(sf.id, sf.nomeOriginal)}
                                    onKeyDown={e => {
                                       if (e.key === 'Enter') {
                                          (e.target as HTMLInputElement).blur();
                                       }
                                    }}
                                    disabled={isReadOnly} 
                                 />
                                 <button onClick={() => handleDeleteAnexo(sf.id)} className="text-red-500 p-1 hover:bg-red-50 rounded transition-colors disabled:opacity-50" title="Excluir do RDO" disabled={isReadOnly}><Trash2 size={14}/></button>
                              </div>
                           </div>
                        </div>
                     ))}
                     {/* Pending Fotos */}
                     {fotos.map((f, i) => (
                        <div key={f.offlineId || i} className="bg-white border border-gray-200 rounded-lg overflow-hidden flex flex-col relative">
                           <img src={f.preview} alt="" className="w-full h-24 object-cover" />
                           {/* Offline badge overlay */}
                           {f.isOfflinePending && (
                              <div className="absolute top-1 left-1 right-1 flex flex-col gap-1 z-10">
                                 {!f.isUploading && !f.uploadFalhou && (
                                    <div className="flex items-center justify-center gap-1 bg-amber-500 text-white text-[10px] font-black uppercase px-1.5 py-1 rounded shadow border border-amber-600">
                                       <span>☁️</span>
                                       <span>Offline</span>
                                    </div>
                                 )}
                                 {f.isUploading && (
                                    <div className="flex items-center justify-center gap-1 bg-blue-500 text-white text-[10px] font-black uppercase px-1.5 py-1 rounded shadow border border-blue-600 animate-pulse">
                                       <span className="animate-spin mr-0.5">🔄</span>
                                       <span>Enviando</span>
                                    </div>
                                 )}
                                 {f.uploadFalhou && (
                                    <div className="flex flex-col gap-1 items-center justify-center bg-red-600 text-white text-[10px] font-black uppercase px-1.5 py-1 rounded shadow border border-red-700">
                                       <div className="flex items-center gap-1">
                                          <span>⚠️</span>
                                          <span>Falha</span>
                                       </div>
                                       <button
                                          onClick={(e) => { e.preventDefault(); syncOfflineFiles(rdoIdAtual || tempRdoId.current); }}
                                          className="mt-0.5 bg-white text-red-600 px-2 py-0.5 rounded text-[8px] font-black hover:bg-gray-100 transition-colors shadow-sm"
                                       >
                                          Tentar
                                       </button>
                                    </div>
                                 )}
                              </div>
                           )}
                           <div className="p-2 flex gap-1 items-center bg-gray-50">
                              <input className="flex-1 text-xs px-2 py-1 border rounded" placeholder="Legenda..." value={f.legenda} onChange={async e => {
                                  const newVal = e.target.value;
                                  setFotos(prev => prev.map((item, idx) => idx === i ? { ...item, legenda: newVal } : item));
                                  if (f.offlineId) {
                                     await updateOfflineAttachmentLegenda(f.offlineId, newVal);
                                  }
                               }} disabled={isReadOnly} />
                              <button onClick={() => handleDeletePendingFoto(i, f.offlineId)} className="text-red-500 p-1 disabled:opacity-50" disabled={isReadOnly}><Trash2 size={14}/></button>
                           </div>
                        </div>
                     ))}
                     {savedFiles.filter(a => a.mimeType?.startsWith('image/')).length === 0 && fotos.length === 0 && (
                        <div className="text-xs text-center text-gray-400 py-4 border-2 border-dashed border-gray-200 rounded-lg">Nenhuma foto</div>
                     )}
                  </div>
               </div>

               {/* Videos */}
               <div 
                  className="bg-gray-50 border border-gray-200 rounded-xl p-4 transition-colors hover:border-lunardeli-red border-dashed"
                  onDragOver={onDragOver}
                  onDrop={(e) => { e.preventDefault(); if (isReadOnly) return; handleVideosDrop(Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('video/'))); }}
               >
                  <div className="flex justify-between items-center mb-4 relative">
                     <h3 className="font-bold text-gray-800 flex items-center gap-1.5"><Video size={16}/> Vídeos</h3>
                     <input type="file" accept="video/*" ref={videoCameraInputRef} className="hidden" onChange={handleVideoCameraUpload} capture="environment" />
                     <input type="file" multiple accept="video/*" ref={videoGalleryInputRef} className="hidden" onChange={handleVideoUpload} />
                     <input type="file" multiple accept=".mp4,.mov,.webm,.avi,.mkv,.3gp,video/*" ref={videoFilesInputRef} className="hidden" onChange={handleVideoUpload} />
                     <button
                       type="button"
                       onClick={() => setMediaPicker(prev => prev === 'video' ? null : 'video')}
                       className="text-xs font-semibold text-lunardeli-red hover:underline disabled:opacity-50"
                       disabled={isReadOnly}
                     >
                       + Upload
                     </button>
                     {mediaPicker === 'video' && (
                       <>
                         <button type="button" className="fixed inset-0 z-[90] bg-black/30" aria-label="Fechar" onClick={() => setMediaPicker(null)} />
                         <div className="absolute right-0 top-8 z-[100] w-56 rounded-xl bg-white shadow-xl border border-gray-100 overflow-hidden divide-y divide-gray-50">
                           <button
                             type="button"
                             className="w-full flex items-center gap-2.5 px-3.5 py-3 text-left text-sm text-gray-800 hover:bg-gray-50"
                             onClick={() => { setMediaPicker(null); videoCameraInputRef.current?.click(); }}
                           >
                             <Camera size={16} className="text-lunardeli-red shrink-0" />
                             <span>
                               <span className="font-semibold block">Gravar vídeo</span>
                               <span className="text-[11px] text-gray-500">Abrir a câmera</span>
                             </span>
                           </button>
                           <button
                             type="button"
                             className="w-full flex items-center gap-2.5 px-3.5 py-3 text-left text-sm text-gray-800 hover:bg-gray-50"
                             onClick={() => { setMediaPicker(null); videoGalleryInputRef.current?.click(); }}
                           >
                             <Images size={16} className="text-lunardeli-red shrink-0" />
                             <span>
                               <span className="font-semibold block">Galeria</span>
                               <span className="text-[11px] text-gray-500">Vídeos do aparelho</span>
                             </span>
                           </button>
                           <button
                             type="button"
                             className="w-full flex items-center gap-2.5 px-3.5 py-3 text-left text-sm text-gray-800 hover:bg-gray-50"
                             onClick={() => { setMediaPicker(null); videoFilesInputRef.current?.click(); }}
                           >
                             <FolderOpen size={16} className="text-lunardeli-red shrink-0" />
                             <span>
                               <span className="font-semibold block">Arquivos / nuvem</span>
                               <span className="text-[11px] text-gray-500">Pastas, Drive, etc.</span>
                             </span>
                           </button>
                         </div>
                       </>
                     )}
                  </div>
                  <div className="space-y-2">
                     {/* Saved Videos */}
                     {savedFiles.filter(a => a.mimeType?.startsWith('video/')).map((sf) => (
                        <div key={sf.id} className="bg-white border border-gray-200 p-2 rounded-lg flex flex-col gap-2 bg-green-50/40">
                           <div className="flex items-center justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                 <a href={getFileUrl(sf.urlS3)} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-blue-600 hover:underline truncate block">
                                    🎥 Visualizar Vídeo
                                 </a>
                              </div>
                              <button onClick={() => handleDeleteAnexo(sf.id)} className="text-red-500 p-1 hover:bg-red-50 rounded transition-colors disabled:opacity-50" disabled={isReadOnly}><Trash2 size={14}/></button>
                           </div>
                           <input 
                              className="w-full text-xs px-2 py-1 border border-gray-200 rounded bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-lunardeli-red" 
                              placeholder="Legenda..." 
                              value={sf.nomeOriginal || ''} 
                              onChange={e => {
                                 const newVal = e.target.value;
                                 setSavedFiles(prev => prev.map(item => item.id === sf.id ? { ...item, nomeOriginal: newVal } : item));
                              }}
                              onBlur={() => handleSaveSavedFileLegenda(sf.id, sf.nomeOriginal)}
                              onKeyDown={e => {
                                 if (e.key === 'Enter') {
                                    (e.target as HTMLInputElement).blur();
                                 }
                              }}
                              disabled={isReadOnly} 
                           />
                        </div>
                     ))}
                     {/* Pending Videos */}
                     {videos.map((v, i) => (
                        <div key={v.offlineId || i} className="bg-white border border-gray-200 p-2 rounded-lg flex flex-col gap-2 relative">
                           <div className="flex items-center justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                 <p className="text-xs font-medium truncate">{v.file.name}</p>
                                 <input className="w-full text-xs px-1.5 py-1 border border-gray-100 rounded mt-1 bg-gray-50" placeholder="Legenda..." value={v.legenda} onChange={async e => {
                                  const newVal = e.target.value;
                                  setVideos(prev => prev.map((item, idx) => idx === i ? { ...item, legenda: newVal } : item));
                                  if (v.offlineId) {
                                     await updateOfflineAttachmentLegenda(v.offlineId, newVal);
                                  }
                               }} disabled={isReadOnly} />
                              </div>
                              <button onClick={() => handleDeletePendingVideo(i, v.offlineId)} className="text-red-500 p-1 disabled:opacity-50" disabled={isReadOnly}><Trash2 size={14}/></button>
                           </div>
                           {/* Offline badge */}
                           {v.isOfflinePending && (
                              <div className="w-full flex items-center justify-between gap-2 border-t border-gray-100 pt-1.5">
                                 {!v.isUploading && !v.uploadFalhou && (
                                    <div className="w-full flex items-center justify-center gap-1 bg-amber-500 text-white text-[10px] font-black uppercase py-0.5 rounded shadow border border-amber-600">
                                       <span>☁️ Offline</span>
                                    </div>
                                 )}
                                 {v.isUploading && (
                                    <div className="w-full flex items-center justify-center gap-1 bg-blue-500 text-white text-[10px] font-black uppercase py-0.5 rounded shadow border border-blue-600 animate-pulse">
                                       <span className="animate-spin mr-0.5">🔄</span>
                                       <span>Enviando</span>
                                    </div>
                                 )}
                                 {v.uploadFalhou && (
                                    <div className="w-full flex flex-col gap-1 items-center justify-center bg-red-600 text-white text-[10px] font-black uppercase py-1 rounded shadow border border-red-700">
                                       <div className="flex items-center gap-1">
                                          <span>⚠️ Falha</span>
                                       </div>
                                       <button
                                          onClick={(e) => { e.preventDefault(); syncOfflineFiles(rdoIdAtual || tempRdoId.current); }}
                                          className="bg-white text-red-600 px-2 py-0.5 rounded text-[8px] font-black hover:bg-gray-100 transition-colors shadow-sm"
                                       >
                                          Tentar
                                       </button>
                                    </div>
                                 )}
                              </div>
                           )}
                        </div>
                     ))}
                     {savedFiles.filter(a => a.mimeType?.startsWith('video/')).length === 0 && videos.length === 0 && (
                        <div className="text-xs text-center text-gray-400 py-4 border-2 border-dashed border-gray-200 rounded-lg">Nenhum vídeo</div>
                     )}
                  </div>
               </div>

               {/* Documentos */}
               <div 
                  className="bg-gray-50 border border-gray-200 rounded-xl p-4 transition-colors hover:border-lunardeli-red border-dashed"
                  onDragOver={onDragOver}
                  onDrop={(e) => { e.preventDefault(); if (isReadOnly) return; handleAnexosDrop(Array.from(e.dataTransfer.files)); }}
               >
                  <div className="flex justify-between items-center mb-4">
                     <h3 className="font-bold text-gray-800 flex items-center gap-1.5"><FileText size={16}/> Outros anexos</h3>
                     <input type="file" multiple ref={anexoInputRef} className="hidden" onChange={handleAnexoUpload} />
                     <button onClick={() => anexoInputRef.current?.click()} className="text-xs font-semibold text-lunardeli-red hover:underline disabled:opacity-50" disabled={isReadOnly}>+ Upload</button>
                  </div>
                  <div className="space-y-2">
                     {/* Saved Documentos */}
                     {savedFiles.filter(a => !a.mimeType?.startsWith('image/') && !a.mimeType?.startsWith('video/')).map((sf) => (
                        <div key={sf.id} className="bg-white border border-gray-200 p-2 rounded-lg flex flex-col gap-2 bg-green-50/40">
                           <div className="flex items-center justify-between gap-2">
                              <span className="shrink-0 bg-blue-100 text-blue-700 text-[10px] font-bold px-1.5 py-0.5 rounded">
                                 {getFileExt(sf.urlS3 || sf.nomeOriginal || 'FILE')}
                              </span>
                              <div className="flex-1 min-w-0">
                                 <a href={getFileUrl(sf.urlS3)} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-blue-600 hover:underline truncate block">
                                    Ver Documento
                                 </a>
                              </div>
                              <button onClick={() => handleDeleteAnexo(sf.id)} className="text-red-500 p-1 hover:bg-red-50 rounded transition-colors disabled:opacity-50" disabled={isReadOnly}><Trash2 size={14}/></button>
                           </div>
                           <input 
                              className="w-full text-xs px-2 py-1 border border-gray-200 rounded bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-lunardeli-red" 
                              placeholder="Legenda..." 
                              value={sf.nomeOriginal || ''} 
                              onChange={e => {
                                 const newVal = e.target.value;
                                 setSavedFiles(prev => prev.map(item => item.id === sf.id ? { ...item, nomeOriginal: newVal } : item));
                              }}
                              onBlur={() => handleSaveSavedFileLegenda(sf.id, sf.nomeOriginal)}
                              onKeyDown={e => {
                                 if (e.key === 'Enter') {
                                    (e.target as HTMLInputElement).blur();
                                 }
                              }}
                              disabled={isReadOnly} 
                           />
                        </div>
                     ))}
                     {/* Pending Documentos */}
                     {anexos.map((a, i) => (
                        <div key={a.offlineId || i} className="bg-white border border-gray-200 p-2 rounded-lg flex flex-col gap-2 relative">
                           <div className="flex items-center justify-between gap-2">
                              <span className="shrink-0 bg-blue-100 text-blue-700 text-[10px] font-bold px-1.5 py-0.5 rounded">{getFileExt(a.file.name)}</span>
                              <div className="flex-1 min-w-0">
                                 <p className="text-xs font-medium truncate">{a.file.name}</p>
                                 <input className="w-full text-xs px-1.5 py-1 border border-gray-100 rounded mt-1 bg-gray-50" placeholder="Info..." value={a.descricao} onChange={async e => {
                                  const newVal = e.target.value;
                                  setAnexos(prev => prev.map((item, idx) => idx === i ? { ...item, descricao: newVal } : item));
                                  if (a.offlineId) {
                                     await updateOfflineAttachmentLegenda(a.offlineId, newVal);
                                  }
                               }} disabled={isReadOnly} />
                              </div>
                              <button onClick={() => handleDeletePendingAnexo(i, a.offlineId)} className="text-red-500 p-1 disabled:opacity-50" disabled={isReadOnly}><Trash2 size={14}/></button>
                           </div>
                           {/* Offline badge */}
                           {a.isOfflinePending && (
                              <div className="w-full flex items-center justify-between gap-2 border-t border-gray-100 pt-1.5">
                                 {!a.isUploading && !a.uploadFalhou && (
                                    <div className="w-full flex items-center justify-center gap-1 bg-amber-500 text-white text-[10px] font-black uppercase py-0.5 rounded shadow border border-amber-600">
                                       <span>☁️ Offline</span>
                                    </div>
                                 )}
                                 {a.isUploading && (
                                    <div className="w-full flex items-center justify-center gap-1 bg-blue-500 text-white text-[10px] font-black uppercase py-0.5 rounded shadow border border-blue-600 animate-pulse">
                                       <span className="animate-spin mr-0.5">🔄</span>
                                       <span>Enviando</span>
                                    </div>
                                 )}
                                 {a.uploadFalhou && (
                                    <div className="w-full flex flex-col gap-1 items-center justify-center bg-red-600 text-white text-[10px] font-black uppercase py-1 rounded shadow border border-red-700">
                                       <div className="flex items-center gap-1">
                                          <span>⚠️ Falha</span>
                                       </div>
                                       <button
                                          onClick={(e) => { e.preventDefault(); syncOfflineFiles(rdoIdAtual || tempRdoId.current); }}
                                          className="bg-white text-red-600 px-2 py-0.5 rounded text-[8px] font-black hover:bg-gray-100 transition-colors shadow-sm"
                                       >
                                          Tentar
                                       </button>
                                    </div>
                                 )}
                              </div>
                           )}
                        </div>
                     ))}
                     {savedFiles.filter(a => !a.mimeType?.startsWith('image/') && !a.mimeType?.startsWith('video/')).length === 0 && anexos.length === 0 && (
                        <div className="text-xs text-center text-gray-400 py-4 border-2 border-dashed border-gray-200 rounded-lg">Nenhum anexo</div>
                     )}
                  </div>
               </div>
            </div>

          </CollapsibleSection>
        )}



        {/* 10. Validação e Aprovação */}
        {!isPartialView && (
          <CollapsibleSection
            icon={ShieldCheck}
            title="10. Validação e Aprovação"
            isCollapsed={!!collapsedSections.sec10}
            onToggle={() => toggleSection('sec10')}
          >

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
                         disabled={isReadOnly}
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
                   {status === 'rascunho' && !isReadOnly && (
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

                   {status === 'rascunho' && isReadOnly && (
                     <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-500 text-sm font-medium">
                       ℹ️ Este diário de obra está em rascunho. Seu perfil possui apenas acesso de visualização de RDOs aprovados.
                     </div>
                   )}

                   {status === 'pendente' && (
                     <div className="space-y-4">
                       <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm font-medium">
                         ⏳ Aguardando aprovação do gestor.
                       </div>
                       {isGestorOrAdmin && (
                         <>
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
                           <AutoResizeTextarea
                             className="w-full border border-gray-300 p-2 text-sm rounded bg-white"
                             minRows={2}
                             placeholder="Motivo da reprovação (obrigatório para reprovar)"
                             value={motivoRejeicao}
                             onChange={e => setMotivoRejeicao(e.target.value)}
                             disabled={isReadOnly}
                           />
                           <div className="flex gap-3 pt-2 border-t border-gray-200 mt-2">
                             <button
                               onClick={handleSalvarRascunho}
                               disabled={saving}
                               className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 shadow-sm transition-colors"
                             >
                               <Save size={16} /> {saving ? 'Salvando...' : 'Salvar Alterações'}
                             </button>
                             <button
                               onClick={handleReabrir}
                               disabled={saving}
                               className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-orange-500 text-white text-sm font-bold rounded-lg hover:bg-orange-600 shadow-sm transition-colors"
                             >
                               <RotateCcw size={16} /> Reabrir RDO
                             </button>
                           </div>
                         </>
                       )}
                     </div>
                   )}

                   {status === 'aprovado' && (
                    <div className="space-y-3">
                      <div className="p-4 bg-green-100 border border-green-300 rounded-lg text-green-800">
                        <p className="font-bold flex items-center gap-2"><ShieldCheck size={18}/> RDO Aprovado</p>
                        <p className="text-sm mt-1 opacity-80">{dataAprovacao}</p>
                      </div>
                      {/* Barra de exportação / compartilhamento */}
                      {rdoIdAtual && obraId && (
                        <div className="mt-1 pt-4 border-t border-gray-200 space-y-3">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
                              Exportar ou compartilhar este diário
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                              Ações apenas do RDO atual. Para vários diários, use Exportar na lista.
                            </p>
                          </div>
                          <RdoShareBar
                            rdoId={rdoIdAtual}
                            obraId={obraId}
                            rdoLabel={`${rdoNumberStr.replace(/[^a-zA-Z0-9]/g, '_')}_${nomeObra.replace(/[^a-zA-Z0-9]/g, '_')}`}
                          />
                        </div>
                      )}
                      {isGestorOrAdmin && (
                        <div className="flex gap-3 pt-4 border-t border-gray-200 mt-1">
                          <button
                            onClick={handleSalvarRascunho}
                            disabled={saving}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 shadow-sm transition-colors"
                          >
                            <Save size={16} /> {saving ? 'Salvando...' : 'Salvar Alterações'}
                          </button>
                          <button
                            onClick={handleReabrir}
                            disabled={saving}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-orange-500 text-white text-sm font-bold rounded-lg hover:bg-orange-600 shadow-sm transition-colors"
                          >
                            <RotateCcw size={16} /> Reabrir RDO
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                   {status === 'rejeitado' && (
                     <div className="p-4 bg-red-100 border border-red-300 rounded-lg text-red-800 space-y-3">
                       <div>
                         <p className="font-bold flex items-center gap-2 text-red-900">❌ RDO Reprovado</p>
                         <p className="text-sm mt-1">{motivoRejeicaoBackend || motivoRejeicao}</p>
                       </div>
                       {!isReadOnly && (
                         <button onClick={handleRevisar} className="flex items-center gap-2 text-sm font-bold text-red-700 hover:underline">
                           <RotateCcw size={14}/> Revisar e Reenviar
                         </button>
                       )}
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
          </CollapsibleSection>
        )}
        
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
