import { BadRequestException } from '@nestjs/common';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import * as fs from 'fs';
import * as path from 'path';

const MAX_BYTES = 15 * 1024 * 1024;

function mimeDe(file: Express.Multer.File): string {
  const name = (file.originalname || '').toLowerCase();
  if (file.mimetype && file.mimetype !== 'application/octet-stream') return file.mimetype;
  if (name.endsWith('.pdf')) return 'application/pdf';
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.webp')) return 'image/webp';
  if (name.endsWith('.gif')) return 'image/gif';
  if (name.endsWith('.heic') || name.endsWith('.heif')) return 'image/heic';
  return 'image/jpeg';
}

export function arquivoEntradaValido(file?: Express.Multer.File) {
  if (!file?.buffer?.length) {
    throw new BadRequestException('Envie uma foto ou um PDF.');
  }
  if (file.size > MAX_BYTES) {
    throw new BadRequestException('O arquivo passa de 15 MB.');
  }
  const mime = mimeDe(file);
  const ok =
    /^image\/(jpeg|jpg|png|gif|webp|heic|heif)$/i.test(mime) || mime === 'application/pdf';
  if (!ok) {
    throw new BadRequestException('Use uma imagem (JPG, PNG, WEBP) ou PDF.');
  }
  return mime;
}

export function imagemParaVisao(mime: string): boolean {
  return /^image\/(jpeg|jpg|png|gif|webp)$/i.test(mime);
}

export async function gravarArquivoEntrada(
  file: Express.Multer.File,
  mime: string,
  pasta = 'notas-entrada',
): Promise<string> {
  const fileName = `${randomUUID()}${extname(file.originalname || '').toLowerCase() || (mime === 'application/pdf' ? '.pdf' : '.jpg')}`;
  const keyId = process.env.AWS_ACCESS_KEY_ID?.trim();
  const pub = process.env.AWS_S3_PUBLIC_URL?.trim();
  const nuvem = Boolean(keyId && pub && keyId !== 'dummy');

  if (nuvem) {
    const bucket = process.env.AWS_S3_BUCKET_NAME || 'obra10-mvp';
    const s3 = new S3Client({
      region: process.env.AWS_REGION || 'auto',
      endpoint: process.env.AWS_S3_ENDPOINT || undefined,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });
    const s3Key = `uploads/${pasta}/${fileName}`;
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: s3Key,
        Body: file.buffer,
        ContentType: mime,
      }),
    );
    return `${pub!.replace(/\/$/, '')}/${s3Key}`;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new BadRequestException(
      'Upload em produção exige armazenamento em nuvem (AWS_ACCESS_KEY_ID e AWS_S3_PUBLIC_URL).',
    );
  }

  const dir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, fileName), file.buffer);
  return `/uploads/${fileName}`;
}
