-- CreateTable
CREATE TABLE "empresas" (
    "id" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "razao_social" TEXT NOT NULL,
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
    "ativo" BOOLEAN NOT NULL DEFAULT true,
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
    "data_referencia" TIMESTAMP(3) NOT NULL,
    "clima_manha" TEXT,
    "clima_tarde" TEXT,
    "condicao_terreno" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RASCUNHO',
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

-- CreateIndex
CREATE UNIQUE INDEX "empresas_cnpj_key" ON "empresas"("cnpj");

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
CREATE INDEX "anexos_origem_anexo_attachable_id_idx" ON "anexos"("origem_anexo", "attachable_id");

-- CreateIndex
CREATE INDEX "anexos_obra_id_idx" ON "anexos"("obra_id");

-- CreateIndex
CREATE INDEX "audit_logs_empresa_id_created_at_idx" ON "audit_logs"("empresa_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_registro_id_idx" ON "audit_logs"("registro_id");

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
ALTER TABLE "anexos" ADD CONSTRAINT "anexos_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anexos" ADD CONSTRAINT "anexos_criador_id_fkey" FOREIGN KEY ("criador_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
