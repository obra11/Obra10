import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateChamadoDto,
  CreateMensagemChamadoDto,
  UpdateChamadoDto,
} from './dto/chamado.dto';
import { AutorMensagemSuporte, PerfilGlobal, Prisma } from '@prisma/client';

const CHAMADO_INCLUDE = {
  usuario: { select: { id: true, nome: true, email: true } },
  empresa: {
    select: { id: true, razaoSocial: true, nomeFantasia: true },
  },
  mensagens: {
    orderBy: { createdAt: 'asc' as const },
    include: {
      autor: { select: { id: true, nome: true, email: true } },
    },
  },
  _count: { select: { mensagens: true } },
};

@Injectable()
export class SuporteService {
  constructor(private readonly prisma: PrismaService) {}

  async criar(
    empresaId: string,
    usuarioId: string,
    dto: CreateChamadoDto,
  ) {
    return this.prisma.chamadoSuporte.create({
      data: {
        empresaId,
        usuarioId,
        assunto: dto.assunto.trim(),
        categoria: dto.categoria,
        descricao: dto.descricao.trim(),
        whatsappEnviadoEm: dto.marcarWhatsapp ? new Date() : null,
        mensagens: {
          create: {
            autorId: usuarioId,
            autorTipo: AutorMensagemSuporte.USUARIO,
            corpo: dto.descricao.trim(),
          },
        },
      },
      include: CHAMADO_INCLUDE,
    });
  }

  async listar(
    empresaId: string,
    usuarioId: string,
    perfilGlobal: string,
  ) {
    const where: Prisma.ChamadoSuporteWhereInput =
      perfilGlobal === PerfilGlobal.SUPER_ADMIN
        ? {}
        : perfilGlobal === PerfilGlobal.GESTOR
          ? { empresaId }
          : { empresaId, usuarioId };

    return this.prisma.chamadoSuporte.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        usuario: { select: { id: true, nome: true, email: true } },
        empresa: {
          select: { id: true, razaoSocial: true, nomeFantasia: true },
        },
        _count: { select: { mensagens: true } },
        mensagens: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            corpo: true,
            autorTipo: true,
            createdAt: true,
          },
        },
      },
    });
  }

  async detalhe(
    id: string,
    empresaId: string,
    usuarioId: string,
    perfilGlobal: string,
  ) {
    const chamado = await this.prisma.chamadoSuporte.findUnique({
      where: { id },
      include: CHAMADO_INCLUDE,
    });
    if (!chamado) throw new NotFoundException('Chamado não encontrado.');
    this.assertAcesso(chamado, empresaId, usuarioId, perfilGlobal);
    return chamado;
  }

  async atualizar(
    id: string,
    empresaId: string,
    usuarioId: string,
    perfilGlobal: string,
    dto: UpdateChamadoDto,
  ) {
    const chamado = await this.detalhe(id, empresaId, usuarioId, perfilGlobal);

    const isAdmin = perfilGlobal === PerfilGlobal.SUPER_ADMIN;
    const isGestor =
      perfilGlobal === PerfilGlobal.GESTOR && chamado.empresaId === empresaId;
    const isDono = chamado.usuarioId === usuarioId;

    if (dto.status && !(isAdmin || isGestor)) {
      throw new ForbiddenException(
        'Apenas gestor ou administrador pode alterar o status.',
      );
    }

    if (dto.descricao && !(isDono || isAdmin || isGestor)) {
      throw new ForbiddenException('Sem permissão para editar este chamado.');
    }

    return this.prisma.chamadoSuporte.update({
      where: { id },
      data: {
        ...(dto.descricao ? { descricao: dto.descricao.trim() } : {}),
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.marcarWhatsapp ? { whatsappEnviadoEm: new Date() } : {}),
      },
      include: CHAMADO_INCLUDE,
    });
  }

  async adicionarMensagem(
    id: string,
    empresaId: string,
    usuarioId: string,
    perfilGlobal: string,
    dto: CreateMensagemChamadoDto,
  ) {
    const chamado = await this.detalhe(id, empresaId, usuarioId, perfilGlobal);
    const isAdmin = perfilGlobal === PerfilGlobal.SUPER_ADMIN;
    const isGestor =
      perfilGlobal === PerfilGlobal.GESTOR && chamado.empresaId === empresaId;
    const isDono = chamado.usuarioId === usuarioId;

    if (!(isAdmin || isGestor || isDono)) {
      throw new ForbiddenException('Sem permissão para responder este chamado.');
    }

    if (chamado.status === 'FECHADO' || chamado.status === 'RESOLVIDO') {
      if (!(isAdmin || isGestor)) {
        throw new ForbiddenException(
          'Chamado encerrado. Abra um novo chamado se precisar de ajuda.',
        );
      }
    }

    const autorTipo = isAdmin || isGestor
      ? AutorMensagemSuporte.SUPORTE
      : AutorMensagemSuporte.USUARIO;

    let nextStatus = chamado.status;
    if (autorTipo === AutorMensagemSuporte.SUPORTE) {
      if (chamado.status === 'ABERTO' || chamado.status === 'EM_ANDAMENTO') {
        nextStatus = 'AGUARDANDO_USUARIO';
      } else if (chamado.status === 'RESOLVIDO' || chamado.status === 'FECHADO') {
        nextStatus = 'EM_ANDAMENTO';
      }
    } else if (autorTipo === AutorMensagemSuporte.USUARIO) {
      if (
        chamado.status === 'AGUARDANDO_USUARIO' ||
        chamado.status === 'ABERTO'
      ) {
        nextStatus = 'EM_ANDAMENTO';
      }
    }

    await this.prisma.mensagemChamadoSuporte.create({
      data: {
        chamadoId: id,
        autorId: usuarioId,
        autorTipo,
        corpo: dto.corpo.trim(),
      },
    });

    return this.prisma.chamadoSuporte.update({
      where: { id },
      data: { status: nextStatus },
      include: CHAMADO_INCLUDE,
    });
  }

  /** Lista global para Super Admin. */
  async listarAdmin(status?: string) {
    return this.prisma.chamadoSuporte.findMany({
      where: status
        ? { status: status as Prisma.EnumStatusChamadoSuporteFilter }
        : undefined,
      orderBy: { updatedAt: 'desc' },
      include: {
        usuario: { select: { id: true, nome: true, email: true } },
        empresa: {
          select: { id: true, razaoSocial: true, nomeFantasia: true },
        },
        _count: { select: { mensagens: true } },
        mensagens: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            corpo: true,
            autorTipo: true,
            createdAt: true,
          },
        },
      },
    });
  }

  private assertAcesso(
    chamado: { empresaId: string; usuarioId: string },
    empresaId: string,
    usuarioId: string,
    perfilGlobal: string,
  ) {
    if (perfilGlobal === PerfilGlobal.SUPER_ADMIN) return;
    if (chamado.empresaId !== empresaId) {
      throw new ForbiddenException('Chamado de outra empresa.');
    }
    if (
      perfilGlobal !== PerfilGlobal.GESTOR &&
      chamado.usuarioId !== usuarioId
    ) {
      throw new ForbiddenException('Chamado de outro usuário.');
    }
  }
}
