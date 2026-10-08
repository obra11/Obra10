-- Catálogo do visualizador de PDF, DWG e IFC, no grupo Desenvolvimento.
INSERT INTO "modulos" (
    "id", "slug", "nome", "descricao", "sigla", "grupo", "preco", "ativo", "versao", "dependencias", "ordem_exibicao", "created_at"
)
SELECT
    gen_random_uuid()::text,
    'VISUALIZADOR',
    'Visualizador de Arquivos',
    'Abre PDF e IFC no navegador e converte DWG em PDF.',
    'Viewer',
    'Desenvolvimento',
    29.90,
    true,
    '1.0.0',
    ARRAY[]::text[],
    13,
    CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "modulos" WHERE "slug" = 'VISUALIZADOR');

UPDATE "modulos"
SET
    "nome" = 'Visualizador de Arquivos',
    "descricao" = 'Abre PDF e IFC no navegador e converte DWG em PDF.',
    "sigla" = 'Viewer',
    "grupo" = 'Desenvolvimento',
    "preco" = 29.90,
    "ordem_exibicao" = 13,
    "ativo" = true
WHERE "slug" = 'VISUALIZADOR';

INSERT INTO "tenant_modulos" (
    "id", "empresa_id", "modulo_id", "ativo", "periodicidade", "data_contratacao", "created_at", "updated_at"
)
SELECT
    gen_random_uuid()::text,
    e."id",
    m."id",
    true,
    'MENSAL',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "empresas" e
CROSS JOIN "modulos" m
WHERE m."slug" = 'VISUALIZADOR'
  AND e."deleted_at" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "tenant_modulos" t
    WHERE t."empresa_id" = e."id" AND t."modulo_id" = m."id"
  );
