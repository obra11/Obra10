import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { CatalogoService } from './catalogo.service';
import { CreateInsumoDto } from './dto/create-insumo.dto';
import { UpdateInsumoDto } from './dto/update-insumo.dto';
import { ImportInsumosDto } from './dto/import-insumos.dto';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { TipoInsumo } from '@prisma/client';

@Controller('catalogo')
@UseGuards(JwtAuthGuard)
export class CatalogoController {
  constructor(private readonly catalogoService: CatalogoService) {}

  @Get()
  async findAll(@Req() req: any, @Query('tipo') tipo?: TipoInsumo) {
    const empresaId = req.user.empresaId || req.user.empresa_id;
    return this.catalogoService.findAll(empresaId, tipo);
  }

  @Post('importar')
  async importar(@Req() req: any, @Body() dto: ImportInsumosDto) {
    const empresaId = req.user.empresaId || req.user.empresa_id;
    return this.catalogoService.importar(empresaId, dto);
  }

  @Get(':id')
  async findOne(@Req() req: any, @Param('id') id: string) {
    const empresaId = req.user.empresaId || req.user.empresa_id;
    return this.catalogoService.findOne(id, empresaId);
  }

  @Post()
  async create(@Req() req: any, @Body() dto: CreateInsumoDto) {
    const empresaId = req.user.empresaId || req.user.empresa_id;
    return this.catalogoService.create(empresaId, dto);
  }

  @Put(':id')
  async update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateInsumoDto,
  ) {
    const empresaId = req.user.empresaId || req.user.empresa_id;
    return this.catalogoService.update(id, empresaId, dto);
  }

  @Delete(':id')
  async remove(@Req() req: any, @Param('id') id: string) {
    const empresaId = req.user.empresaId || req.user.empresa_id;
    return this.catalogoService.remove(id, empresaId);
  }
}
