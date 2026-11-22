-- Ordem de exibição das obras no dashboard da empresa.

ALTER TABLE "obras"
  ADD COLUMN IF NOT EXISTS "ordem_exibicao" INTEGER NOT NULL DEFAULT 0;

UPDATE "obras"
SET "ordem_exibicao" = sub.rn - 1
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY empresa_id ORDER BY created_at ASC) AS rn
  FROM "obras"
  WHERE deleted_at IS NULL
) sub
WHERE "obras".id = sub.id;
