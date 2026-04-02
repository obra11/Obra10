-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Plano" AS ENUM ('BASICO', 'PRO', 'ENTERPRISE');

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

-- CreateTable
CREATE TABLE "empresas" (
    "id" TEXT NOT NULL,
    "cnpj" TEXT,
    "razao_social" TEXT,
    "tipo_pessoa" "TipoPessoa" NOT NULL DEFAULT 'JURIDICA',
    "cpf_cnpj" TEXT,
    "nome_fantasia" TEXT,
    "nome_completo" TEXT,
    "email" TEXT,
    "telefone" TEXT,
    "cep" TEXT,
    "logradouro" TEXT,
    "numero" TEXT,
    "complemento" TEXT,
    "bairro" TEXT,
    "cidade" TEXT,
    "estado" TEXT,
    "email_verificado" BOOLEAN NOT NULL DEFAULT false,
    "token_verificacao" TEXT,
    "token_verificacao_exp" TIMESTAMP(3),
    "logo_url" TEXT,
    "plano" "Plano" NOT NULL DEFAULT 'BASICO',
    "limite_usuarios" INTEGER NOT NULL DEFAULT 5,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "suspensa" BOOLEAN NOT NULL DEFAULT false,
    "dias_inadimplente" INTEGER NOT NULL DEFAULT 0,
    "mes_gratuito" BOOLEAN NOT NULL DEFAULT true,
    "id_asaas" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "empresas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "obras" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "endereco" TEXT,
    "image_url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ATIVA',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "obras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senha_hash" TEXT NOT NULL,
    "telefone" TEXT,
    "perfil_global" "PerfilGlobal" NOT NULL DEFAULT 'USER',
    "foto_url" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "reset_token" TEXT,
    "reset_token_exp" TIMESTAMP(3),
    "jwt_version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "perfis" (
    "id" SERIAL NOT NULL,
    "nome_interno" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "perfis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_obra_roles" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "obra_id" TEXT NOT NULL,
    "perfil_id" INTEGER NOT NULL,
    "permissoes" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_obra_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rdos" (
    "id" TEXT NOT NULL,
    "obra_id" TEXT NOT NULL,
    "criador_id" TEXT NOT NULL,
    "aprovador_id" TEXT,
    "aprovador_nome" TEXT,
    "rejeitado_motivo" TEXT,
    "data_referencia" TIMESTAMP(3) NOT NULL,
    "clima_manha" TEXT,
    "clima_tarde" TEXT,
    "condicao_terreno" TEXT,
    "status" "RdoStatus" NOT NULL DEFAULT 'RASCUNHO',
    "submissao_at" TIMESTAMP(3),
    "aprovacao_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "rdos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rdo_atividades" (
    "id" TEXT NOT NULL,
    "rdo_id" TEXT NOT NULL,
    "criador_id" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "frente_servico" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "rdo_atividades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rdo_efetivos" (
    "id" TEXT NOT NULL,
    "rdo_id" TEXT NOT NULL,
    "criador_id" TEXT NOT NULL,
    "empresa_terceira" TEXT NOT NULL,
    "funcao_cargo" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "rdo_efetivos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rdo_ocorrencias" (
    "id" TEXT NOT NULL,
    "rdo_id" TEXT NOT NULL,
    "criador_id" TEXT NOT NULL,
    "tipo_ocorrencia" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "horas_perdidas" DECIMAL(65,30),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "rdo_ocorrencias_pkey" PRIMARY KEY ("id")
);

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
CREATE TABLE "anexos" (
    "id" TEXT NOT NULL,
    "obra_id" TEXT NOT NULL,
    "criador_id" TEXT NOT NULL,
    "origem_anexo" TEXT NOT NULL,
    "attachable_id" TEXT NOT NULL,
    "tipo_arquivo" TEXT NOT NULL,
    "nome_original" TEXT,
    "mime_type" TEXT NOT NULL,
    "tamanho_bytes" INTEGER NOT NULL,
    "url_s3" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "anexos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "obra_id" TEXT,
    "usuario_id" TEXT NOT NULL,
    "tabela_afetada" TEXT NOT NULL,
    "registro_id" TEXT NOT NULL,
    "acao" TEXT NOT NULL,
    "cargaAntiga" TEXT,
    "cargaNova" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modulos" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "sigla" TEXT,
    "grupo" TEXT NOT NULL DEFAULT 'GERAL',
    "preco" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "versao" TEXT NOT NULL DEFAULT '1.0.0',
    "dependencias" TEXT[],
    "ordem_exibicao" INTEGER NOT NULL DEFAULT 99,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

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

-- CreateIndex
CREATE UNIQUE INDEX "empresas_cnpj_key" ON "empresas"("cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "empresas_cpf_cnpj_key" ON "empresas"("cpf_cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "empresas_email_key" ON "empresas"("email");

-- CreateIndex
CREATE UNIQUE INDEX "empresas_token_verificacao_key" ON "empresas"("token_verificacao");

-- CreateIndex
CREATE UNIQUE INDEX "empresas_id_asaas_key" ON "empresas"("id_asaas");

-- CreateIndex
CREATE INDEX "obras_empresa_id_idx" ON "obras"("empresa_id");

-- CreateIndex
CREATE INDEX "usuarios_empresa_id_idx" ON "usuarios"("empresa_id");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_empresa_id_email_key" ON "usuarios"("empresa_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "perfis_nome_interno_key" ON "perfis"("nome_interno");

-- CreateIndex
CREATE INDEX "user_obra_roles_obra_id_idx" ON "user_obra_roles"("obra_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_obra_roles_usuario_id_obra_id_key" ON "user_obra_roles"("usuario_id", "obra_id");

-- CreateIndex
CREATE INDEX "rdos_obra_id_status_idx" ON "rdos"("obra_id", "status");

-- CreateIndex
CREATE INDEX "rdos_data_referencia_idx" ON "rdos"("data_referencia");

-- CreateIndex
CREATE UNIQUE INDEX "rdos_obra_id_data_referencia_deleted_at_key" ON "rdos"("obra_id", "data_referencia", "deleted_at");

-- CreateIndex
CREATE INDEX "rdo_atividades_rdo_id_idx" ON "rdo_atividades"("rdo_id");

-- CreateIndex
CREATE INDEX "rdo_efetivos_rdo_id_idx" ON "rdo_efetivos"("rdo_id");

-- CreateIndex
CREATE INDEX "rdo_ocorrencias_rdo_id_idx" ON "rdo_ocorrencias"("rdo_id");

-- CreateIndex
CREATE INDEX "tarefas_rdo_rdo_id_idx" ON "tarefas_rdo"("rdo_id");

-- CreateIndex
CREATE UNIQUE INDEX "alertas_obra_idempotency_key_key" ON "alertas_obra"("idempotency_key");

-- CreateIndex
CREATE INDEX "alertas_obra_obra_id_lido_idx" ON "alertas_obra"("obra_id", "lido");

-- CreateIndex
CREATE INDEX "relatorios_ia_obra_id_created_at_idx" ON "relatorios_ia"("obra_id", "created_at");

-- CreateIndex
CREATE INDEX "anexos_origem_anexo_attachable_id_idx" ON "anexos"("origem_anexo", "attachable_id");

-- CreateIndex
CREATE INDEX "anexos_obra_id_idx" ON "anexos"("obra_id");

-- CreateIndex
CREATE INDEX "audit_logs_empresa_id_created_at_idx" ON "audit_logs"("empresa_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_registro_id_idx" ON "audit_logs"("registro_id");

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

-- AddForeignKey
ALTER TABLE "obras" ADD CONSTRAINT "obras_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_obra_roles" ADD CONSTRAINT "user_obra_roles_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_obra_roles" ADD CONSTRAINT "user_obra_roles_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_obra_roles" ADD CONSTRAINT "user_obra_roles_perfil_id_fkey" FOREIGN KEY ("perfil_id") REFERENCES "perfis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rdos" ADD CONSTRAINT "rdos_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rdos" ADD CONSTRAINT "rdos_criador_id_fkey" FOREIGN KEY ("criador_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rdos" ADD CONSTRAINT "rdos_aprovador_id_fkey" FOREIGN KEY ("aprovador_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rdo_atividades" ADD CONSTRAINT "rdo_atividades_rdo_id_fkey" FOREIGN KEY ("rdo_id") REFERENCES "rdos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rdo_atividades" ADD CONSTRAINT "rdo_atividades_criador_id_fkey" FOREIGN KEY ("criador_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rdo_efetivos" ADD CONSTRAINT "rdo_efetivos_rdo_id_fkey" FOREIGN KEY ("rdo_id") REFERENCES "rdos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rdo_efetivos" ADD CONSTRAINT "rdo_efetivos_criador_id_fkey" FOREIGN KEY ("criador_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rdo_ocorrencias" ADD CONSTRAINT "rdo_ocorrencias_rdo_id_fkey" FOREIGN KEY ("rdo_id") REFERENCES "rdos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rdo_ocorrencias" ADD CONSTRAINT "rdo_ocorrencias_criador_id_fkey" FOREIGN KEY ("criador_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarefas_rdo" ADD CONSTRAINT "tarefas_rdo_rdo_id_fkey" FOREIGN KEY ("rdo_id") REFERENCES "rdos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarefas_rdo" ADD CONSTRAINT "tarefas_rdo_criado_por_id_fkey" FOREIGN KEY ("criado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alertas_obra" ADD CONSTRAINT "alertas_obra_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relatorios_ia" ADD CONSTRAINT "relatorios_ia_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anexos" ADD CONSTRAINT "anexos_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anexos" ADD CONSTRAINT "anexos_criador_id_fkey" FOREIGN KEY ("criador_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submodulos" ADD CONSTRAINT "submodulos_modulo_id_fkey" FOREIGN KEY ("modulo_id") REFERENCES "modulos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_modulos" ADD CONSTRAINT "tenant_modulos_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_modulos" ADD CONSTRAINT "tenant_modulos_modulo_id_fkey" FOREIGN KEY ("modulo_id") REFERENCES "modulos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_modulos" ADD CONSTRAINT "usuario_modulos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_modulos" ADD CONSTRAINT "usuario_modulos_modulo_id_fkey" FOREIGN KEY ("modulo_id") REFERENCES "modulos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cobrancas" ADD CONSTRAINT "cobrancas_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cartoes_salvos" ADD CONSTRAINT "cartoes_salvos_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
