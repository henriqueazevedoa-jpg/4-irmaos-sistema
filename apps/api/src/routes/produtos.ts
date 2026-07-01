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
