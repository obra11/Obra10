import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { TipoInsumo } from '@prisma/client';

export class UpdateInsumoDto {
  @IsEnum(TipoInsumo)
  @IsOptional()
  tipo?: TipoInsumo;

  @IsString()
  @IsOptional()
  nome?: string;

  @IsString()
  @IsOptional()
  unidade?: string;

  @IsString()
  @IsOptional()
  codigo?: string;

  @IsString()
  @IsOptional()
  observacao?: string;

  @IsBoolean()
  @IsOptional()
  ativo?: boolean;
}
