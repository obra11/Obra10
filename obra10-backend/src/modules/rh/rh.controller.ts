import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { ModuloGuard } from '../../core/guards/modulo.guard';
import { Modulo } from '../../core/decorators/modulo.decorator';
import { RhService, type FichaBody } from './rh.service';

@Controller('rh')
@Modulo('MATERIAIS')
@UseGuards(JwtAuthGuard, ModuloGuard)
export class RhController {
  constructor(private readonly rh: RhService) {}

  private empresaId(req: any) {
    return req.user.empresaId || req.user.empresa_id;
  }

  private userId(req: any) {
    return req.user.sub || req.user.id;
  }

  @Get('funcionarios')
  listar(@Req() req: any, @Query('obraId') obraId?: string) {
    return this.rh.listar(this.empresaId(req), this.userId(req), obraId);
  }

  @Post('funcionarios/ler-ficha')
  @UseInterceptors(
    FilesInterceptor('files', 4, {
      storage: memoryStorage(),
      limits: { fileSize: 15 * 1024 * 1024 },
    }),
  )
  lerFicha(
    @Req() req: any,
    @UploadedFiles() files: Express.Multer.File[],
    @Body() body: { obraId?: string },
  ) {
    return this.rh.lerFicha(this.empresaId(req), this.userId(req), files, body?.obraId);
  }

  @Get('funcionarios/:id')
  obter(@Req() req: any, @Param('id') id: string) {
    return this.rh.obter(this.empresaId(req), this.userId(req), id);
  }

  @Post('funcionarios')
  criar(@Req() req: any, @Body() body: FichaBody) {
    return this.rh.criar(this.empresaId(req), this.userId(req), body);
  }

  @Patch('funcionarios/:id')
  atualizar(@Req() req: any, @Param('id') id: string, @Body() body: FichaBody) {
    return this.rh.atualizar(this.empresaId(req), this.userId(req), id, body);
  }

  @Get('entregas')
  entregas(@Req() req: any, @Query('obraId') obraId?: string) {
    return this.rh.entregas(this.empresaId(req), this.userId(req), obraId);
  }

  @Get('entregas/:id')
  termo(@Req() req: any, @Param('id') id: string) {
    return this.rh.termo(this.empresaId(req), this.userId(req), id);
  }

  @Post('entregas')
  entregar(@Req() req: any, @Body() body: any) {
    return this.rh.entregar(this.empresaId(req), this.userId(req), body);
  }

  @Get('treinamentos')
  treinamentos(@Req() req: any, @Query('obraId') obraId?: string) {
    return this.rh.treinamentos(this.empresaId(req), this.userId(req), obraId);
  }

  @Get('treinamentos/:id')
  treinamento(@Req() req: any, @Param('id') id: string) {
    return this.rh.treinamento(this.empresaId(req), this.userId(req), id);
  }

  @Post('treinamentos')
  registrarTreinamento(@Req() req: any, @Body() body: any) {
    return this.rh.registrarTreinamento(this.empresaId(req), this.userId(req), body);
  }
}
