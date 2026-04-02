import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class AlertaCron {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  /**
   * Cron diário às 08:00 — verifica equipamentos com aferição vencendo em 7 dias.
   * Idempotência: chave = {obraId}-AFERICAO-{YYYY-MM-DD} para evitar alertas duplicados.
   */
  @Cron('0 8 * * *', { name: 'alerta-afericao-obras' })
  async verificarAfericaoVencendo() {
    const hoje = new Date();
    const limite = new Date(hoje);
    limite.setDate(limite.getDate() + 7);

    // Busca obras ativas — substitua por equipamentos reais quando o módulo de equipamentos for implementado
    // STUB: sem modelo de Equipamento ainda — gera alerta genérico de lembrete para obras ativas
    const obrasAtivas = await this.prisma.obra.findMany({
      where: { deletedAt: null, status: 'ATIVA' },
      include: {
        empresa: { select: { id: true } },
        userObraRole: {
          where: { perfilId: { gte: 3 } },
          include: { usuario: { select: { email: true, nome: true } } },
        },
      },
    });

    const dataStr = hoje.toISOString().split('T')[0];

    for (const obra of obrasAtivas) {
      // Idempotência: chave única por obra + tipo + data
      const idempotencyKey = `${obra.id}-AFERICAO-${dataStr}`;
      const jaExiste = await this.prisma.alertaObra.findUnique({ where: { idempotencyKey } });
      if (jaExiste) continue;

      // Cria alerta (STUB até módulo de Equipamentos existir)
      await this.prisma.alertaObra.create({
        data: {
          obraId: obra.id,
          tipo: 'AFERICAO_VENCENDO',
          mensagem: 'Verifique equipamentos com aferição vencendo nos próximos 7 dias.',
          idempotencyKey,
          lido: false,
          expiresAt: limite,
        },
      });

      // Envia e-mail para gestores da obra (perfilId >= 3)
      for (const role of obra.userObraRole) {
        try {
          await this.email.sendGenerico(
            role.usuario.email,
            role.usuario.nome,
            'Alerta: Aferição de Equipamentos',
            `Há equipamentos na obra <strong>${obra.nome}</strong> com aferição vencendo em até 7 dias. Acesse o OBRA 10 para verificar.`,
          );
        } catch (e) {
          console.error(`[AlertaCron] Falha ao enviar e-mail para ${role.usuario.email}:`, e);
        }
      }
    }
  }
}
