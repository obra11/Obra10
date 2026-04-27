import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class AnexosService {
  private readonly s3Client: S3Client;
  private readonly logger = new Logger(AnexosService.name);
  private bucketName = process.env.AWS_S3_BUCKET_NAME || 'obra10-mvp';

  constructor(private readonly prisma: PrismaService) {
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || 'sa-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'dummy-key',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'dummy-secret',
      },
    });
  }

  async criarPresignedUpload(obraId: string, criadorId: string, dto: any) {
    const {
      attachableId,
      origemAnexo,
      tipoArquivo,
      nomeOriginal,
      mimeType,
      tamanhoBytes,
    } = dto;

    // Regra B2B Mínima: Verificar se a Entidade-Mãe realmente pertence à Obra passada no Header
    // Obs: Expansível para RDO_ATIVIDADE etc, aqui checamos genericamente pelo RDO
    if (origemAnexo === 'RDO' || origemAnexo === 'RDO_ATIVIDADE') {
      const rdoBase = await this.prisma.rdo.findFirst({
        where: { obraId, deletedAt: null },
      });
      if (!rdoBase)
        throw new ForbiddenException(
          'A entidade destino não pertence a esta Obra ativa.',
        );
    }

    // 1. Chave Única (Path) no Bucket S3
    const extensao = nomeOriginal.split('.').pop() || 'bin';
    const filePathS3 = `obras/${obraId}/${origemAnexo}/${attachableId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${extensao}`;

    // 2. Mock Presigned URL se não houver Env da AWS (Para Dev não quebrar localmente)
    let uploadUrl = `http://localhost:3000/mock-s3-uploaddir/${encodeURIComponent(filePathS3)}`;

    if (process.env.AWS_ACCESS_KEY_ID) {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: filePathS3,
        ContentType: mimeType,
      });
      uploadUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn: 3600,
      }); // Upload vale por 1h
    } else {
      this.logger.warn(
        'Gerando Presigned PUT URL FAKE pois AWS_ACCESS_KEY_ID inexiste em Env',
      );
    }

    // 3. Salvar registro lógico no Banco ("Rascunho de Anexo")
    const anexo = await this.prisma.anexo.create({
      data: {
        obraId,
        criadorId,
        origem: origemAnexo,
        attachableId,
        tipoArquivo,
        nomeOriginal,
        mimeType,
        tamanhoBytes: Number(tamanhoBytes),
        urlS3: filePathS3,
      },
    });

    return { anexoId: anexo.id, uploadUrl };
  }

  async gerarViewerUrlSegura(anexoId: string, obraId: string) {
    const anexo = await this.prisma.anexo.findFirst({
      where: { id: anexoId, obraId, deletedAt: null },
    });

    if (!anexo)
      throw new NotFoundException(
        'Anexo não encontrado, apagado ou não pertence à Obra logada.',
      );

    let viewUrl = `http://localhost:3000/mock-s3-viewdir/${encodeURIComponent(anexo.urlS3)}`;

    if (process.env.AWS_ACCESS_KEY_ID) {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: anexo.urlS3,
      });
      viewUrl = await getSignedUrl(this.s3Client, command, { expiresIn: 3600 }); // Token de visualização de 1h
    }

    return { ...anexo, viewUrl };
  }

  async listarDaOrigem(obraId: string, origemAnexo: any, attachableId: string) {
    return this.prisma.anexo.findMany({
      where: { obraId, origem: origemAnexo, attachableId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        tipoArquivo: true,
        nomeOriginal: true,
        createdAt: true,
        criador: { select: { nome: true } },
      },
    });
  }
}
