import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export type DadosTermoEpi = {
  empresa: string;
  local: string;
  funcionario: string;
  funcao: string;
  epi: string;
  unidade: string;
  quantidade: number;
  dataRecebimento?: string | null;
  validadeEpi?: string | null;
  ca?: string | null;
  assinatura?: string | null;
};

const VERMELHO = rgb(0.898, 0.098, 0.173);
const ESCURO = rgb(0.11, 0.11, 0.11);
const CINZA = rgb(0.35, 0.35, 0.35);
const BRANCO = rgb(1, 1, 1);
const LARGURA = 595.28;
const ALTURA = 841.89;
const MARGEM = 48;

function san(valor: unknown) {
  return String(valor ?? '')
    .replace(/[‐‑–—]/g, '-')
    .replace(/[\r\n\t]/g, ' ')
    .replace(/[\u007F-\u009F]/g, '')
    .replace(/[^\u0020-\u00FF]/g, '')
    .replace(/ {2,}/g, ' ')
    .trim();
}

function dataBr(valor?: string | null) {
  if (!valor || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return '';
  const [ano, mes, dia] = valor.split('-');
  return `${dia}/${mes}/${ano}`;
}

function quebrar(
  texto: string,
  fonte: { widthOfTextAtSize: (t: string, s: number) => number },
  tamanho: number,
  largura: number,
) {
  const palavras = san(texto).split(' ').filter(Boolean);
  const linhas: string[] = [];
  let atual = '';
  for (const palavra of palavras) {
    const tenta = atual ? `${atual} ${palavra}` : palavra;
    if (fonte.widthOfTextAtSize(tenta, tamanho) <= largura) {
      atual = tenta;
    } else {
      if (atual) linhas.push(atual);
      atual = palavra;
    }
  }
  if (atual) linhas.push(atual);
  return linhas;
}

function pngDaAssinatura(valor?: string | null) {
  const prefixo = 'data:image/png;base64,';
  if (!valor?.startsWith(prefixo)) return null;
  const corpo = valor.slice(prefixo.length);
  if (!/^[A-Za-z0-9+/=]+$/.test(corpo)) return null;
  return Buffer.from(corpo, 'base64');
}

export async function gerarPdfTermoEpi(dados: DadosTermoEpi): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const negrito = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pagina = pdf.addPage([LARGURA, ALTURA]);
  let y = ALTURA - 64;
  const larguraTexto = LARGURA - MARGEM * 2;

  pagina.drawRectangle({ x: 0, y: ALTURA - 46, width: LARGURA, height: 46, color: VERMELHO });
  pagina.drawText('OBRA 10', { x: MARGEM, y: ALTURA - 28, size: 11, font: negrito, color: BRANCO });
  pagina.drawText('Termo de recebimento de EPI', {
    x: MARGEM + 72,
    y: ALTURA - 29,
    size: 14,
    font: negrito,
    color: BRANCO,
  });

  pagina.drawText(san(dados.empresa) || 'Empresa', { x: MARGEM, y, size: 11, font: negrito, color: ESCURO });
  y -= 16;
  pagina.drawText(san(dados.local) || 'Almoxarifado da obra', { x: MARGEM, y, size: 10, font: regular, color: CINZA });
  y -= 28;

  const qtd = Number.isFinite(dados.quantidade) ? String(dados.quantidade).replace('.', ',') : '1';
  const funcao = dados.funcao.trim() ? `, ${dados.funcao.trim()}` : '';
  const validade = dataBr(dados.validadeEpi);
  const recebimento = dataBr(dados.dataRecebimento);
  const ca = dados.ca?.trim() ? `, CA ${dados.ca.trim()}` : '';
  const texto =
    `Eu, ${dados.funcionario || 'o funcionario'}${funcao}, declaro que recebi ${qtd} ${dados.unidade || 'un'} de ${dados.epi}` +
    `${recebimento ? ` em ${recebimento}` : ''}, em condicoes de uso` +
    `${validade ? `, com validade ate ${validade}` : ''}${ca}. ` +
    'Comprometo-me a usar e conservar o equipamento, e a comunicar qualquer dano, perda ou vencimento.';

  for (const linha of quebrar(texto, regular, 11, larguraTexto)) {
    pagina.drawText(linha, { x: MARGEM, y, size: 11, font: regular, color: ESCURO });
    y -= 16;
  }

  y -= 24;
  pagina.drawText('Assinatura de quem recebeu', { x: MARGEM, y, size: 9, font: negrito, color: CINZA });
  y -= 8;
  const png = pngDaAssinatura(dados.assinatura);
  if (png) {
    try {
      const imagem = await pdf.embedPng(png);
      const largura = Math.min(280, imagem.width);
      const altura = (imagem.height / imagem.width) * largura;
      y -= altura;
      pagina.drawImage(imagem, { x: MARGEM, y, width: largura, height: altura });
      y -= 12;
    } catch {
      pagina.drawText('Assinatura registrada no aplicativo.', { x: MARGEM, y: y - 18, size: 10, font: regular, color: CINZA });
      y -= 28;
    }
  } else {
    pagina.drawText('Sem assinatura digital neste termo.', { x: MARGEM, y: y - 18, size: 10, font: regular, color: CINZA });
    y -= 28;
  }

  pagina.drawText(san(dados.funcionario) || 'Funcionario', { x: MARGEM, y, size: 10, font: negrito, color: ESCURO });
  y -= 14;
  pagina.drawText('Documento gerado pelo Obra 10.', { x: MARGEM, y, size: 8, font: regular, color: CINZA });

  return Buffer.from(await pdf.save());
}
