-- Pacote de obras na empresa (padrão: até 5 = preços cadastrados)
ALTER TABLE "empresas" ADD COLUMN IF NOT EXISTS "pacote_obras" TEXT NOT NULL DEFAULT 'ATE_5';
ALTER TABLE "empresas" ADD COLUMN IF NOT EXISTS "limite_obras" INTEGER DEFAULT 5;

-- Cobranças: registrar pacote usado no cálculo
ALTER TABLE "cobrancas" ADD COLUMN IF NOT EXISTS "pacote_obras" TEXT NOT NULL DEFAULT 'ATE_5';

-- Clientes existentes: pacote até 5 obras (preço RDO R$99 cadastrado)
UPDATE "empresas"
SET "pacote_obras" = 'ATE_5', "limite_obras" = 5
WHERE "pacote_obras" IS NULL OR "pacote_obras" = '' OR "limite_obras" IS NULL;
