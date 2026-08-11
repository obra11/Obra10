import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { TipoInsumo } from '@prisma/client';

export class ImportInsumoItemDto {
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

export class ImportInsumosDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(2000)
  @ValidateNested({ each: true })
  @Type(() => ImportInsumoItemDto)
  itens: ImportInsumoItemDto[];

  /** Se true, atualiza itens existentes (mesmo código ou mesmo tipo+nome). Padrão: true. */
  @IsBoolean()
  @IsOptional()
  atualizarExistentes?: boolean;
}
