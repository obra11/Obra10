-- Obra 10 MVP - Script Lógico PostgreSQL (INIT.SQL v2/Corrigido)

-- 1. Criação de ENUMs (Corrigidos)
CREATE TYPE "StatusObra" AS ENUM ('ATIVA', 'FINALIZADA', 'PARALISADA');
CREATE TYPE "StatusRDO" AS ENUM ('RASCUNHO', 'ENVIADO', 'APROVADO', 'DEVOLVIDO');
CREATE TYPE "TipoClima" AS ENUM ('BOM', 'NUBLADO', 'CHUVA_LEVE', 'CHUVA_FORTE');
CREATE TYPE "CondicaoTerreno" AS ENUM ('SECO', 'UMIDO', 'LAMA', 'INTRANSITAVEL');
CREATE TYPE "TipoAnexo" AS ENUM ('FOTO', 'VIDEO', 'DOCUMENTO');
CREATE TYPE "OrigemAnexo" AS ENUM ('RDO', 'RDO_ATIVIDADE', 'FVS', 'LOTE_CONCRETO', 'PROJETO'); -- ADDED
CREATE TYPE "AcaoAuditoria" AS ENUM ('CREATE', 'UPDATE', 'SOFT_DELETE', 'APPROVE', 'RESTORE'); -- FIXED DELETE -> SOFT_DELETE

-- 2. Tabela de Perfil Sistêmico
CREATE TABLE "perfis" (
    "id" SERIAL PRIMARY KEY,
    "nome_interno" VARCHAR(50) UNIQUE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Core Tables
CREATE TABLE "empresas" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "cnpj" VARCHAR(14) UNIQUE NOT NULL,
    "razao_social" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3) NULL
);

CREATE TABLE "obras" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "empresa_id" UUID NOT NULL REFERENCES "empresas"("id") ON DELETE RESTRICT,
    "nome" VARCHAR(255) NOT NULL,
    "endereco" TEXT,
    "status" "StatusObra" NOT NULL DEFAULT 'ATIVA',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3) NULL
);
-- Indexação fundamental
CREATE INDEX "idx_obras_empresa" ON "obras"("empresa_id");

CREATE TABLE "usuarios" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "empresa_id" UUID NOT NULL REFERENCES "empresas"("id") ON DELETE RESTRICT,
    "nome" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "senha_hash" VARCHAR(255) NOT NULL,
    "telefone" VARCHAR(20),
    "ativo" BOOLEAN NOT NULL DEFAULT TRUE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3) NULL,
    UNIQUE("empresa_id", "email") -- FIXED MULTI TENANT EMAIL CLASH
);

CREATE TABLE "user_obra_roles" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "usuario_id" UUID NOT NULL REFERENCES "usuarios"("id") ON DELETE CASCADE,
    "obra_id" UUID NOT NULL REFERENCES "obras"("id") ON DELETE CASCADE,
    "perfil_id" INTEGER NOT NULL REFERENCES "perfis"("id") ON DELETE RESTRICT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE("usuario_id", "obra_id")
);

-- 4. RDO e Filhas
CREATE TABLE "rdos" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "obra_id" UUID NOT NULL REFERENCES "obras"("id") ON DELETE CASCADE,
    "criador_id" UUID NOT NULL REFERENCES "usuarios"("id") ON DELETE RESTRICT,
    "aprovador_id" UUID NULL REFERENCES "usuarios"("id") ON DELETE SET NULL,
    "data_referencia" DATE NOT NULL,
    "clima_manha" "TipoClima",
    "clima_tarde" "TipoClima",
    "condicao_terreno" "CondicaoTerreno",
    "status" "StatusRDO" NOT NULL DEFAULT 'RASCUNHO',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3) NULL
);
CREATE INDEX "idx_rdos_obra_data" ON "rdos"("obra_id", "data_referencia");

CREATE TABLE "rdo_atividades" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "rdo_id" UUID NOT NULL REFERENCES "rdos"("id") ON DELETE CASCADE,
    "criador_id" UUID NOT NULL REFERENCES "usuarios"("id") ON DELETE RESTRICT,
    "descricao" TEXT NOT NULL,
    "frente_servico" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, -- ADDED
    "deleted_at" TIMESTAMP(3) NULL -- ADDED
);

CREATE TABLE "rdo_efetivos" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "rdo_id" UUID NOT NULL REFERENCES "rdos"("id") ON DELETE CASCADE,
    "criador_id" UUID NOT NULL REFERENCES "usuarios"("id") ON DELETE RESTRICT,
    "empresa_terceira" VARCHAR(255) NOT NULL,
    "funcao_cargo" VARCHAR(255) NOT NULL,
    "quantidade" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, -- ADDED
    "deleted_at" TIMESTAMP(3) NULL -- ADDED
);

CREATE TABLE "rdo_ocorrencias" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "rdo_id" UUID NOT NULL REFERENCES "rdos"("id") ON DELETE CASCADE,
    "criador_id" UUID NOT NULL REFERENCES "usuarios"("id") ON DELETE RESTRICT,
    "tipo_ocorrencia" VARCHAR(100) NOT NULL,
    "descricao" TEXT NOT NULL,
    "horas_perdidas" DECIMAL(5,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, -- ADDED
    "deleted_at" TIMESTAMP(3) NULL -- ADDED
);

-- 5. Anexos e Auditoria
CREATE TABLE "anexos" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "obra_id" UUID NOT NULL REFERENCES "obras"("id") ON DELETE CASCADE,
    "criador_id" UUID NOT NULL REFERENCES "usuarios"("id") ON DELETE RESTRICT,
    "origem_anexo" "OrigemAnexo" NOT NULL, -- FIXED (Foi mudado de String Livre para Enum)
    "attachable_id" UUID NOT NULL,
    "nome_original" VARCHAR(255) NULL, -- FIXED
    "tipo_arquivo" "TipoAnexo" NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "tamanho_bytes" INTEGER NOT NULL,
    "url_s3" VARCHAR(500) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, -- ADDED
    "deleted_at" TIMESTAMP(3) NULL
);
CREATE INDEX "idx_anexos_origem" ON "anexos"("origem_anexo", "attachable_id");

CREATE TABLE "audit_logs" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "empresa_id" UUID NOT NULL REFERENCES "empresas"("id") ON DELETE CASCADE,
    "obra_id" UUID NULL REFERENCES "obras"("id") ON DELETE SET NULL, -- FIXED
    "usuario_id" UUID NOT NULL REFERENCES "usuarios"("id") ON DELETE RESTRICT,
    "tabela_afetada" VARCHAR(100) NOT NULL,
    "registro_id" UUID NOT NULL,
    "acao" "AcaoAuditoria" NOT NULL,
    "carga_antiga" JSONB,
    "carga_nova" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "idx_auditlog_empresa" ON "audit_logs"("empresa_id");
CREATE INDEX "idx_auditlog_obra" ON "audit_logs"("obra_id");
