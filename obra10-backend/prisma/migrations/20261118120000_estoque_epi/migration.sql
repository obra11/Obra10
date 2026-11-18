-- Controle de estoque e entrega de EPI.
-- Idempotente: ambientes que já receberam db push não quebram no migrate deploy.

DO $$ BEGIN
  CREATE TYPE "TipoEstoqueItem" AS ENUM ('MATERIAL', 'EPI');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "TipoMovimentoEstoque" AS ENUM ('ENTRADA', 'SAIDA', 'AJUSTE', 'ENTREGA_EPI');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "estoque_itens" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "obra_id" TEXT NOT NULL,
    "tipo" "TipoEstoqueItem" NOT NULL,
    "nome" TEXT NOT NULL,
    "unidade" TEXT NOT NULL DEFAULT 'un',
    "codigo" TEXT,
    "ca_numero" TEXT,
    "estoque_minimo" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "saldo" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "catalogo_insumo_id" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "estoque_itens_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "estoque_itens_empresa_id_obra_id_tipo_idx"
  ON "estoque_itens"("empresa_id", "obra_id", "tipo");
CREATE INDEX IF NOT EXISTS "estoque_itens_obra_id_idx"
  ON "estoque_itens"("obra_id");

CREATE TABLE IF NOT EXISTS "epi_entregas" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "obra_id" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "colaborador_nome" TEXT NOT NULL,
    "colaborador_cpf" TEXT,
    "colaborador_funcao" TEXT,
    "colaborador_usuario_id" TEXT,
    "observacao" TEXT,
    "criado_por_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "epi_entregas_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "epi_entregas_empresa_id_obra_id_data_idx"
  ON "epi_entregas"("empresa_id", "obra_id", "data");

CREATE TABLE IF NOT EXISTS "estoque_movimentos" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "obra_id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "tipo" "TipoMovimentoEstoque" NOT NULL,
    "quantidade" DECIMAL(14,3) NOT NULL,
    "saldo_apos" DECIMAL(14,3) NOT NULL,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observacao" TEXT,
    "usuario_id" TEXT NOT NULL,
    "entrega_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "estoque_movimentos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "estoque_movimentos_empresa_id_obra_id_item_id_idx"
  ON "estoque_movimentos"("empresa_id", "obra_id", "item_id");
CREATE INDEX IF NOT EXISTS "estoque_movimentos_item_id_created_at_idx"
  ON "estoque_movimentos"("item_id", "created_at");

CREATE TABLE IF NOT EXISTS "epi_entrega_itens" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "entrega_id" TEXT NOT NULL,
    "item_id" TEXT,
    "nome" TEXT NOT NULL,
    "unidade" TEXT NOT NULL DEFAULT 'un',
    "quantidade" DECIMAL(14,3) NOT NULL,
    "ca_numero" TEXT,

    CONSTRAINT "epi_entrega_itens_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "epi_entrega_itens_empresa_id_entrega_id_idx"
  ON "epi_entrega_itens"("empresa_id", "entrega_id");

DO $$ BEGIN
  ALTER TABLE "estoque_itens"
    ADD CONSTRAINT "estoque_itens_empresa_id_fkey"
    FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "estoque_itens"
    ADD CONSTRAINT "estoque_itens_obra_id_fkey"
    FOREIGN KEY ("obra_id") REFERENCES "obras"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "epi_entregas"
    ADD CONSTRAINT "epi_entregas_empresa_id_fkey"
    FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "epi_entregas"
    ADD CONSTRAINT "epi_entregas_obra_id_fkey"
    FOREIGN KEY ("obra_id") REFERENCES "obras"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "epi_entregas"
    ADD CONSTRAINT "epi_entregas_criado_por_id_fkey"
    FOREIGN KEY ("criado_por_id") REFERENCES "usuarios"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "estoque_movimentos"
    ADD CONSTRAINT "estoque_movimentos_empresa_id_fkey"
    FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "estoque_movimentos"
    ADD CONSTRAINT "estoque_movimentos_obra_id_fkey"
    FOREIGN KEY ("obra_id") REFERENCES "obras"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "estoque_movimentos"
    ADD CONSTRAINT "estoque_movimentos_item_id_fkey"
    FOREIGN KEY ("item_id") REFERENCES "estoque_itens"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "estoque_movimentos"
    ADD CONSTRAINT "estoque_movimentos_usuario_id_fkey"
    FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "estoque_movimentos"
    ADD CONSTRAINT "estoque_movimentos_entrega_id_fkey"
    FOREIGN KEY ("entrega_id") REFERENCES "epi_entregas"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "epi_entrega_itens"
    ADD CONSTRAINT "epi_entrega_itens_entrega_id_fkey"
    FOREIGN KEY ("entrega_id") REFERENCES "epi_entregas"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "epi_entrega_itens"
    ADD CONSTRAINT "epi_entrega_itens_item_id_fkey"
    FOREIGN KEY ("item_id") REFERENCES "estoque_itens"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO "modulos" (
  "id", "slug", "nome", "descricao", "sigla", "grupo",
  "preco", "preco_anual", "preco_basico", "preco_anual_basico",
  "preco_enterprise", "preco_anual_enterprise",
  "ativo", "versao", "dependencias", "ordem_exibicao", "created_at"
)
SELECT
  'mod-epi-entrega-0001',
  'EPI',
  'Entrega de EPI',
  'Ficha de entrega de EPI (NR-6): colaborador, itens, CA e baixa no estoque.',
  'EPI',
  'Pessoas',
  29.90, 322.92, 23.92, 258.34, 44.85, 484.38,
  true, '1.0.0', ARRAY[]::TEXT[], 12, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "modulos" WHERE "slug" = 'EPI');

INSERT INTO "submodulos" ("id", "modulo_id", "slug", "nome", "descricao", "ativo", "created_at")
SELECT
  'sub-seguranca-epi-0001',
  m."id",
  'EPI',
  'Entrega de EPI',
  'Registro de entrega de equipamentos de proteção individual.',
  true,
  CURRENT_TIMESTAMP
FROM "modulos" m
WHERE m."slug" = 'SEGURANCA'
  AND NOT EXISTS (
    SELECT 1 FROM "submodulos" s
    WHERE s."modulo_id" = m."id" AND s."slug" = 'EPI'
  );
