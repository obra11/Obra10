import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import {
  CategoriaInsumo,
  Prisma,
  StatusDocumentoEntrada,
  StatusItemEntrada,
  TipoDocumentoEntrada,
  TipoInsumo,
  TipoMovimentoEstoque,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CapabilitiesService } from '../../core/capabilities/capabilities.service';
import { mergePermissoesObra } from '../../core/capabilities/role-capabilities';
import {
  inferirCategoria,
  normalizarDescricao,
  somenteDigitos,
  sugerirInsumos,
} from './estoque-match';
import { ExtracaoDocumentoService } from './extracao-documento.service';
import { garantirCodigosBarras, gerarCodigoBarras } from './codigo-barras';
import { montarRelatorio } from './estoque-relatorio';
import { gerarPdfRelatorio } from './estoque-relatorio-pdf';
import {
  arquivoEntradaValido,
  gravarArquivoEntrada,
  imagemParaVisao,
} from './estoque-storage';

function dinheiro(valor: unknown): number | null {
  if (valor == null || valor === '') return null;
  const n = Number(String(valor).replace(/\s/g, '').replace(',', '.'));
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 10000) / 10000;
}

type LocalRow = {
  id: string;
  empresaId: string;
  obraId: string | null;
  tipo: 'DEPOSITO_CENTRAL' | 'ALMOXARIFADO';
  nome: string;
  codigo: string;
  ativo: boolean;
};

@Injectable()
export class EstoqueService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly capabilities: CapabilitiesService,
    private readonly extracao: ExtracaoDocumentoService,
  ) {}

  async listarRecebedores(empresaId: string) {
    return this.prisma.usuario.findMany({
      where: { empresaId, deletedAt: null, ativo: true },
      select: { id: true, nome: true },
      orderBy: { nome: 'asc' },
    });
  }

  async listarLocais(empresaId: string, userId: string, obraId?: string) {
    const central = await this.garantirCentral(empresaId);
    const locais: LocalRow[] = [central];
    if (obraId) {
      await this.assertObra(empresaId, userId, obraId);
      locais.push(await this.garantirAlmox(empresaId, obraId));
    } else {
      const almox = await this.prisma.localEstoque.findMany({
        where: { empresaId, tipo: 'ALMOXARIFADO', ativo: true },
        include: { obra: { select: { id: true, nome: true } } },
        orderBy: { nome: 'asc' },
      });
      return { locais: [central, ...almox] };
    }
    return { locais };
  }

  async listarObras(empresaId: string) {
    return this.prisma.obra.findMany({
      where: { empresaId, deletedAt: null },
      select: { id: true, nome: true },
      orderBy: { nome: 'asc' },
    });
  }

  async listarSaldos(empresaId: string, userId: string, localId: string) {
    const local = await this.obterLocal(empresaId, localId);
    await this.assertPodeLocal(empresaId, userId, local, false);
    await garantirCodigosBarras(this.prisma, empresaId);
    return this.prisma.saldoEstoque.findMany({
      where: { empresaId, localId, quantidade: { gt: 0 } },
      include: {
        insumo: {
          select: {
            id: true,
            nome: true,
            unidade: true,
            categoria: true,
            ean: true,
            codigoBarras: true,
            codigo: true,
            tipo: true,
          },
        },
      },
      orderBy: { insumo: { nome: 'asc' } },
    });
  }

  async relatorio(
    empresaId: string,
    userId: string,
    query: {
      localId?: string;
      movimento?: string;
      de?: string;
      ate?: string;
      retiradoPor?: string;
      fornecedor?: string;
      insumoId?: string;
      tipoInsumo?: string;
      categoria?: string;
    },
  ) {
    if (!query.localId) throw new BadRequestException('Escolha o local.');
    const local = await this.obterLocal(empresaId, query.localId);
    await this.assertPodeLocal(empresaId, userId, local, false);
    return montarRelatorio(this.prisma, empresaId, {
      localId: local.id,
      movimento: query.movimento,
      de: query.de,
      ate: query.ate,
      retiradoPor: query.retiradoPor,
      fornecedor: query.fornecedor,
      insumoId: query.insumoId,
      tipoInsumo: query.tipoInsumo,
      categoria: query.categoria,
    });
  }

  async relatorioPdf(
    empresaId: string,
    userId: string,
    query: {
      localId?: string;
      movimento?: string;
      de?: string;
      ate?: string;
      retiradoPor?: string;
      fornecedor?: string;
      insumoId?: string;
      tipoInsumo?: string;
      categoria?: string;
    },
  ) {
    const dados = await this.relatorio(empresaId, userId, query);
    const local = await this.obterLocal(empresaId, query.localId || '');
    const empresa = await this.prisma.empresa.findFirst({
      where: { id: empresaId },
      select: { nomeFantasia: true, razaoSocial: true, nomeCompleto: true },
    });
    let material = '';
    if (query.insumoId) {
      const insumo = await this.prisma.catalogoInsumo.findFirst({
        where: { id: query.insumoId, empresaId },
        select: { nome: true },
      });
      material = insumo?.nome || '';
    }
    const movimento =
      query.movimento === 'SAIDA' ? 'Saída' : query.movimento === 'AMBOS' ? 'Entrada e saída' : 'Entrada';
    const tipo =
      query.tipoInsumo === 'MAO_DE_OBRA'
        ? 'Mão de obra'
        : query.tipoInsumo === 'EQUIPAMENTO'
          ? 'Equipamento'
          : query.tipoInsumo === 'EPI'
            ? 'EPI'
            : query.tipoInsumo === 'MATERIAL'
            ? 'Material'
            : '';
    const categoria =
      query.categoria === 'CONSTRUCAO'
        ? 'Construção'
        : query.categoria === 'LIMPEZA'
          ? 'Limpeza'
          : query.categoria === 'OUTRO'
            ? 'Outro'
            : '';
    const filtros = [
      material ? `Material: ${material}` : '',
      tipo ? `Tipo: ${tipo}` : '',
      categoria ? `Categoria: ${categoria}` : '',
      query.fornecedor?.trim() ? `Fornecedor: ${query.fornecedor.trim()}` : '',
      query.retiradoPor?.trim() ? `Quem retirou: ${query.retiradoPor.trim()}` : '',
    ].filter(Boolean);
    return gerarPdfRelatorio({
      empresa: empresa?.nomeFantasia || empresa?.razaoSocial || empresa?.nomeCompleto || 'Obra 10',
      local: local.nome,
      movimento,
      de: query.de,
      ate: query.ate,
      filtros,
      linhas: dados.linhas,
      curva: dados.curva,
      porMes: dados.porMes,
      totais: dados.totais,
    });
  }

  async listarEntradas(
    empresaId: string,
    userId: string,
    filtro: { localId?: string; obraId?: string },
  ) {
    if (filtro.localId) {
      const local = await this.obterLocal(empresaId, filtro.localId);
      await this.assertPodeLocal(empresaId, userId, local, false);
    }
    if (filtro.obraId) await this.assertObra(empresaId, userId, filtro.obraId);
    return this.prisma.documentoEntrada.findMany({
      where: {
        empresaId,
        ...(filtro.localId ? { localId: filtro.localId } : {}),
        ...(filtro.obraId ? { obraId: filtro.obraId } : {}),
      },
      include: {
        local: { select: { id: true, nome: true, tipo: true } },
        recebedor: { select: { id: true, nome: true } },
        itens: { select: { tipoInsumo: true }, orderBy: { ordem: 'asc' }, take: 1 },
        _count: { select: { itens: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async listarMovimentos(empresaId: string, userId: string, localId?: string) {
    if (!localId) throw new BadRequestException('Escolha o local.');
    const local = await this.obterLocal(empresaId, localId);
    await this.assertPodeLocal(empresaId, userId, local, false);
    return this.prisma.movimentoEstoque.findMany({
      where: {
        empresaId,
        tipo: { in: ['SAIDA', 'TRANSFERENCIA'] },
        OR: [{ localOrigemId: local.id }, { localDestinoId: local.id }],
      },
      include: {
        insumo: { select: { id: true, nome: true, unidade: true, tipo: true } },
        localOrigem: { select: { id: true, nome: true } },
        localDestino: { select: { id: true, nome: true } },
        usuario: { select: { id: true, nome: true } },
        funcionario: { select: { id: true, nome: true, funcao: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }).then((movimentos) => movimentos.map(({ assinatura: _assinatura, ...movimento }) => movimento));
  }

  async obterEntrada(empresaId: string, userId: string, id: string) {
    const doc = await this.prisma.documentoEntrada.findFirst({
      where: { id, empresaId },
      include: {
        itens: { orderBy: { ordem: 'asc' }, include: { insumo: { select: { id: true, nome: true, unidade: true, codigoBarras: true } } } },
        local: { select: { id: true, nome: true, tipo: true, obraId: true } },
        recebedor: { select: { id: true, nome: true } },
        criador: { select: { id: true, nome: true } },
      },
    });
    if (!doc) throw new NotFoundException('Documento não encontrado.');
    await this.assertPodeLocal(
      empresaId,
      userId,
      await this.obterLocal(empresaId, doc.localId),
      false,
    );
    return doc;
  }

  async criarEntrada(
    empresaId: string,
    userId: string,
    file: Express.Multer.File,
    body: { localId?: string; tipo?: string; tipoInsumo?: string; recebedorId?: string; obraId?: string },
  ) {
    if (!body.localId) throw new BadRequestException('Escolha o local de destino.');
    const local = await this.obterLocal(empresaId, body.localId);
    await this.assertPodeLocal(empresaId, userId, local, true);
    const recebedorId = await this.resolverRecebedor(empresaId, body.recebedorId, userId);
    const mime = arquivoEntradaValido(file);
    const imagemUrl = await gravarArquivoEntrada(file, mime);

    let obraId: string | null = local.obraId;
    if (!obraId && body.obraId) {
      const obra = await this.prisma.obra.findFirst({
        where: { id: body.obraId, empresaId, deletedAt: null },
        select: { id: true },
      });
      if (obra) obraId = obra.id;
    }

    const tipo = (['NFE', 'NFCE_CUPOM', 'FOTO'].includes(body.tipo || '')
      ? body.tipo
      : 'NFE') as TipoDocumentoEntrada;

    const doc = await this.prisma.documentoEntrada.create({
      data: {
        empresaId,
        localId: local.id,
        obraId,
        tipo,
        status: 'EXTRAINDO',
        recebedorId,
        criadorId: userId,
        imagemUrl,
        imagemMime: mime,
        imagemNome: file.originalname?.slice(0, 180) || null,
      },
    });

    if (obraId) {
      await this.prisma.anexo.create({
        data: {
          obraId,
          criadorId: userId,
          origem: 'NOTA_ENTRADA',
          attachableId: doc.id,
          tipoArquivo: mime.startsWith('image/') ? 'FOTO' : 'DOCUMENTO',
          nomeOriginal: file.originalname?.slice(0, 180) || null,
          mimeType: mime,
          tamanhoBytes: file.size || file.buffer.length,
          urlS3: imagemUrl,
        },
      });
    }

    let observacaoExtracao: string | null = null;
    let extraido: Awaited<ReturnType<ExtracaoDocumentoService['extrair']>> | null = null;
    if (!imagemParaVisao(mime) && mime !== 'application/pdf') {
      observacaoExtracao =
        'Arquivo arquivado. HEIC não é lido automaticamente — preencha os itens na conferência.';
    } else {
      try {
        extraido = await this.extracao.extrair(file.buffer, mime);
      } catch (err: any) {
        const semChave = String(err?.message || '') === 'SEM_CHAVE';
        observacaoExtracao = semChave
          ? 'A Luna não está disponível para ler esta nota. Preencha os itens na conferência.'
          : 'A Luna não conseguiu ler a imagem. A nota ficou salva — complete os dados na conferência.';
      }
    }

    const leituraVazia =
      extraido &&
      !extraido.itens.length &&
      !extraido.numero &&
      !extraido.fornecedor.razaoSocial &&
      !somenteDigitos(extraido.fornecedor.cnpj);
    if (leituraVazia) {
      observacaoExtracao =
        'A Luna leu o arquivo, mas não achou fornecedor nem itens. Complete na conferência.';
      extraido = null;
    }

    if (extraido) {
      await this.aplicarExtracao(empresaId, doc.id, extraido, this.tipoPedido(body.tipoInsumo));
    }

    await this.prisma.documentoEntrada.update({
      where: { id: doc.id },
      data: {
        status: 'EM_CONFERENCIA',
        ...(observacaoExtracao ? { observacaoExtracao } : {}),
      },
    });

    return this.obterEntrada(empresaId, userId, doc.id);
  }

  async lerArquivo(empresaId: string, userId: string, documentoId: string, tipoInsumo?: string) {
    const aberto = await this.documentoAberto(empresaId, userId, documentoId);
    const doc = await this.prisma.documentoEntrada.findFirst({
      where: { id: aberto.id, empresaId },
      include: { itens: true },
    });
    if (!doc?.imagemUrl) throw new BadRequestException('Essa entrada não tem arquivo.');
    if (doc.itens.some((item) => item.status !== 'PENDENTE')) {
      throw new BadRequestException('A conferência já tem itens decididos.');
    }
    const mime =
      doc.imagemMime ||
      (doc.imagemUrl.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
    let extraido: Awaited<ReturnType<ExtracaoDocumentoService['extrair']>>;
    try {
      extraido = await this.extracao.extrair(await this.bufferDaImagem(doc.imagemUrl), mime);
    } catch (err: any) {
      const semChave = String(err?.message || '') === 'SEM_CHAVE';
      throw new BadRequestException(
        semChave ? 'A Luna não está disponível para ler esta nota.' : 'A Luna não conseguiu ler a nota. Ela continua salva.',
      );
    }
    const temDado =
      extraido.itens.length > 0 ||
      Boolean(extraido.numero) ||
      Boolean(extraido.fornecedor.razaoSocial) ||
      Boolean(somenteDigitos(extraido.fornecedor.cnpj));
    if (!temDado) {
      await this.prisma.documentoEntrada.update({
        where: { id: doc.id },
        data: {
          observacaoExtracao: 'O PDF foi lido, mas não achei fornecedor nem itens. Complete na conferência.',
        },
      });
      return this.obterEntrada(empresaId, userId, doc.id);
    }
    if (doc.itens.length) {
      await this.prisma.documentoEntradaItem.deleteMany({
        where: { documentoId: doc.id, empresaId, status: 'PENDENTE' },
      });
    }
    await this.aplicarExtracao(empresaId, doc.id, extraido, this.tipoPedido(tipoInsumo));
    await this.prisma.documentoEntrada.update({
      where: { id: doc.id },
      data: { observacaoExtracao: null },
    });
    return this.obterEntrada(empresaId, userId, doc.id);
  }

  async criarEntradaManual(
    empresaId: string,
    userId: string,
    body: {
      localId?: string;
      recebedorId?: string;
      obraId?: string;
      numero?: string;
      serie?: string;
      chaveAcesso?: string;
      dataEmissao?: string;
      valorTotal?: number | string;
      fornecedorRazao?: string;
      fornecedorCnpj?: string;
      fornecedorIe?: string;
      fornecedorTelefone?: string;
      fornecedorEmail?: string;
      observacao?: string;
      itens?: Array<{
        descricao?: string;
        quantidade?: number | string;
        unidade?: string;
        valorUnitario?: number | string;
        valorTotal?: number | string;
        ncm?: string;
        ean?: string;
        tipoInsumo?: string;
      }>;
    },
  ) {
    if (!body.localId) throw new BadRequestException('Escolha o local de destino.');
    const local = await this.obterLocal(empresaId, body.localId);
    await this.assertPodeLocal(empresaId, userId, local, true);
    const recebedorId = await this.resolverRecebedor(empresaId, body.recebedorId, userId);

    const numero = (body.numero || '').trim();
    const fornecedorRazao = (body.fornecedorRazao || '').trim();
    if (!numero) throw new BadRequestException('Informe o número da nota.');
    if (!fornecedorRazao) throw new BadRequestException('Informe o fornecedor.');

    const cnpj = somenteDigitos(body.fornecedorCnpj);
    if (cnpj && cnpj.length !== 14 && cnpj.length !== 11) {
      throw new BadRequestException('CNPJ ou CPF do fornecedor inválido.');
    }
    const chave = somenteDigitos(body.chaveAcesso);
    if (chave && chave.length !== 44) {
      throw new BadRequestException('A chave de acesso precisa ter 44 dígitos.');
    }
    const email = (body.fornecedorEmail || '').trim();
    if (email && !email.includes('@')) {
      throw new BadRequestException('E-mail do fornecedor inválido.');
    }

    const brutos = Array.isArray(body.itens) ? body.itens : [];
    const linhas = brutos
      .map((item) => ({
        descricao: (item.descricao || '').trim(),
        quantidade: Number(String(item.quantidade ?? '').replace(',', '.')),
        unidade: item.unidade?.trim() || null,
        valorUnitario: dinheiro(item.valorUnitario),
        valorTotal: dinheiro(item.valorTotal),
        ncm: item.ncm?.trim() || null,
        ean: somenteDigitos(item.ean) || null,
        tipoInsumo: this.tipoPedido(item.tipoInsumo),
      }))
      .filter((item) => item.descricao);
    if (!linhas.length) throw new BadRequestException('Inclua ao menos um material.');

    for (const item of linhas) {
      if (!Number.isFinite(item.quantidade) || item.quantidade <= 0) {
        throw new BadRequestException(`Informe a quantidade de "${item.descricao}".`);
      }
      if (item.valorUnitario == null && item.valorTotal != null) {
        item.valorUnitario = item.valorTotal / item.quantidade;
      }
      if (item.valorTotal == null && item.valorUnitario != null) {
        item.valorTotal = item.valorUnitario * item.quantidade;
      }
      if (item.valorUnitario == null || item.valorUnitario < 0) {
        throw new BadRequestException(`Informe o preço de "${item.descricao}".`);
      }
    }

    const valorInformado = dinheiro(body.valorTotal);
    const soma = linhas.reduce((acc, item) => acc + (item.valorTotal || 0), 0);

    let obraId: string | null = local.obraId;
    if (!obraId && body.obraId) {
      const obra = await this.prisma.obra.findFirst({
        where: { id: body.obraId, empresaId, deletedAt: null },
        select: { id: true },
      });
      if (obra) obraId = obra.id;
    }

    const doc = await this.prisma.documentoEntrada.create({
      data: {
        empresaId,
        localId: local.id,
        obraId,
        tipo: 'MANUAL',
        status: 'EM_CONFERENCIA',
        numero,
        serie: body.serie?.trim() || null,
        chaveAcesso: chave || null,
        dataEmissao: body.dataEmissao
          ? new Date(`${body.dataEmissao.slice(0, 10)}T12:00:00.000Z`)
          : null,
        valorTotal: valorInformado != null ? valorInformado : soma,
        fornecedorCnpj: cnpj || null,
        fornecedorRazao,
        fornecedorIe: body.fornecedorIe?.trim() || null,
        fornecedorTelefone: body.fornecedorTelefone?.trim() || null,
        fornecedorEmail: email || null,
        observacao: (body.observacao || '').trim().slice(0, 2000) || null,
        recebedorId,
        criadorId: userId,
        imagemUrl: null,
      },
    });

    let ordem = 0;
    for (const item of linhas) {
      const candidatos = await this.candidatosDe(empresaId, item.descricao, item.ean, item.tipoInsumo);
      await this.prisma.documentoEntradaItem.create({
        data: {
          empresaId,
          documentoId: doc.id,
          ordem: ordem++,
          descricaoOriginal: item.descricao,
          descricaoNormalizada: normalizarDescricao(item.descricao),
          quantidade: item.quantidade,
          unidade: item.unidade,
          valorUnitario: item.valorUnitario,
          valorTotal: item.valorTotal,
          ncm: item.ncm,
          ean: item.ean,
          tipoInsumo: item.tipoInsumo,
          status: 'PENDENTE',
          candidatos: candidatos as unknown as Prisma.InputJsonValue,
        },
      });
    }

    return this.obterEntrada(empresaId, userId, doc.id);
  }

  async adicionarItem(
    empresaId: string,
    userId: string,
    documentoId: string,
    body: {
      descricao?: string;
      quantidade?: number;
      unidade?: string;
      ean?: string;
      valorUnitario?: number | string;
      valorTotal?: number | string;
      ncm?: string;
      tipoInsumo?: string;
    },
  ) {
    const doc = await this.documentoAberto(empresaId, userId, documentoId);
    const descricao = (body.descricao || '').trim();
    if (!descricao) throw new BadRequestException('Descrição do item é obrigatória.');
    const quantidade = Number(body.quantidade);
    if (!Number.isFinite(quantidade) || quantidade <= 0) {
      throw new BadRequestException('Informe uma quantidade maior que zero.');
    }
    const ordem = await this.prisma.documentoEntradaItem.count({
      where: { documentoId, empresaId },
    });
    const candidatos = await this.candidatosDe(empresaId, descricao, body.ean, this.tipoPedido(body.tipoInsumo));
    let valorUnitario = dinheiro(body.valorUnitario);
    let valorTotal = dinheiro(body.valorTotal);
    if (valorUnitario == null && valorTotal != null) valorUnitario = valorTotal / quantidade;
    if (valorTotal == null && valorUnitario != null) valorTotal = valorUnitario * quantidade;
    await this.prisma.documentoEntradaItem.create({
      data: {
        empresaId,
        documentoId: doc.id,
        ordem,
        descricaoOriginal: descricao,
        descricaoNormalizada: normalizarDescricao(descricao),
        quantidade,
        unidade: body.unidade?.trim() || null,
        ean: somenteDigitos(body.ean) || null,
        valorUnitario,
        valorTotal,
        ncm: body.ncm?.trim() || null,
        tipoInsumo: this.tipoPedido(body.tipoInsumo),
        status: 'PENDENTE',
        candidatos: candidatos as unknown as Prisma.InputJsonValue,
      },
    });
    return this.obterEntrada(empresaId, userId, doc.id);
  }

  async resolverItem(
    empresaId: string,
    userId: string,
    documentoId: string,
    itemId: string,
    body: {
      acao?: string;
      insumoId?: string;
      nome?: string;
      unidade?: string;
      quantidade?: number;
      ean?: string;
      tipo?: string;
    },
  ) {
    const doc = await this.documentoAberto(empresaId, userId, documentoId);
    const item = await this.prisma.documentoEntradaItem.findFirst({
      where: { id: itemId, documentoId: doc.id, empresaId },
    });
    if (!item) throw new NotFoundException('Item não encontrado.');

    const acao = body.acao;
    if (!acao || !['VINCULAR', 'NOVO', 'IGNORAR'].includes(acao)) {
      throw new BadRequestException('Ação inválida. Use VINCULAR, NOVO ou IGNORAR.');
    }

    let status: StatusItemEntrada = 'PENDENTE';
    let insumoId: string | null = null;
    if (acao === 'IGNORAR') status = 'IGNORADO';
    if (acao === 'NOVO') {
      status = 'NOVO';
      insumoId = await this.materialComCodigo(this.prisma, empresaId, {
        nome: body.nome?.trim() || item.descricaoOriginal,
        unidade: body.unidade !== undefined ? body.unidade : item.unidade,
        ean: body.ean !== undefined ? body.ean : item.ean,
        tipo: this.tipoPedido(body.tipo || item.tipoInsumo),
      });
    }
    if (acao === 'VINCULAR') {
      if (!body.insumoId) throw new BadRequestException('Escolha o insumo do cadastro.');
      const insumo = await this.prisma.catalogoInsumo.findFirst({
        where: { id: body.insumoId, empresaId, deletedAt: null },
        select: { id: true, codigoBarras: true },
      });
      if (!insumo) throw new NotFoundException('Insumo não encontrado nesta empresa.');
      if (!insumo.codigoBarras) {
        await this.prisma.catalogoInsumo.update({
          where: { id: insumo.id },
          data: { codigoBarras: await gerarCodigoBarras(this.prisma, empresaId) },
        });
      }
      status = 'VINCULADO';
      insumoId = insumo.id;
    }

    const descricao = body.nome?.trim() || item.descricaoOriginal;
    const quantidade =
      body.quantidade != null ? Number(body.quantidade) : Number(item.quantidade);
    if ((status === 'VINCULADO' || status === 'NOVO') && (!Number.isFinite(quantidade) || quantidade <= 0)) {
      throw new BadRequestException('Quantidade inválida.');
    }

    await this.prisma.documentoEntradaItem.update({
      where: { id: item.id },
      data: {
        status,
        insumoId,
        descricaoOriginal: descricao,
        descricaoNormalizada: normalizarDescricao(descricao),
        unidade: body.unidade !== undefined ? body.unidade.trim() || null : item.unidade,
        quantidade,
        ean: body.ean !== undefined ? somenteDigitos(body.ean) || null : item.ean,
        ...(acao === 'NOVO' ? { tipoInsumo: this.tipoPedido(body.tipo || item.tipoInsumo) } : {}),
      },
    });
    return this.obterEntrada(empresaId, userId, doc.id);
  }

  async aceitarSugestoes(empresaId: string, userId: string, documentoId: string) {
    const doc = await this.documentoAberto(empresaId, userId, documentoId);
    const itens = await this.prisma.documentoEntradaItem.findMany({
      where: { documentoId: doc.id, empresaId, status: 'PENDENTE' },
    });
    for (const item of itens) {
      const lista = Array.isArray(item.candidatos) ? (item.candidatos as any[]) : [];
      const primeiro = lista[0];
      if (!primeiro?.insumoId) continue;
      const insumo = await this.prisma.catalogoInsumo.findFirst({
        where: { id: String(primeiro.insumoId), empresaId, deletedAt: null },
        select: { id: true },
      });
      if (!insumo) continue;
      await this.prisma.documentoEntradaItem.update({
        where: { id: item.id },
        data: { status: 'VINCULADO', insumoId: insumo.id },
      });
    }
    return this.obterEntrada(empresaId, userId, doc.id);
  }

  async atualizarCabecalho(
    empresaId: string,
    userId: string,
    documentoId: string,
    body: {
      numero?: string;
      serie?: string;
      chaveAcesso?: string;
      dataEmissao?: string;
      localId?: string;
      recebedorId?: string;
      fornecedorCnpj?: string;
      fornecedorRazao?: string;
      fornecedorIe?: string;
      fornecedorTelefone?: string;
      fornecedorEmail?: string;
      valorTotal?: number | string;
      observacao?: string;
    },
  ) {
    const doc = await this.documentoAberto(empresaId, userId, documentoId);
    let localId = doc.localId;
    let obraId = doc.obraId;
    if (body.localId && body.localId !== doc.localId) {
      const local = await this.obterLocal(empresaId, body.localId);
      await this.assertPodeLocal(empresaId, userId, local, true);
      localId = local.id;
      obraId = local.obraId || doc.obraId;
    }
    const recebedorId = body.recebedorId
      ? await this.resolverRecebedor(empresaId, body.recebedorId, userId)
      : doc.recebedorId;
    const chave = body.chaveAcesso != null ? somenteDigitos(body.chaveAcesso) : undefined;

    await this.prisma.documentoEntrada.update({
      where: { id: doc.id },
      data: {
        localId,
        obraId,
        recebedorId,
        ...(body.numero !== undefined ? { numero: body.numero.trim() || null } : {}),
        ...(body.serie !== undefined ? { serie: body.serie.trim() || null } : {}),
        ...(chave !== undefined ? { chaveAcesso: chave.length === 44 ? chave : chave || null } : {}),
        ...(body.dataEmissao !== undefined
          ? {
              dataEmissao: body.dataEmissao
                ? new Date(`${body.dataEmissao.slice(0, 10)}T12:00:00.000Z`)
                : null,
            }
          : {}),
        ...(body.fornecedorCnpj !== undefined
          ? { fornecedorCnpj: somenteDigitos(body.fornecedorCnpj) || null }
          : {}),
        ...(body.fornecedorRazao !== undefined
          ? { fornecedorRazao: body.fornecedorRazao.trim() || null }
          : {}),
        ...(body.fornecedorIe !== undefined
          ? { fornecedorIe: body.fornecedorIe.trim() || null }
          : {}),
        ...(body.fornecedorTelefone !== undefined
          ? { fornecedorTelefone: body.fornecedorTelefone.trim() || null }
          : {}),
        ...(body.fornecedorEmail !== undefined
          ? { fornecedorEmail: body.fornecedorEmail.trim() || null }
          : {}),
        ...(body.valorTotal !== undefined ? { valorTotal: dinheiro(body.valorTotal) } : {}),
        ...(body.observacao !== undefined
          ? { observacao: body.observacao.trim().slice(0, 2000) || null }
          : {}),
      },
    });
    return this.obterEntrada(empresaId, userId, doc.id);
  }

  async confirmar(empresaId: string, userId: string, documentoId: string) {
    const doc = await this.prisma.documentoEntrada.findFirst({
      where: { id: documentoId, empresaId },
      include: { itens: true },
    });
    if (!doc) throw new NotFoundException('Documento não encontrado.');
    if (doc.status !== 'EM_CONFERENCIA') {
      throw new BadRequestException('Este documento não está em conferência.');
    }
    await this.assertPodeLocal(
      empresaId,
      userId,
      await this.obterLocal(empresaId, doc.localId),
      true,
    );
    await this.assertRecebedorOuGestor(empresaId, userId, doc.recebedorId);

    const pendente = doc.itens.find((i) => i.status === 'PENDENTE');
    if (pendente) {
      throw new BadRequestException(
        'Ainda há itens sem decisão. Vincule, cadastre como novo ou ignore cada linha.',
      );
    }
    for (const item of doc.itens) {
      if (item.status === 'VINCULADO' && !item.insumoId) {
        throw new BadRequestException(`O item "${item.descricaoOriginal}" não tem insumo vinculado.`);
      }
      if (
        (item.status === 'VINCULADO' || item.status === 'NOVO') &&
        new Prisma.Decimal(item.quantidade).lte(0)
      ) {
        throw new BadRequestException(`Quantidade inválida em "${item.descricaoOriginal}".`);
      }
    }

    await this.prisma.$transaction(async (tx) => {
      const travou = await tx.documentoEntrada.updateMany({
        where: { id: doc.id, empresaId, status: 'EM_CONFERENCIA' },
        data: { status: 'CONFIRMADA', confirmadoEm: new Date() },
      });
      if (travou.count !== 1) {
        throw new BadRequestException('Este documento não está em conferência.');
      }

      const fornecedorId = await this.upsertFornecedor(tx, empresaId, doc);

      for (const item of doc.itens) {
        if (item.status === 'IGNORADO') continue;
        let insumoId = item.insumoId;
        if (item.status === 'NOVO') {
          insumoId =
            item.insumoId ||
            (await this.materialComCodigo(tx, empresaId, {
              nome: item.descricaoOriginal,
              unidade: item.unidade,
              ean: item.ean,
              tipo: item.tipoInsumo || TipoInsumo.MATERIAL,
            }));
        }
        if (!insumoId) {
          throw new BadRequestException(`Item sem insumo: ${item.descricaoOriginal}`);
        }
        const insumo = await tx.catalogoInsumo.findFirst({
          where: { id: insumoId, empresaId, deletedAt: null },
          select: { id: true, ean: true, codigoBarras: true },
        });
        if (!insumo) throw new NotFoundException('Insumo não encontrado nesta empresa.');
        if (item.ean && !insumo.ean) {
          await tx.catalogoInsumo.update({
            where: { id: insumo.id },
            data: { ean: item.ean },
          });
        }
        if (!insumo.codigoBarras) {
          await tx.catalogoInsumo.update({
            where: { id: insumo.id },
            data: { codigoBarras: await gerarCodigoBarras(tx, empresaId) },
          });
        }

        const norm = item.descricaoNormalizada || normalizarDescricao(item.descricaoOriginal);
        if (norm) {
          const alias = await tx.insumoAlias.findFirst({
            where: { empresaId, descricaoNormalizada: norm },
          });
          if (!alias) {
            await tx.insumoAlias.create({
              data: {
                empresaId,
                insumoId,
                fornecedorId,
                descricaoOriginal: item.descricaoOriginal,
                descricaoNormalizada: norm,
              },
            });
          } else if (alias.insumoId !== insumoId) {
            await tx.insumoAlias.update({
              where: { id: alias.id },
              data: { insumoId, fornecedorId, descricaoOriginal: item.descricaoOriginal },
            });
          }
        }

        if (item.insumoId !== insumoId) {
          await tx.documentoEntradaItem.update({
            where: { id: item.id },
            data: { insumoId },
          });
        }
        await this.somarSaldo(tx, empresaId, doc.localId, insumoId, new Prisma.Decimal(item.quantidade));
        await tx.movimentoEstoque.create({
          data: {
            empresaId,
            tipo: TipoMovimentoEstoque.ENTRADA,
            insumoId,
            localDestinoId: doc.localId,
            quantidade: item.quantidade,
            documentoId: doc.id,
            usuarioId: userId,
          },
        });
      }

      if (fornecedorId) {
        await tx.documentoEntrada.update({
          where: { id: doc.id },
          data: { fornecedorId },
        });
      }

      await tx.auditLog.create({
        data: {
          empresaId,
          obraId: doc.obraId,
          usuarioId: userId,
          tabelaAfetada: 'documentos_entrada',
          registroId: doc.id,
          acao: 'CONFIRMAR_ENTRADA',
          cargaNova: JSON.stringify({ itens: doc.itens.length, localId: doc.localId }),
        },
      });
    });

    return this.obterEntrada(empresaId, userId, doc.id);
  }

  async rejeitar(empresaId: string, userId: string, documentoId: string, motivo?: string) {
    const doc = await this.documentoAberto(empresaId, userId, documentoId);
    await this.prisma.documentoEntrada.update({
      where: { id: doc.id },
      data: {
        status: 'REJEITADA' as StatusDocumentoEntrada,
        rejeitadoMotivo: motivo?.trim() || null,
      },
    });
    return this.obterEntrada(empresaId, userId, doc.id);
  }

  async estornar(empresaId: string, userId: string, documentoId: string) {
    const doc = await this.prisma.documentoEntrada.findFirst({
      where: { id: documentoId, empresaId },
    });
    if (!doc) throw new NotFoundException('Documento não encontrado.');
    if (doc.status !== 'CONFIRMADA') {
      throw new BadRequestException('Só é possível estornar uma entrada confirmada.');
    }
    await this.assertPodeLocal(
      empresaId,
      userId,
      await this.obterLocal(empresaId, doc.localId),
      true,
    );
    await this.assertRecebedorOuGestor(empresaId, userId, doc.recebedorId);

    await this.prisma.$transaction(async (tx) => {
      const travou = await tx.documentoEntrada.updateMany({
        where: { id: doc.id, empresaId, status: 'CONFIRMADA' },
        data: { status: 'ESTORNADA' },
      });
      if (travou.count !== 1) {
        throw new BadRequestException('Só é possível estornar uma entrada confirmada.');
      }
      const movimentos = await tx.movimentoEstoque.findMany({
        where: { documentoId: doc.id, empresaId, tipo: 'ENTRADA' },
      });
      for (const mov of movimentos) {
        if (!mov.localDestinoId) continue;
        await this.baixarSaldo(
          tx,
          empresaId,
          mov.localDestinoId,
          mov.insumoId,
          new Prisma.Decimal(mov.quantidade),
        );
        await tx.movimentoEstoque.create({
          data: {
            empresaId,
            tipo: 'ESTORNO',
            insumoId: mov.insumoId,
            localOrigemId: mov.localDestinoId,
            quantidade: mov.quantidade,
            documentoId: doc.id,
            usuarioId: userId,
            motivo: 'Estorno de entrada',
          },
        });
      }
      await tx.auditLog.create({
        data: {
          empresaId,
          obraId: doc.obraId,
          usuarioId: userId,
          tabelaAfetada: 'documentos_entrada',
          registroId: doc.id,
          acao: 'ESTORNAR_ENTRADA',
        },
      });
    });
    return this.obterEntrada(empresaId, userId, doc.id);
  }

  async saida(
    empresaId: string,
    userId: string,
    body: {
      localId?: string;
      codigo?: string;
      insumoId?: string;
      quantidade?: number;
      motivo?: string;
      retiradoPor?: string;
      funcionarioId?: string;
      dataRecebimento?: string;
      validadeEpi?: string;
      ca?: string;
      assinatura?: string;
    },
    peloRh = false,
  ) {
    if (!body.localId) throw new BadRequestException('Escolha o local.');
    const local = await this.obterLocal(empresaId, body.localId);
    await this.assertPodeLocal(empresaId, userId, local, true);
    const quantidade = Number(body.quantidade);
    if (!Number.isFinite(quantidade) || quantidade <= 0) {
      throw new BadRequestException('Informe a quantidade da saída.');
    }
    const insumo = await this.buscarInsumoPorCodigo(empresaId, body.codigo, body.insumoId);
    if (insumo.tipo === TipoInsumo.EPI && !peloRh) {
      throw new BadRequestException('A entrega de EPI é feita no RH, com a assinatura de quem recebeu.');
    }
    if (peloRh && insumo.tipo !== TipoInsumo.EPI) {
      throw new BadRequestException('O RH entrega somente EPI.');
    }
    const qtd = new Prisma.Decimal(quantidade);
    const entrega = await this.entregaEpi(empresaId, insumo.tipo, local.obraId, body);
    const assinatura = peloRh ? this.assinaturaPng(body.assinatura) : null;

    await this.prisma.$transaction(async (tx) => {
      await this.baixarSaldo(tx, empresaId, local.id, insumo.id, qtd);
      await tx.movimentoEstoque.create({
        data: {
          empresaId,
          tipo: 'SAIDA',
          insumoId: insumo.id,
          localOrigemId: local.id,
          quantidade: qtd,
          usuarioId: userId,
          motivo: body.motivo?.trim() || null,
          retiradoPor: entrega?.nome || body.retiradoPor?.trim().slice(0, 120) || null,
          funcionarioId: entrega?.id || null,
          dataRecebimento: entrega?.data || null,
          validadeEpi: entrega?.validade || null,
          ca: entrega?.ca || null,
          assinatura,
        },
      });
      await tx.auditLog.create({
        data: {
          empresaId,
          obraId: local.obraId,
          usuarioId: userId,
          tabelaAfetada: 'movimentos_estoque',
          registroId: insumo.id,
          acao: 'SAIDA_ESTOQUE',
          cargaNova: JSON.stringify({
            localId: local.id,
            quantidade,
            retiradoPor: body.retiradoPor?.trim().slice(0, 120) || null,
          }),
        },
      });
    });

    return { insumo, quantidade };
  }

  async transferir(
    empresaId: string,
    userId: string,
    body: {
      origemLocalId?: string;
      destinoLocalId?: string;
      obraDestinoId?: string;
      insumoId?: string;
      quantidade?: number;
    },
  ) {
    if (!body.origemLocalId || !body.insumoId) {
      throw new BadRequestException('Informe a origem e o insumo.');
    }
    const origem = await this.obterLocal(empresaId, body.origemLocalId);
    await this.assertPodeLocal(empresaId, userId, origem, true);
    let destinoId = body.destinoLocalId;
    if (!destinoId && body.obraDestinoId) {
      await this.assertObra(empresaId, userId, body.obraDestinoId);
      destinoId = (await this.garantirAlmox(empresaId, body.obraDestinoId)).id;
    }
    if (!destinoId) throw new BadRequestException('Escolha o destino.');
    if (destinoId === origem.id) {
      throw new BadRequestException('Origem e destino são o mesmo local.');
    }
    const destino = await this.obterLocal(empresaId, destinoId);
    await this.assertPodeLocal(empresaId, userId, destino, true);
    const quantidade = Number(body.quantidade);
    if (!Number.isFinite(quantidade) || quantidade <= 0) {
      throw new BadRequestException('Informe a quantidade.');
    }
    const insumo = await this.prisma.catalogoInsumo.findFirst({
      where: { id: body.insumoId, empresaId, deletedAt: null },
    });
    if (!insumo) throw new NotFoundException('Insumo não encontrado nesta empresa.');
    const qtd = new Prisma.Decimal(quantidade);

    await this.prisma.$transaction(async (tx) => {
      await this.baixarSaldo(tx, empresaId, origem.id, insumo.id, qtd);
      await this.somarSaldo(tx, empresaId, destino.id, insumo.id, qtd);
      await tx.movimentoEstoque.create({
        data: {
          empresaId,
          tipo: 'TRANSFERENCIA',
          insumoId: insumo.id,
          localOrigemId: origem.id,
          localDestinoId: destino.id,
          quantidade: qtd,
          usuarioId: userId,
        },
      });
    });
    return { ok: true };
  }

  async etiqueta(empresaId: string, insumoId: string) {
    const insumo = await this.prisma.catalogoInsumo.findFirst({
      where: { id: insumoId, empresaId, deletedAt: null },
    });
    if (!insumo) throw new NotFoundException('Insumo não encontrado nesta empresa.');
    let codigoBarras = insumo.codigoBarras;
    if (!codigoBarras) {
      codigoBarras = await gerarCodigoBarras(this.prisma, empresaId);
      await this.prisma.catalogoInsumo.update({
        where: { id: insumo.id },
        data: { codigoBarras },
      });
    }
    return {
      id: insumo.id,
      nome: insumo.nome,
      unidade: insumo.unidade,
      codigoBarras,
      ean: insumo.ean,
    };
  }

  async porCodigo(empresaId: string, userId: string, codigo: string, localId: string) {
    const local = await this.obterLocal(empresaId, localId);
    await this.assertPodeLocal(empresaId, userId, local, false);
    const insumo = await this.buscarInsumoPorCodigo(empresaId, codigo, undefined);
    const saldo = await this.prisma.saldoEstoque.findUnique({
      where: { localId_insumoId: { localId: local.id, insumoId: insumo.id } },
    });
    return {
      insumo: {
        id: insumo.id,
        nome: insumo.nome,
        unidade: insumo.unidade,
        codigoBarras: insumo.codigoBarras,
        ean: insumo.ean,
        tipo: insumo.tipo,
      },
      quantidade: saldo ? Number(saldo.quantidade) : 0,
    };
  }

  private async aplicarExtracao(
    empresaId: string,
    documentoId: string,
    extraido: Awaited<ReturnType<ExtracaoDocumentoService['extrair']>>,
    tipoInsumo: TipoInsumo = TipoInsumo.MATERIAL,
  ) {
    const cnpj = somenteDigitos(extraido.fornecedor.cnpj);
    let fornecedorId: string | null = null;
    if (cnpj.length === 14) {
      const existente = await this.prisma.fornecedor.findFirst({
        where: { empresaId, cnpj, deletedAt: null },
        select: { id: true },
      });
      fornecedorId = existente?.id || null;
    }
    await this.prisma.documentoEntrada.update({
      where: { id: documentoId },
      data: {
        ...(extraido.tipo ? { tipo: extraido.tipo } : {}),
        numero: extraido.numero,
        serie: extraido.serie,
        chaveAcesso: extraido.chaveAcesso,
        dataEmissao: extraido.dataEmissao
          ? new Date(`${extraido.dataEmissao}T12:00:00.000Z`)
          : null,
        valorTotal: extraido.valorTotal,
        fornecedorId,
        fornecedorCnpj: cnpj || null,
        fornecedorRazao: extraido.fornecedor.razaoSocial,
        fornecedorIe: extraido.fornecedor.ie,
        fornecedorTelefone: extraido.fornecedor.telefone,
        fornecedorEmail: extraido.fornecedor.email,
        ...(tipoInsumo === TipoInsumo.MAO_DE_OBRA && extraido.itens.length
          ? { observacao: extraido.itens.map((item) => item.descricao).join('; ').slice(0, 2000) }
          : {}),
      },
    });

    let ordem = 0;
    for (const item of extraido.itens) {
      const candidatos = await this.candidatosDe(empresaId, item.descricao, item.ean, tipoInsumo);
      await this.prisma.documentoEntradaItem.create({
        data: {
          empresaId,
          documentoId,
          ordem: ordem++,
          descricaoOriginal: item.descricao,
          descricaoNormalizada: normalizarDescricao(item.descricao),
          quantidade: item.quantidade > 0 ? item.quantidade : 1,
          unidade: item.unidade,
          valorUnitario: item.valorUnitario,
          valorTotal: item.valorTotal,
          ncm: item.ncm,
          ean: item.ean,
          tipoInsumo,
          status: 'PENDENTE',
          candidatos: candidatos as unknown as Prisma.InputJsonValue,
        },
      });
    }
  }

  private async candidatosDe(
    empresaId: string,
    descricao: string,
    ean?: string | null,
    tipo?: TipoInsumo,
  ) {
    const insumos = await this.prisma.catalogoInsumo.findMany({
      where: {
        empresaId,
        deletedAt: null,
        ativo: true,
        tipo: tipo || { in: [TipoInsumo.MATERIAL, TipoInsumo.MAO_DE_OBRA, TipoInsumo.EQUIPAMENTO] },
      },
      select: { id: true, nome: true, ean: true },
    });
    const aliases = await this.prisma.insumoAlias.findMany({
      where: { empresaId },
      select: { insumoId: true, descricaoNormalizada: true },
    });
    return sugerirInsumos({ descricao, ean, insumos, aliases });
  }

  private async upsertFornecedor(
    tx: Prisma.TransactionClient,
    empresaId: string,
    doc: {
      fornecedorCnpj: string | null;
      fornecedorRazao: string | null;
      fornecedorIe: string | null;
      fornecedorTelefone: string | null;
      fornecedorEmail: string | null;
      fornecedorId: string | null;
    },
  ): Promise<string | null> {
    const cnpj = somenteDigitos(doc.fornecedorCnpj);
    const razao = doc.fornecedorRazao?.trim() || '';
    if (!cnpj && !razao && !doc.fornecedorId) return null;
    if (cnpj.length === 14) {
      const existente = await tx.fornecedor.findFirst({
        where: { empresaId, cnpj },
      });
      if (existente) {
        await tx.fornecedor.update({
          where: { id: existente.id },
          data: {
            razaoSocial: razao || existente.razaoSocial,
            ie: doc.fornecedorIe || existente.ie,
            telefone: doc.fornecedorTelefone || existente.telefone,
            email: doc.fornecedorEmail || existente.email,
            deletedAt: null,
            ativo: true,
          },
        });
        return existente.id;
      }
    }
    if (doc.fornecedorId) {
      const atual = await tx.fornecedor.findFirst({
        where: { id: doc.fornecedorId, empresaId },
      });
      if (atual) return atual.id;
    }
    if (!razao && !cnpj) return null;
    const criado = await tx.fornecedor.create({
      data: {
        empresaId,
        cnpj: cnpj.length === 14 ? cnpj : null,
        razaoSocial: razao || `Fornecedor ${cnpj}`,
        ie: doc.fornecedorIe,
        telefone: doc.fornecedorTelefone,
        email: doc.fornecedorEmail,
      },
    });
    return criado.id;
  }

  private async somarSaldo(
    tx: Prisma.TransactionClient,
    empresaId: string,
    localId: string,
    insumoId: string,
    quantidade: Prisma.Decimal,
  ) {
    const saldo = await tx.saldoEstoque.findUnique({
      where: { localId_insumoId: { localId, insumoId } },
    });
    if (!saldo) {
      await tx.saldoEstoque.create({
        data: { empresaId, localId, insumoId, quantidade },
      });
      return;
    }
    await tx.saldoEstoque.update({
      where: { id: saldo.id },
      data: { quantidade: new Prisma.Decimal(saldo.quantidade).plus(quantidade) },
    });
  }

  private async baixarSaldo(
    tx: Prisma.TransactionClient,
    empresaId: string,
    localId: string,
    insumoId: string,
    quantidade: Prisma.Decimal,
  ) {
    const saldo = await tx.saldoEstoque.findFirst({
      where: { localId, insumoId, empresaId },
    });
    const atual = saldo ? new Prisma.Decimal(saldo.quantidade) : new Prisma.Decimal(0);
    if (atual.lessThan(quantidade)) {
      throw new BadRequestException('Saldo insuficiente.');
    }
    await tx.saldoEstoque.update({
      where: { id: saldo!.id },
      data: { quantidade: atual.minus(quantidade) },
    });
  }

  private assinaturaPng(valor?: string) {
    const prefixo = 'data:image/png;base64,';
    if (!valor || !valor.startsWith(prefixo)) {
      throw new BadRequestException('Assine o termo de recebimento na tela.');
    }
    const corpo = valor.slice(prefixo.length);
    if (corpo.length < 200 || valor.length > 500_000 || !/^[A-Za-z0-9+/=]+$/.test(corpo)) {
      throw new BadRequestException('A assinatura não pôde ser gravada. Assine de novo.');
    }
    return valor;
  }

  private async entregaEpi(
    empresaId: string,
    tipo: TipoInsumo,
    obraId: string | null,
    body: { funcionarioId?: string; dataRecebimento?: string; validadeEpi?: string; ca?: string },
  ) {
    if (tipo !== TipoInsumo.EPI) return null;
    if (!body.funcionarioId) throw new BadRequestException('Escolha o funcionário que recebeu o EPI.');
    if (!body.dataRecebimento || !/^\d{4}-\d{2}-\d{2}$/.test(body.dataRecebimento)) {
      throw new BadRequestException('Informe a data de recebimento.');
    }
    if (!body.validadeEpi || !/^\d{4}-\d{2}-\d{2}$/.test(body.validadeEpi)) {
      throw new BadRequestException('Informe a validade do EPI.');
    }
    if (body.validadeEpi < body.dataRecebimento) {
      throw new BadRequestException('A validade do EPI não pode ser anterior ao recebimento.');
    }
    const ca = body.ca?.trim() || '';
    if (ca && !/^[A-Za-z0-9./-]{1,30}$/.test(ca)) {
      throw new BadRequestException('O número do CA está inválido.');
    }
    const funcionario = await this.prisma.funcionario.findFirst({
      where: {
        id: body.funcionarioId,
        empresaId,
        ativo: true,
        deletedAt: null,
        ...(obraId ? { obraId } : {}),
      },
    });
    if (!funcionario) {
      throw new NotFoundException(obraId ? 'Funcionário não encontrado nesta obra.' : 'Funcionário não encontrado nesta empresa.');
    }
    return {
      id: funcionario.id,
      nome: funcionario.nome.slice(0, 120),
      data: new Date(`${body.dataRecebimento}T12:00:00.000-03:00`),
      validade: new Date(`${body.validadeEpi}T12:00:00.000-03:00`),
      ca: ca ? ca.slice(0, 30).toUpperCase() : null,
    };
  }

  private tipoPedido(valor?: string | null): TipoInsumo {
    if (
      valor === TipoInsumo.MAO_DE_OBRA ||
      valor === TipoInsumo.EQUIPAMENTO ||
      valor === TipoInsumo.EPI
    ) {
      return valor;
    }
    return TipoInsumo.MATERIAL;
  }

  private async materialComCodigo(
    db: Prisma.TransactionClient | PrismaService,
    empresaId: string,
    item: { nome: string; unidade?: string | null; ean?: string | null; tipo?: TipoInsumo },
  ) {
    const nome = item.nome.trim();
    const tipo = item.tipo || TipoInsumo.MATERIAL;
    if (!nome) throw new BadRequestException('Informe o nome do material.');
    const existente = await db.catalogoInsumo.findFirst({
      where: {
        empresaId,
        deletedAt: null,
        tipo,
        nome: { equals: nome, mode: 'insensitive' },
      },
      select: { id: true, codigoBarras: true },
    });
    if (existente) {
      if (!existente.codigoBarras) {
        await db.catalogoInsumo.update({
          where: { id: existente.id },
          data: { codigoBarras: await gerarCodigoBarras(db, empresaId) },
        });
      }
      return existente.id;
    }
    const criado = await db.catalogoInsumo.create({
      data: {
        empresaId,
        tipo,
        nome,
        unidade: item.unidade?.trim() || null,
        ean: somenteDigitos(item.ean) || null,
        categoria: inferirCategoria(nome) as CategoriaInsumo,
        codigoBarras: await gerarCodigoBarras(db, empresaId),
      },
      select: { id: true },
    });
    return criado.id;
  }

  private async buscarInsumoPorCodigo(empresaId: string, codigo?: string, insumoId?: string) {
    const bruto = (codigo || '').trim();
    if (!bruto && !insumoId) throw new BadRequestException('Informe o código ou o material.');
    const digitos = somenteDigitos(bruto);
    const insumo = await this.prisma.catalogoInsumo.findFirst({
      where: {
        empresaId,
        deletedAt: null,
        OR: [
          ...(insumoId ? [{ id: insumoId }] : []),
          ...(bruto ? [{ codigoBarras: bruto }] : []),
          ...(digitos.length >= 8 ? [{ ean: digitos }] : []),
        ],
      },
    });
    if (!insumo) {
      throw new NotFoundException(
        insumoId ? 'Insumo não encontrado nesta empresa.' : 'Nenhum insumo com esse código nesta empresa.',
      );
    }
    return insumo;
  }

  private async garantirCentral(empresaId: string): Promise<LocalRow> {
    const existente = await this.prisma.localEstoque.findFirst({
      where: { empresaId, codigo: 'CENTRAL' },
    });
    if (existente) return existente;
    try {
      return await this.prisma.localEstoque.create({
        data: {
          empresaId,
          tipo: 'DEPOSITO_CENTRAL',
          nome: 'Depósito central',
          codigo: 'CENTRAL',
        },
      });
    } catch {
      const deNovo = await this.prisma.localEstoque.findFirst({
        where: { empresaId, codigo: 'CENTRAL' },
      });
      if (deNovo) return deNovo;
      throw new BadRequestException('Não foi possível abrir o depósito central.');
    }
  }

  private async garantirAlmox(empresaId: string, obraId: string): Promise<LocalRow> {
    const obra = await this.prisma.obra.findFirst({
      where: { id: obraId, empresaId, deletedAt: null },
    });
    if (!obra) throw new NotFoundException('Obra não encontrada.');
    const existente = await this.prisma.localEstoque.findFirst({
      where: { empresaId, codigo: obraId },
    });
    if (existente) return existente;
    try {
      return await this.prisma.localEstoque.create({
        data: {
          empresaId,
          obraId,
          tipo: 'ALMOXARIFADO',
          nome: `Almoxarifado — ${obra.nome}`,
          codigo: obraId,
        },
      });
    } catch {
      const deNovo = await this.prisma.localEstoque.findFirst({
        where: { empresaId, codigo: obraId },
      });
      if (deNovo) return deNovo;
      throw new BadRequestException('Não foi possível abrir o almoxarifado.');
    }
  }

  private async obterLocal(empresaId: string, localId: string): Promise<LocalRow> {
    const local = await this.prisma.localEstoque.findFirst({
      where: { id: localId, empresaId, ativo: true },
    });
    if (!local) throw new NotFoundException('Local de estoque não encontrado.');
    return local;
  }

  private async assertObra(empresaId: string, userId: string, obraId: string) {
    const obra = await this.prisma.obra.findFirst({
      where: { id: obraId, empresaId, deletedAt: null },
      select: { id: true },
    });
    if (!obra) throw new NotFoundException('Obra não encontrada.');
    const usuario = await this.prisma.usuario.findFirst({
      where: { id: userId, empresaId, deletedAt: null },
      select: { perfilGlobal: true, capabilities: true },
    });
    if (!usuario) throw new ForbiddenException('Usuário não encontrado.');
    const caps = await this.capabilities.resolveForUser({
      empresaId,
      perfilGlobal: usuario.perfilGlobal,
      capabilitiesOverride: usuario.capabilities,
    });
    if (usuario.perfilGlobal === 'SUPER_ADMIN' || caps.acessoTodasObras) return;
    const role = await this.prisma.userObraRole.findUnique({
      where: { usuarioId_obraId: { usuarioId: userId, obraId } },
    });
    if (!role) throw new ForbiddenException('Você não tem acesso a esta obra.');
  }

  private async assertPodeLocal(
    empresaId: string,
    userId: string,
    local: LocalRow,
    escrita: boolean,
  ) {
    if (local.tipo === 'DEPOSITO_CENTRAL' || !local.obraId) return;
    await this.assertObra(empresaId, userId, local.obraId);
    if (!escrita) return;
    const usuario = await this.prisma.usuario.findFirst({
      where: { id: userId, empresaId, deletedAt: null },
      select: { perfilGlobal: true, capabilities: true },
    });
    if (!usuario) throw new ForbiddenException('Usuário não encontrado.');
    const caps = await this.capabilities.resolveForUser({
      empresaId,
      perfilGlobal: usuario.perfilGlobal,
      capabilitiesOverride: usuario.capabilities,
    });
    if (usuario.perfilGlobal === 'SUPER_ADMIN' || caps.acessoTodasObras) return;
    const role = await this.prisma.userObraRole.findUnique({
      where: { usuarioId_obraId: { usuarioId: userId, obraId: local.obraId } },
    });
    const perms = mergePermissoesObra(
      ((role?.permissoes || {}) as Record<string, string>) || {},
      caps,
    );
    const nivel = perms.MATERIAIS;
    if (nivel === 'VIEW' || nivel === 'VIEW_APPROVED') {
      throw new ForbiddenException('Você só pode consultar o estoque desta obra.');
    }
  }

  private async assertRecebedorOuGestor(empresaId: string, userId: string, recebedorId: string) {
    if (userId === recebedorId) return;
    const usuario = await this.prisma.usuario.findFirst({
      where: { id: userId, empresaId, deletedAt: null },
      select: { perfilGlobal: true, capabilities: true },
    });
    if (!usuario) throw new ForbiddenException('Usuário não encontrado.');
    if (usuario.perfilGlobal === 'GESTOR' || usuario.perfilGlobal === 'SUPER_ADMIN') return;
    const caps = await this.capabilities.resolveForUser({
      empresaId,
      perfilGlobal: usuario.perfilGlobal,
      capabilitiesOverride: usuario.capabilities,
    });
    if (caps.acessoTodasObras) return;
    throw new ForbiddenException('Só quem está recebendo pode confirmar esta entrada.');
  }

  private async bufferDaImagem(url: string) {
    if (url.startsWith('/uploads/')) {
      const nome = path.basename(url);
      const arquivo = path.join(process.cwd(), 'uploads', nome);
      if (!fs.existsSync(arquivo)) {
        throw new NotFoundException('O arquivo não está mais no servidor.');
      }
      return fs.readFileSync(arquivo);
    }
    if (!/^https?:\/\//i.test(url)) {
      throw new BadRequestException('Não consegui abrir o arquivo da nota.');
    }
    const res = await fetch(url);
    if (!res.ok) throw new BadRequestException('Não consegui baixar o arquivo da nota.');
    return Buffer.from(await res.arrayBuffer());
  }

  private async resolverRecebedor(empresaId: string, recebedorId: string | undefined, userId: string) {
    const id = recebedorId || userId;
    const usuario = await this.prisma.usuario.findFirst({
      where: { id, empresaId, deletedAt: null, ativo: true },
      select: { id: true },
    });
    if (!usuario) throw new BadRequestException('Recebedor não encontrado nesta empresa.');
    return usuario.id;
  }

  private async documentoAberto(empresaId: string, userId: string, documentoId: string) {
    const doc = await this.prisma.documentoEntrada.findFirst({
      where: { id: documentoId, empresaId },
    });
    if (!doc) throw new NotFoundException('Documento não encontrado.');
    if (doc.status !== 'EM_CONFERENCIA') {
      throw new BadRequestException('Este documento não está em conferência.');
    }
    const local = await this.obterLocal(empresaId, doc.localId);
    await this.assertPodeLocal(empresaId, userId, local, true);
    const usuario = await this.prisma.usuario.findFirst({
      where: { id: userId, empresaId, deletedAt: null },
      select: { perfilGlobal: true, capabilities: true },
    });
    const gestor =
      usuario?.perfilGlobal === 'GESTOR' || usuario?.perfilGlobal === 'SUPER_ADMIN';
    if (!gestor && userId !== doc.recebedorId && userId !== doc.criadorId) {
      throw new ForbiddenException('Só o recebedor pode alterar esta conferência.');
    }
    return doc;
  }
}
