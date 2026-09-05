import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { RdoService } from './rdo.service';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { ModuloGuard } from '../../core/guards/modulo.guard';
import { Modulo } from '../../core/decorators/modulo.decorator';

/**
 * Rotas de RDO no escopo da empresa (sem x-obra-id / ObraContextGuard).
 * Mantido em controller separado para não herdar ObraContextGuard do RdoController.
 */
@Modulo('RDO')
@UseGuards(JwtAuthGuard, ModuloGuard)
@Controller('rdos')
export class RdoEmpresaController {
  constructor(private readonly rdoService: RdoService) {}

  @Get('empresa')
  async listarEmpresa(@Req() req: any) {
    return this.rdoService.findAllByEmpresa(req.user.sub, req.user.empresaId);
  }
}
