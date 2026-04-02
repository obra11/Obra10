import {
  Injectable, BadRequestException, NotFoundException, ForbiddenException, Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AsaasService } from './asaas.service';
import { EmailService } from '../email/email.service';

const PLANO_PRECOS: Record<string, number> = {};

export interface ContratarDto {
  empresaId: string;
  modulosSelecionados: string[];
  formaPagamento: 'PIX' | 'CARTAO';
  tokenCartao?: string;
}

@Injectable()
export class CobrancaService {
  private readonly logger = new Logger(CobrancaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly asaas: AsaasService,
    private readonly email: EmailService,
  ) {}

  // ===================== CONTRATAR MÓDULOS =====================
  async contratarModulos(dto: ContratarDto) {
    const empresa = await this.prisma.empresa.findUnique({
      where: { id: dto.empresaId },
      include: { cartaoSalvo: true },
    });
    if (!empresa) throw new NotFoundException('Empresa não encontrada.');
    if (!empresa.emailVerificado) throw new ForbiddenException('E-mail não verificado. Verifique sua caixa de entrada.');

    // Load modules with prices from DB
    const modulos = await this.prisma.modulo.findMany({
      where: { slug: { in: dto.modulosSelecionados }, ativo: true },
    });
    if (modulos.length === 0) throw new BadRequestException('Nenhum módulo válido selecionado.');

    // Apply mesGratuito for RDO if first month
    const valor = modulos.reduce((sum, m) => {
      if (empresa.mesGratuito && m.slug === 'RDO') return sum;
      return sum + Number(m.preco);
    }, 0);

    const now = new Date();
    const mesRef = new Date(now.getFullYear(), now.getMonth(), 1);
    const vencimento = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const idempotencyKey = `${dto.empresaId}-${mesRef.toISOString().slice(0, 7)}`;

    // Idempotency check
    const existente = await this.prisma.cobranca.findUnique({ where: { idempotencyKey } });
    if (existente) throw new BadRequestException('Cobrança para este mês já gerada.');

    // Ensure client exists in Asaas
    let idAsaasCliente = empresa.idAsaas;
    if (!idAsaasCliente) {
      idAsaasCliente = await this.asaas.criarClienteAsaas({
        cpfCnpj: empresa.cpfCnpj || empresa.cnpj || '',
        razaoSocial: empresa.razaoSocial || undefined,
        nomeCompleto: empresa.nomeCompleto || undefined,
        email: empresa.email || '',
        telefone: empresa.telefone || undefined,
      });
      await this.prisma.empresa.update({ where: { id: dto.empresaId }, data: { idAsaas: idAsaasCliente } });
    }

    let cobranca: any;

    if (dto.formaPagamento === 'PIX' || !dto.tokenCartao) {
      const pix = await this.asaas.gerarCobrancaPix({
        idAsaasCliente,
        valor: Math.max(valor, 0.01),
        vencimento: vencimento.toISOString().split('T')[0],
        descricao: `OBRA 10 — ${modulos.map(m => m.slug).join(', ')}`,
      });

      cobranca = await this.prisma.cobranca.create({
        data: {
          empresaId: dto.empresaId,
          valor,
          status: 'PENDENTE',
          formaPagamento: 'PIX',
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
        qrCode: pix.qrCode,
        qrCodeBase64: pix.qrCodeBase64,
        linkPagamento: pix.linkPagamento,
        mensagem: 'PIX gerado com sucesso. Pague para ativar os módulos.',
      };
    }

    // CARTÃO
    const card = await this.asaas.cobrarCartaoRecorrente({
      idAsaasCliente,
      tokenCartao: dto.tokenCartao!,
      valor,
    });

    cobranca = await this.prisma.cobranca.create({
      data: {
        empresaId: dto.empresaId,
        valor,
        status: card.status === 'CONFIRMED' ? 'PAGO' : 'PENDENTE',
        formaPagamento: 'CARTAO',
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
        update: { tokenAsaas: dto.tokenCartao, ultimosDigitos: '****', bandeira: 'VISA' },
        create: { empresaId: dto.empresaId, tokenAsaas: dto.tokenCartao, ultimosDigitos: '****', bandeira: 'VISA' },
      });
    }

    if (card.status === 'CONFIRMED') {
      await this.ativarModulos(dto.empresaId, dto.modulosSelecionados);
      if (empresa.email) {
        await this.email.enviarConfirmacaoPagamento(empresa.email, empresa.razaoSocial || empresa.nomeCompleto || 'Empresa', valor);
      }
    }

    return { cobrancaId: cobranca.id, formaPagamento: 'CARTAO', valor, status: card.status };
  }

  // ===================== CONFIRMAR PAGAMENTO (WEBHOOK) =====================
  async confirmarPagamento(idAsaas: string) {
    const cobranca = await this.prisma.cobranca.findUnique({
      where: { idAsaas },
      include: { empresa: { include: { tenantModulos: { include: { modulo: true } } } } },
    });
    if (!cobranca) {
      this.logger.warn(`Cobrança não encontrada para idAsaas: ${idAsaas}`);
      return;
    }

    await this.prisma.cobranca.update({
      where: { id: cobranca.id },
      data: { status: 'PAGO', dataPagamento: new Date() },
    });

    // Reactivate if suspended + reset delinquency
    await this.prisma.empresa.update({
      where: { id: cobranca.empresaId },
      data: { suspensa: false, diasInadimplente: 0, mesGratuito: false },
    });

    // Activate all tenant modules
    const slugsAtivos = cobranca.empresa.tenantModulos
      .filter(tm => tm.ativo)
      .map(tm => tm.modulo.slug);
    if (slugsAtivos.length > 0) await this.ativarModulos(cobranca.empresaId, slugsAtivos);

    // AuditLog
    await this.prisma.auditLog.create({
      data: {
        empresaId: cobranca.empresaId,
        usuarioId: cobranca.empresaId,
        tabelaAfetada: 'cobrancas',
        registroId: cobranca.id,
        acao: 'PAGAMENTO_CONFIRMADO',
        cargaAntiga: JSON.stringify({ status: 'PENDENTE' }),
        cargaNova: JSON.stringify({ status: 'PAGO', suspensa: false, diasInadimplente: 0 }),
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
    this.logger.log(`✅ Pagamento confirmado para empresa ${cobranca.empresaId}`);
  }

  // ===================== ATIVAR MÓDULOS =====================
  async ativarModulos(empresaId: string, slugs: string[]) {
    const modulos = await this.prisma.modulo.findMany({ where: { slug: { in: slugs } } });
    for (const m of modulos) {
      await this.prisma.tenantModulo.upsert({
        where: { empresaId_moduloId: { empresaId, moduloId: m.id } },
        update: { ativo: true },
        create: { empresaId, moduloId: m.id, ativo: true },
      });
    }
  }

  // ===================== STATUS DE COBRANÇA (seguro) =====================
  async getStatus(cobrancaId: string, empresaId?: string): Promise<{ id: string; status: string; pago: boolean }> {
    const cobranca = await this.prisma.cobranca.findUnique({ where: { id: cobrancaId } });
    if (!cobranca) throw new NotFoundException('Cobrança não encontrada.');
    if (empresaId && cobranca.empresaId !== empresaId) throw new ForbiddenException('Acesso negado.');
    return { id: cobranca.id, status: cobranca.status, pago: cobranca.status === 'PAGO' };
  }

  // ===================== LISTAR COBRANÇAS (paginado) =====================
  async listarCobrancas(empresaId: string, page = 1, limit = 12) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.cobranca.findMany({
        where: { empresaId },
        orderBy: { mesReferencia: 'desc' },
        skip, take: limit,
        select: {
          id: true, status: true, formaPagamento: true,
          valor: true, mesReferencia: true, dataVencimento: true,
          dataPagamento: true, linkPagamento: true,
        },
      }),
      this.prisma.cobranca.count({ where: { empresaId } }),
    ]);
    return { items, total, page, pages: Math.ceil(total / limit) };
  }
}
