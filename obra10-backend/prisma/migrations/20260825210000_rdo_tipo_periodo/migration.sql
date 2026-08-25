-- Relatório de obra: DIA (padrão, diários existentes) ou PERIODO (prazo entre duas datas).
-- Idempotente: ambientes que já receberam db push não quebram no migrate deploy.

DO $$ BEGIN
  CREATE TYPE "TipoRelatorioRdo" AS ENUM ('DIA', 'PERIODO');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "rdos" ADD COLUMN IF NOT EXISTS "data_fim" TIMESTAMP(3);
ALTER TABLE "rdos" ADD COLUMN IF NOT EXISTS "tipo_relatorio" "TipoRelatorioRdo" NOT NULL DEFAULT 'DIA';
