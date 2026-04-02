import {
  Controller, Post, Get, Patch, Body, Param, Req, Query, UseGuards,
  BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { TenantService } from './tenant.service';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';

const PLAN_LIMITS: Record<string, number> = { BASICO: 5, PRO: 20, ENTERPRISE: 100 };

@Controller()
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  // ===================== PUBLIC — Self-Service Register =====================
  @Throttle({ default: { limit: 5, ttl: 3600 } })
  @Post('tenants/register')
  async register(@Body() body: any) {
    const { tipoPessoa, cpfCnpj, razaoSocial, nomeFantasia, nomeCompleto, email, telefone,
            cep, numero, complemento, nome, senha } = body;
    if (!cpfCnpj || !email || !nome || !senha) {
      throw new BadRequestException('Campos obrigatórios: cpfCnpj, email, nome, senha.');
    }
    if (!tipoPessoa || !['FISICA', 'JURIDICA'].includes(tipoPessoa)) {
      throw new BadRequestException("tipoPessoa deve ser 'FISICA' ou 'JURIDICA'.");
    }
    return this.tenantService.register({ tipoPessoa, cpfCnpj, razaoSocial, nomeFantasia, nomeCompleto, email, telefone, cep, numero, complemento, nome, senha });
  }

  // ===================== Verificar E-mail =====================
  @Throttle({ default: { limit: 10, ttl: 3600 } })
  @Get('tenants/verificar-email')
  async verificarEmail(@Query('token') token: string, @Req() req: any, @Body() body: any) {
    if (!token) throw new BadRequestException('Token de verificação obrigatório.');
    return this.tenantService.verificarEmail(token);
  }

  // ===================== Reenviar verificação =====================
  @Throttle({ default: { limit: 3, ttl: 3600 } })
  @Post('tenants/reenviar-verificacao')
  async reenviarVerificacao(@Body() body: any) {
    if (!body.email) throw new BadRequestException('E-mail obrigatório.');
    return this.tenantService.reenviarVerificacao(body.email);
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
  async upgradeMeuPlano(@Req() req: any, @Body() body: { plano: string }) {
    const empresaId = req.user?.empresaId;
    if (!empresaId || req.user?.perfilGlobal !== 'GESTOR') {
      throw new ForbiddenException('Apenas gestores podem alterar o plano.');
    }
    return this.tenantService.upgradeMeuPlano(empresaId, body.plano);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('tenants/minha-empresa')
  async updateMinhaEmpresa(@Req() req: any, @Body() body: { nomeFantasia?: string; razaoSocial?: string; telefone?: string }) {
    const empresaId = req.user?.empresaId;
    if (!empresaId || req.user?.perfilGlobal !== 'GESTOR') {
      throw new ForbiddenException('Apenas gestores podem editar a empresa.');
    }
    return this.tenantService.updateTenant(empresaId, body);
  }

  // ===================== SUPER ADMIN =====================
  @UseGuards(JwtAuthGuard)
  @Get('admin/tenants')
  async listTenants(@Req() req: any) {
    if (req.user?.perfilGlobal !== 'SUPER_ADMIN') throw new ForbiddenException('Acesso restrito ao Super Admin.');
    return this.tenantService.listAll();
  }

  @UseGuards(JwtAuthGuard)
  @Patch('admin/tenants/:id/modulos')
  async patchTenantModulos(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    if (req.user?.perfilGlobal !== 'SUPER_ADMIN') throw new ForbiddenException('Acesso restrito ao Super Admin.');
    return this.tenantService.setModulos(id, body.modulos);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('admin/tenants/:id')
  async updateTenant(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    if (req.user?.perfilGlobal !== 'SUPER_ADMIN') throw new ForbiddenException('Acesso restrito ao Super Admin.');
    const updates: any = {};
    if (body.ativo !== undefined) updates.ativo = body.ativo;
    if (body.suspensa !== undefined) updates.suspensa = body.suspensa;
    if (body.plano) {
      if (!PLAN_LIMITS[body.plano]) throw new BadRequestException(`Plano inválido. Use: ${Object.keys(PLAN_LIMITS).join(', ')}`);
      updates.plano = body.plano;
    }
    if (body.limiteUsuarios !== undefined && !body.plano) updates.limiteUsuarios = body.limiteUsuarios;
    return this.tenantService.updateTenant(id, updates);
  }
}
