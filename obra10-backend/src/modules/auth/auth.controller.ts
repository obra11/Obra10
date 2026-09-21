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
import {
  LoginDto,
  EsqueciSenhaDto,
  RedefinirSenhaDto,
  TrocarEmpresaDto,
} from './dto/auth.dto';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';

function attachAuthCookie(res: Response, token: string) {
  res.cookie('obra10_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
    maxAge: 3600000,
  });
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const email = String(dto.email || '').trim().toLowerCase();
    const senha = String(dto.senha || '');
    const result = await this.authService.login(email, senha, dto.empresaId);

    if ('precisaEscolherEmpresa' in result && result.precisaEscolherEmpresa) {
      return result;
    }

    const sessao = result as Extract<typeof result, { access_token: string }>;
    attachAuthCookie(res, sessao.access_token);
    const { access_token, ...userData } = sessao;
    return userData;
  }

  /**
   * POST /auth/token — JWT Bearer para MCP (ChatGPT, Claude, Gemini).
   * Mesma autenticação do login; o token vai no header Authorization, sem cookie.
   */
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post('token')
  async emitirToken(@Body() dto: LoginDto) {
    const email = String(dto.email || '').trim().toLowerCase();
    const senha = String(dto.senha || '');
    return this.authService.emitirTokenMcp(email, senha, dto.empresaId);
  }

  @Post('logout')
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('obra10_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
      path: '/',
    });
    return { success: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@Req() req: any) {
    const userId = req.user?.sub;
    if (!userId) throw new UnauthorizedException('Token Jwt Inválido');
    return this.authService.getMe(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('minhas-empresas')
  async minhasEmpresas(@Req() req: any) {
    const userId = req.user?.sub;
    if (!userId) throw new UnauthorizedException('Token Jwt Inválido');
    return this.authService.minhasEmpresas(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('trocar-empresa')
  async trocarEmpresa(
    @Req() req: any,
    @Body() dto: TrocarEmpresaDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const userId = req.user?.sub;
    if (!userId) throw new UnauthorizedException('Token Jwt Inválido');
    const result = await this.authService.trocarEmpresa(userId, dto.empresaId);
    attachAuthCookie(res, result.access_token);
    const { access_token, ...userData } = result;
    return userData;
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
    res.clearCookie('obra10_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
      path: '/',
    });
    return {
      success: true,
      message:
        'Conta anonimizada com sucesso. Seus dados pessoais foram removidos.',
    };
  }
}
