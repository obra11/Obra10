import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AuditInterceptor } from './core/interceptors/audit.interceptor';
import { SanitizePipe } from './core/pipes/sanitize.pipe';


function getImgSrcPolicy(): string[] {
  // Domínio público fixo do R2 — fallback obrigatório para garantir que
  // imagens do bucket SEMPRE carreguem, mesmo se a env var estiver ausente.
  const R2_PUBLIC_DOMAIN = 'https://pub-afddad92a0b8456aa8e8ef580b4de8b5.r2.dev';
  const base = ["'self'", 'data:', 'blob:', R2_PUBLIC_DOMAIN];
  try {
    const raw = process.env.AWS_S3_PUBLIC_URL;
    if (raw) {
      const { hostname } = new URL(raw);
      const envDomain = `https://${hostname}`;
      // Se a env var apontar para um domínio diferente do hardcoded, inclui ambos
      if (envDomain !== R2_PUBLIC_DOMAIN) {
        return [...base, envDomain];
      }
    } else {
      console.warn('[CSP] AWS_S3_PUBLIC_URL não definida — usando fallback R2 hardcoded.');
    }
  } catch {
    console.warn('[CSP] AWS_S3_PUBLIC_URL malformada — usando fallback R2 hardcoded.');
  }
  return base;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 0. Logging Interceptor de Auditoria
  app.useGlobalInterceptors(new AuditInterceptor());

  // 1. Helmet: Security Headers completos
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", 'https://sandbox.asaas.com', 'https://asaas.com'],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          imgSrc: getImgSrcPolicy(),
          connectSrc: ["'self'"],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          objectSrc: ["'none'"],
          frameSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
        },
      },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      hsts: { maxAge: 31536000, includeSubDomains: true },
      frameguard: { action: 'deny' },
    }),
  );

  // 1b. Custom security headers not covered by helmet
  app.use((req: any, res: any, next: any) => {
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=()',
    );
    next();
  });

  // 2. Parsers
  app.use(cookieParser());

  // 3. CORS Estrito com suporte a Cookies (Credentials)
  const allowedOrigins = (
    process.env.CORS_ORIGINS ||
    process.env.FRONTEND_URL ||
    'http://localhost:5173,http://localhost:5183'
  )
    .split(',')
    .map((o: string) => o.trim());
  app.enableCors({
    origin: allowedOrigins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
    exposedHeaders: ['x-xsrf-token'],
  });

  // 4. Global Pipes: Sanitização XSS + Validação de DTOs
  app.useGlobalPipes(
    new SanitizePipe(),
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
bootstrap();
