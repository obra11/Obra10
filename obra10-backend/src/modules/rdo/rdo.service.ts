import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { RdoStatus, StatusExecucaoTarefa } from '@prisma/client';

/**
 * Versão atual do schema JSON do dadosExtras.
 * Incrementar quando a estrutura do DiarioDeObra mudar.
 */
const DADOS_EXTRAS_VERSAO = 1;

/** Estrutura mínima obrigatória do JSON do Diário de Obra. */
interface DadosExtrasMinimos {
  versao: number;
  data: string; // ISO date string (YYYY-MM-DD)
}

function validarDadosExtras(dados: any): dados is DadosExtrasMinimos {
  if (!dados || typeof dados !== 'object') return false;
  if (typeof dados.versao !== 'number') return false;
  if (!dados.data || typeof dados.data !== 'string') return false;
  return true;
}

@Injectable()
export class RdoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  // ===================== LEITURA / SETUP =====================
  async getSetupInfo(obraId: string) {
    const obra = await this.prisma.obra.findUnique({
      where: { id: obraId },
      select: { nome: true },
    });
    if (!obra) throw new NotFoundException('Obra não encontrada');

    const count = await this.prisma.rdo.count({ where: { obraId } });

    return {
      obraNome: obra.nome,
      nextSequencial: count + 1,
    };
  }

  async findAllByObra(obraId: string) {
    return this.prisma.rdo.findMany({
      where: { obraId, deletedAt: null },
      select: {
        id: true,
        obraId: true,
        criadorId: true,
        aprovadorId: true,
        dataReferencia: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        aprovadorNome: true,
        rejeitadoMotivo: true,
        submissaoAt: true,
        aprovacaoAt: true,
        // Exclui dadosExtras (JSON pesado) da listagem
        criador: { select: { id: true, nome: true } },
        tarefas: true,
      },
      orderBy: { dataReferencia: 'desc' },
    });
  }

  async findOne(id: string, obraId: string) {
    const rdo = await this.prisma.rdo.findFirst({
      where: { id, obraId, deletedAt: null },
      include: {
        atividades: { where: { deletedAt: null } },
        efetivos: { where: { deletedAt: null } },
        ocorrencias: { where: { deletedAt: null } },
        tarefas: true,
        criador: { select: { id: true, nome: true, email: true } },
        aprovador: { select: { id: true, nome: true, email: true } },
        obra: { select: { id: true, nome: true } },
      },
    });
    if (!rdo) throw new NotFoundException('RDO não encontrado.');
    return rdo;
  }

  // ===================== BLOQUEAR EDIÇÃO SE IMUTÁVEL =====================
  private async getRdoBlockChecked(rdoId: string, obraId: string) {
    const rdo = await this.prisma.rdo.findFirst({
      where: { id: rdoId, obraId, deletedAt: null },
    });
    if (!rdo) throw new NotFoundException('RDO não encontrado.');
    if (
      rdo.status === RdoStatus.APROVADO ||
      rdo.status === RdoStatus.REJEITADO
    ) {
      throw new ForbiddenException(
        `RDO imutável — status atual: ${rdo.status}. Apenas RDOs em RASCUNHO ou EM_PREENCHIMENTO podem ser editados.`,
      );
    }
    if (rdo.status === RdoStatus.SUBMETIDO) {
      throw new ForbiddenException(
        'RDO submetido aguarda aprovação. Solicite rejeição para editar novamente.',
      );
    }
    return rdo;
  }

  // ===================== CRUD RDO BASE =====================
  async create(obraId: string, criadorId: string, dataParams: any) {
    const rawDate = dataParams.dataReferencia ?? dataParams.data;
    if (!rawDate)
      throw new BadRequestException('Campo dataReferencia é obrigatório.');
    const dataRef = new Date(rawDate);
    if (isNaN(dataRef.getTime()))
      throw new BadRequestException(
        'dataReferencia inválida — use formato YYYY-MM-DD.',
      );

    const existe = await this.prisma.rdo.findFirst({
      where: { obraId, dataReferencia: dataRef, deletedAt: null },
    });
    if (existe)
      throw new BadRequestException(
        'Já existe um RDO aberto para esta data nesta obra.',
      );

    const dadosExtras = dataParams.dadosExtras ?? null;
    if (dadosExtras && !validarDadosExtras(dadosExtras)) {
      throw new BadRequestException(
        'dadosExtras inválido: campos obrigatórios (versao, data) ausentes.',
      );
    }

    return this.prisma.rdo.create({
      data: {
        obraId,
        criadorId,
        dataReferencia: dataRef,
        status: RdoStatus.RASCUNHO,
        dadosExtras: dadosExtras
          ? { ...dadosExtras, versao: DADOS_EXTRAS_VERSAO }
          : undefined,
      },
    });
  }

  // ===================== SALVAR RASCUNHO COMPLETO (PUT /rdos/:id/rascunho) =====================
  async saveRascunho(rdoId: string, obraId: string, payload: any) {
    await this.getRdoBlockChecked(rdoId, obraId);

    const dadosExtras = payload.dadosExtras;
    if (!dadosExtras)
      throw new BadRequestException(
        'Campo dadosExtras é obrigatório para salvar o rascunho.',
      );
    if (!validarDadosExtras(dadosExtras)) {
      throw new BadRequestException(
        'dadosExtras inválido: campos obrigatórios (versao, data) ausentes.',
      );
    }

    // Injetar versão canônica para garantir compatibilidade futura
    const extrasVersioned = { ...dadosExtras, versao: DADOS_EXTRAS_VERSAO };

    return this.prisma.rdo.update({
      where: { id: rdoId },
      data: {
        dadosExtras: extrasVersioned,
        status: RdoStatus.EM_PREENCHIMENTO,
      },
    });
  }

  // ===================== REGISTROS FILHOS (ATIVIDADES, EFETIVOS, OCORRÊNCIAS) =====================
  async addAtividade(
    rdoId: string,
    obraId: string,
    criadorId: string,
    dto: any,
  ) {
    await this.getRdoBlockChecked(rdoId, obraId);
    return this.prisma.rdoAtividade.create({
      data: {
        rdoId,
        criadorId,
        descricao: dto.descricao,
        frenteServico: dto.frenteServico,
      },
    });
  }

  async addEfetivo(rdoId: string, obraId: string, criadorId: string, dto: any) {
    await this.getRdoBlockChecked(rdoId, obraId);
    return this.prisma.rdoEfetivo.create({
      data: {
        rdoId,
        criadorId,
        empresaTerceira: dto.empresaTerceira,
        funcaoCargo: dto.funcaoCargo,
        quantidade: Number(dto.quantidade),
      },
    });
  }

  async addOcorrencia(
    rdoId: string,
    obraId: string,
    criadorId: string,
    dto: any,
  ) {
    await this.getRdoBlockChecked(rdoId, obraId);
    return this.prisma.rdoOcorrencia.create({
      data: {
        rdoId,
        criadorId,
        tipoOcorrencia: dto.tipoOcorrencia,
        descricao: dto.descricao,
        horasPerdidas: dto.horasPerdidas ? Number(dto.horasPerdidas) : null,
      },
    });
  }

  // ===================== TAREFAS COM MOTIVO DE NÃO EXECUÇÃO =====================
  async addTarefa(
    rdoId: string,
    obraId: string,
    criadoPorId: string,
    dto: any,
  ) {
    await this.getRdoBlockChecked(rdoId, obraId);
    return this.prisma.tarefaRdo.create({
      data: {
        rdoId,
        criadoPorId,
        descricao: dto.descricao,
        frenteServico: dto.frenteServico,
        statusExecucao: dto.statusExecucao ?? StatusExecucaoTarefa.EXECUTADO,
        motivoNaoExecucao: dto.motivoNaoExecucao ?? null,
        motivoTexto: dto.motivoTexto ?? null,
        horasExecutadas: dto.horasExecutadas
          ? Number(dto.horasExecutadas)
          : null,
      },
    });
  }

  async updateTarefa(
    rdoId: string,
    tarefaId: string,
    obraId: string,
    dto: any,
  ) {
    await this.getRdoBlockChecked(rdoId, obraId);
    const tarefa = await this.prisma.tarefaRdo.findFirst({
      where: { id: tarefaId, rdoId },
    });
    if (!tarefa)
      throw new NotFoundException('Tarefa não encontrada neste RDO.');

    return this.prisma.tarefaRdo.update({
      where: { id: tarefaId },
      data: {
        descricao: dto.descricao ?? tarefa.descricao,
        frenteServico: dto.frenteServico ?? tarefa.frenteServico,
        statusExecucao: dto.statusExecucao ?? tarefa.statusExecucao,
        motivoNaoExecucao: dto.motivoNaoExecucao ?? tarefa.motivoNaoExecucao,
        motivoTexto: dto.motivoTexto ?? tarefa.motivoTexto,
        horasExecutadas:
          dto.horasExecutadas !== undefined
            ? Number(dto.horasExecutadas)
            : tarefa.horasExecutadas,
      },
    });
  }

  // ===================== PROFISSIONAIS RECENTES (por obra + usuário) =====================
  async getRecentProfissionais(obraId: string, usuarioId: string) {
    const rdoIds = await this.prisma.rdo.findMany({
      where: { obraId, deletedAt: null },
      select: { id: true },
    });
    const ids = rdoIds.map((r) => r.id);

    const recentes = await this.prisma.rdoEfetivo.findMany({
      where: { rdoId: { in: ids }, criadorId: usuarioId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { funcaoCargo: true, empresaTerceira: true },
    });

    const seen = new Set<string>();
    return recentes
      .filter((r) => {
        const k = `${r.empresaTerceira}:${r.funcaoCargo}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .slice(0, 10);
  }

  // ===================== FLUXO DE APROVAÇÃO EXPANDIDO =====================
  private validateTarefasMotivoAntesDe(tarefas: any[]) {
    const pendentes = tarefas.filter(
      (t) =>
        (t.statusExecucao === StatusExecucaoTarefa.NAO_EXECUTADO ||
          t.statusExecucao === StatusExecucaoTarefa.PARCIAL) &&
        !t.motivoNaoExecucao,
    );
    if (pendentes.length > 0) {
      throw new BadRequestException(
        `${pendentes.length} tarefa(s) marcadas como ${pendentes[0].statusExecucao} sem motivo registrado. Preencha o motivo antes de submeter.`,
      );
    }
  }

  /**
   * Submete o RDO para aprovação.
   * @param aprovadorIdSelecionado - ID do usuário escolhido pelo criador como aprovador.
   *        Se não fornecido, mantém o campo aprovadorId atual (ou null).
   */
  async submeter(
    id: string,
    obraId: string,
    userObraRole: any,
    aprovadorIdSelecionado?: string,
  ) {
    const rdo = await this.prisma.rdo.findFirst({
      where: { id, obraId, deletedAt: null },
      include: {
        tarefas: true,
        criador: { select: { id: true, nome: true, email: true } },
        obra: { select: { nome: true } },
      },
    });
    if (!rdo) throw new NotFoundException('RDO não encontrado.');
    if (
      rdo.status !== RdoStatus.RASCUNHO &&
      rdo.status !== RdoStatus.EM_PREENCHIMENTO
    ) {
      throw new BadRequestException(
        `Não é possível submeter RDO no status: ${rdo.status}`,
      );
    }

    this.validateTarefasMotivoAntesDe(rdo.tarefas);

    // Determinar aprovador a ser notificado
    const aprovadorId = aprovadorIdSelecionado ?? rdo.aprovadorId ?? null;
    let aprovadorInfo: { nome: string; email: string } | null = null;
    if (aprovadorId) {
      aprovadorInfo = (await this.prisma.usuario.findUnique({
        where: { id: aprovadorId },
        select: { nome: true, email: true },
      })) as any;
    }

    const rdoAtualizado = await this.prisma.rdo.update({
      where: { id },
      data: {
        status: RdoStatus.SUBMETIDO,
        submissaoAt: new Date(),
        ...(aprovadorId ? { aprovadorId } : {}),
      },
    });

    // Disparar e-mail de notificação ao aprovador (sem bloquear fluxo)
    if (aprovadorInfo) {
      const dataFormatada = rdo.dataReferencia.toISOString().split('T')[0];
      this.email
        .sendAprovacaoRdoPendente(
          aprovadorInfo.email,
          aprovadorInfo.nome,
          rdo.criador.nome,
          rdo.obra.nome,
          dataFormatada,
          obraId,
          id,
        )
        .catch((err) =>
          console.error(
            '[RdoService] Falha ao enviar e-mail de aprovação pendente:',
            err,
          ),
        );
    }

    return rdoAtualizado;
  }

  async aprovar(
    id: string,
    obraId: string,
    userObraRole: any,
    aprovadorId: string,
  ) {
    if (userObraRole.perfilId < 3) {
      throw new ForbiddenException(
        'Apenas gestores/engenheiros (perfil 3+) podem APROVAR um RDO.',
      );
    }

    const rdo = await this.prisma.rdo.findUnique({
      where: { id },
      include: { criador: true },
    });
    if (!rdo || rdo.obraId !== obraId)
      throw new NotFoundException('RDO inválido.');
    if (rdo.status !== RdoStatus.SUBMETIDO) {
      throw new BadRequestException(
        `RDO precisa estar SUBMETIDO para aprovação. Status atual: ${rdo.status}`,
      );
    }

    const aprovador = await this.prisma.usuario.findUnique({
      where: { id: aprovadorId },
      select: { nome: true },
    });
    return this.prisma.rdo.update({
      where: { id },
      data: {
        status: RdoStatus.APROVADO,
        aprovadorId,
        aprovadorNome: aprovador?.nome ?? 'Desconhecido',
        aprovacaoAt: new Date(),
      },
    });
  }

  async rejeitar(
    id: string,
    obraId: string,
    userObraRole: any,
    aprovadorId: string,
    motivo: string,
  ) {
    if (userObraRole.perfilId < 3) {
      throw new ForbiddenException(
        'Apenas gestores/engenheiros podem REJEITAR um RDO.',
      );
    }
    if (!motivo?.trim())
      throw new BadRequestException('Motivo de rejeição é obrigatório.');

    const rdo = await this.prisma.rdo.findUnique({
      where: { id },
      include: { criador: { select: { email: true, nome: true } } },
    });
    if (!rdo || rdo.obraId !== obraId)
      throw new NotFoundException('RDO inválido.');
    if (rdo.status !== RdoStatus.SUBMETIDO) {
      throw new BadRequestException(
        `RDO precisa estar SUBMETIDO para ser rejeitado. Status atual: ${rdo.status}`,
      );
    }

    // Liberação para reedição — retorna ao RASCUNHO c/ motivo registrado
    const rdoAtualizado = await this.prisma.rdo.update({
      where: { id },
      data: {
        status: RdoStatus.REJEITADO,
        rejeitadoMotivo: motivo,
      },
    });

    // Notifica o criador do motivo da rejeição
    try {
      await this.email.sendRejeicaoRdo(
        rdo.criador.email,
        rdo.criador.nome,
        rdo.dataReferencia.toISOString().split('T')[0],
        motivo,
      );
    } catch (e) {
      console.error('[RdoService] Falha ao enviar e-mail de rejeição:', e);
    }

    return rdoAtualizado;
  }

  // ===================== REVISAR (reabrir após rejeição) =====================
  async revisar(id: string, obraId: string) {
    const rdo = await this.prisma.rdo.findFirst({
      where: { id, obraId, deletedAt: null },
    });
    if (!rdo) throw new NotFoundException('RDO não encontrado.');
    if (rdo.status !== RdoStatus.REJEITADO) {
      throw new BadRequestException(
        'Apenas RDOs REJEITADOS podem ser reabertos para revisão.',
      );
    }
    return this.prisma.rdo.update({
      where: { id },
      data: { status: RdoStatus.RASCUNHO, rejeitadoMotivo: null },
    });
  }

  // ===================== STATS PARA DASHBOARD =====================
  async getStats(obraId: string, dataInicio?: string, dataFim?: string) {
    const inicio = dataInicio
      ? new Date(dataInicio)
      : (() => {
          const d = new Date();
          d.setDate(d.getDate() - 30);
          return d;
        })();
    const fim = dataFim ? new Date(dataFim) : new Date();

    const rdos = await this.prisma.rdo.findMany({
      where: {
        obraId,
        deletedAt: null,
        dataReferencia: { gte: inicio, lte: fim },
      },
      include: { tarefas: true, efetivos: { where: { deletedAt: null } } },
      orderBy: { dataReferencia: 'asc' },
      take: 500,
    });

    const totalRdos = rdos.length;
    const rdosAprovados = rdos.filter(
      (r) => r.status === RdoStatus.APROVADO,
    ).length;
    const todasTarefas = rdos.flatMap((r) => r.tarefas);
    const totalTarefas = todasTarefas.length;
    const tarefasExecutadas = todasTarefas.filter(
      (t) => t.statusExecucao === StatusExecucaoTarefa.EXECUTADO,
    ).length;

    const motivoMap: Record<string, number> = {};
    todasTarefas
      .filter((t) => t.motivoNaoExecucao)
      .forEach((t) => {
        const m = String(t.motivoNaoExecucao);
        motivoMap[m] = (motivoMap[m] ?? 0) + 1;
      });
    const motivosNaoExecucao = Object.entries(motivoMap)
      .map(([motivo, total]) => ({ motivo, total }))
      .sort((a, b) => b.total - a.total);

    const funcaoMap: Record<string, number> = {};
    rdos
      .flatMap((r) => r.efetivos)
      .forEach((e) => {
        funcaoMap[e.funcaoCargo] =
          (funcaoMap[e.funcaoCargo] ?? 0) + e.quantidade;
      });
    const horasPorFuncao = Object.entries(funcaoMap)
      .map(([funcao, horas]) => ({ funcao, horas }))
      .sort((a, b) => b.horas - a.horas)
      .slice(0, 10);

    const semanaMap: Record<
      string,
      { executadas: number; naoExecutadas: number }
    > = {};
    rdos.forEach((r) => {
      const semana = this.getSemanaLabel(r.dataReferencia);
      if (!semanaMap[semana])
        semanaMap[semana] = { executadas: 0, naoExecutadas: 0 };
      r.tarefas.forEach((t) => {
        if (t.statusExecucao === StatusExecucaoTarefa.EXECUTADO)
          semanaMap[semana].executadas += 1;
        else semanaMap[semana].naoExecutadas += 1;
      });
    });
    const execucaoPorSemana = Object.entries(semanaMap).map(([semana, v]) => ({
      semana,
      ...v,
    }));

    return {
      totalRdos,
      rdosAprovados,
      totalTarefas,
      tarefasExecutadas,
      motivosNaoExecucao,
      horasPorFuncao,
      execucaoPorSemana,
    };
  }

  private getSemanaLabel(date: Date): string {
    const d = new Date(date);
    d.setDate(d.getDate() - d.getDay() + 1);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  }
}
