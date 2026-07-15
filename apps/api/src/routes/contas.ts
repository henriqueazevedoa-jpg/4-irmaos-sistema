import type { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { textoOpcional } from "../lib/campos.js";
import { abaterFiadoNasVendas, aplicarHaverNoFiado } from "../lib/fiado.js";
import { caixaAbertoId } from "../lib/caixa.js";

const D = Prisma.Decimal;

const idParam = z.object({ id: z.string() });

const FORMAS_PAGAMENTO = ["DINHEIRO", "PIX", "CARTAO_DEBITO", "CARTAO_CREDITO", "TRANSFERENCIA", "OUTRO"] as const;

const corpoPagamento = z.object({
  valor: z.coerce.number().positive("O valor deve ser maior que zero"),
  forma: z.enum(FORMAS_PAGAMENTO).default("DINHEIRO"),
  observacao: textoOpcional,
});

export async function rotasContas(app: FastifyInstance) {
  // Colunas dos itens da venda mostradas na conta
  const selectVendaFiado = {
    id: true,
    numero: true,
    dataVenda: true,
    total: true,
    valorFiado: true,
    valorFiadoAberto: true,
    itens: {
      select: {
        descricao: true,
        quantidade: true,
        quantidadeDevolvida: true,
        precoUnitario: true,
        total: true,
      },
    },
  } as const;

  // ── Conta do cliente (CICLO ATUAL): só o que está em aberto desde a última quitação ──
  app.get("/clientes/:id/conta", async (req) => {
    const { id } = idParam.parse(req.params);

    const cliente = await prisma.cliente.findUniqueOrThrow({
      where: { id },
      select: { id: true, nome: true, saldoConta: true, saldoHaver: true, limiteCredito: true },
    });

    // "Última quitação" = o lançamento mais recente em que o saldo chegou a ZERO.
    // O ciclo atual é tudo que veio depois disso.
    const quitacao = await prisma.lancamentoConta.findFirst({
      where: { clienteId: id, saldoApos: 0 },
      orderBy: { data: "desc" },
      select: { data: true },
    });
    const inicioCiclo = quitacao?.data ?? null;

    const filtroCiclo = inicioCiclo ? { dataVenda: { gt: inicioCiclo } } : {};

    const [vendasFiado, comprasCiclo, lancamentos] = await Promise.all([
      // Compras ainda em aberto (para a tela "Compras em aberto")
      prisma.venda.findMany({
        where: { clienteId: id, valorFiadoAberto: { gt: 0 }, status: "FINALIZADA" },
        orderBy: { dataVenda: "desc" },
        select: selectVendaFiado,
      }),
      // TODAS as compras do ciclo atual (para o demonstrativo: o que comprou)
      prisma.venda.findMany({
        where: { clienteId: id, valorFiado: { gt: 0 }, status: "FINALIZADA", ...filtroCiclo },
        orderBy: { dataVenda: "asc" },
        select: selectVendaFiado,
      }),
      // Extrato só do ciclo atual (após a última quitação)
      prisma.lancamentoConta.findMany({
        where: { clienteId: id, ...(inicioCiclo ? { data: { gt: inicioCiclo } } : {}) },
        orderBy: { data: "desc" },
        take: 200,
      }),
    ]);

    return { cliente, vendasFiado, comprasCiclo, lancamentos, inicioCiclo };
  });

  // ── Histórico COMPLETO da conta (todas as compras e movimentações) ──
  app.get("/clientes/:id/conta/historico", async (req) => {
    const { id } = idParam.parse(req.params);
    const [vendasFiado, lancamentos] = await Promise.all([
      prisma.venda.findMany({
        where: { clienteId: id, valorFiado: { gt: 0 }, status: "FINALIZADA" },
        orderBy: { dataVenda: "desc" },
        select: selectVendaFiado,
      }),
      prisma.lancamentoConta.findMany({
        where: { clienteId: id },
        orderBy: { data: "desc" },
        take: 500,
      }),
    ]);
    return { vendasFiado, lancamentos };
  });

  // ── Registrar um pagamento do cliente (abate as compras mais antigas) ─
  app.post("/clientes/:id/pagamentos", async (req, reply) => {
    const { id } = idParam.parse(req.params);
    const corpo = corpoPagamento.parse(req.body);
    const valor = new D(corpo.valor);

    const resultado = await prisma.$transaction(async (tx) => {
      const cliente = await tx.cliente.findUniqueOrThrow({ where: { id } });

      if (valor.greaterThan(cliente.saldoConta)) {
        throw app.httpErrors.badRequest(
          `O valor é maior que o saldo devedor (${cliente.saldoConta.toFixed(2)}).`
        );
      }

      // Abate nas vendas em aberto (mais antigas primeiro)
      await abaterFiadoNasVendas(tx, id, valor);
      const novoSaldo = cliente.saldoConta.minus(valor);

      await tx.pagamento.create({
        data: {
          clienteId: id,
          forma: corpo.forma,
          valor,
          observacao: corpo.observacao ?? null,
          caixaId: await caixaAbertoId(tx),
        },
      });
      const lancamento = await tx.lancamentoConta.create({
        data: {
          clienteId: id,
          tipo: "CREDITO",
          valor,
          saldoApos: novoSaldo,
          descricao: corpo.observacao ?? "Pagamento recebido",
        },
      });
      await tx.cliente.update({ where: { id }, data: { saldoConta: novoSaldo } });

      // Se o cliente tinha crédito (haver) e ainda deve, abate o restante com o crédito.
      await aplicarHaverNoFiado(tx, id);

      return { novoSaldo, lancamento };
    });

    return reply.code(201).send(resultado);
  });

  // ── Usar o crédito (haver) do cliente para abater o fiado ────────────
  app.post("/clientes/:id/usar-haver", async (req, reply) => {
    const { id } = idParam.parse(req.params);

    const resultado = await prisma.$transaction(async (tx) => {
      const cliente = await tx.cliente.findUniqueOrThrow({ where: { id } });
      if (cliente.saldoHaver.lessThanOrEqualTo(0)) {
        throw app.httpErrors.badRequest("O cliente não tem crédito (haver) para usar.");
      }
      if (cliente.saldoConta.lessThanOrEqualTo(0)) {
        throw app.httpErrors.badRequest("O cliente não tem fiado em aberto para abater.");
      }

      const usar = D.min(cliente.saldoHaver, cliente.saldoConta);
      await abaterFiadoNasVendas(tx, id, usar);
      const novoSaldo = cliente.saldoConta.minus(usar);
      const novoHaver = cliente.saldoHaver.minus(usar);

      await tx.cliente.update({ where: { id }, data: { saldoConta: novoSaldo, saldoHaver: novoHaver } });
      await tx.lancamentoConta.create({
        data: {
          clienteId: id,
          tipo: "CREDITO",
          valor: usar,
          saldoApos: novoSaldo,
          descricao: "Uso de crédito (haver) para abater o fiado",
        },
      });

      return { usado: usar, saldoConta: novoSaldo, saldoHaver: novoHaver };
    });

    return reply.code(200).send(resultado);
  });
}
