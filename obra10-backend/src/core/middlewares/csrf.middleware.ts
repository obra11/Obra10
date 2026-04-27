import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Rotas seguras que não mutam estado
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      this.ensureCsrfCookie(req, res);
      return next();
    }

    // Validação Double Submit Cookie para POST/PUT/DELETE/PATCH
    const cookieToken = req.cookies['XSRF-TOKEN'];
    const headerToken = req.headers['x-xsrf-token'];

    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
      throw new ForbiddenException(
        'Falha de verificação CSRF (Cross-Site Request Forgery)',
      );
    }

    next();
  }

  private ensureCsrfCookie(req: Request, res: Response) {
    if (!req.cookies['XSRF-TOKEN']) {
      const token = crypto.randomUUID();
      // Este cookie NÃO PODE ser HttpOnly, pois o Axios/Frontend precisa ler para devolver no Header
      res.cookie('XSRF-TOKEN', token, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
      });
    }
  }
}
