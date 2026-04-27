import {
  IsString,
  IsOptional,
  IsInt,
  IsNumber,
  IsEnum,
  MinLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

// ── Atividade ─────────────────────────────────────────────────────────────────
export class AddAtividadeDto {
  @IsString({ message: 'Descrição da atividade é obrigatória.' })
  @MinLength(3, { message: 'Descrição deve ter no mínimo 3 caracteres.' })
  descricao: string;

  @IsString()
  @IsOptional()
  frenteServico?: string;
}

// ── Efetivo ───────────────────────────────────────────────────────────────────
export class AddEfetivoDto {
  @IsString({ message: 'empresaTerceira é obrigatório.' })
  empresaTerceira: string;

  @IsString({ message: 'funcaoCargo é obrigatório.' })
  funcaoCargo: string;

  @IsInt({ message: 'quantidade deve ser um número inteiro.' })
  @Min(1, { message: 'quantidade deve ser pelo menos 1.' })
  @Type(() => Number)
  quantidade: number;
}

// ── Ocorrência ────────────────────────────────────────────────────────────────
export class AddOcorrenciaDto {
  @IsString({ message: 'tipoOcorrencia é obrigatório.' })
  tipoOcorrencia: string;

  @IsString({ message: 'Descrição da ocorrência é obrigatória.' })
  @MinLength(3, { message: 'Descrição deve ter no mínimo 3 caracteres.' })
  descricao: string;

  @IsNumber({}, { message: 'horasPerdidas deve ser numérico.' })
  @IsOptional()
  @Type(() => Number)
  horasPerdidas?: number;
}

// ── Tarefa (create) ───────────────────────────────────────────────────────────
export class AddTarefaDto {
  @IsString({ message: 'Descrição da tarefa é obrigatória.' })
  @MinLength(3, { message: 'Descrição deve ter no mínimo 3 caracteres.' })
  descricao: string;

  @IsString()
  @IsOptional()
  frenteServico?: string;

  @IsEnum(['EXECUTADO', 'PARCIAL', 'NAO_EXECUTADO'], {
    message: 'statusExecucao inválido.',
  })
  @IsOptional()
  statusExecucao?: string;

  @IsEnum(
    [
      'FALTA_MATERIAL',
      'FALTA_MAO_DE_OBRA',
      'CHUVA',
      'EQUIPAMENTO_INDISPONIVEL',
      'AGUARDANDO_APROVACAO',
      'PROJETO_NAO_LIBERADO',
      'RETRABALHO',
      'INTERFERENCIA_TERCEIROS',
      'OUTROS',
    ],
    { message: 'motivoNaoExecucao inválido.' },
  )
  @IsOptional()
  motivoNaoExecucao?: string;

  @IsString()
  @IsOptional()
  motivoTexto?: string;

  @IsNumber({}, { message: 'horasExecutadas deve ser numérico.' })
  @IsOptional()
  @Type(() => Number)
  horasExecutadas?: number;
}

// ── Tarefa (update / partial) ─────────────────────────────────────────────────
export class UpdateTarefaDto {
  @IsString()
  @IsOptional()
  descricao?: string;

  @IsString()
  @IsOptional()
  frenteServico?: string;

  @IsEnum(['EXECUTADO', 'PARCIAL', 'NAO_EXECUTADO'], {
    message: 'statusExecucao inválido.',
  })
  @IsOptional()
  statusExecucao?: string;

  @IsEnum(
    [
      'FALTA_MATERIAL',
      'FALTA_MAO_DE_OBRA',
      'CHUVA',
      'EQUIPAMENTO_INDISPONIVEL',
      'AGUARDANDO_APROVACAO',
      'PROJETO_NAO_LIBERADO',
      'RETRABALHO',
      'INTERFERENCIA_TERCEIROS',
      'OUTROS',
    ],
    { message: 'motivoNaoExecucao inválido.' },
  )
  @IsOptional()
  motivoNaoExecucao?: string;

  @IsString()
  @IsOptional()
  motivoTexto?: string;

  @IsNumber({}, { message: 'horasExecutadas deve ser numérico.' })
  @IsOptional()
  @Type(() => Number)
  horasExecutadas?: number;
}
