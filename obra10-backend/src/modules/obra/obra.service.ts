import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { perfilGlobalToObraNomeInterno } from '../../core/capabilities/obra-perfil';
import { CapabilitiesService } from '../../core/capabilities/capabilities.service';
import { mergePermissoesObra, podeReceberAprovacao } from '../../core/capabilities/role-capabilities';

type AtividadePendentePainel = {
  descricao: string;
  responsavel: string;
  empresa: string;
  status: 'pendente' | 'finalizada';
};

function textoLimpo(valor: unknown): string {
  return String(valor || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function statusPendencia(raw: unknown): 'pendente' | 'finalizada' {
  const valor = String(raw || '').toLowerCase();
  if (valor === 'finalizada' || valor === 'executada' || valor === 'concluida' || valor === 'concluída') {
    return 'finalizada';
  }
  return 'pendente';
}

function parseAtividadesPendentesPainel(raw: unknown): AtividadePendentePainel[] {
  const montar = (item: any): AtividadePendentePainel =>
    typeof item === 'string'
      ? { descricao: textoLimpo(item), responsavel: '', empresa: '', status: 'pendente' }
      : {
          descricao: textoLimpo(item?.descricao),
          responsavel: textoLimpo(item?.responsavel),
          empresa: textoLimpo(item?.empresa),
          status: statusPendencia(item?.status),
        };
  if (typeof raw === 'string') {
    return raw
      .split(/\r?\n/)
      .map((line) => textoLimpo(line).replace(/^[-*•\d.]+\s*/, '').trim())
      .filter(Boolean)
      .map((descricao) => montar(descricao));
  }
  if (!Array.isArray(raw)) return [];
  return raw.map(montar).filter((item) => item.descricao && item.status !== 'finalizada');
}

/** Null quando o diário não tem o campo. Lista vazia quando o campo existe e não há pendência. */
function pendenciasDoDiario(dadosExtras: unknown): AtividadePendentePainel[] | null {
  if (!dadosExtras || typeof dadosExtras !== 'object') return null;
  if (!Object.prototype.hasOwnProperty.call(dadosExtras, 'atividadesPendentes')) {
    return null;
  }
  return parseAtividadesPendentesPainel(
    (dadosExtras as { atividadesPendentes?: unknown }).atividadesPendentes,
  );
}

function agruparPorResponsavel(itens: AtividadePendentePainel[]) {
  const ordem: string[] = [];
  const mapa = new Map<string, { responsavel: string; empresa: string; itens: string[] }>();
  for (const item of itens) {
    const responsavel = item.responsavel || 'Sem responsável';
    const empresa = item.empresa || '';
    const chave = `${responsavel}\n${empresa}`;
    const grupo = mapa.get(chave);
    if (!grupo) {
      mapa.set(chave, { responsavel, empresa, itens: [item.descricao] });
      ordem.push(chave);
      continue;
    }
    grupo.itens.push(item.descricao);
  }
  return ordem.map((chave) => mapa.get(chave)!);
}

@Injectable()
export class ObraService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly capabilities: CapabilitiesService,
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
            capabilities: true,
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

    const result: any[] = [];
    for (const role of roles) {
      const caps = await this.capabilities.resolveForUser({
        empresaId,
        perfilGlobal: role.usuario.perfilGlobal,
        capabilitiesOverride: role.usuario.capabilities,
      });
      const { capabilities: _capsJson, ...usuario } = role.usuario as any;
      result.push({
        ...role,
        usuario,
        permissoes: mergePermissoesObra(
          (role.permissoes || {}) as Record<string, string>,
          caps,
        ),
      });
    }
    return result;
  }

  /** Pessoas que podem receber o diário para aprovação nesta obra. */
  async listarAprovadores(obraId: string, empresaId: string) {
    const obra = await this.prisma.obra.findFirst({
      where: { id: obraId, empresaId },
      select: { id: true },
    });
    if (!obra) throw new Error('Obra não encontrada');

    const [usuarios, vinculos] = await Promise.all([
      this.prisma.usuario.findMany({
        where: { empresaId, deletedAt: null },
        select: {
          id: true,
          nome: true,
          email: true,
          perfilGlobal: true,
          capabilities: true,
        },
        orderBy: { nome: 'asc' },
      }),
      this.prisma.userObraRole.findMany({
        where: { obraId },
        select: { usuarioId: true },
      }),
    ]);
    const naObra = new Set(vinculos.map((v) => v.usuarioId));

    const aprovadores: {
      id: string;
      nome: string;
      email: string;
      perfilGlobal: string;
    }[] = [];
    for (const usuario of usuarios) {
      const caps = await this.capabilities.resolveForUser({
        empresaId,
        perfilGlobal: usuario.perfilGlobal,
        capabilitiesOverride: usuario.capabilities,
      });
      if (
        !podeReceberAprovacao({
          perfilGlobal: usuario.perfilGlobal,
          aprovarRdo: caps.aprovarRdo,
          acessoTodasObras: caps.acessoTodasObras,
          vinculadoAObra: naObra.has(usuario.id),
        })
      ) {
        continue;
      }
      aprovadores.push({
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        perfilGlobal: usuario.perfilGlobal,
      });
    }
    return aprovadores;
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
      select: {
        nome: true,
        email: true,
        perfilGlobal: true,
        capabilities: true,
      },
    });
    if (!usuario) {
      throw new BadRequestException(
        'Usuário não encontrado nesta empresa.',
      );
    }

    const caps = await this.capabilities.resolveForUser({
      empresaId,
      perfilGlobal: usuario.perfilGlobal,
      capabilitiesOverride: usuario.capabilities,
    });
    const permissoes = mergePermissoesObra(
      (data.permissoes || {}) as Record<string, string>,
      caps,
    );

    let finalPerfilId = data.perfilId;
    if (!finalPerfilId) {
      const nomeInterno = perfilGlobalToObraNomeInterno(usuario.perfilGlobal);
      const perfilPadrao = await this.ensurePerfil(nomeInterno);
      finalPerfilId = perfilPadrao.id;
    }

    const role = await this.prisma.userObraRole.upsert({
      where: { usuarioId_obraId: { usuarioId: data.usuarioId, obraId } },
      update: { perfilId: finalPerfilId, permissoes },
      create: {
        obraId,
        usuarioId: data.usuarioId,
        perfilId: finalPerfilId,
        permissoes,
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
      include: {
        usuario: {
          select: { perfilGlobal: true, capabilities: true },
        },
      },
    });
    if (!role) throw new Error('Vínculo não encontrado');

    let permissoes = data.permissoes;
    if (permissoes !== undefined) {
      const caps = await this.capabilities.resolveForUser({
        empresaId,
        perfilGlobal: role.usuario.perfilGlobal,
        capabilitiesOverride: role.usuario.capabilities,
      });
      permissoes = mergePermissoesObra(
        permissoes as Record<string, string>,
        caps,
      );
    }

    return this.prisma.userObraRole.update({
      where: { id: role.id },
      data: {
        ...(data.perfilId && { perfilId: data.perfilId }),
        ...(permissoes !== undefined && { permissoes }),
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

    const tenantRdo = { obraId, deletedAt: null, obra: { empresaId } };

    const [rdosPendentes, latestRdos, diariosRecentes] = await Promise.all([
      this.prisma.rdo.count({
        where: { ...tenantRdo, status: 'SUBMETIDO' },
      }),
      this.prisma.rdo.findMany({
        where: tenantRdo,
        orderBy: { dataReferencia: 'desc' },
        take: 5,
        include: {
          efetivos: { where: { deletedAt: null } },
          atividades: { where: { deletedAt: null } },
        },
      }),
      this.prisma.rdo.findMany({
        where: tenantRdo,
        orderBy: [{ dataReferencia: 'desc' }, { updatedAt: 'desc' }],
        take: 30,
        select: { id: true, dataReferencia: true, dadosExtras: true },
      }),
    ]);

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

    let origemPendencias: { id: string; dataReferencia: Date } | null = null;
    let pendencias: AtividadePendentePainel[] = [];
    for (const diario of diariosRecentes) {
      const lista = pendenciasDoDiario(diario.dadosExtras);
      if (lista === null) continue;
      origemPendencias = {
        id: diario.id,
        dataReferencia: diario.dataReferencia,
      };
      pendencias = lista;
      break;
    }

    return {
      rdosPendentes,
      efetivoHoje,
      status: obra.status,
      atividadesRecentes,
      atividadesPendentes: {
        rdoId: origemPendencias?.id || null,
        dataReferencia: origemPendencias?.dataReferencia || null,
        grupos: agruparPorResponsavel(pendencias),
      },
    };
  }
}
