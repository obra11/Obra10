import { 
  IsString, 
  IsOptional, 
  IsBoolean, 
  IsNumber, 
  IsEnum, 
  Min, 
  IsDateString,
  IsArray,
  IsEmail
} from 'class-validator';
import { Plano, TipoCupom, PerfilGlobal, TipoPessoa } from '@prisma/client';

export class AtualizarEmpresaAdminDto {
  @IsString()
  @IsOptional()
  nomeFantasia?: string;

  @IsString()
  @IsOptional()
  razaoSocial?: string;

  @IsEnum(Plano)
  @IsOptional()
  plano?: Plano;

  @IsNumber()
  @Min(1)
  @IsOptional()
  limiteUsuarios?: number;

  @IsBoolean()
  @IsOptional()
  ativo?: boolean;

  @IsString()
  @IsOptional()
  cnpj?: string;

  @IsString()
  @IsOptional()
  cpfCnpj?: string;

  @IsEnum(TipoPessoa)
  @IsOptional()
  tipoPessoa?: TipoPessoa;

  @IsString()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  telefone?: string;

  @IsString()
  @IsOptional()
  cep?: string;

  @IsString()
  @IsOptional()
  logradouro?: string;

  @IsString()
  @IsOptional()
  numero?: string;

  @IsString()
  @IsOptional()
  complemento?: string;

  @IsString()
  @IsOptional()
  bairro?: string;

  @IsString()
  @IsOptional()
  cidade?: string;

  @IsString()
  @IsOptional()
  estado?: string;
}

export class ModulosEmpresaAdminDto {
  @IsArray()
  @IsString({ each: true })
  modulos: string[];
}

export class CriarUsuarioAdminDto {
  @IsString()
  nome: string;

  @IsEmail()
  email: string;

  @IsEnum(PerfilGlobal)
  @IsOptional()
  perfilGlobal?: PerfilGlobal;
}

export class AtualizarUsuarioAdminDto {
  @IsString()
  @IsOptional()
  nome?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsEnum(PerfilGlobal)
  @IsOptional()
  perfilGlobal?: PerfilGlobal;

  @IsBoolean()
  @IsOptional()
  ativo?: boolean;
}

export class CriarCupomAdminDto {
  @IsString()
  codigo: string;

  @IsEnum(TipoCupom)
  tipo: TipoCupom;

  @IsNumber()
  @IsOptional()
  valor?: number;

  @IsNumber()
  @IsOptional()
  mesesGratuitos?: number;

  @IsNumber()
  @IsOptional()
  duracaoMeses?: number;

  @IsNumber()
  @IsOptional()
  usosMaximos?: number;

  @IsDateString()
  @IsOptional()
  expiraEm?: string;
}

export class AtualizarCupomAdminDto {
  @IsNumber()
  @IsOptional()
  valor?: number;

  @IsNumber()
  @IsOptional()
  duracaoMeses?: number;

  @IsNumber()
  @IsOptional()
  usosMaximos?: number;

  @IsDateString()
  @IsOptional()
  expiraEm?: string;

  @IsBoolean()
  @IsOptional()
  ativo?: boolean;
}

export class EnviarCupomAdminDto {
  @IsString()
  empresaId: string;

  @IsString()
  cupomId: string;
}

export class AtualizarModuloAdminDto {
  @IsString()
  @IsOptional()
  nome?: string;

  @IsString()
  @IsOptional()
  descricao?: string;

  @IsNumber()
  @IsOptional()
  preco?: number;

  @IsBoolean()
  @IsOptional()
  ativo?: boolean;
}

export class CriarEmpresaAdminDto {
  @IsString()
  razaoSocial: string;

  @IsString()
  @IsOptional()
  nomeFantasia?: string;

  @IsString()
  documento: string; // CPF ou CNPJ sem máscara

  @IsEnum(TipoPessoa)
  tipoPessoa: TipoPessoa;

  @IsEnum(Plano)
  @IsOptional()
  plano?: Plano;

  @IsString()
  @IsOptional()
  telefone?: string;

  @IsString()
  @IsOptional()
  email?: string;

  // Campos do Gestor
  @IsString()
  gestorNome: string;

  @IsEmail()
  gestorEmail: string;

  @IsString()
  gestorSenha: string;

  @IsString()
  @IsOptional()
  gestorTelefone?: string;
}
