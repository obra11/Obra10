import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { ObraContextGuard } from '../../core/guards/obra-context.guard';
import { PrismaService } from '../../prisma/prisma.service';

@UseGuards(JwtAuthGuard, ObraContextGuard)
@Controller('alertas')
export class AlertaController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * GET /alertas?obraId=xxx
   * Lista alertas não lidos dos últimos 30 dias para a obra.
   * ObraContextGuard garante que o usuário tem acesso à obra.
   */
  @Get()
  async listar(@Query('obraId') obraId: string, @Req() req: any) {
    const resolvedObraId = obraId || req.headers['x-obra-id'];
    const trintaDiasAtras = new Date();
    trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);

    return this.prisma.alertaObra.findMany({
      where: {
        obraId: resolvedObraId,
        lido: false,
        createdAt: { gte: trintaDiasAtras },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * PATCH /alertas/:id/marcar-lido
   * Marca alerta como lido (soft).
   */
  @Patch(':id/marcar-lido')
  async marcarLido(@Param('id') id: string, @Req() req: any) {
    return this.prisma.alertaObra.update({
      where: { id },
      data: { lido: true },
    });
  }
}
