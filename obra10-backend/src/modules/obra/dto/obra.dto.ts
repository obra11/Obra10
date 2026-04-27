import {
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateObraDto {
  @IsString({ message: 'O nome da obra é obrigatório.' })
  @MinLength(2, { message: 'Nome deve ter no mínimo 2 caracteres.' })
  nome: string;

  @IsString()
  @IsOptional()
  endereco?: string;
}

export class EditObraDto {
  @IsString()
  @IsOptional()
  nome?: string;

  @IsString()
  @IsOptional()
  endereco?: string;

  @IsString()
  @IsOptional()
  status?: string;
}

export class AddColaboradorDto {
  @IsUUID('4', { message: 'usuarioId deve ser um UUID válido.' })
  usuarioId: string;

  @IsInt({ message: 'perfilId deve ser um inteiro.' })
  @IsOptional()
  @Type(() => Number)
  perfilId?: number;

  @IsObject()
  @IsOptional()
  permissoes?: Record<string, any>;
}

export class EditColaboradorDto {
  @IsInt({ message: 'perfilId deve ser um inteiro.' })
  @IsOptional()
  @Type(() => Number)
  perfilId?: number;

  @IsObject()
  @IsOptional()
  permissoes?: Record<string, any>;
}
