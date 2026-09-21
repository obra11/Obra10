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
import {
  limiteObrasDoPacote,
  PLAN_LIMITS,
  planoDoPacote,
  precoModuloPorPacote,
  resolvePacoteObras,
  type PacoteObras,
} from './pacotes-obras';
import {
  apenasDigitos,
  erroAsaasSemDocumento,
  normalizarDocumentoFiscal,
} from '../../core/utils/documento-fiscal';

const PLANO_PRECOS: Record<string, number> = {};

export interface ContratarDto {
  empresaId: string;
  modulosSelecionados: string[];
  formaPagamento: 'PIX' | 'CARTAO';
  periodicidade?: 'MENSAL' | 'ANUAL';
  pacoteObras?: PacoteObras;
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
    const pacoteObras = resolvePacoteObras(dto.pacoteObras);

    // Preço absoluto por plano (Básico/Pro/Enterprise) cadastrado no módulo
    const valorBase = modulos.reduce(
      (sum, m) => sum + precoModuloPorPacote(m as any, pacoteObras, periodicidade),
      0,
    );

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
    const slugsKey = [...dto.modulosSelecionados]
      .map((s) => String(s || '').trim())
      .filter(Boolean)
      .sort()
      .join('+');
    const idempotencyKey = `${dto.empresaId}-${pacoteObras}-${periodicidade}-${mesRef.toISOString().slice(0, 7)}-${slugsKey}`;
    const modulosSlugs = dto.modulosSelecionados;

    // Persist package + plano (Básico/Pro/Enterprise) on empresa at contract time
    const plano = planoDoPacote(pacoteObras);
    await this.prisma.empresa.update({
      where: { id: dto.empresaId },
      data: {
        pacoteObras,
        limiteObras: limiteObrasDoPacote(pacoteObras),
        plano: plano as any,
        limiteUsuarios: PLAN_LIMITS[plano],
      },
    });

    const existente = await this.prisma.cobranca.findUnique({
      where: { idempotencyKey },
    });
    if (existente) {
      if (existente.status === 'PAGO') {
        await this.ativarModulos(dto.empresaId, modulosSlugs, periodicidade);
        return {
          cobrancaId: existente.id,
          formaPagamento: existente.formaPagamento,
          valor: Number(existente.valor || 0),
          status: 'PAGO',
          periodicidade,
          pacoteObras,
          mensagem: 'Estes módulos já foram pagos neste período.',
        };
      }
      return {
        cobrancaId: existente.id,
        formaPagamento: existente.formaPagamento || 'PIX',
        valor: Number(existente.valor || 0),
        status: existente.status,
        periodicidade,
        pacoteObras,
        qrCode: existente.qrCode,
        qrCodeBase64: existente.qrCodeBase64,
        linkPagamento: existente.linkPagamento,
        mensagem: 'Há um PIX em aberto para estes módulos. Conclua o pagamento.',
      };
    }

    // Sempre sincroniza o CPF/CNPJ no cliente Asaas. Reusar só o id salvo
    // deixava a cobrança falhar quando o cliente existia sem documento.
    let idAsaasCliente = '';
    if (!pularAsaas && valor > 0) {
      idAsaasCliente = await this.resolverClienteAsaas(empresa);
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
          pacoteObras,
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
        pacoteObras,
        mensagem: 'Módulos ativados com sucesso! Cupom de desconto aplicado.',
      };
    }

    if (dto.formaPagamento === 'CARTAO' && !dto.tokenCartao) {
      const card = await this.asaas.gerarCobrancaCartao({
        idAsaasCliente,
        valor: Math.max(valor, 0.01),
        vencimento: vencimento.toISOString().split('T')[0],
        descricao: `OBRA 10 ${pacoteObras} ${periodicidade} — ${modulos.map((m) => m.slug).join(', ')}`,
      });

      cobranca = await this.prisma.cobranca.create({
        data: {
          empresaId: dto.empresaId,
          valor,
          status: 'PENDENTE',
          formaPagamento: 'CARTAO',
          periodicidade,
          pacoteObras,
          modulosSlugs,
          mesReferencia: mesRef,
          dataVencimento: vencimento,
          linkPagamento: card.linkPagamento,
          idAsaas: card.id,
          idempotencyKey,
        },
      });

      return {
        cobrancaId: cobranca.id,
        formaPagamento: 'CARTAO',
        valor,
        periodicidade,
        pacoteObras,
        linkPagamento: card.linkPagamento,
        mensagem: 'Abra o link da Asaas para pagar com cartão. Os módulos ativam ao confirmar.',
      };
    }

    if (dto.formaPagamento === 'PIX' || !dto.tokenCartao) {
      const pix = await this.gerarPixComDocumento(empresa, idAsaasCliente, {
        valor: Math.max(valor, 0.01),
        vencimento: vencimento.toISOString().split('T')[0],
        descricao: `OBRA 10 ${pacoteObras} ${periodicidade} — ${modulos.map((m) => m.slug).join(', ')}`,
      });

      cobranca = await this.prisma.cobranca.create({
        data: {
          empresaId: dto.empresaId,
          valor,
          status: 'PENDENTE',
          formaPagamento: 'PIX',
          periodicidade,
          pacoteObras,
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
        pacoteObras,
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
        pacoteObras,
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
      pacoteObras,
      status: card.status,
    };
  }

  // ===================== CONFIRMAR PAGAMENTO (WEBHOOK) =====================
  async confirmarPagamento(idAsaas: string, paymentPayload?: any) {
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
    if (cobranca.status !== 'PAGO') {
      await this.processarPagamentoLocal(cobranca);
    }
    await this.enriquecerCobrancaAsaas(cobranca.id, idAsaas, paymentPayload);
  }

  /** Atualiza líquido/taxas e agenda NFS-e quando configurado. */
  async enriquecerCobrancaAsaas(
    cobrancaId: string,
    idAsaas: string,
    paymentPayload?: any,
  ) {
    const cobranca = await this.prisma.cobranca.findUnique({
      where: { id: cobrancaId },
    });
    if (!cobranca) return;

    let value = Number(cobranca.valor);
    let netValue: number | null = null;
    let statusAsaas: string | null = null;

    if (paymentPayload) {
      if (paymentPayload.value != null) value = Number(paymentPayload.value);
      if (paymentPayload.netValue != null && paymentPayload.netValue !== '') {
        netValue = Number(paymentPayload.netValue);
      }
      if (paymentPayload.status) statusAsaas = String(paymentPayload.status);
    }

    if (netValue == null || statusAsaas == null) {
      const info = await this.asaas.buscarPagamento(idAsaas);
      if (info) {
        if (info.value > 0) value = info.value;
        if (info.netValue != null) netValue = info.netValue;
        statusAsaas = info.status || statusAsaas;
      }
    }

    const taxaAsaas =
      netValue != null ? Math.round((value - netValue) * 100) / 100 : null;

    const dataUpdate: Record<string, unknown> = {};
    if (netValue != null) dataUpdate.valorLiquido = netValue;
    if (taxaAsaas != null) dataUpdate.taxaAsaas = taxaAsaas;
    if (statusAsaas) dataUpdate.statusAsaas = statusAsaas;

    if (Object.keys(dataUpdate).length > 0) {
      await this.prisma.cobranca.update({
        where: { id: cobrancaId },
        data: dataUpdate,
      });
    }

    // NFS-e automática (se habilitada e ainda sem nota)
    if (
      this.asaas.nfEnabled &&
      !cobranca.idNotaAsaas &&
      cobranca.formaPagamento !== 'BONIFICACAO'
    ) {
      const invoice = await this.asaas.agendarNotaFiscal({
        paymentId: idAsaas,
        valor: value,
      });
      if (invoice) {
        await this.prisma.cobranca.update({
          where: { id: cobrancaId },
          data: {
            idNotaAsaas: invoice.id,
            statusNota: invoice.status,
            notaPdfUrl: invoice.pdfUrl || null,
            notaXmlUrl: invoice.xmlUrl || null,
          },
        });
      }
    }
  }

  async processarWebhookNota(invoice: any) {
    if (!invoice?.id) return;
    const paymentId = invoice.payment;
    if (!paymentId) {
      this.logger.warn(`Invoice ${invoice.id} sem payment associado`);
      return;
    }
    const cobranca = await this.prisma.cobranca.findUnique({
      where: { idAsaas: paymentId },
    });
    if (!cobranca) {
      this.logger.warn(
        `Cobrança não encontrada para NF payment=${paymentId} invoice=${invoice.id}`,
      );
      return;
    }
    await this.prisma.cobranca.update({
      where: { id: cobranca.id },
      data: {
        idNotaAsaas: invoice.id,
        statusNota: invoice.status || cobranca.statusNota,
        notaPdfUrl: invoice.pdfUrl || cobranca.notaPdfUrl,
        notaXmlUrl: invoice.xmlUrl || cobranca.notaXmlUrl,
      },
    });
  }

  /** Backfill líquido/taxas/NF para cobranças PAGO com idAsaas. */
  async sincronizarAsaasFinanceiro(limit = 50) {
    const items = await this.prisma.cobranca.findMany({
      where: {
        status: 'PAGO',
        idAsaas: { not: null },
        NOT: { formaPagamento: 'BONIFICACAO' },
        OR: [
          { valorLiquido: null },
          { idNotaAsaas: null },
          { notaPdfUrl: null },
        ],
      },
      take: Math.min(100, Math.max(1, limit)),
      orderBy: { dataPagamento: 'desc' },
    });

    let atualizados = 0;
    for (const c of items) {
      if (!c.idAsaas || c.idAsaas.startsWith('mock-')) continue;
      try {
        await this.enriquecerCobrancaAsaas(c.id, c.idAsaas);
        if (c.idNotaAsaas && !c.notaPdfUrl) {
          const inv = await this.asaas.buscarNotaFiscal(c.idNotaAsaas);
          if (inv) {
            await this.prisma.cobranca.update({
              where: { id: c.id },
              data: {
                statusNota: inv.status,
                notaPdfUrl: inv.pdfUrl || null,
                notaXmlUrl: inv.xmlUrl || null,
              },
            });
          }
        }
        atualizados += 1;
      } catch (err: any) {
        this.logger.warn(
          `Sync Asaas falhou cobranca=${c.id}: ${err?.message || err}`,
        );
      }
    }
    return { processados: items.length, atualizados };
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

  private decryptSafe(value?: string | null): string {
    if (!value) return '';
    try {
      return this.cryptoService.decrypt(value) || '';
    } catch {
      return '';
    }
  }

  resolverDocumentoEmpresa(empresa: {
    cpfCnpj?: string | null;
    cnpj?: string | null;
  }): string {
    const decCpf = this.decryptSafe(empresa.cpfCnpj);
    const decCnpj = this.decryptSafe(empresa.cnpj);
    return decCpf || decCnpj || '';
  }

  async resolverClienteAsaas(
    empresa: {
      id: string;
      idAsaas?: string | null;
      cpfCnpj?: string | null;
      cnpj?: string | null;
      razaoSocial?: string | null;
      nomeCompleto?: string | null;
      email?: string | null;
      telefone?: string | null;
    },
    opts?: { forceNew?: boolean },
  ): Promise<string> {
    const bruto = this.resolverDocumentoEmpresa(empresa);
    const documento = normalizarDocumentoFiscal(bruto);
    if (documento && documento !== apenasDigitos(bruto)) {
      await this.prisma.empresa.update({
        where: { id: empresa.id },
        data: {
          cpfCnpj: this.cryptoService.encrypt(documento),
          tipoPessoa: documento.length === 11 ? 'FISICA' : 'JURIDICA',
          idAsaas: null,
        },
      });
      empresa.cpfCnpj = this.cryptoService.encrypt(documento);
      empresa.idAsaas = null;
    }

    const id = await this.asaas.garantirClienteAsaas(
      opts?.forceNew ? '' : empresa.idAsaas,
      {
        cpfCnpj: documento,
        razaoSocial: empresa.razaoSocial || undefined,
        nomeCompleto: empresa.nomeCompleto || undefined,
        email: empresa.email || '',
        telefone: empresa.telefone || undefined,
        empresaId: empresa.id,
      },
    );
    if (id !== (empresa.idAsaas || '')) {
      await this.prisma.empresa.update({
        where: { id: empresa.id },
        data: { idAsaas: id },
      });
    }
    return id;
  }

  private async gerarPixComDocumento(
    empresa: {
      id: string;
      idAsaas?: string | null;
      cpfCnpj?: string | null;
      cnpj?: string | null;
      razaoSocial?: string | null;
      nomeCompleto?: string | null;
      email?: string | null;
      telefone?: string | null;
    },
    idAsaasCliente: string,
    dto: { valor: number; vencimento: string; descricao?: string },
  ) {
    try {
      const pix = await this.asaas.gerarCobrancaPix({
        idAsaasCliente,
        ...dto,
      });
      return { ...pix, idAsaasCliente };
    } catch (err: any) {
      const raw =
        typeof err?.getResponse === 'function' ? err.getResponse() : err?.response?.data;
      const msg = Array.isArray(raw?.message)
        ? raw.message.join(' ')
        : String(raw?.message || raw || err?.message || '');
      if (!erroAsaasSemDocumento(msg)) throw err;

      this.logger.warn(
        `Asaas cobrou sem documento no cliente ${idAsaasCliente} — recriando`,
      );
      const novoId = await this.resolverClienteAsaas(empresa, { forceNew: true });
      const pix = await this.asaas.gerarCobrancaPix({
        idAsaasCliente: novoId,
        ...dto,
      });
      return { ...pix, idAsaasCliente: novoId };
    }
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

  /** Libera ou devolve o checkout de cartão Asaas de uma cobrança pendente. */
  async garantirLinkCartao(cobrancaId: string, empresaId: string) {
    const cobranca = await this.prisma.cobranca.findUnique({
      where: { id: cobrancaId },
      include: { empresa: true },
    });
    if (!cobranca) throw new NotFoundException('Cobrança não encontrada.');
    if (cobranca.empresaId !== empresaId) {
      throw new ForbiddenException('Acesso negado.');
    }
    if (cobranca.status === 'PAGO') {
      throw new BadRequestException('Esta cobrança já está paga.');
    }

    let link = cobranca.linkPagamento || '';
    let idAsaas = cobranca.idAsaas || '';

    if (idAsaas && !idAsaas.startsWith('mock-')) {
      try {
        const atualizado = await this.asaas.liberarCartaoNoPagamento(idAsaas);
        link = atualizado.linkPagamento || link;
        idAsaas = atualizado.id || idAsaas;
      } catch {
        idAsaas = '';
      }
    }

    if (!link || !idAsaas || idAsaas.startsWith('mock-')) {
      const idCliente = await this.resolverClienteAsaas(cobranca.empresa);
      const card = await this.asaas.gerarCobrancaCartao({
        idAsaasCliente: idCliente,
        valor: Math.max(Number(cobranca.valor), 0.01),
        vencimento: cobranca.dataVencimento.toISOString().split('T')[0],
        descricao: 'OBRA 10 — Pagamento com cartão',
      });
      link = card.linkPagamento;
      idAsaas = card.id;
    }

    if (!link) {
      throw new BadRequestException(
        'A Asaas não devolveu o link de cartão. Tente novamente em instantes.',
      );
    }

    await this.prisma.cobranca.update({
      where: { id: cobranca.id },
      data: {
        formaPagamento: 'CARTAO',
        linkPagamento: link,
        idAsaas,
      },
    });

    return { linkPagamento: link, cobrancaId: cobranca.id };
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

  async confirmarPagamentoManualAdmin(
    cobrancaId: string,
    adminUsuarioId: string,
    tipoConfirmacao: 'PAGAMENTO' | 'BONIFICACAO' = 'PAGAMENTO',
  ) {
    const cobranca = await this.prisma.cobranca.findUnique({
      where: { id: cobrancaId },
      include: {
        empresa: { include: { tenantModulos: { include: { modulo: true } } } },
      },
    });
    if (!cobranca) throw new NotFoundException('Cobrança não encontrada.');
    if (cobranca.status === 'PAGO') return { success: true };

    const isBonificacao = tipoConfirmacao === 'BONIFICACAO';
    const formaPagamento = isBonificacao ? 'BONIFICACAO' : 'MANUAL';
    const acaoAudit = isBonificacao
      ? 'PAGAMENTO_CONFIRMADO_BONIFICACAO'
      : 'PAGAMENTO_CONFIRMADO_MANUAL';

    await this.prisma.cobranca.update({
      where: { id: cobrancaId },
      data: {
        status: 'PAGO',
        dataPagamento: new Date(),
        formaPagamento,
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
        acao: acaoAudit,
        cargaAntiga: JSON.stringify({ status: cobranca.status }),
        cargaNova: JSON.stringify({
          status: 'PAGO',
          formaPagamento,
          tipoConfirmacao,
          suspensa: false,
          diasInadimplente: 0,
        }),
      },
    });

    // E-mail só para pagamento real (bonificação não é receita)
    const empresa = cobranca.empresa;
    if (!isBonificacao && empresa.email) {
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
      `✅ ${isBonificacao ? 'Bonificação' : 'Pagamento manual'} confirmado por admin (${adminUsuarioId}) para empresa ${cobranca.empresaId}`,
    );

    return { success: true, formaPagamento, tipoConfirmacao };
  }
}
