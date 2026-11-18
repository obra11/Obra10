import { Injectable, Logger } from '@nestjs/common';
import { TipoDocumentoEntrada } from '@prisma/client';
import { lerNotaLuna } from '../ai/luna-visao';
import { recortesDanfe } from './danfe-recorte';

export interface ItemExtraido {
  descricao: string;
  quantidade: number;
  unidade: string | null;
  valorUnitario: number | null;
  valorTotal: number | null;
  ncm: string | null;
  ean: string | null;
}

export interface DocumentoExtraido {
  tipo: TipoDocumentoEntrada | null;
  numero: string | null;
  serie: string | null;
  chaveAcesso: string | null;
  dataEmissao: string | null;
  valorTotal: number | null;
  fornecedor: {
    cnpj: string | null;
    razaoSocial: string | null;
    ie: string | null;
    telefone: string | null;
    email: string | null;
  };
  itens: ItemExtraido[];
}

const VAZIO: DocumentoExtraido = {
  tipo: null,
  numero: null,
  serie: null,
  chaveAcesso: null,
  dataEmissao: null,
  valorTotal: null,
  fornecedor: {
    cnpj: null,
    razaoSocial: null,
    ie: null,
    telefone: null,
    email: null,
  },
  itens: [],
};

@Injectable()
export class ExtracaoDocumentoService {
  private readonly logger = new Logger(ExtracaoDocumentoService.name);

  async extrair(buffer: Buffer, mime: string): Promise<DocumentoExtraido> {
    if (mime === 'application/pdf') {
      let texto = '';
      try {
        texto = await textoDoPdf(buffer);
      } catch (err: any) {
        this.logger.warn(`Texto do PDF indisponível: ${String(err?.message || err).slice(0, 180)}`);
      }
      if (texto.length >= 40) {
        const local = lerNotaTexto(texto);
        if (local.itens.length || local.fornecedor.razaoSocial || local.numero) return local;
        return this.pedirModelo([{ type: 'text', text: this.pedido(texto) }]);
      }
      const dataUrl = `data:application/pdf;base64,${buffer.toString('base64')}`;
      return this.pedirModelo([
        { type: 'text', text: this.pedido() },
        { type: 'file', file: { filename: 'nota.pdf', file_data: dataUrl } },
      ]);
    }
    const dataUrl = `data:${mime};base64,${buffer.toString('base64')}`;
    const lido = await this.pedirModelo([
      { type: 'text', text: this.pedido() },
      { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
    ]);
    return this.completarDanfe(buffer, lido);
  }

  private async completarDanfe(buffer: Buffer, lido: DocumentoExtraido): Promise<DocumentoExtraido> {
    const cnpjOk = cnpjValido(lido.fornecedor.cnpj || '');
    if (lido.chaveAcesso && cnpjOk && lido.fornecedor.ie) return completarPelaChave(lido);
    const recortes = recortesDanfe(buffer);
    if (!recortes) return completarPelaChave(lido);
    const pedido =
      'Estes recortes são de uma DANFE. O primeiro mostra a chave de acesso impressa em grupos de 4 sob o código de barras. O segundo mostra a inscrição estadual do emitente, no quadro acima do destinatário — não é o CEP. Responda só JSON {"chaveAcesso":"","cnpj":"","ie":""}. Transcreva todos os dígitos legíveis.';
    try {
      const fino = await this.pedirModelo([
        { type: 'text', text: pedido },
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${recortes.chave.toString('base64')}`, detail: 'high' } },
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${recortes.emitente.toString('base64')}`, detail: 'high' } },
      ]);
      lido.chaveAcesso = lido.chaveAcesso || fino.chaveAcesso;
      lido.fornecedor.cnpj = cnpjOk ? lido.fornecedor.cnpj : fino.fornecedor.cnpj;
      lido.fornecedor.ie = lido.fornecedor.ie || fino.fornecedor.ie;
    } catch (err: any) {
      this.logger.warn(`Recorte da DANFE: ${String(err?.message || err).slice(0, 160)}`);
    }
    return completarPelaChave(lido);
  }

  private pedido(texto?: string) {
    const formato = `Extraia o documento neste formato:
{"tipo":"NFE|NFCE_CUPOM|FOTO|null","numero":null,"serie":null,"chaveAcesso":null,"dataEmissao":null,"valorTotal":null,"fornecedor":{"cnpj":null,"razaoSocial":null,"ie":null,"telefone":null,"email":null},"itens":[{"descricao":"","quantidade":0,"unidade":null,"valorUnitario":null,"valorTotal":null,"ncm":null,"ean":null}]}
O fornecedor é o emitente ou o prestador, nunca o destinatário. Inclua cada linha de produto, serviço ou mão de obra. Se for foto sem nota, use tipo FOTO e preencha só o que der para ler.`;
    return texto ? `${formato}\n\nTexto do PDF:\n${texto}` : formato;
  }

  private async pedirModelo(content: unknown[]): Promise<DocumentoExtraido> {
    try {
      const raw = await lerNotaLuna(content as never);
      return this.parsear(raw);
    } catch (err: any) {
      const msg = String(err?.message || err);
      if (msg === 'SEM_CHAVE') throw err;
      const causa = err?.cause?.code ? ` (${err.cause.code})` : '';
      this.logger.error(`Luna visão: ${msg.slice(0, 240)}${causa}`);
      throw err;
    }
  }

  parsear(raw: string): DocumentoExtraido {
    const limpo = raw.replace(/```json|```/g, '').trim();
    let json: any;
    try {
      json = JSON.parse(limpo);
    } catch {
      return { ...VAZIO };
    }
    const tipo = ['NFE', 'NFCE_CUPOM', 'FOTO'].includes(json.tipo)
      ? (json.tipo as TipoDocumentoEntrada)
      : null;
    const chave = String(json.chaveAcesso || '').replace(/\D/g, '');
    const cnpj = texto(json.fornecedor?.cnpj)?.replace(/\D/g, '') || '';
    const itens = Array.isArray(json.itens) ? json.itens : [];
    return {
      tipo,
      numero: texto(json.numero),
      serie: texto(json.serie),
      chaveAcesso: chaveAceita(chave) ? chave : null,
      dataEmissao: /^\d{4}-\d{2}-\d{2}$/.test(json.dataEmissao || '')
        ? json.dataEmissao
        : null,
      valorTotal: numero(json.valorTotal),
      fornecedor: {
        cnpj: cnpjValido(cnpj) ? cnpj : null,
        razaoSocial: texto(json.fornecedor?.razaoSocial),
        ie: ieDoEmitente(texto(json.fornecedor?.ie)),
        telefone: texto(json.fornecedor?.telefone),
        email: texto(json.fornecedor?.email),
      },
      itens: itens
        .map((item: any) => ({
          descricao: texto(item.descricao) || '',
          quantidade: numero(item.quantidade) ?? 0,
          unidade: texto(item.unidade),
          valorUnitario: numero(item.valorUnitario),
          valorTotal: numero(item.valorTotal),
          ncm: texto(item.ncm),
          ean: texto(item.ean)?.replace(/\D/g, '') || null,
        }))
        .filter((item: ItemExtraido) => item.descricao.trim().length > 0),
    };
  }
}

function cnpjValido(cnpj: string): boolean {
  if (!/^\d{14}$/.test(cnpj) || /^(\d)\1+$/.test(cnpj)) return false;
  const digito = (base: string, pesos: number[]) => {
    const soma = base.split('').reduce((acc, n, i) => acc + Number(n) * pesos[i], 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  const primeiro = digito(cnpj.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const segundo = digito(cnpj.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return cnpj.endsWith(`${primeiro}${segundo}`);
}

function chaveAceita(chave: string): boolean {
  if (chave.length === 50) return true;
  if (!/^\d{44}$/.test(chave)) return false;
  let peso = 2;
  let soma = 0;
  for (let i = 42; i >= 0; i--) {
    soma += Number(chave[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  const dv = resto < 2 ? 0 : 11 - resto;
  return Number(chave[43]) === dv;
}

function completarPelaChave(doc: DocumentoExtraido): DocumentoExtraido {
  const chave = doc.chaveAcesso || '';
  if (!chaveAceita(chave) || chave.length !== 44) return doc;
  const cnpj = chave.slice(6, 20);
  const serie = String(Number(chave.slice(22, 25)));
  const numero = String(Number(chave.slice(25, 34)));
  return {
    ...doc,
    numero: doc.numero || numero,
    serie: doc.serie || serie,
    fornecedor: {
      ...doc.fornecedor,
      cnpj: cnpjValido(doc.fornecedor.cnpj || '') ? doc.fornecedor.cnpj : cnpjValido(cnpj) ? cnpj : null,
    },
  };
}

function ieDoEmitente(ie: string | null): string | null {
  if (!ie) return null;
  const digitos = ie.replace(/\D/g, '');
  if (digitos.length === 8) return null;
  return ie;
}

function brNumero(valor: string): number | null {
  const temVirgula = valor.includes(',');
  const limpo = temVirgula ? valor.replace(/\./g, '').replace(',', '.') : valor;
  const n = Number(limpo);
  return Number.isFinite(n) ? n : null;
}

function dataBr(valor: string): string | null {
  const m = valor.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

export function lerNotaTexto(bruto: string): DocumentoExtraido {
  const texto = bruto.replace(/\u00a0/g, ' ');
  const prestador =
    texto.split(/PRESTADOR DE SERVI[CÇ]OS/i)[1]?.split(/TOMADOR DE SERVI[CÇ]OS/i)[0] ||
    texto.split(/IDENTIFICA[CÇ][AÃ]O DO EMITENTE/i)[1]?.split(/DESTINAT[AÁ]RIO/i)[0] ||
    '';
  const bloco = prestador || texto;
  const razao = bloco.match(/Nome\/Raz[aã]o Social:\s*(.+?)(?:\s+Inscri[cç][aã]o|$)/im)?.[1]?.trim() || null;
  const cnpj = (bloco.match(/CNPJ:\s*([\d./-]{14,18})/i)?.[1] || '').replace(/\D/g, '') || null;
  const telefone = bloco.match(/Telefone:\s*(\(\d{2}\)\s*[\d-]+)/i)?.[1]?.trim() || null;
  const email = bloco.match(/E-mail:\s*([^\s@]+@[^\s@]+\.[^\s@]+)/i)?.[1]?.trim() || null;
  const ieBruta = bloco.match(/Inscri[cç][aã]o Estadual:[ \t]*([^\n]*)/i)?.[1]?.trim() || '';
  const ie = ieBruta && !/inscri|cpf|cnpj|telefone/i.test(ieBruta) ? ieBruta : null;
  const numero =
    texto.match(/NFS-e de n[úu]mero\s+(\d{1,12})/i)?.[1] ||
    texto.match(/N[úu]mero da Nota\s*\n+\s*(\d{1,12})/i)?.[1] ||
    null;
  const serie = texto.match(/S[ée]rie\s+(\d{1,5})/i)?.[1] || null;
  const dataEmissao = dataBr(
    texto.match(/Data da Emiss[aã]o da Nota\s*(\d{2}\/\d{2}\/\d{4})/i)?.[1] ||
      texto.match(/(\d{2}\/\d{2}\/\d{4})/)?.[1] ||
      '',
  );
  const valorTotal = brNumero(texto.match(/Valor bruto\s*=\s*R\$\s*([\d.]+,\d{2})/i)?.[1] || '');
  const chave = (texto.match(/\b(\d{50}|\d{44})\b/) || [])[1] || null;
  const servicos =
    texto.split(/DISCRIMINA[CÇ][AÃ]O DOS SERVI[CÇ]OS|DESCRI[CÇ][AÃ]O DOS PRODUTOS/i)[1]?.split(
      /RETEN[CÇ][OÕ]ES|C[oó]digos dos servi|C[AÁ]LCULO DO IMPOSTO/i,
    )[0] || '';
  const itens: ItemExtraido[] = [];
  for (const linha of servicos.split('\n')) {
    const limpa = linha.trim();
    const m = limpa.match(/^(.+?)\s+(\d{1,6},\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\b/);
    if (!m || /quantidade|valor unit/i.test(m[1])) continue;
    const quantidade = brNumero(m[2]);
    const valorUnitario = brNumero(m[3]);
    const total = brNumero(m[4]);
    if (!quantidade || valorUnitario == null) continue;
    itens.push({
      descricao: m[1].trim(),
      quantidade,
      unidade: 'un',
      valorUnitario,
      valorTotal: total,
      ncm: null,
      ean: null,
    });
  }
  return {
    tipo: /NFS-e|prestador de servi/i.test(texto) ? TipoDocumentoEntrada.NFE : null,
    numero,
    serie,
    chaveAcesso: chave,
    dataEmissao,
    valorTotal,
    fornecedor: {
      cnpj: cnpjValido(cnpj || '') ? cnpj : null,
      razaoSocial: razao,
      ie,
      telefone,
      email,
    },
    itens,
  };
}

async function textoDoPdf(buffer: Buffer): Promise<string> {
  const { extractText, getDocumentProxy } = await import('unpdf');
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const extraido = await extractText(pdf, { mergePages: true });
  const bruto = Array.isArray(extraido.text) ? extraido.text.join('\n') : String(extraido.text || '');
  return bruto.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, 24000);
}

function texto(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

function numero(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}
