import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

/** Paths that access personal data — GETs to these paths are logged too */
const PERSONAL_DATA_PATHS = ['/auth/meus-dados', '/auth/me', '/usuarios'];

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger('Audit');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const { method, url, ip } = request;
    const user = (request as any).user;
    const userStr = user ? `USER:${user.sub}|EMP:${user.empresaId || '?'}` : 'ANON';

    return next.handle().pipe(
      tap({
        next: () => {
          // Log all mutations
          if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
            this.logger.log(`[OK] ${method} ${url} | ${userStr} | IP:${ip}`);
          }
          // Log GETs to personal data endpoints (LGPD audit trail)
          if (method === 'GET' && PERSONAL_DATA_PATHS.some(p => url.startsWith(p))) {
            this.logger.log(`[LGPD-READ] GET ${url} | ${userStr} | IP:${ip}`);
          }
        },
        error: (err: any) => {
          const status = err.status || 500;
          this.logger.warn(`[FAIL] ${method} ${url} | ${userStr} | IP:${ip} | ${status}: ${err.message}`);
        },
      }),
    );
  }
}

