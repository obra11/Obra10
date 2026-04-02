import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PdfService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Gera PDF do RDO aprovado.
   * Controle de acesso: empresaId do RDO deve bater com o do usuário (cor. #2).
   * Retorna Buffer pronto para stream.
   */
  async gerarPdfRdo(rdoId: string, usuarioEmpresaId: string): Promise<Buffer> {
    // Buscar RDO completo
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

    // Controle de acesso por empresa
    if (rdo.obra.empresa.id !== usuarioEmpresaId) {
      throw new ForbiddenException('Acesso negado: este RDO não pertence à sua empresa.');
    }

    // Lazy-load pdfmake (evita crash se não instalado)
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pdfmake = require('pdfmake/build/pdfmake');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const vfsFonts = require('pdfmake/build/vfs_fonts');
    pdfmake.vfs = vfsFonts.vfs;

    const dataStr = new Date(rdo.dataReferencia).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    const empresa = rdo.obra.empresa;
    const nomeEmpresa = empresa.nomeFantasia || empresa.razaoSocial || 'Empresa';

    const docDefinition: any = {
      pageSize: 'A4',
      pageMargins: [40, 60, 40, 60],
      defaultStyle: { font: 'Roboto', fontSize: 10 },
      styles: {
        header: { fontSize: 18, bold: true, color: '#dc2626' },
        subheader: { fontSize: 12, bold: true, color: '#374151', margin: [0, 12, 0, 4] },
        label: { fontSize: 9, color: '#6b7280', bold: true },
        value: { fontSize: 10, color: '#111827' },
        tableHeader: { bold: true, fillColor: '#f3f4f6', color: '#374151', fontSize: 9 },
        status: {
          fontSize: 11, bold: true,
          color: rdo.status === 'APROVADO' ? '#16a34a' : '#dc2626',
        },
      },
      content: [
        // Cabeçalho
        { text: 'RELATÓRIO DIÁRIO DE OBRA', style: 'header' },
        { text: `${nomeEmpresa} — ${rdo.obra.nome}`, fontSize: 11, color: '#6b7280', margin: [0, 2, 0, 8] },
        {
          canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: '#dc2626' }],
          margin: [0, 0, 0, 12],
        },

        // Informações gerais
        {
          columns: [
            { width: '*', stack: [{ text: 'DATA', style: 'label' }, { text: dataStr, style: 'value' }] },
            { width: '*', stack: [{ text: 'STATUS', style: 'label' }, { text: rdo.status, style: 'status' }] },
            { width: '*', stack: [{ text: 'CLIMA (MANHÃ / TARDE)', style: 'label' }, { text: `${(rdo.dadosExtras as any)?.climaManha ?? '-'} / ${(rdo.dadosExtras as any)?.climaTarde ?? '-'}`, style: 'value' }] },
            { width: '*', stack: [{ text: 'TERRENO', style: 'label' }, { text: (rdo.dadosExtras as any)?.condicaoTerreno ?? '-', style: 'value' }] },
          ],
          margin: [0, 0, 0, 16],
        },

        // Efetivo
        { text: 'EFETIVO', style: 'subheader' },
        rdo.efetivos.length > 0 ? {
          table: {
            widths: ['*', '*', 60],
            body: [
              [{ text: 'Função/Cargo', style: 'tableHeader' }, { text: 'Empresa', style: 'tableHeader' }, { text: 'Qtd', style: 'tableHeader', alignment: 'center' }],
              ...rdo.efetivos.map(e => [e.funcaoCargo, e.empresaTerceira, { text: String(e.quantidade), alignment: 'center' }]),
              [{ text: `TOTAL: ${rdo.efetivos.reduce((s, e) => s + e.quantidade, 0)} trabalhadores`, colSpan: 3, bold: true, fontSize: 9, color: '#374151' }, '', ''],
            ],
          },
          layout: 'lightHorizontalLines',
          margin: [0, 0, 0, 16],
        } : { text: 'Nenhum efetivo registrado.', color: '#9ca3af', margin: [0, 0, 0, 16] },

        // Tarefas
        { text: 'TAREFAS DO DIA', style: 'subheader' },
        rdo.tarefas.length > 0 ? {
          table: {
            widths: ['*', 80, 120],
            body: [
              [{ text: 'Descrição', style: 'tableHeader' }, { text: 'Frente', style: 'tableHeader' }, { text: 'Status / Motivo', style: 'tableHeader' }],
              ...rdo.tarefas.map(t => [
                t.descricao,
                t.frenteServico ?? '-',
                {
                  text: t.motivoNaoExecucao ? `${t.statusExecucao} — ${t.motivoNaoExecucao.replace(/_/g, ' ')}` : t.statusExecucao,
                  color: t.statusExecucao === 'EXECUTADO' ? '#16a34a' : t.statusExecucao === 'PARCIAL' ? '#d97706' : '#dc2626',
                  fontSize: 9,
                },
              ]),
            ],
          },
          layout: 'lightHorizontalLines',
          margin: [0, 0, 0, 16],
        } : { text: 'Nenhuma tarefa registrada.', color: '#9ca3af', margin: [0, 0, 0, 16] },

        // Atividades
        rdo.atividades.length > 0 ? [
          { text: 'ATIVIDADES', style: 'subheader' },
          { ul: rdo.atividades.map(a => a.descricao), margin: [0, 0, 0, 16] },
        ] : null,

        // Ocorrências
        rdo.ocorrencias.length > 0 ? [
          { text: 'OCORRÊNCIAS', style: 'subheader' },
          { ul: rdo.ocorrencias.map(o => `[${o.tipoOcorrencia}] ${o.descricao}${o.horasPerdidas ? ` — ${o.horasPerdidas}h perdidas` : ''}`) },
        ] : null,

        // Rodapé de aprovação
        { text: '', margin: [0, 16, 0, 0] },
        {
          canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: '#e5e7eb' }],
          margin: [0, 0, 0, 12],
        },
        {
          columns: [
            { text: `Elaborado por: ${rdo.criador.nome}`, fontSize: 9, color: '#6b7280' },
            rdo.status === 'APROVADO' ? {
              text: `✓ Aprovado por: ${rdo.aprovadorNome ?? rdo.aprovador?.nome ?? '-'} em ${rdo.aprovacaoAt ? new Date(rdo.aprovacaoAt).toLocaleDateString('pt-BR') : '-'}`,
              fontSize: 9, color: '#16a34a', alignment: 'right',
            } : { text: '' },
          ],
        },
        { text: `Gerado pelo OBRA 10 em ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`, fontSize: 8, color: '#9ca3af', margin: [0, 4, 0, 0] },
      ].flat().filter(Boolean),
    };

    return new Promise((resolve, reject) => {
      const doc = pdfmake.createPdf(docDefinition);
      doc.getBuffer((buffer: Buffer) => resolve(buffer), reject);
    });
  }
}
