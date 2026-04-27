import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ReenviarVerificacaoDto {
  @IsString({ message: 'E-mail é obrigatório.' })
  email: string;
}

export class UpgradePlanoDto {
  @IsEnum(['BASICO', 'PRO', 'ENTERPRISE'], {
    message: 'Plano inválido. Use BASICO, PRO ou ENTERPRISE.',
  })
  plano: string;
}

export class UpdateMinhaEmpresaDto {
  @IsString()
  @IsOptional()
  nomeFantasia?: string;

  @IsString()
  @IsOptional()
  telefone?: string;

  @IsString()
  @IsOptional()
  cep?: string;

  @IsString()
  @IsOptional()
  logradouro?: string;

  @IsString()
  @IsOptional()
  numero?: string;

  @IsString()
  @IsOptional()
  complemento?: string;

  @IsString()
  @IsOptional()
  bairro?: string;

  @IsString()
  @IsOptional()
  cidade?: string;

  @IsString()
  @IsOptional()
  estado?: string;

  @IsString()
  @IsOptional()
  email?: string;
}

export class AdminUpdateTenantDto {
  @IsBoolean()
  @IsOptional()
  ativo?: boolean;

  @IsBoolean()
  @IsOptional()
  suspensa?: boolean;

  @IsEnum(['BASICO', 'PRO', 'ENTERPRISE'], { message: 'Plano inválido.' })
  @IsOptional()
  plano?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  limiteUsuarios?: number;
}

export class AdminSetModulosDto {
  @IsArray({ message: 'modulos deve ser um array de objetos.' })
  modulos: any[];
}
