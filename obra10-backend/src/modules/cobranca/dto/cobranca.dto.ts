import { IsArray, IsEnum, IsOptional, IsString } from 'class-validator';

export class ContratarModulosDto {
  @IsArray({ message: 'modulosSelecionados deve ser um array de slugs.' })
  @IsString({ each: true })
  modulosSelecionados: string[];

  @IsEnum(['PIX', 'CARTAO'], {
    message: 'formaPagamento deve ser PIX ou CARTAO.',
  })
  formaPagamento: 'PIX' | 'CARTAO';

  @IsEnum(['MENSAL', 'ANUAL'], {
    message: 'periodicidade deve ser MENSAL ou ANUAL.',
  })
  @IsOptional()
  periodicidade?: 'MENSAL' | 'ANUAL';

  @IsString()
  @IsOptional()
  tokenCartao?: string;

  @IsString()
  @IsOptional()
  cupom?: string;
}
