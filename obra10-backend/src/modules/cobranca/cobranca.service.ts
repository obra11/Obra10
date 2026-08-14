import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AsaasService } from './asaas.service';
import { EmailService } from '../email/email.service';
import { CupomService } from '../cupom/cupom.service';
import { CryptoService } from '../../core/services/crypto.service';

const PLANO_PRECOS: Record<string, number> = {};

export interface ContratarDto {
  empresaId: string;
  modulosSelecionados: string[];
  formaPagamento: 'PIX' | 'CARTAO';
  periodicidade?: 'MENSAL' | 'ANUAL';
  tokenCartao?: string;
  cupom?: string;
}

@Injectable()
export class CobrancaService {
  private readonly logger = new Logger(CobrancaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly asaas: AsaasService,
    private readonly email: EmailService,
    private readonly cupomService: CupomService,
    private readonly cryptoService: CryptoService,
  ) {}

  // ===================== CONTRATAR MÓDULOS =====================
  async contratarModulos(dto: ContratarDto) {
    const empresa = await this.prisma.empresa.findUnique({
      where: { id: dto.empresaId },
      include: { cartaoSalvo: true },
    });
    if (!empresa) throw new NotFoundException('Empresa não encontrada.');
    if (!empresa.emailVerificado)
      throw new ForbiddenException(
        'E-mail não verificado. Verifique sua caixa de entrada.',
      );

    // Load modules with prices from DB
    const modulos = await this.prisma.modulo.findMany({
      where: { slug: { in: dto.modulosSelecionados }, ativo: true },
    });
    if (modulos.length === 0)
      throw new BadRequestException('Nenhum módulo válido selecionado.');

    const periodicidade = dto.periodicidade === 'ANUAL' ? 'ANUAL' : 'MENSAL';

    // Calculate base price from modules (mensal ou anual)
    const valorBase = modulos.reduce((sum, m) => {
      const mensal = Number(m.preco);
      const anual = Number((m as any).precoAnual || 0);
      if (periodicidade === 'ANUAL') {
        return sum + (anual > 0 ? anual : mensal * 11);
      }
      return sum + mensal;
    }, 0);

    // Apply coupon if provided
    let cupomAplicado: string | null = null;
    let valorFinal = valorBase;
    let pularAsaas = false;

    if (dto.cupom) {
      // Validate + apply coupon to empresa
      await this.cupomService.aplicarCupom(dto.cupom, dto.empresaId);
      const desconto = await this.cupomService.calcularDesconto(
        dto.empresaId,
        valorBase,
      );
      valorFinal = desconto.valorFinal;
      pularAsaas = desconto.pularAsaas;
      cupomAplicado = desconto.cupomAplicado;

      // Increment first month usage
      await this.cupomService.incrementarMesEExpirar(dto.empresaId);
    }

    const valor = valorFinal;

    const now = new Date();
    const mesRef = new Date(now.getFullYear(), now.getMonth(), 1);
    const vencimento = new Date(now.getFullYear(), now.getMonth() + 1, 5);
    const idempotencyKey = `${dto.empresaId}-${periodicidade}-${mesRef.toISOString().slice(0, 7)}`;
    const modulosSlugs = dto.modulosSelecionados;

    // Idempotency check
    const existente = await this.prisma.cobranca.findUnique({
      where: { idempotencyKey },
    });
    if (existente)
      throw new BadRequestException(
        periodicidade === 'ANUAL'
          ? 'Cobrança anual para este período já gerada.'
          : 'Cobrança para este mês já gerada.',
      );

    // Ensure client exists in Asaas (decrypting document first to send plaintext to Asaas API)
    let idAsaasCliente: string = empresa.idAsaas || '';
    if (!idAsaasCliente && !pularAsaas) {
      const decCpfCnpj = empresa.cpfCnpj ? this.cryptoService.decrypt(empresa.cpfCnpj) : '';
      const decCnpj = empresa.cnpj ? this.cryptoService.decrypt(empresa.cnpj) : '';
      idAsaasCliente = await this.asaas.criarClienteAsaas({
        cpfCnpj: decCpfCnpj || decCnpj || '',
        razaoSocial: empresa.razaoSocial || undefined,
        nomeCompleto: empresa.nomeCompleto || undefined,
        email: empresa.email || '',
        telefone: empresa.telefone || undefined,
      });
      await this.prisma.empresa.update({
        where: { id: dto.empresaId },
        data: { idAsaas: idAsaasCliente },
      });
    }

    let cobranca: any;

    // If coupon zeroes the value, activate modules directly and skip Asaas
    if (pularAsaas || valor <= 0) {
      cobranca = await this.prisma.cobranca.create({
        data: {
          empresaId: dto.empresaId,
          valor: 0,
          status: 'PAGO',
          formaPagamento: dto.formaPagamento,
          periodicidade,
          modulosSlugs,
          mesReferencia: mesRef,
          dataVencimento: vencimento,
          dataPagamento: new Date(),
          idempotencyKey,
        },
      });
      await this.ativarModulos(dto.empresaId, modulosSlugs, periodicidade);
      this.logger.log(
        `🎟️ Contratação grátis via cupom ${cupomAplicado} para empresa ${dto.empresaId}`,
      );
      return {
        cobrancaId: cobranca.id,
        formaPagamento: dto.formaPagamento,
        valor: 0,
        cupomAplicado,
        status: 'PAGO',
        periodicidade,
        mensagem: 'Módulos ativados com sucesso! Cupom de desconto aplicado.',
      };
    }

    if (dto.formaPagamento === 'PIX' || !dto.tokenCartao) {
      const pix = await this.asaas.gerarCobrancaPix({
        idAsaasCliente,
        valor: Math.max(valor, 0.01),
        vencimento: vencimento.toISOString().split('T')[0],
        descricao: `OBRA 10 ${periodicidade} — ${modulos.map((m) => m.slug).join(', ')}`,
      });

      cobranca = await this.prisma.cobranca.create({
        data: {
          empresaId: dto.empresaId,
          valor,
          status: 'PENDENTE',
          formaPagamento: 'PIX',
          periodicidade,
          modulosSlugs,
          mesReferencia: mesRef,
          dataVencimento: vencimento,
          linkPagamento: pix.linkPagamento,
          qrCode: pix.qrCode,
          qrCodeBase64: pix.qrCodeBase64,
          idAsaas: pix.id,
          idempotencyKey,
        },
      });

      // Send PIX email
      if (empresa.email) {
        await this.email.enviarLinkPix(
          empresa.email,
          empresa.razaoSocial || empresa.nomeCompleto || 'Empresa',
          valor,
          pix.linkPagamento,
          pix.qrCodeBase64,
        );
      }

      return {
        cobrancaId: cobranca.id,
        formaPagamento: 'PIX',
        valor,
        periodicidade,
        qrCode: pix.qrCode,
        qrCodeBase64: pix.qrCodeBase64,
        linkPagamento: pix.linkPagamento,
        mensagem: 'PIX gerado com sucesso. Pague para ativar os módulos.',
      };
    }

    // CARTÃO
    const card = await this.asaas.cobrarCartaoRecorrente({
      idAsaasCliente,
      tokenCartao: dto.tokenCartao,
      valor,
    });

    cobranca = await this.prisma.cobranca.create({
      data: {
        empresaId: dto.empresaId,
        valor,
        status: card.status === 'CONFIRMED' ? 'PAGO' : 'PENDENTE',
        formaPagamento: 'CARTAO',
        periodicidade,
        modulosSlugs,
        mesReferencia: mesRef,
        dataVencimento: vencimento,
        dataPagamento: card.status === 'CONFIRMED' ? new Date() : null,
        idAsaas: card.id,
        idempotencyKey,
      },
    });

    // Save card token
    if (dto.tokenCartao) {
      await this.prisma.cartaoSalvo.upsert({
        where: { empresaId: dto.empresaId },
        update: {
          tokenAsaas: dto.tokenCartao,
          ultimosDigitos: '****',
          bandeira: 'VISA',
        },
        create: {
          empresaId: dto.empresaId,
          tokenAsaas: dto.tokenCartao,
          ultimosDigitos: '****',
          bandeira: 'VISA',
        },
      });
    }

    if (card.status === 'CONFIRMED') {
      await this.ativarModulos(dto.empresaId, modulosSlugs, periodicidade);
      if (empresa.email) {
        await this.email.enviarConfirmacaoPagamento(
          empresa.email,
          empresa.razaoSocial || empresa.nomeCompleto || 'Empresa',
          valor,
        );
      }
    }

    return {
      cobrancaId: cobranca.id,
      formaPagamento: 'CARTAO',
      valor,
      periodicidade,
      status: card.status,
    };
  }

  // ===================== CONFIRMAR PAGAMENTO (WEBHOOK) =====================
  async confirmarPagamento(idAsaas: string) {
    const cobranca = await this.prisma.cobranca.findUnique({
      where: { idAsaas },
      include: {
        empresa: { include: { tenantModulos: { include: { modulo: true } } } },
      },
    });
    if (!cobranca) {
      this.logger.warn(`Cobrança não encontrada para idAsaas: ${idAsaas}`);
      return;
    }
    await this.processarPagamentoLocal(cobranca);
  }

  // Confirmação chamada pelo frontend após sucesso no PayPal SDK
  async confirmarPagamentoLocal(cobrancaId: string, empresaId: string) {
    const cobranca = await this.prisma.cobranca.findUnique({
      where: { id: cobrancaId },
      include: {
        empresa: { include: { tenantModulos: { include: { modulo: true } } } },
      },
    });
    if (!cobranca) throw new NotFoundException('Cobrança não encontrada.');
    if (cobranca.empresaId !== empresaId) throw new ForbiddenException('Acesso negado.');
    if (cobranca.status === 'PAGO') return { success: true }; // Idempotent

    await this.processarPagamentoLocal(cobranca, 'PAYPAL');
    return { success: true };
  }

  private async processarPagamentoLocal(cobranca: any, formaPagamento?: string) {

    await this.prisma.cobranca.update({
      where: { id: cobranca.id },
      data: {
        status: 'PAGO',
        dataPagamento: new Date(),
        ...(formaPagamento ? { formaPagamento } : {}),
      },
    });

    // Reactivate if suspended + reset delinquency
    await this.prisma.empresa.update({
      where: { id: cobranca.empresaId },
      data: { suspensa: false, diasInadimplente: 0 },
    });

    // Ativa módulos desta contratação (primeira compra / renovação anual).
    // Cobrança mensal recorrente (sem modulosSlugs) só reativa a empresa.
    const slugs = cobranca.modulosSlugs || [];
    const periodicidade =
      cobranca.periodicidade === 'ANUAL' ? 'ANUAL' : 'MENSAL';
    if (slugs.length > 0) {
      await this.ativarModulos(cobranca.empresaId, slugs, periodicidade);
    }

    // AuditLog
    await this.prisma.auditLog.create({
      data: {
        empresaId: cobranca.empresaId,
        usuarioId: cobranca.empresaId,
        tabelaAfetada: 'cobrancas',
        registroId: cobranca.id,
        acao: 'PAGAMENTO_CONFIRMADO',
        cargaAntiga: JSON.stringify({ status: 'PENDENTE' }),
        cargaNova: JSON.stringify({
          status: 'PAGO',
          suspensa: false,
          diasInadimplente: 0,
        }),
      },
    });

    // Email
    const empresa = cobranca.empresa;
    if (empresa.email) {
      await this.email.enviarConfirmacaoPagamento(
        empresa.email,
        empresa.razaoSocial || empresa.nomeCompleto || 'Empresa',
        Number(cobranca.valor),
      );
    }
    this.logger.log(
      `✅ Pagamento confirmado para empresa ${cobranca.empresaId}`,
    );
  }

  // ===================== ATIVAR MÓDULOS =====================
  async ativarModulos(
    empresaId: string,
    slugs: string[],
    periodicidade: 'MENSAL' | 'ANUAL' = 'MENSAL',
  ) {
    const modulos = await this.prisma.modulo.findMany({
      where: { slug: { in: slugs } },
    });
    const expiresAt =
      periodicidade === 'ANUAL'
        ? new Date(new Date().setFullYear(new Date().getFullYear() + 1))
        : null;

    for (const m of modulos) {
      await this.prisma.tenantModulo.upsert({
        where: { empresaId_moduloId: { empresaId, moduloId: m.id } },
        update: {
          ativo: true,
          periodicidade,
          ...(expiresAt ? { expiresAt } : { expiresAt: null }),
          dataContratacao: new Date(),
        },
        create: {
          empresaId,
          moduloId: m.id,
          ativo: true,
          periodicidade,
          expiresAt,
        },
      });
    }
  }

  // ===================== STATUS DE COBRANÇA (seguro) =====================
  async getStatus(
    cobrancaId: string,
    empresaId?: string,
  ): Promise<{ id: string; status: string; pago: boolean }> {
    const cobranca = await this.prisma.cobranca.findUnique({
      where: { id: cobrancaId },
    });
    if (!cobranca) throw new NotFoundException('Cobrança não encontrada.');
    if (empresaId && cobranca.empresaId !== empresaId)
      throw new ForbiddenException('Acesso negado.');
    return {
      id: cobranca.id,
      status: cobranca.status,
      pago: cobranca.status === 'PAGO',
    };
  }

  // ===================== LISTAR COBRANÇAS (paginado) =====================
  async listarCobrancas(empresaId: string, page = 1, limit = 12) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.cobranca.findMany({
        where: { empresaId },
        orderBy: { mesReferencia: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          status: true,
          formaPagamento: true,
          valor: true,
          mesReferencia: true,
          dataVencimento: true,
          dataPagamento: true,
          linkPagamento: true,
        },
      }),
      this.prisma.cobranca.count({ where: { empresaId } }),
    ]);
    return { items, total, page, pages: Math.ceil(total / limit) };
  }

  async obterCobranca(id: string, empresaId: string) {
    const cobranca = await this.prisma.cobranca.findUnique({
      where: { id },
    });
    if (!cobranca) throw new NotFoundException('Cobrança não encontrada.');
    if (cobranca.empresaId !== empresaId) {
      throw new ForbiddenException('Acesso negado.');
    }
    return cobranca;
  }

  async aplicarCupomCobranca(cobrancaId: string, codigo: string, empresaId: string) {
    const cobranca = await this.prisma.cobranca.findUnique({
      where: { id: cobrancaId },
      include: { empresa: true },
    });
    if (!cobranca) throw new NotFoundException('Cobrança não encontrada.');
    if (cobranca.empresaId !== empresaId) {
      throw new ForbiddenException('Acesso negado. A cobrança não pertence à sua empresa.');
    }
    if (cobranca.status === 'PAGO') {
      throw new BadRequestException('Esta cobrança já está paga.');
    }

    // Validar e aplicar o cupom para a empresa
    await this.cupomService.aplicarCupom(codigo, empresaId);

    // Calcular o desconto
    const valorBase = Number(cobranca.valor);
    const desconto = await this.cupomService.calcularDesconto(empresaId, valorBase);

    const novoValor = desconto.valorFinal;
    const pularAsaas = desconto.pularAsaas;

    if (pularAsaas || novoValor <= 0) {
      // Se zerou, ativa os módulos e marca como paga
      await this.prisma.cobranca.update({
        where: { id: cobrancaId },
        data: {
          valor: 0,
          status: 'PAGO',
          dataPagamento: new Date(),
        },
      });

      // Ativar módulos da construtora
      const tenantModulos = await this.prisma.tenantModulo.findMany({
        where: { empresaId, ativo: true },
        include: { modulo: true },
      });
      const slugsAtivos = tenantModulos.map((tm) => tm.modulo.slug);
      if (slugsAtivos.length > 0) {
        await this.ativarModulos(empresaId, slugsAtivos);
      }

      await this.prisma.empresa.update({
        where: { id: empresaId },
        data: { suspensa: false, diasInadimplente: 0 },
      });

      // Incrementar meses e expirar o cupom
      await this.cupomService.incrementarMesEExpirar(empresaId);

      return {
        success: true,
        status: 'PAGO',
        valor: 0,
        mensagem: 'Cupom de 100% aplicado! Cobrança quitada com sucesso.',
      };
    } else {
      // Se apenas reduziu, atualiza o valor da cobrança local
      await this.prisma.cobranca.update({
        where: { id: cobrancaId },
        data: { valor: novoValor },
      });

      // Incrementar meses e expirar o cupom
      await this.cupomService.incrementarMesEExpirar(empresaId);

      return {
        success: true,
        status: 'PENDENTE',
        valor: novoValor,
        mensagem: `Cupom aplicado! Valor da cobrança reduzido para R$ ${novoValor.toFixed(2)}.`,
      };
    }
  }

  async confirmarPagamentoManualAdmin(cobrancaId: string, adminUsuarioId: string) {
    const cobranca = await this.prisma.cobranca.findUnique({
      where: { id: cobrancaId },
      include: {
        empresa: { include: { tenantModulos: { include: { modulo: true } } } },
      },
    });
    if (!cobranca) throw new NotFoundException('Cobrança não encontrada.');
    if (cobranca.status === 'PAGO') return { success: true };

    // Set status to PAGO, dataPagamento to new Date() and formaPagamento to MANUAL
    await this.prisma.cobranca.update({
      where: { id: cobrancaId },
      data: {
        status: 'PAGO',
        dataPagamento: new Date(),
        formaPagamento: 'MANUAL',
      },
    });

    // Reactivate if suspended + reset delinquency
    await this.prisma.empresa.update({
      where: { id: cobranca.empresaId },
      data: { suspensa: false, diasInadimplente: 0 },
    });

    // Activate modules from this charge when available
    const slugs =
      cobranca.modulosSlugs?.length > 0
        ? cobranca.modulosSlugs
        : cobranca.empresa.tenantModulos
            .filter((tm) => tm.ativo)
            .map((tm) => tm.modulo.slug);
    const periodicidade =
      cobranca.periodicidade === 'ANUAL' ? 'ANUAL' : 'MENSAL';
    if (slugs.length > 0) {
      await this.ativarModulos(cobranca.empresaId, slugs, periodicidade);
    }

    // AuditLog
    await this.prisma.auditLog.create({
      data: {
        empresaId: cobranca.empresaId,
        usuarioId: adminUsuarioId,
        tabelaAfetada: 'cobrancas',
        registroId: cobranca.id,
        acao: 'PAGAMENTO_CONFIRMADO_MANUAL',
        cargaAntiga: JSON.stringify({ status: cobranca.status }),
        cargaNova: JSON.stringify({
          status: 'PAGO',
          formaPagamento: 'MANUAL',
          suspensa: false,
          diasInadimplente: 0,
        }),
      },
    });

    // Email
    const empresa = cobranca.empresa;
    if (empresa.email) {
      try {
        await this.email.enviarConfirmacaoPagamento(
          empresa.email,
          empresa.razaoSocial || empresa.nomeCompleto || 'Empresa',
          Number(cobranca.valor),
        );
      } catch (err: any) {
        this.logger.error(`Falha ao enviar e-mail de confirmação: ${err.message}`);
      }
    }
    this.logger.log(
      `✅ Pagamento manual confirmado por admin (${adminUsuarioId}) para empresa ${cobranca.empresaId}`,
    );

    return { success: true };
  }
}
