import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { perfilGlobalToObraNomeInterno } from '../../core/capabilities/obra-perfil';

@Injectable()
export class ObraService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  /** Garante um registro em `perfis` pelo nomeInterno (cria se não existir). */
  private async ensurePerfil(nomeInterno: string) {
    let perfil = await this.prisma.perfil.findUnique({
      where: { nomeInterno },
    });
    if (perfil) return perfil;
    try {
      return await this.prisma.perfil.create({ data: { nomeInterno } });
    } catch {
      await this.prisma.$executeRawUnsafe(
        `SELECT setval('perfis_id_seq', COALESCE((SELECT MAX(id)+1 FROM perfis), 1), false);`,
      );
      return this.prisma.perfil.create({ data: { nomeInterno } });
    }
  }

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
    const empresa = await this.prisma.empresa.findUnique({
      where: { id: empresaId },
      select: { limiteObras: true },
    });
    if (!empresa) {
      throw new BadRequestException('Empresa não encontrada.');
    }

    // null = ilimitado; senão conta obras não excluídas
    if (empresa.limiteObras != null) {
      const totalObras = await this.prisma.obra.count({
        where: { empresaId, deletedAt: null },
      });
      if (totalObras >= empresa.limiteObras) {
        throw new BadRequestException(
          `Limite do pacote atingido (${empresa.limiteObras} obra${empresa.limiteObras === 1 ? '' : 's'}). Faça upgrade do plano para cadastrar mais obras.`,
        );
      }
    }

    // 1. Garante que o perfil ENGENHEIRO existe (FORA da transação para não abortar em caso de erro de constraint)
    const perfil = await this.ensurePerfil('ENGENHEIRO');

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

  async excluirObra(id: string, empresaId: string, userId: string) {
    // Soft delete
    if (!id) throw new Error('ID não fornecido');
    const obra = await this.prisma.obra.findFirst({ where: { id, empresaId } });
    if (!obra)
      throw new Error('Obra não encontrada ou não pertence a esta empresa.');

    const user = await this.prisma.usuario.findUnique({
      where: { id: userId },
    });

    const deletedObra = await this.prisma.obra.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'EXCLUIDA' },
    });

    if (user) {
      try {
        await this.emailService.enviarConfirmacaoExcluirObra(
          user.email,
          user.nome,
          obra.nome,
        );
      } catch (err) {
        console.error('Erro ao enviar e-mail de confirmação de exclusão:', err);
      }
    }

    return deletedObra;
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

    // Alinha o perfil da obra com o tipo do cadastro (UI nunca permite escolher outro).
    for (const role of roles) {
      const expected = perfilGlobalToObraNomeInterno(role.usuario.perfilGlobal);
      if (role.perfil.nomeInterno === expected) continue;
      const perfil = await this.ensurePerfil(expected);
      if (perfil.id === role.perfilId) continue;
      await this.prisma.userObraRole.update({
        where: { id: role.id },
        data: { perfilId: perfil.id },
      });
      role.perfilId = perfil.id;
      role.perfil = perfil;
    }

    return roles;
  }

  async adicionarColaborador(
    obraId: string,
    empresaId: string,
    data: { usuarioId: string; perfilId?: number; permissoes?: any },
  ) {
    const obra = await this.prisma.obra.findFirst({
      where: { id: obraId, empresaId },
      include: {
        empresa: {
          select: { razaoSocial: true, nomeFantasia: true, nomeCompleto: true },
        },
      },
    });
    if (!obra) throw new Error('Obra não encontrada');

    const usuario = await this.prisma.usuario.findFirst({
      where: { id: data.usuarioId, empresaId, deletedAt: null },
      select: { nome: true, email: true, perfilGlobal: true },
    });
    if (!usuario) {
      throw new BadRequestException(
        'Usuário não encontrado nesta empresa.',
      );
    }

    let finalPerfilId = data.perfilId;
    if (!finalPerfilId) {
      const nomeInterno = perfilGlobalToObraNomeInterno(usuario.perfilGlobal);
      const perfilPadrao = await this.ensurePerfil(nomeInterno);
      finalPerfilId = perfilPadrao.id;
    }

    const role = await this.prisma.userObraRole.upsert({
      where: { usuarioId_obraId: { usuarioId: data.usuarioId, obraId } },
      update: { perfilId: finalPerfilId, permissoes: data.permissoes || {} },
      create: {
        obraId,
        usuarioId: data.usuarioId,
        perfilId: finalPerfilId,
        permissoes: data.permissoes || {},
      },
    });

    try {
      if (usuario.email) {
        const nomeEmpresa =
          obra.empresa.nomeFantasia ||
          obra.empresa.razaoSocial ||
          obra.empresa.nomeCompleto ||
          'sua empresa';
        await this.emailService.enviarVinculoObra({
          email: usuario.email,
          nomeUsuario: usuario.nome,
          nomeEmpresa,
          nomeObra: obra.nome,
        });
      }
    } catch {
      // não bloqueia o vínculo se o e-mail falhar
    }

    return role;
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

  async getDashboardPainel(obraId: string, empresaId: string) {
    const obra = await this.prisma.obra.findFirst({
      where: { id: obraId, empresaId, deletedAt: null },
    });
    if (!obra) {
      throw new Error('Obra não encontrada ou sem acesso.');
    }

    // 1. RDOs Pendentes (SUBMETIDO)
    const rdosPendentes = await this.prisma.rdo.count({
      where: { obraId, status: 'SUBMETIDO', deletedAt: null },
    });

    // 2. Últimos RDOs para efetivo e atividade recente
    const latestRdos = await this.prisma.rdo.findMany({
      where: { obraId, deletedAt: null },
      orderBy: { dataReferencia: 'desc' },
      take: 5,
      include: {
        efetivos: {
          where: { deletedAt: null },
        },
        atividades: {
          where: { deletedAt: null },
        },
      },
    });

    // Efetivo Hoje: soma das quantidades do RDO mais recente
    let efetivoHoje = 0;
    if (latestRdos.length > 0) {
      const latestRdo = latestRdos[0];
      const d = (latestRdo.dadosExtras as any) || {};
      const profissionais = d.profissionais || [];
      if (Array.isArray(profissionais) && profissionais.length > 0) {
        efetivoHoje = profissionais.reduce(
          (sum: number, p: any) => sum + Number(p.quantidade || 0),
          0,
        );
      } else {
        efetivoHoje = latestRdo.efetivos.reduce(
          (sum, item) => sum + (item.quantidade || 0),
          0,
        );
      }
    }

    // Atividades Recentes: mapear últimos 5 RDOs
    const atividadesRecentes = latestRdos.map((rdo) => {
      const d = (rdo.dadosExtras as any) || {};
      const atividades = d.atividadesExecutadas || [];
      let desc = 'Nenhuma atividade registrada.';
      if (Array.isArray(atividades) && atividades.length > 0) {
        desc = atividades.map((a: any) => a.descricao).join(', ');
      } else if (rdo.atividades.length > 0) {
        desc = rdo.atividades.map((a) => a.descricao).join(', ');
      }
      return {
        id: rdo.id,
        dataReferencia: rdo.dataReferencia,
        status: rdo.status,
        descricao: desc,
      };
    });

    return {
      rdosPendentes,
      efetivoHoje,
      status: obra.status,
      atividadesRecentes,
    };
  }
}
