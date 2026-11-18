import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { FileDown, Loader2, Printer, Share2, X } from 'lucide-react';
import api from '../../services/api';

type InsumoCat = { id: string; nome: string; tipo: string };

type Linha = {
  id: string;
  data: string;
  tipo: string;
  nome: string;
  unidade?: string | null;
  tipoInsumo: string;
  quantidade: number;
  valor: number;
  fornecedor?: string | null;
  numero?: string | null;
  retiradoPor?: string | null;
  motivo?: string | null;
};

type Curva = { insumoId: string; nome: string; tipoInsumo: string; quantidade: number; valor: number };

type Mes = { mes: string; rotulo: string; entradas: number; saidas: number };

type Filtro = {
  movimento: string;
  de: string;
  ate: string;
  retiradoPor: string;
  fornecedor: string;
  insumoId: string;
  tipoInsumo: string;
  categoria: string;
};

function iso(data: Date) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${data.getFullYear()}-${p(data.getMonth() + 1)}-${p(data.getDate())}`;
}

function filtroInicial(): Filtro {
  const hoje = new Date();
  return {
    movimento: 'ENTRADA',
    de: iso(new Date(hoje.getFullYear(), hoje.getMonth(), 1)),
    ate: iso(hoje),
    retiradoPor: '',
    fornecedor: '',
    insumoId: '',
    tipoInsumo: '',
    categoria: '',
  };
}

function moeda(valor: number) {
  const n = Number(valor);
  return (Number.isFinite(n) ? n : 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function dataCurta(valor: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return '';
  const [ano, mes, dia] = valor.split('-');
  return `${dia}/${mes}/${ano}`;
}

function alturaBarra(valor: number, maior: number) {
  if (maior <= 0 || valor <= 0) return '0px';
  return `${Math.max(4, (valor / maior) * 128)}px`;
}

function GraficoMeses({ meses, carregando }: { meses: Mes[]; carregando: boolean }) {
  const maior = Math.max(0, ...meses.flatMap((mes) => [mes.entradas, mes.saidas]));
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4">
      <p className="text-sm font-bold text-gray-900">Entradas e saídas por mês</p>
      <p className="text-xs text-gray-500 mt-1">Valor de cada mês dentro do período filtrado.</p>
      <div className="flex gap-4 mt-3 text-xs font-bold text-gray-700">
        <span className="inline-flex items-center gap-1.5"><i className="w-3 h-3 rounded-sm bg-lunardeli-red" /> Entrada</span>
        <span className="inline-flex items-center gap-1.5"><i className="w-3 h-3 rounded-sm bg-gray-900" /> Saída</span>
      </div>
      {carregando && meses.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500 flex items-center gap-2"><Loader2 className="animate-spin" size={16} /> Gerando o relatório...</p>
      ) : meses.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">Nenhum mês neste filtro.</p>
      ) : (
        <div className="mt-4 flex items-end gap-2 overflow-x-auto">
          {meses.map((mes) => (
            <div key={mes.mes} className="flex min-w-16 flex-1 flex-col items-center">
              <div className="flex h-32 items-end justify-center gap-1">
                <div
                  className="w-3 rounded-t bg-lunardeli-red"
                  style={{ height: alturaBarra(mes.entradas, maior) }}
                  title={`Entrada ${moeda(mes.entradas)}`}
                />
                <div
                  className="w-3 rounded-t bg-gray-900"
                  style={{ height: alturaBarra(mes.saidas, maior) }}
                  title={`Saída ${moeda(mes.saidas)}`}
                />
              </div>
              <span className="mt-1 text-[10px] font-bold text-gray-500 whitespace-nowrap">{mes.rotulo}</span>
              <span className="text-[10px] text-lunardeli-red">{moeda(mes.entradas)}</span>
              <span className="text-[10px] text-gray-700">{moeda(mes.saidas)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function quando(isoData: string) {
  const data = new Date(isoData);
  if (Number.isNaN(data.getTime())) return '';
  return data.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

const TIPO: Record<string, string> = {
  MATERIAL: 'Material',
  MAO_DE_OBRA: 'Mão de obra',
  EQUIPAMENTO: 'Equipamento',
  EPI: 'EPI',
};

export function RelatorioEstoque({ localId }: { localId: string }) {
  const [filtro, setFiltro] = useState<Filtro>(filtroInicial);
  const [catalogo, setCatalogo] = useState<InsumoCat[]>([]);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [curva, setCurva] = useState<Curva[]>([]);
  const [porMes, setPorMes] = useState<Mes[]>([]);
  const [totais, setTotais] = useState({ entradas: 0, saidas: 0 });
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [opcoes, setOpcoes] = useState(false);
  const [acao, setAcao] = useState<'pdf' | 'share' | 'print' | null>(null);
  const [avisoAcao, setAvisoAcao] = useState('');

  useEffect(() => {
    let vivo = true;
    Promise.all([
      api.get('/catalogo', { params: { tipo: 'MATERIAL' } }),
      api.get('/catalogo', { params: { tipo: 'MAO_DE_OBRA' } }),
      api.get('/catalogo', { params: { tipo: 'EPI' } }),
    ])
      .then(([mat, mo, epi]) => {
        if (!vivo) return;
        const lista = [...(mat.data || []), ...(mo.data || []), ...(epi.data || [])] as InsumoCat[];
        lista.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
        setCatalogo(lista);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  const paramsDe = (atual: Filtro) => ({
    localId,
    movimento: atual.movimento,
    de: atual.de || undefined,
    ate: atual.ate || undefined,
    retiradoPor: atual.retiradoPor.trim() || undefined,
    fornecedor: atual.fornecedor.trim() || undefined,
    insumoId: atual.insumoId || undefined,
    tipoInsumo: atual.tipoInsumo || undefined,
    categoria: atual.categoria || undefined,
  });

  const nomeArquivo = `relatorio-estoque${filtro.de ? `-${filtro.de}` : ''}${filtro.ate ? `-a-${filtro.ate}` : ''}.pdf`;

  const gerar = async (atual = filtro, abrir = false) => {
    setCarregando(true);
    setErro('');
    try {
      const res = await api.get('/estoque/relatorio', {
        timeout: 60000,
        params: paramsDe(atual),
      });
      setLinhas(res.data.linhas || []);
      setCurva(res.data.curva || []);
      setPorMes(res.data.porMes || []);
      setTotais(res.data.totais || { entradas: 0, saidas: 0 });
      if (abrir) {
        setAvisoAcao('');
        setOpcoes(true);
      }
    } catch (err: unknown) {
      const corpo = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: unknown } } }).response?.data?.message
        : undefined;
      setErro(typeof corpo === 'string' && corpo.trim() ? corpo : 'Não foi possível montar o relatório.');
    } finally {
      setCarregando(false);
    }
  };

  const buscarPdf = async () => {
    const res = await api.get('/estoque/relatorio/pdf', {
      timeout: 60000,
      responseType: 'blob',
      params: paramsDe(filtro),
    });
    const tipo = String(res.data?.type || '');
    if (tipo.includes('json') || !res.data?.size || res.data.size < 80) {
      throw new Error('pdf');
    }
    return new Blob([res.data], { type: 'application/pdf' });
  };

  const salvarArquivo = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = nomeArquivo;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };

  const baixarPdf = async () => {
    setAcao('pdf');
    setAvisoAcao('');
    try {
      salvarArquivo(await buscarPdf());
      setAvisoAcao('O PDF foi salvo neste computador.');
    } catch {
      setAvisoAcao('Não foi possível gerar o PDF.');
    } finally {
      setAcao(null);
    }
  };

  const compartilhar = async () => {
    setAcao('share');
    setAvisoAcao('');
    try {
      const blob = await buscarPdf();
      const arquivo = new File([blob], nomeArquivo, { type: 'application/pdf' });
      const podeArquivo =
        typeof navigator.share === 'function' &&
        (!navigator.canShare || navigator.canShare({ files: [arquivo] }));
      if (podeArquivo) {
        await navigator.share({
          title: 'Relatório de estoque',
          text: 'Relatório de estoque do Obra 10.',
          files: [arquivo],
        });
      } else {
        salvarArquivo(blob);
        setAvisoAcao('Este navegador não abre o compartilhar. O PDF foi salvo para você enviar.');
      }
    } catch (err: unknown) {
      const nome = err && typeof err === 'object' && 'name' in err ? String(err.name) : '';
      if (nome !== 'AbortError') setAvisoAcao('Não foi possível compartilhar o relatório.');
    } finally {
      setAcao(null);
    }
  };

  const imprimir = async () => {
    const janela = window.open('', '_blank');
    if (!janela) {
      setAvisoAcao('O navegador bloqueou a janela de impressão. Use o PDF.');
      return;
    }
    setAcao('print');
    setAvisoAcao('');
    try {
      const blob = await buscarPdf();
      const url = URL.createObjectURL(blob);
      janela.location.href = url;
      janela.addEventListener('load', () => {
        setTimeout(() => {
          try {
            janela.focus();
            janela.print();
          } catch {
            /* o PDF continua aberto na outra aba */
          }
        }, 400);
      });
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
      janela.close();
      setAvisoAcao('Não foi possível preparar a impressão.');
    } finally {
      setAcao(null);
    }
  };

  useEffect(() => {
    gerar(filtroInicial()).catch(() => {});
    // O relatório abre no mês corrente, em entradas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localId]);

  const maior = curva[0]?.valor || 0;
  const periodo = [dataCurta(filtro.de), dataCurta(filtro.ate)].filter(Boolean).join(' a ') || 'Período inteiro';
  const movimentoRotulo = filtro.movimento === 'SAIDA' ? 'Saída' : filtro.movimento === 'AMBOS' ? 'Entrada e saída' : 'Entrada';
  const tituloCurva =
    filtro.movimento === 'SAIDA'
      ? 'O que está consumindo mais valor'
      : 'O que está pesando mais em valor, conforme entra';

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
        <p className="text-xs font-bold uppercase text-gray-500">Relatório</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          <select className="border rounded-xl p-2.5 text-sm" value={filtro.movimento} onChange={(e) => setFiltro({ ...filtro, movimento: e.target.value })}>
            <option value="ENTRADA">Entrada</option>
            <option value="SAIDA">Saída</option>
            <option value="AMBOS">Entrada e saída</option>
          </select>
          <input className="border rounded-xl p-2.5 text-sm" type="date" value={filtro.de} onChange={(e) => setFiltro({ ...filtro, de: e.target.value })} aria-label="Início do período" />
          <input className="border rounded-xl p-2.5 text-sm" type="date" value={filtro.ate} onChange={(e) => setFiltro({ ...filtro, ate: e.target.value })} aria-label="Fim do período" />
          <input className="border rounded-xl p-2.5 text-sm" placeholder="Profissional que retirou" value={filtro.retiradoPor} onChange={(e) => setFiltro({ ...filtro, retiradoPor: e.target.value })} />
          <input className="border rounded-xl p-2.5 text-sm" placeholder="Fornecedor" value={filtro.fornecedor} onChange={(e) => setFiltro({ ...filtro, fornecedor: e.target.value })} />
          <select className="border rounded-xl p-2.5 text-sm" value={filtro.insumoId} onChange={(e) => setFiltro({ ...filtro, insumoId: e.target.value })}>
            <option value="">Todos os materiais</option>
            {catalogo.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nome}{item.tipo === 'MAO_DE_OBRA' ? ' · mão de obra' : ''}
              </option>
            ))}
          </select>
          <select className="border rounded-xl p-2.5 text-sm" value={filtro.tipoInsumo} onChange={(e) => setFiltro({ ...filtro, tipoInsumo: e.target.value })}>
            <option value="">Tipo: todos</option>
            <option value="MATERIAL">Material</option>
            <option value="MAO_DE_OBRA">Mão de obra</option>
            <option value="EQUIPAMENTO">Equipamento</option>
            <option value="EPI">EPI</option>
          </select>
          <select className="border rounded-xl p-2.5 text-sm" value={filtro.categoria} onChange={(e) => setFiltro({ ...filtro, categoria: e.target.value })}>
            <option value="">Categoria: todas</option>
            <option value="CONSTRUCAO">Construção</option>
            <option value="LIMPEZA">Limpeza</option>
            <option value="OUTRO">Outro</option>
          </select>
        </div>
        <button type="button" disabled={carregando} onClick={() => void gerar(filtro, true)} className="px-4 py-2.5 rounded-xl text-sm font-bold bg-lunardeli-red text-white disabled:opacity-60">
          {carregando ? 'Gerando o relatório...' : 'Gerar relatório'}
        </button>
        {erro && <p className="text-sm font-bold text-red-600">{erro}</p>}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <p className="text-sm font-bold text-gray-900">{tituloCurva}</p>
        <p className="text-xs text-gray-500 mt-1">
          Entradas usam o valor da nota. Saídas usam o custo médio das entradas daquele insumo.
        </p>
        <div className="flex gap-4 mt-3 text-sm">
          <p>Entradas <span className="font-extrabold">{moeda(totais.entradas)}</span></p>
          <p>Saídas <span className="font-extrabold">{moeda(totais.saidas)}</span></p>
        </div>
        {carregando && curva.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500 flex items-center gap-2"><Loader2 className="animate-spin" size={16} /> Gerando o relatório...</p>
        ) : curva.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">Nenhum movimento neste filtro.</p>
        ) : (
          <ol className="mt-4 space-y-3">
            {curva.map((item, index) => (
              <li key={item.insumoId}>
                <div className="flex justify-between gap-3 text-sm">
                  <span className="font-medium text-gray-900 truncate">
                    {index + 1}. {item.nome}
                    {item.tipoInsumo === 'MAO_DE_OBRA' ? ' · mão de obra' : ''}
                  </span>
                  <span className="font-bold shrink-0">{moeda(item.valor)}</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-2 rounded-full bg-lunardeli-red"
                    style={{ width: `${maior > 0 ? Math.max(4, (item.valor / maior) * 100) : 0}%` }}
                  />
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      <GraficoMeses meses={porMes} carregando={carregando} />

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {carregando && linhas.length === 0 ? (
          <p className="p-8 text-sm text-gray-400 text-center flex items-center justify-center gap-2">
            <Loader2 className="animate-spin" size={16} /> Montando o relatório...
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {linhas.map((linha) => (
              <li key={linha.id} className="p-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-gray-900 truncate">
                    {linha.nome}
                    {linha.tipoInsumo === 'MAO_DE_OBRA' ? ' · mão de obra' : ''}
                  </p>
                  <p className="text-xs text-gray-500">
                    {quando(linha.data)} · {linha.tipo === 'SAIDA' ? 'Saída' : 'Entrada'} · {linha.quantidade} {linha.unidade || ''}
                    {linha.tipoInsumo && linha.tipoInsumo !== 'MATERIAL' ? ` · ${TIPO[linha.tipoInsumo] || linha.tipoInsumo}` : ''}
                  </p>
                  <p className="text-xs text-gray-500">
                    {linha.fornecedor ? `Fornecedor ${linha.fornecedor}` : ''}
                    {linha.numero ? ` · nota ${linha.numero}` : ''}
                    {linha.retiradoPor ? ` · retirou ${linha.retiradoPor}` : ''}
                    {linha.motivo ? ` · ${linha.motivo}` : ''}
                  </p>
                </div>
                <span className="font-extrabold text-gray-900 shrink-0">{moeda(linha.valor)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {opcoes &&
        createPortal(
          <div className="fixed inset-0 z-[200] bg-black/50 flex items-end sm:items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-md p-5 shadow-xl" role="dialog" aria-label="Opções do relatório">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase text-lunardeli-red">Relatório pronto</p>
                  <h2 className="text-lg font-extrabold text-gray-900 mt-1">Como você quer usar?</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    {periodo} · {movimentoRotulo} · {linhas.length} movimento{linhas.length === 1 ? '' : 's'}
                  </p>
                  <p className="text-sm text-gray-700 mt-1">
                    Entradas <span className="font-extrabold">{moeda(totais.entradas)}</span>
                    {' · '}
                    Saídas <span className="font-extrabold">{moeda(totais.saidas)}</span>
                  </p>
                </div>
                <button type="button" onClick={() => setOpcoes(false)} aria-label="Fechar" className="p-2 rounded-lg text-gray-500 hover:bg-gray-100">
                  <X size={18} />
                </button>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-2">
                <button
                  type="button"
                  disabled={acao !== null}
                  onClick={() => void compartilhar()}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 px-4 py-3 text-sm font-bold text-gray-900 disabled:opacity-60"
                >
                  {acao === 'share' ? <Loader2 className="animate-spin" size={16} /> : <Share2 size={16} />}
                  Compartilhar
                </button>
                <button
                  type="button"
                  disabled={acao !== null}
                  onClick={() => void baixarPdf()}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-lunardeli-red px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
                >
                  {acao === 'pdf' ? <Loader2 className="animate-spin" size={16} /> : <FileDown size={16} />}
                  Gerar PDF
                </button>
                <button
                  type="button"
                  disabled={acao !== null}
                  onClick={() => void imprimir()}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 px-4 py-3 text-sm font-bold text-gray-900 disabled:opacity-60"
                >
                  {acao === 'print' ? <Loader2 className="animate-spin" size={16} /> : <Printer size={16} />}
                  Imprimir
                </button>
              </div>
              {avisoAcao && <p className="mt-3 text-sm font-bold text-gray-700">{avisoAcao}</p>}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
