import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class SolicitarUploadDto {
  @IsString({ message: 'attachableId é obrigatório.' })
  attachableId: string;

  @IsString({ message: 'origemAnexo é obrigatório.' })
  origemAnexo: string;

  @IsString({ message: 'tipoArquivo é obrigatório.' })
  tipoArquivo: string;

  @IsString({ message: 'nomeOriginal é obrigatório.' })
  nomeOriginal: string;

  @IsString({ message: 'mimeType é obrigatório.' })
  mimeType: string;

  @IsInt({ message: 'tamanhoBytes deve ser um número inteiro.' })
  @Min(1, { message: 'tamanhoBytes deve ser maior que 0.' })
  @Type(() => Number)
  tamanhoBytes: number;
}
