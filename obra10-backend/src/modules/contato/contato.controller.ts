import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import { EmailService } from '../email/email.service';

class ContatoSiteDto {
  @IsString()
  @MinLength(2)
  nome: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  telefone?: string;

  @IsString()
  @MinLength(5)
  mensagem: string;
}

@Controller('contato')
export class ContatoController {
  constructor(private readonly emailService: EmailService) {}

  @Throttle({ default: { limit: 8, ttl: 3600 } })
  @Post()
  async enviar(@Body() dto: ContatoSiteDto) {
    await this.emailService.enviarContatoSite(dto);
    return { ok: true };
  }
}
