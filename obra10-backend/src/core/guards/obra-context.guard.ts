import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ObraContextGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user; // Usuário vindo do AuthGuard JWT
    const obraId =
      request.headers['x-obra-id'] ||
      request.body?.obraId ||
      request.query?.obraId;

    if (!user) throw new UnauthorizedException('Usuário não autenticado.');
    if (!obraId)
      throw new ForbiddenException(
        'Contexto de obra não fornecido no cabeçalho x-obra-id.',
      );

    // Checa se o usuário é DIRETOR
    const userInfo = await this.prisma.usuario.findUnique({
      where: { id: user.sub || user.id },
      select: { perfilGlobal: true, empresaId: true },
    });

    let role: any = null;

    // SUPER_ADMIN and GESTOR have unrestricted access to any obra in their empresa
    if (
      userInfo?.perfilGlobal === 'SUPER_ADMIN' ||
      userInfo?.perfilGlobal === 'GESTOR'
    ) {
      const obra = await this.prisma.obra.findUnique({ where: { id: obraId } });
      if (!obra || obra.empresaId !== userInfo.empresaId) {
        throw new ForbiddenException('Obra não pertence à sua empresa.');
      }
      // Privileged users get full access role
      role = { perfilId: 99 };
    } else {
      // Checa se o usuário tem vínculo ativo com a obra
      role = await this.prisma.userObraRole.findUnique({
        where: {
          usuarioId_obraId: { usuarioId: user.sub || user.id, obraId: obraId },
        },
      });
    }

    if (!role) {
      throw new ForbiddenException(
        'Acesso Negado: Você não possui vínculo ou perfil associado à esta obra.',
      );
    }

    // Injeta o papel resolvida na request para os Controllers validarem Níveis (Field vs Manager)
    request.obraRole = role;

    return true;
  }
}
