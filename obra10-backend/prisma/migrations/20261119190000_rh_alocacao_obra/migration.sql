-- Histórico de alocação de mão de obra nas obras.

CREATE TABLE IF NOT EXISTS "alocacoes_funcionario" (
  "id" TEXT NOT NULL,
  "empresa_id" TEXT NOT NULL,
  "funcionario_id" TEXT NOT NULL,
  "obra_id" TEXT NOT NULL,
  "data_inicio" DATE NOT NULL,
  "data_fim" DATE,
  "observacao" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),

  CONSTRAINT "alocacoes_funcionario_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "alocacoes_funcionario_empresa_id_funcionario_id_idx"
  ON "alocacoes_funcionario"("empresa_id", "funcionario_id");

CREATE INDEX IF NOT EXISTS "alocacoes_funcionario_empresa_id_obra_id_idx"
  ON "alocacoes_funcionario"("empresa_id", "obra_id");

ALTER TABLE "alocacoes_funcionario"
  DROP CONSTRAINT IF EXISTS "alocacoes_funcionario_empresa_id_fkey";
ALTER TABLE "alocacoes_funcionario"
  ADD CONSTRAINT "alocacoes_funcionario_empresa_id_fkey"
  FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "alocacoes_funcionario"
  DROP CONSTRAINT IF EXISTS "alocacoes_funcionario_funcionario_id_fkey";
ALTER TABLE "alocacoes_funcionario"
  ADD CONSTRAINT "alocacoes_funcionario_funcionario_id_fkey"
  FOREIGN KEY ("funcionario_id") REFERENCES "funcionarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "alocacoes_funcionario"
  DROP CONSTRAINT IF EXISTS "alocacoes_funcionario_obra_id_fkey";
ALTER TABLE "alocacoes_funcionario"
  ADD CONSTRAINT "alocacoes_funcionario_obra_id_fkey"
  FOREIGN KEY ("obra_id") REFERENCES "obras"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "alocacoes_funcionario" (
  "id", "empresa_id", "funcionario_id", "obra_id", "data_inicio", "created_at", "updated_at"
)
SELECT
  gen_random_uuid()::text,
  f."empresa_id",
  f."id",
  f."obra_id",
  COALESCE(f."data_admissao", f."created_at"::date),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "funcionarios" f
WHERE f."deleted_at" IS NULL
  AND f."obra_id" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "alocacoes_funcionario" a
    WHERE a."funcionario_id" = f."id"
      AND a."data_fim" IS NULL
      AND a."deleted_at" IS NULL
  );
