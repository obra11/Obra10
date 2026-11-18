-- Ficha de registro do funcionário, validade do EPI e treinamentos.
-- Idempotente: banco que já recebeu db push local não quebra.

DO $$ BEGIN
  CREATE TYPE "Sexo" AS ENUM ('FEMININO', 'MASCULINO', 'NAO_INFORMADO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "EstadoCivil" AS ENUM ('SOLTEIRO', 'CASADO', 'UNIAO_ESTAVEL', 'DIVORCIADO', 'SEPARADO', 'VIUVO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "Escolaridade" AS ENUM (
    'FUNDAMENTAL_INCOMPLETO', 'FUNDAMENTAL', 'MEDIO_INCOMPLETO', 'MEDIO',
    'TECNICO', 'SUPERIOR_INCOMPLETO', 'SUPERIOR', 'POS_GRADUACAO'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "TipoContrato" AS ENUM ('CLT', 'TEMPORARIO', 'ESTAGIO', 'APRENDIZ', 'AUTONOMO', 'TERCEIRIZADO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "TipoContaBancaria" AS ENUM ('CORRENTE', 'POUPANCA', 'SALARIO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "TipoTreinamento" AS ENUM ('ADMISSIONAL', 'RECORRENTE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "funcionarios" ADD COLUMN IF NOT EXISTS "cpf" TEXT;
ALTER TABLE "funcionarios" ADD COLUMN IF NOT EXISTS "cpf_hash" TEXT;
ALTER TABLE "funcionarios" ADD COLUMN IF NOT EXISTS "rg" TEXT;
ALTER TABLE "funcionarios" ADD COLUMN IF NOT EXISTS "rg_orgao" TEXT;
ALTER TABLE "funcionarios" ADD COLUMN IF NOT EXISTS "rg_uf" TEXT;
ALTER TABLE "funcionarios" ADD COLUMN IF NOT EXISTS "data_nascimento" DATE;
ALTER TABLE "funcionarios" ADD COLUMN IF NOT EXISTS "sexo" "Sexo";
ALTER TABLE "funcionarios" ADD COLUMN IF NOT EXISTS "estado_civil" "EstadoCivil";
ALTER TABLE "funcionarios" ADD COLUMN IF NOT EXISTS "nacionalidade" TEXT;
ALTER TABLE "funcionarios" ADD COLUMN IF NOT EXISTS "naturalidade" TEXT;
ALTER TABLE "funcionarios" ADD COLUMN IF NOT EXISTS "nome_mae" TEXT;
ALTER TABLE "funcionarios" ADD COLUMN IF NOT EXISTS "nome_pai" TEXT;
ALTER TABLE "funcionarios" ADD COLUMN IF NOT EXISTS "pis" TEXT;
ALTER TABLE "funcionarios" ADD COLUMN IF NOT EXISTS "pis_hash" TEXT;
ALTER TABLE "funcionarios" ADD COLUMN IF NOT EXISTS "ctps_numero" TEXT;
ALTER TABLE "funcionarios" ADD COLUMN IF NOT EXISTS "ctps_serie" TEXT;
ALTER TABLE "funcionarios" ADD COLUMN IF NOT EXISTS "ctps_uf" TEXT;
ALTER TABLE "funcionarios" ADD COLUMN IF NOT EXISTS "escolaridade" "Escolaridade";
ALTER TABLE "funcionarios" ADD COLUMN IF NOT EXISTS "telefone" TEXT;
ALTER TABLE "funcionarios" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "funcionarios" ADD COLUMN IF NOT EXISTS "cep" TEXT;
ALTER TABLE "funcionarios" ADD COLUMN IF NOT EXISTS "logradouro" TEXT;
ALTER TABLE "funcionarios" ADD COLUMN IF NOT EXISTS "numero" TEXT;
ALTER TABLE "funcionarios" ADD COLUMN IF NOT EXISTS "complemento" TEXT;
ALTER TABLE "funcionarios" ADD COLUMN IF NOT EXISTS "bairro" TEXT;
ALTER TABLE "funcionarios" ADD COLUMN IF NOT EXISTS "cidade" TEXT;
ALTER TABLE "funcionarios" ADD COLUMN IF NOT EXISTS "uf" TEXT;
ALTER TABLE "funcionarios" ADD COLUMN IF NOT EXISTS "cbo" TEXT;
ALTER TABLE "funcionarios" ADD COLUMN IF NOT EXISTS "matricula" TEXT;
ALTER TABLE "funcionarios" ADD COLUMN IF NOT EXISTS "data_admissao" DATE;
ALTER TABLE "funcionarios" ADD COLUMN IF NOT EXISTS "tipo_contrato" "TipoContrato";
ALTER TABLE "funcionarios" ADD COLUMN IF NOT EXISTS "salario" DECIMAL(14,2);
ALTER TABLE "funcionarios" ADD COLUMN IF NOT EXISTS "jornada" TEXT;
ALTER TABLE "funcionarios" ADD COLUMN IF NOT EXISTS "banco" TEXT;
ALTER TABLE "funcionarios" ADD COLUMN IF NOT EXISTS "agencia" TEXT;
ALTER TABLE "funcionarios" ADD COLUMN IF NOT EXISTS "conta" TEXT;
ALTER TABLE "funcionarios" ADD COLUMN IF NOT EXISTS "tipo_conta" "TipoContaBancaria";
ALTER TABLE "funcionarios" ADD COLUMN IF NOT EXISTS "pix" TEXT;

ALTER TABLE "movimentos_estoque" ADD COLUMN IF NOT EXISTS "validade_epi" DATE;
ALTER TABLE "movimentos_estoque" ADD COLUMN IF NOT EXISTS "ca" TEXT;

CREATE TABLE IF NOT EXISTS "treinamentos_funcionario" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "obra_id" TEXT NOT NULL,
    "funcionario_id" TEXT NOT NULL,
    "tipo" "TipoTreinamento" NOT NULL,
    "nome" TEXT NOT NULL,
    "data_realizacao" DATE NOT NULL,
    "carga_horaria" DECIMAL(6,2),
    "validade" DATE NOT NULL,
    "instrutor" TEXT,
    "observacao" TEXT,
    "assinatura" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "treinamentos_funcionario_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "funcionarios_empresa_id_cpf_hash_key" ON "funcionarios"("empresa_id", "cpf_hash");
CREATE UNIQUE INDEX IF NOT EXISTS "funcionarios_empresa_id_pis_hash_key" ON "funcionarios"("empresa_id", "pis_hash");
CREATE INDEX IF NOT EXISTS "treinamentos_funcionario_empresa_id_obra_id_validade_idx" ON "treinamentos_funcionario"("empresa_id", "obra_id", "validade");
CREATE INDEX IF NOT EXISTS "treinamentos_funcionario_funcionario_id_tipo_idx" ON "treinamentos_funcionario"("funcionario_id", "tipo");

DO $$ BEGIN
  ALTER TABLE "treinamentos_funcionario" ADD CONSTRAINT "treinamentos_funcionario_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "treinamentos_funcionario" ADD CONSTRAINT "treinamentos_funcionario_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "treinamentos_funcionario" ADD CONSTRAINT "treinamentos_funcionario_funcionario_id_fkey" FOREIGN KEY ("funcionario_id") REFERENCES "funcionarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
