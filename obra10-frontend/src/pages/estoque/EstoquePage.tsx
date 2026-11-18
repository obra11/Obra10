import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Camera,
  CheckCircle,
  Loader2,
  Package,
  Plus,
  Printer,
  ScanBarcode,
  Upload,
  X,
  ZoomIn,
} from 'lucide-react';
import api from '../../services/api';
import { getImageUrl } from '../../utils/image';
import { imprimirEtiqueta } from './code128';
import { RelatorioEstoque } from './RelatorioEstoque';

type Modo = 'central' | 'obra';
type TipoOp = 'MATERIAL' | 'MAO_DE_OBRA' | 'EQUIPAMENTO';

const TIPOS_OP: { id: TipoOp; rotulo: string }[] = [
  { id: 'MATERIAL', rotulo: 'Material' },
  { id: 'MAO_DE_OBRA', rotulo: 'Mão de obra' },
  { id: 'EQUIPAMENTO', rotulo: 'Equipamento' },
];

function unidadePadrao(tipo: TipoOp) {
  return tipo === 'MAO_DE_OBRA' ? 'h' : 'un';
}

function textoMedicao(descricao: string) {
  const base = 'Medição de mão de obra no Obra 10.';
  return descricao.trim() ? `${base}\n\n${descricao.trim()}` : base;
}

function abrirWhatsapp(telefone: string, texto: string) {
  const digitos = telefone.replace(/\D/g, '');
  if (digitos.length < 10) return;
  const numero = digitos.startsWith('55') || digitos.length > 11 ? digitos : `55${digitos}`;
  window.open(`https://wa.me/${numero}?text=${encodeURIComponent(texto)}`, '_blank', 'noopener,noreferrer');
}

function abrirEmail(email: string, texto: string) {
  const destino = email.trim();
  if (!destino.includes('@')) return;
  const href = `mailto:${destino}?subject=${encodeURIComponent('Medição de mão de obra')}&body=${encodeURIComponent(texto)}`;
  window.location.href = href;
}

function AcoesContato({ telefone, email, texto }: { telefone: string; email: string; texto: string }) {
  const whats = telefone.replace(/\D/g, '').length >= 10;
  const mail = email.includes('@');
  return (
    <div className="flex flex-wrap gap-2 sm:col-span-2">
      <button type="button" disabled={!whats} onClick={() => abrirWhatsapp(telefone, texto)} className="text-xs font-bold border rounded-lg px-3 py-2 disabled:opacity-40">
        Enviar WhatsApp
      </button>
      <button type="button" disabled={!mail} onClick={() => abrirEmail(email, texto)} className="text-xs font-bold border rounded-lg px-3 py-2 disabled:opacity-40">
        Enviar e-mail
      </button>
    </div>
  );
}

function SeletorTipo({ valor, onChange }: { valor: TipoOp; onChange: (tipo: TipoOp) => void }) {
  return (
    <div className="flex gap-2 overflow-x-auto">
      {TIPOS_OP.map((opcao) => (
        <button
          key={opcao.id}
          type="button"
          onClick={() => onChange(opcao.id)}
          className={`px-4 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap ${
            valor === opcao.id ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'
          }`}
        >
          {opcao.rotulo}
        </button>
      ))}
    </div>
  );
}

type LocalEstoque = {
  id: string;
  nome: string;
  tipo: 'DEPOSITO_CENTRAL' | 'ALMOXARIFADO';
  obraId?: string | null;
};

type Saldo = {
  id: string;
  quantidade: number | string;
  insumo: {
    id: string;
    nome: string;
    unidade?: string | null;
    categoria?: string;
    ean?: string | null;
    codigoBarras?: string | null;
    tipo?: string;
  };
};

type Candidato = { insumoId: string; nome: string; score: number; motivo: string };

type ItemDoc = {
  id: string;
  descricaoOriginal: string;
  quantidade: number | string;
  unidade?: string | null;
  ean?: string | null;
  ncm?: string | null;
  valorUnitario?: number | string | null;
  valorTotal?: number | string | null;
  status: 'PENDENTE' | 'VINCULADO' | 'NOVO' | 'IGNORADO';
  tipoInsumo?: string | null;
  insumoId?: string | null;
  candidatos?: Candidato[] | null;
  insumo?: { id: string; nome: string; unidade?: string | null; codigoBarras?: string | null } | null;
};

type LinhaManual = {
  key: string;
  descricao: string;
  quantidade: string;
  unidade: string;
  valorUnitario: string;
  valorTotal: string;
  ncm: string;
  ean: string;
  tipoInsumo: string;
};

const cabManualInicial = {
  numero: '',
  serie: '',
  chaveAcesso: '',
  dataEmissao: '',
  valorTotal: '',
  fornecedorRazao: '',
  fornecedorCnpj: '',
  fornecedorIe: '',
  fornecedorTelefone: '',
  fornecedorEmail: '',
  observacao: '',
};

function linhaVazia(tipo: TipoOp = 'MATERIAL'): LinhaManual {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    descricao: '',
    quantidade: '1',
    unidade: unidadePadrao(tipo),
    valorUnitario: '',
    valorTotal: '',
    ncm: '',
    ean: '',
    tipoInsumo: tipo,
  };
}

type Documento = {
  id: string;
  tipo: string;
  status: string;
  numero?: string | null;
  serie?: string | null;
  chaveAcesso?: string | null;
  dataEmissao?: string | null;
  valorTotal?: number | string | null;
  localId: string;
  obraId?: string | null;
  imagemUrl?: string | null;
  imagemMime?: string | null;
  observacaoExtracao?: string | null;
  fornecedorCnpj?: string | null;
  fornecedorRazao?: string | null;
  fornecedorIe?: string | null;
  fornecedorTelefone?: string | null;
  fornecedorEmail?: string | null;
  observacao?: string | null;
  rejeitadoMotivo?: string | null;
  createdAt: string;
  recebedor?: { id: string; nome: string };
  local?: { id: string; nome: string; tipo: string };
  itens?: ItemDoc[];
  _count?: { itens: number };
};

type Movimento = {
  id: string;
  tipo: string;
  quantidade: number | string;
  motivo?: string | null;
  retiradoPor?: string | null;
  dataRecebimento?: string | null;
  createdAt: string;
  insumo: { id: string; nome: string; unidade?: string | null; tipo?: string | null };
  funcionario?: { id: string; nome: string; funcao: string } | null;
  localOrigem?: { id: string; nome: string } | null;
  localDestino?: { id: string; nome: string } | null;
  usuario?: { id: string; nome: string } | null;
};

type Painel = null | 'menu' | 'entrada' | 'saida' | 'transferir';

type InsumoCat = {
  id: string;
  nome: string;
  unidade?: string | null;
  tipo: string;
  ean?: string | null;
  codigo?: string | null;
};

const STATUS: Record<string, string> = {
  EXTRAINDO: 'Lendo',
  EM_CONFERENCIA: 'Em conferência',
  CONFIRMADA: 'Confirmada',
  REJEITADA: 'Rejeitada',
  ESTORNADA: 'Estornada',
};

function num(v: number | string | null | undefined) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function moeda(v: number | string | null | undefined) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function semAcento(valor: string) {
  return valor.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function opcoesSaida(saldos: Saldo[], texto: string): InsumoCat[] {
  const opcoes: InsumoCat[] = saldos
    .filter((s) => num(s.quantidade) > 0)
    .map((s) => ({
      id: s.insumo.id,
      nome: s.insumo.nome,
      unidade: `${num(s.quantidade)} ${s.insumo.unidade || ''}`.trim(),
      tipo: s.insumo.tipo || 'MATERIAL',
      ean: s.insumo.ean,
      codigo: s.insumo.codigoBarras,
    }));
  return filtrarCatalogo(opcoes, texto);
}

function filtrarCatalogo(itens: InsumoCat[], texto: string) {
  const tokens = semAcento(texto.trim()).split(/\s+/).filter(Boolean);
  const lista = tokens.length
    ? itens.filter((item) => {
        const alvo = semAcento(`${item.nome} ${item.codigo || ''} ${item.ean || ''}`);
        return tokens.every((token) => alvo.includes(token));
      })
    : itens;
  return lista.slice(0, 30);
}

function ListaCatalogo({
  itens,
  vazio,
  onEscolher,
}: {
  itens: InsumoCat[];
  vazio: string;
  onEscolher: (item: InsumoCat) => void;
}) {
  return (
    <ul className="mt-1 border border-gray-200 rounded-xl max-h-48 overflow-y-auto bg-white shadow-lg">
      <li className="px-3 pt-2 pb-1 text-[11px] font-bold uppercase tracking-wide text-gray-400">Cadastrados</li>
      {itens.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            className="w-full text-left px-3 py-2 text-sm hover:bg-red-50"
            onMouseDown={(e) => {
              e.preventDefault();
              onEscolher(item);
            }}
          >
            <span className="font-medium text-gray-900">{item.nome}</span>
            {item.unidade && <span className="text-gray-500"> · {item.unidade}</span>}
            {item.tipo === 'MAO_DE_OBRA' && <span className="text-gray-500"> · mão de obra</span>}
            {item.tipo === 'EQUIPAMENTO' && <span className="text-gray-500"> · equipamento</span>}
          </button>
        </li>
      ))}
      {itens.length === 0 && <li className="px-3 py-2 text-sm text-gray-500">{vazio}</li>}
    </ul>
  );
}

function msgErro(err: any, fallback: string) {
  const m = err?.response?.data?.message;
  if (Array.isArray(m)) return m.join(' · ');
  if (typeof m === 'string' && m.trim()) return m;
  return fallback;
}

export const EstoquePage: React.FC<{ modo: Modo }> = ({ modo }) => {
  const navigate = useNavigate();
  const { obraId } = useParams();
  const [aba, setAba] = useState<'saldo' | 'entradas' | 'saida' | 'transferir' | 'relatorio'>('saldo');
  const [locais, setLocais] = useState<LocalEstoque[]>([]);
  const [localId, setLocalId] = useState('');
  const [saldos, setSaldos] = useState<Saldo[]>([]);
  const [entradas, setEntradas] = useState<Documento[]>([]);
  const [movimentos, setMovimentos] = useState<Movimento[]>([]);
  const [doc, setDoc] = useState<Documento | null>(null);
  const [catalogo, setCatalogo] = useState<InsumoCat[]>([]);
  const [recebedores, setRecebedores] = useState<{ id: string; nome: string }[]>([]);
  const [obras, setObras] = useState<{ id: string; nome: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [painel, setPainel] = useState<Painel>(null);
  const [enviando, setEnviando] = useState(false);
  const [tipoDoc, setTipoDoc] = useState('NFE');
  const [tipoOperacao, setTipoOperacao] = useState<TipoOp>('MATERIAL');
  const [modoMao, setModoMao] = useState<'funcao' | 'global'>('funcao');
  const [recebedorId, setRecebedorId] = useState('');
  const [destinoId, setDestinoId] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const pdfLido = useRef('');

  const [modoSaida, setModoSaida] = useState<'codigo' | 'manual'>('codigo');
  const [codigoSaida, setCodigoSaida] = useState('');
  const [buscaSaida, setBuscaSaida] = useState('');
  const [saidaAberta, setSaidaAberta] = useState(false);
  const [insumoSaidaId, setInsumoSaidaId] = useState('');
  const [qtdSaida, setQtdSaida] = useState('1');
  const [motivoSaida, setMotivoSaida] = useState('');
  const [retiradoPor, setRetiradoPor] = useState('');
  const [achado, setAchado] = useState<{ nome: string; quantidade: number; unidade?: string | null } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraOn, setCameraOn] = useState(false);

  const [destinoTransf, setDestinoTransf] = useState('');
  const [obraDestino, setObraDestino] = useState('');
  const [insumoTransf, setInsumoTransf] = useState('');
  const [qtdTransf, setQtdTransf] = useState('1');

  const [buscaCat, setBuscaCat] = useState<Record<string, string>>({});
  const [qtdDraft, setQtdDraft] = useState<Record<string, string>>({});
  const [novoItem, setNovoItem] = useState({ descricao: '', quantidade: '1', unidade: 'un', valorUnitario: '', tipoInsumo: 'MATERIAL' });
  const [cabManual, setCabManual] = useState(cabManualInicial);
  const [linhas, setLinhas] = useState<LinhaManual[]>([linhaVazia()]);
  const [linhaBusca, setLinhaBusca] = useState<string | null>(null);

  const carregarLocais = useCallback(async () => {
    const res = await api.get('/estoque/locais', {
      params: modo === 'obra' && obraId ? { obraId } : {},
    });
    const lista: LocalEstoque[] = res.data.locais || [];
    setLocais(lista);
    setLocalId((atual) => {
      if (atual && lista.some((l) => l.id === atual)) return atual;
      const preferido =
        modo === 'obra'
          ? lista.find((l) => l.tipo === 'ALMOXARIFADO')
          : lista.find((l) => l.tipo === 'DEPOSITO_CENTRAL');
      return preferido?.id || lista[0]?.id || '';
    });
  }, [modo, obraId]);

  const carregarPainel = useCallback(async () => {
    if (!localId) return;
    const [saldoRes, entRes, movRes] = await Promise.all([
      api.get('/estoque/saldos', { params: { localId } }),
      api.get('/estoque/entradas', {
        params: modo === 'obra' && obraId ? { obraId } : { localId },
      }),
      api.get('/estoque/movimentos', { params: { localId } }),
    ]);
    setSaldos(saldoRes.data || []);
    setEntradas(entRes.data || []);
    setMovimentos(movRes.data || []);
  }, [localId, modo, obraId]);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        setLoading(true);
        setErro('');
        await carregarLocais();
        const [rec, obrasRes] = await Promise.all([
          api.get('/estoque/recebedores').catch(() => ({ data: [] })),
          modo === 'central' ? api.get('/estoque/obras') : Promise.resolve({ data: [] }),
        ]);
        if (!vivo) return;
        setRecebedores(rec.data || []);
        setObras(obrasRes.data || []);
      } catch (err) {
        if (vivo) setErro(msgErro(err, 'Não foi possível abrir o estoque.'));
      } finally {
        if (vivo) setLoading(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [carregarLocais, modo]);

  useEffect(() => {
    if (!localId) return;
    carregarPainel().catch((err) => setErro(msgErro(err, 'Erro ao carregar o saldo.')));
  }, [localId, carregarPainel]);

  const buscarCatalogo = useCallback(async () => {
    const respostas = await Promise.all([
      ...TIPOS_OP.map((opcao) => api.get('/catalogo', { params: { tipo: opcao.id } })),
      api.get('/catalogo', { params: { tipo: 'EPI' } }),
    ]);
    return respostas.flatMap((res) => res.data || []);
  }, []);

  useEffect(() => {
    if (painel !== 'entrada' || tipoDoc !== 'MANUAL') return;
    let vivo = true;
    buscarCatalogo()
      .then((lista) => { if (vivo) setCatalogo(lista); })
      .catch(() => {});
    return () => { vivo = false; };
  }, [painel, tipoDoc, buscarCatalogo]);

  const relerPdf = async (id: string) => {
    setEnviando(true);
    setErro('');
    setAviso('A Luna está lendo a nota...');
    try {
      const res = await api.post(`/estoque/entradas/${id}/ler`, { tipoInsumo: tipoOperacao }, { timeout: 120000 });
      setDoc(res.data);
      if (res.data.observacaoExtracao) {
        setAviso('');
        setErro(res.data.observacaoExtracao);
      } else {
        setAviso('A Luna preencheu a nota. Confira antes de confirmar.');
      }
    } catch (err) {
      setAviso('');
      setErro(msgErro(err, 'A Luna não conseguiu ler a nota.'));
    } finally {
      setEnviando(false);
    }
  };

  const abrirDoc = async (id: string) => {
    const res = await api.get(`/estoque/entradas/${id}`);
    setDoc(res.data);
    const tipoDoDoc = (res.data.itens || []).find((item: ItemDoc) => item.tipoInsumo)?.tipoInsumo;
    if (tipoDoDoc === 'EPI') setTipoOperacao('MATERIAL');
    else if (tipoDoDoc === 'MATERIAL' || tipoDoDoc === 'MAO_DE_OBRA' || tipoDoDoc === 'EQUIPAMENTO') {
      setTipoOperacao(tipoDoDoc);
    }
    if (!catalogo.length) setCatalogo(await buscarCatalogo());
  };

  useEffect(() => {
    if (!doc?.id) return;
    const arquivo = `${doc.imagemMime || ''} ${doc.imagemUrl || ''}`.toLowerCase();
    const legivel = /pdf|jpeg|jpg|png|webp|gif/.test(arquivo);
    const aviso = doc.observacaoExtracao || '';
    const semLeitura = /não são lidos|indisponível|openai|luna não/i.test(aviso);
    const semItens = !(doc.itens || []).length;
    if (!legivel || !semLeitura || !semItens || pdfLido.current === doc.id) return;
    pdfLido.current = doc.id;
    void relerPdf(doc.id);
  }, [doc]);

  const enviarNota = async (file: File) => {
    if (!destinoId && !localId) {
      setErro('Escolha o local de destino.');
      return;
    }
    setEnviando(true);
    setErro('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('localId', destinoId || localId);
      fd.append('tipo', tipoDoc);
      if (recebedorId) fd.append('recebedorId', recebedorId);
      if (modo === 'obra' && obraId) fd.append('obraId', obraId);
      fd.append('tipoInsumo', tipoOperacao);
      const res = await api.post('/estoque/entradas', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000,
      });
      setPainel(null);
      setDoc(res.data);
      await carregarPainel();
    } catch (err) {
      setErro(msgErro(err, 'Falha ao enviar a nota.'));
    } finally {
      setEnviando(false);
    }
  };

  const atualizarLinha = (key: string, patch: Partial<LinhaManual>) => {
    setLinhas((lista) => lista.map((linha) => {
      if (linha.key !== key) return linha;
      const next = { ...linha, ...patch };
      if (patch.quantidade !== undefined || patch.valorUnitario !== undefined) {
        const qtd = Number(String(next.quantidade).replace(',', '.'));
        const preco = Number(String(next.valorUnitario).replace(',', '.'));
        if (Number.isFinite(qtd) && Number.isFinite(preco)) {
          next.valorTotal = String(Math.round(qtd * preco * 100) / 100);
        }
      }
      return next;
    }));
  };

  const enviarManual = async () => {
    if (!destinoId && !localId) {
      setErro('Escolha o local de destino.');
      return;
    }
    setEnviando(true);
    setErro('');
    try {
      const res = await api.post('/estoque/entradas/manual', {
        localId: destinoId || localId,
        recebedorId: recebedorId || undefined,
        obraId: modo === 'obra' ? obraId : undefined,
        ...cabManual,
        numero: cabManual.numero.trim() || (tipoOperacao === 'MAO_DE_OBRA' ? `MO-${new Date().toISOString().slice(0, 10)}` : cabManual.numero),
        observacao: tipoOperacao === 'MAO_DE_OBRA' ? cabManual.observacao : undefined,
        itens: (tipoOperacao === 'MAO_DE_OBRA' && modoMao === 'global'
          ? [{
              descricao: 'Mão de obra global',
              quantidade: '1',
              unidade: 'vb',
              valorUnitario: cabManual.valorTotal,
              valorTotal: cabManual.valorTotal,
              ncm: '',
              ean: '',
              tipoInsumo: 'MAO_DE_OBRA',
            }]
          : linhas
        ).map((linha) => ({
          descricao: linha.descricao,
          quantidade: linha.quantidade,
          unidade: linha.unidade,
          valorUnitario: linha.valorUnitario,
          valorTotal: linha.valorTotal,
          ncm: linha.ncm,
          ean: linha.ean,
          tipoInsumo: tipoOperacao,
        })),
      });
      setPainel(null);
      setCabManual(cabManualInicial);
      setLinhas([linhaVazia(tipoOperacao)]);
      setDoc(res.data);
      setAba('entradas');
      await carregarPainel();
    } catch (err) {
      setErro(msgErro(err, 'Não foi possível registrar a entrada.'));
    } finally {
      setEnviando(false);
    }
  };

  const resolver = async (
    item: ItemDoc,
    acao: 'VINCULAR' | 'NOVO' | 'IGNORAR',
    insumoId?: string,
    tipo?: string,
  ) => {
    if (!doc) return;
    try {
      const quantidade = Number(qtdDraft[item.id] ?? item.quantidade);
      const res = await api.put(`/estoque/entradas/${doc.id}/itens/${item.id}`, {
        acao,
        insumoId,
        quantidade,
        unidade: item.unidade || undefined,
        tipo,
      });
      setDoc(res.data);
    } catch (err) {
      setErro(msgErro(err, 'Não foi possível atualizar o item.'));
    }
  };

  const aceitarSugestoes = async () => {
    if (!doc) return;
    try {
      const res = await api.post(`/estoque/entradas/${doc.id}/aceitar-sugestoes`);
      setDoc(res.data);
    } catch (err) {
      setErro(msgErro(err, 'Não foi possível aceitar as sugestões.'));
    }
  };

  const salvarCabecalho = async (parcial: Record<string, string>) => {
    if (!doc) return;
    setErro('');
    setEnviando(true);
    try {
      const res = await api.put(`/estoque/entradas/${doc.id}`, parcial);
      setDoc(res.data);
      setAviso('Dados da nota salvos.');
    } catch (err) {
      setErro(msgErro(err, 'Não foi possível salvar os dados da nota. Tente de novo.'));
    } finally {
      setEnviando(false);
    }
  };

  const confirmar = async () => {
    if (!doc) return;
    setEnviando(true);
    try {
      const res = await api.post(`/estoque/entradas/${doc.id}/confirmar`);
      setDoc(res.data);
      setAviso('Entrada confirmada. O saldo foi atualizado.');
      await carregarPainel();
    } catch (err) {
      setErro(msgErro(err, 'Não foi possível confirmar.'));
    } finally {
      setEnviando(false);
    }
  };

  const rejeitar = async () => {
    if (!doc) return;
    const motivo = window.prompt('Motivo da rejeição (opcional)') || '';
    try {
      const res = await api.post(`/estoque/entradas/${doc.id}/rejeitar`, { motivo });
      setDoc(res.data);
      await carregarPainel();
    } catch (err) {
      setErro(msgErro(err, 'Não foi possível rejeitar a entrada.'));
    }
  };

  const estornar = async () => {
    if (!doc) return;
    if (!window.confirm('Estornar esta entrada e baixar o saldo?')) return;
    try {
      const res = await api.post(`/estoque/entradas/${doc.id}/estornar`);
      setDoc(res.data);
      await carregarPainel();
    } catch (err) {
      setErro(msgErro(err, 'Não foi possível estornar.'));
    }
  };

  const adicionarItem = async () => {
    if (!doc || !novoItem.descricao.trim()) return;
    try {
      const res = await api.post(`/estoque/entradas/${doc.id}/itens`, {
        descricao: novoItem.descricao,
        quantidade: Number(novoItem.quantidade) || 1,
        unidade: novoItem.unidade,
        valorUnitario: novoItem.valorUnitario || undefined,
        tipoInsumo: tipoOperacao,
      });
      setDoc(res.data);
      setNovoItem({ descricao: '', quantidade: '1', unidade: unidadePadrao(tipoOperacao), valorUnitario: '', tipoInsumo: tipoOperacao });
    } catch (err) {
      setErro(msgErro(err, 'Não foi possível incluir o item.'));
    }
  };

  const buscarCodigo = async (codigo: string) => {
    if (!codigo.trim() || !localId) return;
    try {
      const res = await api.get('/estoque/insumos/por-codigo', {
        params: { codigo: codigo.trim(), localId },
      });
      if (res.data.insumo.tipo === 'EPI') {
        setAchado(null);
        setErro('A entrega de EPI é feita no RH, com a assinatura de quem recebeu.');
        return;
      }
      if ((res.data.insumo.tipo || 'MATERIAL') !== tipoOperacao) {
        setAchado(null);
        setErro('Esse código pertence a outro tipo. Troque o que vai movimentar.');
        return;
      }
      setAchado({
        nome: res.data.insumo.nome,
        quantidade: res.data.quantidade,
        unidade: res.data.insumo.unidade,
      });
      setErro('');
    } catch (err) {
      setAchado(null);
      setErro(msgErro(err, 'Código não encontrado.'));
    }
  };

  const registrarSaida = async () => {
    if ((modoSaida === 'manual' || ehMao) && !insumoSaidaId) {
      setErro(ehMao ? 'Escolha a função na lista.' : ehEquip ? 'Escolha o equipamento na lista.' : 'Escolha o material na lista.');
      return;
    }
    if (!ehMao && modoSaida === 'codigo' && !codigoSaida.trim()) {
      setErro('Informe o código interno ou o EAN.');
      return;
    }
    setEnviando(true);
    setErro('');
    try {
      await api.post('/estoque/saidas', {
        localId,
        ...(modoSaida === 'manual' ? { insumoId: insumoSaidaId } : { codigo: codigoSaida.trim() }),
        quantidade: Number(qtdSaida),
        motivo: motivoSaida || undefined,
        retiradoPor: retiradoPor || undefined,
      });
      setAviso('Saída registrada.');
      setCodigoSaida('');
      setBuscaSaida('');
      setInsumoSaidaId('');
      setMotivoSaida('');
      setRetiradoPor('');
      setAchado(null);
      setPainel(null);
      setAba('saida');
      pararCamera();
      await carregarPainel();
    } catch (err) {
      setErro(msgErro(err, 'Não foi possível dar saída.'));
    } finally {
      setEnviando(false);
    }
  };

  const pararCamera = () => {
    const video = videoRef.current;
    const stream = video?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((t) => t.stop());
    if (video) video.srcObject = null;
    setCameraOn(false);
  };

  const escolherTipo = (tipo: TipoOp) => {
    setTipoOperacao(tipo);
    setLinhas([linhaVazia(tipo)]);
    setBuscaSaida('');
    setInsumoSaidaId('');
    setAchado(null);
    setSaidaAberta(false);
    setInsumoTransf('');
    setNovoItem({
      descricao: '',
      quantidade: '1',
      unidade: unidadePadrao(tipo),
      valorUnitario: '',
      tipoInsumo: tipo,
    });
    if (tipo === 'MAO_DE_OBRA') {
      setModoSaida('manual');
      pararCamera();
    }
    if (tipo !== 'MATERIAL' && (tipoDoc === 'NFCE_CUPOM' || tipoDoc === 'FOTO')) {
      setTipoDoc('NFE');
    }
  };

  useEffect(() => {
    if (!cameraOn) return;
    const Detector = (window as unknown as {
      BarcodeDetector?: new (opts: { formats: string[] }) => {
        detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]>;
      };
    }).BarcodeDetector;
    if (!Detector || !navigator.mediaDevices?.getUserMedia) {
      setErro('Este navegador não lê código pela câmera. Digite o código.');
      setCameraOn(false);
      return;
    }
    let parado = false;
    let stream: MediaStream | null = null;
    const det = new Detector({ formats: ['code_128', 'ean_13', 'ean_8', 'code_39'] });
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        if (parado) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        const loop = async () => {
          if (parado || !video.srcObject) return;
          try {
            const codes = await det.detect(video);
            const valor = codes[0]?.rawValue;
            if (valor) {
              parado = true;
              setCodigoSaida(valor);
              stream?.getTracks().forEach((t) => t.stop());
              video.srcObject = null;
              setCameraOn(false);
              await buscarCodigo(valor);
              return;
            }
          } catch {
            /* quadro sem código */
          }
          if (!parado) requestAnimationFrame(() => void loop());
        };
        void loop();
      } catch {
        if (!parado) setErro('Não foi possível abrir a câmera.');
        setCameraOn(false);
      }
    })();
    return () => {
      parado = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [cameraOn]);

  const transferir = async () => {
    setEnviando(true);
    try {
      await api.post('/estoque/transferencias', {
        origemLocalId: localId,
        destinoLocalId: obraDestino ? undefined : destinoTransf,
        obraDestinoId: obraDestino || undefined,
        insumoId: insumoTransf,
        quantidade: Number(qtdTransf),
      });
      setAviso('Transferência feita.');
      setPainel(null);
      setAba('transferir');
      await carregarPainel();
      if (modo === 'central') await carregarLocais();
    } catch (err) {
      setErro(msgErro(err, 'Não foi possível transferir.'));
    } finally {
      setEnviando(false);
    }
  };

  const imprimir = async (insumoId: string) => {
    const res = await api.get(`/estoque/insumos/${insumoId}/etiqueta`);
    imprimirEtiqueta(res.data);
  };

  const mesmoTipo = (tipo?: string | null) => {
    const atual = tipo || 'MATERIAL';
    if (tipoOperacao === 'MATERIAL') return atual === 'MATERIAL' || atual === 'EPI';
    return atual === tipoOperacao;
  };
  const catalogoDoTipo = catalogo.filter((item) => mesmoTipo(item.tipo));
  const saldosDoTipo = saldos.filter((item) => mesmoTipo(item.insumo.tipo));
  const saldosParaSaida = saldosDoTipo.filter((item) => item.insumo.tipo !== 'EPI');
  const entradasDoTipo = entradas.filter((item) => {
    const linhasDoc = item.itens || [];
    const tipo = linhasDoc.find((linha) => linha.tipoInsumo)?.tipoInsumo;
    if (tipo) return mesmoTipo(tipo);
    if (!linhasDoc.length) return true;
    return tipoOperacao === 'MATERIAL';
  });
  const saidasDoTipo = movimentos.filter((item) => item.tipo === 'SAIDA' && mesmoTipo(item.insumo?.tipo));
  const transferenciasDoTipo = movimentos.filter((item) => item.tipo === 'TRANSFERENCIA' && mesmoTipo(item.insumo?.tipo));
  const ehMao = tipoOperacao === 'MAO_DE_OBRA';
  const ehEquip = tipoOperacao === 'EQUIPAMENTO';

  const pendentes = useMemo(
    () => (doc?.itens || []).filter((i) => i.status === 'PENDENTE').length,
    [doc],
  );

  const titulo = modo === 'obra' ? 'Almoxarifado da obra' : 'Depósito central';

  return (
    <div className={`bg-gray-50/60 ${modo === 'central' ? 'min-h-screen p-4 md:p-8' : 'p-4 md:p-6'}`}>
      {erro && (
        <div className="fixed top-4 right-4 z-[200] max-w-sm bg-red-600 text-white text-sm font-bold px-4 py-3 rounded-xl shadow-lg">
          {erro}
          <button className="ml-3 underline" onClick={() => setErro('')}>fechar</button>
        </div>
      )}
      {aviso && (
        <div className="fixed top-4 right-4 z-[200] max-w-sm bg-green-600 text-white text-sm font-bold px-4 py-3 rounded-xl shadow-lg">
          {aviso}
          <button className="ml-3 underline" onClick={() => setAviso('')}>fechar</button>
        </div>
      )}

      <div className="bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-gray-100 mb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-lunardeli-red font-bold text-xs uppercase tracking-wider mb-1">
              <Package size={16} /> Materiais
            </div>
            <h1 className="text-2xl font-extrabold text-gray-900">{titulo}</h1>
            <p className="text-sm text-gray-500 mt-1">
              A nota fica arquivada. O saldo só muda depois que quem recebe confirma cada item.
            </p>
          </div>
          {modo === 'central' && (
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2.5 rounded-xl font-bold text-sm"
            >
              <ArrowLeft size={16} /> Voltar
            </button>
          )}
        </div>
        <label className="block mt-4 text-xs font-bold text-gray-600 uppercase">Local</label>
        <select
          className="mt-1 w-full md:max-w-md border border-gray-300 rounded-xl p-3 text-sm font-medium"
          value={localId}
          onChange={(e) => setLocalId(e.target.value)}
        >
          {locais.map((l) => (
            <option key={l.id} value={l.id}>{l.nome}</option>
          ))}
        </select>
        <p className="mt-4 text-xs font-bold text-gray-600 uppercase">O que vai movimentar</p>
        <div className="mt-2">
          <SeletorTipo valor={tipoOperacao} onChange={escolherTipo} />
        </div>
        {modo === 'obra' && obraId && (
          <button
            type="button"
            onClick={() => navigate(`/obras/${obraId}/rh`)}
            className="mt-3 text-sm font-bold text-lunardeli-red"
          >
            Entrega de EPI no RH
          </button>
        )}
      </div>

      {!doc && (
        <div className="flex items-center gap-2 mb-4">
          <div className="flex gap-2 overflow-x-auto flex-1 min-w-0">
            {(
              [
                ['saldo', 'Saldo'],
                ['entradas', 'Entradas'],
                ['saida', 'Saídas'],
                ['transferir', 'Transferências'],
                ['relatorio', 'Relatório'],
              ] as const
            ).map(([id, rotulo]) => (
              <button
                key={id}
                onClick={() => setAba(id)}
                className={`px-4 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap ${
                  aba === id ? 'bg-lunardeli-red text-white' : 'bg-white border border-gray-200 text-gray-700'
                }`}
              >
                {rotulo}
              </button>
            ))}
          </div>
          <button
            onClick={() => setPainel('menu')}
            className="shrink-0 flex items-center gap-2 bg-lunardeli-red text-white font-bold px-4 py-2.5 rounded-xl"
          >
            <Plus size={18} /> Registrar
          </button>
        </div>
      )}

      {loading ? (
        <div className="p-10 text-center text-gray-400 flex items-center justify-center gap-2">
          <Loader2 className="animate-spin" size={18} /> Carregando estoque...
        </div>
      ) : doc ? (
        <Conferencia
          doc={doc}
          locais={locais}
          recebedores={recebedores}
          enviando={enviando}
          pendentes={pendentes}
          qtdDraft={qtdDraft}
          setQtdDraft={setQtdDraft}
          buscaCat={buscaCat}
          setBuscaCat={setBuscaCat}
          catalogo={catalogoDoTipo}
          tipoOperacao={tipoOperacao}
          novoItem={novoItem}
          setNovoItem={setNovoItem}
          onFechar={() => setDoc(null)}
          onResolver={resolver}
          onAceitar={aceitarSugestoes}
          onCabecalho={salvarCabecalho}
          onConfirmar={confirmar}
          onRejeitar={rejeitar}
          onEstornar={estornar}
          onAdd={adicionarItem}
          onEtiqueta={imprimir}
        />
      ) : aba === 'saldo' ? (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {saldosDoTipo.length === 0 ? (
            <p className="p-8 text-sm text-gray-500 text-center">
              {ehMao
                ? 'Nenhuma mão de obra neste local. Lance a entrada da função para começar.'
                : ehEquip
                  ? 'Nenhum equipamento neste local. Lance a entrada para começar.'
                  : 'Nenhum material neste local. Lance uma entrada para começar.'}
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {saldosDoTipo.map((s) => (
                <li key={s.id} className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-gray-900 truncate">
                      {s.insumo.nome}
                      {s.insumo.tipo === 'MAO_DE_OBRA' && <span className="ml-2 text-[10px] font-bold uppercase text-lunardeli-red">Mão de obra</span>}
                      {s.insumo.tipo === 'EQUIPAMENTO' && <span className="ml-2 text-[10px] font-bold uppercase text-lunardeli-red">Equipamento</span>}
                      {s.insumo.tipo === 'EPI' && <span className="ml-2 text-[10px] font-bold uppercase text-lunardeli-red">EPI</span>}
                    </p>
                    <p className="text-xs text-gray-500 font-mono">
                      {s.insumo.codigoBarras || 'sem código'} {s.insumo.ean ? `· EAN ${s.insumo.ean}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-extrabold text-gray-900">
                      {num(s.quantidade)} <span className="text-xs font-bold text-gray-500">{s.insumo.unidade}</span>
                    </span>
                    <button
                      title="Imprimir etiqueta"
                      onClick={() => imprimir(s.insumo.id)}
                      className="p-2.5 rounded-lg bg-gray-100 hover:bg-red-50 text-gray-700"
                    >
                      <Printer size={16} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : aba === 'relatorio' && localId ? (
        <RelatorioEstoque localId={localId} />
      ) : aba === 'entradas' ? (
        <ul className="space-y-2">
          {entradasDoTipo.length === 0 && (
            <p className="p-8 text-sm text-gray-500 text-center bg-white rounded-2xl border border-dashed">Nenhuma entrada deste tipo.</p>
          )}
          {entradasDoTipo.map((e) => (
            <li key={e.id}>
              <button
                onClick={() => abrirDoc(e.id).catch((err) => setErro(msgErro(err, 'Erro ao abrir a nota.')))}
                className="w-full text-left bg-white border border-gray-100 rounded-2xl p-4 hover:border-lunardeli-red/50"
              >
                <div className="flex justify-between gap-2">
                  <span className="font-bold text-gray-900">{e.fornecedorRazao || e.numero || 'Entrada sem número'}</span>
                  <span className="text-xs font-bold uppercase text-lunardeli-red">{STATUS[e.status] || e.status}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {new Date(e.createdAt).toLocaleString('pt-BR')} · {e.local?.nome} · {e._count?.itens ?? 0} itens
                </p>
              </button>
            </li>
          ))}
        </ul>
      ) : aba === 'saida' ? (
        <ul className="space-y-2">
          {saidasDoTipo.length === 0 && (
            <p className="p-8 text-sm text-gray-500 text-center bg-white rounded-2xl border border-dashed">Nenhuma saída deste tipo.</p>
          )}
          {saidasDoTipo.map((item) => (
            <li key={item.id} className="bg-white border border-gray-100 rounded-2xl p-4">
              <div className="flex justify-between gap-2">
                <span className="font-bold text-gray-900">{item.insumo.nome}</span>
                <span className="font-extrabold text-gray-900">{num(item.quantidade)} {item.insumo.unidade || ''}</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {new Date(item.dataRecebimento || item.createdAt).toLocaleString('pt-BR', item.dataRecebimento ? { dateStyle: 'short' } : { dateStyle: 'short', timeStyle: 'short' })}
                {item.funcionario?.nome ? ` · ${item.funcionario.nome}` : item.retiradoPor ? ` · ${item.retiradoPor}` : ''}
                {item.motivo ? ` · ${item.motivo}` : ''}
              </p>
            </li>
          ))}
        </ul>
      ) : aba === 'transferir' ? (
        <ul className="space-y-2">
          {transferenciasDoTipo.length === 0 && (
            <p className="p-8 text-sm text-gray-500 text-center bg-white rounded-2xl border border-dashed">Nenhuma transferência deste tipo.</p>
          )}
          {transferenciasDoTipo.map((item) => (
            <li key={item.id} className="bg-white border border-gray-100 rounded-2xl p-4">
              <div className="flex justify-between gap-2">
                <span className="font-bold text-gray-900">{item.insumo.nome}</span>
                <span className="font-extrabold text-gray-900">{num(item.quantidade)} {item.insumo.unidade || ''}</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {new Date(item.createdAt).toLocaleString('pt-BR')} · {item.localOrigem?.nome || 'origem'} → {item.localDestino?.nome || 'destino'}
              </p>
            </li>
          ))}
        </ul>
      ) : null}

      {painel === 'saida' && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-end md:items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4 max-w-lg w-full max-h-[92vh] overflow-y-auto">
          <div className="flex justify-between items-center gap-3">
            <h2 className="font-bold text-gray-900 flex items-center gap-2">
              {ehMao ? <Package size={18} /> : modoSaida === 'manual' ? <Package size={18} /> : <ScanBarcode size={18} />}
              {ehMao ? 'Saída de mão de obra' : ehEquip ? (modoSaida === 'manual' ? 'Saída de equipamento' : 'Saída por código') : modoSaida === 'manual' ? 'Saída manual' : 'Saída por código'}
            </h2>
            <button type="button" onClick={() => { pararCamera(); setPainel(null); }} aria-label="Fechar"><X size={18} /></button>
          </div>
          {!ehMao && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setModoSaida('codigo'); setErro(''); }}
              className={`px-4 py-2 rounded-xl text-sm font-bold ${modoSaida === 'codigo' ? 'bg-lunardeli-red text-white' : 'bg-gray-100 text-gray-700'}`}
            >
              Por código
            </button>
            <button
              type="button"
              onClick={() => { setModoSaida('manual'); setErro(''); pararCamera(); }}
              className={`px-4 py-2 rounded-xl text-sm font-bold ${modoSaida === 'manual' ? 'bg-lunardeli-red text-white' : 'bg-gray-100 text-gray-700'}`}
            >
              Manual
            </button>
          </div>
          )}
          {!ehMao && modoSaida === 'codigo' ? (
            <>
              <input
                className="w-full border border-gray-300 rounded-xl p-3 text-sm font-mono"
                placeholder="Código interno ou EAN"
                value={codigoSaida}
                onChange={(e) => setCodigoSaida(e.target.value)}
                onBlur={() => buscarCodigo(codigoSaida)}
              />
              <button type="button" onClick={() => setCameraOn(true)} className="inline-flex items-center gap-2 text-sm font-bold text-lunardeli-red">
                <Camera size={16} /> Ler com a câmera
              </button>
              {cameraOn && (
                <div>
                  <video ref={videoRef} className="w-full rounded-xl bg-black max-h-56" muted playsInline />
                  <button onClick={pararCamera} className="mt-2 text-sm font-bold text-gray-600">Parar câmera</button>
                </div>
              )}
            </>
          ) : (
            <div>
              <input
                className="w-full border border-gray-300 rounded-xl p-3 text-sm"
                placeholder={ehMao ? 'Função com horas lançadas' : ehEquip ? 'Equipamento em estoque' : 'Material em estoque'}
                value={buscaSaida}
                onMouseDown={() => setSaidaAberta(true)}
                onFocus={() => setSaidaAberta(true)}
                onBlur={() => setSaidaAberta(false)}
                onChange={(e) => {
                  setBuscaSaida(e.target.value);
                  setInsumoSaidaId('');
                  setAchado(null);
                  setSaidaAberta(true);
                }}
              />
              {saidaAberta && (
                <ListaCatalogo
                  itens={opcoesSaida(saldosParaSaida, buscaSaida)}
                  vazio={buscaSaida.trim() ? 'Nada neste local com esse nome.' : ehMao ? 'Nenhuma função com saldo neste local.' : ehEquip ? 'Nenhum equipamento com saldo neste local.' : 'Nenhum material com saldo neste local.'}
                  onEscolher={(item) => {
                    const saldo = saldos.find((s) => s.insumo.id === item.id);
                    setInsumoSaidaId(item.id);
                    setBuscaSaida(saldo?.insumo.nome || item.nome);
                    setAchado(saldo ? {
                      nome: saldo.insumo.nome,
                      quantidade: num(saldo.quantidade),
                      unidade: saldo.insumo.unidade,
                    } : null);
                    setSaidaAberta(false);
                  }}
                />
              )}
            </div>
          )}
          {achado && (
            <p className="text-sm text-gray-700">
              <strong>{achado.nome}</strong> — saldo {achado.quantidade} {achado.unidade || ''}
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <input className="border border-gray-300 rounded-xl p-3 text-sm" type="number" min="0" step="any" placeholder={ehMao ? 'Horas' : 'Quantidade'} value={qtdSaida} onChange={(e) => setQtdSaida(e.target.value)} />
            <input className="border border-gray-300 rounded-xl p-3 text-sm" placeholder={ehMao ? 'Profissional' : ehEquip ? 'Quem levou' : 'Quem retirou'} value={retiradoPor} onChange={(e) => setRetiradoPor(e.target.value)} />
          </div>
          <input className="w-full border border-gray-300 rounded-xl p-3 text-sm" placeholder={ehMao ? 'Frente de serviço' : 'Motivo'} value={motivoSaida} onChange={(e) => setMotivoSaida(e.target.value)} />
          <button
            disabled={enviando}
            onClick={registrarSaida}
            className="w-full bg-lunardeli-red text-white font-bold rounded-xl py-3 disabled:opacity-60"
          >
            Registrar saída
          </button>
        </div>
        </div>
      )}

      {painel === 'transferir' && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-end md:items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3 max-w-lg w-full max-h-[92vh] overflow-y-auto">
          <div className="flex justify-between items-center gap-3">
            <h2 className="font-bold text-gray-900">
              {ehMao ? 'Transferir mão de obra' : ehEquip ? 'Transferir equipamento' : 'Transferir material'} a partir do local selecionado
            </h2>
            <button type="button" onClick={() => setPainel(null)} aria-label="Fechar"><X size={18} /></button>
          </div>
          {modo === 'central' ? (
            <select className="w-full border rounded-xl p-3 text-sm" value={obraDestino} onChange={(e) => setObraDestino(e.target.value)}>
              <option value="">Escolha a obra de destino</option>
              {obras.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
            </select>
          ) : (
            <select className="w-full border rounded-xl p-3 text-sm" value={destinoTransf} onChange={(e) => setDestinoTransf(e.target.value)}>
              <option value="">Destino</option>
              {locais.filter((l) => l.id !== localId).map((l) => (
                <option key={l.id} value={l.id}>{l.nome}</option>
              ))}
            </select>
          )}
          <select className="w-full border rounded-xl p-3 text-sm" value={insumoTransf} onChange={(e) => setInsumoTransf(e.target.value)}>
            <option value="">{ehMao ? 'Função com saldo de horas' : ehEquip ? 'Equipamento na origem' : 'Material com saldo na origem'}</option>
            {saldosDoTipo.map((s) => (
              <option key={s.insumo.id} value={s.insumo.id}>{s.insumo.nome} ({num(s.quantidade)} {s.insumo.unidade || ''})</option>
            ))}
          </select>
          <input className="w-full border rounded-xl p-3 text-sm" type="number" min="0" step="any" placeholder={ehMao ? 'Horas' : 'Quantidade'} value={qtdTransf} onChange={(e) => setQtdTransf(e.target.value)} />
          <button disabled={enviando} onClick={transferir} className="w-full bg-gray-900 text-white font-bold rounded-xl py-3">
            Transferir
          </button>
        </div>
        </div>
      )}

      {painel === 'menu' && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-end md:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-3">
            <div className="flex justify-between items-center">
              <h2 className="font-bold text-lg">O que vai registrar</h2>
              <button type="button" onClick={() => setPainel(null)} aria-label="Fechar"><X size={18} /></button>
            </div>
            <button
              type="button"
              onClick={() => {
                setDestinoId(localId);
                setTipoDoc('NFE');
                setPainel('entrada');
              }}
              className="w-full bg-lunardeli-red text-white font-bold rounded-xl py-3"
            >
              Entrada
            </button>
            <button
              type="button"
              onClick={() => {
                if (ehMao) setModoSaida('manual');
                setPainel('saida');
              }}
              className="w-full border border-gray-300 text-gray-900 font-bold rounded-xl py-3"
            >
              Saída
            </button>
            <button
              type="button"
              onClick={() => setPainel('transferir')}
              className="w-full border border-gray-300 text-gray-900 font-bold rounded-xl py-3"
            >
              Transferir
            </button>
          </div>
        </div>
      )}

      {painel === 'entrada' && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-end md:items-center justify-center p-4">
          <div className={`bg-white rounded-2xl w-full p-5 space-y-3 max-h-[92vh] overflow-y-auto ${tipoDoc === 'MANUAL' || ehMao ? 'max-w-3xl' : 'max-w-md'}`}>
            <div className="flex justify-between items-center">
              <h2 className="font-bold text-lg">
                {ehMao ? (tipoDoc === 'MANUAL' ? 'Entrada de mão de obra' : 'Nota fiscal de mão de obra') : ehEquip ? (tipoDoc === 'MANUAL' ? 'Entrada de equipamento' : 'Nota ou contrato') : tipoDoc === 'MANUAL' ? 'Entrada manual' : 'Ler nota, cupom ou foto'}
              </h2>
              <button onClick={() => setPainel(null)} aria-label="Fechar"><X size={18} /></button>
            </div>
            <SeletorTipo valor={tipoOperacao} onChange={escolherTipo} />
            <select className="w-full border rounded-xl p-3 text-sm" value={destinoId} onChange={(e) => setDestinoId(e.target.value)}>
              {locais.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
            </select>
            {ehMao ? (
              <select className="w-full border rounded-xl p-3 text-sm" value={tipoDoc === 'MANUAL' ? 'MANUAL' : 'NFE'} onChange={(e) => setTipoDoc(e.target.value)}>
                <option value="NFE">Nota fiscal (foto)</option>
                <option value="MANUAL">Lançamento da medição</option>
              </select>
            ) : ehEquip ? (
              <select className="w-full border rounded-xl p-3 text-sm" value={tipoDoc === 'MANUAL' ? 'MANUAL' : 'NFE'} onChange={(e) => setTipoDoc(e.target.value)}>
                <option value="NFE">Nota ou contrato (foto)</option>
                <option value="MANUAL">Lançamento manual</option>
              </select>
            ) : (
              <select className="w-full border rounded-xl p-3 text-sm" value={tipoDoc} onChange={(e) => setTipoDoc(e.target.value)}>
                <option value="NFE">Nota fiscal (foto)</option>
                <option value="NFCE_CUPOM">Cupom fiscal (foto)</option>
                <option value="FOTO">Foto</option>
                <option value="MANUAL">Entrada manual</option>
              </select>
            )}
            <select className="w-full border rounded-xl p-3 text-sm" value={recebedorId} onChange={(e) => setRecebedorId(e.target.value)}>
              <option value="">Quem recebe: eu</option>
              {recebedores.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
            </select>
            {tipoDoc === 'MANUAL' ? (
              <>
                <p className="text-xs text-gray-500">
                  {ehMao
                    ? 'Informe o empreiteiro, o que foi feito e se a medição é por função ou um valor global.'
                    : ehEquip
                      ? 'Informe o fornecedor, o equipamento e o patrimônio. O saldo só muda depois da conferência.'
                      : 'Preencha a nota e os materiais. O EPI entra por aqui e a entrega ao funcionário é no RH.'}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label className="text-xs font-bold text-gray-500 sm:col-span-2">{ehMao ? 'Empreiteiro ou empresa' : ehEquip ? 'Fornecedor ou locadora' : 'Fornecedor'}
                    <input className="mt-1 w-full border rounded-xl p-2.5 text-sm font-normal" placeholder={ehMao ? 'Quem presta o serviço' : 'Razão social'} value={cabManual.fornecedorRazao} onChange={(e) => setCabManual({ ...cabManual, fornecedorRazao: e.target.value })} />
                  </label>
                  <label className="text-xs font-bold text-gray-500">CNPJ
                    <input className="mt-1 w-full border rounded-xl p-2.5 text-sm font-normal" value={cabManual.fornecedorCnpj} onChange={(e) => setCabManual({ ...cabManual, fornecedorCnpj: e.target.value })} />
                  </label>
                  {!ehMao && !ehEquip && (
                    <label className="text-xs font-bold text-gray-500">Inscrição estadual
                      <input className="mt-1 w-full border rounded-xl p-2.5 text-sm font-normal" value={cabManual.fornecedorIe} onChange={(e) => setCabManual({ ...cabManual, fornecedorIe: e.target.value })} />
                    </label>
                  )}
                  <label className="text-xs font-bold text-gray-500">WhatsApp
                    <input className="mt-1 w-full border rounded-xl p-2.5 text-sm font-normal" placeholder="DDD e número" value={cabManual.fornecedorTelefone} onChange={(e) => setCabManual({ ...cabManual, fornecedorTelefone: e.target.value })} />
                  </label>
                  <label className="text-xs font-bold text-gray-500">E-mail
                    <input className="mt-1 w-full border rounded-xl p-2.5 text-sm font-normal" value={cabManual.fornecedorEmail} onChange={(e) => setCabManual({ ...cabManual, fornecedorEmail: e.target.value })} />
                  </label>
                  <AcoesContato telefone={cabManual.fornecedorTelefone} email={cabManual.fornecedorEmail} texto={textoMedicao(cabManual.observacao)} />
                  <label className="text-xs font-bold text-gray-500">{ehMao ? 'Medição ou recibo' : ehEquip ? 'Nota ou contrato' : 'Número da nota'}
                    <input className="mt-1 w-full border rounded-xl p-2.5 text-sm font-normal" placeholder={ehMao ? 'Opcional' : ''} value={cabManual.numero} onChange={(e) => setCabManual({ ...cabManual, numero: e.target.value })} />
                  </label>
                  {tipoOperacao === 'MATERIAL' && (
                    <label className="text-xs font-bold text-gray-500">Série
                      <input className="mt-1 w-full border rounded-xl p-2.5 text-sm font-normal" value={cabManual.serie} onChange={(e) => setCabManual({ ...cabManual, serie: e.target.value })} />
                    </label>
                  )}
                  <label className="text-xs font-bold text-gray-500">{ehMao ? 'Data do serviço' : 'Data de emissão'}
                    <input type="date" className="mt-1 w-full border rounded-xl p-2.5 text-sm font-normal" value={cabManual.dataEmissao} onChange={(e) => setCabManual({ ...cabManual, dataEmissao: e.target.value })} />
                  </label>
                  <label className="text-xs font-bold text-gray-500">{ehMao ? (modoMao === 'global' ? 'Valor global' : 'Valor do serviço') : 'Valor total'}
                    <input className="mt-1 w-full border rounded-xl p-2.5 text-sm font-normal" inputMode="decimal" placeholder="0,00" value={cabManual.valorTotal} onChange={(e) => setCabManual({ ...cabManual, valorTotal: e.target.value })} />
                  </label>
                  {tipoOperacao === 'MATERIAL' && (
                    <label className="text-xs font-bold text-gray-500 sm:col-span-2">Chave de acesso
                      <input className="mt-1 w-full border rounded-xl p-2.5 text-sm font-normal" placeholder="44 dígitos, se houver" value={cabManual.chaveAcesso} onChange={(e) => setCabManual({ ...cabManual, chaveAcesso: e.target.value })} />
                    </label>
                  )}
                  {ehMao && (
                    <label className="text-xs font-bold text-gray-500 sm:col-span-2">Descrição da medição
                      <textarea className="mt-1 w-full border rounded-xl p-2.5 text-sm font-normal min-h-20" placeholder="O que foi feito e a quem compete esta medição" value={cabManual.observacao} onChange={(e) => setCabManual({ ...cabManual, observacao: e.target.value })} />
                    </label>
                  )}
                </div>
                {ehMao && (
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setModoMao('funcao')} className={`px-4 py-2 rounded-xl text-sm font-bold ${modoMao === 'funcao' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'}`}>Por função</button>
                    <button type="button" onClick={() => setModoMao('global')} className={`px-4 py-2 rounded-xl text-sm font-bold ${modoMao === 'global' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'}`}>Valor global</button>
                  </div>
                )}
                {ehMao && modoMao === 'global' ? (
                  <p className="text-sm text-gray-600">A medição entra como mão de obra global, no valor informado acima, sem detalhar função.</p>
                ) : (
                <div className="space-y-3">
                  {linhas.map((linha, index) => (
                    <div key={linha.key} className="border border-gray-100 rounded-xl p-3 space-y-2">
                      <div className="flex justify-between items-center">
                        <p className="text-xs font-bold uppercase text-gray-500">
                          {ehMao ? 'Função' : ehEquip ? 'Equipamento' : 'Material'} {index + 1}
                        </p>
                        {linhas.length > 1 && (
                          <button type="button" className="text-xs font-bold text-gray-400" onClick={() => setLinhas(linhas.filter((l) => l.key !== linha.key))}>Remover</button>
                        )}
                      </div>
                      <div>
                        <input
                          className="w-full border rounded-xl p-2.5 text-sm"
                          placeholder={ehMao ? 'Função, ex.: pedreiro' : ehEquip ? 'Equipamento, ex.: betoneira' : 'Descrição do material ou EPI'}
                          value={linha.descricao}
                          onMouseDown={() => setLinhaBusca(linha.key)}
                          onFocus={() => setLinhaBusca(linha.key)}
                          onBlur={() => setLinhaBusca((atual) => (atual === linha.key ? null : atual))}
                          onChange={(e) => {
                            atualizarLinha(linha.key, { descricao: e.target.value });
                            setLinhaBusca(linha.key);
                          }}
                        />
                        {linhaBusca === linha.key && (
                          <ul className="mt-1 border border-gray-200 rounded-xl max-h-48 overflow-y-auto bg-white shadow-lg">
                            <li className="px-3 pt-2 pb-1 text-[11px] font-bold uppercase tracking-wide text-gray-400">Cadastrados</li>
                            {filtrarCatalogo(catalogoDoTipo, linha.descricao).map((item) => (
                              <li key={item.id}>
                                <button
                                  type="button"
                                  className="w-full text-left px-3 py-2 text-sm hover:bg-red-50"
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    atualizarLinha(linha.key, {
                                      descricao: item.nome,
                                      unidade: item.unidade || linha.unidade,
                                      ean: item.ean || linha.ean,
                                      tipoInsumo: item.tipo === 'EPI' ? 'EPI' : tipoOperacao,
                                    });
                                    setLinhaBusca(null);
                                  }}
                                >
                                  <span className="font-medium text-gray-900">{item.nome}</span>
                                  {item.unidade && <span className="text-gray-500"> · {item.unidade}</span>}
                                  {item.tipo === 'MAO_DE_OBRA' && <span className="text-gray-500"> · mão de obra</span>}
                                  {item.tipo === 'EQUIPAMENTO' && <span className="text-gray-500"> · equipamento</span>}
                                </button>
                              </li>
                            ))}
                            {filtrarCatalogo(catalogoDoTipo, linha.descricao).length === 0 && (
                              <li className="px-3 py-2 text-sm text-gray-500">
                                {linha.descricao.trim()
                                  ? 'Nada no cadastro com esse nome. A descrição segue como item novo.'
                                  : ehMao ? 'O cadastro ainda não tem funções.' : ehEquip ? 'O cadastro ainda não tem equipamentos.' : 'O cadastro ainda não tem materiais.'}
                              </li>
                            )}
                          </ul>
                        )}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <input className="border rounded-xl p-2.5 text-sm" inputMode="decimal" placeholder={ehMao ? 'Horas ou diárias' : 'Qtd'} value={linha.quantidade} onChange={(e) => atualizarLinha(linha.key, { quantidade: e.target.value })} />
                        <input className="border rounded-xl p-2.5 text-sm" placeholder={ehMao ? 'h ou dia' : 'Unidade'} value={linha.unidade} onChange={(e) => atualizarLinha(linha.key, { unidade: e.target.value })} />
                        <input className="border rounded-xl p-2.5 text-sm" inputMode="decimal" placeholder={ehMao ? 'Valor da hora' : 'Preço unit.'} value={linha.valorUnitario} onChange={(e) => atualizarLinha(linha.key, { valorUnitario: e.target.value })} />
                        <input className="border rounded-xl p-2.5 text-sm" inputMode="decimal" placeholder="Total" value={linha.valorTotal} onChange={(e) => atualizarLinha(linha.key, { valorTotal: e.target.value })} />
                      </div>
                      {ehEquip ? (
                        <input className="w-full border rounded-xl p-2.5 text-sm" placeholder="Patrimônio ou série" value={linha.ncm} onChange={(e) => atualizarLinha(linha.key, { ncm: e.target.value })} />
                      ) : !ehMao ? (
                        <div className="grid grid-cols-2 gap-2">
                          <input className="border rounded-xl p-2.5 text-sm" placeholder="NCM" value={linha.ncm} onChange={(e) => atualizarLinha(linha.key, { ncm: e.target.value })} />
                          <input className="border rounded-xl p-2.5 text-sm" placeholder="EAN" value={linha.ean} onChange={(e) => atualizarLinha(linha.key, { ean: e.target.value })} />
                        </div>
                      ) : null}
                    </div>
                  ))}
                  <button type="button" onClick={() => setLinhas([...linhas, linhaVazia(tipoOperacao)])} className="text-sm font-bold text-lunardeli-red">
                    {ehMao ? '+ Outra função' : ehEquip ? '+ Outro equipamento' : '+ Outro material'}
                  </button>
                </div>
                )}
                {erro && <p className="text-sm text-red-700">{erro}</p>}
                <button
                  disabled={enviando}
                  onClick={() => void enviarManual()}
                  className="w-full flex items-center justify-center gap-2 bg-lunardeli-red text-white font-bold rounded-xl py-3 disabled:opacity-60"
                >
                  {enviando ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle size={18} />}
                  Salvar entrada
                </button>
              </>
            ) : (
              <>
                <input
                  ref={cameraRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void enviarNota(file);
                    e.target.value = '';
                  }}
                />
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void enviarNota(file);
                    e.target.value = '';
                  }}
                />
                <p className="text-xs text-gray-500">Use a câmera do celular, uma foto da galeria ou um PDF.</p>
                <button
                  disabled={enviando}
                  onClick={() => cameraRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 bg-lunardeli-red text-white font-bold rounded-xl py-3 disabled:opacity-60"
                >
                  {enviando ? <Loader2 className="animate-spin" size={18} /> : <Camera size={18} />}
                  {enviando ? 'Lendo a imagem...' : 'Câmera'}
                </button>
                <button
                  disabled={enviando}
                  onClick={() => fileRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 border border-gray-300 text-gray-900 font-bold rounded-xl py-3 disabled:opacity-60"
                >
                  <Upload size={18} /> Galeria ou PDF
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

function AmpliadorNota({ src, aberto, onFechar }: { src: string; aberto: boolean; onFechar: () => void }) {
  const palco = useRef<HTMLDivElement>(null);
  const fechar = useRef(onFechar);
  fechar.current = onFechar;
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const arraste = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const ponteiros = useRef(new Map<number, { x: number; y: number }>());
  const pinca = useRef<{ dist: number; zoom: number } | null>(null);

  const limitar = (valor: number) => Math.min(5, Math.max(1, Number(valor.toFixed(2))));

  useEffect(() => {
    if (!aberto) return;
    setZoom(1);
    setPos({ x: 0, y: 0 });
    const el = palco.current;
    const roda = (evento: WheelEvent) => {
      evento.preventDefault();
      setZoom((atual) => limitar(atual + (evento.deltaY < 0 ? 0.25 : -0.25)));
    };
    const tecla = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') fechar.current();
    };
    el?.addEventListener('wheel', roda, { passive: false });
    window.addEventListener('keydown', tecla);
    return () => {
      el?.removeEventListener('wheel', roda);
      window.removeEventListener('keydown', tecla);
    };
  }, [aberto]);

  if (!aberto) return null;

  const distancia = () => {
    const pontos = [...ponteiros.current.values()];
    if (pontos.length < 2) return 0;
    return Math.hypot(pontos[0].x - pontos[1].x, pontos[0].y - pontos[1].y);
  };

  return createPortal(
    <div className="fixed inset-0 z-[200] bg-black/95 flex flex-col" role="dialog" aria-label="Nota ampliada">
      <div className="flex items-center justify-between gap-3 px-4 py-3 text-white">
        <p className="text-sm font-bold">Arraste para mover. Use + e − para ampliar.</p>
        <div className="flex items-center gap-2 shrink-0">
          <button type="button" onClick={() => setZoom((atual) => limitar(atual - 0.5))} className="w-10 h-10 rounded-full bg-white/15 text-xl font-bold" aria-label="Diminuir">−</button>
          <button type="button" onClick={() => setZoom((atual) => limitar(atual + 0.5))} className="w-10 h-10 rounded-full bg-white text-gray-900 text-xl font-bold" aria-label="Ampliar">+</button>
          <button type="button" onClick={onFechar} className="w-10 h-10 rounded-full bg-white/15 inline-flex items-center justify-center" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
      </div>
      <div
        ref={palco}
        className="flex-1 overflow-hidden flex items-center justify-center touch-none cursor-grab"
        onPointerDown={(evento) => {
          ponteiros.current.set(evento.pointerId, { x: evento.clientX, y: evento.clientY });
          (evento.currentTarget as HTMLDivElement).setPointerCapture(evento.pointerId);
          if (ponteiros.current.size === 2) {
            pinca.current = { dist: distancia(), zoom };
            arraste.current = null;
            return;
          }
          arraste.current = { x: evento.clientX, y: evento.clientY, px: pos.x, py: pos.y };
        }}
        onPointerMove={(evento) => {
          if (!ponteiros.current.has(evento.pointerId)) return;
          ponteiros.current.set(evento.pointerId, { x: evento.clientX, y: evento.clientY });
          if (ponteiros.current.size >= 2 && pinca.current?.dist) {
            const proximo = limitar(pinca.current.zoom * (distancia() / pinca.current.dist));
            setZoom(proximo);
            return;
          }
          if (!arraste.current) return;
          setPos({
            x: arraste.current.px + evento.clientX - arraste.current.x,
            y: arraste.current.py + evento.clientY - arraste.current.y,
          });
        }}
        onPointerUp={(evento) => {
          ponteiros.current.delete(evento.pointerId);
          if (ponteiros.current.size < 2) pinca.current = null;
          if (ponteiros.current.size === 0) arraste.current = null;
        }}
        onPointerCancel={(evento) => {
          ponteiros.current.delete(evento.pointerId);
          pinca.current = null;
          arraste.current = null;
        }}
      >
        <img
          src={src}
          alt="Nota fiscal ampliada"
          draggable={false}
          style={{ transform: `translate(${pos.x}px, ${pos.y}px) scale(${zoom})` }}
          className="max-h-full max-w-full object-contain select-none"
        />
      </div>
    </div>,
    document.body,
  );
}

function Conferencia(props: {
  doc: Documento;
  locais: LocalEstoque[];
  recebedores: { id: string; nome: string }[];
  enviando: boolean;
  pendentes: number;
  qtdDraft: Record<string, string>;
  setQtdDraft: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  buscaCat: Record<string, string>;
  setBuscaCat: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  catalogo: InsumoCat[];
  tipoOperacao: TipoOp;
  novoItem: { descricao: string; quantidade: string; unidade: string; valorUnitario: string; tipoInsumo: string };
  setNovoItem: (v: { descricao: string; quantidade: string; unidade: string; valorUnitario: string; tipoInsumo: string }) => void;
  onFechar: () => void;
  onResolver: (item: ItemDoc, acao: 'VINCULAR' | 'NOVO' | 'IGNORAR', insumoId?: string, tipo?: string) => Promise<void>;
  onAceitar: () => Promise<void>;
  onCabecalho: (parcial: Record<string, string>) => Promise<void>;
  onConfirmar: () => Promise<void>;
  onRejeitar: () => Promise<void>;
  onEstornar: () => Promise<void>;
  onAdd: () => Promise<void>;
  onEtiqueta: (insumoId: string) => Promise<void>;
}) {
  const { doc } = props;
  const aberta = doc.status === 'EM_CONFERENCIA';
  const [ampliada, setAmpliada] = useState(false);
  const [buscaAberta, setBuscaAberta] = useState<string | null>(null);
  const [incluirAberto, setIncluirAberto] = useState(false);
  const comSugestao = (doc.itens || []).filter(
    (item) => item.status === 'PENDENTE' && Array.isArray(item.candidatos) && item.candidatos.length > 0,
  ).length;
  const [cab, setCab] = useState({
    fornecedorRazao: doc.fornecedorRazao || '',
    fornecedorCnpj: doc.fornecedorCnpj || '',
    fornecedorIe: doc.fornecedorIe || '',
    fornecedorTelefone: doc.fornecedorTelefone || '',
    fornecedorEmail: doc.fornecedorEmail || '',
    numero: doc.numero || '',
    serie: doc.serie || '',
    chaveAcesso: doc.chaveAcesso || '',
    dataEmissao: doc.dataEmissao ? doc.dataEmissao.slice(0, 10) : '',
    valorTotal: doc.valorTotal != null ? String(doc.valorTotal) : '',
    observacao: doc.observacao || '',
    localId: doc.localId,
    recebedorId: doc.recebedor?.id || '',
  });

  useEffect(() => {
    setCab({
      fornecedorRazao: doc.fornecedorRazao || '',
      fornecedorCnpj: doc.fornecedorCnpj || '',
      fornecedorIe: doc.fornecedorIe || '',
      fornecedorTelefone: doc.fornecedorTelefone || '',
      fornecedorEmail: doc.fornecedorEmail || '',
      numero: doc.numero || '',
      serie: doc.serie || '',
      chaveAcesso: doc.chaveAcesso || '',
      dataEmissao: doc.dataEmissao ? doc.dataEmissao.slice(0, 10) : '',
      valorTotal: doc.valorTotal != null ? String(doc.valorTotal) : '',
      observacao: doc.observacao || '',
      localId: doc.localId,
      recebedorId: doc.recebedor?.id || '',
    });
  }, [doc.id, doc.fornecedorRazao, doc.fornecedorCnpj, doc.fornecedorIe, doc.fornecedorTelefone, doc.fornecedorEmail, doc.numero, doc.serie, doc.chaveAcesso, doc.dataEmissao, doc.valorTotal, doc.observacao, doc.localId, doc.recebedor?.id]);

  const pdf = (doc.imagemMime || '').includes('pdf') || (doc.imagemUrl || '').toLowerCase().endsWith('.pdf');

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-bold">Nota arquivada</h2>
          <button onClick={props.onFechar} className="text-sm font-bold text-gray-500">Voltar</button>
        </div>
        {pdf && doc.imagemUrl ? (
          <a className="text-lunardeli-red font-bold text-sm" href={getImageUrl(doc.imagemUrl)} target="_blank" rel="noreferrer">
            Abrir PDF da nota
          </a>
        ) : doc.imagemUrl ? (
          <>
            <button type="button" onClick={() => setAmpliada(true)} className="relative block w-full cursor-zoom-in">
              <img src={getImageUrl(doc.imagemUrl)} alt="Nota fiscal" className="w-full rounded-xl border max-h-[480px] object-contain bg-gray-50" />
              <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 bg-gray-900/80 text-white text-xs font-bold px-3 py-1.5 rounded-full">
                <ZoomIn size={14} /> Ampliar
              </span>
            </button>
            <AmpliadorNota src={getImageUrl(doc.imagemUrl)} aberto={ampliada} onFechar={() => setAmpliada(false)} />
          </>
        ) : (
          <p className="text-sm text-gray-500">Entrada preenchida à mão, sem arquivo.</p>
        )}
        {doc.observacaoExtracao && (
          <p className="mt-3 text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-xl p-3">{doc.observacaoExtracao}</p>
        )}
        <p className="mt-3 text-xs font-bold uppercase text-lunardeli-red">{STATUS[doc.status] || doc.status}</p>
      </div>

      <div className="space-y-3">
        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-2">
          <input className="w-full border rounded-xl p-2.5 text-sm" placeholder="Fornecedor" value={cab.fornecedorRazao} disabled={!aberta} onChange={(e) => setCab({ ...cab, fornecedorRazao: e.target.value })} />
          <input className="w-full border rounded-xl p-2.5 text-sm" placeholder="CNPJ" value={cab.fornecedorCnpj} disabled={!aberta} onChange={(e) => setCab({ ...cab, fornecedorCnpj: e.target.value })} />
          <input className="w-full border rounded-xl p-2.5 text-sm" placeholder="Inscrição estadual" value={cab.fornecedorIe} disabled={!aberta} onChange={(e) => setCab({ ...cab, fornecedorIe: e.target.value })} />
          <input className="w-full border rounded-xl p-2.5 text-sm" placeholder="WhatsApp" value={cab.fornecedorTelefone} disabled={!aberta} onChange={(e) => setCab({ ...cab, fornecedorTelefone: e.target.value })} />
          <input className="w-full border rounded-xl p-2.5 text-sm" placeholder="E-mail" value={cab.fornecedorEmail} disabled={!aberta} onChange={(e) => setCab({ ...cab, fornecedorEmail: e.target.value })} />
          <AcoesContato telefone={cab.fornecedorTelefone} email={cab.fornecedorEmail} texto={textoMedicao(cab.observacao)} />
          {props.tipoOperacao === 'MAO_DE_OBRA' && (
            <textarea className="w-full border rounded-xl p-2.5 text-sm min-h-20" placeholder="O que foi feito e a quem compete esta medição" value={cab.observacao} disabled={!aberta} onChange={(e) => setCab({ ...cab, observacao: e.target.value })} />
          )}
          <input className="w-full border rounded-xl p-2.5 text-sm" placeholder="Número da nota" value={cab.numero} disabled={!aberta} onChange={(e) => setCab({ ...cab, numero: e.target.value })} />
          <input className="w-full border rounded-xl p-2.5 text-sm" placeholder="Série" value={cab.serie} disabled={!aberta} onChange={(e) => setCab({ ...cab, serie: e.target.value })} />
          <input className="w-full border rounded-xl p-2.5 text-sm" type="date" value={cab.dataEmissao} disabled={!aberta} onChange={(e) => setCab({ ...cab, dataEmissao: e.target.value })} />
          <input className="w-full border rounded-xl p-2.5 text-sm" placeholder="Chave de acesso" value={cab.chaveAcesso} disabled={!aberta} onChange={(e) => setCab({ ...cab, chaveAcesso: e.target.value })} />
          <input className="w-full border rounded-xl p-2.5 text-sm" placeholder="Valor total" value={cab.valorTotal} disabled={!aberta} onChange={(e) => setCab({ ...cab, valorTotal: e.target.value })} />
          <select className="w-full border rounded-xl p-2.5 text-sm" value={cab.localId} disabled={!aberta} onChange={(e) => setCab({ ...cab, localId: e.target.value })}>
            {props.locais.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
          </select>
          <select className="w-full border rounded-xl p-2.5 text-sm" value={cab.recebedorId} disabled={!aberta} onChange={(e) => setCab({ ...cab, recebedorId: e.target.value })}>
            <option value="">Recebedor</option>
            {props.recebedores.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
          </select>
          {aberta && (
            <button
              type="button"
              disabled={props.enviando}
              onClick={() => props.onCabecalho(cab)}
              className="text-sm font-bold text-lunardeli-red disabled:opacity-50"
            >
              {props.enviando ? 'Salvando...' : 'Salvar dados da nota'}
            </button>
          )}
        </div>

        {aberta && comSugestao > 0 && (
          <button onClick={() => props.onAceitar()} className="text-sm font-bold bg-gray-900 text-white rounded-xl px-4 py-2.5">
            Aceitar sugestões ({comSugestao})
          </button>
        )}

        <ul className="space-y-3">
          {(doc.itens || []).map((item) => (
            <li key={item.id} className="bg-white rounded-2xl border border-gray-100 p-4 space-y-2">
              <div className="flex justify-between gap-2">
                <p className="font-bold text-gray-900">{item.descricaoOriginal}</p>
                <span className="text-[11px] font-bold uppercase text-gray-500">{item.status}</span>
              </div>
              <div className="flex gap-2">
                <input
                  className="w-24 border rounded-lg p-2 text-sm"
                  value={props.qtdDraft[item.id] ?? String(num(item.quantidade))}
                  disabled={!aberta}
                  onChange={(e) => props.setQtdDraft((d) => ({ ...d, [item.id]: e.target.value }))}
                />
                <span className="text-sm text-gray-500 self-center">{item.unidade || 'un'}</span>
                {(item.valorUnitario != null || item.valorTotal != null) && (
                  <span className="text-sm text-gray-700 self-center">
                    {item.valorUnitario != null ? `${moeda(item.valorUnitario)} un` : ''}
                    {item.valorTotal != null ? ` · ${moeda(item.valorTotal)}` : ''}
                  </span>
                )}
              </div>
              {item.insumo && (
                <p className="text-xs text-green-700">
                  {item.status === 'NOVO' ? 'Novo no cadastro' : 'Vinculado a'} {item.insumo.nome}
                  {item.insumo.codigoBarras ? ` · ${item.insumo.codigoBarras}` : ''}
                </p>
              )}
              {aberta && Array.isArray(item.candidatos) && item.candidatos.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {item.candidatos.map((c) => (
                    <button
                      key={c.insumoId}
                      onClick={() => props.onResolver(item, 'VINCULAR', c.insumoId)}
                      className="text-xs font-bold bg-red-50 text-lunardeli-red rounded-lg px-2 py-1.5"
                    >
                      {c.nome} · {Math.round(c.score * 100)}%
                    </button>
                  ))}
                </div>
              )}
              {aberta && (
                <>
                  <input
                    className="w-full border rounded-lg p-2 text-sm"
                    placeholder="Buscar outro insumo do cadastro"
                    value={props.buscaCat[item.id] || ''}
                    onMouseDown={() => setBuscaAberta(item.id)}
                    onFocus={() => setBuscaAberta(item.id)}
                    onBlur={() => setBuscaAberta((atual) => (atual === item.id ? null : atual))}
                    onChange={(e) => {
                      props.setBuscaCat((d) => ({ ...d, [item.id]: e.target.value }));
                      setBuscaAberta(item.id);
                    }}
                  />
                  {buscaAberta === item.id && (
                    <ListaCatalogo
                      itens={filtrarCatalogo(props.catalogo, props.buscaCat[item.id] || '')}
                      vazio={(props.buscaCat[item.id] || '').trim()
                        ? 'Nada no cadastro com esse nome.'
                        : 'O cadastro ainda não tem materiais.'}
                      onEscolher={(escolhido) => {
                        setBuscaAberta(null);
                        props.setBuscaCat((d) => ({ ...d, [item.id]: '' }));
                        void props.onResolver(item, 'VINCULAR', escolhido.id);
                      }}
                    />
                  )}
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => props.onResolver(item, 'NOVO', undefined, item.tipoInsumo === 'EPI' ? 'EPI' : props.tipoOperacao)} className="text-xs font-bold border rounded-lg px-3 py-2">
                      {item.tipoInsumo === 'EPI' ? 'Cadastrar EPI' : props.tipoOperacao === 'MAO_DE_OBRA' ? 'Cadastrar função' : props.tipoOperacao === 'EQUIPAMENTO' ? 'Cadastrar equipamento' : 'Cadastrar material'}
                    </button>
                    <button onClick={() => props.onResolver(item, 'IGNORAR')} className="text-xs font-bold border rounded-lg px-3 py-2 text-gray-500">Ignorar</button>
                  </div>
                </>
              )}
              {item.insumoId && item.insumo?.codigoBarras && (
                <button onClick={() => props.onEtiqueta(item.insumoId!)} className="text-xs font-bold inline-flex items-center gap-1 text-gray-700">
                  <Printer size={12} /> Etiqueta
                </button>
              )}
            </li>
          ))}
        </ul>

        {aberta && (
          <div className="bg-white rounded-2xl border border-dashed p-4 space-y-2">
            <p className="text-xs font-bold uppercase text-gray-500">
              {props.tipoOperacao === 'MAO_DE_OBRA' ? 'Incluir função' : props.tipoOperacao === 'EQUIPAMENTO' ? 'Incluir equipamento' : 'Incluir item na mão'}
            </p>
            <div>
              <input
                className="w-full border rounded-xl p-2.5 text-sm"
                placeholder={props.tipoOperacao === 'MAO_DE_OBRA' ? 'Função' : props.tipoOperacao === 'EQUIPAMENTO' ? 'Equipamento' : 'Descrição'}
                value={props.novoItem.descricao}
                onMouseDown={() => setIncluirAberto(true)}
                onFocus={() => setIncluirAberto(true)}
                onBlur={() => setIncluirAberto(false)}
                onChange={(e) => {
                  props.setNovoItem({ ...props.novoItem, descricao: e.target.value });
                  setIncluirAberto(true);
                }}
              />
              {incluirAberto && (
                <ListaCatalogo
                  itens={filtrarCatalogo(props.catalogo, props.novoItem.descricao)}
                  vazio={props.novoItem.descricao.trim()
                    ? 'Nada no cadastro com esse nome. A descrição segue como item novo.'
                    : 'O cadastro ainda não tem materiais.'}
                  onEscolher={(escolhido) => {
                    props.setNovoItem({
                      ...props.novoItem,
                      descricao: escolhido.nome,
                      unidade: escolhido.unidade || props.novoItem.unidade,
                      tipoInsumo: props.tipoOperacao,
                    });
                    setIncluirAberto(false);
                  }}
                />
              )}
            </div>
            <div className="flex gap-2">
              <input className="w-24 border rounded-xl p-2.5 text-sm" value={props.novoItem.quantidade} onChange={(e) => props.setNovoItem({ ...props.novoItem, quantidade: e.target.value })} />
              <input className="w-20 border rounded-xl p-2.5 text-sm" value={props.novoItem.unidade} onChange={(e) => props.setNovoItem({ ...props.novoItem, unidade: e.target.value })} />
              <input className="flex-1 border rounded-xl p-2.5 text-sm" inputMode="decimal" placeholder={props.tipoOperacao === 'MAO_DE_OBRA' ? 'Valor da hora' : 'Preço unit.'} value={props.novoItem.valorUnitario} onChange={(e) => props.setNovoItem({ ...props.novoItem, valorUnitario: e.target.value })} />
            </div>
            <button onClick={() => props.onAdd()} className="text-sm font-bold text-lunardeli-red">Adicionar item</button>
          </div>
        )}

        {aberta && (
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              disabled={props.enviando || props.pendentes > 0}
              onClick={() => props.onConfirmar()}
              className="flex-1 inline-flex justify-center items-center gap-2 bg-lunardeli-red text-white font-bold rounded-xl py-3 disabled:opacity-50"
            >
              <CheckCircle size={16} /> Confirmar entrada
            </button>
            <button onClick={() => props.onRejeitar()} className="px-4 py-3 rounded-xl border font-bold text-sm">Rejeitar</button>
          </div>
        )}
        {doc.status === 'CONFIRMADA' && (
          <button onClick={() => props.onEstornar()} className="text-sm font-bold text-red-700">Estornar entrada</button>
        )}
        {aberta && props.pendentes > 0 && (
          <p className="text-xs text-gray-500">Confirme cada linha: vincule ao cadastro, cadastre como novo ou ignore. A unidade não é convertida.</p>
        )}
      </div>
    </div>
  );
}
