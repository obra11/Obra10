-- Evolução da obra: datas, cliente e avanço físico.
-- Idempotente: ambientes que já receberam db push não quebram no migrate deploy.

ALTER TABLE "obras" ADD COLUMN IF NOT EXISTS "cliente_nome" TEXT;
ALTER TABLE "obras" ADD COLUMN IF NOT EXISTS "data_inicio" TIMESTAMP(3);
ALTER TABLE "obras" ADD COLUMN IF NOT EXISTS "data_previsao_termino" TIMESTAMP(3);
ALTER TABLE "obras" ADD COLUMN IF NOT EXISTS "percentual_avanco" INTEGER;
