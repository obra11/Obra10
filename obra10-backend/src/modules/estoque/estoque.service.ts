import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  TipoEstoqueItem,
  TipoMovimentoEstoque,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { proximoSaldo } from './estoque-saldo';
import {
  CreateEpiEntregaDto,
  CreateEstoqueItemDto,
  MovimentarEstoqueDto,
  UpdateEstoqueItemDto,
} from './dto/estoque.dto';

const EPI_PADRAO = [
  { nome: 'Capacete de segurança', unidade: 'un', caNumero: '' },
  { nome: 'Óculos de proteção', unidade: 'un', caNumero: '' },
  { nome: 'Protetor auricular', unidade: 'par', caNumero: '' },
  { nome: 'Luva de proteção', unidade: 'par', caNumero: '' },
  { nome: 'Bota de segurança', unidade: 'par', caNumero: '' },
  { nome: 'Colete refletivo', unidade: 'un', caNumero: '' },
  { nome: 'Cinturão / talabarte', unidade: 'un', caNumero: '' },
  { nome: 'Máscara PFF2', unidade: 'un', caNumero: '' },
];

function n(v: any): number {
  return Number(v || 0);
}

@Injectable()
export class EstoqueService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertObra(empresaId: string, obraId: string) {
    const obra = await this.prisma.obra.findFirst({
      where: { id: obraId, empresaId, deletedAt: null },
      select: { id: true },
    });
    if (!obra) throw new NotFoundException('Obra não encontrada.');
  }

  async listarItens(
    empresaId: string,
    obraId: string,
    tipo?: TipoEstoqueItem,
  ) {
    await this.assertObra(empresaId, obraId);
    await this.garantirEpiPadrao(empresaId, obraId);

    return this.prisma.estoqueItem.findMany({
      where: {
        empresaId,
        obraId,
        ativo: true,
        ...(tipo ? { tipo } : {}),
      },
      orderBy: [{ tipo: 'asc' }, { nome: 'asc' }],
    });
  }

  private async garantirEpiPadrao(empresaId: string, obraId: string) {
    const count = await this.prisma.estoqueItem.count({
      where: { empresaId, obraId, tipo: TipoEstoqueItem.EPI },
    });
    if (count > 0) return;
    await this.prisma.estoqueItem.createMany({
      data: EPI_PADRAO.map((item) => ({
        empresaId,
        obraId,
        tipo: TipoEstoqueItem.EPI,
        nome: item.nome,
        unidade: item.unidade,
        caNumero: item.caNumero || null,
      })),
    });
  }

  async criarItem(
    empresaId: string,
    obraId: string,
    dto: CreateEstoqueItemDto,
  ) {
    await this.assertObra(empresaId, obraId);
    const nome = dto.nome.trim();
    if (!nome) throw new BadRequestException('Informe o nome do item.');

    return this.prisma.estoqueItem.create({
      data: {
        empresaId,
        obraId,
        tipo: dto.tipo,
        nome,
        unidade: (dto.unidade || 'un').trim() || 'un',
        codigo: dto.codigo?.trim() || null,
        caNumero: dto.caNumero?.trim() || null,
        estoqueMinimo: dto.estoqueMinimo ?? 0,
        catalogoInsumoId: dto.catalogoInsumoId || null,
      },
    });
  }

  async atualizarItem(
    empresaId: string,
    obraId: string,
    itemId: string,
    dto: UpdateEstoqueItemDto,
  ) {
    const item = await this.buscarItem(empresaId, obraId, itemId);
    return this.prisma.estoqueItem.update({
      where: { id: item.id },
      data: {
        ...(dto.nome != null ? { nome: dto.nome.trim() } : {}),
        ...(dto.unidade != null ? { unidade: dto.unidade.trim() || 'un' } : {}),
        ...(dto.codigo !== undefined ? { codigo: dto.codigo?.trim() || null } : {}),
        ...(dto.caNumero !== undefined
          ? { caNumero: dto.caNumero?.trim() || null }
          : {}),
        ...(dto.estoqueMinimo != null ? { estoqueMinimo: dto.estoqueMinimo } : {}),
        ...(dto.ativo != null ? { ativo: dto.ativo } : {}),
      },
    });
  }

  async movimentar(
    empresaId: string,
    obraId: string,
    itemId: string,
    usuarioId: string,
    dto: MovimentarEstoqueDto,
  ) {
    if (dto.tipo === TipoMovimentoEstoque.ENTREGA_EPI) {
      throw new BadRequestException(
        'Baixa por entrega de EPI é feita na ficha de entrega.',
      );
    }
    if (dto.tipo !== TipoMovimentoEstoque.AJUSTE && !(dto.quantidade > 0)) {
      throw new BadRequestException('Informe uma quantidade maior que zero.');
    }

    return this.prisma.$transaction(async (tx) => {
      const item = await tx.estoqueItem.findFirst({
        where: { id: itemId, empresaId, obraId, ativo: true },
      });
      if (!item) throw new NotFoundException('Item de estoque não encontrado.');

      const saldoAtual = n(item.saldo);
      const saldoApos = proximoSaldo(saldoAtual, dto.tipo, dto.quantidade);
      if (saldoApos < 0) {
        throw new BadRequestException(
          `Saldo insuficiente. Disponível: ${saldoAtual} ${item.unidade}.`,
        );
      }

      const movimento = await tx.estoqueMovimento.create({
        data: {
          empresaId,
          obraId,
          itemId: item.id,
          tipo: dto.tipo,
          quantidade:
            dto.tipo === TipoMovimentoEstoque.AJUSTE
              ? dto.quantidade
              : Math.abs(dto.quantidade),
          saldoApos,
          data: dto.data ? new Date(dto.data) : new Date(),
          observacao: dto.observacao?.trim() || null,
          usuarioId,
        },
      });

      await tx.estoqueItem.update({
        where: { id: item.id },
        data: { saldo: saldoApos },
      });

      return { ...movimento, item: { ...item, saldo: saldoApos } };
    });
  }

  async listarMovimentos(
    empresaId: string,
    obraId: string,
    itemId: string,
  ) {
    await this.buscarItem(empresaId, obraId, itemId);
    return this.prisma.estoqueMovimento.findMany({
      where: { empresaId, obraId, itemId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { usuario: { select: { id: true, nome: true } } },
    });
  }

  async listarEntregas(empresaId: string, obraId: string) {
    await this.assertObra(empresaId, obraId);
    return this.prisma.epiEntrega.findMany({
      where: { empresaId, obraId },
      orderBy: { data: 'desc' },
      include: {
        itens: true,
        criadoPor: { select: { id: true, nome: true } },
      },
      take: 200,
    });
  }

  async obterEntrega(empresaId: string, obraId: string, id: string) {
    const entrega = await this.prisma.epiEntrega.findFirst({
      where: { id, empresaId, obraId },
      include: {
        itens: true,
        criadoPor: { select: { id: true, nome: true } },
      },
    });
    if (!entrega) throw new NotFoundException('Entrega de EPI não encontrada.');
    return entrega;
  }

  async criarEntrega(
    empresaId: string,
    obraId: string,
    usuarioId: string,
    dto: CreateEpiEntregaDto,
  ) {
    await this.assertObra(empresaId, obraId);
    const nome = dto.colaboradorNome.trim();
    if (!nome) throw new BadRequestException('Informe o nome de quem recebeu o EPI.');
    if (!dto.itens?.length) {
      throw new BadRequestException('Inclua pelo menos um EPI na entrega.');
    }

    return this.prisma.$transaction(async (tx) => {
      const entrega = await tx.epiEntrega.create({
        data: {
          empresaId,
          obraId,
          data: new Date(dto.data),
          colaboradorNome: nome,
          colaboradorCpf: dto.colaboradorCpf?.trim() || null,
          colaboradorFuncao: dto.colaboradorFuncao?.trim() || null,
          colaboradorUsuarioId: dto.colaboradorUsuarioId || null,
          observacao: dto.observacao?.trim() || null,
          criadoPorId: usuarioId,
        },
      });

      for (const linha of dto.itens) {
        const qtd = Math.abs(n(linha.quantidade));
        if (!(qtd > 0)) {
          throw new BadRequestException(`Quantidade inválida em "${linha.nome}".`);
        }

        let item = linha.itemId
          ? await tx.estoqueItem.findFirst({
              where: { id: linha.itemId, empresaId, obraId, ativo: true },
            })
          : null;

        if (!item && linha.nome.trim()) {
          item = await tx.estoqueItem.findFirst({
            where: {
              empresaId,
              obraId,
              ativo: true,
              tipo: TipoEstoqueItem.EPI,
              nome: { equals: linha.nome.trim(), mode: 'insensitive' },
            },
          });
        }

        if (item) {
          const saldoApos = proximoSaldo(
            n(item.saldo),
            TipoMovimentoEstoque.ENTREGA_EPI,
            qtd,
          );
          if (saldoApos < 0) {
            throw new BadRequestException(
              `Saldo insuficiente de ${item.nome}. Disponível: ${n(item.saldo)} ${item.unidade}.`,
            );
          }
          await tx.estoqueMovimento.create({
            data: {
              empresaId,
              obraId,
              itemId: item.id,
              tipo: TipoMovimentoEstoque.ENTREGA_EPI,
              quantidade: qtd,
              saldoApos,
              data: new Date(dto.data),
              observacao: `Entrega a ${nome}`,
              usuarioId,
              entregaId: entrega.id,
            },
          });
          await tx.estoqueItem.update({
            where: { id: item.id },
            data: { saldo: saldoApos },
          });
        }

        await tx.epiEntregaItem.create({
          data: {
            empresaId,
            entregaId: entrega.id,
            itemId: item?.id || null,
            nome: (linha.nome || item?.nome || '').trim(),
            unidade: linha.unidade || item?.unidade || 'un',
            quantidade: qtd,
            caNumero: linha.caNumero?.trim() || item?.caNumero || null,
          },
        });
      }

      return tx.epiEntrega.findFirst({
        where: { id: entrega.id, empresaId },
        include: {
          itens: true,
          criadoPor: { select: { id: true, nome: true } },
        },
      });
    });
  }

  private async buscarItem(empresaId: string, obraId: string, itemId: string) {
    const item = await this.prisma.estoqueItem.findFirst({
      where: { id: itemId, empresaId, obraId },
    });
    if (!item) throw new NotFoundException('Item de estoque não encontrado.');
    return item;
  }
}
