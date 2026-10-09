import { randomBytes, randomUUID } from 'crypto';
import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CapabilitiesService } from '../../core/capabilities/capabilities.service';
import { RdoService } from '../rdo/rdo.service';
import { CatalogoService } from '../catalogo/catalogo.service';
import { UsuariosService } from '../usuarios/usuarios.service';
import type { LunaAuth } from './luna-tools.service';

const TIPOS = new Set([
  'rdo_rascunho',
  'rdo_submeter',
  'rdo_aprovar',
  'rdo_rejeitar',
  'catalogo_criar',
  'catalogo_atualizar',
  'equipe_criar',
  'equipe_atualizar',
  'equipe_papel',
]);

const TTL_MS = 15 * 60 * 1000;

type Pendente = {
  id: string;
  userId: string;
  empresaId: string;
  tipo: string;
  payload: Record<string, any>;
  resumo: string;
  expiresAt: number;
};

@Injectable()
export class LunaAcoesService {
  private readonly pendentes = new Map<string, Pendente>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly capabilities: CapabilitiesService,
    private readonly rdo: RdoService,
    private readonly catalogo: CatalogoService,
    private readonly usuarios: UsuariosService,
  ) {}

  async propor(auth: LunaAuth, args: Record<string, any>) {
    const tipo = String(args?.tipo || '').trim();
    if (!TIPOS.has(tipo)) {
      return { gravado: false, erro: 'Tipo de ajuste não permitido.' };
    }
    if (args && Object.prototype.hasOwnProperty.call(args, 'senha')) {
      return {
        gravado: false,
        erro: 'A Luna não define senha. O convite gera uma senha temporária por e-mail.',
      };
    }
    const payload = { ...args };
    delete payload.senha;
    const resumo = await this.resumo(auth, tipo, payload);
    const id = randomUUID();
    this.pendentes.set(id, {
      id,
      userId: auth.userId,
      empresaId: auth.empresaId,
      tipo,
      payload,
      resumo,
      expiresAt: Date.now() + TTL_MS,
    });
    return { pendente: true, gravado: false, id, resumo };
  }

  async cancelar(auth: LunaAuth, id: string) {
    const item = this.pegar(auth, id);
    this.pendentes.delete(item.id);
    return { cancelado: true, gravado: false, resumo: item.resumo };
  }

  async confirmar(auth: LunaAuth, id: string) {
    const item = this.pegar(auth, id);
    this.pendentes.delete(item.id);
    try {
      const resultado = await this.aplicar(auth, item.tipo, item.payload);
      return { gravado: true, resumo: item.resumo, resultado };
    } catch (err) {
      this.pendentes.set(item.id, item);
      throw err;
    }
  }

  private pegar(auth: LunaAuth, id: string): Pendente {
    const item = this.pendentes.get(id);
    if (!item || item.expiresAt < Date.now()) {
      this.pendentes.delete(id);
      throw new BadRequestException('Esse ajuste expirou. Peça de novo para a Luna.');
    }
    if (item.userId !== auth.userId || item.empresaId !== auth.empresaId) {
      throw new ForbiddenException('Esse ajuste não é desta sessão.');
    }
    return item;
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

  private async rdoDaEmpresa(auth: LunaAuth, rdoId: string) {
    const rdo = await this.prisma.rdo.findFirst({
      where: {
        id: rdoId,
        deletedAt: null,
        obra: { empresaId: auth.empresaId, deletedAt: null },
      },
      select: {
        id: true,
        obraId: true,
        status: true,
        dataReferencia: true,
        dadosExtras: true,
        obra: { select: { nome: true } },
      },
    });
    if (!rdo) {
      throw new ForbiddenException('Diário não encontrado nesta empresa.');
    }
    return rdo;
  }

  private async podeEditarDiario(auth: LunaAuth, obraId: string) {
    const caps = await this.caps(auth);
    if (caps.acessoTodasObras && caps.criarEditarRdo) return caps;
    const vinculo = await this.prisma.userObraRole.findFirst({
      where: { usuarioId: auth.userId, obraId },
      select: { permissoes: true },
    });
    const perm =
      (vinculo?.permissoes as Record<string, string> | null)?.RDO ||
      (vinculo?.permissoes as Record<string, string> | null)?.rdo;
    if (perm === 'VIEW' || perm === 'VIEW_APPROVED' || perm === 'VIEW_PARTIAL_APPROVED') {
      throw new ForbiddenException('Você não tem permissão para alterar o diário desta obra.');
    }
    if (!perm && !caps.criarEditarRdo) {
      throw new ForbiddenException('Você não tem permissão para alterar o diário desta obra.');
    }
    return caps;
  }

  private async resumo(auth: LunaAuth, tipo: string, payload: Record<string, any>) {
    if (tipo.startsWith('rdo_')) {
      const rdo = await this.rdoDaEmpresa(auth, String(payload.rdo_id || ''));
      const data = rdo.dataReferencia.toISOString().slice(0, 10);
      if (tipo === 'rdo_rascunho') {
        const oQue = payload.atividade
          ? `incluir a atividade “${payload.atividade}”`
          : payload.observacao
            ? `acrescentar a observação “${payload.observacao}”`
            : 'atualizar o rascunho';
        return `Vou ${oQue} no diário de ${data} da obra ${rdo.obra.nome}.`;
      }
      if (tipo === 'rdo_submeter') {
        return `Vou enviar para aprovação o diário de ${data} da obra ${rdo.obra.nome}.`;
      }
      if (tipo === 'rdo_aprovar') {
        return `Vou aprovar o diário de ${data} da obra ${rdo.obra.nome}.`;
      }
      return `Vou rejeitar o diário de ${data} da obra ${rdo.obra.nome}. Motivo: ${payload.motivo || '(sem motivo)'}.`;
    }
    if (tipo === 'catalogo_criar') {
      return `Vou incluir “${payload.nome}” no Cadastro Base.`;
    }
    if (tipo === 'catalogo_atualizar') {
      return `Vou atualizar o item ${payload.insumo_id} do Cadastro Base.`;
    }
    if (tipo === 'equipe_criar') {
      return `Vou criar o usuário ${payload.nome} (${payload.email}) na equipe.`;
    }
    if (tipo === 'equipe_atualizar') {
      return `Vou atualizar o usuário ${payload.usuario_id} da equipe.`;
    }
    return `Vou atualizar a função ${payload.papel} da equipe.`;
  }

  private async aplicar(auth: LunaAuth, tipo: string, payload: Record<string, any>) {
    const caps = await this.caps(auth);
    const user = { sub: auth.userId, id: auth.userId, perfilGlobal: auth.perfilGlobal };

    if (tipo.startsWith('rdo_')) {
      const rdo = await this.rdoDaEmpresa(auth, String(payload.rdo_id || ''));
      const papel = { capabilities: caps, perfilId: caps.aprovarRdo ? 3 : 0 };
      if (tipo === 'rdo_aprovar' || tipo === 'rdo_rejeitar') {
        if (!caps.aprovarRdo) {
          throw new ForbiddenException('Você não tem permissão para aprovar diários.');
        }
        if (tipo === 'rdo_aprovar') {
          return this.rdo.aprovar(rdo.id, rdo.obraId, papel, auth.userId);
        }
        return this.rdo.rejeitar(
          rdo.id,
          rdo.obraId,
          papel,
          auth.userId,
          String(payload.motivo || ''),
        );
      }
      await this.podeEditarDiario(auth, rdo.obraId);
      if (tipo === 'rdo_submeter') {
        return this.rdo.submeter(rdo.id, rdo.obraId, papel, payload.aprovador_id);
      }
      if (payload.dados_extras) {
        return this.rdo.saveRascunho(
          rdo.id,
          rdo.obraId,
          { dadosExtras: payload.dados_extras },
          user,
        );
      }
      if (payload.observacao) {
        const extras = { ...((rdo.dadosExtras as Record<string, any>) || {}) };
        const prev = extras.observacoes;
        extras.observacoes = Array.isArray(prev)
          ? [...prev, payload.observacao]
          : prev
            ? `${prev}\n${payload.observacao}`
            : payload.observacao;
        await this.rdo.saveRascunho(rdo.id, rdo.obraId, { dadosExtras: extras }, user);
      }
      if (payload.atividade) {
        await this.rdo.addAtividade(rdo.id, rdo.obraId, auth.userId, {
          descricao: String(payload.atividade),
        });
      }
      if (!payload.dados_extras && !payload.observacao && !payload.atividade) {
        throw new BadRequestException('Diga a atividade, a observação ou o conteúdo do rascunho.');
      }
      return { ok: true };
    }

    if (tipo === 'catalogo_criar' || tipo === 'catalogo_atualizar') {
      if (!caps.gerenciarCatalogo) {
        throw new ForbiddenException('Você não tem permissão para alterar o Cadastro Base.');
      }
      if (tipo === 'catalogo_criar') {
        return this.catalogo.create(auth.empresaId, {
          tipo: payload.tipo_insumo,
          nome: payload.nome,
          unidade: payload.unidade,
          codigo: payload.codigo,
          observacao: payload.observacao,
        } as any);
      }
      return this.catalogo.update(String(payload.insumo_id), auth.empresaId, {
        nome: payload.nome,
        unidade: payload.unidade,
        tipo: payload.tipo_insumo,
        observacao: payload.observacao,
      } as any);
    }

    if (!caps.gerenciarUsuarios) {
      throw new ForbiddenException('Você não tem permissão para alterar a equipe.');
    }
    if (tipo === 'equipe_criar') {
      const senha = randomBytes(9).toString('base64url');
      const criado = await this.usuarios.create(auth.empresaId, {
        nome: payload.nome,
        email: payload.email,
        senha,
        perfilGlobal: payload.perfil || 'COLABORADOR',
        telefone: payload.telefone,
      });
      return {
        id: (criado as { id?: string }).id,
        nome: payload.nome,
        email: payload.email,
        aviso: 'Senha temporária enviada por e-mail. Ela não aparece neste chat.',
      };
    }
    if (tipo === 'equipe_atualizar') {
      return this.usuarios.update(auth.empresaId, String(payload.usuario_id), {
        nome: payload.nome,
        telefone: payload.telefone,
        perfilGlobal: payload.perfil,
      });
    }
    return this.usuarios.updatePapel(auth.empresaId, String(payload.papel || ''), {
      nome: payload.nome,
    });
  }
}
