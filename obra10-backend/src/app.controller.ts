import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Controller()
export class AppController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('health')
  async healthCheck() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        database: 'connected',
        message: 'Obra 10 - MVP API Operacional',
      };
    } catch (error) {
      return {
        status: 'error',
        database: 'disconnected',
      };
    }
  }

  @Get('debug-fs')
  debugFs() {
    const fs = require('fs');
    const path = require('path');
    const cwd = process.cwd();
    const uploadsPath = path.join(cwd, 'uploads');
    let uploadsFiles = [];
    try {
      uploadsFiles = fs.readdirSync(uploadsPath);
    } catch (e) {
      uploadsFiles = [e.message];
    }
    return {
      cwd,
      cwdFiles: fs.readdirSync(cwd),
      uploadsPath,
      uploadsFiles,
      dirname: __dirname,
    };
  }
}
