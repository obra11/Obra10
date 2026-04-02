import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleOrphanFiles() {
    this.logger.log('Iniciando varredura de arquivos órfãos para sanitização de peso inativo...');
    const uploadsDir = path.join(__dirname, '..', '..', '..', 'uploads');
    
    if (!fs.existsSync(uploadsDir)) return;

    const filesOnDisk = fs.readdirSync(uploadsDir);
    const anexosList = await this.prisma.anexo.findMany({ select: { urlS3: true } });
    const urlsValidas = anexosList.map(a => a.urlS3.replace('/uploads/', ''));
    
    // Coleta as fotos singulares
    const empresasList = await this.prisma.empresa.findMany({ where: { logoUrl: { not: null } }, select: { logoUrl: true } });
    const obrasList = await this.prisma.obra.findMany({ where: { imageUrl: { not: null } }, select: { imageUrl: true } });
    
    urlsValidas.push(...empresasList.map(e => e.logoUrl!.replace('/uploads/', '')));
    urlsValidas.push(...obrasList.map(o => o.imageUrl!.replace('/uploads/', '')));

    let deletedCount = 0;
    for (const file of filesOnDisk) {
      if (!urlsValidas.includes(file)) {
        try {
          fs.unlinkSync(path.join(uploadsDir, file));
          deletedCount++;
        } catch (e) {
          this.logger.error(`Falha ao remover arquivo cego: ${file}`);
        }
      }
    }
    
    this.logger.log(`Varredura concluída. ${deletedCount} arquivos invisíveis (órfãos) destruídos com sucesso.`);
  }
}
