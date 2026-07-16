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

// Se o cliente tem crédito (haver) E ainda deve, usa o crédito para abater a dívida
// automaticamente. Assim crédito e dívida nunca ficam parados lado a lado: o crédito
// entra direto como abatimento no fiado. Deve ser chamado após qualquer movimento que
// mexa nos saldos (venda no fiado, pagamento, devolução, cancelamento).
export async function aplicarHaverNoFiado(tx: Tx, clienteId: string): Promise<Prisma.Decimal> {
  const cliente = await tx.cliente.findUniqueOrThrow({ where: { id: clienteId } });
  if (cliente.saldoHaver.lessThanOrEqualTo(0) || cliente.saldoConta.lessThanOrEqualTo(0)) {
    return new D(0);
  }

  const usar = D.min(cliente.saldoHaver, cliente.saldoConta);
  await abaterFiadoNasVendas(tx, clienteId, usar);
  const novoSaldo = cliente.saldoConta.minus(usar);
  const novoHaver = cliente.saldoHaver.minus(usar);

  await tx.cliente.update({
    where: { id: clienteId },
    data: { saldoConta: novoSaldo, saldoHaver: novoHaver },
  });
  await tx.lancamentoConta.create({
    data: {
      clienteId,
      tipo: "CREDITO",
      valor: usar,
      saldoApos: novoSaldo,
      descricao: "Crédito (devolução) aplicado na conta",
    },
  });

  return usar;
}
