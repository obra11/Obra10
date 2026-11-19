-- Certificado do treinamento: PDF ou foto anexada no cadastro.

ALTER TABLE "treinamentos_funcionario" ADD COLUMN IF NOT EXISTS "certificado_url" TEXT;
ALTER TABLE "treinamentos_funcionario" ADD COLUMN IF NOT EXISTS "certificado_nome" TEXT;
ALTER TABLE "treinamentos_funcionario" ADD COLUMN IF NOT EXISTS "certificado_mime" TEXT;
