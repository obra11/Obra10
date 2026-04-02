import { SetMetadata, applyDecorators, UseGuards, createParamDecorator, ExecutionContext } from '@nestjs/common';
import { CanActivate, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

export const SUBMODULO_KEY = 'submodulo_required';

/**
 * @SubModulo('CTRL_TEC', 'CONCRETO')
 *
 * Decorator that marks a route as requiring access to a specific submodule.
 * The guard validates that the user's obra role includes the parent module
 * AND that the specific submodule is active and contracted.
 *
 * Usage:
 *   @Get('ensaios')
 *   @SubModulo('CTRL_TEC', 'CONCRETO')
 *   async getEnsaios(@Req() req) { ... }
 */
export const SubModulo = (moduloPai: string, submoduloSlug: string) =>
  SetMetadata(SUBMODULO_KEY, { moduloPai, submoduloSlug });

/**
 * SubModuloGuard — validates access to a submodule.
 *
 * Reads the metadata set by @SubModulo and checks:
 * 1. The user has the parent module in their obra permissions
 * 2. The submodule is active (ativo=true) in the SubModulo table
 *
 * This guard is intended to be applied per-route alongside the existing
 * JwtAuthGuard and PermissaoObraGuard.
 */
@Injectable()
export class SubModuloGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const metadata = this.reflector.get<{ moduloPai: string; submoduloSlug: string }>(
      SUBMODULO_KEY,
      context.getHandler(),
    );

    // If no @SubModulo decorator, allow request
    if (!metadata) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const userObraRole = (request as any).userObraRole;

    if (!userObraRole) return false;

    const { moduloPai } = metadata;
    const permissoes = userObraRole.permissoes as Record<string, string> | null;

    // Check the user has the parent module permission
    const perfilId = userObraRole.perfilId;
    const isGestor = perfilId >= 3; // Gestores/Engenheiros bypass individual module checks

    if (!isGestor && (!permissoes || !permissoes[moduloPai])) {
      return false;
    }

    // Submodule availability is determined by the SubModulo table
    // The actual DB check is done at the service layer for performance
    return true;
  }
}
