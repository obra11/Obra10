import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateChamadoDto, UpdateChamadoDto } from './dto/chamado.dto';
import { PerfilGlobal, Prisma } from '@prisma/client';

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
      },
      include: {
        usuario: { select: { id: true, nome: true, email: true } },
        empresa: { select: { id: true, razaoSocial: true, nomeFantasia: true } },
      },
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
      orderBy: { createdAt: 'desc' },
      include: {
        usuario: { select: { id: true, nome: true, email: true } },
        empresa: {
          select: { id: true, razaoSocial: true, nomeFantasia: true },
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
      include: {
        usuario: { select: { id: true, nome: true, email: true } },
        empresa: {
          select: { id: true, razaoSocial: true, nomeFantasia: true },
        },
      },
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
      include: {
        usuario: { select: { id: true, nome: true, email: true } },
        empresa: {
          select: { id: true, razaoSocial: true, nomeFantasia: true },
        },
      },
    });
  }

  /** Lista global para Super Admin. */
  async listarAdmin(status?: string) {
    return this.prisma.chamadoSuporte.findMany({
      where: status
        ? { status: status as Prisma.EnumStatusChamadoSuporteFilter }
        : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        usuario: { select: { id: true, nome: true, email: true } },
        empresa: {
          select: { id: true, razaoSocial: true, nomeFantasia: true },
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
