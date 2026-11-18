import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

type LinhaPdf = {
  data: string | Date;
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

type CurvaPdf = { nome: string; tipoInsumo: string; quantidade: number; valor: number };
type MesPdf = { rotulo: string; entradas: number; saidas: number };

export type DadosPdfRelatorio = {
  empresa: string;
  local: string;
  movimento: string;
  de?: string;
  ate?: string;
  filtros: string[];
  linhas: LinhaPdf[];
  curva: CurvaPdf[];
  porMes: MesPdf[];
  totais: { entradas: number; saidas: number };
};

const VERMELHO = rgb(0.898, 0.098, 0.173);
const ESCURO = rgb(0.11, 0.11, 0.11);
const CINZA = rgb(0.35, 0.35, 0.35);
const BRANCO = rgb(1, 1, 1);
const LINHA = rgb(0.9, 0.9, 0.9);

const LARGURA = 595.28;
const ALTURA = 841.89;
const MARGEM = 36;

function san(valor: unknown) {
  return String(valor ?? '')
    .replace(/[‐‑–—]/g, '-')
    .replace(/[\r\n\t]/g, ' ')
    .replace(/[\u007F-\u009F]/g, '')
    .replace(/[^\u0020-\u00FF]/g, '')
    .replace(/ {2,}/g, ' ')
    .trim();
}

function moeda(valor: number) {
  const n = Number.isFinite(valor) ? valor : 0;
  const negativo = n < 0;
  const [inteiro, frac] = Math.abs(n).toFixed(2).split('.');
  const mil = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${negativo ? '-' : ''}R$ ${mil},${frac}`;
}

function qtd(valor: number) {
  const n = Number.isFinite(valor) ? valor : 0;
  const texto = n.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
  const [inteiro, frac] = texto.split('.');
  const mil = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return frac ? `${mil},${frac}` : mil;
}

function dataBr(valor?: string) {
  if (!valor || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return '';
  const [ano, mes, dia] = valor.split('-');
  return `${dia}/${mes}/${ano}`;
}

function quando(valor: string | Date) {
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return '';
  const partes = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(data);
  const pegar = (tipo: string) => partes.find((parte) => parte.type === tipo)?.value || '';
  return `${pegar('day')}/${pegar('month')}/${pegar('year')} ${pegar('hour')}:${pegar('minute')}`;
}

function cortar(texto: string, fonte: { widthOfTextAtSize: (t: string, s: number) => number }, tamanho: number, largura: number) {
  const limpo = san(texto);
  if (fonte.widthOfTextAtSize(limpo, tamanho) <= largura) return limpo;
  let fim = limpo.length;
  while (fim > 1 && fonte.widthOfTextAtSize(`${limpo.slice(0, fim)}...`, tamanho) > largura) fim -= 1;
  return `${limpo.slice(0, fim)}...`;
}

export async function gerarPdfRelatorio(dados: DadosPdfRelatorio): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const negrito = await pdf.embedFont(StandardFonts.HelveticaBold);
  let pagina = pdf.addPage([LARGURA, ALTURA]);
  let y = ALTURA - 64;

  const novaPagina = () => {
    pagina = pdf.addPage([LARGURA, ALTURA]);
    y = ALTURA - 48;
    pagina.drawText('Relatório de estoque', { x: MARGEM, y: ALTURA - 28, size: 10, font: negrito, color: VERMELHO });
  };

  const espaco = (altura: number) => {
    if (y - altura < 42) novaPagina();
  };

  const texto = (
    valor: string,
    x: number,
    tamanho: number,
    fonte: typeof regular,
    cor = ESCURO,
  ) => {
    pagina.drawText(san(valor) || '-', { x, y, size: tamanho, font: fonte, color: cor });
  };

  pagina.drawRectangle({ x: 0, y: ALTURA - 46, width: LARGURA, height: 46, color: VERMELHO });
  pagina.drawText('OBRA 10', { x: MARGEM, y: ALTURA - 28, size: 11, font: negrito, color: BRANCO });
  pagina.drawText('Relatório de estoque', {
    x: MARGEM + 72,
    y: ALTURA - 29,
    size: 14,
    font: negrito,
    color: BRANCO,
  });

  const periodo = [dataBr(dados.de), dataBr(dados.ate)].filter(Boolean).join(' a ') || 'Período inteiro';
  texto(dados.empresa, MARGEM, 11, negrito);
  y -= 16;
  texto(dados.local, MARGEM, 10, regular);
  y -= 14;
  texto(`${periodo} · ${dados.movimento}`, MARGEM, 10, regular, CINZA);
  for (const filtro of dados.filtros) {
    y -= 13;
    texto(filtro, MARGEM, 9, regular, CINZA);
  }

  y -= 22;
  espaco(36);
  texto(`Entradas ${moeda(dados.totais.entradas)}`, MARGEM, 12, negrito);
  texto(`Saídas ${moeda(dados.totais.saidas)}`, 280, 12, negrito);
  y -= 24;

  espaco(20);
  texto(
    dados.movimento === 'Saída' ? 'O que está consumindo mais valor' : 'O que está pesando mais em valor',
    MARGEM,
    11,
    negrito,
  );
  y -= 16;
  if (dados.curva.length === 0) {
    texto('Nenhum movimento neste filtro.', MARGEM, 10, regular, CINZA);
    y -= 16;
  } else {
    dados.curva.forEach((item, indice) => {
      espaco(14);
      const nome = cortar(
        `${indice + 1}. ${item.nome}${item.tipoInsumo === 'MAO_DE_OBRA' ? ' · mão de obra' : ''}`,
        regular,
        9,
        400,
      );
      pagina.drawText(nome, { x: MARGEM, y, size: 9, font: regular, color: ESCURO });
      const valor = moeda(item.valor);
      const largura = negrito.widthOfTextAtSize(valor, 9);
      pagina.drawText(valor, { x: LARGURA - MARGEM - largura, y, size: 9, font: negrito, color: ESCURO });
      y -= 14;
    });
  }

  y -= 8;
  espaco(20);
  texto('Entradas e saídas por mês', MARGEM, 11, negrito);
  y -= 16;
  if (dados.porMes.length === 0) {
    texto('Nenhum mês neste filtro.', MARGEM, 10, regular, CINZA);
    y -= 16;
  } else {
    for (const mes of dados.porMes) {
      espaco(14);
      pagina.drawText(san(mes.rotulo), { x: MARGEM, y, size: 9, font: regular, color: ESCURO });
      pagina.drawText(`Entrada ${moeda(mes.entradas)}`, { x: 140, y, size: 9, font: regular, color: VERMELHO });
      pagina.drawText(`Saída ${moeda(mes.saidas)}`, { x: 320, y, size: 9, font: regular, color: ESCURO });
      y -= 14;
    }
  }

  y -= 8;
  espaco(28);
  texto('Movimentos', MARGEM, 11, negrito);
  y -= 16;
  const cabecalho = () => {
    espaco(16);
    pagina.drawRectangle({ x: MARGEM, y: y - 4, width: LARGURA - MARGEM * 2, height: 16, color: LINHA });
    pagina.drawText('Data', { x: MARGEM + 4, y, size: 8, font: negrito, color: ESCURO });
    pagina.drawText('Item', { x: 128, y, size: 8, font: negrito, color: ESCURO });
    pagina.drawText('Qtd', { x: 400, y, size: 8, font: negrito, color: ESCURO });
    pagina.drawText('Valor', { x: 470, y, size: 8, font: negrito, color: ESCURO });
    y -= 16;
  };
  cabecalho();

  if (dados.linhas.length === 0) {
    texto('Nenhum movimento neste filtro.', MARGEM, 10, regular, CINZA);
  } else {
    for (const linha of dados.linhas) {
      if (y < 58) {
        novaPagina();
        cabecalho();
      }
      const detalhe = [
        linha.tipo === 'SAIDA' ? 'Saída' : 'Entrada',
        linha.fornecedor ? linha.fornecedor : '',
        linha.numero ? `nota ${linha.numero}` : '',
        linha.retiradoPor ? `retirou ${linha.retiradoPor}` : '',
        linha.motivo || '',
      ]
        .filter(Boolean)
        .join(' · ');
      pagina.drawText(san(quando(linha.data)), { x: MARGEM + 4, y, size: 8, font: regular, color: ESCURO });
      pagina.drawText(cortar(linha.nome, regular, 8, 260), { x: 128, y, size: 8, font: regular, color: ESCURO });
      pagina.drawText(san(`${qtd(linha.quantidade)} ${linha.unidade || ''}`), {
        x: 400,
        y,
        size: 8,
        font: regular,
        color: ESCURO,
      });
      pagina.drawText(moeda(linha.valor), { x: 470, y, size: 8, font: negrito, color: ESCURO });
      y -= 11;
      if (detalhe) {
        pagina.drawText(cortar(detalhe, regular, 7, 500), { x: 128, y, size: 7, font: regular, color: CINZA });
        y -= 12;
      } else {
        y -= 4;
      }
    }
  }

  const paginas = pdf.getPages();
  paginas.forEach((folha, indice) => {
    folha.drawText(`Página ${indice + 1} de ${paginas.length}`, {
      x: MARGEM,
      y: 22,
      size: 8,
      font: regular,
      color: CINZA,
    });
  });

  return Buffer.from(await pdf.save());
}
