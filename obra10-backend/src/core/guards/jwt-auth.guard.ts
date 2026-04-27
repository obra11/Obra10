import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { Request } from 'express';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException(
        'Nenhum token JWT fornecido no header Authorization.',
      );
    }

    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET || 'obra10-mvp-secret-key-12345',
      });

      // Verificar jwtVersion — se o usuário trocou de senha, o token é invalidado
      if (payload.jwtVersion !== undefined && payload.sub) {
        const user = await this.prisma.usuario.findUnique({
          where: { id: payload.sub },
          select: { jwtVersion: true, ativo: true },
        });
        if (!user || !user.ativo) {
          throw new UnauthorizedException('Conta desativada.');
        }
        if (user.jwtVersion !== payload.jwtVersion) {
          throw new UnauthorizedException(
            'Sessão invalidada. Faça login novamente.',
          );
        }
      }

      request.user = payload;
    } catch (e: any) {
      if (e instanceof UnauthorizedException) throw e;
      throw new UnauthorizedException('Token JWT inválido ou expirado.');
    }
    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    if (request.cookies && request.cookies['obra10_token']) {
      return request.cookies['obra10_token'];
    }
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
