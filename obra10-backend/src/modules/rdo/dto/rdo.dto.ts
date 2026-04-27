import {
  IsDateString,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export class CreateRdoDto {
  @IsDateString(
    {},
    { message: 'dataReferencia deve ser uma data válida (ISO 8601).' },
  )
  @IsOptional()
  dataReferencia?: string;

  @IsObject({ message: 'dadosExtras deve ser um objeto.' })
  @IsOptional()
  dadosExtras?: Record<string, any>;
}

export class SaveRascunhoDto {
  @IsObject({ message: 'dadosExtras deve ser um objeto.' })
  dadosExtras: Record<string, any>;
}

export class SubmeterRdoDto {
  @IsUUID('4', { message: 'aprovadorIdSelecionado deve ser um UUID válido.' })
  @IsOptional()
  aprovadorIdSelecionado?: string;
}

export class ReprovarRdoDto {
  @IsString({ message: 'Motivo da reprovação é obrigatório.' })
  @MinLength(10, { message: 'Motivo deve ter no mínimo 10 caracteres.' })
  motivo: string;
}
