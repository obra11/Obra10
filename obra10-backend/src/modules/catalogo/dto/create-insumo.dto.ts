import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { TipoInsumo } from '@prisma/client';

export class CreateInsumoDto {
  @IsEnum(TipoInsumo)
  @IsNotEmpty()
  tipo: TipoInsumo;

  @IsString()
  @IsNotEmpty()
  nome: string;

  @IsString()
  @IsOptional()
  unidade?: string;

  @IsString()
  @IsOptional()
  codigo?: string;

  @IsString()
  @IsOptional()
  observacao?: string;
}
