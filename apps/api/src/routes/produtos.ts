import type { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { textoObrigatorio, textoOpcional, numeroNaoNegativo } from "../lib/campos.js";
import { paginacaoQuery, montarPaginacao } from "../lib/http.js";

const corpoProduto = z.object({
  descricao: textoObrigatorio("Informe a descrição do produto"),
  sku: textoOpcional,
  codigoBarras: textoOpcional,
  unidade: z.string().trim().min(1).default("UN"),
  ncm: textoOpcional,
  cest: textoOpcional,
  categoriaId: textoOpcional,
  fornecedorPadraoId: textoOpcional,
  precoCusto: numeroNaoNegativo.default(0),
  precoVenda: numeroNaoNegativo.default(0),
  estoqueMinimo: numeroNaoNegativo.default(0),
  ativo: z.boolean().optional(),
});

// Na criação, aceita um estoque inicial (opcional). Depois, o saldo muda só por movimentos.
const corpoCriarProduto = corpoProduto.extend({
  saldoEstoque: numeroNaoNegativo.default(0),
});

const idParam = z.object({ id: z.string() });

const incluirRelacoes = {
  categoria: { select: { id: true, nome: true } },
  fornecedorPadrao: { select: { id: true, razaoSocial: true, nomeFantasia: true } },
} satisfies Prisma.ProdutoInclude;

export async function rotasProdutos(app: FastifyInstance) {
  app.get("/produtos", async (req) => {
    const { pagina, porPagina, busca, incluirInativos } = paginacaoQuery.parse(req.query);
    const soBaixoEstoque = z
      .object({ estoqueBaixo: z.union([z.literal("true"), z.literal("false")]).optional() })
      .parse(req.query).estoqueBaixo === "true";

    const where: Prisma.ProdutoWhereInput = {
      ...(incluirInativos ? {} : { ativo: true }),
      ...(busca
        ? {
            OR: [
              { descricao: { contains: busca, mode: "insensitive" } },
              { sku: { contains: busca, mode: "insensitive" } },
              { codigoBarras: { contains: busca } },
            ],
          }
        : {}),
    };

    let [dados, total] = await Promise.all([
      prisma.produto.findMany({
        where,
        orderBy: { descricao: "asc" },
        skip: (pagina - 1) * porPagina,
        take: porPagina,
        include: incluirRelacoes,
      }),
      prisma.produto.count({ where }),
    ]);

    // Filtro de "estoque abaixo do mínimo" (comparação entre duas colunas)
    if (soBaixoEstoque) {
      dados = dados.filter((p) => Number(p.saldoEstoque) <= Number(p.estoqueMinimo));
    }

    return { dados, paginacao: montarPaginacao(pagina, porPagina, total) };
  });

  // Reposição: produtos ativos com estoque no mínimo ou abaixo, já com a
  // quantidade sugerida de compra e o fornecedor padrão (para montar o pedido).
  app.get("/produtos/reposicao", async () => {
    const produtos = await prisma.produto.findMany({
      where: { ativo: true, estoqueMinimo: { gt: 0 } },
      include: { fornecedorPadrao: { select: { id: true, razaoSocial: true, nomeFantasia: true } } },
      orderBy: { descricao: "asc" },
    });

    const itens = produtos
      .filter((p) => Number(p.saldoEstoque) <= Number(p.estoqueMinimo))
      .map((p) => {
        const saldo = Number(p.saldoEstoque);
        const minimo = Number(p.estoqueMinimo);
        // Sugestão: repor até o dobro do mínimo (um nível de trabalho confortável).
        const sugestao = Math.max(1, Math.ceil(minimo * 2 - saldo));
        return {
          id: p.id,
          descricao: p.descricao,
          sku: p.sku,
          unidade: p.unidade,
          saldoEstoque: p.saldoEstoque,
          estoqueMinimo: p.estoqueMinimo,
          precoCusto: p.precoCusto,
          zerado: saldo <= 0,
          quantidadeSugerida: sugestao,
          fornecedor: p.fornecedorPadrao
            ? {
                id: p.fornecedorPadrao.id,
                nome: p.fornecedorPadrao.nomeFantasia || p.fornecedorPadrao.razaoSocial,
              }
            : null,
        };
      });

    const resumo = {
      total: itens.length,
      zerados: itens.filter((i) => i.zerado).length,
      baixos: itens.filter((i) => !i.zerado).length,
      custoEstimado: itens.reduce((s, i) => s + i.quantidadeSugerida * Number(i.precoCusto), 0),
    };

    return { itens, resumo };
  });

  // Painel de gestão: cada produto ativo com curva ABC, vendas no período,
  // cobertura (dias de estoque), saldo/mínimo e sugestão de compra.
  app.get("/produtos/painel", async (req) => {
    const { dias } = z
      .object({ dias: z.coerce.number().int().positive().max(730).default(90) })
      .parse(req.query);
    const desde = new Date(Date.now() - dias * 86_400_000);

    const [produtos, vendas, ultimas] = await Promise.all([
      prisma.produto.findMany({
        where: { ativo: true },
        include: {
          categoria: { select: { nome: true } },
          fornecedorPadrao: { select: { id: true, razaoSocial: true, nomeFantasia: true } },
        },
        orderBy: { descricao: "asc" },
      }),
      // Vendas por produto no período (só vendas finalizadas)
      prisma.vendaItem.groupBy({
        by: ["produtoId"],
        where: { venda: { status: "FINALIZADA", dataVenda: { gte: desde } } },
        _sum: { quantidade: true, total: true },
      }),
      // Data da última venda de cada produto (do livro de estoque)
      prisma.estoqueMovimento.groupBy({
        by: ["produtoId"],
        where: { origem: "VENDA" },
        _max: { criadoEm: true },
      }),
    ]);

    const mapaVendas = new Map(
      vendas.map((v) => [
        v.produtoId,
        { qtd: Number(v._sum.quantidade ?? 0), valor: Number(v._sum.total ?? 0) },
      ])
    );
    const mapaUltima = new Map(ultimas.map((u) => [u.produtoId, u._max.criadoEm]));

    const base = produtos.map((p) => {
      const v = mapaVendas.get(p.id) ?? { qtd: 0, valor: 0 };
      const saldo = Number(p.saldoEstoque);
      const minimo = Number(p.estoqueMinimo);
      const consumoDia = v.qtd / dias;
      const diasCobertura = consumoDia > 0 ? Math.round(saldo / consumoDia) : null;
      const sugestaoCompra =
        minimo > 0 && saldo <= minimo ? Math.max(1, Math.ceil(minimo * 2 - saldo)) : 0;
      return { p, v, saldo, minimo, diasCobertura, sugestaoCompra };
    });

    // Curva ABC pelo faturamento do período (Pareto). Sem venda = classe própria.
    const comVenda = base.filter((b) => b.v.valor > 0).sort((a, b) => b.v.valor - a.v.valor);
    const totalValor = comVenda.reduce((s, b) => s + b.v.valor, 0);
    const classe = new Map<string, string>();
    let acumulado = 0;
    for (const b of comVenda) {
      acumulado += b.v.valor;
      const perc = totalValor > 0 ? acumulado / totalValor : 1;
      classe.set(b.p.id, perc <= 0.8 ? "A" : perc <= 0.95 ? "B" : "C");
    }

    const itens = base.map((b) => ({
      id: b.p.id,
      descricao: b.p.descricao,
      sku: b.p.sku,
      unidade: b.p.unidade,
      categoria: b.p.categoria?.nome ?? null,
      fornecedor: b.p.fornecedorPadrao
        ? {
            id: b.p.fornecedorPadrao.id,
            nome: b.p.fornecedorPadrao.nomeFantasia || b.p.fornecedorPadrao.razaoSocial,
          }
        : null,
      saldoEstoque: b.p.saldoEstoque,
      estoqueMinimo: b.p.estoqueMinimo,
      precoCusto: b.p.precoCusto,
      precoVenda: b.p.precoVenda,
      vendaQtd: b.v.qtd,
      vendaValor: b.v.valor,
      ultimaVenda: mapaUltima.get(b.p.id) ?? null,
      diasCobertura: b.diasCobertura,
      classeAbc: classe.get(b.p.id) ?? "SEM_VENDA",
      sugestaoCompra: b.sugestaoCompra,
    }));

    return { itens, dias };
  });

  // Lista enxuta de produtos ativos, para campos de seleção e para o PDV.
  app.get("/produtos/opcoes", async () => {
    const dados = await prisma.produto.findMany({
      where: { ativo: true },
      select: {
        id: true,
        descricao: true,
        sku: true,
        unidade: true,
        precoVenda: true,
        saldoEstoque: true,
      },
      orderBy: { descricao: "asc" },
    });
    return { dados };
  });

  // Busca um produto ativo pelo código de barras (usado pela leitura no PDV).
  app.get("/produtos/por-codigo-barras/:codigo", async (req) => {
    const { codigo } = z.object({ codigo: z.string().min(1) }).parse(req.params);
    const produto = await prisma.produto.findFirst({
      where: { codigoBarras: codigo, ativo: true },
      select: {
        id: true,
        descricao: true,
        sku: true,
        unidade: true,
        precoVenda: true,
        saldoEstoque: true,
      },
    });
    if (!produto) {
      throw app.httpErrors.notFound(`Nenhum produto com o código de barras ${codigo}.`);
    }
    return produto;
  });

  app.get("/produtos/:id", async (req) => {
    const { id } = idParam.parse(req.params);
    return prisma.produto.findUniqueOrThrow({ where: { id }, include: incluirRelacoes });
  });

  app.post("/produtos", async (req, reply) => {
    const { saldoEstoque, ...dados } = corpoCriarProduto.parse(req.body);

    const produto = await prisma.$transaction(async (tx) => {
      const criado = await tx.produto.create({
        data: { ...dados, saldoEstoque },
        include: incluirRelacoes,
      });

      // Estoque inicial vira um movimento de inventário, para manter o histórico.
      if (saldoEstoque > 0) {
        await tx.estoqueMovimento.create({
          data: {
            produtoId: criado.id,
            tipo: "ENTRADA",
            origem: "INVENTARIO",
            quantidade: saldoEstoque,
            custoUnitario: dados.precoCusto || null,
            saldoApos: saldoEstoque,
            observacao: "Estoque inicial do cadastro",
          },
        });
      }
      return criado;
    });

    return reply.code(201).send(produto);
  });

  app.put("/produtos/:id", async (req) => {
    const { id } = idParam.parse(req.params);
    // saldoEstoque não é alterado aqui: muda apenas por entrada de nota, venda ou ajuste.
    const dados = corpoProduto.parse(req.body);
    return prisma.produto.update({ where: { id }, data: dados, include: incluirRelacoes });
  });

  app.delete("/produtos/:id", async (req, reply) => {
    const { id } = idParam.parse(req.params);
    await prisma.produto.update({ where: { id }, data: { ativo: false } });
    return reply.code(204).send();
  });
}
