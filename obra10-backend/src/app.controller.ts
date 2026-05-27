import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Controller()
export class AppController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('health')
  async healthCheck() {
    // Forçar trigger do deploy usando Dockerfile nativo sem startCommand
    console.log('[Health] Verificação de integridade recebida');
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        database: 'connected',
        message: 'Obra 10 - MVP API Operacional (v1.5.3)',
        env: {
          nodeEnv: process.env.NODE_ENV,
          hasEncryptionKey: process.env.ENCRYPTION_KEY ? `defined_len_${process.env.ENCRYPTION_KEY.length}` : 'undefined',
        }
      };
    } catch (error) {
      return {
        status: 'error',
        database: 'disconnected',
        env: {
          nodeEnv: process.env.NODE_ENV,
          hasEncryptionKey: process.env.ENCRYPTION_KEY ? `defined_len_${process.env.ENCRYPTION_KEY.length}` : 'undefined',
        }
      };
    }
  }

  @Get('debug-fs')
  debugFs() {
    const fs = require('fs');
    const path = require('path');
    const cwd = process.cwd();
    const uploadsPath = path.join(cwd, 'uploads');
    let uploadsFiles: string[] = [];
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

  @Get('debug-email')
  async debugEmail() {
    const apiKey = process.env.RESEND_API_KEY;
    const emailFrom = process.env.EMAIL_FROM;
    const appUrl = process.env.APP_URL;
    
    if (!apiKey) {
      return {
        success: false,
        error: 'RESEND_API_KEY is not defined in environment variables.',
        env: { emailFrom, appUrl }
      };
    }

    const maskedKey = apiKey.slice(0, 5) + '...' + apiKey.slice(-5);
    
    try {
      const { Resend } = require('resend');
      const resend = new Resend(apiKey);
      const data = await resend.emails.send({
        from: emailFrom || 'noreply@obra10.com.br',
        to: 'tarcisio@lunardeli.com.br',
        subject: '🧪 Teste de Conexão Resend — OBRA 10',
        html: '<p>Este é um e-mail de diagnóstico enviado pela API do OBRA 10.</p>'
      });
      return {
        success: true,
        data,
        env: {
          hasApiKey: true,
          maskedKey,
          emailFrom,
          appUrl
        }
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message,
        stack: err.stack,
        env: {
          hasApiKey: true,
          maskedKey,
          emailFrom,
          appUrl
        }
      };
    }
  }
}

