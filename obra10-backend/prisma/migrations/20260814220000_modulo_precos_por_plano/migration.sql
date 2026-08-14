-- Preços absolutos por plano (Básico / Enterprise). Pro continua em preco / preco_anual.
ALTER TABLE "modulos" ADD COLUMN IF NOT EXISTS "preco_basico" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "modulos" ADD COLUMN IF NOT EXISTS "preco_anual_basico" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "modulos" ADD COLUMN IF NOT EXISTS "preco_enterprise" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "modulos" ADD COLUMN IF NOT EXISTS "preco_anual_enterprise" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- Backfill a partir dos fatores atuais (Básico 0.8×, Enterprise 1.5×)
UPDATE "modulos"
SET
  "preco_basico" = ROUND(("preco" * 0.8)::numeric, 2),
  "preco_anual_basico" = ROUND((COALESCE("preco_anual", 0) * 0.8)::numeric, 2),
  "preco_enterprise" = ROUND(("preco" * 1.5)::numeric, 2),
  "preco_anual_enterprise" = ROUND((COALESCE("preco_anual", 0) * 1.5)::numeric, 2)
WHERE "preco_basico" = 0 AND "preco_enterprise" = 0;
