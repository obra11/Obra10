import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Req,
  Res,
  UseGuards,
  Query,
  Headers,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CobrancaService } from './cobranca.service';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { Response } from 'express';
import { ContratarModulosDto } from './dto/cobranca.dto';
import { PaypalService } from './paypal.service';

// Loaded at runtime — MUST be set in .env. Empty = reject all webhook calls.
const ASAAS_WEBHOOK_TOKEN = process.env.ASAAS_WEBHOOK_TOKEN?.trim() || '';

@Controller()
export class CobrancaController {
  private readonly logger = new Logger(CobrancaController.name);

  constructor(
    private readonly cobrancaService: CobrancaService,
    private readonly prisma: PrismaService,
    private readonly paypal: PaypalService,
  ) {}

  // GET /modulos moved to ModulosController (src/modules/modulos/modulos.controller.ts)
  // It now returns the full catalog with grupo, sigla, versao, submodulos, etc.

  // GET /cobrancas/modulos-ativos — returns only tenant's ACTIVE modules (for billing re-activation)
  @UseGuards(JwtAuthGuard)
  @Get('cobrancas/modulos-ativos')
  async modulosAtivos(@Req() req: any) {
    const empresaId = req.user?.empresaId;
    if (!empresaId) throw new ForbiddenException('Tenant não identificado.');
    const tenantModulos = await this.prisma.tenantModulo.findMany({
      where: { empresaId, ativo: true },
      include: { modulo: { select: { slug: true, nome: true, preco: true } } },
    });
    return tenantModulos.map((tm) => ({
      slug: tm.modulo.slug,
      nome: tm.modulo.nome,
      preco: tm.modulo.preco,
    }));
  }

  // POST /cobrancas/contratar — protected
  @UseGuards(JwtAuthGuard)
  @Post('cobrancas/contratar')
  async contratar(@Body() dto: ContratarModulosDto, @Req() req: any) {
    const empresaId = req.user?.empresaId;
    if (!empresaId) throw new ForbiddenException('Tenant não identificado.');
    return this.cobrancaService.contratarModulos({ ...dto, empresaId });
  }

  // GET /cobrancas/minha-empresa — paginated
  @UseGuards(JwtAuthGuard)
  @Get('cobrancas/minha-empresa')
  async minhaEmpresa(
    @Req() req: any,
    @Query('page') page = '1',
    @Query('limit') limit = '12',
  ) {
    return this.cobrancaService.listarCobrancas(
      req.user.empresaId,
      parseInt(page),
      parseInt(limit),
    );
  }

  // GET /cobrancas/:id/status — safe: only {id, status, pago}
  @UseGuards(JwtAuthGuard)
  @Get('cobrancas/:id/status')
  async status(@Param('id') id: string, @Req() req: any) {
    return this.cobrancaService.getStatus(id, req.user?.empresaId);
  }

  // POST /cobrancas/:id/paypal/create-order
  @UseGuards(JwtAuthGuard)
  @Post('cobrancas/:id/paypal/create-order')
  async createPaypalOrder(@Param('id') cobrancaId: string, @Req() req: any) {
    const status = await this.cobrancaService.getStatus(cobrancaId, req.user.empresaId);
    if (status.pago) throw new BadRequestException('Esta cobrança já está paga.');
    
    // Buscar o valor da cobrança
    const cobranca = await this.prisma.cobranca.findUnique({ where: { id: cobrancaId } });
    if (!cobranca) throw new NotFoundException('Cobrança não encontrada');

    return this.paypal.createOrder(Number(cobranca.valor), cobranca.id);
  }

  // POST /cobrancas/:id/paypal/capture-order
  @UseGuards(JwtAuthGuard)
  @Post('cobrancas/:id/paypal/capture-order')
  async capturePaypalOrder(
    @Param('id') cobrancaId: string,
    @Body('orderId') orderId: string,
    @Req() req: any
  ) {
    const status = await this.cobrancaService.getStatus(cobrancaId, req.user.empresaId);
    if (status.pago) return { success: true };

    const captureResult = await this.paypal.captureOrder(orderId);
    if (captureResult.status === 'COMPLETED') {
      await this.cobrancaService.confirmarPagamentoLocal(cobrancaId, req.user.empresaId);
      return { success: true };
    }
    
    throw new BadRequestException('Pagamento PayPal não foi concluído.');
  }

  // POST /cobrancas/webhook/asaas — PUBLIC, validates header
  @Post('cobrancas/webhook/asaas')
  async webhookAsaas(
    @Headers('asaas-access-token') token: string,
    @Body() body: any,
  ) {
    // Guard 1: env not configured → block all
    if (!ASAAS_WEBHOOK_TOKEN) {
      this.logger.error(
        'ASAAS_WEBHOOK_TOKEN não configurado no .env — webhook bloqueado.',
      );
      throw new ForbiddenException(
        'Webhook não configurado. Defina ASAAS_WEBHOOK_TOKEN no .env',
      );
    }
    // Guard 2: token mismatch
    if (!token || token.trim() !== ASAAS_WEBHOOK_TOKEN) {
      this.logger.warn(
        `Webhook Asaas rejeitado: token inválido (recebido: ${token?.slice(0, 8)}***)`,
      );
      throw new ForbiddenException('Token de webhook inválido.');
    }

    const eventId = body?.id || body?.payment?.id;
    if (!eventId) throw new BadRequestException('Payload inválido.');

    // Save WebhookEvent first (before processing)
    let event: any;
    try {
      event = await this.prisma.webhookEvent.upsert({
        where: { idAsaas: eventId },
        update: { payload: body, tentativas: { increment: 1 } },
        create: { idAsaas: eventId, payload: body },
      });
    } catch (e) {
      this.logger.error('Erro ao salvar WebhookEvent', e);
    }

    // Process
    try {
      if (
        body.event === 'PAYMENT_RECEIVED' ||
        body.event === 'PAYMENT_CONFIRMED'
      ) {
        const idAsaasPayment = body.payment?.id;
        if (idAsaasPayment)
          await this.cobrancaService.confirmarPagamento(idAsaasPayment);
      }

      if (event) {
        await this.prisma.webhookEvent.update({
          where: { id: event.id },
          data: { processado: true, erro: null },
        });
      }
    } catch (err: any) {
      this.logger.error(`Falha ao processar webhook ${eventId}`, err.message);
      if (event) {
        await this.prisma.webhookEvent.update({
          where: { id: event.id },
          data: { processado: false, erro: err.message },
        });
      }
    }

    return { received: true };
  }
}
