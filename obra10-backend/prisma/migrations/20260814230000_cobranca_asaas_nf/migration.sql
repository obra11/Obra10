-- Conciliação Asaas (líquido/taxas) + NFS-e
ALTER TABLE "cobrancas" ADD COLUMN IF NOT EXISTS "valor_liquido" DECIMAL(10,2);
ALTER TABLE "cobrancas" ADD COLUMN IF NOT EXISTS "taxa_asaas" DECIMAL(10,2);
ALTER TABLE "cobrancas" ADD COLUMN IF NOT EXISTS "status_asaas" TEXT;
ALTER TABLE "cobrancas" ADD COLUMN IF NOT EXISTS "id_nota_asaas" TEXT;
ALTER TABLE "cobrancas" ADD COLUMN IF NOT EXISTS "status_nota" TEXT;
ALTER TABLE "cobrancas" ADD COLUMN IF NOT EXISTS "nota_pdf_url" TEXT;
ALTER TABLE "cobrancas" ADD COLUMN IF NOT EXISTS "nota_xml_url" TEXT;
