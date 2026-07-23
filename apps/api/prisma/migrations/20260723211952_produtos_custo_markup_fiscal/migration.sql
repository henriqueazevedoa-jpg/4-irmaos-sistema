-- AlterTable
ALTER TABLE "Produto" ADD COLUMN     "codigoExterno" TEXT,
ADD COLUMN     "csosn" TEXT,
ADD COLUMN     "custoMedio" DECIMAL(14,4) NOT NULL DEFAULT 0,
ADD COLUMN     "fabricante" TEXT,
ADD COLUMN     "icmsAliquota" DECIMAL(6,2),
ADD COLUMN     "markup" DECIMAL(9,4) NOT NULL DEFAULT 0,
ADD COLUMN     "origem" TEXT;

-- CreateIndex
CREATE INDEX "Produto_codigoExterno_idx" ON "Produto"("codigoExterno");
