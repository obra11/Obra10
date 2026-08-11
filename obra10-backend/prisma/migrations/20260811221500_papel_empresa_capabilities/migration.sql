-- AlterEnum
ALTER TYPE "PerfilGlobal" ADD VALUE 'EXTERNO';
ALTER TYPE "PerfilGlobal" ADD VALUE 'PERSONALIZADO';

-- CreateEnum
CREATE TYPE "TipoPapelEmpresa" AS ENUM ('GESTOR', 'COLABORADOR', 'EXTERNO', 'PERSONALIZADO');

-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN "capabilities" JSONB;

-- CreateTable
CREATE TABLE "papeis_empresa" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "tipo" "TipoPapelEmpresa" NOT NULL,
    "nome" TEXT NOT NULL,
    "capabilities" JSONB NOT NULL,
    "permissoes_padrao" JSONB,
    "editavel" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "papeis_empresa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "papeis_empresa_empresa_id_idx" ON "papeis_empresa"("empresa_id");

-- CreateIndex
CREATE UNIQUE INDEX "papeis_empresa_empresa_id_tipo_key" ON "papeis_empresa"("empresa_id", "tipo");

-- AddForeignKey
ALTER TABLE "papeis_empresa" ADD CONSTRAINT "papeis_empresa_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
