import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * Middleware de versionamento de API.
 * Lê o header X-API-Version e injeta no request.
 * Registrado mas sem efeito funcional — prepara infraestrutura para versionamento futuro.
 */
@Injectable()
export class ApiVersionMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const version = req.headers['x-api-version'] || '1';
    (req as any).apiVersion = version;
    next();
  }
}
