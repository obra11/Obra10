import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { perfilGlobalToObraNomeInterno } from '../../core/capabilities/obra-perfil';
import {
  clampPercentual,
  montarTimelineEvolucao,
  parseDateOnly,
} from './obra-evolucao.helper';

const JANELA_DIAS_PROBLEMAS = 30;
const MAX_PROBLEMAS_PAINEL = 8;

const MOTIVO_NAO_EXECUCAO_LABEL: Record<string, string> = {
  FALTA_MATERIAL: 'Falta de material',
  FALTA_MAO_DE_OBRA: 'Falta de mão de obra',
  CHUVA: 'Chuva / clima',
  EQUIPAMENTO_INDISPONIVEL: 'Equipamento indisponível',
  AGUARDANDO_APROVACAO: 'Aguardando aprovação',
  PROJETO_NAO_LIBERADO: 'Projeto não liberado',
  RETRABALHO: 'Retrabalho',
  INTERFERENCIA_TERCEIROS: 'Interferência de terceiros',
  OUTROS: 'Outros',
};

type TipoProblemaPainel =
  | 'RDO_REJEITADO'
  | 'MOTIVO_NAO_EXECUCAO'
  | 'OCORRENCIA'
  | 'ALERTA';

type GravidadeProblemaPainel = 'alta' | 'media' | 'baixa';

type ProblemaPainelItem = {
  id: string;
  tipo: TipoProblemaPainel;
  titulo: string;
  detalhe: string;
  gravidade: GravidadeProblemaPainel;
  data: Date;
  link: string;
};

function truncarTexto(texto: string, max = 160): string {
  const t = String(texto || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!t) return '';
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trimEnd()}…`;
}

function labelMotivoNaoExecucao(motivo: string): string {
  return MOTIVO_NAO_EXECUCAO_LABEL[motivo] || motivo.replace(/_/g, ' ').toLowerCase();
}

function tituloAlerta(tipo: string): string {
  const conhecidos: Record<string, string> = {
    AFERICAO_VENCENDO: 'Aferição vencendo',
  };
  if (conhecidos[tipo]) return conhecidos[tipo];
  const texto = tipo.replace(/_/g, ' ').toLowerCase();
  return texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : 'Alerta da obra';
}

function inferirMotivoClima(dadosExtras: any): string {
  const textClima = [
    dadosExtras?.climaManha,
    dadosExtras?.climaTarde,
    dadosExtras?.climaNoite,
    dadosExtras?.clima,
    dadosExtras?.condicoesClimaticas,
  ]
    .filter(Boolean)
    .map((c) => String(c).toLowerCase())
    .join(' ');
  if (
    textClima.includes('chuva') ||
    textClima.includes('chuvoso') ||
    textClima.includes('chuvosa')
  ) {
    return 'CHUVA';
  }
  return 'OUTROS';
}

function agregarMotivosNaoExecucao(
  rdos: Array<{
    dataReferencia: Date;
    dadosExtras: unknown;
    tarefas: Array<{ motivoNaoExecucao: string | null }>;
  }>,
): Array<{ motivo: string; total: number; ultimaData: Date }> {
  const motivoMap: Record<string, { total: number; ultimaData: Date }> = {};
  const registrar = (motivo: string | null | undefined, data: Date) => {
    if (!motivo) return;
    const key = String(motivo);
    const atual = motivoMap[key];
    if (!atual) {
      motivoMap[key] = { total: 1, ultimaData: data };
      return;
    }
    atual.total += 1;
    if (data > atual.ultimaData) atual.ultimaData = data;
  };

  for (const rdo of rdos) {
    const d = (rdo.dadosExtras as any) || {};
    const atividades = d.atividadesExecutadas || [];
    if (Array.isArray(atividades) && atividades.length > 0) {
      for (const a of atividades) {
        if (!a?.descricao) continue;
        if (a.status === 'finalizada') continue;
        registrar(a.motivoNaoExecucao || inferirMotivoClima(d), rdo.dataReferencia);
      }
    } else {
      for (const t of rdo.tarefas) {
        registrar(t.motivoNaoExecucao, rdo.dataReferencia);
      }
    }
  }

  return Object.entries(motivoMap)
    .map(([motivo, v]) => ({ motivo, ...v }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 3);
}

function extrairOcorrenciasDadosExtras(
  rdos: Array<{ id: string; dataReferencia: Date; dadosExtras: unknown }>,
  obraId: string,
): ProblemaPainelItem[] {
  const items: ProblemaPainelItem[] = [];
  for (const rdo of rdos) {
    const extras = (rdo.dadosExtras as any) || {};
    const lista = extras.ocorrencias;
    if (!Array.isArray(lista)) continue;
    lista.forEach((o: any, idx: number) => {
      const tipo = String(o?.tipoOcorrencia || o?.tipo || 'Ocorrência').trim();
      const descricao = String(o?.descricao || o?.texto || '').trim();
      if (!tipo && !descricao) return;
      items.push({
        id: `ocorrencia-json-${rdo.id}-${idx}`,
        tipo: 'OCORRENCIA',
        titulo: tipo || 'Ocorrência',
        detalhe: truncarTexto(descricao || 'Sem descrição'),
        gravidade: 'media',
        data: rdo.dataReferencia,
        link: `/obras/${obraId}/rdos/${rdo.id}`,
      });
    });
  }
  return items;
}

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
          clienteNome: obra.clienteNome,
          dataInicio: obra.dataInicio,
          dataPrevisaoTermino: obra.dataPrevisaoTermino,
          percentualAvanco: obra.percentualAvanco,
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
    data: {
      nome?: string;
      endereco?: string;
      status?: string;
      clienteNome?: string | null;
      dataInicio?: string | null;
      dataPrevisaoTermino?: string | null;
      percentualAvanco?: number | null;
    },
  ) {
    if (!id) throw new Error('ID não fornecido');
    const obra = await this.prisma.obra.findFirst({ where: { id, empresaId } });
    if (!obra)
      throw new Error('Obra não encontrada ou não pertence a esta empresa.');

    const dataInicio = parseDateOnly(data.dataInicio);
    const dataPrevisaoTermino = parseDateOnly(data.dataPrevisaoTermino);
    if (data.dataInicio !== undefined && dataInicio === undefined) {
      throw new BadRequestException('dataInicio deve estar no formato YYYY-MM-DD.');
    }
    if (data.dataPrevisaoTermino !== undefined && dataPrevisaoTermino === undefined) {
      throw new BadRequestException(
        'dataPrevisaoTermino deve estar no formato YYYY-MM-DD.',
      );
    }
    if (
      dataInicio instanceof Date &&
      dataPrevisaoTermino instanceof Date &&
      dataPrevisaoTermino < dataInicio
    ) {
      throw new BadRequestException(
        'A previsão de término não pode ser anterior à data de início.',
      );
    }

    const percentualAvanco = clampPercentual(data.percentualAvanco);
    if (data.percentualAvanco !== undefined && percentualAvanco === undefined) {
      throw new BadRequestException('percentualAvanco deve ser um número de 0 a 100.');
    }

    return this.prisma.obra.update({
      where: { id },
      data: {
        ...(data.nome && { nome: data.nome }),
        ...(data.endereco !== undefined && { endereco: data.endereco }),
        ...(data.status && { status: data.status }),
        ...(data.clienteNome !== undefined && {
          clienteNome: data.clienteNome?.trim() || null,
        }),
        ...(dataInicio !== undefined && { dataInicio }),
        ...(dataPrevisaoTermino !== undefined && { dataPrevisaoTermino }),
        ...(percentualAvanco !== undefined && { percentualAvanco }),
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

    const since = new Date();
    since.setDate(since.getDate() - JANELA_DIAS_PROBLEMAS);
    const tenantRdo = { obraId, deletedAt: null, obra: { empresaId } };

    const [
      rdosPendentes,
      latestRdos,
      rdosRejeitados,
      rdosPeriodo,
      ocorrenciasDb,
      alertasNaoLidos,
    ] = await Promise.all([
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
        where: {
          ...tenantRdo,
          status: 'REJEITADO',
          updatedAt: { gte: since },
        },
        orderBy: { updatedAt: 'desc' },
        take: MAX_PROBLEMAS_PAINEL,
        select: {
          id: true,
          dataReferencia: true,
          rejeitadoMotivo: true,
          updatedAt: true,
          aprovacaoAt: true,
        },
      }),
      this.prisma.rdo.findMany({
        where: {
          ...tenantRdo,
          dataReferencia: { gte: since },
        },
        select: {
          id: true,
          dataReferencia: true,
          dadosExtras: true,
          tarefas: { select: { motivoNaoExecucao: true } },
        },
        take: 500,
      }),
      this.prisma.rdoOcorrencia.findMany({
        where: {
          deletedAt: null,
          createdAt: { gte: since },
          rdo: tenantRdo,
        },
        orderBy: { createdAt: 'desc' },
        take: MAX_PROBLEMAS_PAINEL,
        select: {
          id: true,
          tipoOcorrencia: true,
          descricao: true,
          createdAt: true,
          rdoId: true,
        },
      }),
      this.prisma.alertaObra.findMany({
        where: {
          obraId,
          lido: false,
          createdAt: { gte: since },
          obra: { empresaId },
        },
        orderBy: { createdAt: 'desc' },
        take: MAX_PROBLEMAS_PAINEL,
        select: {
          id: true,
          tipo: true,
          mensagem: true,
          createdAt: true,
        },
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

    const problemasRejeitados: ProblemaPainelItem[] = rdosRejeitados.map((rdo) => ({
      id: `rejeitado-${rdo.id}`,
      tipo: 'RDO_REJEITADO',
      titulo: 'RDO rejeitado',
      detalhe: truncarTexto(rdo.rejeitadoMotivo || 'Sem motivo informado'),
      gravidade: 'alta',
      data: rdo.aprovacaoAt || rdo.updatedAt || rdo.dataReferencia,
      link: `/obras/${obraId}/rdos/${rdo.id}`,
    }));

    const problemasMotivos: ProblemaPainelItem[] = agregarMotivosNaoExecucao(
      rdosPeriodo,
    ).map((m) => ({
      id: `motivo-${m.motivo}`,
      tipo: 'MOTIVO_NAO_EXECUCAO',
      titulo: `Não execução: ${labelMotivoNaoExecucao(m.motivo)}`,
      detalhe: `${m.total} ocorrência${m.total === 1 ? '' : 's'} nos últimos ${JANELA_DIAS_PROBLEMAS} dias`,
      gravidade: 'media',
      data: m.ultimaData,
      link: `/obras/${obraId}/rdos/dashboard`,
    }));

    const problemasOcorrenciasTabela: ProblemaPainelItem[] = ocorrenciasDb.map(
      (o) => ({
        id: `ocorrencia-${o.id}`,
        tipo: 'OCORRENCIA',
        titulo: o.tipoOcorrencia || 'Ocorrência',
        detalhe: truncarTexto(o.descricao || 'Sem descrição'),
        gravidade: 'media',
        data: o.createdAt,
        link: `/obras/${obraId}/rdos/${o.rdoId}`,
      }),
    );
    const problemasOcorrencias =
      problemasOcorrenciasTabela.length > 0
        ? problemasOcorrenciasTabela
        : extrairOcorrenciasDadosExtras(rdosPeriodo, obraId);

    const problemasAlertas: ProblemaPainelItem[] = alertasNaoLidos.map((a) => ({
      id: `alerta-${a.id}`,
      tipo: 'ALERTA',
      titulo: tituloAlerta(a.tipo),
      detalhe: truncarTexto(a.mensagem || 'Alerta da obra'),
      gravidade: 'baixa',
      data: a.createdAt,
      link: `/obras/${obraId}/rdos`,
    }));

    const principaisProblemas = [
      ...problemasRejeitados,
      ...problemasMotivos,
      ...problemasOcorrencias,
      ...problemasAlertas,
    ].slice(0, MAX_PROBLEMAS_PAINEL);

    return {
      rdosPendentes,
      efetivoHoje,
      status: obra.status,
      percentualAvanco: obra.percentualAvanco,
      clienteNome: obra.clienteNome,
      dataInicio: obra.dataInicio,
      dataPrevisaoTermino: obra.dataPrevisaoTermino,
      atividadesRecentes,
      principaisProblemas,
    };
  }

  async getEvolucao(obraId: string, empresaId: string) {
    const obra = await this.prisma.obra.findFirst({
      where: { id: obraId, empresaId, deletedAt: null },
    });
    if (!obra) {
      throw new BadRequestException('Obra não encontrada ou sem acesso.');
    }

    const tenantRdo = { obraId, deletedAt: null, obra: { empresaId } };

    const [rdos, anexos] = await Promise.all([
      this.prisma.rdo.findMany({
        where: tenantRdo,
        orderBy: { dataReferencia: 'desc' },
        select: {
          id: true,
          dataReferencia: true,
          status: true,
          dadosExtras: true,
          atividades: {
            where: { deletedAt: null },
            select: { descricao: true },
          },
        },
        take: 400,
      }),
      this.prisma.anexo.findMany({
        where: {
          obraId,
          deletedAt: null,
          origem: { in: ['RDO', 'RDO_ATIVIDADE'] },
          obra: { empresaId, deletedAt: null },
        },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          attachableId: true,
          urlS3: true,
          mimeType: true,
          tipoArquivo: true,
          nomeOriginal: true,
          createdAt: true,
          criador: { select: { nome: true } },
        },
        take: 2000,
      }),
    ]);

    const rdosInput = rdos.map((rdo) => {
      const extras = (rdo.dadosExtras as any) || {};
      const jsonAtividades = Array.isArray(extras.atividadesExecutadas)
        ? extras.atividadesExecutadas
            .map((a: any) => String(a?.descricao || '').trim())
            .filter(Boolean)
        : [];
      const tabelaAtividades = rdo.atividades
        .map((a) => String(a.descricao || '').trim())
        .filter(Boolean);
      return {
        id: rdo.id,
        dataReferencia: rdo.dataReferencia,
        status: rdo.status,
        atividades: jsonAtividades.length > 0 ? jsonAtividades : tabelaAtividades,
      };
    });

    const fotosInput = anexos.map((a) => ({
      id: a.id,
      rdoId: a.attachableId,
      urlS3: a.urlS3,
      mimeType: a.mimeType,
      tipoArquivo: a.tipoArquivo,
      nomeOriginal: a.nomeOriginal,
      createdAt: a.createdAt,
      criadorNome: a.criador?.nome || null,
    }));

    const { dias, resumo } = montarTimelineEvolucao(rdosInput, fotosInput);

    return {
      obra: {
        id: obra.id,
        nome: obra.nome,
        status: obra.status,
        imageUrl: obra.imageUrl,
        clienteNome: obra.clienteNome,
        dataInicio: obra.dataInicio,
        dataPrevisaoTermino: obra.dataPrevisaoTermino,
        percentualAvanco: obra.percentualAvanco,
      },
      resumo,
      dias,
    };
  }
}
