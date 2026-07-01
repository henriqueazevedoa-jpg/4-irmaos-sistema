import type { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { textoOpcional } from "../lib/campos.js";
import { paginacaoQuery, montarPaginacao } from "../lib/http.js";

const D = Prisma.Decimal;

const FORMAS = [
  "DINHEIRO",
  "PIX",
  "CARTAO_DEBITO",
  "CARTAO_CREDITO",
  "FIADO",
  "TRANSFERENCIA",
  "OUTRO",
] as const;

const itemVenda = z.object({
  produtoId: z.string().min(1),
  quantidade: z.coerce.number().positive("A quantidade deve ser maior que zero"),
  precoUnitario: z.coerce.number().min(0).optional(),
  desconto: z.coerce.number().min(0).default(0),
});

const pagamentoVenda = z.object({
  forma: z.enum(FORMAS),
  valor: z.coerce.number().min(0),
});

const corpoVenda = z.object({
  clienteId: z.string().nullish(),
  desconto: z.coerce.number().min(0).default(0),
  observacoes: textoOpcional,
  idLocal: z.string().nullish(), // id gerado no PDV offline (evita duplicar na sincronização)
  itens: z.array(itemVenda).min(1, "Adicione ao menos um item à venda"),
  pagamentos: z.array(pagamentoVenda).min(1, "Informe a forma de pagamento"),
});

const idParam = z.object({ id: z.string() });

const vendaCompleta = {
  cliente: { select: { id: true, nome: true } },
  itens: { include: { produto: { select: { id: true, descricao: true, unidade: true } } } },
  pagamentos: true,
} satisfies Prisma.VendaInclude;

export async function rotasVendas(app: FastifyInstance) {
  // ── Registrar uma venda ─────────────────────────────────────────────
  app.post("/vendas", async (req, reply) => {
    const corpo = corpoVenda.parse(req.body);

    // Idempotência: se veio de um PDV offline e já foi sincronizada, devolve a existente.
    if (corpo.idLocal) {
      const existente = await prisma.venda.findUnique({
        where: { idLocal: corpo.idLocal },
        include: vendaCompleta,
      });
      if (existente) return reply.code(200).send(existente);
    }

    const venda = await prisma.$transaction(async (tx) => {
      // Carrega os produtos da venda
      const ids = corpo.itens.map((i) => i.produtoId);
      const produtos = await tx.produto.findMany({ where: { id: { in: ids } } });
      const mapa = new Map(produtos.map((p) => [p.id, p]));

      // Monta as linhas e calcula o subtotal
      let subtotal = new D(0);
      const linhas = corpo.itens.map((item) => {
        const produto = mapa.get(item.produtoId);
        if (!produto) throw app.httpErrors.badRequest("Produto não encontrado na venda.");

        const qtd = new D(item.quantidade);
        const preco = item.precoUnitario != null ? new D(item.precoUnitario) : produto.precoVenda;
        const desc = new D(item.desconto);
        const total = qtd.mul(preco).minus(desc);
        if (total.lt(0)) {
          throw app.httpErrors.badRequest(`Desconto maior que o valor do item "${produto.descricao}".`);
        }
        return { produto, qtd, preco, desc, total };
      });
      subtotal = linhas.reduce((acc, l) => acc.plus(l.total), new D(0));

      const descontoVenda = new D(corpo.desconto);
      const total = subtotal.minus(descontoVenda);
      if (total.lt(0)) throw app.httpErrors.badRequest("O desconto é maior que o total da venda.");

      // Confere se os pagamentos batem com o total
      const somaPag = corpo.pagamentos.reduce((acc, p) => acc.plus(new D(p.valor)), new D(0));
      if (somaPag.minus(total).abs().greaterThan(new D("0.01"))) {
        throw app.httpErrors.badRequest(
          `A soma dos pagamentos (${somaPag.toFixed(2)}) não bate com o total da venda (${total.toFixed(2)}).`
        );
      }

      // Fiado: exige cliente e respeita o limite de crédito
      const fiado = corpo.pagamentos
        .filter((p) => p.forma === "FIADO")
        .reduce((acc, p) => acc.plus(new D(p.valor)), new D(0));

      let cliente = null;
      if (fiado.greaterThan(0)) {
        if (!corpo.clienteId) {
          throw app.httpErrors.badRequest("Venda no fiado exige um cliente selecionado.");
        }
        cliente = await tx.cliente.findUniqueOrThrow({ where: { id: corpo.clienteId } });
        const novoSaldo = cliente.saldoConta.plus(fiado);
        // limiteCredito 0 = sem limite definido; > 0 = limite a respeitar
        if (cliente.limiteCredito.greaterThan(0) && novoSaldo.greaterThan(cliente.limiteCredito)) {
          throw app.httpErrors.badRequest(
            `Limite de crédito excedido. Disponível: ${cliente.limiteCredito.minus(cliente.saldoConta).toFixed(2)}.`
          );
        }
      }

      // Cria a venda com itens e pagamentos
      const criada = await tx.venda.create({
        data: {
          clienteId: corpo.clienteId ?? null,
          subtotal,
          desconto: descontoVenda,
          total,
          status: "FINALIZADA",
          observacoes: corpo.observacoes ?? null,
          idLocal: corpo.idLocal ?? null,
          itens: {
            create: linhas.map((l) => ({
              produtoId: l.produto.id,
              descricao: l.produto.descricao,
              quantidade: l.qtd,
              precoUnitario: l.preco,
              desconto: l.desc,
              total: l.total,
            })),
          },
          pagamentos: {
            create: corpo.pagamentos.map((p) => ({
              forma: p.forma,
              valor: new D(p.valor),
              clienteId: corpo.clienteId ?? null,
            })),
          },
        },
      });

      // Dá baixa no estoque de cada item
      for (const l of linhas) {
        const novoSaldo = l.produto.saldoEstoque.minus(l.qtd);
        await tx.produto.update({
          where: { id: l.produto.id },
          data: { saldoEstoque: novoSaldo },
        });
        await tx.estoqueMovimento.create({
          data: {
            produtoId: l.produto.id,
            tipo: "SAIDA",
            origem: "VENDA",
            quantidade: l.qtd,
            saldoApos: novoSaldo,
            referenciaId: criada.id,
            observacao: `Venda nº ${criada.numero}`,
          },
        });
      }

      // Lança o fiado na conta do cliente
      if (cliente && fiado.greaterThan(0)) {
        const novoSaldo = cliente.saldoConta.plus(fiado);
        await tx.cliente.update({ where: { id: cliente.id }, data: { saldoConta: novoSaldo } });
        await tx.lancamentoConta.create({
          data: {
            clienteId: cliente.id,
            tipo: "DEBITO",
            valor: fiado,
            saldoApos: novoSaldo,
            vendaId: criada.id,
            descricao: `Compra no fiado — venda nº ${criada.numero}`,
          },
        });
      }

      return criada;
    });

    const completa = await prisma.venda.findUniqueOrThrow({
      where: { id: venda.id },
      include: vendaCompleta,
    });
    return reply.code(201).send(completa);
  });

  // ── Listar vendas ───────────────────────────────────────────────────
  app.get("/vendas", async (req) => {
    const { pagina, porPagina, busca } = paginacaoQuery.parse(req.query);

    const where: Prisma.VendaWhereInput = busca
      ? {
          OR: [
            { cliente: { nome: { contains: busca, mode: "insensitive" } } },
            ...(Number.isFinite(Number(busca)) ? [{ numero: Number(busca) }] : []),
          ],
        }
      : {};

    const [dados, total] = await Promise.all([
      prisma.venda.findMany({
        where,
        orderBy: { dataVenda: "desc" },
        skip: (pagina - 1) * porPagina,
        take: porPagina,
        include: {
          cliente: { select: { nome: true } },
          pagamentos: { select: { forma: true } },
          _count: { select: { itens: true } },
        },
      }),
      prisma.venda.count({ where }),
    ]);

    return { dados, paginacao: montarPaginacao(pagina, porPagina, total) };
  });

  // ── Detalhe de uma venda ────────────────────────────────────────────
  app.get("/vendas/:id", async (req) => {
    const { id } = idParam.parse(req.params);
    return prisma.venda.findUniqueOrThrow({ where: { id }, include: vendaCompleta });
  });

  // ── Cancelar uma venda (estorna estoque e fiado) ────────────────────
  app.post("/vendas/:id/cancelar", async (req) => {
    const { id } = idParam.parse(req.params);
    const venda = await prisma.venda.findUniqueOrThrow({
      where: { id },
      include: { itens: true, pagamentos: true },
    });
    if (venda.status === "CANCELADA") throw app.httpErrors.badRequest("Esta venda já está cancelada.");

    await prisma.$transaction(async (tx) => {
      // Devolve os itens ao estoque
      for (const item of venda.itens) {
        const produto = await tx.produto.findUniqueOrThrow({ where: { id: item.produtoId } });
        const novoSaldo = produto.saldoEstoque.plus(item.quantidade);
        await tx.produto.update({ where: { id: produto.id }, data: { saldoEstoque: novoSaldo } });
        await tx.estoqueMovimento.create({
          data: {
            produtoId: produto.id,
            tipo: "ENTRADA",
            origem: "DEVOLUCAO",
            quantidade: item.quantidade,
            saldoApos: novoSaldo,
            referenciaId: venda.id,
            observacao: `Cancelamento da venda nº ${venda.numero}`,
          },
        });
      }

      // Estorna o fiado, se houver
      const fiado = venda.pagamentos
        .filter((p) => p.forma === "FIADO")
        .reduce((acc, p) => acc.plus(p.valor), new D(0));
      if (fiado.greaterThan(0) && venda.clienteId) {
        const cliente = await tx.cliente.findUniqueOrThrow({ where: { id: venda.clienteId } });
        const novoSaldo = cliente.saldoConta.minus(fiado);
        await tx.cliente.update({ where: { id: cliente.id }, data: { saldoConta: novoSaldo } });
        await tx.lancamentoConta.create({
          data: {
            clienteId: cliente.id,
            tipo: "CREDITO",
            valor: fiado,
            saldoApos: novoSaldo,
            vendaId: venda.id,
            descricao: `Estorno — cancelamento da venda nº ${venda.numero}`,
          },
        });
      }

      await tx.venda.update({ where: { id: venda.id }, data: { status: "CANCELADA" } });
    });

    return prisma.venda.findUniqueOrThrow({ where: { id }, include: vendaCompleta });
  });
}
