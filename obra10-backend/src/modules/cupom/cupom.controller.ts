import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Req,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { CupomService } from './cupom.service';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { CriarCupomDto, ValidarCupomDto } from './dto/cupom.dto';

@Controller()
export class CupomController {
  constructor(private readonly cupomService: CupomService) {}

  // ===================== ADMIN: Criar cupom =====================
  @UseGuards(JwtAuthGuard)
  @Post('admin/cupons')
  async criarCupom(@Body() dto: CriarCupomDto, @Req() req: any) {
    if (req.user?.perfilGlobal !== 'SUPER_ADMIN')
      throw new ForbiddenException('Acesso restrito ao Super Admin.');
    return this.cupomService.criarCupom(dto);
  }

  // ===================== ADMIN: Listar cupons =====================
  @UseGuards(JwtAuthGuard)
  @Get('admin/cupons')
  async listarCupons(@Req() req: any) {
    if (req.user?.perfilGlobal !== 'SUPER_ADMIN')
      throw new ForbiddenException('Acesso restrito ao Super Admin.');
    return this.cupomService.listarCupons();
  }

  // ===================== ADMIN: Toggle ativo =====================
  @UseGuards(JwtAuthGuard)
  @Patch('admin/cupons/:id/toggle')
  async toggleCupom(@Param('id') id: string, @Req() req: any) {
    if (req.user?.perfilGlobal !== 'SUPER_ADMIN')
      throw new ForbiddenException('Acesso restrito ao Super Admin.');
    return this.cupomService.toggleCupom(id);
  }

  // ===================== PUBLIC: Validar cupom =====================
  @UseGuards(JwtAuthGuard)
  @Post('cobrancas/validar-cupom')
  async validarCupom(@Body() dto: ValidarCupomDto, @Req() req: any) {
    const empresaId = req.user?.empresaId;
    if (!empresaId)
      throw new ForbiddenException('Tenant não identificado.');
    return this.cupomService.validarCupom(dto.codigo, empresaId);
  }
}
