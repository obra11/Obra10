-- RH vira módulo do catálogo. Preços dos módulos que já têm tela.
-- Anual = 10x o mensal (dois meses grátis). Visualizador incluso (R$ 0).
-- Módulos sem tela saem do catálogo público.

INSERT INTO "modulos" (
    "id", "slug", "nome", "descricao", "sigla", "grupo",
    "preco", "preco_anual", "preco_basico", "preco_anual_basico",
    "preco_enterprise", "preco_anual_enterprise",
    "ativo", "versao", "dependencias", "ordem_exibicao", "created_at"
)
SELECT
    gen_random_uuid()::text,
    'RH',
    'RH da obra',
    'Ficha do trabalhador, entrega de EPI com assinatura e treinamentos com validade.',
    'RH',
    'Pessoas',
    49, 490, 39, 390, 79, 790,
    true,
    '1.0.0',
    ARRAY[]::text[],
    3,
    CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "modulos" WHERE "slug" = 'RH');

UPDATE "modulos"
SET
    "nome" = 'RH da obra',
    "descricao" = 'Ficha do trabalhador, entrega de EPI com assinatura e treinamentos com validade.',
    "sigla" = 'RH',
    "grupo" = 'Pessoas',
    "preco" = 49,
    "preco_anual" = 490,
    "preco_basico" = 39,
    "preco_anual_basico" = 390,
    "preco_enterprise" = 79,
    "preco_anual_enterprise" = 790,
    "ativo" = true,
    "ordem_exibicao" = 3
WHERE "slug" = 'RH';

UPDATE "modulos"
SET
    "preco" = 99,
    "preco_anual" = 990,
    "preco_basico" = 79,
    "preco_anual_basico" = 790,
    "preco_enterprise" = 149,
    "preco_anual_enterprise" = 1490,
    "ativo" = true,
    "ordem_exibicao" = 1
WHERE "slug" = 'RDO';

UPDATE "modulos"
SET
    "preco" = 59,
    "preco_anual" = 590,
    "preco_basico" = 39,
    "preco_anual_basico" = 390,
    "preco_enterprise" = 89,
    "preco_anual_enterprise" = 890,
    "ativo" = true,
    "ordem_exibicao" = 2
WHERE "slug" = 'MATERIAIS';

UPDATE "modulos"
SET
    "preco" = 0,
    "preco_anual" = 0,
    "preco_basico" = 0,
    "preco_anual_basico" = 0,
    "preco_enterprise" = 0,
    "preco_anual_enterprise" = 0,
    "grupo" = 'Operacional',
    "ativo" = true,
    "ordem_exibicao" = 4
WHERE "slug" = 'VISUALIZADOR';

UPDATE "modulos"
SET "ativo" = false
WHERE "slug" IN (
    'PLANEJAMENTO',
    'FVS',
    'PQO',
    'CTRL_TEC',
    'CLIENTES',
    'PROJETOS',
    'EQUIPAMENTOS',
    'MEDICOES',
    'SEGURANCA',
    'TREINAMENTOS',
    'IA'
);

-- Quem já usava o RH (preso ao estoque, ou com ficha gravada) continua com acesso.
INSERT INTO "tenant_modulos" (
    "id", "empresa_id", "modulo_id", "ativo", "periodicidade",
    "data_contratacao", "created_at", "updated_at"
)
SELECT
    gen_random_uuid()::text,
    e."id",
    rh."id",
    true,
    'MENSAL',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "empresas" e
CROSS JOIN "modulos" rh
WHERE rh."slug" = 'RH'
  AND e."deleted_at" IS NULL
  AND (
    EXISTS (
      SELECT 1
      FROM "tenant_modulos" t
      JOIN "modulos" mat ON mat."id" = t."modulo_id"
      WHERE t."empresa_id" = e."id"
        AND mat."slug" = 'MATERIAIS'
        AND t."ativo" = true
    )
    OR EXISTS (
      SELECT 1
      FROM "funcionarios" f
      WHERE f."empresa_id" = e."id"
        AND f."deleted_at" IS NULL
    )
  )
  AND NOT EXISTS (
    SELECT 1
    FROM "tenant_modulos" t
    WHERE t."empresa_id" = e."id"
      AND t."modulo_id" = rh."id"
  );

UPDATE "tenant_modulos" t
SET "ativo" = true, "updated_at" = CURRENT_TIMESTAMP
FROM "modulos" rh
WHERE t."modulo_id" = rh."id"
  AND rh."slug" = 'RH'
  AND (
    EXISTS (
      SELECT 1
      FROM "tenant_modulos" estoque
      JOIN "modulos" mat ON mat."id" = estoque."modulo_id"
      WHERE estoque."empresa_id" = t."empresa_id"
        AND mat."slug" = 'MATERIAIS'
        AND estoque."ativo" = true
    )
    OR EXISTS (
      SELECT 1
      FROM "funcionarios" f
      WHERE f."empresa_id" = t."empresa_id"
        AND f."deleted_at" IS NULL
    )
  );

INSERT INTO "usuario_modulos" ("id", "usuario_id", "modulo_id", "created_at")
SELECT
    gen_random_uuid()::text,
    um."usuario_id",
    rh."id",
    CURRENT_TIMESTAMP
FROM "usuario_modulos" um
JOIN "modulos" mat ON mat."id" = um."modulo_id" AND mat."slug" = 'MATERIAIS'
CROSS JOIN "modulos" rh
WHERE rh."slug" = 'RH'
  AND NOT EXISTS (
    SELECT 1
    FROM "usuario_modulos" ja
    WHERE ja."usuario_id" = um."usuario_id"
      AND ja."modulo_id" = rh."id"
  );

UPDATE "user_obra_roles"
SET "permissoes" = ("permissoes"::jsonb || jsonb_build_object('RH', "permissoes"::jsonb -> 'MATERIAIS'))
WHERE "permissoes" IS NOT NULL
  AND ("permissoes"::jsonb ? 'MATERIAIS')
  AND NOT ("permissoes"::jsonb ? 'RH');

UPDATE "papeis_empresa"
SET
    "capabilities" = jsonb_set(
        jsonb_set(
            CASE
                WHEN "capabilities"::jsonb ? 'modulosPadrao' THEN "capabilities"::jsonb
                ELSE jsonb_set("capabilities"::jsonb, '{modulosPadrao}', '{}'::jsonb, true)
            END,
            '{modulosPadrao,RH}',
            '"EDIT"'::jsonb,
            true
        ),
        '{modulosPadrao,MATERIAIS}',
        '"EDIT"'::jsonb,
        true
    ),
    "permissoes_padrao" = COALESCE("permissoes_padrao"::jsonb, '{}'::jsonb)
        || '{"RH":"EDIT","MATERIAIS":"EDIT"}'::jsonb,
    "updated_at" = CURRENT_TIMESTAMP
WHERE "tipo" = 'GESTOR';
