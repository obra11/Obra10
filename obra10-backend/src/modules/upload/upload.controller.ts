import { Controller, Post, UseInterceptors, UploadedFile, Param, BadRequestException, UseGuards, Req, ParseFilePipe, MaxFileSizeValidator, FileTypeValidator } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { ObraContextGuard } from '../../core/guards/obra-context.guard';

@Controller('upload')
export class UploadController {
  constructor(private readonly prisma: PrismaService) {}

  @Post('empresa/:id/logo')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads',
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `${req.params.id}-logo-${uniqueSuffix}${extname(file.originalname)}`);
      }
    })
  }))
  async uploadLogo(
    @Param('id') id: string, 
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }),
          // new FileTypeValidator({ fileType: 'image' }),
        ],
      }),
    ) file: Express.Multer.File
  ) {
    if (!file) throw new BadRequestException('Nenhum arquivo enviado');
    const url = `/uploads/${file.filename}`;
    const empresa = await this.prisma.empresa.update({
      where: { id },
      data: { logoUrl: url }
    });
    return { url, empresa };
  }

  @Post('usuario/:id/foto')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads',
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `user-${req.params.id}-foto-${uniqueSuffix}${extname(file.originalname)}`);
      }
    })
  }))
  async uploadUsuarioFoto(
    @Param('id') id: string, 
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 })],
      }),
    ) file: Express.Multer.File
  ) {
    if (!file) throw new BadRequestException('Nenhum arquivo enviado');
    const url = `/uploads/${file.filename}`;
    const usuario = await this.prisma.usuario.update({
      where: { id },
      data: { fotoUrl: url }
    });
    return { url, usuario };
  }

  @Post('obra/:id/imagem')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads',
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `${req.params.id}-cover-${uniqueSuffix}${extname(file.originalname)}`);
      }
    })
  }))
  async uploadObraImage(
    @Param('id') id: string, 
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }),
          // new FileTypeValidator({ fileType: 'image' }),
        ],
      }),
    ) file: Express.Multer.File
  ) {
    if (!file) throw new BadRequestException('Nenhum arquivo enviado');
    const url = `/uploads/${file.filename}`;
    const obra = await this.prisma.obra.update({
      where: { id },
      data: { imageUrl: url }
    });
    return { url, obra };
  }

  @UseGuards(JwtAuthGuard, ObraContextGuard)
  @Post('obra/:obraId/rdo/:rdoId/fotos')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads',
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `rdo-${req.params.rdoId}-foto-${uniqueSuffix}${extname(file.originalname)}`);
      }
    })
  }))
  async uploadRdoFoto(
    @Param('obraId') obraId: string, 
    @Param('rdoId') rdoId: string, 
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }), // 10MB limite para fotos
          // new FileTypeValidator({ fileType: 'image' }),
        ],
      }),
    ) file: Express.Multer.File,
    @Req() req: any
  ) {
    if (!file) throw new BadRequestException('Nenhum arquivo enviado');
    const url = `/uploads/${file.filename}`;
    
    const anexo = await this.prisma.anexo.create({
      data: {
        obraId,
        criadorId: req.user.sub || req.user.id,
        origem: 'RDO',
        attachableId: rdoId,
        tipoArquivo: 'FOTO_DIARIO',
        mimeType: file.mimetype,
        tamanhoBytes: file.size,
        urlS3: url
      }
    });

    return { url, anexo };
  }
}
