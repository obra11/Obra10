import { Controller, Post, Body, Get, Req, Res, UseGuards, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('login')
  async login(@Body() body: any, @Res({ passthrough: true }) res: Response) {
    const email = body.email;
    const senha = body.senha; // padronizado: apenas 'senha'
    let empresaId = body.empresaId;

    if (!email || !senha) {
      throw new BadRequestException('Email e senha são obrigatórios.');
    }

    // Auto-lookup empresaId if not provided (find empresa by user email)
    if (!empresaId) {
      const usuario = await this.prisma.usuario.findFirst({
        where: { email, ativo: true },
        select: { empresaId: true },
      });
      if (!usuario) throw new UnauthorizedException('Credenciais inválidas.');
      empresaId = usuario.empresaId;
    }

    const result = await this.authService.login(email, senha, empresaId);
    
    res.cookie('obra10_token', result.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 3600000 // 1h
    });

    const { access_token, ...userData } = result;
    return userData;
  }

  @Post('logout')
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('obra10_token');
    return { success: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@Req() req: any) {
    const userId = req.user?.sub;
    if (!userId) throw new UnauthorizedException('Token Jwt Inválido');
    return this.authService.getMe(userId);
  }

  @Post('esqueci-senha')
  async esqueciSenha(@Body('email') email: string) {
    if (!email) throw new BadRequestException('E-mail é obrigatório');
    return this.authService.esqueciSenha(email);
  }

  @Post('redefinir-senha')
  async redefinirSenha(@Body() body: any) {
    const { token, novaSenha } = body;
    if (!token || !novaSenha) throw new BadRequestException('Token e Nova Senha são obrigatórios');
    return this.authService.redefinirSenha(token, novaSenha);
  }
}
