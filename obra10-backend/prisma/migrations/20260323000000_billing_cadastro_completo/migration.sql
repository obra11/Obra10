-- CreateEnum
CREATE TYPE "Plano" AS ENUM ('BASICO', 'PRO', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "TipoCupom" AS ENUM ('GRATUIDADE', 'DESCONTO_FIXO', 'DESCONTO_PERCENTUAL');

-- CreateEnum
CREATE TYPE "PerfilGlobal" AS ENUM ('SUPER_ADMIN', 'GESTOR', 'USER');

-- CreateEnum
CREATE TYPE "TipoPessoa" AS ENUM ('FISICA', 'JURIDICA');

-- CreateEnum
CREATE TYPE "RdoStatus" AS ENUM ('RASCUNHO', 'EM_PREENCHIMENTO', 'SUBMETIDO', 'APROVADO', 'REJEITADO');

-- CreateEnum
CREATE TYPE "StatusExecucaoTarefa" AS ENUM ('EXECUTADO', 'PARCIAL', 'NAO_EXECUTADO');

-- CreateEnum
CREATE TYPE "MotivoNaoExecucao" AS ENUM ('FALTA_MATERIAL', 'FALTA_MAO_DE_OBRA', 'CHUVA', 'EQUIPAMENTO_INDISPONIVEL', 'AGUARDANDO_APROVACAO', 'PROJETO_NAO_LIBERADO', 'RETRABALHO', 'INTERFERENCIA_TERCEIROS', 'OUTROS');

-- CreateEnum
CREATE TYPE "TipoFeatureFlag" AS ENUM ('MODULO', 'FUNCIONALIDADE', 'EXPERIMENTAL');

-- AlterTable
ALTER TABLE "empresas" ADD COLUMN     "ativo" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "bairro" TEXT,
ADD COLUMN     "cep" TEXT,
ADD COLUMN     "cidade" TEXT,
ADD COLUMN     "complemento" TEXT,
ADD COLUMN     "cpf_cnpj" TEXT,
ADD COLUMN     "dias_inadimplente" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "email_verificado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "estado" TEXT,
ADD COLUMN     "id_asaas" TEXT,
ADD COLUMN     "limite_usuarios" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "logradouro" TEXT,
ADD COLUMN     "nome_completo" TEXT,
ADD COLUMN     "nome_fantasia" TEXT,
ADD COLUMN     "numero" TEXT,
ADD COLUMN     "plano" "Plano" NOT NULL DEFAULT 'BASICO',
ADD COLUMN     "suspensa" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "telefone" TEXT,
ADD COLUMN     "tipo_pessoa" "TipoPessoa" NOT NULL DEFAULT 'JURIDICA',
ADD COLUMN     "token_verificacao" TEXT,
ADD COLUMN     "token_verificacao_exp" TIMESTAMP(3),
ALTER COLUMN "cnpj" DROP NOT NULL,
ALTER COLUMN "razao_social" DROP NOT NULL;

-- AlterTable
ALTER TABLE "rdos" DROP COLUMN "clima_manha",
DROP COLUMN "clima_tarde",
DROP COLUMN "condicao_terreno",
ADD COLUMN     "aprovacao_at" TIMESTAMP(3),
ADD COLUMN     "aprovador_nome" TEXT,
ADD COLUMN     "dados_extras" JSONB,
ADD COLUMN     "rejeitado_motivo" TEXT,
ADD COLUMN     "submissao_at" TIMESTAMP(3),
DROP COLUMN "status",
ADD COLUMN     "status" "RdoStatus" NOT NULL DEFAULT 'RASCUNHO';

-- AlterTable
ALTER TABLE "user_obra_roles" ADD COLUMN     "permissoes" JSONB;

-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "aceitou_termos" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "data_aceite" TIMESTAMP(3),
ADD COLUMN     "foto_url" TEXT,
ADD COLUMN     "jwt_version" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "locked_until" TIMESTAMP(3),
ADD COLUMN     "login_attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "reset_token" TEXT,
ADD COLUMN     "reset_token_exp" TIMESTAMP(3),
ADD COLUMN     "ultimo_login" TIMESTAMP(3),
DROP COLUMN "perfil_global",
ADD COLUMN     "perfil_global" "PerfilGlobal" NOT NULL DEFAULT 'USER';

-- CreateTable
CREATE TABLE "tarefas_rdo" (
    "id" TEXT NOT NULL,
    "rdo_id" TEXT NOT NULL,
    "criado_por_id" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "frente_servico" TEXT,
    "status_execucao" "StatusExecucaoTarefa" NOT NULL DEFAULT 'EXECUTADO',
    "motivo_nao_execucao" "MotivoNaoExecucao",
    "motivo_texto" TEXT,
    "horas_executadas" DECIMAL(5,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tarefas_rdo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alertas_obra" (
    "id" TEXT NOT NULL,
    "obra_id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "mensagem" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "lido" BOOLEAN NOT NULL DEFAULT false,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alertas_obra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "relatorios_ia" (
    "id" TEXT NOT NULL,
    "obra_id" TEXT NOT NULL,
    "data_inicio" TIMESTAMP(3) NOT NULL,
    "data_fim" TIMESTAMP(3) NOT NULL,
    "conteudo" JSONB NOT NULL,
    "modelo" TEXT NOT NULL DEFAULT 'claude-sonnet-4-20250514',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "relatorios_ia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modulos" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "preco" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "sigla" TEXT,
    "grupo" TEXT NOT NULL DEFAULT 'GERAL',
    "versao" TEXT NOT NULL DEFAULT '1.0.0',
    "dependencias" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ordem_exibicao" INTEGER NOT NULL DEFAULT 99,

    CONSTRAINT "modulos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submodulos" (
    "id" TEXT NOT NULL,
    "modulo_id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "submodulos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integracoes_modulos" (
    "id" TEXT NOT NULL,
    "modulo_origem" TEXT NOT NULL,
    "modulo_destino" TEXT NOT NULL,
    "evento" TEXT NOT NULL,
    "descricao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "integracoes_modulos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_modulos" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "modulo_id" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "data_contratacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_modulos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuario_modulos" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "modulo_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_modulos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cobrancas" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "forma_pagamento" TEXT NOT NULL,
    "mes_referencia" TIMESTAMP(3) NOT NULL,
    "data_vencimento" TIMESTAMP(3) NOT NULL,
    "data_pagamento" TIMESTAMP(3),
    "link_pagamento" TEXT,
    "qr_code" TEXT,
    "qr_code_base64" TEXT,
    "id_asaas" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "notificado_em" TIMESTAMP(3),

    CONSTRAINT "cobrancas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cartoes_salvos" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "token_asaas" TEXT NOT NULL,
    "ultimos_digitos" TEXT NOT NULL,
    "bandeira" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cartoes_salvos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" TEXT NOT NULL,
    "id_asaas" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processado" BOOLEAN NOT NULL DEFAULT false,
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "erro" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cupons_desconto" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "tipo" "TipoCupom" NOT NULL,
    "valor" DECIMAL(10,2),
    "meses_gratuitos" INTEGER,
    "duracao_meses" INTEGER,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "usos_maximos" INTEGER,
    "usos_atuais" INTEGER NOT NULL DEFAULT 0,
    "expira_em" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cupons_desconto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "empresas_cupons" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "cupom_id" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "meses_usados" INTEGER NOT NULL DEFAULT 0,
    "aplicado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "empresas_cupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feature_flags" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT false,
    "tipo" "TipoFeatureFlag" NOT NULL DEFAULT 'MODULO',
    "versao" TEXT NOT NULL DEFAULT '1.0',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "empresas_features" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "feature_id" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ativado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "empresas_features_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tarefas_rdo_rdo_id_idx" ON "tarefas_rdo"("rdo_id");

-- CreateIndex
CREATE UNIQUE INDEX "alertas_obra_idempotency_key_key" ON "alertas_obra"("idempotency_key");

-- CreateIndex
CREATE INDEX "alertas_obra_obra_id_lido_idx" ON "alertas_obra"("obra_id", "lido");

-- CreateIndex
CREATE INDEX "relatorios_ia_obra_id_created_at_idx" ON "relatorios_ia"("obra_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "modulos_slug_key" ON "modulos"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "submodulos_modulo_id_slug_key" ON "submodulos"("modulo_id", "slug");

-- CreateIndex
CREATE INDEX "tenant_modulos_empresa_id_idx" ON "tenant_modulos"("empresa_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_modulos_empresa_id_modulo_id_key" ON "tenant_modulos"("empresa_id", "modulo_id");

-- CreateIndex
CREATE INDEX "usuario_modulos_usuario_id_idx" ON "usuario_modulos"("usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_modulos_usuario_id_modulo_id_key" ON "usuario_modulos"("usuario_id", "modulo_id");

-- CreateIndex
CREATE UNIQUE INDEX "cobrancas_id_asaas_key" ON "cobrancas"("id_asaas");

-- CreateIndex
CREATE UNIQUE INDEX "cobrancas_idempotency_key_key" ON "cobrancas"("idempotency_key");

-- CreateIndex
CREATE INDEX "cobrancas_empresa_id_status_idx" ON "cobrancas"("empresa_id", "status");

-- CreateIndex
CREATE INDEX "cobrancas_mes_referencia_idx" ON "cobrancas"("mes_referencia");

-- CreateIndex
CREATE UNIQUE INDEX "cartoes_salvos_empresa_id_key" ON "cartoes_salvos"("empresa_id");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_events_id_asaas_key" ON "webhook_events"("id_asaas");

-- CreateIndex
CREATE UNIQUE INDEX "cupons_desconto_codigo_key" ON "cupons_desconto"("codigo");

-- CreateIndex
CREATE INDEX "empresas_cupons_empresa_id_idx" ON "empresas_cupons"("empresa_id");

-- CreateIndex
CREATE UNIQUE INDEX "empresas_cupons_empresa_id_cupom_id_key" ON "empresas_cupons"("empresa_id", "cupom_id");

-- CreateIndex
CREATE UNIQUE INDEX "feature_flags_codigo_key" ON "feature_flags"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "empresas_features_empresa_id_feature_id_key" ON "empresas_features"("empresa_id", "feature_id");

-- CreateIndex
CREATE UNIQUE INDEX "empresas_cpf_cnpj_key" ON "empresas"("cpf_cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "empresas_email_key" ON "empresas"("email");

-- CreateIndex
CREATE UNIQUE INDEX "empresas_token_verificacao_key" ON "empresas"("token_verificacao");

-- CreateIndex
CREATE UNIQUE INDEX "empresas_id_asaas_key" ON "empresas"("id_asaas");

-- CreateIndex
CREATE INDEX "rdos_obra_id_status_idx" ON "rdos"("obra_id", "status");

-- AddForeignKey
ALTER TABLE "tarefas_rdo" ADD CONSTRAINT "tarefas_rdo_criado_por_id_fkey" FOREIGN KEY ("criado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarefas_rdo" ADD CONSTRAINT "tarefas_rdo_rdo_id_fkey" FOREIGN KEY ("rdo_id") REFERENCES "rdos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alertas_obra" ADD CONSTRAINT "alertas_obra_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relatorios_ia" ADD CONSTRAINT "relatorios_ia_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submodulos" ADD CONSTRAINT "submodulos_modulo_id_fkey" FOREIGN KEY ("modulo_id") REFERENCES "modulos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_modulos" ADD CONSTRAINT "tenant_modulos_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_modulos" ADD CONSTRAINT "tenant_modulos_modulo_id_fkey" FOREIGN KEY ("modulo_id") REFERENCES "modulos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_modulos" ADD CONSTRAINT "usuario_modulos_modulo_id_fkey" FOREIGN KEY ("modulo_id") REFERENCES "modulos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_modulos" ADD CONSTRAINT "usuario_modulos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cobrancas" ADD CONSTRAINT "cobrancas_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cartoes_salvos" ADD CONSTRAINT "cartoes_salvos_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "empresas_cupons" ADD CONSTRAINT "empresas_cupons_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "empresas_cupons" ADD CONSTRAINT "empresas_cupons_cupom_id_fkey" FOREIGN KEY ("cupom_id") REFERENCES "cupons_desconto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "empresas_features" ADD CONSTRAINT "empresas_features_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "empresas_features" ADD CONSTRAINT "empresas_features_feature_id_fkey" FOREIGN KEY ("feature_id") REFERENCES "feature_flags"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
