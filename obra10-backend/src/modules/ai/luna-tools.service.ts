import { Injectable, Logger } from '@nestjs/common';
import { Prisma, RdoStatus, TipoInsumo } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CapabilitiesService } from '../../core/capabilities/capabilities.service';
import { mergePermissoesObra } from '../../core/capabilities/role-capabilities';
import { RdoService } from '../rdo/rdo.service';
import { ObraService } from '../obra/obra.service';
import { CatalogoService } from '../catalogo/catalogo.service';
import {
  agregarRdosParaContexto,
  formatarContextoParaPrompt,
  inferirPeriodo,
} from './ai-context.helper';
import { consultarOnline, formatarRespostaOnline } from './ai-online.helper';
import { buscarAjuda } from './luna-ajuda';
import { RegistroBusca, selecionarTrechos, termosDeBusca } from './luna-busca';
import { LunaAcoesService } from './luna-acoes.service';

export type LunaAuth = {
  userId: string;
  empresaId: string;
  perfilGlobal?: string;
};

export type LunaToolDef = {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
  };
};

const MAX_TOOL_CHARS = 12_000;

export const LUNA_TOOL_DEFS: LunaToolDef[] = [
  {
    name: 'listar_obras',
    description:
      'Lista os empreendimentos (obras) que o usuário pode ver na empresa. Use sempre que a pergunta citar outra obra, comparar canteiros ou pedir o panorama da empresa.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'painel_obra',
    description:
      'Painel geral de uma obra (alias: ver_obra): status, RDOs pendentes, efetivo do dia, atividades recentes e atividades pendentes do último diário, agrupadas por responsável.',
    inputSchema: {
      type: 'object',
      properties: {
        obra: {
          type: 'string',
          description: 'Nome ou ID da obra. Se vazio, usa a obra da tela atual.',
        },
      },
    },
  },
  {
    name: 'ver_obra',
    description:
      'Igual a painel_obra: resumo do empreendimento (atividades pendentes, efetivo do dia, RDOs).',
    inputSchema: {
      type: 'object',
      properties: {
        obra: {
          type: 'string',
          description: 'Nome ou ID da obra. Se vazio, usa a obra da tela atual.',
        },
      },
    },
  },
  {
    name: 'listar_relatorios',
    description:
      'Lista diários de obra (RDOs) de todas as obras acessíveis, ou de uma obra específica. Ordem cronológica recente.',
    inputSchema: {
      type: 'object',
      properties: {
        obra: { type: 'string', description: 'Filtrar por nome ou ID da obra.' },
        status: {
          type: 'string',
          description:
            'RASCUNHO, EM_PREENCHIMENTO, SUBMETIDO, APROVADO ou REJEITADO.',
        },
        limite: { type: 'number', description: 'Máximo de itens (padrão 40).' },
      },
    },
  },
  {
    name: 'ver_rdo',
    description:
      'Abre um diário específico (dados, clima, efetivo, atividades, observações, status). Passe o id retornado em listar_relatorios.',
    inputSchema: {
      type: 'object',
      properties: {
        rdo_id: { type: 'string' },
        obra_id: {
          type: 'string',
          description: 'ID da obra do RDO, se já conhecido.',
        },
      },
      required: ['rdo_id'],
    },
  },
  {
    name: 'agregar_diarios',
    description:
      'Consolida clima, efetivo, atividades e pendências dos diários num período. Obra pelo nome (ex.: Victoria) ou vazio = todas as obras acessíveis. Aliases: agregar_clima, agregar_efetivo, agregar_atividades.',
    inputSchema: {
      type: 'object',
      properties: {
        obra: {
          type: 'string',
          description:
            'Nome ou ID. Vazio = todas as obras acessíveis (empresa).',
        },
        data_inicio: { type: 'string', description: 'YYYY-MM-DD' },
        data_fim: { type: 'string', description: 'YYYY-MM-DD' },
        pergunta: {
          type: 'string',
          description:
            'Pergunta original, para inferir período se as datas não vierem.',
        },
      },
    },
  },
  {
    name: 'agregar_clima',
    description:
      'Corte de clima/chuva dos diários (obra pelo nome ou consolidado da empresa). Mesmos argumentos de agregar_diarios.',
    inputSchema: {
      type: 'object',
      properties: {
        obra: { type: 'string' },
        data_inicio: { type: 'string' },
        data_fim: { type: 'string' },
        pergunta: { type: 'string' },
      },
    },
  },
  {
    name: 'agregar_efetivo',
    description:
      'Corte de efetivo lançado nos diários (obra pelo nome ou consolidado). Mesmos argumentos de agregar_diarios.',
    inputSchema: {
      type: 'object',
      properties: {
        obra: { type: 'string' },
        data_inicio: { type: 'string' },
        data_fim: { type: 'string' },
        pergunta: { type: 'string' },
      },
    },
  },
  {
    name: 'agregar_atividades',
    description:
      'Corte de atividades/pendências dos diários (obra pelo nome ou consolidado). Mesmos argumentos de agregar_diarios.',
    inputSchema: {
      type: 'object',
      properties: {
        obra: { type: 'string' },
        data_inicio: { type: 'string' },
        data_fim: { type: 'string' },
        pergunta: { type: 'string' },
      },
    },
  },
  {
    name: 'listar_catalogo',
    description:
      'Cadastro Base da empresa: materiais, equipamentos e mão de obra padronizados.',
    inputSchema: {
      type: 'object',
      properties: {
        tipo: {
          type: 'string',
          description: 'MATERIAL, EQUIPAMENTO ou MAO_DE_OBRA. Vazio = todos.',
        },
        busca: { type: 'string' },
      },
    },
  },
  {
    name: 'listar_equipe',
    description:
      'Usuários da empresa (nome, perfil, ativo, obras). Só para quem gerencia equipe.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'listar_efetivo_obra',
    description:
      'Colaboradores cadastrados no canteiro (módulo Efetivo da obra), não o lançamento do RDO.',
    inputSchema: {
      type: 'object',
      properties: {
        obra: { type: 'string', description: 'Nome ou ID da obra.' },
      },
    },
  },
  {
    name: 'listar_alertas',
    description: 'Alertas não lidos das obras acessíveis (últimos 30 dias).',
    inputSchema: {
      type: 'object',
      properties: {
        obra: { type: 'string', description: 'Filtrar por obra (opcional).' },
      },
    },
  },
  {
    name: 'ver_plano',
    description:
      'Plano da empresa: módulos ativos e cobranças pendentes. Só para quem gerencia financeiro.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'ajuda_obra10',
    description:
      'Como usar o Obra 10: telas, fluxos (criar RDO, aprovar, PDF, Relatórios, catálogo, equipe). Use em dúvida de navegação ou “como faço”.',
    inputSchema: {
      type: 'object',
      properties: {
        tema: {
          type: 'string',
          description: 'Ex.: rdo, pdf, relatorios, catalogo, equipe, plano.',
        },
      },
    },
  },
  {
    name: 'buscar_no_aplicativo',
    description:
      'Varre o texto do Obra 10 desta empresa: atividades, tarefas, ocorrências, conteúdo do diário, catálogo, equipe e alertas. Use para achar um fato específico (ex.: quando a laje de um pavimento foi concretada). Devolve trechos com obra, data e id.',
    inputSchema: {
      type: 'object',
      properties: {
        consulta: {
          type: 'string',
          description: 'Palavras do que se quer achar, como a pessoa perguntou.',
        },
        obra: { type: 'string', description: 'Nome ou ID da obra. Vazio = todas as acessíveis.' },
        data_inicio: { type: 'string', description: 'YYYY-MM-DD' },
        data_fim: { type: 'string', description: 'YYYY-MM-DD' },
      },
      required: ['consulta'],
    },
  },
  {
    name: 'propor_ajuste',
    description:
      'Prepara um ajuste e NÃO grava. A pessoa confirma no chat. Tipos: rdo_rascunho (rdo_id + atividade ou observacao), rdo_submeter, rdo_aprovar, rdo_rejeitar (motivo), catalogo_criar, catalogo_atualizar, equipe_criar, equipe_atualizar, equipe_papel. Sem apagar empresa, senha ou cobrança.',
    inputSchema: {
      type: 'object',
      properties: {
        tipo: { type: 'string' },
        rdo_id: { type: 'string' },
        atividade: { type: 'string' },
        observacao: { type: 'string' },
        aprovador_id: { type: 'string' },
        motivo: { type: 'string' },
        insumo_id: { type: 'string' },
        nome: { type: 'string' },
        email: { type: 'string' },
        tipo_insumo: { type: 'string', description: 'MATERIAL, EQUIPAMENTO ou MAO_DE_OBRA.' },
        unidade: { type: 'string' },
        usuario_id: { type: 'string' },
        perfil: { type: 'string' },
        telefone: { type: 'string' },
        papel: { type: 'string', description: 'GESTOR, COLABORADOR, EXTERNO ou PERSONALIZADO.' },
      },
      required: ['tipo'],
    },
  },
  {
    name: 'consultar_fonte_aberta',
    description:
      'Consulta fonte aberta (norma com escopo público, Wikipedia, .gov.br) quando a pergunta NÃO for dado interno da obra. Não invente cláusula de norma paga.',
    inputSchema: {
      type: 'object',
      properties: {
        consulta: { type: 'string' },
      },
      required: ['consulta'],
    },
  },
];

export const LUNA_MCP_TOOL_NAMES = LUNA_TOOL_DEFS.map((t) => t.name);

type ObraAcesso = {
  id: string;
  nome: string;
  endereco?: string | null;
  status?: string;
  permissoes: Record<string, string>;
};

function rdoSoAprovados(perm?: string) {
  return perm === 'VIEW_APPROVED' || perm === 'VIEW_PARTIAL_APPROVED';
}

function permRdo(obra: ObraAcesso) {
  return obra.permissoes?.RDO || obra.permissoes?.rdo;
}

function clipJson(value: unknown): string {
  const text = JSON.stringify(value, null, 2);
  if (text.length <= MAX_TOOL_CHARS) return text;
  return `${text.slice(0, MAX_TOOL_CHARS)}\n…[truncado]`;
}

function parseIso(raw?: string): Date | null {
  if (!raw) return null;
  const m = String(raw).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T12:00:00.000Z`);
  return isNaN(d.getTime()) ? null : d;
}

@Injectable()
export class LunaToolsService {
  private readonly logger = new Logger(LunaToolsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly capabilities: CapabilitiesService,
    private readonly rdoService: RdoService,
    private readonly obraService: ObraService,
    private readonly catalogo: CatalogoService,
    private readonly acoes: LunaAcoesService,
  ) {}

  openaiTools() {
    return LUNA_TOOL_DEFS.map((t) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.inputSchema,
      },
    }));
  }

  anthropicTools() {
    return LUNA_TOOL_DEFS.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema,
    }));
  }

  async execute(
    name: string,
    args: Record<string, any>,
    auth: LunaAuth,
    telaObraId?: string | null,
  ): Promise<string> {
    try {
      const result = await this.dispatch(name, args || {}, auth, telaObraId);
      return clipJson(result);
    } catch (err: any) {
      this.logger.warn(`[LunaTools] ${name}: ${err?.message}`);
      return clipJson({
        erro: err?.message || 'Falha ao executar a consulta.',
      });
    }
  }

  private async dispatch(
    name: string,
    args: Record<string, any>,
    auth: LunaAuth,
    telaObraId?: string | null,
  ): Promise<unknown> {
    switch (name) {
      case 'listar_obras':
        return this.listarObras(auth);
      case 'painel_obra':
      case 'ver_obra':
        return this.painelObra(auth, args.obra || telaObraId);
      case 'listar_relatorios':
        return this.listarRelatorios(auth, args);
      case 'ver_rdo':
        return this.verRdo(auth, args.rdo_id, args.obra_id);
      case 'agregar_diarios':
      case 'agregar_clima':
      case 'agregar_efetivo':
      case 'agregar_atividades':
        return this.agregar(auth, args, telaObraId);
      case 'listar_catalogo':
        return this.listarCatalogo(auth, args);
      case 'listar_equipe':
        return this.listarEquipe(auth);
      case 'listar_efetivo_obra':
        return this.listarEfetivo(auth, args.obra || telaObraId);
      case 'listar_alertas':
        return this.listarAlertas(auth, args.obra);
      case 'ver_plano':
        return this.verPlano(auth);
      case 'ajuda_obra10':
        return { ajuda: buscarAjuda(args.tema) };
      case 'buscar_no_aplicativo':
        return this.buscarNoAplicativo(auth, args);
      case 'propor_ajuste':
        return this.acoes.propor(auth, args);
      case 'consultar_fonte_aberta':
        return {
          resposta: formatarRespostaOnline(
            await consultarOnline(String(args.consulta || '')),
          ),
        };
      case 'perguntar_luna':
        return {
          erro:
            'perguntar_luna não está disponível no MCP. Use as tools de leitura (listar_obras, agregar_diarios, ajuda_obra10, …).',
        };
      default:
        return { erro: `Ferramenta desconhecida: ${name}` };
    }
  }

  private async caps(auth: LunaAuth) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: auth.userId, deletedAt: null },
      select: { perfilGlobal: true, capabilities: true },
    });
    return this.capabilities.resolveForUser({
      empresaId: auth.empresaId,
      perfilGlobal: usuario?.perfilGlobal || auth.perfilGlobal || 'COLABORADOR',
      capabilitiesOverride: usuario?.capabilities,
    });
  }

  async listarObras(auth: LunaAuth) {
    const obras = await this.obrasAcessiveis(auth);
    return {
      total: obras.length,
      obras: obras.map(({ id, nome, endereco, status }) => ({
        id,
        nome,
        endereco,
        status,
      })),
    };
  }

  private async obrasAcessiveis(auth: LunaAuth): Promise<ObraAcesso[]> {
    const caps = await this.caps(auth);
    const acessoTodas =
      auth.perfilGlobal === 'SUPER_ADMIN' || caps.acessoTodasObras;
    const privilegiadoPerms =
      caps.modulosPadrao && Object.keys(caps.modulosPadrao).length > 0
        ? caps.modulosPadrao
        : { RDO: caps.criarEditarRdo ? 'EDIT' : 'VIEW' };

    if (acessoTodas) {
      const list = await this.prisma.obra.findMany({
        where: { empresaId: auth.empresaId, deletedAt: null },
        select: { id: true, nome: true, endereco: true, status: true },
        orderBy: { nome: 'asc' },
      });
      return list.map((o) => ({
        ...o,
        permissoes: privilegiadoPerms as Record<string, string>,
      }));
    }

    const list = await this.prisma.obra.findMany({
      where: {
        empresaId: auth.empresaId,
        deletedAt: null,
        status: { not: 'INATIVA' },
        userObraRole: { some: { usuarioId: auth.userId } },
      },
      select: {
        id: true,
        nome: true,
        endereco: true,
        status: true,
        userObraRole: {
          where: { usuarioId: auth.userId },
          select: { permissoes: true },
        },
      },
      orderBy: { nome: 'asc' },
    });
    return list.map((o) => ({
      id: o.id,
      nome: o.nome,
      endereco: o.endereco,
      status: o.status,
      permissoes: mergePermissoesObra(
        (o.userObraRole[0]?.permissoes || {}) as Record<string, string>,
        caps,
      ),
    }));
  }

  private async buscarNoAplicativo(auth: LunaAuth, args: Record<string, any>) {
    const consulta = String(args.consulta || '').trim();
    const termos = termosDeBusca(consulta);
    if (!termos.length) {
      return { consulta, total: 0, achados: [], aviso: 'Informe o que quer achar.' };
    }
    let obras = await this.obrasAcessiveis(auth);
    if (args.obra) {
      const obra = await this.resolverObra(auth, args.obra);
      obras = obra ? [obra] : [];
    }
    if (!obras.length) {
      return { consulta, total: 0, achados: [], aviso: 'Nenhuma obra acessível para essa busca.' };
    }
    const inicio = parseIso(args.data_inicio);
    const fim = parseIso(args.data_fim);
    const soAprovados = new Set(
      obras.filter((obra) => rdoSoAprovados(permRdo(obra))).map((obra) => obra.id),
    );
    const ids = obras.map((obra) => obra.id);
    const nomes = new Map(obras.map((obra) => [obra.id, obra.nome]));
    const periodo = (data: Date | null | undefined) => {
      if (!data) return true;
      if (inicio && data < inicio) return false;
      if (fim && data > fim) return false;
      return true;
    };
    const dia = (data?: Date | null) => (data ? data.toISOString().slice(0, 10) : null);
    const registros: RegistroBusca[] = [];

    const atividades = await this.prisma.rdoAtividade.findMany({
      where: {
        deletedAt: null,
        descricao: { contains: termos[0], mode: 'insensitive' },
        rdo: {
          deletedAt: null,
          obraId: { in: ids },
          obra: { empresaId: auth.empresaId, deletedAt: null },
        },
      },
      select: {
        descricao: true,
        rdo: {
          select: {
            id: true,
            status: true,
            dataReferencia: true,
            obraId: true,
            obra: { select: { empresaId: true, nome: true } },
          },
        },
      },
      take: 40,
    });
    for (const item of atividades) {
      if (!periodo(item.rdo.dataReferencia)) continue;
      if (soAprovados.has(item.rdo.obraId) && item.rdo.status !== RdoStatus.APROVADO) continue;
      registros.push({
        empresaId: item.rdo.obra.empresaId,
        obraId: item.rdo.obraId,
        obraNome: item.rdo.obra.nome,
        data: dia(item.rdo.dataReferencia),
        status: item.rdo.status,
        rdoId: item.rdo.id,
        origem: 'atividade',
        texto: item.descricao,
      });
    }

    const tarefas = await this.prisma.tarefaRdo.findMany({
      where: {
        descricao: { contains: termos[0], mode: 'insensitive' },
        rdo: {
          deletedAt: null,
          obraId: { in: ids },
          obra: { empresaId: auth.empresaId, deletedAt: null },
        },
      },
      select: {
        descricao: true,
        rdo: {
          select: {
            id: true,
            status: true,
            dataReferencia: true,
            obraId: true,
            obra: { select: { empresaId: true, nome: true } },
          },
        },
      },
      take: 40,
    });
    for (const item of tarefas) {
      if (!periodo(item.rdo.dataReferencia)) continue;
      if (soAprovados.has(item.rdo.obraId) && item.rdo.status !== RdoStatus.APROVADO) continue;
      registros.push({
        empresaId: item.rdo.obra.empresaId,
        obraId: item.rdo.obraId,
        obraNome: item.rdo.obra.nome,
        data: dia(item.rdo.dataReferencia),
        status: item.rdo.status,
        rdoId: item.rdo.id,
        origem: 'tarefa',
        texto: item.descricao,
      });
    }

    const ocorrencias = await this.prisma.rdoOcorrencia.findMany({
      where: {
        deletedAt: null,
        descricao: { contains: termos[0], mode: 'insensitive' },
        rdo: {
          deletedAt: null,
          obraId: { in: ids },
          obra: { empresaId: auth.empresaId, deletedAt: null },
        },
      },
      select: {
        descricao: true,
        rdo: {
          select: {
            id: true,
            status: true,
            dataReferencia: true,
            obraId: true,
            obra: { select: { empresaId: true, nome: true } },
          },
        },
      },
      take: 40,
    });
    for (const item of ocorrencias) {
      if (!periodo(item.rdo.dataReferencia)) continue;
      if (soAprovados.has(item.rdo.obraId) && item.rdo.status !== RdoStatus.APROVADO) continue;
      registros.push({
        empresaId: item.rdo.obra.empresaId,
        obraId: item.rdo.obraId,
        obraNome: item.rdo.obra.nome,
        data: dia(item.rdo.dataReferencia),
        status: item.rdo.status,
        rdoId: item.rdo.id,
        origem: 'ocorrencia',
        texto: item.descricao,
      });
    }

    if (typeof this.prisma.$queryRaw === 'function') {
      let extras: Array<{
        id: string;
        data_referencia: Date;
        status: string;
        obra_id: string;
        nome: string;
        empresa_id: string;
        texto: string;
      }> = [];
      try {
      extras = await this.prisma.$queryRaw<
        Array<{
          id: string;
          data_referencia: Date;
          status: string;
          obra_id: string;
          nome: string;
          empresa_id: string;
          texto: string;
        }>
      >(Prisma.sql`
        SELECT r.id, r.data_referencia, r.status::text AS status, o.id AS obra_id, o.nome,
               o.empresa_id, left(r.dados_extras::text, 4000) AS texto
        FROM rdos r
        INNER JOIN obras o ON o.id = r.obra_id
        WHERE o.empresa_id = ${auth.empresaId}
          AND r.deleted_at IS NULL
          AND o.deleted_at IS NULL
          AND r.obra_id IN (${Prisma.join(ids)})
          AND r.dados_extras::text ILIKE ${'%' + termos[0] + '%'}
        LIMIT 40
      `);
      } catch (err: any) {
        this.logger.warn(`[LunaTools] busca no diário: ${err?.message}`);
      }
      for (const item of extras) {
        if (!periodo(item.data_referencia)) continue;
        if (soAprovados.has(item.obra_id) && item.status !== 'APROVADO') continue;
        registros.push({
          empresaId: item.empresa_id,
          obraId: item.obra_id,
          obraNome: item.nome || nomes.get(item.obra_id) || '',
          data: dia(item.data_referencia),
          status: item.status,
          rdoId: item.id,
          origem: 'diario',
          texto: item.texto,
        });
      }
    }

    const catalogo = await this.prisma.catalogoInsumo.findMany({
      where: {
        empresaId: auth.empresaId,
        deletedAt: null,
        nome: { contains: termos[0], mode: 'insensitive' },
      },
      select: { id: true, nome: true, tipo: true, empresaId: true },
      take: 20,
    });
    for (const item of catalogo) {
      registros.push({
        empresaId: item.empresaId,
        obraId: '',
        obraNome: 'Cadastro Base',
        origem: 'catalogo',
        rdoId: item.id,
        texto: `${item.tipo}: ${item.nome}`,
      });
    }

    const equipe = await this.prisma.usuario.findMany({
      where: {
        empresaId: auth.empresaId,
        deletedAt: null,
        nome: { contains: termos[0], mode: 'insensitive' },
      },
      select: { id: true, nome: true, perfilGlobal: true, empresaId: true },
      take: 20,
    });
    for (const item of equipe) {
      registros.push({
        empresaId: item.empresaId,
        obraId: '',
        obraNome: 'Equipe',
        origem: 'equipe',
        rdoId: item.id,
        texto: `${item.nome} (${item.perfilGlobal})`,
      });
    }

    const alertas = await this.prisma.alertaObra.findMany({
      where: {
        obraId: { in: ids },
        mensagem: { contains: termos[0], mode: 'insensitive' },
      },
      select: { mensagem: true, obraId: true, createdAt: true },
      take: 20,
    });
    for (const item of alertas) {
      registros.push({
        empresaId: auth.empresaId,
        obraId: item.obraId,
        obraNome: nomes.get(item.obraId) || '',
        data: dia(item.createdAt),
        origem: 'alerta',
        texto: item.mensagem,
      });
    }

    const resultado = selecionarTrechos(consulta, auth.empresaId, registros);
    if (!resultado.total) {
      return {
        ...resultado,
        aviso: 'Não achei esse texto nas obras acessíveis. Diga a obra ou outro trecho.',
      };
    }
    return resultado;
  }

  private async resolverObra(
    auth: LunaAuth,
    ref?: string | null,
  ): Promise<ObraAcesso | null> {
    const list = await this.obrasAcessiveis(auth);
    if (!ref) return list[0] || null;
    const n = String(ref).trim().toLowerCase();
    return (
      list.find((o) => o.id === ref) ||
      list.find((o) => o.nome.toLowerCase() === n) ||
      list.find((o) => o.nome.toLowerCase().includes(n)) ||
      null
    );
  }

  private async painelObra(auth: LunaAuth, ref?: string | null) {
    const obra = await this.resolverObra(auth, ref);
    if (!obra) return { erro: 'Obra não encontrada ou sem acesso.' };
    const painel = await this.obraService.getDashboardPainel(
      obra.id,
      auth.empresaId,
    );
    return {
      obra: { id: obra.id, nome: obra.nome, status: obra.status },
      painel,
    };
  }

  private async listarRelatorios(auth: LunaAuth, args: Record<string, any>) {
    const todos = await this.rdoService.findAllByEmpresa(
      auth.userId,
      auth.empresaId,
    );
    let items = todos;
    if (args.obra) {
      const obra = await this.resolverObra(auth, args.obra);
      if (!obra) return { erro: 'Obra não encontrada ou sem acesso.', items: [] };
      items = items.filter((r) => r.obraId === obra.id);
    }
    if (args.status) {
      const st = String(args.status).toUpperCase();
      items = items.filter((r) => String(r.status).toUpperCase() === st);
    }
    const limite = Math.min(Math.max(Number(args.limite) || 40, 1), 80);
    return {
      total: items.length,
      items: items.slice(0, limite).map((r) => ({
        id: r.id,
        obraId: r.obraId,
        obraNome: r.obraNome,
        status: r.status,
        dataReferencia: r.dataReferencia,
        dataFim: r.dataFim,
        tipoRelatorio: r.tipoRelatorio,
        sequencial: r.sequencial,
        criadorNome: r.criadorNome,
      })),
    };
  }

  private async verRdo(auth: LunaAuth, rdoId: string, obraIdArg?: string) {
    if (!rdoId) return { erro: 'Informe rdo_id.' };
    let obraId = obraIdArg;
    if (!obraId) {
      const row = await this.prisma.rdo.findFirst({
        where: {
          id: rdoId,
          deletedAt: null,
          obra: { empresaId: auth.empresaId, deletedAt: null },
        },
        select: { obraId: true },
      });
      obraId = row?.obraId;
    }
    if (!obraId) return { erro: 'RDO não encontrado nesta empresa.' };
    const acessiveis = await this.obrasAcessiveis(auth);
    const obra = acessiveis.find((o) => o.id === obraId);
    if (!obra) {
      return { erro: 'Sem acesso a esta obra.' };
    }
    const rdo = await this.rdoService.findOne(rdoId, obraId, {
      permissoes: obra.permissoes,
    });
    const extras = (rdo as any).dadosExtras || {};
    return {
      id: rdo.id,
      obraId: rdo.obraId,
      obraNome: (rdo as any).obra?.nome,
      sequencial: (rdo as any).sequencial,
      status: rdo.status,
      dataReferencia: rdo.dataReferencia,
      dataFim: (rdo as any).dataFim,
      tipoRelatorio: (rdo as any).tipoRelatorio,
      criador: (rdo as any).criador?.nome,
      clima: extras.clima || extras.condicoesClimaticas || null,
      profissionais: extras.profissionais || extras.efetivo || null,
      atividades: extras.atividadesExecutadas || extras.atividades || null,
      observacoes: extras.observacoes || extras.observacoesGerais || null,
      pendencias: extras.atividadesPendentes || extras.pendencias || null,
      presentes: extras.presentesVistoria || extras.presentes || null,
    };
  }

  private async agregar(
    auth: LunaAuth,
    args: Record<string, any>,
    telaObraId?: string | null,
  ) {
    const pergunta = String(args.pergunta || '');
    const inferido = inferirPeriodo(pergunta || 'últimos 30 dias');
    const dataInicio = parseIso(args.data_inicio) || inferido.dataInicio;
    const dataFim = parseIso(args.data_fim) || inferido.dataFim;
    const acessiveis = await this.obrasAcessiveis(auth);
    const obra = args.obra ? await this.resolverObra(auth, args.obra) : null;
    if (args.obra && !obra) {
      return { erro: 'Obra não encontrada ou sem acesso.' };
    }
    const selecionadas = obra
      ? acessiveis.filter((o) => o.id === obra.id)
      : acessiveis;
    if (!selecionadas.length) return { erro: 'Nenhuma obra acessível.' };

    const idsCompletos = selecionadas
      .filter((o) => !rdoSoAprovados(permRdo(o)))
      .map((o) => o.id);
    const idsAprovados = selecionadas
      .filter((o) => rdoSoAprovados(permRdo(o)))
      .map((o) => o.id);
    const orClauses: Array<Record<string, unknown>> = [];
    if (idsCompletos.length) orClauses.push({ obraId: { in: idsCompletos } });
    if (idsAprovados.length) {
      orClauses.push({
        obraId: { in: idsAprovados },
        status: RdoStatus.APROVADO,
      });
    }
    if (!orClauses.length) return { erro: 'Nenhuma obra acessível.' };

    const rdos = await this.prisma.rdo.findMany({
      where: {
        OR: orClauses,
        obra: { empresaId: auth.empresaId, deletedAt: null },
        dataReferencia: { gte: dataInicio, lte: dataFim },
        deletedAt: null,
      },
      include: {
        obra: { select: { id: true, nome: true } },
        efetivos: { where: { deletedAt: null } },
        atividades: { where: { deletedAt: null } },
        tarefas: true,
      },
      orderBy: { dataReferencia: 'asc' },
      take: 200,
    });

    const ctx = agregarRdosParaContexto({
      rdos,
      escopo: obra ? 'obra' : 'empresa',
      obraId: obra?.id,
      obraNome: obra?.nome,
      dataInicio,
      dataFim,
      periodoLabel: inferido.label,
    });
    return {
      resumo: formatarContextoParaPrompt(ctx),
      totais: {
        totalRdos: ctx.totalRdos,
        aprovados: ctx.aprovados,
        submetidos: ctx.submetidos,
        rascunhos: ctx.rascunhos,
        rejeitados: ctx.rejeitados,
        diasChuva: ctx.diasChuva,
        datasChuva: ctx.datasChuva,
        mediaEfetivo: ctx.mediaEfetivo,
      },
      telaAtualObraId: telaObraId || null,
    };
  }

  private async listarCatalogo(auth: LunaAuth, args: Record<string, any>) {
    const tipoRaw = String(args.tipo || '').toUpperCase();
    const tipo = (['MATERIAL', 'EQUIPAMENTO', 'MAO_DE_OBRA'] as const).includes(
      tipoRaw as TipoInsumo,
    )
      ? (tipoRaw as TipoInsumo)
      : undefined;
    const items = await this.catalogo.findAll(auth.empresaId, tipo);
    const busca = String(args.busca || '').toLowerCase().trim();
    const filtrados = busca
      ? items.filter(
          (i) =>
            i.nome.toLowerCase().includes(busca) ||
            String(i.codigo || '').toLowerCase().includes(busca),
        )
      : items;
    return {
      total: filtrados.length,
      itens: filtrados.slice(0, 80).map((i) => ({
        tipo: i.tipo,
        nome: i.nome,
        unidade: i.unidade,
        codigo: i.codigo,
        ativo: i.ativo,
      })),
    };
  }

  private async listarEquipe(auth: LunaAuth) {
    const caps = await this.caps(auth);
    const pode =
      auth.perfilGlobal === 'SUPER_ADMIN' ||
      auth.perfilGlobal === 'GESTOR' ||
      caps.gerenciarUsuarios;
    if (!pode) {
      return {
        erro:
          'Sem permissão para ver a equipe. Peça ao gestor ou use Equipe no menu se o seu perfil liberar.',
      };
    }
    const users = await this.prisma.usuario.findMany({
      where: { empresaId: auth.empresaId, deletedAt: null },
      select: {
        nome: true,
        email: true,
        perfilGlobal: true,
        ativo: true,
        userObraRole: {
          select: { obra: { select: { nome: true, status: true } } },
        },
      },
      orderBy: { nome: 'asc' },
      take: 80,
    });
    return {
      total: users.length,
      usuarios: users.map((u) => ({
        nome: u.nome,
        email: u.email,
        perfil: u.perfilGlobal,
        ativo: u.ativo,
        obras: u.userObraRole.map((r) => r.obra?.nome).filter(Boolean),
      })),
    };
  }

  private async listarEfetivo(auth: LunaAuth, ref?: string | null) {
    const obra = await this.resolverObra(auth, ref);
    if (!obra) return { erro: 'Informe a obra (nome) para ver o efetivo do canteiro.' };
    try {
      const cols = await this.obraService.listarColaboradores(
        obra.id,
        auth.empresaId,
      );
      const lista = Array.isArray(cols) ? cols.slice(0, 80) : cols;
      return { obra: { id: obra.id, nome: obra.nome }, colaboradores: lista };
    } catch (err: any) {
      return { erro: err?.message || 'Não foi possível listar o efetivo.' };
    }
  }

  private async listarAlertas(auth: LunaAuth, ref?: string) {
    const acessiveis = await this.listarObras(auth);
    let obraIds = acessiveis.obras.map((o) => o.id);
    if (ref) {
      const obra = await this.resolverObra(auth, ref);
      if (!obra) return { erro: 'Obra não encontrada.', items: [] };
      obraIds = [obra.id];
    }
    const desde = new Date();
    desde.setDate(desde.getDate() - 30);
    const items = await this.prisma.alertaObra.findMany({
      where: {
        obraId: { in: obraIds },
        lido: false,
        createdAt: { gte: desde },
        obra: { empresaId: auth.empresaId, deletedAt: null },
      },
      include: { obra: { select: { nome: true } } },
      orderBy: { createdAt: 'desc' },
      take: 40,
    });
    return {
      total: items.length,
      items: items.map((a) => ({
        id: a.id,
        tipo: a.tipo,
        mensagem: a.mensagem,
        obra: a.obra?.nome,
        createdAt: a.createdAt,
      })),
    };
  }

  private async verPlano(auth: LunaAuth) {
    const caps = await this.caps(auth);
    const pode =
      auth.perfilGlobal === 'SUPER_ADMIN' ||
      auth.perfilGlobal === 'GESTOR' ||
      caps.gerenciarFinanceiro;
    if (!pode) {
      return {
        erro:
          'Sem permissão financeira. Quem gerencia o plano vê isso em Meu Plano (/assinatura).',
      };
    }
    const [modulos, cobrancas] = await Promise.all([
      this.prisma.tenantModulo.findMany({
        where: { empresaId: auth.empresaId, ativo: true },
        include: { modulo: { select: { slug: true, nome: true } } },
      }),
      this.prisma.cobranca.findMany({
        where: {
          empresaId: auth.empresaId,
          status: { in: ['PENDENTE', 'VENCIDO', 'OVERDUE'] },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          valor: true,
          status: true,
          createdAt: true,
        },
      }),
    ]);
    return {
      modulos: modulos.map((m) => ({
        slug: m.modulo.slug,
        nome: m.modulo.nome,
        expiresAt: m.expiresAt,
      })),
      cobrancasPendentes: cobrancas,
    };
  }
}
