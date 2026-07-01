import type { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../prisma.js";

// Interpreta os parâmetros de período (?de=YYYY-MM-DD&ate=YYYY-MM-DD).
// Sem parâmetros, usa os últimos 30 dias.
function lerPeriodo(query: unknown) {
  const q = z.object({ de: z.string().optional(), ate: z.string().optional() }).parse(query);
  const gte = q.de ? new Date(`${q.de}T00:00:00`) : new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const lte = q.ate ? new Date(`${q.ate}T23:59:59.999`) : new Date();
  return { gte, lte };
}

export async function rotasRelatorios(app: FastifyInstance) {
  // ── Relatório de vendas do período ──────────────────────────────────
  app.get("/relatorios/vendas", async (req) => {
    const { gte, lte } = lerPeriodo(req.query);
    const filtroVenda = { status: "FINALIZADA" as const, dataVenda: { gte, lte } };

    // Total e quantidade de vendas
    const resumo = await prisma.venda.aggregate({
      where: filtroVenda,
      _count: { _all: true },
      _sum: { total: true },
    });
    const totalVendas = resumo._count._all;
    const valorTotal = resumo._sum.total ?? new Prisma.Decimal(0);
    const ticketMedio = totalVendas > 0 ? valorTotal.div(totalVendas) : new Prisma.Decimal(0);

    // Total por forma de pagamento
    const formas = await prisma.pagamento.groupBy({
      by: ["forma"],
      where: { venda: filtroVenda },
      _sum: { valor: true },
    });

    // Produtos mais vendidos
    const grupos = await prisma.vendaItem.groupBy({
      by: ["produtoId"],
      where: { venda: filtroVenda },
      _sum: { quantidade: true, total: true },
      orderBy: { _sum: { total: "desc" } },
      take: 10,
    });
    const produtos = await prisma.produto.findMany({
      where: { id: { in: grupos.map((g) => g.produtoId) } },
      select: { id: true, descricao: true, unidade: true },
    });
    const mapaProduto = new Map(produtos.map((p) => [p.id, p]));

    return {
      periodo: { de: gte, ate: lte },
      totalVendas,
      valorTotal,
      ticketMedio,
      porForma: formas.map((f) => ({ forma: f.forma, total: f._sum.valor ?? "0" })),
      maisVendidos: grupos.map((g) => ({
        produtoId: g.produtoId,
        descricao: mapaProduto.get(g.produtoId)?.descricao ?? "—",
        unidade: mapaProduto.get(g.produtoId)?.unidade ?? "",
        quantidade: g._sum.quantidade ?? "0",
        total: g._sum.total ?? "0",
      })),
    };
  });

  // ── Relatório financeiro (fiado a receber + estoque baixo) ──────────
  app.get("/relatorios/financeiro", async () => {
    // Clientes com saldo devedor (fiado em aberto)
    const devedores = await prisma.cliente.findMany({
      where: { saldoConta: { gt: 0 } },
      select: { id: true, nome: true, saldoConta: true, telefone: true },
      orderBy: { saldoConta: "desc" },
    });
    const totalReceber = devedores.reduce(
      (acc, c) => acc.plus(c.saldoConta),
      new Prisma.Decimal(0)
    );

    // Produtos com estoque abaixo (ou igual) do mínimo
    const ativos = await prisma.produto.findMany({
      where: { ativo: true },
      select: {
        id: true,
        descricao: true,
        unidade: true,
        saldoEstoque: true,
        estoqueMinimo: true,
      },
      orderBy: { descricao: "asc" },
    });
    const estoqueBaixo = ativos.filter((p) => p.saldoEstoque.lessThanOrEqualTo(p.estoqueMinimo));

    return {
      contasReceber: { total: totalReceber, clientes: devedores },
      estoqueBaixo,
    };
  });
}
