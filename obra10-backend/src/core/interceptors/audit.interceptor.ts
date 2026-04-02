import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger('App-SecOps-Audit');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();
    const { method, url, ip } = request;

    return next.handle().pipe(
      tap({
        next: (data: any) => {
          if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
             const userStr = (request as any).user ? `USER:${(request as any).user.sub}` : 'VISITANTE';
             this.logger.log(`[SUCESSO] Mutação: ${method} ${url} | IP: ${ip} | AUTHOR: ${userStr}`);
          }
        },
        error: (err: any) => {
          const status = err.status || 500;
          this.logger.warn(`[INCIDENTE] Falha/Negação ${method} ${url} | IP: ${ip} | STATUS: ${status} | DETALHE: ${err.message}`);
        }
      })
    );
  }
}
