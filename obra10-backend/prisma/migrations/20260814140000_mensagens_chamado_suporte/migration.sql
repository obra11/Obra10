-- CreateEnum
CREATE TYPE "AutorMensagemSuporte" AS ENUM ('USUARIO', 'SUPORTE');

-- CreateTable
CREATE TABLE "mensagens_chamado_suporte" (
    "id" TEXT NOT NULL,
    "chamado_id" TEXT NOT NULL,
    "autor_id" TEXT NOT NULL,
    "autor_tipo" "AutorMensagemSuporte" NOT NULL,
    "corpo" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mensagens_chamado_suporte_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mensagens_chamado_suporte_chamado_id_idx" ON "mensagens_chamado_suporte"("chamado_id");

-- CreateIndex
CREATE INDEX "mensagens_chamado_suporte_autor_id_idx" ON "mensagens_chamado_suporte"("autor_id");

-- AddForeignKey
ALTER TABLE "mensagens_chamado_suporte" ADD CONSTRAINT "mensagens_chamado_suporte_chamado_id_fkey" FOREIGN KEY ("chamado_id") REFERENCES "chamados_suporte"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensagens_chamado_suporte" ADD CONSTRAINT "mensagens_chamado_suporte_autor_id_fkey" FOREIGN KEY ("autor_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
