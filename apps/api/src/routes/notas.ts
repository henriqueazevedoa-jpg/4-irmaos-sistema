import type { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { paginacaoQuery, montarPaginacao } from "../lib/http.js";
import { lerNotaXml, XmlNotaInvalido } from "../lib/nfe.js";

const idParam = z.object({ id: z.string() });
const itemParams = z.object({ id: z.string(), itemId: z.string() });

// Dados do produto incluídos junto de cada item da nota
const produtoResumo = {
  select: { id: true, descricao: true, unidade: true, saldoEstoque: true },
} satisfies Prisma.ProdutoDefaultArgs;

export async function rotasNotas(app: FastifyInstance) {
  // ── Importar uma nota a partir do XML ───────────────────────────────
  app.post("/notas-entrada/importar-xml", async (req, reply) => {
    const { xml } = z.object({ xml: z.string().min(1, "Envie o conteúdo do XML") }).parse(req.body);

    let nota;
    try {
      nota = lerNotaXml(xml);
    } catch (e) {
      if (e instanceof XmlNotaInvalido) throw app.httpErrors.badRequest(e.message);
      throw e;
    }

    // Evita importar a mesma nota duas vezes
    if (nota.chaveAcesso) {
      const jaExiste = await prisma.notaEntrada.findUnique({
        where: { chaveAcesso: nota.chaveAcesso },
      });
      if (jaExiste) {
        throw app.httpErrors.conflict("Esta nota fiscal já foi importada anteriormente.");
      }
    }

    // Localiza (ou cria) o fornecedor pelo CNPJ/CPF do emitente
    let fornecedorId: string | null = null;
    const doc = nota.emitente.cnpj ?? nota.emitente.cpf;
    if (doc) {
      const existente = await prisma.fornecedor.findUnique({ where: { cpfCnpj: doc } });
      if (existente) {
        fornecedorId = existente.id;
      } else {
        const novo = await prisma.fornecedor.create({
          data: {
            tipoPessoa: nota.emitente.cnpj ? "PJ" : "PF",
            cpfCnpj: doc,
            razaoSocial: nota.emitente.nome ?? "Fornecedor (importado da nota)",
            nomeFantasia: nota.emitente.nomeFantasia,
            inscricaoEstadual: nota.emitente.inscricaoEstadual,
            cep: nota.emitente.cep,
            logradouro: nota.emitente.logradouro,
            numero: nota.emitente.numero,
            bairro: nota.emitente.bairro,
            cidade: nota.emitente.cidade,
            uf: nota.emitente.uf,
          },
        });
        fornecedorId = novo.id;
      }
    }

    // Tenta casar cada item com um produto já cadastrado (pelo código de barras)
    const itensData = await Promise.all(
      nota.itens.map(async (it) => {
        let produtoId: string | null = null;
        if (it.codigoBarras) {
          const p = await prisma.produto.findUnique({
            where: { codigoBarras: it.codigoBarras },
            select: { id: true },
          });
          produtoId = p?.id ?? null;
        }
        return {
          produtoId,
          codigoFornecedor: it.codigoFornecedor,
          codigoBarras: it.codigoBarras,
          descricaoNota: it.descricao,
          ncm: it.ncm,
          cfop: it.cfop,
          unidade: it.unidade,
          quantidade: it.quantidade,
          valorUnitario: it.valorUnitario,
          valorTotal: it.valorTotal,
        };
      })
    );

    const criada = await prisma.notaEntrada.create({
      data: {
        fornecedorId,
        fonte: "XML",
        chaveAcesso: nota.chaveAcesso,
        numero: nota.numero,
        serie: nota.serie,
        modelo: nota.modelo,
        dataEmissao: nota.dataEmissao,
        valorProdutos: nota.valorProdutos,
        valorTotal: nota.valorTotal,
        xmlConteudo: xml,
        status: "IMPORTADA",
        itens: { create: itensData },
      },
      include: {
        fornecedor: true,
        itens: { include: { produto: produtoResumo } },
      },
    });

    return reply.code(201).send(criada);
  });

  // ── Listar notas de entrada ─────────────────────────────────────────
  app.get("/notas-entrada", async (req) => {
    const { pagina, porPagina, busca } = paginacaoQuery.parse(req.query);

    const where: Prisma.NotaEntradaWhereInput = busca
      ? {
          OR: [
            { numero: { contains: busca } },
            { chaveAcesso: { contains: busca } },
            { fornecedor: { razaoSocial: { contains: busca, mode: "insensitive" } } },
          ],
        }
      : {};

    const [dados, total] = await Promise.all([
      prisma.notaEntrada.findMany({
        where,
        orderBy: { criadoEm: "desc" },
        skip: (pagina - 1) * porPagina,
        take: porPagina,
        include: {
          fornecedor: { select: { razaoSocial: true, nomeFantasia: true } },
          _count: { select: { itens: true } },
        },
      }),
      prisma.notaEntrada.count({ where }),
    ]);

    return { dados, paginacao: montarPaginacao(pagina, porPagina, total) };
  });

  // ── Detalhe de uma nota (com itens) ─────────────────────────────────
  app.get("/notas-entrada/:id", async (req) => {
    const { id } = idParam.parse(req.params);
    return prisma.notaEntrada.findUniqueOrThrow({
      where: { id },
      include: {
        fornecedor: true,
        itens: { include: { produto: produtoResumo }, orderBy: { criadoEm: "asc" } },
      },
    });
  });

  // ── Vincular um item a um produto existente (ou desvincular) ─────────
  app.put("/notas-entrada/:id/itens/:itemId", async (req) => {
    const { itemId } = itemParams.parse(req.params);
    const { produtoId } = z
      .object({ produtoId: z.string().nullable() })
      .parse(req.body);

    await prisma.notaEntradaItem.update({
      where: { id: itemId },
      data: { produtoId },
    });

    return prisma.notaEntradaItem.findUniqueOrThrow({
      where: { id: itemId },
      include: { produto: produtoResumo },
    });
  });

  // ── Criar um produto novo a partir de um item da nota ───────────────
  app.post("/notas-entrada/:id/itens/:itemId/criar-produto", async (req, reply) => {
    const { itemId } = itemParams.parse(req.params);
    const item = await prisma.notaEntradaItem.findUniqueOrThrow({
      where: { id: itemId },
      include: { nota: { select: { fornecedorId: true } } },
    });

    const produto = await prisma.$transaction(async (tx) => {
      const novo = await tx.produto.create({
        data: {
          descricao: item.descricaoNota,
          unidade: item.unidade ?? "UN",
          ncm: item.ncm,
          codigoBarras: item.codigoBarras,
          precoCusto: item.valorUnitario,
          precoVenda: item.valorUnitario, // sugestão inicial; ajuste depois
          fornecedorPadraoId: item.nota.fornecedorId,
        },
      });
      await tx.notaEntradaItem.update({ where: { id: itemId }, data: { produtoId: novo.id } });
      return novo;
    });

    return reply.code(201).send(produto);
  });

  // ── Processar: dá entrada no estoque de todos os itens ──────────────
  app.post("/notas-entrada/:id/processar", async (req) => {
    const { id } = idParam.parse(req.params);
    const nota = await prisma.notaEntrada.findUniqueOrThrow({
      where: { id },
      include: { itens: true },
    });

    if (nota.status === "PROCESSADA") throw app.httpErrors.badRequest("Esta nota já foi processada.");
    if (nota.status === "CANCELADA") throw app.httpErrors.badRequest("Esta nota está cancelada.");

    const semProduto = nota.itens.filter((i) => !i.produtoId);
    if (semProduto.length > 0) {
      throw app.httpErrors.badRequest(
        `Há ${semProduto.length} item(ns) sem produto vinculado. Vincule ou cadastre todos antes de dar entrada.`
      );
    }

    await prisma.$transaction(async (tx) => {
      for (const item of nota.itens) {
        const produto = await tx.produto.findUniqueOrThrow({ where: { id: item.produtoId! } });
        const novoSaldo = produto.saldoEstoque.plus(item.quantidade);

        await tx.produto.update({
          where: { id: produto.id },
          data: { saldoEstoque: novoSaldo, precoCusto: item.valorUnitario },
        });

        await tx.estoqueMovimento.create({
          data: {
            produtoId: produto.id,
            tipo: "ENTRADA",
            origem: "NOTA_ENTRADA",
            quantidade: item.quantidade,
            custoUnitario: item.valorUnitario,
            saldoApos: novoSaldo,
            referenciaId: nota.id,
            observacao: `Entrada da nota fiscal ${nota.numero ?? ""}`.trim(),
          },
        });
      }

      await tx.notaEntrada.update({
        where: { id: nota.id },
        data: { status: "PROCESSADA", dataEntrada: new Date() },
      });
    });

    return prisma.notaEntrada.findUniqueOrThrow({
      where: { id },
      include: { fornecedor: true, itens: { include: { produto: produtoResumo } } },
    });
  });

  // ── Excluir uma nota (apenas se ainda não deu entrada no estoque) ────
  app.delete("/notas-entrada/:id", async (req, reply) => {
    const { id } = idParam.parse(req.params);
    const nota = await prisma.notaEntrada.findUniqueOrThrow({ where: { id } });
    if (nota.status === "PROCESSADA") {
      throw app.httpErrors.badRequest(
        "Não é possível excluir uma nota já processada (o estoque já foi atualizado)."
      );
    }
    await prisma.notaEntrada.delete({ where: { id } });
    return reply.code(204).send();
  });
}
