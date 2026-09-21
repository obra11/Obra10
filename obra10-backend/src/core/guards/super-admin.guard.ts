import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const userId = user?.sub || user?.id;

    if (!userId) {
      throw new ForbiddenException(
        'Acesso restrito a super administradores do sistema.',
      );
    }

    const dbUser = await this.prisma.usuario.findFirst({
      where: { id: userId, ativo: true, deletedAt: null },
      select: { perfilGlobal: true },
    });

    if (!dbUser || dbUser.perfilGlobal !== 'SUPER_ADMIN') {
      throw new ForbiddenException(
        'Acesso restrito a super administradores do sistema.',
      );
    }

    request.user = { ...user, perfilGlobal: dbUser.perfilGlobal };
    return true;
  }
}
