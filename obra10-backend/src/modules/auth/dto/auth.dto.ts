import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'E-mail inválido.' })
  email: string;

  @IsString()
  @MinLength(6, { message: 'Senha deve ter no mínimo 6 caracteres.' })
  senha: string;

  @IsString()
  @IsOptional()
  empresaId?: string;
}

export class EsqueciSenhaDto {
  @IsEmail({}, { message: 'E-mail inválido.' })
  email: string;
}

export class RedefinirSenhaDto {
  @IsString({ message: 'Token é obrigatório.' })
  token: string;

  @IsString()
  @MinLength(6, { message: 'Nova senha deve ter no mínimo 6 caracteres.' })
  novaSenha: string;
}
