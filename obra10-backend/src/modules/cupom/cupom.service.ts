import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CupomService {
  private readonly logger = new Logger(CupomService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ===================== ADMIN: CRIAR CUPOM =====================
  async criarCupom(dto: {
    codigo: string;
    tipo: 'GRATUIDADE' | 'DESCONTO_FIXO' | 'DESCONTO_PERCENTUAL';
    valor?: number;
    mesesGratuitos?: number;
    duracaoMeses?: number;
    usosMaximos?: number;
    expiraEm?: string;
  }) {
    const codigoUpper = dto.codigo.trim().toUpperCase();

    const existente = await this.prisma.cupomDesconto.findUnique({
      where: { codigo: codigoUpper },
    });
    if (existente)
      throw new BadRequestException(`Cupom "${codigoUpper}" já existe.`);

    // Validate fields per type
    if (dto.tipo === 'GRATUIDADE' && !dto.mesesGratuitos) {
      throw new BadRequestException(
        'Cupom GRATUIDADE requer mesesGratuitos.',
      );
    }
    if (dto.tipo === 'DESCONTO_FIXO' && !dto.valor) {
      throw new BadRequestException('Cupom DESCONTO_FIXO requer valor em R$.');
    }
    if (dto.tipo === 'DESCONTO_PERCENTUAL' && !dto.valor) {
      throw new BadRequestException(
        'Cupom DESCONTO_PERCENTUAL requer valor (%).',
      );
    }
    if (
      dto.tipo === 'DESCONTO_PERCENTUAL' &&
      dto.valor &&
      (dto.valor < 1 || dto.valor > 100)
    ) {
      throw new BadRequestException('Percentual deve estar entre 1 e 100.');
    }

    const cupom = await this.prisma.cupomDesconto.create({
      data: {
        codigo: codigoUpper,
        tipo: dto.tipo,
        valor: dto.valor ?? null,
        mesesGratuitos: dto.mesesGratuitos ?? null,
        duracaoMeses: dto.duracaoMeses ?? null,
        usosMaximos: dto.usosMaximos ?? null,
        expiraEm: dto.expiraEm ? new Date(dto.expiraEm) : null,
      },
    });

    this.logger.log(`✅ Cupom criado: ${codigoUpper} (${dto.tipo})`);
    return cupom;
  }

  // ===================== ADMIN: LISTAR CUPONS =====================
  async listarCupons() {
    return this.prisma.cupomDesconto.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { empresas: true } },
      },
    });
  }

  // ===================== ADMIN: TOGGLE ATIVO =====================
  async toggleCupom(cupomId: string) {
    const cupom = await this.prisma.cupomDesconto.findUnique({
      where: { id: cupomId },
    });
    if (!cupom) throw new NotFoundException('Cupom não encontrado.');

    return this.prisma.cupomDesconto.update({
      where: { id: cupomId },
      data: { ativo: !cupom.ativo },
    });
  }

  // ===================== VALIDAR CUPOM (público p/ frontend) =====================
  async validarCupom(codigo: string, empresaId: string) {
    const codigoUpper = codigo.trim().toUpperCase();

    const cupom = await this.prisma.cupomDesconto.findUnique({
      where: { codigo: codigoUpper },
    });

    if (!cupom) {
      throw new BadRequestException('Cupom não encontrado.');
    }
    if (!cupom.ativo) {
      throw new BadRequestException('Este cupom não está mais ativo.');
    }
    if (cupom.expiraEm && cupom.expiraEm < new Date()) {
      throw new BadRequestException('Este cupom expirou.');
    }
    if (cupom.usosMaximos !== null && cupom.usosAtuais >= cupom.usosMaximos) {
      throw new BadRequestException('Este cupom atingiu o limite de usos.');
    }

    // Check: empresa already has an active coupon?
    const cupomAtivoExistente = await this.prisma.empresaCupom.findFirst({
      where: { empresaId, ativo: true },
      include: { cupom: true },
    });
    if (cupomAtivoExistente) {
      throw new BadRequestException(
        `Sua empresa já possui um cupom ativo: ${cupomAtivoExistente.cupom.codigo}. Não é possível aplicar dois cupons simultâneos.`,
      );
    }

    // Check: empresa already used this exact coupon?
    const jaUsou = await this.prisma.empresaCupom.findUnique({
      where: { empresaId_cupomId: { empresaId, cupomId: cupom.id } },
    });
    if (jaUsou) {
      throw new BadRequestException('Sua empresa já utilizou este cupom.');
    }

    return {
      valido: true,
      tipo: cupom.tipo,
      valor: cupom.valor ? Number(cupom.valor) : null,
      mesesGratuitos: cupom.mesesGratuitos,
      duracaoMeses: cupom.duracaoMeses,
      descricao: this.descreverCupom(cupom),
    };
  }

  // ===================== APLICAR CUPOM À EMPRESA =====================
  async aplicarCupom(codigo: string, empresaId: string) {
    // Re-validate everything
    await this.validarCupom(codigo, empresaId);

    const codigoUpper = codigo.trim().toUpperCase();
    const cupom = await this.prisma.cupomDesconto.findUnique({
      where: { codigo: codigoUpper },
    });
    if (!cupom) throw new BadRequestException('Cupom não encontrado.');

    // Create association + increment usage count
    await this.prisma.$transaction([
      this.prisma.empresaCupom.create({
        data: { empresaId, cupomId: cupom.id, ativo: true, mesesUsados: 0 },
      }),
      this.prisma.cupomDesconto.update({
        where: { id: cupom.id },
        data: { usosAtuais: { increment: 1 } },
      }),
    ]);

    this.logger.log(
      `🎟️ Cupom ${codigoUpper} aplicado à empresa ${empresaId}`,
    );
    return cupom;
  }

  // ===================== CALCULAR DESCONTO =====================
  /**
   * Given a base value and the active cupom for an empresa,
   * returns the discounted value and whether to skip Asaas billing entirely.
   */
  async calcularDesconto(
    empresaId: string,
    valorBase: number,
  ): Promise<{ valorFinal: number; pularAsaas: boolean; cupomAplicado: string | null }> {
    const vinculo = await this.prisma.empresaCupom.findFirst({
      where: { empresaId, ativo: true },
      include: { cupom: true },
    });

    if (!vinculo) {
      return { valorFinal: valorBase, pularAsaas: false, cupomAplicado: null };
    }

    const cupom = vinculo.cupom;

    switch (cupom.tipo) {
      case 'GRATUIDADE': {
        // All months within mesesGratuitos → R$0, skip Asaas
        if (
          cupom.mesesGratuitos !== null &&
          vinculo.mesesUsados < cupom.mesesGratuitos
        ) {
          return {
            valorFinal: 0,
            pularAsaas: true,
            cupomAplicado: cupom.codigo,
          };
        }
        // Exceeded free months — coupon expired, deactivate
        return { valorFinal: valorBase, pularAsaas: false, cupomAplicado: null };
      }

      case 'DESCONTO_FIXO': {
        const desconto = Number(cupom.valor) || 0;
        const valorFinal = Math.max(valorBase - desconto, 0);
        return {
          valorFinal,
          pularAsaas: valorFinal === 0,
          cupomAplicado: cupom.codigo,
        };
      }

      case 'DESCONTO_PERCENTUAL': {
        const pct = Number(cupom.valor) || 0;
        const valorFinal = Math.max(
          valorBase - valorBase * (pct / 100),
          0,
        );
        return {
          valorFinal: Math.round(valorFinal * 100) / 100,
          pularAsaas: valorFinal === 0,
          cupomAplicado: cupom.codigo,
        };
      }

      default:
        return { valorFinal: valorBase, pularAsaas: false, cupomAplicado: null };
    }
  }

  // ===================== INCREMENTAR MESES + EXPIRAR =====================
  /**
   * Called by the billing cron after a billing cycle.
   * Increments mesesUsados and deactivates the coupon if expired.
   */
  async incrementarMesEExpirar(empresaId: string): Promise<void> {
    const vinculo = await this.prisma.empresaCupom.findFirst({
      where: { empresaId, ativo: true },
      include: { cupom: true },
    });

    if (!vinculo) return;

    const cupom = vinculo.cupom;
    const novoMesesUsados = vinculo.mesesUsados + 1;

    // Determine if the coupon should expire after this month
    let deveExpirar = false;

    if (cupom.tipo === 'GRATUIDADE' && cupom.mesesGratuitos !== null) {
      deveExpirar = novoMesesUsados >= cupom.mesesGratuitos;
    }

    if (cupom.duracaoMeses !== null) {
      deveExpirar = novoMesesUsados >= cupom.duracaoMeses;
    }

    await this.prisma.empresaCupom.update({
      where: { id: vinculo.id },
      data: {
        mesesUsados: novoMesesUsados,
        ativo: !deveExpirar,
      },
    });

    if (deveExpirar) {
      this.logger.log(
        `⏰ Cupom ${cupom.codigo} expirou para empresa ${empresaId} após ${novoMesesUsados} meses`,
      );
    }
  }

  // ===================== HELPERS =====================
  private descreverCupom(cupom: any): string {
    switch (cupom.tipo) {
      case 'GRATUIDADE':
        return `${cupom.mesesGratuitos} ${cupom.mesesGratuitos === 1 ? 'mês grátis' : 'meses grátis'}`;
      case 'DESCONTO_FIXO':
        return `R$ ${Number(cupom.valor).toFixed(2)} de desconto/mês${cupom.duracaoMeses ? ` por ${cupom.duracaoMeses} meses` : ''}`;
      case 'DESCONTO_PERCENTUAL':
        return `${Number(cupom.valor)}% de desconto${cupom.duracaoMeses ? ` por ${cupom.duracaoMeses} meses` : ''}`;
      default:
        return 'Desconto aplicado';
    }
  }
}
