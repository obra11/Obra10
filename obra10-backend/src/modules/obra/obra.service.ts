import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ObraService {
  constructor(private readonly prisma: PrismaService) {}

  async listarObrasDoUsuario(usuarioId: string) {
    // Busca as obras ATIVAS nas quais o usuário tem um perfil
    const obras = await this.prisma.obra.findMany({
      where: {
        deletedAt: null,
        status: { not: 'INATIVA' },
        userObraRole: {
          some: { usuarioId },
        },
      },
      orderBy: { createdAt: 'asc' },
      include: {
        userObraRole: {
          where: { usuarioId },
          include: { perfil: true },
        },
      },
    });

    // Retorna no formato legado que o AuthContext mapeia perfeitamente:
    return obras.map((obra) => {
      const role = obra.userObraRole[0];
      return {
        id: role.id,
        usuarioId: role.usuarioId,
        obraId: role.obraId,
        perfilId: role.perfilId,
        perfil: role.perfil,
        obra: {
          id: obra.id,
          empresaId: obra.empresaId,
          nome: obra.nome,
          endereco: obra.endereco,
          status: obra.status,
          imageUrl: obra.imageUrl,
          createdAt: obra.createdAt,
        },
      };
    });
  }

  async criarObra(
    empresaId: string,
    usuarioId: string,
    data: { nome: string; endereco?: string },
  ) {
    // 1. Garante que o perfil ENGENHEIRO existe (FORA da transação para não abortar em caso de erro de constraint)
    let perfil = await this.prisma.perfil.findUnique({
      where: { nomeInterno: 'ENGENHEIRO' },
    });
    if (!perfil) {
      try {
        perfil = await this.prisma.perfil.create({
          data: { nomeInterno: 'ENGENHEIRO' },
        });
      } catch (e: any) {
        // Se der erro de constraint única no ID (sequence desincronizada pelo seed manual), corrige a sequence e tenta de novo
        await this.prisma.$executeRawUnsafe(
          `SELECT setval('perfis_id_seq', COALESCE((SELECT MAX(id)+1 FROM perfis), 1), false);`,
        );
        perfil = await this.prisma.perfil.create({
          data: { nomeInterno: 'ENGENHEIRO' },
        });
      }
    }

    // 2. Cria a obra e vincula o usuário na transação principal
    return this.prisma.$transaction(async (tx) => {
      const obra = await tx.obra.create({
        data: {
          empresaId,
          nome: data.nome,
          endereco: data.endereco,
          status: 'ATIVA',
        },
      });

      await tx.userObraRole.create({
        data: {
          usuarioId,
          obraId: obra.id,
          perfilId: perfil.id, // perfil já está garantido aqui
        },
      });

      return obra;
    });
  }

  async excluirObra(id: string, empresaId: string) {
    // Soft delete
    if (!id) throw new Error('ID não fornecido');
    const obra = await this.prisma.obra.findFirst({ where: { id, empresaId } });
    if (!obra)
      throw new Error('Obra não encontrada ou não pertence a esta empresa.');

    return this.prisma.obra.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'EXCLUIDA' },
    });
  }

  async editarObra(
    id: string,
    empresaId: string,
    data: { nome?: string; endereco?: string; status?: string },
  ) {
    if (!id) throw new Error('ID não fornecido');
    const obra = await this.prisma.obra.findFirst({ where: { id, empresaId } });
    if (!obra)
      throw new Error('Obra não encontrada ou não pertence a esta empresa.');

    return this.prisma.obra.update({
      where: { id },
      data: {
        ...(data.nome && { nome: data.nome }),
        ...(data.endereco !== undefined && { endereco: data.endereco }),
        ...(data.status && { status: data.status }),
      },
    });
  }

  // ==================== COLABORADORES DA OBRA (EFETIVO) ====================
  async listarColaboradores(obraId: string, empresaId: string) {
    const obra = await this.prisma.obra.findFirst({
      where: { id: obraId, empresaId },
    });
    if (!obra) throw new Error('Obra não encontrada'); // or NotFoundException

    const roles = await this.prisma.userObraRole.findMany({
      where: { obraId },
      include: {
        usuario: {
          select: {
            id: true,
            nome: true,
            email: true,
            perfilGlobal: true,
          },
        },
        perfil: true,
      },
    });

    return roles;
  }

  async adicionarColaborador(
    obraId: string,
    empresaId: string,
    data: { usuarioId: string; perfilId?: number; permissoes?: any },
  ) {
    const obra = await this.prisma.obra.findFirst({
      where: { id: obraId, empresaId },
    });
    if (!obra) throw new Error('Obra não encontrada');

    let finalPerfilId = data.perfilId;
    if (!finalPerfilId) {
      let perfilPadrao = await this.prisma.perfil.findFirst({
        where: { nomeInterno: 'COLABORADOR' },
      });
      if (!perfilPadrao) {
        try {
          perfilPadrao = await this.prisma.perfil.create({
            data: { nomeInterno: 'COLABORADOR' },
          });
        } catch (e) {
          await this.prisma.$executeRawUnsafe(
            `SELECT setval('perfis_id_seq', COALESCE((SELECT MAX(id)+1 FROM perfis), 1), false);`,
          );
          perfilPadrao = await this.prisma.perfil.create({
            data: { nomeInterno: 'COLABORADOR' },
          });
        }
      }
      finalPerfilId = perfilPadrao.id;
    }

    return this.prisma.userObraRole.upsert({
      where: { usuarioId_obraId: { usuarioId: data.usuarioId, obraId } },
      update: { perfilId: finalPerfilId, permissoes: data.permissoes || {} },
      create: {
        obraId,
        usuarioId: data.usuarioId,
        perfilId: finalPerfilId,
        permissoes: data.permissoes || {},
      },
    });
  }

  async editarColaborador(
    obraId: string,
    empresaId: string,
    usuarioId: string,
    data: { perfilId?: number; permissoes?: any },
  ) {
    const role = await this.prisma.userObraRole.findFirst({
      where: { obraId, usuarioId, obra: { empresaId } },
    });
    if (!role) throw new Error('Vínculo não encontrado');

    return this.prisma.userObraRole.update({
      where: { id: role.id },
      data: {
        ...(data.perfilId && { perfilId: data.perfilId }),
        ...(data.permissoes !== undefined && { permissoes: data.permissoes }),
      },
    });
  }

  async removerColaborador(
    obraId: string,
    empresaId: string,
    usuarioId: string,
  ) {
    const role = await this.prisma.userObraRole.findFirst({
      where: { obraId, usuarioId, obra: { empresaId } },
    });
    if (!role) throw new Error('Vínculo não encontrado');

    return this.prisma.userObraRole.delete({ where: { id: role.id } });
  }
}
