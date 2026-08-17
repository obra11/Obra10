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
  Body,
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
import { CapabilitiesService } from '../../core/capabilities/capabilities.service';

/** Generates a UUID-based filename to prevent path traversal attacks */
function safeFilename(originalname: string): string {
  return `${crypto.randomUUID()}${extname(originalname).toLowerCase()}`;
}

/** Allowed image MIME types */
const ALLOWED_IMAGE_TYPES = /^image\/(jpeg|jpg|png|gif|webp|svg\+xml|heic|heif)$/i;
/** Allowed document/media MIME types (for RDO attachments) — inclui formatos de celular */
const ALLOWED_DOC_TYPES =
  /^(image\/(jpeg|jpg|png|gif|webp|heic|heif)|application\/(pdf|msword|vnd\.ms-excel|vnd\.ms-powerpoint|vnd\.openxmlformats-officedocument\.(spreadsheetml\.sheet|wordprocessingml\.document|presentationml\.presentation))|video\/(mp4|quicktime|webm|3gpp|3gpp2|x-msvideo|avi|mpeg|ogg|x-m4v|x-matroska))$/i;
/** Extensões aceitas quando o browser manda MIME vazio/octet-stream (comum no iOS/Android) */
const ALLOWED_UPLOAD_EXTS =
  /\.(jpe?g|png|gif|webp|heic|heif|pdf|xlsx?|docx?|pptx?|mp4|mov|webm|avi|mkv|3gp|m4v|ogv)$/i;

function isAllowedRdoUpload(file: {
  mimetype?: string;
  originalname?: string;
}): boolean {
  if (file.mimetype && ALLOWED_DOC_TYPES.test(file.mimetype)) return true;
  // iOS/Android às vezes mandam application/octet-stream ou string vazia
  if (
    (!file.mimetype ||
      file.mimetype === 'application/octet-stream' ||
      file.mimetype === 'binary/octet-stream') &&
    ALLOWED_UPLOAD_EXTS.test(file.originalname || '')
  ) {
    return true;
  }
  return ALLOWED_UPLOAD_EXTS.test(file.originalname || '');
}

function resolveMimeType(file: Express.Multer.File): string {
  if (file.mimetype && file.mimetype !== 'application/octet-stream') {
    return file.mimetype;
  }
  const name = (file.originalname || '').toLowerCase();
  if (name.endsWith('.mov')) return 'video/quicktime';
  if (name.endsWith('.webm')) return 'video/webm';
  if (name.endsWith('.3gp')) return 'video/3gpp';
  if (name.endsWith('.m4v')) return 'video/x-m4v';
  if (name.endsWith('.mkv')) return 'video/x-matroska';
  if (name.endsWith('.avi')) return 'video/x-msvideo';
  if (name.endsWith('.mp4')) return 'video/mp4';
  if (name.endsWith('.pdf')) return 'application/pdf';
  if (name.endsWith('.docx')) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
  if (name.endsWith('.doc')) return 'application/msword';
  if (name.endsWith('.xlsx')) {
    return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  }
  if (name.endsWith('.xls')) return 'application/vnd.ms-excel';
  if (name.endsWith('.pptx')) {
    return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  }
  if (name.endsWith('.ppt')) return 'application/vnd.ms-powerpoint';
  if (/\.jpe?g$/.test(name)) return 'image/jpeg';
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.heic') || name.endsWith('.heif')) return 'image/heic';
  return file.mimetype || 'application/octet-stream';
}

function tipoArquivoFromMime(mime: string): string {
  if (mime.startsWith('video/')) return 'VIDEO_DIARIO';
  if (mime.startsWith('image/')) return 'FOTO_DIARIO';
  return 'ANEXO_DIARIO';
}

@UseGuards(JwtAuthGuard)
@Controller('upload')
export class UploadController {
  private readonly s3Client: S3Client;
  private readonly bucketName = process.env.AWS_S3_BUCKET_NAME || 'obra10-mvp';

  constructor(
    private readonly prisma: PrismaService,
    private readonly capabilities: CapabilitiesService,
  ) {
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || 'auto',
      endpoint: process.env.AWS_S3_ENDPOINT || undefined,
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
      try {
        const s3Key = `uploads/${folder}/${fileName}`;
        await this.s3Client.send(new PutObjectCommand({
          Bucket: this.bucketName,
          Key: s3Key,
          Body: file.buffer,
          ContentType: file.mimetype,
        }));
        const baseUrl = process.env.AWS_S3_PUBLIC_URL.replace(/\/$/, '');
        return `${baseUrl}/${s3Key}`;
      } catch (err: any) {
        console.error('S3 Upload Error:', err);
        throw new BadRequestException(`Erro no provedor de nuvem (R2/S3): ${err.message}. Verifique as variáveis de ambiente AWS_S3_ENDPOINT, AWS_ACCESS_KEY_ID, etc.`);
      }
    }

    // Fallback: Local Disk
    try {
      const dir = path.join(process.cwd(), 'uploads');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, fileName), file.buffer);
      return `/uploads/${fileName}`;
    } catch (err: any) {
      console.error('Local Upload Error:', err);
      throw new BadRequestException(`Erro ao salvar arquivo no disco local: ${err.message}`);
    }
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
        validators: [new MaxFileSizeValidator({ maxSize: 15 * 1024 * 1024 })],
      }),
    )
    file: Express.Multer.File,
  ) {
    if (req.user.empresaId !== id && req.user.perfilGlobal !== 'SUPER_ADMIN') {
      throw new ForbiddenException(
        'Sem permissão para alterar o logo desta empresa.',
      );
    }
    if (req.user.perfilGlobal !== 'SUPER_ADMIN') {
      const pode = await this.capabilities.hasCapability(
        req.user.sub,
        'gerenciarEmpresa',
      );
      if (!pode) {
        throw new ForbiddenException(
          'Sem permissão para alterar o logo desta empresa.',
        );
      }
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
        validators: [new MaxFileSizeValidator({ maxSize: 15 * 1024 * 1024 })],
      }),
    )
    file: Express.Multer.File,
  ) {
    const isOwner = req.user.sub === id;
    const isAdmin = req.user.perfilGlobal === 'SUPER_ADMIN';
    const podeGerenciar = isAdmin
      ? true
      : await this.capabilities.hasCapability(req.user.sub, 'gerenciarUsuarios');
    if (!isOwner && !podeGerenciar) {
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
        validators: [new MaxFileSizeValidator({ maxSize: 15 * 1024 * 1024 })],
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
        if (!isAllowedRdoUpload(file)) {
          return cb(
            new BadRequestException(
              'Tipo de arquivo não permitido. Aceitos: jpg, png, heic, pdf, doc, docx, xls, xlsx, ppt, pptx, mp4, mov, webm, 3gp.',
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
        validators: [new MaxFileSizeValidator({ maxSize: 50 * 1024 * 1024 })],
      }),
    )
    file: Express.Multer.File,
    @Body('legenda') legenda: string,
    @Req() req: any,
  ) {
    if (!file) throw new BadRequestException('Nenhum arquivo enviado');
    const mimeType = resolveMimeType(file);
    // Garante Content-Type correto no S3/local mesmo se o browser mandou MIME vazio
    file.mimetype = mimeType;
    const url = await this.processUpload(file, `rdos/${rdoId}`);

    const anexo = await this.prisma.anexo.create({
      data: {
        obraId,
        criadorId: req.user.sub || req.user.id,
        origem: 'RDO',
        attachableId: rdoId,
        tipoArquivo: tipoArquivoFromMime(mimeType),
        mimeType,
        tamanhoBytes: file.size,
        urlS3: url,
        nomeOriginal: legenda || file.originalname,
      },
    });

    return { url, anexo };
  }
}
