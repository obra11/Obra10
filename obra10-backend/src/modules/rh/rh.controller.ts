import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { ModuloGuard } from '../../core/guards/modulo.guard';
import { Modulo } from '../../core/decorators/modulo.decorator';
import { RhService, type FichaBody } from './rh.service';

@Controller('rh')
@Modulo('RH')
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

  @Get('relatorios/pessoal')
  async relatorioPessoal(
    @Req() req: any,
    @Query('ids') ids: string,
    @Res() res: any,
  ) {
    try {
      const buffer = await this.rh.relatorioPessoalPdf(
        this.empresaId(req),
        this.userId(req),
        ids,
      );
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="relatorio-pessoal.pdf"',
        'Content-Length': buffer.length,
      });
      res.end(buffer);
    } catch (err: any) {
      if (res.headersSent) return;
      const status = typeof err?.getStatus === 'function' ? err.getStatus() : 500;
      const corpo = typeof err?.getResponse === 'function' ? err.getResponse() : null;
      const message =
        typeof corpo === 'string'
          ? corpo
          : corpo?.message || err?.message || 'Não foi possível gerar o relatório.';
      res.status(status).json({ message });
    }
  }

  @Get('funcionarios/:id/dossie')
  dossie(@Req() req: any, @Param('id') id: string) {
    return this.rh.dossie(this.empresaId(req), this.userId(req), id);
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

  @Post('funcionarios/:id/alocacao')
  alocar(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { obraId?: string | null; dataInicio?: string; observacao?: string },
  ) {
    return this.rh.alocar(this.empresaId(req), this.userId(req), id, body);
  }

  @Get('entregas')
  entregas(@Req() req: any, @Query('obraId') obraId?: string) {
    return this.rh.entregas(this.empresaId(req), this.userId(req), obraId);
  }

  @Get('entregas/:id/pdf')
  async termoPdf(@Req() req: any, @Param('id') id: string, @Res() res: any) {
    try {
      const buffer = await this.rh.termoPdf(this.empresaId(req), this.userId(req), id);
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="termo-epi.pdf"',
        'Content-Length': buffer.length,
      });
      res.end(buffer);
    } catch (err: any) {
      if (res.headersSent) return;
      const status = typeof err?.getStatus === 'function' ? err.getStatus() : 500;
      const corpo = typeof err?.getResponse === 'function' ? err.getResponse() : null;
      const message =
        typeof corpo === 'string'
          ? corpo
          : corpo?.message || err?.message || 'Não foi possível gerar o PDF do termo.';
      res.status(status).json({ message });
    }
  }

  @Get('entregas/:id')
  termo(@Req() req: any, @Param('id') id: string) {
    return this.rh.termo(this.empresaId(req), this.userId(req), id);
  }

  @Post('entregas')
  entregar(@Req() req: any, @Body() body: any) {
    return this.rh.entregar(this.empresaId(req), this.userId(req), body);
  }

  @Get('avisos')
  avisos(@Req() req: any, @Query('obraId') obraId?: string) {
    return this.rh.avisos(this.empresaId(req), this.userId(req), obraId);
  }

  @Get('exames')
  exames(@Req() req: any, @Query('obraId') obraId?: string) {
    return this.rh.exames(this.empresaId(req), this.userId(req), obraId);
  }

  @Post('exames')
  registrarExame(@Req() req: any, @Body() body: any) {
    return this.rh.registrarExame(this.empresaId(req), this.userId(req), body);
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
  @UseInterceptors(
    FileInterceptor('certificado', {
      storage: memoryStorage(),
      limits: { fileSize: 15 * 1024 * 1024 },
    }),
  )
  registrarTreinamento(
    @Req() req: any,
    @Body() body: any,
    @UploadedFile() certificado?: Express.Multer.File,
  ) {
    return this.rh.registrarTreinamento(
      this.empresaId(req),
      this.userId(req),
      body,
      certificado,
    );
  }
}
