import { Controller, Get, Header } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';

function readClientVersion(): Record<string, unknown> {
  const candidates = [
    path.join(process.cwd(), 'client', 'version.json'),
    path.join(__dirname, '..', '..', 'client', 'version.json'),
  ];
  for (const file of candidates) {
    try {
      if (fs.existsSync(file)) {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
      }
    } catch {
      /* try next */
    }
  }
  return {
    version: 'unknown',
    buildId: 'unknown',
    releasedAt: null,
    channel: process.env.NODE_ENV || 'unknown',
    name: 'Obra 10',
  };
}

@Controller()
export class AppController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('version')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate')
  getVersion() {
    return {
      ...readClientVersion(),
      api: '1.5.6',
      checkedAt: new Date().toISOString(),
    };
  }

  @Get('health')
  async healthCheck() {
    console.log('[Health] Verificação de integridade recebida');
    const app = readClientVersion();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        database: 'connected',
        message: 'Obra 10 - MVP API Operacional (v1.5.6)',
        app,
        env: {
          nodeEnv: process.env.NODE_ENV,
          hasEncryptionKey: process.env.ENCRYPTION_KEY
            ? `defined_len_${process.env.ENCRYPTION_KEY.length}`
            : 'undefined',
        },
      };
    } catch {
      return {
        status: 'error',
        database: 'disconnected',
        app,
        env: {
          nodeEnv: process.env.NODE_ENV,
          hasEncryptionKey: process.env.ENCRYPTION_KEY
            ? `defined_len_${process.env.ENCRYPTION_KEY.length}`
            : 'undefined',
        },
      };
    }
  }

  @Get('debug-fs')
  debugFs() {
    const cwd = process.cwd();
    const uploadsPath = path.join(cwd, 'uploads');
    let uploadsFiles: string[] = [];
    try {
      uploadsFiles = fs.readdirSync(uploadsPath);
    } catch (e: any) {
      uploadsFiles = [e.message];
    }
    return {
      cwd,
      cwdFiles: fs.readdirSync(cwd),
      uploadsPath,
      uploadsFiles,
      dirname: __dirname,
      clientVersion: readClientVersion(),
    };
  }
}
