import type { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { textoObrigatorio, textoOpcional, emailOpcional, numeroNaoNegativo } from "../lib/campos.js";
import { paginacaoQuery, montarPaginacao } from "../lib/http.js";

const corpoCliente = z.object({
  tipoPessoa: z.enum(["PF", "PJ"]).default("PF"),
  nome: textoObrigatorio("Informe o nome do cliente"),
  cpfCnpj: textoOpcional,
  email: emailOpcional,
  telefone: textoOpcional,
  cep: textoOpcional,
  logradouro: textoOpcional,
  numero: textoOpcional,
  complemento: textoOpcional,
  bairro: textoOpcional,
  cidade: textoOpcional,
  uf: textoOpcional,
  limiteCredito: numeroNaoNegativo.default(0),
  observacoes: textoOpcional,
  ativo: z.boolean().optional(),
});

const idParam = z.object({ id: z.string() });

export async function rotasClientes(app: FastifyInstance) {
  app.get("/clientes", async (req) => {
    const { pagina, porPagina, busca, incluirInativos } = paginacaoQuery.parse(req.query);

    const where: Prisma.ClienteWhereInput = {
      ...(incluirInativos ? {} : { ativo: true }),
      ...(busca
        ? {
            OR: [
              { nome: { contains: busca, mode: "insensitive" } },
              { cpfCnpj: { contains: busca } },
              { telefone: { contains: busca } },
            ],
          }
        : {}),
    };

    const [dados, total] = await Promise.all([
      prisma.cliente.findMany({
        where,
        orderBy: { nome: "asc" },
        skip: (pagina - 1) * porPagina,
        take: porPagina,
      }),
      prisma.cliente.count({ where }),
    ]);

    return { dados, paginacao: montarPaginacao(pagina, porPagina, total) };
  });

  app.get("/clientes/:id", async (req) => {
    const { id } = idParam.parse(req.params);
    return prisma.cliente.findUniqueOrThrow({ where: { id } });
  });

  app.post("/clientes", async (req, reply) => {
    const corpo = corpoCliente.parse(req.body);
    const cliente = await prisma.cliente.create({ data: corpo });
    return reply.code(201).send(cliente);
  });

  app.put("/clientes/:id", async (req) => {
    const { id } = idParam.parse(req.params);
    // saldoConta não é editável aqui: muda apenas por vendas no fiado e pagamentos.
    const corpo = corpoCliente.parse(req.body);
    return prisma.cliente.update({ where: { id }, data: corpo });
  });

  app.delete("/clientes/:id", async (req, reply) => {
    const { id } = idParam.parse(req.params);
    await prisma.cliente.update({ where: { id }, data: { ativo: false } });
    return reply.code(204).send();
  });
}
