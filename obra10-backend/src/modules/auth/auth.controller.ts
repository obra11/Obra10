import {
  Controller,
  Post,
  Body,
  Get,
  Delete,
  Req,
  Res,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto, EsqueciSenhaDto, RedefinirSenhaDto } from './dto/auth.dto';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Auto-lookup empresaId if not provided
    let empresaId = dto.empresaId;
    if (!empresaId) {
      const usuario = await this.prisma.usuario.findFirst({
        where: { email: dto.email, ativo: true },
        select: { empresaId: true },
      });
      if (!usuario) throw new UnauthorizedException('Credenciais inválidas.');
      empresaId = usuario.empresaId;
    }

    const result = await this.authService.login(
      dto.email,
      dto.senha,
      empresaId,
    );

    res.cookie('obra10_token', result.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 3600000, // 1h
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

  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Post('esqueci-senha')
  async esqueciSenha(@Body() dto: EsqueciSenhaDto) {
    return this.authService.esqueciSenha(dto.email);
  }

  @Post('redefinir-senha')
  async redefinirSenha(@Body() dto: RedefinirSenhaDto) {
    return this.authService.redefinirSenha(dto.token, dto.novaSenha);
  }

  // ==================== LGPD ====================

  @UseGuards(JwtAuthGuard)
  @Get('meus-dados')
  async getMeusDados(@Req() req: any) {
    return this.authService.getMeusDados(req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('minha-conta')
  async anonimizarConta(
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.anonimizarConta(req.user.sub);
    res.clearCookie('obra10_token');
    return {
      success: true,
      message:
        'Conta anonimizada com sucesso. Seus dados pessoais foram removidos.',
    };
  }
}
