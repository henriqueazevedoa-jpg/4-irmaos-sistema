import { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;
const D = Prisma.Decimal;

// Abate um valor nas vendas em aberto do cliente (as MAIS ANTIGAS primeiro).
// Reduz o "valorFiadoAberto" de cada venda até esgotar o valor.
// Retorna quanto foi realmente abatido (pode ser menor que o valor, se a dívida for menor).
export async function abaterFiadoNasVendas(
  tx: Tx,
  clienteId: string,
  valor: Prisma.Decimal
): Promise<Prisma.Decimal> {
  const abertas = await tx.venda.findMany({
    where: { clienteId, status: "FINALIZADA", valorFiadoAberto: { gt: 0 } },
    orderBy: { dataVenda: "asc" },
  });

  let restante = valor;
  for (const v of abertas) {
    if (restante.lessThanOrEqualTo(0)) break;
    const abate = D.min(restante, v.valorFiadoAberto);
    await tx.venda.update({
      where: { id: v.id },
      data: { valorFiadoAberto: v.valorFiadoAberto.minus(abate) },
    });
    restante = restante.minus(abate);
  }

  return valor.minus(restante);
}
