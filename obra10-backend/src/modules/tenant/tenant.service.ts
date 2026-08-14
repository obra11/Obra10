import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { AsaasService } from '../cobranca/asaas.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import axios from 'axios';
import { CryptoService } from '../../core/services/crypto.service';
import {
  DEFAULT_CAPABILITIES_BY_TIPO,
  PAPEL_NOME_PADRAO,
  PAPEIS_COM_DEFAULT_EDITAVEL,
} from '../../core/capabilities/role-capabilities';
import {
  limiteObrasDoPacote,
  pacoteDoPlano,
  PLAN_LIMITS,
  precoComPacote,
  resolvePacoteObras,
  resolvePlano,
} from '../cobranca/pacotes-obras';

// ===================== VALIDATORS =====================
function validarCPF(cpf: string): boolean {
  const d = cpf.replace(/\D/g, '');
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += +d[i] * (10 - i);
  let r = (sum * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  if (r !== +d[9]) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += +d[i] * (11 - i);
  r = (sum * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  return r === +d[10];
}

function validarCNPJ(cnpj: string): boolean {
  const d = cnpj.replace(/\D/g, '');
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const calc = (n: string, weights: number[]) =>
    11 -
    (n
      .split('')
      .slice(0, weights.length)
      .reduce((s, c, i) => s + +c * weights[i], 0) %
      11);
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const d1 = calc(d, w1) >= 10 ? 0 : calc(d, w1);
  const d2 = calc(d, w2) >= 10 ? 0 : calc(d, w2);
  return +d[12] === d1 && +d[13] === d2;
}

async function buscarCEP(cep: string): Promise<any> {
  try {
    const clean = cep.replace(/\D/g, '');
    const { data } = await axios.get(
      `https://viacep.com.br/ws/${clean}/json/`,
      { timeout: 5000 },
    );
    if (data.erro) return null;
    return data;
  } catch {
    return null;
  }
}

@Injectable()
export class TenantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly asaas: AsaasService,
    private readonly cryptoService: CryptoService,
  ) {}

  // ===================== SELF-SERVICE REGISTER (PF/PJ) =====================
  async register(dto: {
    tipoPessoa: 'FISICA' | 'JURIDICA';
    cpfCnpj: string;
    razaoSocial?: string;
    nomeFantasia?: string;
    nomeCompleto?: string;
    email: string;
    telefone?: string;
    cep?: string;
    numero?: string;
    complemento?: string;
    nome: string; // gestor's name
    senha: string;
  }) {
    const cpfCnpjLimpo = dto.cpfCnpj.replace(/\D/g, '');

    // Validate document
    if (dto.tipoPessoa === 'FISICA') {
      if (!validarCPF(cpfCnpjLimpo))
        throw new BadRequestException('CPF inválido.');
    } else {
      if (!validarCNPJ(cpfCnpjLimpo))
        throw new BadRequestException('CNPJ inválido.');
    }

    // Check uniqueness (decrypted comparison in-memory since columns are encrypted using random IVs)
    const todasEmpresas = await this.prisma.empresa.findMany({
      select: { id: true, cpfCnpj: true, cnpj: true, email: true },
    });
    const existe = todasEmpresas.some((emp) => {
      if (emp.email === dto.email) return true;
      const decCpfCnpj = emp.cpfCnpj
        ? this.cryptoService.decrypt(emp.cpfCnpj)
        : null;
      const decCnpj = emp.cnpj
        ? this.cryptoService.decrypt(emp.cnpj)
        : null;
      return decCpfCnpj === cpfCnpjLimpo || decCnpj === cpfCnpjLimpo;
    });
    if (existe)
      throw new ConflictException(
        'CPF/CNPJ ou e-mail já cadastrado no sistema.',
      );

    // Fetch address from CEP
    let endereco: any = {};
    if (dto.cep) {
      const addr = await buscarCEP(dto.cep);
      if (addr) {
        endereco = {
          logradouro: addr.logradouro,
          bairro: addr.bairro,
          cidade: addr.localidade,
          estado: addr.uf,
          cep: dto.cep.replace(/\D/g, ''),
        };
      }
    }

    const senhaHash = await bcrypt.hash(dto.senha, 12);
    const tokenVerificacao = crypto.randomBytes(32).toString('hex');
    const tokenExp = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Create in transaction
    const result = await this.prisma.$transaction(async (tx) => {
      const empresa = await tx.empresa.create({
        data: {
          tipoPessoa: dto.tipoPessoa,
          cpfCnpj: this.cryptoService.encrypt(cpfCnpjLimpo),
          cnpj:
            dto.tipoPessoa === 'JURIDICA'
              ? this.cryptoService.encrypt(cpfCnpjLimpo)
              : undefined,
          razaoSocial: dto.razaoSocial,
          nomeFantasia: dto.nomeFantasia,
          nomeCompleto: dto.nomeCompleto,
          email: dto.email,
          telefone: dto.telefone,
          ...endereco,
          numero: dto.numero,
          complemento: dto.complemento,
          emailVerificado: true, // Auto-verified for dev testing
          tokenVerificacao: null,
          tokenVerificacaoExp: null,
          plano: 'BASICO',
          limiteUsuarios: 5,
        },
      });

      const gestor = await tx.usuario.create({
        data: {
          empresaId: empresa.id,
          nome: dto.nome,
          email: dto.email,
          senhaHash,
          perfilGlobal: 'GESTOR',
          ativo: true,
        },
      });

      // Seed 4 papéis padrão da empresa
      for (const tipo of ['GESTOR', 'COLABORADOR', 'EXTERNO', 'PERSONALIZADO'] as const) {
        const caps = DEFAULT_CAPABILITIES_BY_TIPO[tipo];
        await tx.papelEmpresa.create({
          data: {
            empresaId: empresa.id,
            tipo,
            nome: PAPEL_NOME_PADRAO[tipo],
            capabilities: caps as any,
            permissoesPadrao: caps.modulosPadrao as any,
            editavel: PAPEIS_COM_DEFAULT_EDITAVEL.includes(tipo),
          },
        });
      }

      // Grant RDO free trial module auto-activated for dev testing
      const moduloRdo = await tx.modulo.findUnique({ where: { slug: 'RDO' } });
      if (moduloRdo) {
        await tx.tenantModulo.create({
          data: { empresaId: empresa.id, moduloId: moduloRdo.id, ativo: true }, // auto-activated
        });
        await tx.usuarioModulo.create({
          data: { usuarioId: gestor.id, moduloId: moduloRdo.id },
        });
      }

      return { empresa, gestor };
    });

    // Create Asaas client (background, non-blocking)
    try {
      const idAsaas = await this.asaas.criarClienteAsaas({
        cpfCnpj: cpfCnpjLimpo,
        razaoSocial: dto.razaoSocial,
        nomeCompleto: dto.nomeCompleto,
        email: dto.email,
        telefone: dto.telefone,
      });
      await this.prisma.empresa.update({
        where: { id: result.empresa.id },
        data: { idAsaas },
      });
    } catch {
      /* Non-fatal */
    }

    // Send verification email
    const nomeExibicao = dto.razaoSocial || dto.nomeCompleto || dto.nome;
    await this.email.enviarVerificacaoEmail(
      dto.email,
      tokenVerificacao,
      nomeExibicao,
    );

    return {
      mensagem: 'Cadastro realizado! Verifique seu e-mail para ativar a conta.',
      empresaId: result.empresa.id,
    };
  }

  // ===================== VERIFICAR E-MAIL =====================
  async verificarEmail(token: string) {
    const empresa = await this.prisma.empresa.findUnique({
      where: { tokenVerificacao: token },
    });
    if (!empresa)
      throw new NotFoundException(
        'Token de verificação inválido ou já utilizado.',
      );

    const exp = empresa.tokenVerificacaoExp;
    if (exp && exp < new Date()) {
      throw new BadRequestException(
        'Token expirado. Solicite um novo e-mail de verificação.',
      );
    }

    // Activate email + activate RDO module
    await this.prisma.$transaction([
      this.prisma.empresa.update({
        where: { id: empresa.id },
        data: {
          emailVerificado: true,
          tokenVerificacao: null,
          tokenVerificacaoExp: null,
        },
      }),
      this.prisma.tenantModulo.updateMany({
        where: { empresaId: empresa.id },
        data: { ativo: true },
      }),
    ]);

    // Grant RDO to gestor
    const gestor = await this.prisma.usuario.findFirst({
      where: { empresaId: empresa.id, perfilGlobal: 'GESTOR', deletedAt: null },
    });
    const moduloRdo = await this.prisma.modulo.findUnique({
      where: { slug: 'RDO' },
    });
    if (gestor && moduloRdo) {
      await this.prisma.usuarioModulo.upsert({
        where: {
          usuarioId_moduloId: { usuarioId: gestor.id, moduloId: moduloRdo.id },
        },
        update: {},
        create: { usuarioId: gestor.id, moduloId: moduloRdo.id },
      });
    }

    // Send welcome email
    const nome = empresa.razaoSocial || empresa.nomeCompleto || 'Empresa';
    if (empresa.email) await this.email.enviarBoasVindas(empresa.email, nome);

    return {
      mensagem: 'E-mail verificado com sucesso!',
      redirect: '/contratacao',
    };
  }

  // ===================== REENVIAR VERIFICAÇÃO =====================
  async reenviarVerificacao(email: string) {
    const empresa = await this.prisma.empresa.findFirst({ where: { email } });
    if (!empresa) throw new NotFoundException('E-mail não encontrado.');
    if (empresa.emailVerificado)
      throw new BadRequestException('Este e-mail já foi verificado.');

    const tokenVerificacao = crypto.randomBytes(32).toString('hex');
    const tokenExp = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await this.prisma.empresa.update({
      where: { id: empresa.id },
      data: { tokenVerificacao, tokenVerificacaoExp: tokenExp },
    });

    const nome = empresa.razaoSocial || empresa.nomeCompleto || 'Empresa';
    await this.email.enviarVerificacaoEmail(email, tokenVerificacao, nome);
    return { mensagem: 'E-mail de verificação reenviado.' };
  }

  // ===================== SUPER ADMIN =====================
  async listAll() {
    return this.prisma.empresa.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        cnpj: true,
        cpfCnpj: true,
        razaoSocial: true,
        nomeCompleto: true,
        tipoPessoa: true,
        plano: true,
        ativo: true,
        suspensa: true,
        diasInadimplente: true,
        emailVerificado: true,
        limiteUsuarios: true,
        createdAt: true,
        tenantModulos: {
          include: { modulo: { select: { slug: true, nome: true } } },
        },
        _count: { select: { usuarios: { where: { deletedAt: null } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async setModulos(
    empresaId: string,
    modulos: { slug: string; ativo: boolean; expiresAt?: string }[],
  ) {
    const empresa = await this.prisma.empresa.findUnique({
      where: { id: empresaId },
    });
    if (!empresa) throw new BadRequestException('Empresa não encontrada.');
    const results: any[] = [];
    for (const m of modulos) {
      const modulo = await this.prisma.modulo.findUnique({
        where: { slug: m.slug },
      });
      if (!modulo) continue;
      const record = await this.prisma.tenantModulo.upsert({
        where: { empresaId_moduloId: { empresaId, moduloId: modulo.id } },
        update: {
          ativo: m.ativo,
          expiresAt: m.expiresAt ? new Date(m.expiresAt) : null,
        },
        create: {
          empresaId,
          moduloId: modulo.id,
          ativo: m.ativo,
          expiresAt: m.expiresAt ? new Date(m.expiresAt) : null,
        },
      });
      results.push({ slug: m.slug, ...record });
    }
    return results;
  }

  async updateTenant(empresaId: string, updates: Record<string, any>) {
    const empresa = await this.prisma.empresa.findUnique({
      where: { id: empresaId },
    });
    if (!empresa) throw new BadRequestException('Empresa não encontrada.');
    if (updates.plano && PLAN_LIMITS[updates.plano as keyof typeof PLAN_LIMITS]) {
      const plano = resolvePlano(updates.plano);
      const pacote = pacoteDoPlano(plano);
      updates.limiteUsuarios = PLAN_LIMITS[plano];
      updates.pacoteObras = pacote;
      updates.limiteObras = limiteObrasDoPacote(pacote);
    }
    return this.prisma.empresa.update({
      where: { id: empresaId },
      data: updates,
      select: {
        id: true,
        razaoSocial: true,
        plano: true,
        limiteUsuarios: true,
        pacoteObras: true,
        limiteObras: true,
        ativo: true,
        suspensa: true,
      },
    });
  }

  // ===================== MEU PLANO =====================
  async obterMeuPlano(empresaId: string) {
    const empresa = await this.prisma.empresa.findUnique({
      where: { id: empresaId },
      include: {
        tenantModulos: {
          include: { modulo: true },
        },
        cobrancas: {
          orderBy: { mesReferencia: 'desc' },
        },
        _count: {
          select: { usuarios: { where: { deletedAt: null } } },
        },
      },
    });

    if (!empresa) throw new NotFoundException('Empresa não encontrada.');

    const pacoteObras = resolvePacoteObras((empresa as any).pacoteObras);
    const modulos = empresa.tenantModulos.map((tm) => {
      const mensal = Number(tm.modulo.preco || 0);
      const anualCadastro = Number((tm.modulo as any).precoAnual || 0);
      const anual = anualCadastro > 0 ? anualCadastro : mensal * 11;
      const periodicidade =
        (tm as any).periodicidade === 'ANUAL' ? 'ANUAL' : 'MENSAL';
      const precoBase = periodicidade === 'ANUAL' ? anual : mensal;
      const disponivelNoCatalogo = tm.modulo.ativo !== false;
      const cobravel = tm.ativo && disponivelNoCatalogo;
      const valor = cobravel ? precoComPacote(precoBase, pacoteObras) : 0;
      return {
        nome: tm.modulo.nome,
        slug: tm.modulo.slug,
        ativo: tm.ativo,
        disponivelNoCatalogo,
        expiresAt: tm.expiresAt,
        periodicidade,
        precoTabelaMensal: mensal,
        precoTabelaAnual: anual,
        valor,
      };
    });

    const ativosCobraveis = modulos.filter((m) => m.ativo && m.disponivelNoCatalogo);
    const valorMensal = ativosCobraveis
      .filter((m) => m.periodicidade === 'MENSAL')
      .reduce((s, m) => s + m.valor, 0);
    const valorAnual = ativosCobraveis
      .filter((m) => m.periodicidade === 'ANUAL')
      .reduce((s, m) => s + m.valor, 0);
    const valorPlano = Math.round((valorMensal + valorAnual) * 100) / 100;

    return {
      plano: empresa.plano,
      limiteUsuarios: empresa.limiteUsuarios,
      usuariosAtivos: empresa._count.usuarios,
      pacoteObras,
      limiteObras: (empresa as any).limiteObras ?? 5,
      ativo: empresa.ativo,
      suspensa: empresa.suspensa,
      diasInadimplente: empresa.diasInadimplente,
      createdAt: empresa.createdAt,
      valorPlano,
      valorMensal: Math.round(valorMensal * 100) / 100,
      valorAnual: Math.round(valorAnual * 100) / 100,
      modulos,
      historicoCobrancas: empresa.cobrancas,
    };
  }

  async listarHistoricoCobrancas(
    empresaId: string,
    filtros: { inicio?: string; fim?: string; status?: string } = {},
  ) {
    const where: any = { empresaId };

    if (filtros.status) {
      where.status = filtros.status;
    }

    if (filtros.inicio || filtros.fim) {
      where.mesReferencia = {};
      if (filtros.inicio) {
        const d = new Date(filtros.inicio);
        if (Number.isNaN(d.getTime())) {
          throw new BadRequestException('Data início inválida.');
        }
        where.mesReferencia.gte = new Date(d.getFullYear(), d.getMonth(), 1);
      }
      if (filtros.fim) {
        const d = new Date(filtros.fim);
        if (Number.isNaN(d.getTime())) {
          throw new BadRequestException('Data fim inválida.');
        }
        where.mesReferencia.lte = new Date(
          d.getFullYear(),
          d.getMonth() + 1,
          0,
          23,
          59,
          59,
          999,
        );
      }
    }

    const items = await this.prisma.cobranca.findMany({
      where,
      orderBy: { mesReferencia: 'desc' },
    });

    return {
      total: items.length,
      items,
    };
  }

  async desativarMeuModulo(empresaId: string, moduloSlug: string) {
    const modulo = await this.prisma.modulo.findUnique({
      where: { slug: moduloSlug },
    });
    if (!modulo) throw new NotFoundException('Módulo não encontrado.');

    const tm = await this.prisma.tenantModulo.findUnique({
      where: {
        empresaId_moduloId: { empresaId, moduloId: modulo.id },
      },
    });
    if (!tm) {
      throw new NotFoundException('Este módulo não está vinculado à empresa.');
    }
    if (!tm.ativo) {
      return { success: true, ativo: false };
    }

    await this.prisma.tenantModulo.update({
      where: { id: tm.id },
      data: { ativo: false },
    });

    return { success: true, ativo: false, slug: moduloSlug };
  }

  // ===================== UPGRADE MEU PLANO =====================
  async upgradeMeuPlano(empresaId: string, novoPlano: string) {
    if (!['BASICO', 'PRO', 'ENTERPRISE'].includes(novoPlano)) {
      throw new BadRequestException('Plano inválido.');
    }
    const plano = resolvePlano(novoPlano);

    const empresa = await this.prisma.empresa.findUnique({
      where: { id: empresaId },
    });
    if (!empresa) throw new NotFoundException('Empresa não encontrada.');

    const pacote = pacoteDoPlano(plano);

    return this.prisma.empresa.update({
      where: { id: empresaId },
      data: {
        plano: plano as any,
        limiteUsuarios: PLAN_LIMITS[plano],
        pacoteObras: pacote,
        limiteObras: limiteObrasDoPacote(pacote),
      },
    });
  }

  async getCobrancasPendentes(empresaId: string) {
    return this.prisma.cobranca.findMany({
      where: {
        empresaId,
        status: { in: ['PENDENTE', 'VENCIDO', 'OVERDUE'] }
      },
      orderBy: { dataVencimento: 'asc' },
      select: {
        id: true,
        valor: true,
        status: true,
        dataVencimento: true,
        mesReferencia: true,
        linkPagamento: true,
        notificadoEm: true,
      }
    });
  }
}
