import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateUsuarioDto {
  @IsString({ message: 'Nome é obrigatório.' })
  @MinLength(2, { message: 'Nome deve ter no mínimo 2 caracteres.' })
  nome: string;

  @IsEmail({}, { message: 'E-mail inválido.' })
  email: string;

  @IsString()
  @MinLength(6, { message: 'Senha deve ter no mínimo 6 caracteres.' })
  senha: string;

  @IsEnum(['SUPER_ADMIN', 'GESTOR', 'USER'], {
    message: 'perfilGlobal deve ser SUPER_ADMIN, GESTOR ou USER.',
  })
  @IsOptional()
  perfilGlobal?: string;

  @IsString()
  @IsOptional()
  telefone?: string;
}

export class UpdateUsuarioDto {
  @IsString()
  @IsOptional()
  nome?: string;

  @IsEmail({}, { message: 'E-mail inválido.' })
  @IsOptional()
  email?: string;

  @IsEnum(['SUPER_ADMIN', 'GESTOR', 'USER'], {
    message: 'perfilGlobal deve ser SUPER_ADMIN, GESTOR ou USER.',
  })
  @IsOptional()
  perfilGlobal?: string;

  @IsString()
  @IsOptional()
  telefone?: string;
}

export class SetModulosDto {
  @IsString({ each: true, message: 'Cada módulo deve ser uma string (slug).' })
  modulos: string[];
}
