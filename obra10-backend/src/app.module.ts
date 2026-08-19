import {
  Module,
  NestModule,
  MiddlewareConsumer,
  RequestMethod,
} from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { ObraModule } from './modules/obra/obra.module';
import { RdoModule } from './modules/rdo/rdo.module';
import { AnexosModule } from './modules/anexos/anexos.module';
import { UploadModule } from './modules/upload/upload.module';
import { CsrfMiddleware } from './core/middlewares/csrf.middleware';
import { AiModule } from './modules/ai/ai.module';
import { TenantModule } from './modules/tenant/tenant.module';
import { UsuariosModule } from './modules/usuarios/usuarios.module';
import { CobrancaModule } from './modules/cobranca/cobranca.module';
import { EmailModule } from './modules/email/email.module';
import { ModulosModule } from './modules/modulos/modulos.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { CryptoModule } from './core/services/crypto.module';
import { CapabilitiesModule } from './core/capabilities/capabilities.module';
import { CupomModule } from './modules/cupom/cupom.module';
import { AdminModule } from './modules/admin/admin.module';
import { FeatureModule } from './modules/feature/feature.module';
import { CatalogoModule } from './modules/catalogo/catalogo.module';
import { ContatoModule } from './modules/contato/contato.module';
import { SuporteModule } from './modules/suporte/suporte.module';
import { ApiVersionMiddleware } from './core/middlewares/api-version.middleware';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    CryptoModule,
    CapabilitiesModule,
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100, // max 100 requests per IP per minute
      },
    ]),
    ServeStaticModule.forRoot(
      {
        rootPath: join(process.cwd(), 'client'),
        serveStaticOptions: {
          setHeaders: (res, filePath) => {
            const p = String(filePath).replace(/\\/g, '/');
            if (
              p.endsWith('/index.html') ||
              p.endsWith('/sw.js') ||
              p.endsWith('/manifest.json') ||
              p.endsWith('/version.json') ||
              p.endsWith('.html')
            ) {
              res.setHeader(
                'Cache-Control',
                'no-store, no-cache, must-revalidate, proxy-revalidate',
              );
              res.setHeader('Pragma', 'no-cache');
              res.setHeader('Expires', '0');
              if (p.endsWith('/manifest.json')) {
                res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
              }
            } else if (p.includes('/assets/')) {
              // hashed assets can be cached long
              res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
            }
          },
        },
      },
      {
        rootPath: join(process.cwd(), 'uploads'),
        serveRoot: '/uploads',
        serveStaticOptions: { index: false },
      },
    ),
    PrismaModule,
    AuthModule,
    ObraModule,
    RdoModule,
    AnexosModule,
    UploadModule,
    AiModule,
    TenantModule,
    UsuariosModule,
    CobrancaModule,
    EmailModule,
    ModulosModule,
    CupomModule,
    AdminModule,
    FeatureModule,
    CatalogoModule,
    SuporteModule,
    ContatoModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(CsrfMiddleware)
      .exclude(
        { path: 'auth/login', method: RequestMethod.POST },
        { path: 'auth/esqueci-senha', method: RequestMethod.POST },
        { path: 'auth/redefinir-senha', method: RequestMethod.POST },
        { path: 'tenants/register', method: RequestMethod.POST },
        { path: 'tenants/reenviar-verificacao', method: RequestMethod.POST },
        { path: 'cobrancas/webhook/asaas', method: RequestMethod.POST },
      )
      .forRoutes('*');

    // API Version middleware — passivo, prepara infraestrutura
    consumer
      .apply(ApiVersionMiddleware)
      .forRoutes('*');
  }
}
