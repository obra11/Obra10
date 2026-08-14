-- AlterTable
ALTER TABLE "modulos" ADD COLUMN IF NOT EXISTS "preco_anual" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "tenant_modulos" ADD COLUMN IF NOT EXISTS "periodicidade" TEXT NOT NULL DEFAULT 'MENSAL';

-- AlterTable
ALTER TABLE "cobrancas" ADD COLUMN IF NOT EXISTS "periodicidade" TEXT NOT NULL DEFAULT 'MENSAL';
ALTER TABLE "cobrancas" ADD COLUMN IF NOT EXISTS "modulos_slugs" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- RDO: mensal R$99 / anual R$1090
UPDATE "modulos" SET "preco" = 99, "preco_anual" = 1090 WHERE "slug" = 'RDO';

-- Demais módulos: anual ~11x mensal (mesmo desconto do RDO), se ainda zerado
UPDATE "modulos"
SET "preco_anual" = ROUND(("preco" * 11)::numeric, 2)
WHERE "slug" <> 'RDO' AND "preco" > 0 AND ("preco_anual" IS NULL OR "preco_anual" = 0);
