import { IsString, IsEnum, IsNumber, IsOptional, IsInt, Min, Max } from 'class-validator';

export class CriarCupomDto {
  @IsString({ message: 'codigo é obrigatório.' })
  codigo: string;

  @IsEnum(['GRATUIDADE', 'DESCONTO_FIXO', 'DESCONTO_PERCENTUAL'], {
    message: 'tipo deve ser GRATUIDADE, DESCONTO_FIXO ou DESCONTO_PERCENTUAL.',
  })
  tipo: 'GRATUIDADE' | 'DESCONTO_FIXO' | 'DESCONTO_PERCENTUAL';

  @IsNumber({}, { message: 'valor deve ser numérico.' })
  @IsOptional()
  valor?: number;

  @IsInt({ message: 'mesesGratuitos deve ser inteiro.' })
  @Min(1)
  @IsOptional()
  mesesGratuitos?: number;

  @IsInt({ message: 'duracaoMeses deve ser inteiro.' })
  @Min(1)
  @IsOptional()
  duracaoMeses?: number;

  @IsInt({ message: 'usosMaximos deve ser inteiro.' })
  @Min(1)
  @IsOptional()
  usosMaximos?: number;

  @IsString()
  @IsOptional()
  expiraEm?: string;
}

export class ValidarCupomDto {
  @IsString({ message: 'codigo é obrigatório.' })
  codigo: string;
}
