import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    let token = req.cookies['XSRF-TOKEN'];

    if (!token) {
      token = crypto.randomUUID();
      // O cookie do CSRF não pode ser HttpOnly para permitir compatibilidade,
      // e em produção usamos sameSite: 'none' devido ao ambiente cross-site (Railway).
      res.cookie('XSRF-TOKEN', token, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        path: '/',
      });
    }

    // Definimos o cabeçalho de resposta para que o frontend (cross-origin) consiga
    // ler o token via JavaScript (interceptores Axios) e usá-lo como fallback.
    res.setHeader('x-xsrf-token', token);

    // Rotas seguras que não mutam estado
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
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
}
