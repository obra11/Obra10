import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { Empresa, Usuario } from '@prisma/client';

export interface RequestWithUser extends Request {
  user: Usuario;
  empresa: Empresa;
}

@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    if (!user || user.perfilGlobal !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Acesso restrito a super administradores do sistema.');
    }

    return true;
  }
}
