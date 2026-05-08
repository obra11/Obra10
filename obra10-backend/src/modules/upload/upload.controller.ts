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
import { memoryStorage } from 'multer';
import { extname } from 'path';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
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
  private readonly s3Client: S3Client;
  private readonly bucketName = process.env.AWS_S3_BUCKET_NAME || 'obra10-mvp';

  constructor(private readonly prisma: PrismaService) {
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || 'sa-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'dummy',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'dummy',
      },
    });
  }

  private async processUpload(file: Express.Multer.File, folder: string): Promise<string> {
    const fileName = safeFilename(file.originalname);
    
    // AWS S3 / Cloudflare R2 Upload
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_S3_PUBLIC_URL) {
      const s3Key = `uploads/${folder}/${fileName}`;
      await this.s3Client.send(new PutObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
        Body: file.buffer,
        ContentType: file.mimetype,
      }));
      const baseUrl = process.env.AWS_S3_PUBLIC_URL.replace(/\/$/, '');
      return `${baseUrl}/${s3Key}`;
    }

    // Fallback: Local Disk
    const dir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, fileName), file.buffer);
    return `/uploads/${fileName}`;
  }

  @Post('empresa/:id/logo')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
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
    if (req.user.empresaId !== id && req.user.perfilGlobal !== 'SUPER_ADMIN') {
      throw new ForbiddenException(
        'Sem permissão para alterar o logo desta empresa.',
      );
    }
    if (!file) throw new BadRequestException('Nenhum arquivo enviado');
    const url = await this.processUpload(file, 'logos');
    const empresa = await this.prisma.empresa.update({
      where: { id },
      data: { logoUrl: url },
    });
    return { url, empresa };
  }

  @Post('usuario/:id/foto')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
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
    const url = await this.processUpload(file, 'usuarios');
    const usuario = await this.prisma.usuario.update({
      where: { id },
      data: { fotoUrl: url },
    });
    return { url, usuario };
  }

  @Post('obra/:id/imagem')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
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
    const obra = await this.prisma.obra.findUnique({
      where: { id },
      select: { empresaId: true },
    });
    if (!obra || obra.empresaId !== req.user.empresaId) {
      throw new ForbiddenException('Obra não pertence à sua empresa.');
    }
    if (!file) throw new BadRequestException('Nenhum arquivo enviado');
    const url = await this.processUpload(file, 'obras');
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
      storage: memoryStorage(),
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
    const url = await this.processUpload(file, `rdos/${rdoId}`);

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
