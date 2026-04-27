import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Req,
  Query,
  UseGuards,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { TenantService } from './tenant.service';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { RegisterTenantDto } from './dto/tenant.dto';
import {
  ReenviarVerificacaoDto,
  UpgradePlanoDto,
  UpdateMinhaEmpresaDto,
  AdminUpdateTenantDto,
  AdminSetModulosDto,
} from './dto/tenant-admin.dto';

const PLAN_LIMITS: Record<string, number> = {
  BASICO: 5,
  PRO: 20,
  ENTERPRISE: 100,
};

@Controller()
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  // ===================== PUBLIC — Self-Service Register =====================
  @Throttle({ default: { limit: 5, ttl: 3600 } })
  @Post('tenants/register')
  async register(@Body() dto: RegisterTenantDto) {
    return this.tenantService.register(dto);
  }

  // ===================== Verificar E-mail =====================
  @Throttle({ default: { limit: 10, ttl: 3600 } })
  @Get('tenants/verificar-email')
  async verificarEmail(@Query('token') token: string) {
    if (!token)
      throw new BadRequestException('Token de verificação obrigatório.');
    return this.tenantService.verificarEmail(token);
  }

  // ===================== Reenviar verificação =====================
  @Throttle({ default: { limit: 3, ttl: 3600 } })
  @Post('tenants/reenviar-verificacao')
  async reenviarVerificacao(@Body() dto: ReenviarVerificacaoDto) {
    return this.tenantService.reenviarVerificacao(dto.email);
  }

  // ===================== MEU PLANO (GESTOR) =====================
  @UseGuards(JwtAuthGuard)
  @Get('tenants/meu-plano')
  async getMeuPlano(@Req() req: any) {
    const empresaId = req.user?.empresaId;
    if (!empresaId) throw new ForbiddenException('Sessão inválida.');
    return this.tenantService.obterMeuPlano(empresaId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('tenants/meu-plano/upgrade')
  async upgradeMeuPlano(@Req() req: any, @Body() dto: UpgradePlanoDto) {
    const empresaId = req.user?.empresaId;
    if (!empresaId || req.user?.perfilGlobal !== 'GESTOR') {
      throw new ForbiddenException('Apenas gestores podem alterar o plano.');
    }
    return this.tenantService.upgradeMeuPlano(empresaId, dto.plano);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('tenants/minha-empresa')
  async updateMinhaEmpresa(
    @Req() req: any,
    @Body() dto: UpdateMinhaEmpresaDto,
  ) {
    const empresaId = req.user?.empresaId;
    if (!empresaId || req.user?.perfilGlobal !== 'GESTOR') {
      throw new ForbiddenException('Apenas gestores podem editar a empresa.');
    }
    return this.tenantService.updateTenant(empresaId, dto);
  }

  // ===================== SUPER ADMIN =====================
  @UseGuards(JwtAuthGuard)
  @Get('admin/tenants')
  async listTenants(@Req() req: any) {
    if (req.user?.perfilGlobal !== 'SUPER_ADMIN')
      throw new ForbiddenException('Acesso restrito ao Super Admin.');
    return this.tenantService.listAll();
  }

  @UseGuards(JwtAuthGuard)
  @Patch('admin/tenants/:id/modulos')
  async patchTenantModulos(
    @Param('id') id: string,
    @Body() dto: AdminSetModulosDto,
    @Req() req: any,
  ) {
    if (req.user?.perfilGlobal !== 'SUPER_ADMIN')
      throw new ForbiddenException('Acesso restrito ao Super Admin.');
    return this.tenantService.setModulos(id, dto.modulos);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('admin/tenants/:id')
  async updateTenant(
    @Param('id') id: string,
    @Body() dto: AdminUpdateTenantDto,
    @Req() req: any,
  ) {
    if (req.user?.perfilGlobal !== 'SUPER_ADMIN')
      throw new ForbiddenException('Acesso restrito ao Super Admin.');
    const updates: any = {};
    if (dto.ativo !== undefined) updates.ativo = dto.ativo;
    if (dto.suspensa !== undefined) updates.suspensa = dto.suspensa;
    if (dto.plano) {
      if (!PLAN_LIMITS[dto.plano])
        throw new BadRequestException(
          `Plano inválido. Use: ${Object.keys(PLAN_LIMITS).join(', ')}`,
        );
      updates.plano = dto.plano;
    }
    if (dto.limiteUsuarios !== undefined && !dto.plano)
      updates.limiteUsuarios = dto.limiteUsuarios;
    return this.tenantService.updateTenant(id, updates);
  }

  // ===================== GESTOR — Cobranças Pendentes =====================
  @UseGuards(JwtAuthGuard)
  @Get('minha-empresa/cobrancas-pendentes')
  async getCobrancasPendentes(@Req() req: any) {
    const empresaId = req.user?.empresaId;
    if (!empresaId) throw new ForbiddenException('Empresa não identificada.');

    const cobrancas = await this.tenantService.getCobrancasPendentes(empresaId);
    return cobrancas;
  }
}
