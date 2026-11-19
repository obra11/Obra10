import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import { Activity, AlertTriangle, ArrowLeft, Camera, FileDown, FileText, GraduationCap, HardHat, Loader2, Mail, MapPin, MessageCircle, Plus, Printer, ShieldCheck, Upload, X } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { getImageUrl } from '../../utils/image';
import { FichaFuncionario, fichaDe, fichaVazia, mesclarFicha, pendenciaFicha, type FichaValores } from './FichaFuncionario';

type ContagemTreino = { admissionais: number; recorrentes: number; vencidos: number; aVencer: number };
type ContagemExame = { vencidos: number; aVencer: number };
type Funcionario = {
  id: string;
  nome: string;
  funcao: string;
  ativo: boolean;
  obraId?: string | null;
  obraNome?: string | null;
  cpfMascarado?: string | null;
  cidade?: string | null;
  uf?: string | null;
  dataAdmissao?: string | null;
  tipoContrato?: string | null;
  fichaCompleta?: boolean;
  treinamentos?: ContagemTreino;
  exames?: ContagemExame;
};
type Epi = { id: string; nome: string; unidade?: string | null; quantidade: number };
type Situacao = 'VIGENTE' | 'A_VENCER' | 'VENCIDO' | null;
type Entrega = {
  id: string;
  quantidade: number | string;
  dataRecebimento?: string | null;
  validadeEpi?: string | null;
  ca?: string | null;
  situacao?: Situacao;
  createdAt: string;
  insumo: { nome: string; unidade?: string | null };
  funcionario?: { nome: string; funcao: string; telefone?: string | null; email?: string | null } | null;
  temAssinatura?: boolean;
  local?: string;
};
type TermoEpi = Entrega & { assinatura?: string | null };
type Treinamento = {
  id: string;
  tipo: 'ADMISSIONAL' | 'RECORRENTE';
  nome: string;
  dataRealizacao?: string | null;
  cargaHoraria?: number | null;
  validade?: string | null;
  situacao?: Situacao;
  instrutor?: string | null;
  funcionario?: { id: string; nome: string; funcao: string };
  temAssinatura?: boolean;
  temCertificado?: boolean;
  certificadoUrl?: string | null;
  certificadoNome?: string | null;
  certificadoMime?: string | null;
};
type TermoTreino = Treinamento & { assinatura?: string | null; observacao?: string | null };
type TipoExame = 'ADMISSIONAL' | 'PERIODICO' | 'RETORNO_TRABALHO' | 'MUDANCA_FUNCAO' | 'DEMISSIONAL';
type Exame = {
  id: string;
  tipo: TipoExame;
  nome: string;
  dataRealizacao?: string | null;
  validade?: string | null;
  situacao?: Situacao;
  resultado?: string | null;
  clinica?: string | null;
  funcionario?: { id: string; nome: string; funcao: string };
};
type EpiDossie = {
  id: string;
  nome: string;
  unidade?: string | null;
  quantidade: number;
  dataRecebimento?: string | null;
  validadeEpi?: string | null;
  ca?: string | null;
  situacao?: Situacao;
  local?: string | null;
};
type Alocacao = {
  id: string;
  obraId: string;
  obraNome: string;
  dataInicio?: string | null;
  dataFim?: string | null;
  observacao?: string | null;
  atual?: boolean;
};
type Dossie = {
  cadastro: FichaValores & { id?: string; ativo?: boolean; obraNome?: string | null };
  alocacoes: Alocacao[];
  treinamentos: Treinamento[];
  exames: Exame[];
  epis: EpiDossie[];
};
type AvisoItem = (Treinamento | Exame) & { especie: 'TREINAMENTO' | 'EXAME' };
type Avisos = {
  vencidos: number;
  aVencer: number;
  examesVencidos: number;
  examesAVencer: number;
  treinamentosVencidos: number;
  treinamentosAVencer: number;
  itens: AvisoItem[];
};

const TREINOS = [
  'Integração admissional',
  'NR-01 Gerenciamento de riscos',
  'NR-06 Equipamento de proteção individual',
  'NR-10 Segurança em eletricidade',
  'NR-12 Segurança em máquinas',
  'NR-18 Construção civil',
  'NR-33 Espaço confinado',
  'NR-35 Trabalho em altura',
  'Primeiros socorros',
  'Ordem de serviço',
];

const CONTRATOS: Record<string, string> = {
  CLT: 'CLT',
  TEMPORARIO: 'Temporário',
  ESTAGIO: 'Estágio',
  APRENDIZ: 'Aprendiz',
  AUTONOMO: 'Autônomo',
  TERCEIRIZADO: 'Terceirizado',
};

const EXAMES = [
  'ASO',
  'Audiometria',
  'Acuidade visual',
  'Espirometria',
  'Hemograma',
  'Raio-X de tórax',
];

const TIPOS_EXAME: [TipoExame, string][] = [
  ['ADMISSIONAL', 'Admissional'],
  ['PERIODICO', 'Periódico'],
  ['RETORNO_TRABALHO', 'Retorno ao trabalho'],
  ['MUDANCA_FUNCAO', 'Mudança de função'],
  ['DEMISSIONAL', 'Demissional'],
];

const RESULTADOS_EXAME: [string, string][] = [
  ['APTO', 'Apto'],
  ['APTO_RESTRICOES', 'Apto com restrições'],
  ['INAPTO', 'Inapto'],
];

function QuadroAssinatura({ onChange }: { onChange: (valor: string | null) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const ativo = useRef(false);
  const riscou = useRef(false);

  const estilo = useCallback(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const proporcao = window.devicePixelRatio || 1;
    ctx.setTransform(proporcao, 0, 0, proporcao, 0, 0);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#111827';
  }, []);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const canvas = ref.current;
      if (!canvas) return;
      const proporcao = window.devicePixelRatio || 1;
      const largura = canvas.clientWidth || 320;
      const altura = canvas.clientHeight || 176;
      canvas.width = Math.max(1, Math.floor(largura * proporcao));
      canvas.height = Math.max(1, Math.floor(altura * proporcao));
      estilo();
    });
    return () => cancelAnimationFrame(id);
  }, [estilo]);

  const ponto = (evento: React.PointerEvent<HTMLCanvasElement>) => {
    const quadro = evento.currentTarget.getBoundingClientRect();
    return { x: evento.clientX - quadro.left, y: evento.clientY - quadro.top };
  };

  const iniciar = (evento: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    evento.currentTarget.setPointerCapture(evento.pointerId);
    const onde = ponto(evento);
    ativo.current = true;
    ctx.beginPath();
    ctx.moveTo(onde.x, onde.y);
  };

  const riscar = (evento: React.PointerEvent<HTMLCanvasElement>) => {
    if (!ativo.current) return;
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    const onde = ponto(evento);
    ctx.lineTo(onde.x, onde.y);
    ctx.stroke();
    riscou.current = true;
  };

  const soltar = () => {
    ativo.current = false;
    if (riscou.current && ref.current) onChange(ref.current.toDataURL('image/png'));
  };

  const limpar = () => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    estilo();
    riscou.current = false;
    onChange(null);
  };

  return (
    <div>
      <canvas
        ref={ref}
        className="w-full h-44 rounded-xl border border-gray-300 bg-white touch-none"
        onPointerDown={iniciar}
        onPointerMove={riscar}
        onPointerUp={soltar}
        onPointerCancel={soltar}
      />
      <button type="button" onClick={limpar} className="mt-2 text-sm font-bold text-gray-600">Limpar assinatura</button>
    </div>
  );
}

function hoje() {
  const data = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${data.getFullYear()}-${p(data.getMonth() + 1)}-${p(data.getDate())}`;
}

function maisUmAno(iso: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
  const [ano, mes, dia] = iso.split('-').map(Number);
  const data = new Date(Date.UTC(ano + 1, mes - 1, dia));
  if (data.getUTCMonth() !== mes - 1) data.setUTCDate(0);
  return data.toISOString().slice(0, 10);
}

function quando(valor?: string | null) {
  if (!valor) return '';
  const dia = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor.trim());
  if (dia) return `${dia[3]}/${dia[2]}/${dia[1]}`;
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return '';
  return data.toLocaleDateString('pt-BR');
}

function textoTermoEpi(item: TermoEpi) {
  return (
    `${item.funcionario?.nome || 'Funcionário'} recebeu ${Number(item.quantidade)} ${item.insumo.unidade || 'un'} de ${item.insumo.nome}` +
    `${item.dataRecebimento ? ` em ${quando(item.dataRecebimento)}` : ''}` +
    `${item.validadeEpi ? `, com validade até ${quando(item.validadeEpi)}` : ''}` +
    `${item.ca ? `, CA ${item.ca}` : ''}.`
  );
}

function abrirWhatsapp(telefone: string, texto: string) {
  const digitos = telefone.replace(/\D/g, '');
  if (digitos.length < 10) return false;
  const numero = digitos.startsWith('55') || digitos.length > 11 ? digitos : `55${digitos}`;
  window.open(`https://wa.me/${numero}?text=${encodeURIComponent(texto)}`, '_blank', 'noopener,noreferrer');
  return true;
}

function abrirEmail(email: string, assunto: string, texto: string) {
  const destino = email.trim();
  if (!destino.includes('@')) return false;
  window.location.href = `mailto:${encodeURIComponent(destino)}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(texto)}`;
  return true;
}

function msg(err: unknown, fallback: string) {
  const corpo = err && typeof err === 'object' && 'response' in err
    ? (err as { response?: { data?: { message?: unknown } } }).response?.data?.message
    : undefined;
  if (Array.isArray(corpo)) return corpo.filter((item) => typeof item === 'string').join(' ') || fallback;
  return typeof corpo === 'string' && corpo.trim() ? corpo : fallback;
}

async function msgBlob(err: unknown, fallback: string) {
  const data = err && typeof err === 'object' && 'response' in err
    ? (err as { response?: { data?: unknown } }).response?.data
    : undefined;
  if (data instanceof Blob) {
    try {
      const json = JSON.parse(await data.text()) as { message?: unknown };
      if (typeof json.message === 'string' && json.message.trim()) return json.message;
    } catch {
      /* não era JSON */
    }
  }
  if (err instanceof Error && err.message && err.message !== 'Request failed with status code 400') return err.message;
  return msg(err, fallback);
}

function Selo({ situacao }: { situacao?: Situacao }) {
  if (situacao === 'VENCIDO') return <span className="text-[11px] font-bold uppercase text-red-700 bg-red-50 rounded-full px-2 py-0.5">Vencido</span>;
  if (situacao === 'A_VENCER') return <span className="text-[11px] font-bold uppercase text-amber-800 bg-amber-50 rounded-full px-2 py-0.5">Vence em breve</span>;
  if (situacao === 'VIGENTE') return <span className="text-[11px] font-bold uppercase text-emerald-800 bg-emerald-50 rounded-full px-2 py-0.5">Vigente</span>;
  return null;
}

const SEXOS: Record<string, string> = {
  FEMININO: 'Feminino',
  MASCULINO: 'Masculino',
  NAO_INFORMADO: 'Não informado',
};
const ESTADOS: Record<string, string> = {
  SOLTEIRO: 'Solteiro',
  CASADO: 'Casado',
  UNIAO_ESTAVEL: 'União estável',
  DIVORCIADO: 'Divorciado',
  SEPARADO: 'Separado',
  VIUVO: 'Viúvo',
};
const ESCOLAS: Record<string, string> = {
  FUNDAMENTAL_INCOMPLETO: 'Fundamental incompleto',
  FUNDAMENTAL: 'Fundamental',
  MEDIO_INCOMPLETO: 'Médio incompleto',
  MEDIO: 'Médio',
  TECNICO: 'Técnico',
  SUPERIOR_INCOMPLETO: 'Superior incompleto',
  SUPERIOR: 'Superior',
  POS_GRADUACAO: 'Pós-graduação',
};
const CONTAS: Record<string, string> = {
  CORRENTE: 'Corrente',
  POUPANCA: 'Poupança',
  SALARIO: 'Salário',
};

function Campo({ rotulo, valor }: { rotulo: string; valor?: string | number | null }) {
  if (valor === null || valor === undefined || valor === '') return null;
  return (
    <p className="text-sm text-gray-800">
      <span className="text-gray-500">{rotulo}: </span>
      {valor}
    </p>
  );
}

function AcoesEnvio({
  gerando,
  onPdf,
  onImprimir,
  onWhats,
  onEmail,
}: {
  gerando?: boolean;
  onPdf: () => void;
  onImprimir: () => void;
  onWhats: () => void;
  onEmail: () => void;
}) {
  const btn = 'flex flex-col items-center justify-center gap-1 rounded-xl border border-gray-200 py-2.5 text-[11px] font-bold text-gray-800 disabled:opacity-50';
  return (
    <div className="grid grid-cols-4 gap-2">
      <button type="button" disabled={gerando} onClick={onPdf} className={btn}>
        {gerando ? <Loader2 className="animate-spin" size={16} /> : <FileDown size={16} />}
        PDF
      </button>
      <button type="button" disabled={gerando} onClick={onImprimir} className={btn}>
        <Printer size={16} />
        Imprimir
      </button>
      <button type="button" disabled={gerando} onClick={onWhats} className={`${btn} bg-lunardeli-red text-white border-lunardeli-red`}>
        <MessageCircle size={16} />
        WhatsApp
      </button>
      <button type="button" disabled={gerando} onClick={onEmail} className={btn} aria-label="Enviar por e-mail">
        <Mail size={16} />
        E-mail
      </button>
    </div>
  );
}

const entrada = 'w-full border border-gray-200 rounded-xl p-3 text-sm bg-white';

export const RhPage: React.FC<{ modo?: 'obra' | 'empresa' }> = ({ modo = 'obra' }) => {
  const { obraId: obraParam } = useParams();
  const { obras, user } = useAuth();
  const navigate = useNavigate();
  const empresa = modo === 'empresa';
  const obraId = empresa ? undefined : obraParam;
  const podeRhEmpresa = user?.perfilGlobal === 'GESTOR' || user?.perfilGlobal === 'SUPER_ADMIN'
    || user?.capabilities?.gerenciarUsuarios === true
    || user?.capabilities?.acessoTodasObras === true;
  const [aba, setAba] = useState<'avisos' | 'pessoas' | 'epi' | 'treinamentos' | 'exames'>(empresa ? 'avisos' : 'pessoas');
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [epis, setEpis] = useState<Epi[]>([]);
  const [entregas, setEntregas] = useState<Entrega[]>([]);
  const [treinamentos, setTreinamentos] = useState<Treinamento[]>([]);
  const [exames, setExames] = useState<Exame[]>([]);
  const [avisos, setAvisos] = useState<Avisos | null>(null);
  const [fichaAberta, setFichaAberta] = useState(false);
  const [fichaId, setFichaId] = useState<string | null>(null);
  const [ficha, setFicha] = useState<FichaValores>(fichaVazia());
  const [carregandoFicha, setCarregandoFicha] = useState(false);
  const [funcionarioId, setFuncionarioId] = useState('');
  const [insumoId, setInsumoId] = useState('');
  const [quantidade, setQuantidade] = useState('1');
  const [dataRecebimento, setDataRecebimento] = useState(hoje);
  const [validadeEpi, setValidadeEpi] = useState('');
  const [ca, setCa] = useState('');
  const [treinoFuncionarioId, setTreinoFuncionarioId] = useState('');
  const [tipoTreino, setTipoTreino] = useState<'ADMISSIONAL' | 'RECORRENTE'>('ADMISSIONAL');
  const [nomeTreino, setNomeTreino] = useState('Integração admissional');
  const [nomeOutro, setNomeOutro] = useState('');
  const [dataTreino, setDataTreino] = useState(hoje);
  const [validadeTreino, setValidadeTreino] = useState(maisUmAno(hoje()));
  const validadeAutomatica = useRef(true);
  const [cargaHoraria, setCargaHoraria] = useState('');
  const [instrutor, setInstrutor] = useState('');
  const [filtroTreino, setFiltroTreino] = useState<'TODOS' | 'ADMISSIONAL' | 'RECORRENTE' | 'VENCIDO'>('TODOS');
  const [exameFuncionarioId, setExameFuncionarioId] = useState('');
  const [tipoExame, setTipoExame] = useState<TipoExame>('PERIODICO');
  const [nomeExame, setNomeExame] = useState('ASO');
  const [nomeExameOutro, setNomeExameOutro] = useState('');
  const [dataExame, setDataExame] = useState(hoje);
  const [validadeExame, setValidadeExame] = useState(maisUmAno(hoje()));
  const validadeExameAuto = useRef(true);
  const [resultadoExame, setResultadoExame] = useState('APTO');
  const [clinicaExame, setClinicaExame] = useState('');
  const [filtroExame, setFiltroExame] = useState<'TODOS' | 'VENCIDO' | 'A_VENCER'>('TODOS');
  const [assinatura, setAssinatura] = useState<string | null>(null);
  const [termoAberto, setTermoAberto] = useState<'epi' | 'treino' | null>(null);
  const [termoEpi, setTermoEpi] = useState<TermoEpi | null>(null);
  const [termoTreino, setTermoTreino] = useState<TermoTreino | null>(null);
  const [destinoWhats, setDestinoWhats] = useState('');
  const [destinoEmail, setDestinoEmail] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [lendoFicha, setLendoFicha] = useState(false);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const cameraFichaRef = useRef<HTMLInputElement>(null);
  const arquivoFichaRef = useRef<HTMLInputElement>(null);
  const cameraCertRef = useRef<HTMLInputElement>(null);
  const arquivoCertRef = useRef<HTMLInputElement>(null);
  const [certificado, setCertificado] = useState<File | null>(null);
  const [certificadoPreview, setCertificadoPreview] = useState<string | null>(null);
  const [dossie, setDossie] = useState<Dossie | null>(null);
  const [dossieId, setDossieId] = useState<string | null>(null);
  const [carregandoDossie, setCarregandoDossie] = useState(false);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [gerandoRelatorio, setGerandoRelatorio] = useState(false);
  const [envioAberto, setEnvioAberto] = useState<null | 'whats' | 'email'>(null);
  const [alocarObraId, setAlocarObraId] = useState('');
  const [alocarData, setAlocarData] = useState(hoje);
  const [alocando, setAlocando] = useState(false);

  const carregar = useCallback(async () => {
    if (!empresa && !obraId) return;
    setCarregando(true);
    setErro('');
    const params = obraId ? { obraId } : {};
    try {
      const [pessoas, treinosRes, avisosRes, examesRes] = await Promise.all([
        api.get('/rh/funcionarios', { params }),
        api.get('/rh/treinamentos', { params }),
        api.get('/rh/avisos', { params }),
        api.get('/rh/exames', { params }),
      ]);
      setFuncionarios(pessoas.data || []);
      setTreinamentos(treinosRes.data || []);
      setAvisos(avisosRes.data || null);
      setExames(examesRes.data || []);
      if (empresa || !obraId) {
        setEntregas([]);
        setEpis([]);
        return;
      }
      const [locais, entregasRes] = await Promise.all([
        api.get('/estoque/locais', { params: { obraId } }),
        api.get('/rh/entregas', { params: { obraId } }),
      ]);
      setEntregas(entregasRes.data || []);
      const almox = (locais.data?.locais || []).find((local: { tipo: string }) => local.tipo === 'ALMOXARIFADO');
      if (almox) {
        const saldos = await api.get('/estoque/saldos', { params: { localId: almox.id } });
        setEpis(
          (saldos.data || [])
            .filter((item: { insumo?: { tipo?: string } }) => item.insumo?.tipo === 'EPI')
            .map((item: { quantidade: number | string; insumo: { id: string; nome: string; unidade?: string | null } }) => ({
              id: item.insumo.id,
              nome: item.insumo.nome,
              unidade: item.insumo.unidade,
              quantidade: Number(item.quantidade),
            })),
        );
      } else {
        setEpis([]);
      }
    } catch (err) {
      setErro(msg(err, 'Não foi possível abrir o RH.'));
    } finally {
      setCarregando(false);
    }
  }, [empresa, obraId]);

  useEffect(() => {
    carregar().catch(() => {});
  }, [carregar]);

  const lerFotoFicha = async (file?: File) => {
    if (!file) return;
    setLendoFicha(true);
    setErro('');
    try {
      const fd = new FormData();
      fd.append('files', file);
      if (obraId) fd.append('obraId', obraId);
      const res = await api.post('/rh/funcionarios/ler-ficha', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000,
      });
      setFicha((atual) => mesclarFicha(atual, res.data?.ficha));
      setAviso(res.data?.aviso || 'A Luna preencheu o que conseguiu ler. Confira antes de salvar.');
    } catch (err) {
      setErro(msg(err, 'Não foi possível ler a foto da ficha.'));
    } finally {
      setLendoFicha(false);
    }
  };

  const abrirDossie = async (id: string) => {
    setErro('');
    setDossieId(id);
    setCarregandoDossie(true);
    try {
      const res = await api.get(`/rh/funcionarios/${id}/dossie`);
      setDossie(res.data);
      setDestinoWhats(res.data?.cadastro?.telefone || '');
      setDestinoEmail(res.data?.cadastro?.email || '');
      setAlocarObraId(res.data?.cadastro?.obraId || '');
      setAlocarData(hoje());
      setEnvioAberto(null);
    } catch (err) {
      setErro(msg(err, 'Não foi possível abrir o dossiê do funcionário.'));
      setDossie(null);
      setDossieId(null);
    } finally {
      setCarregandoDossie(false);
    }
  };

  const fecharDossie = () => {
    setDossie(null);
    setDossieId(null);
    setErro('');
    setEnvioAberto(null);
  };

  const alocarFuncionario = async () => {
    if (!dossieId) return;
    setAlocando(true);
    setErro('');
    try {
      const res = await api.post(`/rh/funcionarios/${dossieId}/alocacao`, {
        obraId: alocarObraId || null,
        dataInicio: alocarData || hoje(),
      });
      setDossie(res.data);
      setAlocarObraId(res.data?.cadastro?.obraId || '');
      await carregar();
    } catch (err) {
      setErro(msg(err, 'Não foi possível alocar o funcionário na obra.'));
    } finally {
      setAlocando(false);
    }
  };

  const clicarWhatsRelatorio = (ids: string[]) => {
    if (destinoWhats.replace(/\D/g, '').length >= 10 || typeof navigator.canShare === 'function') {
      void enviarRelatorioWhats(ids);
      return;
    }
    setEnvioAberto('whats');
  };

  const clicarEmailRelatorio = (ids: string[]) => {
    if (destinoEmail.includes('@')) {
      void enviarRelatorioEmail(ids);
      return;
    }
    setEnvioAberto('email');
  };

  const slugNome = (nome?: string) =>
    (nome || 'funcionario')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase() || 'funcionario';

  const pdfRelatorio = async (ids: string[]) => {
    const res = await api.get('/rh/relatorios/pessoal', {
      params: { ids: ids.join(',') },
      responseType: 'blob',
      timeout: 90_000,
    });
    const tipo = String(res.headers?.['content-type'] || '');
    if (tipo.includes('application/json')) {
      const texto = res.data instanceof Blob ? await res.data.text() : String(res.data || '');
      let mensagem = 'Não foi possível gerar o PDF do relatório.';
      try {
        const json = JSON.parse(texto) as { message?: string };
        if (json.message) mensagem = json.message;
      } catch {
        /* blob inválido */
      }
      throw new Error(mensagem);
    }
    return new Blob([res.data], { type: 'application/pdf' });
  };

  const nomeDaPessoa = (id: string) =>
    (dossieId === id ? dossie?.cadastro?.nome : undefined) ||
    funcionarios.find((pessoa) => pessoa.id === id)?.nome;

  const nomePdfRelatorio = (ids: string[]) => {
    if (ids.length === 1) return `relatorio-pessoal-${slugNome(nomeDaPessoa(ids[0]))}.pdf`;
    return 'relatorio-pessoal.pdf';
  };

  const baixarRelatorio = async (ids: string[]) => {
    if (!ids.length) return null;
    setGerandoRelatorio(true);
    setErro('');
    try {
      const blob = await pdfRelatorio(ids);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = nomePdfRelatorio(ids);
      link.click();
      URL.revokeObjectURL(url);
      return blob;
    } catch (err) {
      setErro(await msgBlob(err, 'Não foi possível gerar o PDF do relatório.'));
      return null;
    } finally {
      setGerandoRelatorio(false);
    }
  };

  const imprimirRelatorio = async (ids: string[]) => {
    if (!ids.length) return;
    setGerandoRelatorio(true);
    setErro('');
    try {
      const blob = await pdfRelatorio(ids);
      const url = URL.createObjectURL(blob);
      const janela = window.open(url, '_blank', 'noopener,noreferrer');
      if (!janela) {
        const link = document.createElement('a');
        link.href = url;
        link.download = nomePdfRelatorio(ids);
        link.click();
      } else {
        janela.addEventListener('load', () => janela.print());
      }
    } catch (err) {
      setErro(await msgBlob(err, 'Não foi possível abrir o PDF para imprimir.'));
    } finally {
      setGerandoRelatorio(false);
    }
  };

  const textoRelatorio = (ids: string[]) => {
    const nomes = ids.map((id) => nomeDaPessoa(id) || 'funcionário').join(', ');
    return ids.length === 1
      ? `Segue o relatório de pessoal de ${nomes}, com cadastro, treinamentos, exames e EPIs.`
      : `Segue o relatório de pessoal de ${ids.length} funcionários: ${nomes}.`;
  };

  const enviarRelatorioWhats = async (ids: string[]) => {
    const blob = await baixarRelatorio(ids);
    if (!blob) return;
    const arquivo = new File([blob], nomePdfRelatorio(ids), { type: 'application/pdf' });
    const texto = textoRelatorio(ids);
    if (typeof navigator.canShare === 'function') {
      try {
        if (navigator.canShare({ files: [arquivo] })) {
          await navigator.share({ title: 'Relatório de pessoal', text: texto, files: [arquivo] });
          return;
        }
      } catch {
        /* cai no WhatsApp */
      }
    }
    if (!abrirWhatsapp(destinoWhats, `${texto}\n\nO PDF foi baixado neste aparelho para anexar no WhatsApp.`)) {
      setErro('Informe o WhatsApp com DDD para enviar o relatório.');
    }
  };

  const enviarRelatorioEmail = async (ids: string[]) => {
    const blob = await baixarRelatorio(ids);
    if (!blob) return;
    if (!abrirEmail(destinoEmail, 'Relatório de pessoal', `${textoRelatorio(ids)}\n\nO PDF foi baixado neste aparelho para anexar no e-mail.`)) {
      setErro('Informe um e-mail para enviar o relatório.');
    }
  };

  const alternarSelecionado = (id: string) => {
    setSelecionados((atual) => (atual.includes(id) ? atual.filter((item) => item !== id) : [...atual, id]));
  };

  const abrirFicha = async (id?: string) => {
    setErro('');
    setAviso('');
    setFichaId(id || null);
    setFicha({ ...fichaVazia(), obraId: obraId || '' });
    setFichaAberta(true);
    if (!id) return;
    setCarregandoFicha(true);
    try {
      const res = await api.get(`/rh/funcionarios/${id}`);
      setFicha(fichaDe(res.data));
    } catch (err) {
      setErro(msg(err, 'Não foi possível abrir a ficha.'));
      setFichaAberta(false);
    } finally {
      setCarregandoFicha(false);
    }
  };

  const salvarFicha = async () => {
    const pendencia = pendenciaFicha(ficha);
    if (pendencia) {
      setErro(pendencia);
      return;
    }
    setEnviando(true);
    setErro('');
    try {
      const corpo = { ...ficha, obraId: ficha.obraId || obraId || null };
      if (fichaId) await api.patch(`/rh/funcionarios/${fichaId}`, corpo);
      else await api.post('/rh/funcionarios', corpo);
      setAviso(fichaId ? 'Ficha atualizada.' : 'Funcionário incluído.');
      setFichaAberta(false);
      await carregar();
      if (dossieId) await abrirDossie(dossieId);
    } catch (err) {
      setErro(msg(err, 'Não foi possível salvar a ficha.'));
    } finally {
      setEnviando(false);
    }
  };

  const alternar = async (pessoa: Funcionario) => {
    setErro('');
    try {
      await api.patch(`/rh/funcionarios/${pessoa.id}`, { ativo: !pessoa.ativo });
      await carregar();
    } catch (err) {
      setErro(msg(err, 'Não foi possível atualizar o funcionário.'));
    }
  };

  const prepararEntrega = () => {
    if (!funcionarioId) {
      setErro('Escolha quem recebeu o EPI.');
      return;
    }
    if (!insumoId) {
      setErro('Escolha o EPI que está no almoxarifado.');
      return;
    }
    if (!Number(quantidade) || Number(quantidade) <= 0) {
      setErro('Informe a quantidade.');
      return;
    }
    if (!dataRecebimento) {
      setErro('Informe a data de recebimento.');
      return;
    }
    if (!validadeEpi) {
      setErro('Informe a validade do EPI.');
      return;
    }
    if (validadeEpi < dataRecebimento) {
      setErro('A validade do EPI não pode ser anterior ao recebimento.');
      return;
    }
    setErro('');
    setAssinatura(null);
    setTermoAberto('epi');
  };

  const confirmarEntrega = async () => {
    if (!assinatura) {
      setErro('Assine o termo na tela antes de confirmar.');
      return;
    }
    setEnviando(true);
    setErro('');
    try {
      const res = await api.post('/rh/entregas', {
        obraId,
        funcionarioId,
        insumoId,
        quantidade: Number(quantidade),
        dataRecebimento,
        validadeEpi,
        ca: ca.trim() || undefined,
        assinatura,
      });
      setAviso('Recebimento assinado. Agora você pode gerar o PDF, imprimir ou enviar o termo.');
      setQuantidade('1');
      setValidadeEpi('');
      setCa('');
      setAssinatura(null);
      setTermoAberto(null);
      await carregar();
      if (res.data?.id) await verTermoEpi(res.data.id);
    } catch (err) {
      setErro(msg(err, 'Não foi possível registrar a entrega.'));
    } finally {
      setEnviando(false);
    }
  };

  const nomeDoTreino = nomeTreino === '__outro' ? nomeOutro.trim() : nomeTreino;

  const escolherCertificado = (file: File) => {
    if (file.size > 15 * 1024 * 1024) {
      setErro('O certificado passa de 15 MB.');
      return;
    }
    const tipo = (file.type || '').toLowerCase();
    const nome = file.name.toLowerCase();
    const ok =
      tipo.startsWith('image/') ||
      tipo === 'application/pdf' ||
      /\.(jpe?g|png|webp|gif|heic|heif|pdf)$/i.test(nome);
    if (!ok) {
      setErro('Use uma foto (JPG, PNG) ou um PDF do certificado.');
      return;
    }
    setErro('');
    setCertificado(file);
    setCertificadoPreview((atual) => {
      if (atual) URL.revokeObjectURL(atual);
      return tipo.startsWith('image/') || /\.(jpe?g|png|webp|gif)$/i.test(nome)
        ? URL.createObjectURL(file)
        : null;
    });
  };

  const limparCertificado = () => {
    setCertificado(null);
    setCertificadoPreview((atual) => {
      if (atual) URL.revokeObjectURL(atual);
      return null;
    });
  };

  const prepararTreino = () => {
    if (!treinoFuncionarioId) {
      setErro('Escolha quem participou do treinamento.');
      return;
    }
    if (nomeDoTreino.length < 3) {
      setErro('Informe o nome do treinamento.');
      return;
    }
    if (!dataTreino) {
      setErro('Informe a data do treinamento.');
      return;
    }
    if (!validadeTreino) {
      setErro(tipoTreino === 'RECORRENTE' ? 'Informe a data da próxima reciclagem.' : 'Informe até quando o treinamento vale.');
      return;
    }
    if (validadeTreino < dataTreino) {
      setErro('A validade do treinamento não pode ser anterior à realização.');
      return;
    }
    if (cargaHoraria.trim()) {
      const horas = Number(cargaHoraria.replace(',', '.'));
      if (!Number.isFinite(horas) || horas <= 0 || horas > 80) {
        setErro('Carga horária inválida.');
        return;
      }
    }
    setErro('');
    setAssinatura(null);
    setTermoAberto('treino');
  };

  const confirmarTreino = async () => {
    if (!assinatura) {
      setErro('Assine a presença na tela antes de confirmar.');
      return;
    }
    setEnviando(true);
    setErro('');
    try {
      const dados = new FormData();
      if (obraId) dados.append('obraId', obraId);
      dados.append('funcionarioId', treinoFuncionarioId);
      dados.append('tipo', tipoTreino);
      dados.append('nome', nomeDoTreino);
      dados.append('dataRealizacao', dataTreino);
      dados.append('validade', validadeTreino);
      if (cargaHoraria) dados.append('cargaHoraria', String(Number(cargaHoraria.replace(',', '.'))));
      if (instrutor.trim()) dados.append('instrutor', instrutor.trim());
      dados.append('assinatura', assinatura);
      if (certificado) dados.append('certificado', certificado);
      await api.post('/rh/treinamentos', dados, { timeout: 90_000 });
      setAviso(tipoTreino === 'ADMISSIONAL' ? 'Treinamento admissional registrado.' : 'Reciclagem registrada.');
      setAssinatura(null);
      setTermoAberto(null);
      setCargaHoraria('');
      setInstrutor('');
      setCertificado(null);
      setCertificadoPreview((atual) => {
        if (atual) URL.revokeObjectURL(atual);
        return null;
      });
      await carregar();
    } catch (err) {
      setErro(msg(err, 'Não foi possível registrar o treinamento.'));
    } finally {
      setEnviando(false);
    }
  };

  const nomeDoExame = nomeExame === '__outro' ? nomeExameOutro.trim() : nomeExame;

  const salvarExame = async () => {
    if (!exameFuncionarioId) {
      setErro('Escolha o funcionário.');
      return;
    }
    if (nomeDoExame.length < 3) {
      setErro('Informe o nome do exame.');
      return;
    }
    if (!dataExame) {
      setErro('Informe a data do exame.');
      return;
    }
    if (!validadeExame) {
      setErro('Informe a validade do exame.');
      return;
    }
    if (validadeExame < dataExame) {
      setErro('A validade do exame não pode ser anterior à realização.');
      return;
    }
    setEnviando(true);
    setErro('');
    try {
      await api.post('/rh/exames', {
        ...(obraId ? { obraId } : {}),
        funcionarioId: exameFuncionarioId,
        tipo: tipoExame,
        nome: nomeDoExame,
        dataRealizacao: dataExame,
        validade: validadeExame,
        resultado: resultadoExame || undefined,
        clinica: clinicaExame.trim() || undefined,
      });
      setAviso('Exame registrado.');
      setClinicaExame('');
      await carregar();
    } catch (err) {
      setErro(msg(err, 'Não foi possível registrar o exame.'));
    } finally {
      setEnviando(false);
    }
  };

  const verTermoEpi = async (id: string) => {
    setErro('');
    try {
      const res = await api.get(`/rh/entregas/${id}`);
      setTermoEpi(res.data);
      setDestinoWhats(res.data?.funcionario?.telefone || '');
      setDestinoEmail(res.data?.funcionario?.email || '');
    } catch (err) {
      setErro(msg(err, 'Não foi possível abrir o termo.'));
    }
  };

  const pdfDoTermo = async (id: string) => {
    const res = await api.get(`/rh/entregas/${id}/pdf`, { responseType: 'blob' });
    return new Blob([res.data], { type: 'application/pdf' });
  };

  const baixarTermoPdf = async (item: TermoEpi) => {
    setErro('');
    try {
      const blob = await pdfDoTermo(item.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `termo-epi-${(item.funcionario?.nome || 'funcionario').replace(/\s+/g, '-').toLowerCase()}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      return blob;
    } catch (err) {
      setErro(msg(err, 'Não foi possível gerar o PDF do termo.'));
      return null;
    }
  };

  const imprimirTermoPdf = async (item: TermoEpi) => {
    setErro('');
    try {
      const blob = await pdfDoTermo(item.id);
      const url = URL.createObjectURL(blob);
      const janela = window.open(url, '_blank', 'noopener,noreferrer');
      if (!janela) {
        const link = document.createElement('a');
        link.href = url;
        link.download = 'termo-epi.pdf';
        link.click();
      } else {
        janela.addEventListener('load', () => janela.print());
      }
    } catch (err) {
      setErro(msg(err, 'Não foi possível abrir o PDF para imprimir.'));
    }
  };

  const enviarTermoWhats = async (item: TermoEpi) => {
    const blob = await baixarTermoPdf(item);
    if (!blob) return;
    const arquivo = new File([blob], 'termo-epi.pdf', { type: 'application/pdf' });
    const texto = `Termo de recebimento de EPI\n\n${textoTermoEpi(item)}\n\nO PDF do termo foi baixado neste aparelho para anexar.`;
    if (typeof navigator.canShare === 'function') {
      try {
        if (navigator.canShare({ files: [arquivo] })) {
          await navigator.share({ title: 'Termo de EPI', text: textoTermoEpi(item), files: [arquivo] });
          return;
        }
      } catch {
        /* cai no WhatsApp */
      }
    }
    if (!abrirWhatsapp(destinoWhats, texto)) {
      setErro('Informe o WhatsApp com DDD para enviar o termo.');
    }
  };

  const enviarTermoEmail = async (item: TermoEpi) => {
    const blob = await baixarTermoPdf(item);
    if (!blob) return;
    if (!abrirEmail(destinoEmail, 'Termo de recebimento de EPI', `${textoTermoEpi(item)}\n\nO PDF do termo foi baixado neste aparelho para anexar no e-mail.`)) {
      setErro('Informe um e-mail para enviar o termo.');
    }
  };

  const verTermoTreino = async (id: string) => {
    setErro('');
    try {
      const res = await api.get(`/rh/treinamentos/${id}`);
      setTermoTreino(res.data);
    } catch (err) {
      setErro(msg(err, 'Não foi possível abrir a presença.'));
    }
  };

  const ativos = funcionarios.filter((pessoa) => pessoa.ativo);
  const pessoaEpi = ativos.find((pessoa) => pessoa.id === funcionarioId);
  const epiTermo = epis.find((item) => item.id === insumoId);
  const pessoaTreino = ativos.find((pessoa) => pessoa.id === treinoFuncionarioId);
  const listaTreinos = treinamentos.filter((item) => {
    if (filtroTreino === 'TODOS') return true;
    if (filtroTreino === 'VENCIDO') return item.situacao === 'VENCIDO';
    return item.tipo === filtroTreino;
  });
  const vencidos = treinamentos.filter((item) => item.situacao === 'VENCIDO').length;
  const aVencer = treinamentos.filter((item) => item.situacao === 'A_VENCER').length;
  const listaExames = exames.filter((item) => {
    if (filtroExame === 'TODOS') return true;
    if (filtroExame === 'VENCIDO') return item.situacao === 'VENCIDO';
    return item.situacao === 'A_VENCER';
  });
  const fichas = empresa ? funcionarios : funcionarios.filter((pessoa) => pessoa.obraId === obraId);
  const idsVisiveis = fichas.map((pessoa) => pessoa.id);
  const todosSelecionados = idsVisiveis.length > 0 && idsVisiveis.every((id) => selecionados.includes(id));
  const abas = empresa
    ? ([['avisos', 'Avisos'], ['pessoas', 'Funcionários'], ['treinamentos', 'Treinamentos'], ['exames', 'Exames']] as const)
    : ([['pessoas', 'Funcionários'], ['epi', 'EPI'], ['treinamentos', 'Treinamentos']] as const);
  const atraso = (avisos?.vencidos || 0) + (avisos?.aVencer || 0);

  return (
    <div className={`${empresa ? 'min-h-screen bg-lunardeli-gray' : ''} p-4 md:p-6 space-y-4 ${empresa ? 'max-w-7xl mx-auto' : ''}`}>
      {erro && !fichaAberta && !termoAberto && <p className="text-sm font-bold text-red-700 bg-red-50 rounded-xl px-3 py-2">{erro}</p>}
      {aviso && <p className="text-sm font-bold text-emerald-800 bg-emerald-50 rounded-xl px-3 py-2">{aviso}</p>}

      <div className="bg-white p-5 md:p-6 rounded-2xl border border-gray-100">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-lunardeli-red font-bold text-xs uppercase tracking-wider">
            <HardHat size={16} /> {empresa ? 'RH da empresa' : 'RH da obra'}
          </div>
          {empresa && (
            <button type="button" onClick={() => navigate('/dashboard')} className="flex items-center gap-1.5 text-sm font-bold text-gray-600">
              <ArrowLeft size={16} /> Voltar
            </button>
          )}
        </div>
        <div className="mt-1 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900">{empresa ? 'Pessoas da empresa' : 'Funcionários'}</h1>
            <p className="text-sm text-gray-500 mt-1">
              {empresa
                ? 'Cadastro na empresa, treinamentos e exames. O aviso aparece quando algum vence ou já venceu.'
                : 'Entrega de EPI nesta obra. O cadastro, os exames e o aviso de atraso ficam no RH da empresa.'}
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            {!empresa && podeRhEmpresa && (
              <button type="button" onClick={() => navigate('/rh')} className="inline-flex items-center justify-center gap-2 border border-gray-200 text-gray-800 font-bold rounded-xl px-4 py-3">
                RH da empresa
              </button>
            )}
            <button type="button" onClick={() => void abrirFicha()} className="inline-flex items-center justify-center gap-2 bg-lunardeli-red text-white font-bold rounded-xl px-4 py-3">
              <Plus size={16} /> Incluir funcionário
            </button>
          </div>
        </div>
        {atraso > 0 && aba !== 'avisos' && (
          <button
            type="button"
            onClick={() => { if (empresa) setAba('avisos'); else if (podeRhEmpresa) navigate('/rh'); }}
            className="mt-4 w-full text-left rounded-xl bg-red-50 border border-red-100 px-4 py-3"
          >
            <p className="text-sm font-extrabold text-red-800 flex items-center gap-2">
              <AlertTriangle size={16} />
              {avisos?.vencidos || 0} atrasado{(avisos?.vencidos || 0) === 1 ? '' : 's'}
              {(avisos?.aVencer || 0) > 0 ? ` · ${avisos?.aVencer} a vencer` : ''}
            </p>
            <p className="text-xs text-red-700 mt-1">Exame ou treinamento com validade vencida ou perto de vencer.</p>
          </button>
        )}
        <div className="mt-4 flex gap-2 overflow-x-auto">
          {abas.map(([id, rotulo]) => (
            <button
              key={id}
              type="button"
              onClick={() => { setAba(id); setErro(''); }}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ${aba === id ? 'bg-lunardeli-red text-white' : 'bg-gray-100 text-gray-700'}`}
            >
              {rotulo}
              {id === 'avisos' && atraso > 0 ? ` (${atraso})` : ''}
            </button>
          ))}
        </div>
      </div>

      {aba === 'avisos' && empresa && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {carregando ? (
            <p className="p-8 text-sm text-gray-500 flex items-center justify-center gap-2"><Loader2 className="animate-spin" size={16} /> Carregando avisos...</p>
          ) : !avisos || avisos.itens.length === 0 ? (
            <p className="p-8 text-sm text-gray-500 text-center">Nenhum exame ou treinamento atrasado. Quando a validade chegar, o aviso aparece aqui.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {avisos.itens.map((item) => (
                <li key={`${item.especie}-${item.id}`} className="p-4">
                  <div className="flex justify-between gap-3">
                    <p className="font-bold text-gray-900">{item.nome}</p>
                    <Selo situacao={item.situacao} />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {item.especie === 'EXAME' ? 'Exame' : 'Treinamento'}
                    {' · '}
                    {item.funcionario?.nome || 'Funcionário'}
                    {item.validade ? ` · válido até ${quando(item.validade)}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {aba === 'pessoas' && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {carregando ? (
            <p className="p-8 text-sm text-gray-500 flex items-center justify-center gap-2"><Loader2 className="animate-spin" size={16} /> Carregando funcionários...</p>
          ) : fichas.length === 0 ? (
            <p className="p-8 text-sm text-gray-500 text-center">
              {empresa
                ? 'Nenhum funcionário na empresa. Inclua o primeiro com a ficha de registro.'
                : 'Ninguém lotado nesta obra. Inclua aqui ou cadastre no RH da empresa.'}
            </p>
          ) : (
            <>
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-sm font-bold text-gray-700">
                  <input
                    type="checkbox"
                    checked={todosSelecionados}
                    onChange={() => setSelecionados(todosSelecionados ? [] : idsVisiveis)}
                    aria-label="Selecionar todos os funcionários"
                  />
                  {selecionados.length ? `${selecionados.length} selecionado${selecionados.length === 1 ? '' : 's'}` : 'Selecionar para enviar'}
                </label>
                <p className="text-xs text-gray-500">Toque no nome para ver o dossiê</p>
              </div>
              <ul className="divide-y divide-gray-100">
                {fichas.map((pessoa) => (
                  <li key={pessoa.id} className="p-4 flex items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={selecionados.includes(pessoa.id)}
                      onChange={() => alternarSelecionado(pessoa.id)}
                      aria-label={`Selecionar ${pessoa.nome}`}
                    />
                    <button type="button" onClick={() => void abrirDossie(pessoa.id)} className="min-w-0 flex-1 text-left">
                      <p className={`font-bold truncate ${pessoa.ativo ? 'text-gray-900' : 'text-gray-400 line-through'}`}>{pessoa.nome}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {[pessoa.funcao, pessoa.cpfMascarado, pessoa.obraNome || (empresa && !pessoa.obraId ? 'Sem obra' : ''), pessoa.cidade ? `${pessoa.cidade}${pessoa.uf ? `/${pessoa.uf}` : ''}` : '']
                          .filter(Boolean)
                          .join(' · ') || 'Só cadastro inicial'}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {pessoa.dataAdmissao ? `Admissão ${quando(pessoa.dataAdmissao)}` : 'Sem data de admissão'}
                        {pessoa.tipoContrato ? ` · ${CONTRATOS[pessoa.tipoContrato] || pessoa.tipoContrato}` : ''}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {pessoa.fichaCompleta === false && <span className="text-[11px] font-bold uppercase text-amber-800 bg-amber-50 rounded-full px-2 py-0.5">Ficha incompleta</span>}
                        {(pessoa.treinamentos?.vencidos || 0) > 0 && <span className="text-[11px] font-bold uppercase text-red-700 bg-red-50 rounded-full px-2 py-0.5">Treinamento vencido</span>}
                        {(pessoa.treinamentos?.aVencer || 0) > 0 && <span className="text-[11px] font-bold uppercase text-amber-800 bg-amber-50 rounded-full px-2 py-0.5">Treinamento a vencer</span>}
                        {(pessoa.exames?.vencidos || 0) > 0 && <span className="text-[11px] font-bold uppercase text-red-700 bg-red-50 rounded-full px-2 py-0.5">Exame vencido</span>}
                        {(pessoa.exames?.aVencer || 0) > 0 && <span className="text-[11px] font-bold uppercase text-amber-800 bg-amber-50 rounded-full px-2 py-0.5">Exame a vencer</span>}
                      </div>
                    </button>
                    <button type="button" onClick={() => void alternar(pessoa)} className="shrink-0 text-xs font-bold text-gray-700 border rounded-lg px-3 py-2">
                      {pessoa.ativo ? 'Desativar' : 'Reativar'}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {aba === 'pessoas' && selecionados.length > 0 && !dossieId && !fichaAberta && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
          <p className="text-sm font-extrabold text-gray-900">
            Relatório de {selecionados.length} funcionário{selecionados.length === 1 ? '' : 's'}
          </p>
          <p className="text-xs text-gray-500">
            Gera um PDF formal com cadastro, treinamentos, exames e EPIs, pronto para cliente, WhatsApp ou e-mail.
          </p>
          {erro && !dossieId && !fichaAberta && <p className="text-sm font-bold text-red-700 bg-red-50 rounded-xl px-3 py-2">{erro}</p>}
          <AcoesEnvio
            gerando={gerandoRelatorio}
            onPdf={() => void baixarRelatorio(selecionados)}
            onImprimir={() => void imprimirRelatorio(selecionados)}
            onWhats={() => clicarWhatsRelatorio(selecionados)}
            onEmail={() => clicarEmailRelatorio(selecionados)}
          />
          {envioAberto === 'whats' && (
            <input className={entrada} inputMode="tel" placeholder="WhatsApp com DDD" value={destinoWhats} onChange={(e) => setDestinoWhats(e.target.value)} />
          )}
          {envioAberto === 'email' && (
            <input className={entrada} type="email" placeholder="e-mail do destinatário" value={destinoEmail} onChange={(e) => setDestinoEmail(e.target.value)} />
          )}
        </div>
      )}

      {aba === 'exames' && empresa && (
        <>
          <div className="bg-white p-5 rounded-2xl border border-gray-100 space-y-3">
            <div className="flex items-center gap-2">
              <Activity size={18} className="text-lunardeli-red" />
              <h2 className="font-extrabold text-gray-900">Registrar exame</h2>
            </div>
            <p className="text-sm text-gray-500">ASO e exames periódicos. A validade gera o aviso quando atrasar.</p>
            <select className={entrada} value={exameFuncionarioId} onChange={(e) => setExameFuncionarioId(e.target.value)} aria-label="Funcionário do exame">
              <option value="">Quem fez o exame</option>
              {ativos.map((pessoa) => (
                <option key={pessoa.id} value={pessoa.id}>{pessoa.funcao ? `${pessoa.nome} · ${pessoa.funcao}` : pessoa.nome}</option>
              ))}
            </select>
            <select className={entrada} value={tipoExame} onChange={(e) => setTipoExame(e.target.value as TipoExame)} aria-label="Tipo do exame">
              {TIPOS_EXAME.map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}
            </select>
            <select
              className={entrada}
              value={EXAMES.includes(nomeExame) || nomeExame === '__outro' ? nomeExame : '__outro'}
              onChange={(e) => setNomeExame(e.target.value)}
              aria-label="Exame"
            >
              {EXAMES.map((nome) => <option key={nome} value={nome}>{nome}</option>)}
              <option value="__outro">Outro</option>
            </select>
            {(nomeExame === '__outro' || (!EXAMES.includes(nomeExame) && nomeExame !== '__outro')) && (
              <input className={entrada} placeholder="Nome do exame" value={nomeExame === '__outro' ? nomeExameOutro : nomeExame} onChange={(e) => { setNomeExame('__outro'); setNomeExameOutro(e.target.value); }} />
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label className="block space-y-1">
                <span className="text-xs font-bold text-gray-600">Realizado em</span>
                <input
                  className={entrada}
                  type="date"
                  value={dataExame}
                  onChange={(e) => {
                    setDataExame(e.target.value);
                    if (validadeExameAuto.current) setValidadeExame(maisUmAno(e.target.value));
                  }}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-bold text-gray-600">Válido até</span>
                <input className={entrada} type="date" value={validadeExame} onChange={(e) => { validadeExameAuto.current = false; setValidadeExame(e.target.value); }} />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-bold text-gray-600">Resultado</span>
                <select className={entrada} value={resultadoExame} onChange={(e) => setResultadoExame(e.target.value)}>
                  <option value="">Sem resultado</option>
                  {RESULTADOS_EXAME.map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-bold text-gray-600">Clínica</span>
                <input className={entrada} value={clinicaExame} onChange={(e) => setClinicaExame(e.target.value)} />
              </label>
            </div>
            <button type="button" disabled={enviando} onClick={() => void salvarExame()} className="w-full bg-gray-900 text-white font-bold rounded-xl py-3 disabled:opacity-60">
              {enviando ? 'Salvando...' : 'Registrar exame'}
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-4 pt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <h2 className="font-extrabold text-gray-900">Histórico</h2>
              <p className="text-xs text-gray-500">
                {exames.filter((item) => item.situacao === 'VENCIDO').length} vencido{exames.filter((item) => item.situacao === 'VENCIDO').length === 1 ? '' : 's'}
                {' · '}
                {exames.filter((item) => item.situacao === 'A_VENCER').length} a vencer
              </p>
            </div>
            <div className="px-4 pt-3 flex gap-2 overflow-x-auto">
              {([
                ['TODOS', 'Todos'],
                ['VENCIDO', 'Vencidos'],
                ['A_VENCER', 'A vencer'],
              ] as const).map(([id, rotulo]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFiltroExame(id)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${filtroExame === id ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'}`}
                >
                  {rotulo}
                </button>
              ))}
            </div>
            {listaExames.length === 0 ? (
              <p className="p-8 text-sm text-gray-500 text-center">Nenhum exame neste filtro.</p>
            ) : (
              <ul className="divide-y divide-gray-100 mt-3">
                {listaExames.map((item) => (
                  <li key={item.id} className="p-4">
                    <div className="flex justify-between gap-3">
                      <p className="font-bold text-gray-900">{item.nome}</p>
                      <Selo situacao={item.situacao} />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {TIPOS_EXAME.find(([valor]) => valor === item.tipo)?.[1] || item.tipo}
                      {' · '}
                      {item.funcionario?.nome || 'Sem funcionário'}
                      {item.resultado ? ` · ${RESULTADOS_EXAME.find(([valor]) => valor === item.resultado)?.[1] || item.resultado}` : ''}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Realizado {quando(item.dataRealizacao)}
                      {item.validade ? ` · válido até ${quando(item.validade)}` : ''}
                      {item.clinica ? ` · ${item.clinica}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {aba === 'epi' && !empresa && (
        <>
          <div className="bg-white p-5 rounded-2xl border border-gray-100 space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck size={18} className="text-lunardeli-red" />
              <h2 className="font-extrabold text-gray-900">Entregar EPI</h2>
            </div>
            <p className="text-sm text-gray-500">Quem recebe assina o termo. Depois dá para gerar PDF, imprimir ou enviar por WhatsApp e e-mail.</p>
            <select className={entrada} value={funcionarioId} onChange={(e) => setFuncionarioId(e.target.value)} aria-label="Funcionário">
              <option value="">Quem recebeu</option>
              {ativos.map((pessoa) => (
                <option key={pessoa.id} value={pessoa.id}>{pessoa.funcao ? `${pessoa.nome} · ${pessoa.funcao}` : pessoa.nome}</option>
              ))}
            </select>
            <select className={entrada} value={insumoId} onChange={(e) => setInsumoId(e.target.value)} aria-label="EPI">
              <option value="">EPI em estoque</option>
              {epis.map((item) => (
                <option key={item.id} value={item.id}>{item.nome} ({item.quantidade} {item.unidade || 'un'})</option>
              ))}
            </select>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label className="block space-y-1">
                <span className="text-xs font-bold text-gray-600">Quantidade</span>
                <input className={entrada} type="number" min="0" step="any" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-bold text-gray-600">Recebimento</span>
                <input className={entrada} type="date" value={dataRecebimento} onChange={(e) => setDataRecebimento(e.target.value)} />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-bold text-gray-600">Validade do EPI</span>
                <input className={entrada} type="date" value={validadeEpi} onChange={(e) => setValidadeEpi(e.target.value)} />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-bold text-gray-600">CA</span>
                <input className={entrada} value={ca} placeholder="Certificado de aprovação" onChange={(e) => setCa(e.target.value)} />
              </label>
            </div>
            {epis.length === 0 && !carregando && (
              <p className="text-sm text-gray-500">Nenhum EPI com saldo. Cadastre o item como EPI e lance a entrada junto com os materiais.</p>
            )}
            <button type="button" disabled={enviando} onClick={prepararEntrega} className="w-full bg-gray-900 text-white font-bold rounded-xl py-3 disabled:opacity-60">
              Assinar termo
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <h2 className="px-4 pt-4 font-extrabold text-gray-900">Recebimentos</h2>
            {entregas.length === 0 ? (
              <p className="p-8 text-sm text-gray-500 text-center">Nenhuma entrega de EPI nesta obra.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {entregas.map((item) => (
                  <li key={item.id} className="p-4">
                    <div className="flex justify-between gap-3">
                      <p className="font-bold text-gray-900">{item.insumo.nome}</p>
                      <p className="font-extrabold">{Number(item.quantidade)} {item.insumo.unidade || 'un'}</p>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {item.funcionario?.nome || 'Sem funcionário'}
                      {item.funcionario?.funcao ? ` · ${item.funcionario.funcao}` : ''}
                      {' · '}
                      {quando(item.dataRecebimento) || quando(item.createdAt)}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Selo situacao={item.situacao} />
                      {item.validadeEpi && <span className="text-xs text-gray-500">Validade {quando(item.validadeEpi)}</span>}
                      {item.ca && <span className="text-xs text-gray-500">CA {item.ca}</span>}
                    </div>
                    {item.temAssinatura && (
                      <button type="button" onClick={() => void verTermoEpi(item.id)} className="mt-2 text-xs font-bold text-lunardeli-red">
                        Ver termo assinado
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {aba === 'treinamentos' && (
        <>
          <div className="bg-white p-5 rounded-2xl border border-gray-100 space-y-3">
            <div className="flex items-center gap-2">
              <GraduationCap size={18} className="text-lunardeli-red" />
              <h2 className="font-extrabold text-gray-900">Registrar treinamento</h2>
            </div>
            <p className="text-sm text-gray-500">
              O admissional é a integração de entrada. O recorrente é a reciclagem: a data de validade é a próxima vez em que o treinamento vence.
            </p>
            <select className={entrada} value={treinoFuncionarioId} onChange={(e) => setTreinoFuncionarioId(e.target.value)} aria-label="Funcionário do treinamento">
              <option value="">Quem participou</option>
              {ativos.map((pessoa) => (
                <option key={pessoa.id} value={pessoa.id}>{pessoa.funcao ? `${pessoa.nome} · ${pessoa.funcao}` : pessoa.nome}</option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              {(['ADMISSIONAL', 'RECORRENTE'] as const).map((tipo) => (
                <button
                  key={tipo}
                  type="button"
                  onClick={() => {
                    setTipoTreino(tipo);
                    if (tipo === 'ADMISSIONAL' && (!nomeTreino || nomeTreino === '__outro')) setNomeTreino('Integração admissional');
                  }}
                  className={`rounded-xl py-3 text-sm font-bold border ${tipoTreino === tipo ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200'}`}
                >
                  {tipo === 'ADMISSIONAL' ? 'Admissional' : 'Recorrente'}
                </button>
              ))}
            </div>
            <select
              className={entrada}
              value={TREINOS.includes(nomeTreino) || nomeTreino === '__outro' ? nomeTreino : '__outro'}
              onChange={(e) => setNomeTreino(e.target.value)}
              aria-label="Treinamento"
            >
              {TREINOS.map((nome) => <option key={nome} value={nome}>{nome}</option>)}
              <option value="__outro">Outro</option>
            </select>
            {(nomeTreino === '__outro' || (!TREINOS.includes(nomeTreino) && nomeTreino !== '__outro')) && (
              <input className={entrada} placeholder="Nome do treinamento" value={nomeTreino === '__outro' ? nomeOutro : nomeTreino} onChange={(e) => { setNomeTreino('__outro'); setNomeOutro(e.target.value); }} />
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label className="block space-y-1">
                <span className="text-xs font-bold text-gray-600">Realizado em</span>
                <input
                  className={entrada}
                  type="date"
                  value={dataTreino}
                  onChange={(e) => {
                    setDataTreino(e.target.value);
                    if (validadeAutomatica.current) setValidadeTreino(maisUmAno(e.target.value));
                  }}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-bold text-gray-600">{tipoTreino === 'RECORRENTE' ? 'Próxima reciclagem' : 'Válido até'}</span>
                <input className={entrada} type="date" value={validadeTreino} onChange={(e) => { validadeAutomatica.current = false; setValidadeTreino(e.target.value); }} />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-bold text-gray-600">Carga horária</span>
                <input className={entrada} inputMode="decimal" placeholder="Horas" value={cargaHoraria} onChange={(e) => setCargaHoraria(e.target.value)} />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-bold text-gray-600">Instrutor</span>
                <input className={entrada} value={instrutor} onChange={(e) => setInstrutor(e.target.value)} />
              </label>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-3 space-y-2">
              <p className="text-xs font-extrabold uppercase tracking-wider text-lunardeli-red">Certificado</p>
              <p className="text-xs text-gray-500">
                Opcional. Fotografe o certificado ou anexe o PDF.
              </p>
              <input
                ref={cameraCertRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) escolherCertificado(file);
                  e.target.value = '';
                }}
              />
              <input
                ref={arquivoCertRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) escolherCertificado(file);
                  e.target.value = '';
                }}
              />
              {certificado ? (
                <div className="flex items-start gap-3 rounded-xl bg-white border border-gray-200 p-3">
                  {certificadoPreview ? (
                    <img src={certificadoPreview} alt="" className="h-16 w-16 rounded-lg object-cover bg-gray-100" />
                  ) : (
                    <div className="h-16 w-16 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center">
                      <FileText size={22} />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-gray-900 truncate">{certificado.name}</p>
                    <p className="text-xs text-gray-500">{Math.max(1, Math.round(certificado.size / 1024))} KB</p>
                  </div>
                  <button type="button" onClick={limparCertificado} className="text-gray-500 p-1" aria-label="Remover certificado">
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => cameraCertRef.current?.click()}
                    className="flex items-center justify-center gap-2 bg-lunardeli-red text-white font-bold rounded-xl py-3 text-sm"
                  >
                    <Camera size={16} /> Foto
                  </button>
                  <button
                    type="button"
                    onClick={() => arquivoCertRef.current?.click()}
                    className="flex items-center justify-center gap-2 border border-gray-300 text-gray-900 font-bold rounded-xl py-3 text-sm"
                  >
                    <Upload size={16} /> PDF ou foto
                  </button>
                </div>
              )}
            </div>
            <button type="button" disabled={enviando} onClick={prepararTreino} className="w-full bg-gray-900 text-white font-bold rounded-xl py-3 disabled:opacity-60">
              Assinar presença
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-4 pt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <h2 className="font-extrabold text-gray-900">Histórico</h2>
              <p className="text-xs text-gray-500">{vencidos} vencido{vencidos === 1 ? '' : 's'} · {aVencer} a vencer</p>
            </div>
            <div className="px-4 pt-3 flex gap-2 overflow-x-auto">
              {([
                ['TODOS', 'Todos'],
                ['ADMISSIONAL', 'Admissionais'],
                ['RECORRENTE', 'Recorrentes'],
                ['VENCIDO', 'Vencidos'],
              ] as const).map(([id, rotulo]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFiltroTreino(id)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${filtroTreino === id ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'}`}
                >
                  {rotulo}
                </button>
              ))}
            </div>
            {listaTreinos.length === 0 ? (
              <p className="p-8 text-sm text-gray-500 text-center">Nenhum treinamento neste filtro.</p>
            ) : (
              <ul className="divide-y divide-gray-100 mt-3">
                {listaTreinos.map((item) => (
                  <li key={item.id} className="p-4">
                    <div className="flex justify-between gap-3">
                      <p className="font-bold text-gray-900">{item.nome}</p>
                      <Selo situacao={item.situacao} />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {item.tipo === 'ADMISSIONAL' ? 'Admissional' : 'Recorrente'}
                      {' · '}
                      {item.funcionario?.nome || 'Sem funcionário'}
                      {item.cargaHoraria ? ` · ${item.cargaHoraria}h` : ''}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Realizado {quando(item.dataRealizacao)}
                      {item.validade ? ` · ${item.tipo === 'RECORRENTE' ? 'reciclagem' : 'válido'} até ${quando(item.validade)}` : ''}
                      {item.instrutor ? ` · ${item.instrutor}` : ''}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-3">
                      {item.temAssinatura && (
                        <button type="button" onClick={() => void verTermoTreino(item.id)} className="text-xs font-bold text-lunardeli-red">
                          Ver presença assinada
                        </button>
                      )}
                      {item.temCertificado && item.certificadoUrl && (
                        <a
                          href={getImageUrl(item.certificadoUrl)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-bold text-lunardeli-red"
                        >
                          Ver certificado
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {aba === 'pessoas' && !fichaAberta && !dossieId && (
        <button
          type="button"
          onClick={() => void abrirFicha()}
          className="sm:hidden fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-4 z-50 h-14 w-14 rounded-full bg-lunardeli-red text-white shadow-lg flex items-center justify-center"
          aria-label="Incluir funcionário"
        >
          <Plus size={22} />
        </button>
      )}

      {dossieId && createPortal(
        <div className="fixed inset-0 z-[200] bg-black/70 flex items-end sm:items-center justify-center sm:p-3">
          <div className="bg-white w-full sm:max-w-2xl sm:rounded-2xl max-h-[100dvh] flex flex-col">
            <div className="px-4 pt-4 pb-3 border-b border-gray-100 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-extrabold text-gray-900">Dossiê do funcionário</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Cadastro, treinamentos, exames e EPIs. O PDF formal serve para enviar a cliente.
                </p>
              </div>
              <button type="button" onClick={fecharDossie} className="shrink-0 text-gray-500 p-1" aria-label="Fechar dossiê">
                <X size={20} />
              </button>
            </div>
            <div className="overflow-y-auto px-4 py-4 flex-1 space-y-5">
              {carregandoDossie || !dossie ? (
                <p className="py-10 text-sm text-gray-500 flex items-center justify-center gap-2"><Loader2 className="animate-spin" size={16} /> Abrindo dossiê...</p>
              ) : (
                <>
                  <section className="space-y-1">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-extrabold uppercase tracking-wider text-lunardeli-red">Identificação</p>
                        <h3 className="text-lg font-extrabold text-gray-900 mt-1">{dossie.cadastro.nome}</h3>
                        <p className="text-sm text-gray-500">
                          {[dossie.cadastro.funcao, dossie.cadastro.ativo === false ? 'Inativo' : 'Ativo', dossie.cadastro.obraNome || (empresa && !dossie.cadastro.obraId ? 'Sem obra' : '')]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void abrirFicha(dossieId)}
                        className="shrink-0 text-xs font-bold text-lunardeli-red border border-red-100 rounded-lg px-3 py-2"
                      >
                        Editar ficha
                      </button>
                    </div>
                    <Campo rotulo="CPF" valor={dossie.cadastro.cpf} />
                    <Campo rotulo="RG" valor={[dossie.cadastro.rg, dossie.cadastro.rgOrgao, dossie.cadastro.rgUf].filter(Boolean).join(' ')} />
                    <Campo rotulo="Nascimento" valor={quando(dossie.cadastro.dataNascimento)} />
                    <Campo rotulo="Sexo" valor={SEXOS[dossie.cadastro.sexo] || dossie.cadastro.sexo} />
                    <Campo rotulo="Estado civil" valor={ESTADOS[dossie.cadastro.estadoCivil] || dossie.cadastro.estadoCivil} />
                    <Campo rotulo="Nacionalidade" valor={dossie.cadastro.nacionalidade} />
                    <Campo rotulo="Naturalidade" valor={dossie.cadastro.naturalidade} />
                    <Campo rotulo="Mãe" valor={dossie.cadastro.nomeMae} />
                    <Campo rotulo="Pai" valor={dossie.cadastro.nomePai} />
                    <Campo rotulo="Escolaridade" valor={ESCOLAS[dossie.cadastro.escolaridade] || dossie.cadastro.escolaridade} />
                    <Campo rotulo="PIS" valor={dossie.cadastro.pis} />
                    <Campo
                      rotulo="CTPS"
                      valor={[dossie.cadastro.ctpsNumero, dossie.cadastro.ctpsSerie, dossie.cadastro.ctpsUf].filter(Boolean).join(' ')}
                    />
                  </section>
                  {empresa && podeRhEmpresa && (
                    <section className="space-y-2 rounded-2xl border border-gray-100 bg-gray-50 p-3">
                      <div className="flex items-center gap-2">
                        <MapPin size={16} className="text-lunardeli-red" />
                        <p className="text-xs font-extrabold uppercase tracking-wider text-lunardeli-red">Alocação na obra</p>
                      </div>
                      <p className="text-sm text-gray-700">
                        {dossie.cadastro.obraNome
                          ? `Hoje está em ${dossie.cadastro.obraNome}. Ao transferir, some do RH da obra anterior e entra no da nova.`
                          : 'Ainda sem obra. Ao alocar, a pessoa passa a aparecer no RH daquela obra.'}
                      </p>
                      <select
                        className={entrada}
                        value={alocarObraId}
                        onChange={(e) => setAlocarObraId(e.target.value)}
                        aria-label="Obra de alocação"
                      >
                        <option value="">RH da empresa — sem obra</option>
                        {obras.map((obra) => (
                          <option key={obra.id} value={obra.id}>{obra.nome}</option>
                        ))}
                      </select>
                      <input
                        className={entrada}
                        type="date"
                        value={alocarData}
                        onChange={(e) => setAlocarData(e.target.value)}
                        aria-label="Data da alocação"
                      />
                      <button
                        type="button"
                        disabled={alocando || alocarObraId === (dossie.cadastro.obraId || '')}
                        onClick={() => void alocarFuncionario()}
                        className="w-full bg-lunardeli-red text-white font-bold rounded-xl py-3 text-sm disabled:opacity-50"
                      >
                        {alocando ? 'Alocando...' : alocarObraId ? 'Alocar / transferir' : 'Tirar da obra'}
                      </button>
                      {(dossie.alocacoes || []).length > 0 && (
                        <ul className="space-y-1">
                          {dossie.alocacoes.map((item) => (
                            <li key={item.id} className="text-xs text-gray-600">
                              <span className="font-bold text-gray-800">{item.obraNome}</span>
                              {' · '}
                              {item.dataInicio ? quando(item.dataInicio) : ''}
                              {item.atual || !item.dataFim ? ' — atual' : item.dataFim ? ` a ${quando(item.dataFim)}` : ''}
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>
                  )}
                  <section className="space-y-1">
                    <p className="text-xs font-extrabold uppercase tracking-wider text-lunardeli-red">Contato e endereço</p>
                    <Campo rotulo="Telefone" valor={dossie.cadastro.telefone} />
                    <Campo rotulo="E-mail" valor={dossie.cadastro.email} />
                    <Campo
                      rotulo="Endereço"
                      valor={[dossie.cadastro.logradouro, dossie.cadastro.numero, dossie.cadastro.complemento, dossie.cadastro.bairro].filter(Boolean).join(', ')}
                    />
                    <Campo rotulo="CEP" valor={dossie.cadastro.cep} />
                    <Campo rotulo="Cidade" valor={[dossie.cadastro.cidade, dossie.cadastro.uf].filter(Boolean).join('/')} />
                  </section>
                  <section className="space-y-1">
                    <p className="text-xs font-extrabold uppercase tracking-wider text-lunardeli-red">Contrato</p>
                    <Campo rotulo="Função" valor={dossie.cadastro.funcao} />
                    <Campo rotulo="CBO" valor={dossie.cadastro.cbo} />
                    <Campo rotulo="Matrícula" valor={dossie.cadastro.matricula} />
                    <Campo rotulo="Admissão" valor={quando(dossie.cadastro.dataAdmissao)} />
                    <Campo rotulo="Contrato" valor={CONTRATOS[dossie.cadastro.tipoContrato] || dossie.cadastro.tipoContrato} />
                    <Campo rotulo="Jornada" valor={dossie.cadastro.jornada} />
                    <Campo rotulo="Salário" valor={dossie.cadastro.salario ? `R$ ${dossie.cadastro.salario}` : ''} />
                  </section>
                  <section className="space-y-1">
                    <p className="text-xs font-extrabold uppercase tracking-wider text-lunardeli-red">Dados bancários</p>
                    {!(dossie.cadastro.banco || dossie.cadastro.agencia || dossie.cadastro.conta || dossie.cadastro.pix) ? (
                      <p className="text-sm text-gray-500">Nenhum dado bancário cadastrado.</p>
                    ) : (
                      <>
                        <Campo rotulo="Banco" valor={dossie.cadastro.banco} />
                        <Campo rotulo="Agência" valor={dossie.cadastro.agencia} />
                        <Campo rotulo="Conta" valor={dossie.cadastro.conta} />
                        <Campo rotulo="Tipo" valor={CONTAS[dossie.cadastro.tipoConta] || dossie.cadastro.tipoConta} />
                        <Campo rotulo="PIX" valor={dossie.cadastro.pix} />
                      </>
                    )}
                  </section>
                  <section className="space-y-2">
                    <p className="text-xs font-extrabold uppercase tracking-wider text-lunardeli-red">Treinamentos</p>
                    {dossie.treinamentos.length === 0 ? (
                      <p className="text-sm text-gray-500">Nenhum treinamento registrado até agora.</p>
                    ) : dossie.treinamentos.map((item) => (
                      <div key={item.id} className="rounded-xl border border-gray-100 p-3">
                        <div className="flex justify-between gap-3">
                          <p className="font-bold text-gray-900">{item.nome}</p>
                          <Selo situacao={item.situacao} />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {item.tipo === 'ADMISSIONAL' ? 'Admissional' : 'Recorrente'}
                          {item.dataRealizacao ? ` · ${quando(item.dataRealizacao)}` : ''}
                          {item.validade ? ` · válido até ${quando(item.validade)}` : ''}
                          {item.cargaHoraria ? ` · ${item.cargaHoraria}h` : ''}
                          {item.instrutor ? ` · ${item.instrutor}` : ''}
                        </p>
                        {item.temCertificado && item.certificadoUrl && (
                          <a href={getImageUrl(item.certificadoUrl)} target="_blank" rel="noopener noreferrer" className="inline-block mt-2 text-xs font-bold text-lunardeli-red">
                            Ver certificado
                          </a>
                        )}
                      </div>
                    ))}
                  </section>
                  <section className="space-y-2">
                    <p className="text-xs font-extrabold uppercase tracking-wider text-lunardeli-red">Exames ocupacionais</p>
                    {dossie.exames.length === 0 ? (
                      <p className="text-sm text-gray-500">Nenhum exame registrado até agora.</p>
                    ) : dossie.exames.map((item) => (
                      <div key={item.id} className="rounded-xl border border-gray-100 p-3">
                        <div className="flex justify-between gap-3">
                          <p className="font-bold text-gray-900">{item.nome}</p>
                          <Selo situacao={item.situacao} />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {TIPOS_EXAME.find(([valor]) => valor === item.tipo)?.[1] || item.tipo}
                          {item.dataRealizacao ? ` · ${quando(item.dataRealizacao)}` : ''}
                          {item.validade ? ` · válido até ${quando(item.validade)}` : ''}
                          {item.resultado ? ` · ${RESULTADOS_EXAME.find(([valor]) => valor === item.resultado)?.[1] || item.resultado}` : ''}
                          {item.clinica ? ` · ${item.clinica}` : ''}
                        </p>
                      </div>
                    ))}
                  </section>
                  <section className="space-y-2">
                    <p className="text-xs font-extrabold uppercase tracking-wider text-lunardeli-red">Entrega de EPI</p>
                    {dossie.epis.length === 0 ? (
                      <p className="text-sm text-gray-500">Nenhuma entrega de EPI registrada até agora.</p>
                    ) : dossie.epis.map((item) => (
                      <div key={item.id} className="rounded-xl border border-gray-100 p-3">
                        <div className="flex justify-between gap-3">
                          <p className="font-bold text-gray-900">{item.nome}</p>
                          <Selo situacao={item.situacao} />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {item.quantidade} {item.unidade || 'un'}
                          {item.dataRecebimento ? ` · recebido em ${quando(item.dataRecebimento)}` : ''}
                          {item.validadeEpi ? ` · validade ${quando(item.validadeEpi)}` : ''}
                          {item.ca ? ` · CA ${item.ca}` : ''}
                          {item.local ? ` · ${item.local}` : ''}
                        </p>
                      </div>
                    ))}
                  </section>
                  <section className="space-y-2 pt-2 border-t border-gray-100">
                    {erro && <p className="text-sm font-bold text-red-700 bg-red-50 rounded-xl px-3 py-2">{erro}</p>}
                    <AcoesEnvio
                      gerando={gerandoRelatorio}
                      onPdf={() => void baixarRelatorio([dossieId])}
                      onImprimir={() => void imprimirRelatorio([dossieId])}
                      onWhats={() => clicarWhatsRelatorio([dossieId])}
                      onEmail={() => clicarEmailRelatorio([dossieId])}
                    />
                    {envioAberto === 'whats' && (
                      <input className={entrada} inputMode="tel" placeholder="WhatsApp com DDD" value={destinoWhats} onChange={(e) => setDestinoWhats(e.target.value)} />
                    )}
                    {envioAberto === 'email' && (
                      <input className={entrada} type="email" placeholder="e-mail do destinatário" value={destinoEmail} onChange={(e) => setDestinoEmail(e.target.value)} />
                    )}
                  </section>
                </>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}

      {fichaAberta && createPortal(
        <div className="fixed inset-0 z-[200] bg-black/70 flex items-end sm:items-center justify-center sm:p-3">
          <div className="bg-white w-full sm:max-w-2xl sm:rounded-2xl max-h-[100dvh] flex flex-col">
            <div className="px-4 pt-4 pb-3 border-b border-gray-100">
              <h2 className="text-xl font-extrabold text-gray-900">{fichaId ? 'Ficha do funcionário' : 'Incluir funcionário'}</h2>
              <p className="text-sm text-gray-500 mt-1">
                {fichaId
                  ? 'Estes dados registram a pessoa na empresa: identidade, endereço, documentos e contrato.'
                  : 'Pode fotografar a ficha de papel ou preencher na tela. Só nome completo e CPF são obrigatórios; o restante pode ficar para depois.'}
              </p>
            </div>
            <div className="overflow-y-auto px-4 py-4 flex-1">
              {carregandoFicha ? (
                <p className="py-10 text-sm text-gray-500 flex items-center justify-center gap-2"><Loader2 className="animate-spin" size={16} /> Abrindo ficha...</p>
              ) : (
                <>
                  <div className="mb-5 rounded-2xl border border-gray-100 bg-gray-50 p-3 space-y-2">
                    <p className="text-xs font-extrabold uppercase tracking-wider text-lunardeli-red">Foto da ficha existente</p>
                    <p className="text-xs text-gray-500">
                      Tire uma foto nítida da ficha de registro. Se tiver verso, mande outra depois — só entra o que ainda estiver em branco.
                    </p>
                    <input
                      ref={cameraFichaRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void lerFotoFicha(file);
                        e.target.value = '';
                      }}
                    />
                    <input
                      ref={arquivoFichaRef}
                      type="file"
                      accept="image/*,application/pdf"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void lerFotoFicha(file);
                        e.target.value = '';
                      }}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={lendoFicha}
                        onClick={() => cameraFichaRef.current?.click()}
                        className="flex items-center justify-center gap-2 bg-lunardeli-red text-white font-bold rounded-xl py-3 text-sm disabled:opacity-60"
                      >
                        {lendoFicha ? <Loader2 className="animate-spin" size={16} /> : <Camera size={16} />}
                        {lendoFicha ? 'Lendo...' : 'Tirar foto'}
                      </button>
                      <button
                        type="button"
                        disabled={lendoFicha}
                        onClick={() => arquivoFichaRef.current?.click()}
                        className="flex items-center justify-center gap-2 border border-gray-300 text-gray-900 font-bold rounded-xl py-3 text-sm disabled:opacity-60"
                      >
                        <Upload size={16} /> Galeria
                      </button>
                    </div>
                  </div>
                  {aviso && fichaAberta && (
                    <p className="mb-4 text-sm font-bold text-emerald-800 bg-emerald-50 rounded-xl px-3 py-2">{aviso}</p>
                  )}
                  <FichaFuncionario valores={ficha} onChange={setFicha} obras={obras} />
                </>
              )}
              {erro && <p className="mt-4 text-sm font-bold text-red-700 bg-red-50 rounded-xl px-3 py-2">{erro}</p>}
            </div>
            <div className="px-4 py-3 border-t border-gray-100 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => { setFichaAberta(false); setErro(''); }} className="border rounded-xl py-3 text-sm font-bold text-gray-700">Cancelar</button>
              <button type="button" disabled={enviando || carregandoFicha || lendoFicha} onClick={() => void salvarFicha()} className="bg-lunardeli-red text-white rounded-xl py-3 text-sm font-bold disabled:opacity-50">
                {enviando ? 'Salvando...' : 'Salvar ficha'}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {termoAberto === 'epi' && createPortal(
        <div className="fixed inset-0 z-[200] bg-black/95 flex items-end sm:items-center justify-center p-3">
          <div className="bg-white w-full max-w-lg rounded-2xl p-4 space-y-3 max-h-[100dvh] overflow-y-auto">
            <h2 className="text-xl font-extrabold text-gray-900">Termo de recebimento</h2>
            <p className="text-sm text-gray-700">
              Eu, {pessoaEpi?.nome || 'o funcionário'}, {pessoaEpi?.funcao ? `${pessoaEpi.funcao}, ` : ''}
              declaro que recebi {quantidade} {epiTermo?.unidade || 'un'} de {epiTermo?.nome || 'EPI'} em {quando(dataRecebimento)},
              em condições de uso, com validade até {quando(validadeEpi)}{ca.trim() ? `, CA ${ca.trim().toUpperCase()}` : ''}.
              Comprometo-me a usar e conservar o equipamento.
            </p>
            <p className="text-xs text-gray-500">Assine com o dedo no quadro.</p>
            {erro && <p className="text-sm font-bold text-red-700">{erro}</p>}
            <QuadroAssinatura onChange={setAssinatura} />
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => { setTermoAberto(null); setErro(''); }} className="border rounded-xl py-3 text-sm font-bold text-gray-700">Cancelar</button>
              <button type="button" disabled={!assinatura || enviando} onClick={() => void confirmarEntrega()} className="bg-lunardeli-red text-white rounded-xl py-3 text-sm font-bold disabled:opacity-50">
                {enviando ? 'Salvando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {termoAberto === 'treino' && createPortal(
        <div className="fixed inset-0 z-[200] bg-black/95 flex items-end sm:items-center justify-center p-3">
          <div className="bg-white w-full max-w-lg rounded-2xl p-4 space-y-3 max-h-[100dvh] overflow-y-auto">
            <h2 className="text-xl font-extrabold text-gray-900">Lista de presença</h2>
            <p className="text-sm text-gray-700">
              Eu, {pessoaTreino?.nome || 'o funcionário'}, declaro que participei do treinamento {tipoTreino === 'ADMISSIONAL' ? 'admissional' : 'recorrente'} "{nomeDoTreino}" em {quando(dataTreino)}
              {cargaHoraria ? `, com carga horária de ${cargaHoraria.replace('.', ',')}h` : ''}, válido até {quando(validadeTreino)}.
            </p>
            {certificado && (
              <p className="text-xs text-gray-500">Certificado anexado: {certificado.name}</p>
            )}
            <p className="text-xs text-gray-500">Assine com o dedo no quadro.</p>
            {erro && <p className="text-sm font-bold text-red-700">{erro}</p>}
            <QuadroAssinatura onChange={setAssinatura} />
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => { setTermoAberto(null); setErro(''); }} className="border rounded-xl py-3 text-sm font-bold text-gray-700">Cancelar</button>
              <button type="button" disabled={!assinatura || enviando} onClick={() => void confirmarTreino()} className="bg-lunardeli-red text-white rounded-xl py-3 text-sm font-bold disabled:opacity-50">
                {enviando ? 'Salvando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {termoEpi && createPortal(
        <div className="fixed inset-0 z-[200] bg-black/95 flex items-end sm:items-center justify-center p-3">
          <div className="bg-white w-full max-w-lg rounded-2xl p-4 space-y-3 max-h-[100dvh] overflow-y-auto">
            <h2 className="text-xl font-extrabold text-gray-900">Termo assinado</h2>
            <p className="text-sm text-gray-700">
              {termoEpi.funcionario?.nome || 'Funcionário'} recebeu {Number(termoEpi.quantidade)} {termoEpi.insumo.unidade || 'un'} de {termoEpi.insumo.nome}
              {termoEpi.dataRecebimento ? ` em ${quando(termoEpi.dataRecebimento)}` : ''}
              {termoEpi.validadeEpi ? `, com validade até ${quando(termoEpi.validadeEpi)}` : ''}
              {termoEpi.ca ? `, CA ${termoEpi.ca}` : ''}.
            </p>
            <Selo situacao={termoEpi.situacao} />
            {termoEpi.assinatura && <img src={termoEpi.assinatura} alt="Assinatura de quem recebeu" className="w-full rounded-xl border border-gray-200 bg-white" />}
            {erro && termoEpi && <p className="text-sm font-bold text-red-700">{erro}</p>}
            <AcoesEnvio
              onPdf={() => void baixarTermoPdf(termoEpi)}
              onImprimir={() => void imprimirTermoPdf(termoEpi)}
              onWhats={() => {
                if (destinoWhats.replace(/\D/g, '').length >= 10 || typeof navigator.canShare === 'function') {
                  void enviarTermoWhats(termoEpi);
                  return;
                }
                setEnvioAberto('whats');
              }}
              onEmail={() => {
                if (destinoEmail.includes('@')) {
                  void enviarTermoEmail(termoEpi);
                  return;
                }
                setEnvioAberto('email');
              }}
            />
            {envioAberto === 'whats' && (
              <input className={entrada} inputMode="tel" placeholder="WhatsApp com DDD" value={destinoWhats} onChange={(e) => setDestinoWhats(e.target.value)} />
            )}
            {envioAberto === 'email' && (
              <input className={entrada} type="email" placeholder="e-mail do destinatário" value={destinoEmail} onChange={(e) => setDestinoEmail(e.target.value)} />
            )}
            <button type="button" onClick={() => { setTermoEpi(null); setErro(''); setEnvioAberto(null); }} className="w-full border rounded-xl py-3 text-sm font-bold text-gray-700">Fechar</button>
          </div>
        </div>,
        document.body,
      )}

      {termoTreino && createPortal(
        <div className="fixed inset-0 z-[200] bg-black/95 flex items-end sm:items-center justify-center p-3">
          <div className="bg-white w-full max-w-lg rounded-2xl p-4 space-y-3 max-h-[100dvh] overflow-y-auto">
            <h2 className="text-xl font-extrabold text-gray-900">Presença assinada</h2>
            <p className="text-sm text-gray-700">
              {termoTreino.funcionario?.nome || 'Funcionário'} participou de {termoTreino.nome}
              {termoTreino.dataRealizacao ? ` em ${quando(termoTreino.dataRealizacao)}` : ''}
              {termoTreino.validade ? `, válido até ${quando(termoTreino.validade)}` : ''}.
            </p>
            <Selo situacao={termoTreino.situacao} />
            {termoTreino.assinatura && <img src={termoTreino.assinatura} alt="Assinatura de quem participou" className="w-full rounded-xl border border-gray-200 bg-white" />}
            {termoTreino.certificadoUrl && (
              termoTreino.certificadoMime?.startsWith('image/') ? (
                <a href={getImageUrl(termoTreino.certificadoUrl)} target="_blank" rel="noopener noreferrer">
                  <img src={getImageUrl(termoTreino.certificadoUrl)} alt={termoTreino.certificadoNome || 'Certificado'} className="w-full rounded-xl border border-gray-200 bg-white" />
                </a>
              ) : (
                <a
                  href={getImageUrl(termoTreino.certificadoUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 border rounded-xl py-3 text-sm font-bold text-lunardeli-red"
                >
                  <FileText size={16} /> {termoTreino.certificadoNome || 'Abrir certificado'}
                </a>
              )
            )}
            <button type="button" onClick={() => setTermoTreino(null)} className="w-full border rounded-xl py-3 text-sm font-bold text-gray-700">Fechar</button>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
};
