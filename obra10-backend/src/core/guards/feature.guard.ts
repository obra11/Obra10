import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  mixin,
  Type,
} from '@nestjs/common';
import { FeatureService } from '../../modules/feature/feature.service';

/**
 * Factory function para criar um guard de feature flag.
 *
 * Uso:
 *   @UseGuards(JwtAuthGuard, FeatureGuard('FVS_V1'))
 *
 * Se a feature não estiver ativa para a empresa do usuário, retorna 403.
 */
export const FeatureGuard = (featureCodigo: string): Type<CanActivate> => {
  @Injectable()
  class FeatureGuardMixin implements CanActivate {
    constructor(private readonly featureService: FeatureService) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
      const request = context.switchToHttp().getRequest();
      const empresaId = request.user?.empresaId;

      if (!empresaId) {
        throw new ForbiddenException('Empresa não identificada.');
      }

      const enabled = await this.featureService.isEnabled(featureCodigo, empresaId);
      if (!enabled) {
        throw new ForbiddenException(
          `Funcionalidade "${featureCodigo}" não disponível para sua empresa.`,
        );
      }

      return true;
    }
  }

  return mixin(FeatureGuardMixin);
};
