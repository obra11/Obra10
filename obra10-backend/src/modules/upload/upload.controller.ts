import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  Param,
  BadRequestException,
  ForbiddenException,
  UseGuards,
  Req,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { ObraContextGuard } from '../../core/guards/obra-context.guard';

/** Generates a UUID-based filename to prevent path traversal attacks */
function safeFilename(originalname: string): string {
  return `${crypto.randomUUID()}${extname(originalname).toLowerCase()}`;
}

/** Allowed image MIME types */
const ALLOWED_IMAGE_TYPES = /^image\/(jpeg|jpg|png|gif|webp|svg\+xml)$/;
/** Allowed document MIME types (for RDO attachments) */
const ALLOWED_DOC_TYPES =
  /^(image\/(jpeg|jpg|png|gif|webp)|application\/(pdf|vnd\.openxmlformats-officedocument\.(spreadsheetml\.sheet|wordprocessingml\.document))|video\/mp4)$/;

@UseGuards(JwtAuthGuard)
@Controller('upload')
export class UploadController {
  constructor(private readonly prisma: PrismaService) {}

  @Post('empresa/:id/logo')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (_req, file, cb) => cb(null, safeFilename(file.originalname)),
      }),
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_IMAGE_TYPES.test(file.mimetype)) {
          return cb(
            new BadRequestException(
              'Tipo de arquivo não permitido. Envie apenas imagens (jpg, png, gif, webp).',
            ),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  async uploadLogo(
    @Param('id') id: string,
    @Req() req: any,
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 })],
      }),
    )
    file: Express.Multer.File,
  ) {
    // Permission check: only users from same empresa can change logo
    if (req.user.empresaId !== id && req.user.perfilGlobal !== 'SUPER_ADMIN') {
      throw new ForbiddenException(
        'Sem permissão para alterar o logo desta empresa.',
      );
    }
    if (!file) throw new BadRequestException('Nenhum arquivo enviado');
    const url = `/uploads/${file.filename}`;
    const empresa = await this.prisma.empresa.update({
      where: { id },
      data: { logoUrl: url },
    });
    return { url, empresa };
  }

  @Post('usuario/:id/foto')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (_req, file, cb) => cb(null, safeFilename(file.originalname)),
      }),
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_IMAGE_TYPES.test(file.mimetype)) {
          return cb(
            new BadRequestException(
              'Tipo de arquivo não permitido. Envie apenas imagens.',
            ),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  async uploadUsuarioFoto(
    @Param('id') id: string,
    @Req() req: any,
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 })],
      }),
    )
    file: Express.Multer.File,
  ) {
    // Permission check: only the user themselves or a GESTOR from same empresa
    const isOwner = req.user.sub === id;
    const isGestor =
      req.user.perfilGlobal === 'GESTOR' ||
      req.user.perfilGlobal === 'SUPER_ADMIN';
    if (!isOwner && !isGestor) {
      throw new ForbiddenException(
        'Sem permissão para alterar a foto deste usuário.',
      );
    }
    if (!file) throw new BadRequestException('Nenhum arquivo enviado');
    const url = `/uploads/${file.filename}`;
    const usuario = await this.prisma.usuario.update({
      where: { id },
      data: { fotoUrl: url },
    });
    return { url, usuario };
  }

  @Post('obra/:id/imagem')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (_req, file, cb) => cb(null, safeFilename(file.originalname)),
      }),
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_IMAGE_TYPES.test(file.mimetype)) {
          return cb(
            new BadRequestException(
              'Tipo de arquivo não permitido. Envie apenas imagens.',
            ),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  async uploadObraImage(
    @Param('id') id: string,
    @Req() req: any,
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 })],
      }),
    )
    file: Express.Multer.File,
  ) {
    // Permission check: obra must belong to user's empresa
    const obra = await this.prisma.obra.findUnique({
      where: { id },
      select: { empresaId: true },
    });
    if (!obra || obra.empresaId !== req.user.empresaId) {
      throw new ForbiddenException('Obra não pertence à sua empresa.');
    }
    if (!file) throw new BadRequestException('Nenhum arquivo enviado');
    const url = `/uploads/${file.filename}`;
    const updated = await this.prisma.obra.update({
      where: { id },
      data: { imageUrl: url },
    });
    return { url, obra: updated };
  }

  @UseGuards(ObraContextGuard)
  @Post('obra/:obraId/rdo/:rdoId/fotos')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (_req, file, cb) => cb(null, safeFilename(file.originalname)),
      }),
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_DOC_TYPES.test(file.mimetype)) {
          return cb(
            new BadRequestException(
              'Tipo de arquivo não permitido. Aceitos: jpg, png, pdf, xlsx, docx, mp4.',
            ),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  async uploadRdoFoto(
    @Param('obraId') obraId: string,
    @Param('rdoId') rdoId: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 })],
      }),
    )
    file: Express.Multer.File,
    @Req() req: any,
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
        urlS3: url,
      },
    });

    return { url, anexo };
  }
}
