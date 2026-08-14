-- CreateTable
CREATE TABLE "despesas_financeiras" (
    "id" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "categoria" TEXT NOT NULL DEFAULT 'outro',
    "recorrente" BOOLEAN NOT NULL DEFAULT false,
    "observacao" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "despesas_financeiras_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "despesas_financeiras_data_idx" ON "despesas_financeiras"("data");

-- CreateIndex
CREATE INDEX "despesas_financeiras_categoria_idx" ON "despesas_financeiras"("categoria");
