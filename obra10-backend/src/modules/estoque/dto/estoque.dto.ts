import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { TipoEstoqueItem, TipoMovimentoEstoque } from '@prisma/client';

export class CreateEstoqueItemDto {
  @IsEnum(TipoEstoqueItem)
  tipo: TipoEstoqueItem;

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
  caNumero?: string;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @Min(0)
  estoqueMinimo?: number;

  @IsString()
  @IsOptional()
  catalogoInsumoId?: string;
}

export class UpdateEstoqueItemDto {
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
  caNumero?: string;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @Min(0)
  estoqueMinimo?: number;

  @IsBoolean()
  @IsOptional()
  ativo?: boolean;
}

export class MovimentarEstoqueDto {
  @IsEnum(TipoMovimentoEstoque)
  tipo: TipoMovimentoEstoque;

  @Type(() => Number)
  @IsNumber()
  quantidade: number;

  @IsDateString()
  @IsOptional()
  data?: string;

  @IsString()
  @IsOptional()
  observacao?: string;
}

export class CreateEpiEntregaItemDto {
  @IsString()
  @IsOptional()
  itemId?: string;

  @IsString()
  @IsNotEmpty()
  nome: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  quantidade: number;

  @IsString()
  @IsOptional()
  unidade?: string;

  @IsString()
  @IsOptional()
  caNumero?: string;
}

export class CreateEpiEntregaDto {
  @IsDateString()
  data: string;

  @IsString()
  @IsNotEmpty()
  colaboradorNome: string;

  @IsString()
  @IsOptional()
  colaboradorCpf?: string;

  @IsString()
  @IsOptional()
  colaboradorFuncao?: string;

  @IsString()
  @IsOptional()
  colaboradorUsuarioId?: string;

  @IsString()
  @IsOptional()
  observacao?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateEpiEntregaItemDto)
  itens: CreateEpiEntregaItemDto[];
}
