import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage, PDFName, PDFString, degrees } from 'pdf-lib';
import * as fs from 'fs';
import * as path from 'path';

// Paleta de Cores Lunardeli Oficial
const LUNARDELI_RED = rgb(0.898, 0.098, 0.173); // #E5192C
const LUNARDELI_DARK = rgb(0.106, 0.106, 0.106); // #1B1B1B
const LUNARDELI_GRAY = rgb(0.961, 0.961, 0.961); // #F5F5F5
const LUNARDELI_LIGHT_GRAY = rgb(0.878, 0.878, 0.878); // #E0E0E0

// Cores auxiliares de status e links
const STATUS_GREEN = rgb(0.09, 0.64, 0.25);
const STATUS_ORANGE = rgb(0.85, 0.47, 0.04);
const COLOR_LINK = rgb(0.06, 0.38, 0.78); // Azul para links
const WHITE = rgb(1, 1, 1);

// Mapeamento de compatibilidade para código herdado
const RED = LUNARDELI_RED;
const DARK = LUNARDELI_DARK;
const GRAY = rgb(0.43, 0.43, 0.43); // Cinza para textos secundários
const LIGHT_GRAY = LUNARDELI_LIGHT_GRAY;
const TABLE_HEADER_BG = LUNARDELI_GRAY;
const GREEN = STATUS_GREEN;
const ORANGE = STATUS_ORANGE;

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
        obra: {
          select: {
            nome: true,
            empresa: {
              select: {
                id: true,
                razaoSocial: true,
                nomeFantasia: true,
                logoUrl: true,
              },
            },
          },
        },
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

    // Calcular número sequencial do RDO
    const allRdos = await this.prisma.rdo.findMany({
      where: { obraId: rdo.obraId, deletedAt: null },
      select: { id: true },
      orderBy: [{ dataReferencia: 'asc' }, { createdAt: 'asc' }],
    });
    const idx = allRdos.findIndex((r) => r.id === rdoId);
    const sequencial = idx === -1 ? 1 : idx + 1;

    // Buscar anexos vinculados ao RDO
    const anexos = await this.prisma.anexo.findMany({
      where: { attachableId: rdoId, deletedAt: null },
      include: { criador: { select: { nome: true } } },
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
      ensureSpace(25);
      ctx.page.drawRectangle({
        x: m.l,
        y: ctx.y - 1,
        width: 3,
        height: 10,
        color: LUNARDELI_RED,
      });
      drawText(title, m.l + 8, ctx.y, 9, bold, LUNARDELI_DARK);
      ctx.y -= 5;
      drawLine(ctx.y, LUNARDELI_LIGHT_GRAY, 0.4);
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

    // ── CABEÇALHO ───────────────────────────────────────────────────────────────
    const empresa = rdo.obra.empresa;
    const nomeEmpresa = empresa.nomeFantasia || empresa.razaoSocial || 'Empresa';
    const dataStr = new Date(rdo.dataReferencia).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });

    // Carrega logo da empresa (se houver) para o card de cabeçalho
    const LOGO_MAX_W = 72;
    const LOGO_MAX_H = 52;
    let logoDrawW = 0;
    let logoDrawH = 0;
    let embeddedLogo: Awaited<ReturnType<PDFDocument['embedPng']>> | null = null;

    if (empresa.logoUrl) {
      try {
        const logoBytes = await this.loadImageBytes(empresa.logoUrl);
        if (logoBytes) {
          embeddedLogo = await this.embedRasterImage(pdfDoc, logoBytes);
          if (embeddedLogo) {
            const scale = Math.min(
              LOGO_MAX_W / embeddedLogo.width,
              LOGO_MAX_H / embeddedLogo.height,
              1,
            );
            logoDrawW = embeddedLogo.width * scale;
            logoDrawH = embeddedLogo.height * scale;
          }
        } else {
          console.warn(
            `[PdfService] Logo da empresa não encontrado: ${empresa.logoUrl}`,
          );
        }
      } catch (err) {
        console.warn('[PdfService] Não foi possível embutir o logo da empresa:', err);
        embeddedLogo = null;
      }
    }

    const headerTop = ctx.y;

    // Barra de título do sistema
    ctx.page.drawRectangle({
      x: m.l,
      y: headerTop - 12,
      width: 6,
      height: 20,
      color: LUNARDELI_RED,
    });
    drawText('OBRA 10', m.l + 12, headerTop - 2, 16, bold, LUNARDELI_DARK);

    const subtitle = 'RELATORIO DIARIO DE OBRA';
    const subtitleW = reg.widthOfTextAtSize(subtitle, 9);
    ctx.page.drawText(subtitle, {
      x: ctx.w - m.r - subtitleW,
      y: headerTop + 1,
      size: 9,
      font: reg,
      color: GRAY,
    });

    ctx.y = headerTop - 22;
    drawLine(ctx.y, LUNARDELI_LIGHT_GRAY, 0.5);
    ctx.y -= 12;

    // Card de cabeçalho (com logo à esquerda, se existir)
    const hasLogo = !!(embeddedLogo && logoDrawW > 0 && logoDrawH > 0);
    const cardH = hasLogo ? Math.max(68, logoDrawH + 16) : 58;
    const cardY = ctx.y - cardH;
    const logoSlotW = hasLogo ? Math.max(logoDrawW, 56) + 16 : 0;

    ctx.page.drawRectangle({
      x: m.l,
      y: cardY,
      width: CONTENT_W,
      height: cardH,
      color: LUNARDELI_GRAY,
      borderColor: LUNARDELI_LIGHT_GRAY,
      borderWidth: 0.8,
    });

    if (hasLogo && embeddedLogo) {
      // Fundo branco atrás do logo para contraste
      const pad = 6;
      const boxW = logoDrawW + pad * 2;
      const boxH = logoDrawH + pad * 2;
      const boxX = m.l + 8;
      const boxY = cardY + (cardH - boxH) / 2;
      ctx.page.drawRectangle({
        x: boxX,
        y: boxY,
        width: boxW,
        height: boxH,
        color: WHITE,
        borderColor: LUNARDELI_LIGHT_GRAY,
        borderWidth: 0.5,
      });
      ctx.page.drawImage(embeddedLogo, {
        x: boxX + pad,
        y: boxY + pad,
        width: logoDrawW,
        height: logoDrawH,
      });
    }

    const cardTextY1 = cardY + cardH - 14;
    const cardTextY2 = cardY + cardH - 28;
    const cardTextY3 = cardY + cardH - 42;

    // Textos à direita do logo
    const col1X = m.l + 10 + logoSlotW;
    const textColW = CONTENT_W - logoSlotW - 20;
    const col2X = col1X + textColW * 0.52;

    ctx.page.drawText('OBRA:', { x: col1X, y: cardTextY1, size: 8, font: bold, color: LUNARDELI_DARK });
    ctx.page.drawText(safeStr(rdo.obra.nome), {
      x: col1X + 35,
      y: cardTextY1,
      size: 8,
      font: reg,
      color: LUNARDELI_DARK,
    });

    ctx.page.drawText('EMPRESA:', { x: col1X, y: cardTextY2, size: 8, font: bold, color: LUNARDELI_DARK });
    ctx.page.drawText(safeStr(nomeEmpresa), {
      x: col1X + 50,
      y: cardTextY2,
      size: 8,
      font: reg,
      color: LUNARDELI_DARK,
    });

    ctx.page.drawText('NUMERO:', { x: col1X, y: cardTextY3, size: 8, font: bold, color: LUNARDELI_DARK });
    ctx.page.drawText(`RDO #${sequencial}`, {
      x: col1X + 45,
      y: cardTextY3,
      size: 8,
      font: reg,
      color: LUNARDELI_DARK,
    });

    ctx.page.drawText('DATA:', { x: col2X, y: cardTextY1, size: 8, font: bold, color: LUNARDELI_DARK });
    ctx.page.drawText(safeStr(dataStr), {
      x: col2X + 35,
      y: cardTextY1,
      size: 8,
      font: reg,
      color: LUNARDELI_DARK,
    });

    ctx.page.drawText('RESPONSAVEL:', { x: col2X, y: cardTextY2, size: 8, font: bold, color: LUNARDELI_DARK });
    ctx.page.drawText(safeStr(extras.responsavel || '-'), {
      x: col2X + 75,
      y: cardTextY2,
      size: 8,
      font: reg,
      color: LUNARDELI_DARK,
    });

    ctx.page.drawText('STATUS:', { x: col2X, y: cardTextY3, size: 8, font: bold, color: LUNARDELI_DARK });

    const statusLabel =
      rdo.status === 'APROVADO'
        ? 'APROVADO'
        : rdo.status === 'RASCUNHO'
          ? 'RASCUNHO'
          : rdo.status === 'SUBMETIDO'
            ? 'AGUARDANDO APROVACAO'
            : rdo.status === 'REJEITADO'
              ? 'REJEITADO'
              : rdo.status;
    const statusColor =
      rdo.status === 'APROVADO' ? GREEN : rdo.status === 'SUBMETIDO' ? ORANGE : RED;
    ctx.page.drawText(statusLabel, {
      x: col2X + 45,
      y: cardTextY3,
      size: 8,
      font: bold,
      color: statusColor,
    });

    ctx.y = cardY - 15;

    // ── CONDICOES DO DIA ─────────────────────────────────────────────────────────
    drawSectionTitle('CONDICOES DO DIA');
    
    ensureSpace(45);
    const condCardH = 36;
    const condCardY = ctx.y - condCardH;
    
    ctx.page.drawRectangle({
      x: m.l,
      y: condCardY,
      width: CONTENT_W,
      height: condCardH,
      color: LUNARDELI_GRAY,
      borderColor: LUNARDELI_LIGHT_GRAY,
      borderWidth: 0.8,
    });
    
    const condCols = [
      { label: 'MANHA', value: safeStr(extras.climaManha) },
      { label: 'TARDE', value: safeStr(extras.climaTarde) },
      { label: 'NOITE', value: safeStr(extras.climaNoite) },
      { label: 'TERRENO', value: safeStr(extras.condicaoTerreno) },
      { label: 'TEMP. MIN', value: extras.tempMin ? `${extras.tempMin}°C` : '-' },
      { label: 'TEMP. MAX', value: extras.tempMax ? `${extras.tempMax}°C` : '-' },
    ];
    
    const colW = CONTENT_W / 6;
    const labelY = condCardY + condCardH - 12;
    const valY = condCardY + 8;
    
    for (let i = 0; i < condCols.length; i++) {
      const cx = m.l + i * colW + 6;
      ctx.page.drawText(condCols[i].label, {
        x: cx,
        y: labelY,
        size: 7,
        font: bold,
        color: GRAY,
      });
      ctx.page.drawText(condCols[i].value, {
        x: cx,
        y: valY,
        size: 8,
        font: reg,
        color: LUNARDELI_DARK,
      });
      
      if (i < condCols.length - 1) {
        ctx.page.drawLine({
          start: { x: m.l + (i + 1) * colW, y: condCardY + 4 },
          end: { x: m.l + (i + 1) * colW, y: condCardY + condCardH - 4 },
          thickness: 0.5,
          color: LUNARDELI_LIGHT_GRAY,
        });
      }
    }
    
    ctx.y = condCardY - 15;

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

      // Atividades em texto livre ou estruturadas (diário de obra)
      if (atividadesTexto) {
        if (Array.isArray(atividadesTexto)) {
          for (const a of atividadesTexto) {
            const label = `- [${a.status.toUpperCase()}] ${a.descricao}`;
            drawMultiLineText(label, m.l + 4, 8, reg, 12);
          }
        } else {
          const lines = wrapText(String(atividadesTexto), CONTENT_W - 8, 8, reg);
          for (const line of lines) {
            ensureSpace(12);
            drawText(line, m.l + 4, ctx.y, 8, reg, DARK);
            ctx.y -= 12;
          }
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
    if (atividadesPendentes && (Array.isArray(atividadesPendentes) ? atividadesPendentes.length > 0 : true)) {
      drawSectionTitle('ATIVIDADES PENDENTES / PROXIMAS');
      if (Array.isArray(atividadesPendentes)) {
        for (const a of atividadesPendentes) {
          const desc = typeof a === 'string' ? a : a?.descricao || '';
          const resp = typeof a === 'string' ? '' : a?.responsavel || '';
          if (!desc && !resp) continue;
          const label = resp
            ? `- ${desc} (Responsavel: ${resp})`
            : `- ${desc}`;
          drawMultiLineText(label, m.l + 4, 8, reg, 12);
        }
      } else {
        const lines = wrapText(String(atividadesPendentes), CONTENT_W - 8, 8, reg);
        for (const line of lines) {
          ensureSpace(12);
          drawText(line, m.l + 4, ctx.y, 8, reg, DARK);
          ctx.y -= 12;
        }
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
    if (observacoes && (Array.isArray(observacoes) ? observacoes.length > 0 : true)) {
      drawSectionTitle('OBSERVACOES GERAIS');
      if (Array.isArray(observacoes)) {
        for (const o of observacoes) {
          const desc = typeof o === 'string' ? o : o?.descricao || '';
          if (!desc) continue;
          drawMultiLineText(`- ${desc}`, m.l + 4, 8, reg, 12);
        }
      } else {
        const lines = wrapText(String(observacoes), CONTENT_W - 8, 8, reg);
        for (const line of lines) {
          ensureSpace(12);
          drawText(line, m.l + 4, ctx.y, 8, reg, DARK);
          ctx.y -= 12;
        }
      }
      ctx.y -= 6;
    }

    // ── LISTA DE ANEXOS ──────────────────────────────────────────────────────────
    if (anexos.length > 0) {
      drawSectionTitle('ANEXOS E MIDIAS');
      for (const a of anexos) {
        ensureSpace(16);
        
        let badge = '[ARQUIVO]';
        if (a.mimeType?.startsWith('image/')) badge = '[FOTO]';
        else if (a.mimeType?.startsWith('video/')) badge = '[VIDEO]';
        
        const badgeW = bold.widthOfTextAtSize(badge + ' ', 8);
        const tamanhoKb = (a.tamanhoBytes / 1024).toFixed(0);
        const sizeStr = ` (${tamanhoKb} KB)`;
        const linkText = a.nomeOriginal || 'Arquivo';
        
        const maxLinkW = CONTENT_W - badgeW - reg.widthOfTextAtSize(sizeStr, 8) - 15;
        let displayedLink = linkText;
        if (reg.widthOfTextAtSize(displayedLink, 8) > maxLinkW) {
          while (displayedLink.length > 5 && reg.widthOfTextAtSize(displayedLink + '...', 8) > maxLinkW) {
            displayedLink = displayedLink.substring(0, displayedLink.length - 1);
          }
          displayedLink += '...';
        }
        
        drawText(badge, m.l + 4, ctx.y, 8, bold, LUNARDELI_DARK);
        
        const linkX = m.l + 4 + badgeW;
        ctx.page.drawText(displayedLink, {
          x: linkX,
          y: ctx.y,
          size: 8,
          font: bold,
          color: COLOR_LINK,
        });
        
        const linkW = bold.widthOfTextAtSize(displayedLink, 8);
        ctx.page.drawLine({
          start: { x: linkX, y: ctx.y - 1.5 },
          end: { x: linkX + linkW, y: ctx.y - 1.5 },
          thickness: 0.8,
          color: COLOR_LINK,
        });
        this.addLinkAnnotation(pdfDoc, ctx.page, a.urlS3, [
          linkX,
          ctx.y - 3,
          linkX + linkW,
          ctx.y + 9,
        ]);
        
        const sizeX = linkX + linkW;
        ctx.page.drawText(sizeStr, {
          x: sizeX,
          y: ctx.y,
          size: 8,
          font: reg,
          color: GRAY,
        });
        
        ctx.y -= 14;
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

    // ── FOTOS (páginas adicionais em grade 2x4) ───────────────────────────────────────────────
    if (incluirFotos) {
      const imagens = anexos.filter(a =>
        a.mimeType?.startsWith('image/') &&
        (a.mimeType === 'image/jpeg' || a.mimeType === 'image/png')
      );

      const colW = 245;
      const cellH = 170;
      const gapX = 15;
      const gapY = 8;
      const maxRowsPerPage = 4;
      const maxColsPerPage = 2;
      const itemsPerPage = maxRowsPerPage * maxColsPerPage; // 8

      let currentFotoPage!: PDFPage;

      for (let idx = 0; idx < imagens.length; idx++) {
        const pageIdx = idx % itemsPerPage;
        const isNewPage = pageIdx === 0;

        if (isNewPage) {
          currentFotoPage = pdfDoc.addPage([595.28, 841.89]);
          const FW = currentFotoPage.getWidth();
          const FH = currentFotoPage.getHeight();

          // Cabeçalho da página de fotos
          currentFotoPage.drawRectangle({
            x: m.l,
            y: FH - m.t - 2,
            width: 5,
            height: 12,
            color: LUNARDELI_RED,
          });
          currentFotoPage.drawText('OBRA 10', {
            x: m.l + 10,
            y: FH - m.t,
            size: 11,
            font: bold,
            color: LUNARDELI_DARK,
          });
          
          const pagNum = Math.floor(idx / itemsPerPage) + 1;
          const sub = `GALERIA DE FOTOS — PÁGINA ${pagNum}`;
          const subW = reg.widthOfTextAtSize(sub, 8);
          currentFotoPage.drawText(sub, {
            x: FW - m.r - subW,
            y: FH - m.t,
            size: 8,
            font: reg,
            color: GRAY,
          });
          
          currentFotoPage.drawLine({
            start: { x: m.l, y: FH - m.t - 8 },
            end: { x: FW - m.r, y: FH - m.t - 8 },
            thickness: 0.5,
            color: LUNARDELI_LIGHT_GRAY,
          });
        }

        const img = imagens[idx];
        const col = pageIdx % maxColsPerPage;
        const row = Math.floor(pageIdx / maxColsPerPage);

        // Calcular coordenadas da célula
        const cellX = m.l + col * (colW + gapX);
        const cellY = (841.89 - m.t - 15) - (row + 1) * cellH - row * gapY;

        try {
          // 1. Carregar bytes da imagem (local ou remoto)
          let imgBytes: Uint8Array;
          if (img.urlS3.startsWith('/uploads/') || img.urlS3.startsWith('uploads/')) {
            const cleanPath = img.urlS3.startsWith('/') ? img.urlS3 : `/${img.urlS3}`;
            const filePath = path.join(process.cwd(), cleanPath);
            imgBytes = new Uint8Array(fs.readFileSync(filePath));
          } else {
            const response = await fetch(img.urlS3);
            if (!response.ok) continue;
            const arrayBuf = await response.arrayBuffer();
            imgBytes = new Uint8Array(arrayBuf);
          }

          // 2. Detectar orientação EXIF
          const orientation = this.getExifOrientation(imgBytes);

          // 3. Incorporar no PDF
          let embeddedImg;
          if (img.mimeType === 'image/jpeg') {
            embeddedImg = await pdfDoc.embedJpg(imgBytes);
          } else {
            embeddedImg = await pdfDoc.embedPng(imgBytes);
          }

          // 4. Calcular redimensionamento mantendo aspect ratio
          const maxW = 245;
          const maxH = 120;
          const isRotated = orientation === 6 || orientation === 8;
          const imgW = isRotated ? embeddedImg.height : embeddedImg.width;
          const imgH = isRotated ? embeddedImg.width : embeddedImg.height;

          const scale = Math.min(maxW / imgW, maxH / imgH);
          const dW = embeddedImg.width * scale;
          const dH = embeddedImg.height * scale;

          const visW = isRotated ? dH : dW;
          const visH = isRotated ? dW : dH;

          // Centralizar imagem na área reservada da célula (245x120)
          const imgX = cellX + (maxW - visW) / 2;
          const imgY = (cellY + 50) + (maxH - visH) / 2;

          // 5. Desenhar imagem com correção de rotação
          if (orientation === 6) {
            currentFotoPage.drawImage(embeddedImg, {
              x: imgX,
              y: imgY + dW,
              width: dW,
              height: dH,
              rotate: degrees(270),
            });
          } else if (orientation === 8) {
            currentFotoPage.drawImage(embeddedImg, {
              x: imgX + dH,
              y: imgY,
              width: dW,
              height: dH,
              rotate: degrees(90),
            });
          } else if (orientation === 3) {
            currentFotoPage.drawImage(embeddedImg, {
              x: imgX + dW,
              y: imgY + dH,
              width: dW,
              height: dH,
              rotate: degrees(180),
            });
          } else {
            currentFotoPage.drawImage(embeddedImg, {
              x: imgX,
              y: imgY,
              width: dW,
              height: dH,
            });
          }

          // 6. Desenhar borda cinza fina ao redor da foto
          currentFotoPage.drawRectangle({
            x: imgX - 0.5,
            y: imgY - 0.5,
            width: visW + 1,
            height: visH + 1,
            borderColor: LUNARDELI_LIGHT_GRAY,
            borderWidth: 0.5,
          });

          // 7. Link clicável
          this.addLinkAnnotation(pdfDoc, currentFotoPage, img.urlS3, [
            imgX,
            imgY,
            imgX + visW,
            imgY + visH,
          ]);

          // 8. Desenhar legenda e metadados
          const legendaText = img.nomeOriginal || 'Foto sem legenda';
          const lines = wrapText(legendaText, colW - 6, 7, reg);
          let textY = cellY + 40;
          const linesToDraw = lines.slice(0, 3); // máximo 3 linhas
          for (const line of linesToDraw) {
            const textW = reg.widthOfTextAtSize(line, 7);
            const textX = cellX + (colW - textW) / 2;
            currentFotoPage.drawText(line, {
              x: textX,
              y: textY,
              size: 7,
              font: reg,
              color: LUNARDELI_DARK,
            });
            textY -= 9;
          }

          const dataUpload = img.createdAt ? new Date(img.createdAt).toLocaleDateString('pt-BR') : '-';
          const metaText = `Por: ${img.criador?.nome || '-'} em ${dataUpload}`;
          const metaW = reg.widthOfTextAtSize(metaText, 6);
          const metaX = cellX + (colW - metaW) / 2;
          currentFotoPage.drawText(metaText, {
            x: metaX,
            y: cellY + 5,
            size: 6,
            font: reg,
            color: GRAY,
          });

        } catch (err) {
          console.error('[PdfService] Erro ao embutir foto em grade:', err);
        }
      }
    }

    // ── Numeração de páginas ─────────────────────────────────────────────────────
    const pages = pdfDoc.getPages();
    const total = pages.length;
    for (let i = 0; i < total; i++) {
      const p = pages[i];
      const text = `${i + 1}/${total}`;
      const size = 7;
      const textW = reg.widthOfTextAtSize(text, size);
      p.drawText(text, {
        x: p.getWidth() - m.r - textW,
        y: m.b - 15,
        size,
        font: reg,
        color: GRAY,
      });
    }

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  }

  private addPage(pdfDoc: PDFDocument, bold: PDFFont, reg: PDFFont, m: { l: number; r: number; t: number; b: number }): DrawCtx {
    const page = pdfDoc.addPage([595.28, 841.89]);
    const w = page.getWidth();
    const y = page.getHeight() - m.t;
    return { page, y, w, m, bold, reg, pdfDoc };
  }

  private addLinkAnnotation(
    pdfDoc: PDFDocument,
    page: PDFPage,
    url: string,
    rect: [number, number, number, number]
  ) {
    try {
      const uriAction = pdfDoc.context.obj({
        Type: 'Action',
        S: 'URI',
        URI: PDFString.of(url),
      });

      const linkAnnotation = pdfDoc.context.register(
        pdfDoc.context.obj({
          Type: 'Annot',
          Subtype: 'Link',
          Rect: rect,
          Border: [0, 0, 0],
          A: uriAction,
        })
      );

      const pageNode = page.node;
      if (!pageNode.has(PDFName.of('Annots'))) {
        pageNode.set(PDFName.of('Annots'), pdfDoc.context.obj([]));
      }
      const annots = pageNode.lookup(PDFName.of('Annots'));
      if (annots) {
        (annots as any).push(linkAnnotation);
      }
    } catch (err) {
      console.error('[PdfService] Erro ao adicionar link no PDF:', err);
    }
  }

  private getExifOrientation(bytes: Uint8Array): number {
    try {
      let offset = 0;
      if (bytes[offset] !== 0xff || bytes[offset + 1] !== 0xd8) {
        return 1;
      }
      offset += 2;
      const length = bytes.length;
      while (offset < length - 2) {
        if (bytes[offset] === 0xff && bytes[offset + 1] === 0xe1) {
          const exifOffset = offset + 4;
          if (
            bytes[exifOffset] === 0x45 &&
            bytes[exifOffset + 1] === 0x78 &&
            bytes[exifOffset + 2] === 0x69 &&
            bytes[exifOffset + 3] === 0x66 &&
            bytes[exifOffset + 4] === 0 &&
            bytes[exifOffset + 5] === 0
          ) {
            const tiffOffset = exifOffset + 6;
            let bigEndian = true;
            if (bytes[tiffOffset] === 0x49 && bytes[tiffOffset + 1] === 0x49) {
              bigEndian = false;
            } else if (bytes[tiffOffset] === 0x4d && bytes[tiffOffset + 1] === 0x4d) {
              bigEndian = true;
            } else {
              return 1;
            }

            const readUInt16 = (idx: number) => {
              if (bigEndian) {
                return (bytes[idx] << 8) + bytes[idx + 1];
              } else {
                return (bytes[idx + 1] << 8) + bytes[idx];
              }
            };

            const readUInt32 = (idx: number) => {
              if (bigEndian) {
                return (
                  (bytes[idx] << 24) +
                  (bytes[idx + 1] << 16) +
                  (bytes[idx + 2] << 8) +
                  bytes[idx + 3]
                );
              } else {
                return (
                  (bytes[idx + 3] << 24) +
                  (bytes[idx + 2] << 16) +
                  (bytes[idx + 1] << 8) +
                  bytes[idx]
                );
              }
            };

            const magic = readUInt16(tiffOffset + 2);
            if (magic !== 0x2a && magic !== 0x2a00 && magic !== 42) {
              return 1;
            }

            const ifdOffset = readUInt32(tiffOffset + 4);
            let curOffset = tiffOffset + ifdOffset;
            const numEntries = readUInt16(curOffset);
            curOffset += 2;

            for (let i = 0; i < numEntries; i++) {
              const tag = readUInt16(curOffset);
              if (tag === 0x0112) {
                const type = readUInt16(curOffset + 2);
                if (type === 3) {
                  return readUInt16(curOffset + 8);
                }
              }
              curOffset += 12;
            }
          }
          break;
        }
        offset++;
      }
    } catch (_e) {
      // Ignorar erros de parse EXIF
    }
    return 1;
  }

  private async loadImageBytes(url: string): Promise<Uint8Array | null> {
    if (!url) return null;
    try {
      const candidates: string[] = [];
      if (url.startsWith('/uploads/') || url.startsWith('uploads/')) {
        const clean = url.startsWith('/') ? url.slice(1) : url;
        candidates.push(path.join(process.cwd(), clean));
        candidates.push(path.join(process.cwd(), 'uploads', path.basename(clean)));
      } else if (!url.startsWith('http://') && !url.startsWith('https://')) {
        candidates.push(path.join(process.cwd(), url.startsWith('/') ? url.slice(1) : url));
        candidates.push(path.join(process.cwd(), 'uploads', path.basename(url)));
      }

      for (const filePath of candidates) {
        if (fs.existsSync(filePath)) {
          return new Uint8Array(fs.readFileSync(filePath));
        }
      }

      let fetchUrl = url;
      if (url.startsWith('/')) {
        const base =
          process.env.PUBLIC_APP_URL ||
          process.env.APP_URL ||
          (process.env.RAILWAY_PUBLIC_DOMAIN
            ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
            : '') ||
          'https://obra10.app.br';
        fetchUrl = `${base.replace(/\/$/, '')}${url}`;
      }

      if (fetchUrl.startsWith('http://') || fetchUrl.startsWith('https://')) {
        const response = await fetch(fetchUrl);
        if (!response.ok) {
          console.warn(
            `[PdfService] HTTP ${response.status} ao buscar logo: ${fetchUrl}`,
          );
          return null;
        }
        return new Uint8Array(await response.arrayBuffer());
      }

      return null;
    } catch (err) {
      console.warn('[PdfService] Falha ao carregar imagem:', err);
      return null;
    }
  }

  private async embedRasterImage(pdfDoc: PDFDocument, bytes: Uint8Array) {
    const isPng =
      bytes.length > 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47;
    const isJpg = bytes.length > 2 && bytes[0] === 0xff && bytes[1] === 0xd8;
    const isWebp =
      bytes.length > 12 &&
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50;

    if (isWebp) {
      console.warn(
        '[PdfService] Logo em WebP não é suportado no PDF. Use PNG ou JPG.',
      );
      return null;
    }
    if (isPng) return pdfDoc.embedPng(bytes);
    if (isJpg) return pdfDoc.embedJpg(bytes);
    try {
      return await pdfDoc.embedPng(bytes);
    } catch {
      try {
        return await pdfDoc.embedJpg(bytes);
      } catch {
        console.warn('[PdfService] Formato de logo não suportado no PDF.');
        return null;
      }
    }
  }
}
