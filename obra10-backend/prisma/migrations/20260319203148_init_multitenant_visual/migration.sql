-- AlterTable
ALTER TABLE "empresas" ADD COLUMN     "logo_url" TEXT;

-- AlterTable
ALTER TABLE "obras" ADD COLUMN     "image_url" TEXT;

-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "perfil_global" TEXT NOT NULL DEFAULT 'PADRAO';
