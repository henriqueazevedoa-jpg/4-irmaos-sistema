import { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";

const D = Prisma.Decimal;

// Retorna o id do caixa aberto (ou null). Usa o client da transação quando dado.
export async function caixaAbertoId(db: Prisma.TransactionClient): Promise<string | null> {
  const c = await db.caixa.findFirst({ where: { status: "ABERTO" }, select: { id: true } });
  return c?.id ?? null;
}

// Monta o resumo financeiro de um caixa (o que entrou, sangrias, e quanto DEVE ter na gaveta).
export async function resumoCaixa(caixaId: string) {
  const caixa = await prisma.caixa.findUniqueOrThrow({ where: { id: caixaId } });

  const [porForma, movimentos, devDinheiro, qtdVendas] = await Promise.all([
    prisma.pagamento.groupBy({ by: ["forma"], where: { caixaId }, _sum: { valor: true } }),
    prisma.movimentoCaixa.groupBy({ by: ["tipo"], where: { caixaId }, _sum: { valor: true } }),
    prisma.devolucao.aggregate({ where: { caixaId, destino: "DINHEIRO" }, _sum: { valorTotal: true } }),
    prisma.venda.count({ where: { caixaId, status: "FINALIZADA" } }),
  ]);

  const dinheiro = porForma.find((f) => f.forma === "DINHEIRO")?._sum.valor ?? new D(0);
  const suprimentos = movimentos.find((m) => m.tipo === "SUPRIMENTO")?._sum.valor ?? new D(0);
  const sangrias = movimentos.find((m) => m.tipo === "SANGRIA")?._sum.valor ?? new D(0);
  const devolucoesDinheiro = devDinheiro._sum.valorTotal ?? new D(0);

  // Dinheiro que DEVE estar na gaveta agora
  const dinheiroEsperado = caixa.valorAbertura
    .plus(dinheiro)
    .plus(suprimentos)
    .minus(sangrias)
    .minus(devolucoesDinheiro);

  const diferenca =
    caixa.valorFechamentoContado != null
      ? caixa.valorFechamentoContado.minus(dinheiroEsperado)
      : null;

  return {
    valorAbertura: caixa.valorAbertura,
    porForma: porForma.map((f) => ({ forma: f.forma, total: f._sum.valor ?? new D(0) })),
    suprimentos,
    sangrias,
    devolucoesDinheiro,
    dinheiroEsperado,
    valorContado: caixa.valorFechamentoContado,
    diferenca,
    quantidadeVendas: qtdVendas,
  };
}
