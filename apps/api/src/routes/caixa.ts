import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { textoOpcional, numeroNaoNegativo } from "../lib/campos.js";
import { paginacaoQuery, montarPaginacao } from "../lib/http.js";
import { resumoCaixa } from "../lib/caixa.js";

const idParam = z.object({ id: z.string() });

export async function rotasCaixa(app: FastifyInstance) {
  // ── Caixa aberto no momento (com resumo) — ou null ──────────────────
  app.get("/caixa/atual", async () => {
    const caixa = await prisma.caixa.findFirst({
      where: { status: "ABERTO" },
      include: { movimentos: { orderBy: { data: "desc" } } },
    });
    if (!caixa) return { caixa: null, resumo: null };
    return { caixa, resumo: await resumoCaixa(caixa.id) };
  });

  // ── Abrir caixa ─────────────────────────────────────────────────────
  app.post("/caixa/abrir", async (req, reply) => {
    const corpo = z
      .object({ valorAbertura: numeroNaoNegativo.default(0), observacao: textoOpcional })
      .parse(req.body);

    const jaAberto = await prisma.caixa.findFirst({ where: { status: "ABERTO" } });
    if (jaAberto) {
      throw app.httpErrors.badRequest("Já existe um caixa aberto. Feche-o antes de abrir outro.");
    }

    const caixa = await prisma.caixa.create({
      data: { valorAbertura: corpo.valorAbertura, observacaoAbertura: corpo.observacao ?? null },
    });
    return reply.code(201).send(caixa);
  });

  // ── Sangria (retirada) ou Suprimento (entrada de dinheiro) ──────────
  app.post("/caixa/:id/movimentos", async (req, reply) => {
    const { id } = idParam.parse(req.params);
    const corpo = z
      .object({
        tipo: z.enum(["SANGRIA", "SUPRIMENTO"]),
        valor: numeroNaoNegativo,
        descricao: textoOpcional,
      })
      .parse(req.body);

    const caixa = await prisma.caixa.findUniqueOrThrow({ where: { id } });
    if (caixa.status !== "ABERTO") throw app.httpErrors.badRequest("O caixa está fechado.");
    if (corpo.valor <= 0) throw app.httpErrors.badRequest("Informe um valor maior que zero.");

    const mov = await prisma.movimentoCaixa.create({
      data: { caixaId: id, tipo: corpo.tipo, valor: corpo.valor, descricao: corpo.descricao ?? null },
    });
    return reply.code(201).send(mov);
  });

  // ── Fechar caixa (conferência com o dinheiro contado) ───────────────
  app.post("/caixa/:id/fechar", async (req) => {
    const { id } = idParam.parse(req.params);
    const corpo = z
      .object({ valorContado: numeroNaoNegativo, observacao: textoOpcional })
      .parse(req.body);

    const caixa = await prisma.caixa.findUniqueOrThrow({ where: { id } });
    if (caixa.status !== "ABERTO") throw app.httpErrors.badRequest("Este caixa já está fechado.");

    await prisma.caixa.update({
      where: { id },
      data: {
        status: "FECHADO",
        valorFechamentoContado: corpo.valorContado,
        observacaoFechamento: corpo.observacao ?? null,
        fechadoEm: new Date(),
      },
    });

    const caixaFechado = await prisma.caixa.findUniqueOrThrow({
      where: { id },
      include: { movimentos: { orderBy: { data: "desc" } } },
    });
    return { caixa: caixaFechado, resumo: await resumoCaixa(id) };
  });

  // ── Histórico de caixas ─────────────────────────────────────────────
  app.get("/caixa", async (req) => {
    const { pagina, porPagina } = paginacaoQuery.parse(req.query);
    const [dados, total] = await Promise.all([
      prisma.caixa.findMany({
        orderBy: { abertoEm: "desc" },
        skip: (pagina - 1) * porPagina,
        take: porPagina,
      }),
      prisma.caixa.count(),
    ]);
    return { dados, paginacao: montarPaginacao(pagina, porPagina, total) };
  });

  // ── Detalhe de um caixa (com resumo) ────────────────────────────────
  app.get("/caixa/:id", async (req) => {
    const { id } = idParam.parse(req.params);
    const caixa = await prisma.caixa.findUniqueOrThrow({
      where: { id },
      include: { movimentos: { orderBy: { data: "desc" } } },
    });
    return { caixa, resumo: await resumoCaixa(id) };
  });
}
