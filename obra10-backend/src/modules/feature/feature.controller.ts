import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { FeatureService } from './feature.service';

@Controller('features')
@UseGuards(JwtAuthGuard)
export class FeatureController {
  constructor(private readonly featureService: FeatureService) {}

  @Get('minhas')
  async getMinhasFeatures(@Req() req: any) {
    const empresaId = req.user.empresaId;
    return this.featureService.getEmpresaFeatures(empresaId);
  }
}
