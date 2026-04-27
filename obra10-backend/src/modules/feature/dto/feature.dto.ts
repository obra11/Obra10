import { IsString, IsOptional, IsEnum, IsBoolean, IsArray } from 'class-validator';
import { TipoFeatureFlag } from '@prisma/client';

export class CriarFeatureDto {
  @IsString()
  codigo: string;

  @IsString()
  nome: string;

  @IsString()
  @IsOptional()
  descricao?: string;

  @IsEnum(TipoFeatureFlag)
  @IsOptional()
  tipo?: TipoFeatureFlag;

  @IsString()
  @IsOptional()
  versao?: string;
}

export class AtualizarFeatureDto {
  @IsString()
  @IsOptional()
  nome?: string;

  @IsString()
  @IsOptional()
  descricao?: string;

  @IsString()
  @IsOptional()
  versao?: string;
}

export class AtribuirFeatureDto {
  @IsArray()
  @IsString({ each: true })
  empresaIds: string[];
}
