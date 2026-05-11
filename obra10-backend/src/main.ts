import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AuditInterceptor } from './core/interceptors/audit.interceptor';
import { SanitizePipe } from './core/pipes/sanitize.pipe';


function getImgSrcPolicy(): string[] {
  const base = ["'self'", 'data:', 'blob:'];
  try {
    const raw = process.env.AWS_S3_PUBLIC_URL;
    if (raw) {
      const { hostname } = new URL(raw);
      if (hostname) return [...base, `https://${hostname}`];
    }
  } catch {
    // env var malformada — continua só com 'self'
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
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: getImgSrcPolicy(),
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
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
    'http://localhost:5173'
  )
    .split(',')
    .map((o: string) => o.trim());
  app.enableCors({
    origin: allowedOrigins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
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
