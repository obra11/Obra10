import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

const PERFIS_EMPRESA = ['GESTOR', 'USER', 'EXTERNO', 'PERSONALIZADO'] as const;
const TIPOS_PAPEL = ['GESTOR', 'COLABORADOR', 'EXTERNO', 'PERSONALIZADO'] as const;

export class CapabilitiesDto {
  @IsBoolean()
  @IsOptional()
  gerenciarUsuarios?: boolean;

  @IsBoolean()
  @IsOptional()
  acessoTodasObras?: boolean;

  @IsBoolean()
  @IsOptional()
  aprovarRdo?: boolean;

  @IsBoolean()
  @IsOptional()
  criarEditarRdo?: boolean;

  @IsBoolean()
  @IsOptional()
  verTodosRdos?: boolean;

  @IsBoolean()
  @IsOptional()
  verSoAprovados?: boolean;

  @IsBoolean()
  @IsOptional()
  verParcialAprovados?: boolean;

  @IsObject()
  @IsOptional()
  modulosPadrao?: Record<string, string>;
}

export class CreateUsuarioDto {
  @IsString({ message: 'Nome é obrigatório.' })
  @MinLength(2, { message: 'Nome deve ter no mínimo 2 caracteres.' })
  nome: string;

  @IsEmail({}, { message: 'E-mail inválido.' })
  email: string;

  @IsString()
  @MinLength(6, { message: 'Senha deve ter no mínimo 6 caracteres.' })
  senha: string;

  @IsEnum(PERFIS_EMPRESA, {
    message:
      'perfilGlobal deve ser GESTOR, USER, EXTERNO ou PERSONALIZADO.',
  })
  @IsOptional()
  perfilGlobal?: string;

  @IsString()
  @IsOptional()
  telefone?: string;

  @ValidateNested()
  @Type(() => CapabilitiesDto)
  @IsOptional()
  capabilities?: CapabilitiesDto;

  /** Permissões por obra a aplicar no create (PERSONALIZADO / template). */
  @IsObject()
  @IsOptional()
  permissoesObras?: Record<string, Record<string, string>>;
}

export class UpdateUsuarioDto {
  @IsString()
  @IsOptional()
  nome?: string;

  @IsEmail({}, { message: 'E-mail inválido.' })
  @IsOptional()
  email?: string;

  @IsEnum(PERFIS_EMPRESA, {
    message:
      'perfilGlobal deve ser GESTOR, USER, EXTERNO ou PERSONALIZADO.',
  })
  @IsOptional()
  perfilGlobal?: string;

  @IsString()
  @IsOptional()
  telefone?: string;

  @ValidateNested()
  @Type(() => CapabilitiesDto)
  @IsOptional()
  capabilities?: CapabilitiesDto;

  @IsObject()
  @IsOptional()
  permissoesObras?: Record<string, Record<string, string>>;
}

export class SetModulosDto {
  @IsString({ each: true, message: 'Cada módulo deve ser uma string (slug).' })
  modulos: string[];
}

export class UpdatePerfilDto {
  @IsString()
  @IsOptional()
  nome?: string;

  @IsString()
  @IsOptional()
  telefone?: string;

  @IsString()
  @IsOptional()
  fotoUrl?: string;

  @IsString()
  @IsOptional()
  @MinLength(6, { message: 'A nova senha deve ter no mínimo 6 caracteres.' })
  novaSenha?: string;

  @IsString()
  @IsOptional()
  senhaAtual?: string;
}

export class UpdatePapelEmpresaDto {
  @IsString()
  @IsOptional()
  nome?: string;

  @ValidateNested()
  @Type(() => CapabilitiesDto)
  @IsOptional()
  capabilities?: CapabilitiesDto;

  @IsObject()
  @IsOptional()
  permissoesPadrao?: Record<string, string>;
}

export { TIPOS_PAPEL, PERFIS_EMPRESA };
