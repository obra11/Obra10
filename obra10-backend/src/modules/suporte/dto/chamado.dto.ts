import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { CategoriaChamadoSuporte, StatusChamadoSuporte } from '@prisma/client';

export class CreateChamadoDto {
  @IsString()
  @MinLength(3, { message: 'Assunto deve ter pelo menos 3 caracteres.' })
  assunto: string;

  @IsEnum(CategoriaChamadoSuporte)
  categoria: CategoriaChamadoSuporte;

  @IsString()
  @MinLength(5, { message: 'Descrição deve ter pelo menos 5 caracteres.' })
  descricao: string;

  @IsOptional()
  marcarWhatsapp?: boolean;
}

export class UpdateChamadoDto {
  @IsOptional()
  @IsString()
  @MinLength(5)
  descricao?: string;

  @IsOptional()
  @IsEnum(StatusChamadoSuporte)
  status?: StatusChamadoSuporte;

  @IsOptional()
  marcarWhatsapp?: boolean;
}
