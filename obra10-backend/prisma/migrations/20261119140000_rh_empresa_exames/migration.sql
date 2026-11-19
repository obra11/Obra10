-- RH da empresa: funcionário e treinamento podem ficar sem obra.
-- Exames ocupacionais com validade para o aviso de atraso.

ALTER TABLE "funcionarios" ALTER COLUMN "obra_id" DROP NOT NULL;
ALTER TABLE "treinamentos_funcionario" ALTER COLUMN "obra_id" DROP NOT NULL;

DO $$ BEGIN
  CREATE TYPE "TipoExameOcupacional" AS ENUM (
    'ADMISSIONAL', 'PERIODICO', 'RETORNO_TRABALHO', 'MUDANCA_FUNCAO', 'DEMISSIONAL'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ResultadoExame" AS ENUM ('APTO', 'APTO_RESTRICOES', 'INAPTO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "exames_funcionario" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "funcionario_id" TEXT NOT NULL,
    "tipo" "TipoExameOcupacional" NOT NULL,
    "nome" TEXT NOT NULL,
    "data_realizacao" DATE NOT NULL,
    "validade" DATE NOT NULL,
    "resultado" "ResultadoExame",
    "clinica" TEXT,
    "observacao" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "exames_funcionario_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "exames_funcionario_empresa_id_validade_idx" ON "exames_funcionario"("empresa_id", "validade");
CREATE INDEX IF NOT EXISTS "exames_funcionario_funcionario_id_tipo_idx" ON "exames_funcionario"("funcionario_id", "tipo");

DO $$ BEGIN
  ALTER TABLE "exames_funcionario" ADD CONSTRAINT "exames_funcionario_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "exames_funcionario" ADD CONSTRAINT "exames_funcionario_funcionario_id_fkey" FOREIGN KEY ("funcionario_id") REFERENCES "funcionarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
