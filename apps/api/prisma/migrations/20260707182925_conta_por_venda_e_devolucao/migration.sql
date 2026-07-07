-- CreateEnum
CREATE TYPE "DestinoDevolucao" AS ENUM ('DINHEIRO', 'HAVER', 'ABATER_FIADO');

-- AlterTable
ALTER TABLE "Cliente" ADD COLUMN     "saldoHaver" DECIMAL(14,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Venda" ADD COLUMN     "valorFiado" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "valorFiadoAberto" DECIMAL(14,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "VendaItem" ADD COLUMN     "quantidadeDevolvida" DECIMAL(14,3) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Devolucao" (
    "id" TEXT NOT NULL,
    "vendaId" TEXT NOT NULL,
    "clienteId" TEXT,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valorTotal" DECIMAL(14,2) NOT NULL,
    "destino" "DestinoDevolucao" NOT NULL,
    "formaPagamento" "FormaPagamento",
    "observacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Devolucao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DevolucaoItem" (
    "id" TEXT NOT NULL,
    "devolucaoId" TEXT NOT NULL,
    "vendaItemId" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "quantidade" DECIMAL(14,3) NOT NULL,
    "valorUnitario" DECIMAL(14,2) NOT NULL,
    "valorTotal" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "DevolucaoItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Devolucao_vendaId_idx" ON "Devolucao"("vendaId");

-- CreateIndex
CREATE INDEX "Devolucao_clienteId_idx" ON "Devolucao"("clienteId");

-- CreateIndex
CREATE INDEX "DevolucaoItem_devolucaoId_idx" ON "DevolucaoItem"("devolucaoId");

-- AddForeignKey
ALTER TABLE "Devolucao" ADD CONSTRAINT "Devolucao_vendaId_fkey" FOREIGN KEY ("vendaId") REFERENCES "Venda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Devolucao" ADD CONSTRAINT "Devolucao_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DevolucaoItem" ADD CONSTRAINT "DevolucaoItem_devolucaoId_fkey" FOREIGN KEY ("devolucaoId") REFERENCES "Devolucao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DevolucaoItem" ADD CONSTRAINT "DevolucaoItem_vendaItemId_fkey" FOREIGN KEY ("vendaItemId") REFERENCES "VendaItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DevolucaoItem" ADD CONSTRAINT "DevolucaoItem_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
