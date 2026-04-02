import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterTenantDto {
  @IsIn(['FISICA', 'JURIDICA'], { message: "tipoPessoa deve ser 'FISICA' ou 'JURIDICA'." })
  tipoPessoa: 'FISICA' | 'JURIDICA';

  @IsString({ message: 'CPF/CNPJ é obrigatório.' })
  cpfCnpj: string;

  @IsEmail({}, { message: 'E-mail inválido.' })
  email: string;

  @IsString({ message: 'Nome é obrigatório.' })
  nome: string;

  @IsString()
  @MinLength(6, { message: 'Senha deve ter no mínimo 6 caracteres.' })
  senha: string;

  @IsString() @IsOptional() razaoSocial?: string;
  @IsString() @IsOptional() nomeFantasia?: string;
  @IsString() @IsOptional() nomeCompleto?: string;
  @IsString() @IsOptional() telefone?: string;
  @IsString() @IsOptional() cep?: string;
  @IsString() @IsOptional() numero?: string;
  @IsString() @IsOptional() complemento?: string;
}
