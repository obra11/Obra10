-- Cadastro Base (catálogo de insumos): enum + tabela.
-- Idempotente: ambientes que já receberam db push não quebram no migrate deploy.

DO $$ BEGIN
  CREATE TYPE "TipoInsumo" AS ENUM ('MATERIAL', 'EQUIPAMENTO', 'MAO_DE_OBRA');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "catalogo_insumos" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "tipo" "TipoInsumo" NOT NULL,
    "nome" TEXT NOT NULL,
    "unidade" TEXT,
    "codigo" TEXT,
    "observacao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "catalogo_insumos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "catalogo_insumos_empresa_id_tipo_idx"
  ON "catalogo_insumos"("empresa_id", "tipo");

DO $$ BEGIN
  ALTER TABLE "catalogo_insumos"
    ADD CONSTRAINT "catalogo_insumos_empresa_id_fkey"
    FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
