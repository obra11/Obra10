-- CreateEnum
CREATE TYPE "StatusChamadoSuporte" AS ENUM ('ABERTO', 'EM_ANDAMENTO', 'AGUARDANDO_USUARIO', 'RESOLVIDO', 'FECHADO');

-- CreateEnum
CREATE TYPE "CategoriaChamadoSuporte" AS ENUM ('BILLING', 'TECNICO', 'CONTA', 'OUTRO');

-- CreateTable
CREATE TABLE "chamados_suporte" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "assunto" TEXT NOT NULL,
    "categoria" "CategoriaChamadoSuporte" NOT NULL DEFAULT 'OUTRO',
    "descricao" TEXT NOT NULL,
    "status" "StatusChamadoSuporte" NOT NULL DEFAULT 'ABERTO',
    "whatsapp_enviado_em" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chamados_suporte_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chamados_suporte_empresa_id_idx" ON "chamados_suporte"("empresa_id");

-- CreateIndex
CREATE INDEX "chamados_suporte_usuario_id_idx" ON "chamados_suporte"("usuario_id");

-- CreateIndex
CREATE INDEX "chamados_suporte_status_idx" ON "chamados_suporte"("status");

-- AddForeignKey
ALTER TABLE "chamados_suporte" ADD CONSTRAINT "chamados_suporte_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chamados_suporte" ADD CONSTRAINT "chamados_suporte_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
