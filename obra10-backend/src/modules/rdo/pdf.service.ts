import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from 'pdf-lib';

const RED = rgb(0.86, 0.15, 0.15);
const DARK = rgb(0.06, 0.06, 0.08);
const GRAY = rgb(0.43, 0.43, 0.43);
const LIGHT_GRAY = rgb(0.90, 0.90, 0.90);
const GREEN = rgb(0.09, 0.64, 0.25);
const ORANGE = rgb(0.85, 0.47, 0.04);
const WHITE = rgb(1, 1, 1);
const TABLE_HEADER_BG = rgb(0.96, 0.96, 0.96);

interface DrawCtx {
  page: PDFPage;
  y: number;
  w: number;
  m: { l: number; r: number; t: number; b: number };
  bold: PDFFont;
  reg: PDFFont;
  pdfDoc: PDFDocument;
}

@Injectable()
export class PdfService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Gera PDF completo do RDO.
   * @param rdoId ID do RDO
   * @param usuarioEmpresaId empresa do usuário (controle de acesso)
   * @param incluirFotos se true, embute imagens dos anexos no final do PDF
   */
  async gerarPdfRdo(
    rdoId: string,
    usuarioEmpresaId: string,
    incluirFotos = false,
  ): Promise<Buffer> {
    const rdo = await this.prisma.rdo.findUnique({
      where: { id: rdoId },
      include: {
        obra: { select: { nome: true, empresa: { select: { id: true, razaoSocial: true, nomeFantasia: true } } } },
        criador: { select: { nome: true } },
        aprovador: { select: { nome: true } },
        atividades: { where: { deletedAt: null } },
        efetivos: { where: { deletedAt: null } },
        ocorrencias: { where: { deletedAt: null } },
        tarefas: true,
      },
    });

    if (!rdo) throw new NotFoundException('RDO não encontrado.');
    if (rdo.obra.empresa.id !== usuarioEmpresaId)
      throw new ForbiddenException('Acesso negado: este RDO não pertence à sua empresa.');

    // Buscar anexos vinculados ao RDO
    const anexos = await this.prisma.anexo.findMany({
      where: { attachableId: rdoId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });

    const extras = (rdo.dadosExtras as any) || {};

    const pdfDoc = await PDFDocument.create();
    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const reg = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const m = { l: 45, r: 45, t: 52, b: 45 };

    let ctx: DrawCtx = this.addPage(pdfDoc, bold, reg, m);

    // ── Utilitários
    const safeStr = (v: any) => {
      if (v == null || v === '') return '-';
      // Remove control chars, newlines, and non-WinAnsi characters (keep only ASCII 32-255 except some)
      return String(v)
        .replace(/[\r\n\t]/g, ' ')
        .replace(/[^\x20-\xFF]/g, '')
        .trim() || '-';
    };

    const wrapText = (text: string, maxWidth: number, size: number, font: PDFFont): string[] => {
      if (!text) return ['-'];
      // Sanitize: normalize newlines to space and strip non-WinAnsi
      const sanitized = String(text)
        .replace(/[\r\n\t]/g, ' ')
        .replace(/[^\x20-\xFF]/g, '')
        .trim();
      if (!sanitized) return ['-'];
      const words = sanitized.split(' ').filter(Boolean);
      const lines: string[] = [];
      let cur = '';
      for (const w of words) {
        const test = cur ? `${cur} ${w}` : w;
        if (font.widthOfTextAtSize(test, size) > maxWidth && cur) {
          lines.push(cur);
          cur = w;
        } else {
          cur = test;
        }
      }
      if (cur) lines.push(cur);
      return lines.length ? lines : ['-'];
    };

    const ensureSpace = (needed: number) => {
      if (ctx.y - needed < ctx.m.b) {
        ctx = this.addPage(pdfDoc, bold, reg, m);
      }
    };

    const drawText = (text: string, x: number, y: number, size: number, font: PDFFont, color = DARK) => {
      ctx.page.drawText(safeStr(text), { x, y, size, font, color });
    };

    const drawLine = (y: number, color = LIGHT_GRAY, thickness = 0.5) => {
      ctx.page.drawLine({ start: { x: m.l, y }, end: { x: ctx.w - m.r, y }, thickness, color });
    };

    const CONTENT_W = ctx.w - m.l - m.r;

    const drawSectionTitle = (title: string) => {
      ensureSpace(26);
      drawText(title, m.l, ctx.y, 8, bold, RED);
      ctx.y -= 4;
      drawLine(ctx.y, RED, 0.6);
      ctx.y -= 10;
    };

    const drawMultiLineText = (text: string, x: number, size: number, font: PDFFont, lineH: number, color = DARK) => {
      const lines = wrapText(text, CONTENT_W - (x - m.l) - 4, size, font);
      for (const line of lines) {
        ensureSpace(lineH);
        drawText(line, x, ctx.y, size, font, color);
        ctx.y -= lineH;
      }
    };

    // ── CABEÇALHO ────────────────────────────────────────────────────────────────
    const empresa = rdo.obra.empresa;
    const nomeEmpresa = empresa.nomeFantasia || empresa.razaoSocial || 'Empresa';
    const dataStr = new Date(rdo.dataReferencia).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

    const pageH = ctx.page.getHeight();
    ctx.page.drawRectangle({ x: 0, y: pageH - 50, width: ctx.w, height: 50, color: RED });
    ctx.page.drawText('RDO', { x: m.l, y: pageH - 31, size: 20, font: bold, color: WHITE });
    ctx.page.drawText('Relatorio Diario de Obra', { x: m.l + 56, y: pageH - 31, size: 11, font: reg, color: rgb(1, 0.80, 0.80) });

    ctx.y -= 10;
    drawText(nomeEmpresa.toUpperCase(), m.l, ctx.y, 10, bold, RED);
    ctx.y -= 13;
    drawText(`Obra: ${rdo.obra.nome}`, m.l, ctx.y, 9, reg, GRAY);

    // Status alinhado à direita
    const statusLabel = rdo.status === 'APROVADO' ? 'APROVADO'
      : rdo.status === 'RASCUNHO' ? 'RASCUNHO'
      : rdo.status === 'SUBMETIDO' ? 'AGUARDANDO APROVACAO'
      : rdo.status === 'REJEITADO' ? 'REJEITADO'
      : rdo.status;
    const statusColor = rdo.status === 'APROVADO' ? GREEN : rdo.status === 'SUBMETIDO' ? ORANGE : RED;
    const statusW = bold.widthOfTextAtSize(statusLabel, 9);
    ctx.page.drawText(statusLabel, { x: ctx.w - m.r - statusW, y: ctx.y, size: 9, font: bold, color: statusColor });

    ctx.y -= 12;
    drawText(`Data: ${dataStr}`, m.l, ctx.y, 9, reg, DARK);
    if (extras.responsavel) {
      const respLabel = `Responsavel: ${extras.responsavel}`;
      const respW = reg.widthOfTextAtSize(respLabel, 9);
      ctx.page.drawText(respLabel, { x: ctx.w - m.r - respW, y: ctx.y, size: 9, font: reg, color: GRAY });
    }
    ctx.y -= 8;
    drawLine(ctx.y, RED, 1);
    ctx.y -= 14;

    // ── CONDICOES DO DIA ─────────────────────────────────────────────────────────
    drawSectionTitle('CONDICOES DO DIA');
    const COL4 = CONTENT_W / 4;

    const climaCols = [
      { label: 'Clima Manha', value: safeStr(extras.climaManha) },
      { label: 'Clima Tarde', value: safeStr(extras.climaTarde) },
      { label: 'Clima Noite', value: safeStr(extras.climaNoite) },
      { label: 'Terreno', value: safeStr(extras.condicaoTerreno) },
    ];
    for (let i = 0; i < climaCols.length; i++) {
      const cx = m.l + i * COL4;
      drawText(climaCols[i].label.toUpperCase(), cx, ctx.y, 7, bold, GRAY);
    }
    ctx.y -= 11;
    for (let i = 0; i < climaCols.length; i++) {
      const cx = m.l + i * COL4;
      drawText(climaCols[i].value, cx, ctx.y, 9, reg, DARK);
    }
    ctx.y -= 14;

    // Temperatura e Wind
    const tempCols = [
      { label: 'Temp. Min', value: extras.tempMin ? `${extras.tempMin}C` : '-' },
      { label: 'Temp. Max', value: extras.tempMax ? `${extras.tempMax}C` : '-' },
    ];
    if (tempCols.some(c => c.value !== '-')) {
      for (let i = 0; i < tempCols.length; i++) {
        const cx = m.l + i * COL4;
        drawText(tempCols[i].label.toUpperCase(), cx, ctx.y, 7, bold, GRAY);
      }
      ctx.y -= 11;
      for (let i = 0; i < tempCols.length; i++) {
        const cx = m.l + i * COL4;
        drawText(tempCols[i].value, cx, ctx.y, 9, reg, DARK);
      }
      ctx.y -= 16;
    } else {
      ctx.y -= 2;
    }

    // ── PRESENTES NA VISTORIA ────────────────────────────────────────────────────
    const pessoas: any[] = extras.pessoas || [];
    if (pessoas.length > 0 && pessoas.some((p: any) => p.nome)) {
      drawSectionTitle('PRESENTES NA VISTORIA');
      // Cabeçalho da tabela
      ctx.page.drawRectangle({ x: m.l, y: ctx.y - 2, width: CONTENT_W, height: 14, color: TABLE_HEADER_BG });
      drawText('NOME', m.l + 4, ctx.y + 3, 7, bold, GRAY);
      drawText('FUNCAO', m.l + CONTENT_W * 0.45 + 4, ctx.y + 3, 7, bold, GRAY);
      drawText('EMPRESA', m.l + CONTENT_W * 0.70 + 4, ctx.y + 3, 7, bold, GRAY);
      ctx.y -= 14;

      for (const p of pessoas) {
        if (!p.nome) continue;
        ensureSpace(14);
        drawText(p.nome, m.l + 4, ctx.y, 8, reg, DARK);
        drawText(p.funcao || '-', m.l + CONTENT_W * 0.45 + 4, ctx.y, 8, reg, DARK);
        drawText(p.empresa || '-', m.l + CONTENT_W * 0.70 + 4, ctx.y, 8, reg, DARK);
        ctx.y -= 2;
        drawLine(ctx.y, LIGHT_GRAY, 0.3);
        ctx.y -= 10;
      }
      ctx.y -= 4;
    }

    // ── EFETIVO (profissionais do dadosExtras) ───────────────────────────────────
    const profissionais: any[] = extras.profissionais || [];
    // Também incluir efetivos do banco (rdo.efetivos) se existirem
    const efetivosDb = rdo.efetivos || [];
    const hasEfetivo = profissionais.length > 0 || efetivosDb.length > 0;

    if (hasEfetivo) {
      drawSectionTitle('EFETIVO');
      ctx.page.drawRectangle({ x: m.l, y: ctx.y - 2, width: CONTENT_W, height: 14, color: TABLE_HEADER_BG });
      drawText('FUNCAO / CARGO', m.l + 4, ctx.y + 3, 7, bold, GRAY);
      drawText('EMPRESA', m.l + CONTENT_W * 0.55 + 4, ctx.y + 3, 7, bold, GRAY);
      drawText('QTD', m.l + CONTENT_W * 0.85 + 4, ctx.y + 3, 7, bold, GRAY);
      ctx.y -= 14;

      let total = 0;

      // Profissionais do dadosExtras (formato: {nome, quantidade, empresa})
      for (const p of profissionais) {
        if (!p.nome) continue;
        ensureSpace(14);
        drawText(p.nome, m.l + 4, ctx.y, 8, reg, DARK);
        drawText(p.empresa || '-', m.l + CONTENT_W * 0.55 + 4, ctx.y, 8, reg, DARK);
        const qtd = Number(p.quantidade) || 1;
        drawText(String(qtd), m.l + CONTENT_W * 0.85 + 4, ctx.y, 8, bold, DARK);
        total += qtd;
        ctx.y -= 2;
        drawLine(ctx.y, LIGHT_GRAY, 0.3);
        ctx.y -= 10;
      }

      // Efetivos do banco
      for (const e of efetivosDb) {
        ensureSpace(14);
        drawText(e.funcaoCargo, m.l + 4, ctx.y, 8, reg, DARK);
        drawText(e.empresaTerceira || '-', m.l + CONTENT_W * 0.55 + 4, ctx.y, 8, reg, DARK);
        drawText(String(e.quantidade), m.l + CONTENT_W * 0.85 + 4, ctx.y, 8, bold, DARK);
        total += e.quantidade;
        ctx.y -= 2;
        drawLine(ctx.y, LIGHT_GRAY, 0.3);
        ctx.y -= 10;
      }

      if (total > 0) {
        ensureSpace(14);
        drawText(`TOTAL: ${total} trabalhador${total !== 1 ? 'es' : ''}`, m.l + 4, ctx.y, 8, bold, DARK);
        ctx.y -= 16;
      }
    }

    // ── MATERIAIS ────────────────────────────────────────────────────────────────
    const materiais: any[] = extras.materiais || [];
    if (materiais.length > 0 && materiais.some((m: any) => m.nome || m.descricao)) {
      drawSectionTitle('MATERIAIS UTILIZADOS');
      ctx.page.drawRectangle({ x: m.l, y: ctx.y - 2, width: CONTENT_W, height: 14, color: TABLE_HEADER_BG });
      drawText('MATERIAL / DESCRICAO', m.l + 4, ctx.y + 3, 7, bold, GRAY);
      drawText('QUANTIDADE', m.l + CONTENT_W * 0.60 + 4, ctx.y + 3, 7, bold, GRAY);
      drawText('UNIDADE', m.l + CONTENT_W * 0.80 + 4, ctx.y + 3, 7, bold, GRAY);
      ctx.y -= 14;

      for (const mat of materiais) {
        const nome = mat.nome || mat.descricao || '';
        if (!nome) continue;
        ensureSpace(14);
        drawText(nome, m.l + 4, ctx.y, 8, reg, DARK);
        drawText(safeStr(mat.quantidade), m.l + CONTENT_W * 0.60 + 4, ctx.y, 8, reg, DARK);
        drawText(safeStr(mat.unidade || mat.un), m.l + CONTENT_W * 0.80 + 4, ctx.y, 8, reg, DARK);
        ctx.y -= 2;
        drawLine(ctx.y, LIGHT_GRAY, 0.3);
        ctx.y -= 10;
      }
      ctx.y -= 4;
    }

    // ── EQUIPAMENTOS ─────────────────────────────────────────────────────────────
    const equipamentos: any[] = extras.equipamentos || [];
    if (equipamentos.length > 0 && equipamentos.some((e: any) => e.nome || e.descricao)) {
      drawSectionTitle('EQUIPAMENTOS');
      ctx.page.drawRectangle({ x: m.l, y: ctx.y - 2, width: CONTENT_W, height: 14, color: TABLE_HEADER_BG });
      drawText('EQUIPAMENTO', m.l + 4, ctx.y + 3, 7, bold, GRAY);
      drawText('QUANTIDADE', m.l + CONTENT_W * 0.60 + 4, ctx.y + 3, 7, bold, GRAY);
      drawText('STATUS', m.l + CONTENT_W * 0.80 + 4, ctx.y + 3, 7, bold, GRAY);
      ctx.y -= 14;

      for (const eq of equipamentos) {
        const nome = eq.nome || eq.descricao || '';
        if (!nome) continue;
        ensureSpace(14);
        drawText(nome, m.l + 4, ctx.y, 8, reg, DARK);
        drawText(safeStr(eq.quantidade), m.l + CONTENT_W * 0.60 + 4, ctx.y, 8, reg, DARK);
        drawText(safeStr(eq.status || eq.estado), m.l + CONTENT_W * 0.80 + 4, ctx.y, 8, reg, DARK);
        ctx.y -= 2;
        drawLine(ctx.y, LIGHT_GRAY, 0.3);
        ctx.y -= 10;
      }
      ctx.y -= 4;
    }

    // ── TAREFAS DO DIA (banco) ───────────────────────────────────────────────────
    if (rdo.tarefas.length > 0) {
      drawSectionTitle('TAREFAS DO DIA');
      ctx.page.drawRectangle({ x: m.l, y: ctx.y - 2, width: CONTENT_W, height: 14, color: TABLE_HEADER_BG });
      drawText('DESCRICAO', m.l + 4, ctx.y + 3, 7, bold, GRAY);
      drawText('FRENTE', m.l + CONTENT_W * 0.50 + 4, ctx.y + 3, 7, bold, GRAY);
      drawText('STATUS', m.l + CONTENT_W * 0.78 + 4, ctx.y + 3, 7, bold, GRAY);
      ctx.y -= 14;

      for (const t of rdo.tarefas) {
        const lines = wrapText(t.descricao, CONTENT_W * 0.47, 8, reg);
        const lh = 11;
        ensureSpace(lines.length * lh + 12);
        for (let li = 0; li < lines.length; li++) {
          drawText(lines[li], m.l + 4, ctx.y - li * lh, 8, reg, DARK);
        }
        drawText(t.frenteServico || '-', m.l + CONTENT_W * 0.50 + 4, ctx.y, 8, reg, DARK);
        const stColor = t.statusExecucao === 'EXECUTADO' ? GREEN
          : t.statusExecucao === 'PARCIAL' ? ORANGE : RED;
        drawText(t.statusExecucao, m.l + CONTENT_W * 0.78 + 4, ctx.y, 8, bold, stColor);
        ctx.y -= lines.length * lh;
        ctx.y -= 2;
        drawLine(ctx.y, LIGHT_GRAY, 0.3);
        ctx.y -= 8;
      }
      ctx.y -= 4;
    }

    // ── ATIVIDADES DO DIA (dadosExtras.atividadesExecutadas) ─────────────────────
    const atividadesBanco = rdo.atividades || [];
    const atividadesTexto = extras.atividadesExecutadas || '';

    if (atividadesBanco.length > 0 || atividadesTexto) {
      drawSectionTitle('ATIVIDADES EXECUTADAS');

      // Atividades em texto livre (diário de obra)
      if (atividadesTexto) {
        const lines = wrapText(atividadesTexto, CONTENT_W - 8, 8, reg);
        for (const line of lines) {
          ensureSpace(12);
          drawText(line, m.l + 4, ctx.y, 8, reg, DARK);
          ctx.y -= 12;
        }
      }
      // Atividades do banco (itens separados)
      for (const a of atividadesBanco) {
        const text = `${a.descricao}${a.frenteServico ? ` (${a.frenteServico})` : ''}`;
        drawMultiLineText(text, m.l + 4, 8, reg, 12);
      }
      ctx.y -= 6;
    }

    // ── ATIVIDADES PENDENTES ─────────────────────────────────────────────────────
    const atividadesPendentes = extras.atividadesPendentes || '';
    if (atividadesPendentes) {
      drawSectionTitle('ATIVIDADES PENDENTES / PROXIMAS');
      const lines = wrapText(atividadesPendentes, CONTENT_W - 8, 8, reg);
      for (const line of lines) {
        ensureSpace(12);
        drawText(line, m.l + 4, ctx.y, 8, reg, DARK);
        ctx.y -= 12;
      }
      ctx.y -= 6;
    }

    // ── OCORRENCIAS ──────────────────────────────────────────────────────────────
    if (rdo.ocorrencias.length > 0) {
      drawSectionTitle('OCORRENCIAS');
      for (const o of rdo.ocorrencias) {
        const text = `[${o.tipoOcorrencia}] ${o.descricao}${o.horasPerdidas ? ` - ${o.horasPerdidas}h perdidas` : ''}`;
        drawMultiLineText(text, m.l + 4, 8, reg, 12, DARK);
      }
      ctx.y -= 6;
    }

    // ── OBSERVACOES GERAIS ───────────────────────────────────────────────────────
    const observacoes = extras.observacoes || extras.observacoesGerais || '';
    if (observacoes) {
      drawSectionTitle('OBSERVACOES GERAIS');
      const lines = wrapText(observacoes, CONTENT_W - 8, 8, reg);
      for (const line of lines) {
        ensureSpace(12);
        drawText(line, m.l + 4, ctx.y, 8, reg, DARK);
        ctx.y -= 12;
      }
      ctx.y -= 6;
    }

    // ── LISTA DE ANEXOS ──────────────────────────────────────────────────────────
    if (anexos.length > 0) {
      drawSectionTitle(`ANEXOS (${anexos.length})`);
      for (const a of anexos) {
        ensureSpace(13);
        const tamanhoKb = (a.tamanhoBytes / 1024).toFixed(0);
        const linha = `${a.nomeOriginal || 'Arquivo'} — ${a.mimeType} — ${tamanhoKb} KB`;
        const lines = wrapText(linha, CONTENT_W - 8, 7, reg);
        for (const l of lines) {
          ensureSpace(11);
          drawText(l, m.l + 4, ctx.y, 7, reg, GRAY);
          ctx.y -= 11;
        }
      }
      ctx.y -= 6;
    }

    // ── RODAPE DE ASSINATURA ─────────────────────────────────────────────────────
    ensureSpace(40);
    ctx.y -= 8;
    drawLine(ctx.y, LIGHT_GRAY, 0.5);
    ctx.y -= 13;

    const elaborado = `Elaborado por: ${rdo.criador?.nome || '-'}`;
    drawText(elaborado, m.l, ctx.y, 8, reg, GRAY);

    if (rdo.status === 'APROVADO') {
      const aprovNome = rdo.aprovadorNome ?? rdo.aprovador?.nome ?? '-';
      const aprovData = rdo.aprovacaoAt
        ? new Date(rdo.aprovacaoAt).toLocaleDateString('pt-BR')
        : '-';
      const aprovText = `Aprovado por: ${aprovNome} em ${aprovData}`;
      const aprovW = reg.widthOfTextAtSize(aprovText, 8);
      ctx.page.drawText(aprovText, { x: ctx.w - m.r - aprovW, y: ctx.y, size: 8, font: reg, color: GREEN });
    }

    ctx.y -= 14;
    const rodapeTs = new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    drawText(`Gerado pelo OBRA 10 em ${rodapeTs}`, m.l, ctx.y, 7, reg, LIGHT_GRAY);

    // ── FOTOS (páginas adicionais) ───────────────────────────────────────────────
    if (incluirFotos) {
      const imagens = anexos.filter(a =>
        a.mimeType?.startsWith('image/') &&
        (a.mimeType === 'image/jpeg' || a.mimeType === 'image/png')
      ).slice(0, 12); // máximo 12 fotos

      for (const img of imagens) {
        try {
          // Buscar imagem via fetch (Node 18+)
          const response = await fetch(img.urlS3);
          if (!response.ok) continue;
          const arrayBuf = await response.arrayBuffer();
          const imgBytes = new Uint8Array(arrayBuf);

          let embeddedImg;
          if (img.mimeType === 'image/jpeg') {
            embeddedImg = await pdfDoc.embedJpg(imgBytes);
          } else {
            embeddedImg = await pdfDoc.embedPng(imgBytes);
          }

          const fotoPage = pdfDoc.addPage([595.28, 841.89]);
          const FW = fotoPage.getWidth();
          const FH = fotoPage.getHeight();

          // Redimensionar mantendo aspect ratio
          const maxW = FW - m.l - m.r;
          const maxH = FH - m.t - m.b - 40;
          const scale = Math.min(maxW / embeddedImg.width, maxH / embeddedImg.height);
          const dW = embeddedImg.width * scale;
          const dH = embeddedImg.height * scale;
          const imgX = m.l + (maxW - dW) / 2;
          const imgY = FH - m.t - dH;

          fotoPage.drawImage(embeddedImg, { x: imgX, y: imgY, width: dW, height: dH });

          // Rodapé da foto
          const caption = img.nomeOriginal || 'Foto';
          const capW = reg.widthOfTextAtSize(caption, 8);
          fotoPage.drawText(caption, {
            x: FW / 2 - capW / 2,
            y: m.b,
            size: 8, font: reg, color: GRAY,
          });
        } catch (_err) {
          // ignorar falha na imagem individual
        }
      }
    }

    // ── Numeração de páginas ─────────────────────────────────────────────────────
    const pages = pdfDoc.getPages();
    const total = pages.length;
    for (let i = 0; i < total; i++) {
      const p = pages[i];
      const txt = `${i + 1} / ${total}`;
      const txtW = reg.widthOfTextAtSize(txt, 7);
      p.drawText(txt, { x: p.getWidth() - m.r - txtW, y: m.b - 18, size: 7, font: reg, color: GRAY });
    }

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  }

  /** Cria nova página A4 e retorna o contexto de desenho. */
  private addPage(pdfDoc: PDFDocument, bold: PDFFont, reg: PDFFont, m: { l: number; r: number; t: number; b: number }): DrawCtx {
    const page = pdfDoc.addPage([595.28, 841.89]);
    const w = page.getWidth();
    const y = page.getHeight() - m.t;
    return { page, y, w, m, bold, reg, pdfDoc };
  }
}
