import {
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
  StreamableFile,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { ObraContextGuard } from '../../core/guards/obra-context.guard';
import { ModuloGuard } from '../../core/guards/modulo.guard';
import { Modulo } from '../../core/decorators/modulo.decorator';
import { VisualizadorService } from './visualizador.service';

@Modulo('VISUALIZADOR')
@UseGuards(JwtAuthGuard, ObraContextGuard, ModuloGuard)
@Controller('visualizador')
export class VisualizadorController {
  constructor(private readonly visualizador: VisualizadorService) {}

  @Post('dwg')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 100 * 1024 * 1024 },
    }),
  )
  async dwg(@UploadedFile() file: Express.Multer.File | undefined, @Res({ passthrough: true }) res: Response): Promise<StreamableFile> {
    if (!file) throw new BadRequestException('Selecione um arquivo DWG.');
    const { pdf, scale } = await this.visualizador.dwgParaPdf(file.buffer, file.originalname);
    if (scale) {
      res.setHeader('X-Dwg-Unit', scale.unit);
      res.setHeader('X-Dwg-Units-Per-Point', String(scale.unitsPerPoint));
      res.setHeader('X-Dwg-Model-Page', String(scale.modelPage));
    }
    return new StreamableFile(pdf, {
      type: 'application/pdf',
      disposition: 'inline; filename="desenho.pdf"',
    });
  }

  @Post('doc')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 30 * 1024 * 1024 },
    }),
  )
  async doc(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Selecione um arquivo .doc.');
    const text = await this.visualizador.docParaTexto(file.buffer, file.originalname);
    return { text };
  }
}
