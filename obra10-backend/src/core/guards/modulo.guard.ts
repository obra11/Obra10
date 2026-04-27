import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { MODULO_KEY } from '../decorators/modulo.decorator';

@Injectable()
export class ModuloGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const moduloSlug = this.reflector.getAllAndOverride<string>(MODULO_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Se a rota não tem @Modulo(), deixa passar (sem restrição de módulo)
    if (!moduloSlug) return true;

    const req = context.switchToHttp().getRequest();
    const userId: string = req.user?.sub;
    const empresaId: string = req.user?.empresaId;

    if (!userId || !empresaId) throw new ForbiddenException('Não autenticado.');

    // 0. Check if empresa is suspended for delinquency
    const empresa = await this.prisma.empresa.findUnique({
      where: { id: empresaId },
      select: { suspensa: true },
    });
    if (empresa?.suspensa) {
      await this.logAcessoNegado(
        userId,
        empresaId,
        moduloSlug,
        'CONTA_SUSPENSA',
      );
      throw new ForbiddenException(
        'Conta suspensa por inadimplência. Regularize seu pagamento em Financeiro.',
      );
    }

    // 1. Verifica se o TENANT contratou o módulo e se está ativo e não expirado
    const tenantModulo = await this.prisma.tenantModulo.findFirst({
      where: {
        empresaId,
        modulo: { slug: moduloSlug },
        ativo: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });

    if (!tenantModulo) {
      // Registra tentativa de acesso negado no AuditLog
      await this.logAcessoNegado(
        userId,
        empresaId,
        moduloSlug,
        'TENANT_NAO_CONTRATOU',
      );
      throw new ForbiddenException(
        `Seu plano não inclui o módulo "${moduloSlug}". Entre em contato com o administrador.`,
      );
    }

    // 2. Verifica se o USUÁRIO tem permissão individual para o módulo
    // Super Admins e Gestores têm acesso irrestrito dentro dos módulos do tenant
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: userId, deletedAt: null },
      select: { perfilGlobal: true },
    });

    if (!usuario)
      throw new ForbiddenException('Usuário não encontrado ou inativo.');

    const isPrivilegiado =
      usuario.perfilGlobal === 'SUPER_ADMIN' ||
      usuario.perfilGlobal === 'GESTOR';

    if (!isPrivilegiado) {
      const usuarioModulo = await this.prisma.usuarioModulo.findUnique({
        where: {
          usuarioId_moduloId: {
            usuarioId: userId,
            moduloId: tenantModulo.moduloId,
          },
        },
      });

      if (!usuarioModulo) {
        await this.logAcessoNegado(
          userId,
          empresaId,
          moduloSlug,
          'USUARIO_SEM_PERMISSAO',
        );
        throw new ForbiddenException(
          `Você não tem acesso ao módulo "${moduloSlug}". Solicite ao seu gestor.`,
        );
      }
    }

    return true;
  }

  private async logAcessoNegado(
    usuarioId: string,
    empresaId: string,
    moduloSlug: string,
    motivo: string,
  ) {
    try {
      await this.prisma.auditLog.create({
        data: {
          empresaId,
          usuarioId,
          tabelaAfetada: 'modulos',
          registroId: moduloSlug,
          acao: 'ACESSO_NEGADO',
          cargaNova: JSON.stringify({
            motivo,
            moduloSlug,
            timestamp: new Date().toISOString(),
          }),
        },
      });
    } catch {
      // Silencia erros de log para não bloquear o fluxo
    }
  }
}
