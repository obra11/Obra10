-- Liga o Controle de Materiais no catalogo e nas empresas.
-- Sem COMMIT/BEGIN: o Prisma grava esta migration numa transacao so.

DO $$ BEGIN
  CREATE TYPE "CategoriaInsumo" AS ENUM ('CONSTRUCAO', 'LIMPEZA', 'OUTRO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "TipoDocumentoEntrada" AS ENUM ('NFE', 'NFCE_CUPOM', 'FOTO', 'MANUAL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "StatusDocumentoEntrada" AS ENUM ('EXTRAINDO', 'EM_CONFERENCIA', 'CONFIRMADA', 'REJEITADA', 'ESTORNADA');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "StatusItemEntrada" AS ENUM ('PENDENTE', 'VINCULADO', 'NOVO', 'IGNORADO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "TipoLocalEstoque" AS ENUM ('DEPOSITO_CENTRAL', 'ALMOXARIFADO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "TipoMovimentoEstoque" AS ENUM ('ENTRADA', 'SAIDA', 'TRANSFERENCIA', 'ESTORNO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "catalogo_insumos" ADD COLUMN IF NOT EXISTS "categoria" "CategoriaInsumo" NOT NULL DEFAULT 'OUTRO';
ALTER TABLE "catalogo_insumos" ADD COLUMN IF NOT EXISTS "ean" TEXT;
ALTER TABLE "catalogo_insumos" ADD COLUMN IF NOT EXISTS "codigo_barras" TEXT;

CREATE INDEX IF NOT EXISTS "catalogo_insumos_empresa_id_ean_idx" ON "catalogo_insumos"("empresa_id", "ean");
CREATE INDEX IF NOT EXISTS "catalogo_insumos_empresa_id_codigo_barras_idx" ON "catalogo_insumos"("empresa_id", "codigo_barras");

CREATE TABLE IF NOT EXISTS "fornecedores" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "cnpj" TEXT,
    "razao_social" TEXT NOT NULL,
    "nome_fantasia" TEXT,
    "ie" TEXT,
    "telefone" TEXT,
    "email" TEXT,
    "endereco" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "fornecedores_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "locais_estoque" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "obra_id" TEXT,
    "tipo" "TipoLocalEstoque" NOT NULL,
    "nome" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "locais_estoque_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "funcionarios" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "obra_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "funcao" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "funcionarios_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "documentos_entrada" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "local_id" TEXT NOT NULL,
    "obra_id" TEXT,
    "tipo" "TipoDocumentoEntrada" NOT NULL DEFAULT 'NFE',
    "status" "StatusDocumentoEntrada" NOT NULL DEFAULT 'EXTRAINDO',
    "numero" TEXT,
    "serie" TEXT,
    "chave_acesso" TEXT,
    "data_emissao" TIMESTAMP(3),
    "valor_total" DECIMAL(14,2),
    "fornecedor_id" TEXT,
    "fornecedor_cnpj" TEXT,
    "fornecedor_razao" TEXT,
    "fornecedor_ie" TEXT,
    "fornecedor_telefone" TEXT,
    "fornecedor_email" TEXT,
    "recebedor_id" TEXT NOT NULL,
    "criador_id" TEXT NOT NULL,
    "imagem_url" TEXT,
    "imagem_mime" TEXT,
    "imagem_nome" TEXT,
    "observacao" TEXT,
    "observacao_extracao" TEXT,
    "rejeitado_motivo" TEXT,
    "confirmado_em" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "documentos_entrada_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "documentos_entrada_itens" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "documento_id" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "descricao_original" TEXT NOT NULL,
    "descricao_normalizada" TEXT NOT NULL,
    "quantidade" DECIMAL(14,4) NOT NULL,
    "unidade" TEXT,
    "valor_unitario" DECIMAL(14,4),
    "valor_total" DECIMAL(14,2),
    "ncm" TEXT,
    "ean" TEXT,
    "insumo_id" TEXT,
    "status" "StatusItemEntrada" NOT NULL DEFAULT 'PENDENTE',
    "tipo_insumo" "TipoInsumo",
    "candidatos" JSONB,
    CONSTRAINT "documentos_entrada_itens_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "insumos_alias" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "insumo_id" TEXT NOT NULL,
    "fornecedor_id" TEXT,
    "descricao_original" TEXT NOT NULL,
    "descricao_normalizada" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "insumos_alias_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "saldos_estoque" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "local_id" TEXT NOT NULL,
    "insumo_id" TEXT NOT NULL,
    "quantidade" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "saldos_estoque_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "movimentos_estoque" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "tipo" "TipoMovimentoEstoque" NOT NULL,
    "insumo_id" TEXT NOT NULL,
    "local_origem_id" TEXT,
    "local_destino_id" TEXT,
    "quantidade" DECIMAL(14,4) NOT NULL,
    "documento_id" TEXT,
    "usuario_id" TEXT NOT NULL,
    "motivo" TEXT,
    "retirado_por" TEXT,
    "funcionario_id" TEXT,
    "data_recebimento" TIMESTAMP(3),
    "assinatura" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "movimentos_estoque_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "fornecedores_empresa_id_cnpj_key" ON "fornecedores"("empresa_id", "cnpj");
CREATE INDEX IF NOT EXISTS "fornecedores_empresa_id_idx" ON "fornecedores"("empresa_id");
CREATE UNIQUE INDEX IF NOT EXISTS "locais_estoque_empresa_id_codigo_key" ON "locais_estoque"("empresa_id", "codigo");
CREATE INDEX IF NOT EXISTS "locais_estoque_empresa_id_tipo_idx" ON "locais_estoque"("empresa_id", "tipo");
CREATE INDEX IF NOT EXISTS "funcionarios_empresa_id_obra_id_idx" ON "funcionarios"("empresa_id", "obra_id");
CREATE INDEX IF NOT EXISTS "documentos_entrada_empresa_id_status_idx" ON "documentos_entrada"("empresa_id", "status");
CREATE INDEX IF NOT EXISTS "documentos_entrada_empresa_id_local_id_idx" ON "documentos_entrada"("empresa_id", "local_id");
CREATE INDEX IF NOT EXISTS "documentos_entrada_itens_documento_id_idx" ON "documentos_entrada_itens"("documento_id");
CREATE INDEX IF NOT EXISTS "documentos_entrada_itens_empresa_id_idx" ON "documentos_entrada_itens"("empresa_id");
CREATE UNIQUE INDEX IF NOT EXISTS "insumos_alias_empresa_id_descricao_normalizada_key" ON "insumos_alias"("empresa_id", "descricao_normalizada");
CREATE INDEX IF NOT EXISTS "insumos_alias_empresa_id_insumo_id_idx" ON "insumos_alias"("empresa_id", "insumo_id");
CREATE UNIQUE INDEX IF NOT EXISTS "saldos_estoque_local_id_insumo_id_key" ON "saldos_estoque"("local_id", "insumo_id");
CREATE INDEX IF NOT EXISTS "saldos_estoque_empresa_id_local_id_idx" ON "saldos_estoque"("empresa_id", "local_id");
CREATE INDEX IF NOT EXISTS "movimentos_estoque_empresa_id_created_at_idx" ON "movimentos_estoque"("empresa_id", "created_at");
CREATE INDEX IF NOT EXISTS "movimentos_estoque_documento_id_idx" ON "movimentos_estoque"("documento_id");
CREATE INDEX IF NOT EXISTS "movimentos_estoque_funcionario_id_idx" ON "movimentos_estoque"("funcionario_id");

DO $$ BEGIN
  ALTER TABLE "fornecedores" ADD CONSTRAINT "fornecedores_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "locais_estoque" ADD CONSTRAINT "locais_estoque_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "locais_estoque" ADD CONSTRAINT "locais_estoque_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "funcionarios" ADD CONSTRAINT "funcionarios_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "funcionarios" ADD CONSTRAINT "funcionarios_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "documentos_entrada" ADD CONSTRAINT "documentos_entrada_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "documentos_entrada" ADD CONSTRAINT "documentos_entrada_local_id_fkey" FOREIGN KEY ("local_id") REFERENCES "locais_estoque"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "documentos_entrada" ADD CONSTRAINT "documentos_entrada_fornecedor_id_fkey" FOREIGN KEY ("fornecedor_id") REFERENCES "fornecedores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "documentos_entrada" ADD CONSTRAINT "documentos_entrada_recebedor_id_fkey" FOREIGN KEY ("recebedor_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "documentos_entrada" ADD CONSTRAINT "documentos_entrada_criador_id_fkey" FOREIGN KEY ("criador_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "documentos_entrada_itens" ADD CONSTRAINT "documentos_entrada_itens_documento_id_fkey" FOREIGN KEY ("documento_id") REFERENCES "documentos_entrada"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "documentos_entrada_itens" ADD CONSTRAINT "documentos_entrada_itens_insumo_id_fkey" FOREIGN KEY ("insumo_id") REFERENCES "catalogo_insumos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "insumos_alias" ADD CONSTRAINT "insumos_alias_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "insumos_alias" ADD CONSTRAINT "insumos_alias_insumo_id_fkey" FOREIGN KEY ("insumo_id") REFERENCES "catalogo_insumos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "insumos_alias" ADD CONSTRAINT "insumos_alias_fornecedor_id_fkey" FOREIGN KEY ("fornecedor_id") REFERENCES "fornecedores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "saldos_estoque" ADD CONSTRAINT "saldos_estoque_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "saldos_estoque" ADD CONSTRAINT "saldos_estoque_local_id_fkey" FOREIGN KEY ("local_id") REFERENCES "locais_estoque"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "saldos_estoque" ADD CONSTRAINT "saldos_estoque_insumo_id_fkey" FOREIGN KEY ("insumo_id") REFERENCES "catalogo_insumos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "movimentos_estoque" ADD CONSTRAINT "movimentos_estoque_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "movimentos_estoque" ADD CONSTRAINT "movimentos_estoque_insumo_id_fkey" FOREIGN KEY ("insumo_id") REFERENCES "catalogo_insumos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "movimentos_estoque" ADD CONSTRAINT "movimentos_estoque_local_origem_id_fkey" FOREIGN KEY ("local_origem_id") REFERENCES "locais_estoque"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "movimentos_estoque" ADD CONSTRAINT "movimentos_estoque_local_destino_id_fkey" FOREIGN KEY ("local_destino_id") REFERENCES "locais_estoque"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "movimentos_estoque" ADD CONSTRAINT "movimentos_estoque_documento_id_fkey" FOREIGN KEY ("documento_id") REFERENCES "documentos_entrada"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "movimentos_estoque" ADD CONSTRAINT "movimentos_estoque_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "movimentos_estoque" ADD CONSTRAINT "movimentos_estoque_funcionario_id_fkey" FOREIGN KEY ("funcionario_id") REFERENCES "funcionarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO "modulos" (
    "id", "slug", "nome", "descricao", "sigla", "grupo", "preco", "ativo", "versao", "dependencias", "ordem_exibicao", "created_at"
)
SELECT
    gen_random_uuid()::text,
    'MATERIAIS',
    'Controle de Materiais e Estoque',
    'Requisições, estoque e rastreabilidade de materiais.',
    'Material',
    'Gestão',
    29.90,
    true,
    '1.0.0',
    ARRAY[]::text[],
    8,
    CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "modulos" WHERE "slug" = 'MATERIAIS');

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
WHERE m."slug" = 'MATERIAIS'
  AND e."deleted_at" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "tenant_modulos" t
    WHERE t."empresa_id" = e."id" AND t."modulo_id" = m."id"
  );

ALTER TABLE "movimentos_estoque" ADD COLUMN IF NOT EXISTS "assinatura" TEXT;
ALTER TABLE "movimentos_estoque" ADD COLUMN IF NOT EXISTS "funcionario_id" TEXT;
ALTER TABLE "movimentos_estoque" ADD COLUMN IF NOT EXISTS "data_recebimento" TIMESTAMP(3);
ALTER TABLE "movimentos_estoque" ADD COLUMN IF NOT EXISTS "retirado_por" TEXT;

UPDATE "modulos"
SET "ativo" = true,
    "nome" = 'Controle de Materiais e Estoque',
    "grupo" = 'Gestão',
    "ordem_exibicao" = 8
WHERE "slug" = 'MATERIAIS';

UPDATE "tenant_modulos" t
SET "ativo" = true, "updated_at" = CURRENT_TIMESTAMP
FROM "modulos" m
WHERE t."modulo_id" = m."id"
  AND m."slug" = 'MATERIAIS'
  AND t."ativo" = false;
