import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CapabilitiesService } from '../capabilities/capabilities.service';

@Injectable()
export class ObraContextGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly capabilities: CapabilitiesService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const obraId =
      request.headers['x-obra-id'] ||
      request.body?.obraId ||
      request.query?.obraId;

    if (!user) throw new UnauthorizedException('Usuário não autenticado.');
    if (!obraId)
      throw new ForbiddenException(
        'Contexto de obra não fornecido no cabeçalho x-obra-id.',
      );

    const userInfo = await this.prisma.usuario.findUnique({
      where: { id: user.sub || user.id },
      select: {
        perfilGlobal: true,
        empresaId: true,
        capabilities: true,
      },
    });

    let role: any = null;

    const caps = userInfo
      ? await this.capabilities.resolveForUser({
          empresaId: userInfo.empresaId,
          perfilGlobal: userInfo.perfilGlobal,
          capabilitiesOverride: userInfo.capabilities,
        })
      : null;

    // SUPER_ADMIN e quem tem acessoTodasObras têm acesso irrestrito às obras da empresa
    if (
      userInfo &&
      (userInfo.perfilGlobal === 'SUPER_ADMIN' || caps?.acessoTodasObras)
    ) {
      const obra = await this.prisma.obra.findUnique({ where: { id: obraId } });
      if (!obra || obra.empresaId !== userInfo.empresaId) {
        throw new ForbiddenException('Obra não pertence à sua empresa.');
      }
      role = {
        perfilId: 99,
        permissoes: caps?.aprovarRdo
          ? { RDO: 'EDIT', ...(caps.modulosPadrao || {}) }
          : { ...(caps?.modulosPadrao || {}), RDO: caps?.criarEditarRdo ? 'EDIT' : 'VIEW' },
        capabilities: caps,
      };
    } else {
      role = await this.prisma.userObraRole.findUnique({
        where: {
          usuarioId_obraId: { usuarioId: user.sub || user.id, obraId: obraId },
        },
      });
      if (role) {
        role = { ...role, capabilities: caps };
      }
    }

    if (!role) {
      throw new ForbiddenException(
        'Acesso Negado: Você não possui vínculo ou perfil associado à esta obra.',
      );
    }

    request.obraRole = role;

    return true;
  }
}
