import {
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

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

  @Transform(({ value }) => (value === '' ? null : value))
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @IsOptional()
  clienteNome?: string | null;

  @Transform(({ value }) => (value === '' ? null : value))
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @IsOptional()
  dataInicio?: string | null;

  @Transform(({ value }) => (value === '' ? null : value))
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @IsOptional()
  dataPrevisaoTermino?: string | null;

  @Transform(({ value }) =>
    value === '' || value === null || value === undefined ? value === undefined ? undefined : null : Number(value),
  )
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsInt({ message: 'percentualAvanco deve ser um inteiro de 0 a 100.' })
  @Min(0, { message: 'percentualAvanco mínimo é 0.' })
  @Max(100, { message: 'percentualAvanco máximo é 100.' })
  @IsOptional()
  percentualAvanco?: number | null;
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
