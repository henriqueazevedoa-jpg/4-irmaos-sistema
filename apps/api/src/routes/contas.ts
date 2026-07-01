import type { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { textoOpcional } from "../lib/campos.js";

const D = Prisma.Decimal;

const idParam = z.object({ id: z.string() });

const FORMAS_PAGAMENTO = ["DINHEIRO", "PIX", "CARTAO_DEBITO", "CARTAO_CREDITO", "TRANSFERENCIA", "OUTRO"] as const;

const corpoPagamento = z.object({
  valor: z.coerce.number().positive("O valor deve ser maior que zero"),
  forma: z.enum(FORMAS_PAGAMENTO).default("DINHEIRO"),
  observacao: textoOpcional,
});

export async function rotasContas(app: FastifyInstance) {
  // ── Extrato da conta do cliente ─────────────────────────────────────
  app.get("/clientes/:id/conta", async (req) => {
    const { id } = idParam.parse(req.params);
    const cliente = await prisma.cliente.findUniqueOrThrow({
      where: { id },
      select: { id: true, nome: true, saldoConta: true, limiteCredito: true },
    });
    const lancamentos = await prisma.lancamentoConta.findMany({
      where: { clienteId: id },
      orderBy: { data: "desc" },
      take: 100,
    });
    return { cliente, lancamentos };
  });

  // ── Registrar um pagamento do cliente (abate o fiado) ───────────────
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

      const novoSaldo = cliente.saldoConta.minus(valor);

      await tx.pagamento.create({
        data: {
          clienteId: id,
          forma: corpo.forma,
          valor,
          observacao: corpo.observacao ?? null,
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

      return { novoSaldo, lancamento };
    });

    return reply.code(201).send(resultado);
  });
}
