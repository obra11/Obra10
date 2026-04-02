import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AuditInterceptor } from './core/interceptors/audit.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 0. Logging Interceptor de Auditoria
  app.useGlobalInterceptors(new AuditInterceptor());

  // 1. Helmet: Security Headers (DNS Prefetch, MIME Sniffing, XSS Filters)
  app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
  }));

  // 2. Parsers
  app.use(cookieParser());

  // 3. CORS Estrito com suporte a Cookies (Credentials)
  const allowedOrigins = (process.env.CORS_ORIGINS || process.env.FRONTEND_URL || 'http://localhost:5173')
    .split(',').map((o: string) => o.trim());
  app.enableCors({
    origin: allowedOrigins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // 4. Global Validation Pipe: Rejeita payloads fantasmas e não mapados em DTOs
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
bootstrap();
