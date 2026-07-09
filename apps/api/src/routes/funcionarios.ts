import type { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { textoObrigatorio, textoOpcional } from "../lib/campos.js";
import { paginacaoQuery, montarPaginacao } from "../lib/http.js";

const corpoFuncionario = z.object({
  nome: textoObrigatorio("Informe o nome do funcionário"),
  telefone: textoOpcional,
  observacoes: textoOpcional,
  ativo: z.boolean().optional(),
});

const idParam = z.object({ id: z.string() });

export async function rotasFuncionarios(app: FastifyInstance) {
  app.get("/funcionarios", async (req) => {
    const { pagina, porPagina, busca, incluirInativos } = paginacaoQuery.parse(req.query);

    const where: Prisma.FuncionarioWhereInput = {
      ...(incluirInativos ? {} : { ativo: true }),
      ...(busca
        ? {
            OR: [
              { nome: { contains: busca, mode: "insensitive" } },
              { telefone: { contains: busca } },
            ],
          }
        : {}),
    };

    const [dados, total] = await Promise.all([
      prisma.funcionario.findMany({
        where,
        orderBy: { nome: "asc" },
        skip: (pagina - 1) * porPagina,
        take: porPagina,
      }),
      prisma.funcionario.count({ where }),
    ]);

    return { dados, paginacao: montarPaginacao(pagina, porPagina, total) };
  });

  app.get("/funcionarios/:id", async (req) => {
    const { id } = idParam.parse(req.params);
    return prisma.funcionario.findUniqueOrThrow({ where: { id } });
  });

  app.post("/funcionarios", async (req, reply) => {
    const corpo = corpoFuncionario.parse(req.body);
    const funcionario = await prisma.funcionario.create({ data: corpo });
    return reply.code(201).send(funcionario);
  });

  app.put("/funcionarios/:id", async (req) => {
    const { id } = idParam.parse(req.params);
    const corpo = corpoFuncionario.parse(req.body);
    return prisma.funcionario.update({ where: { id }, data: corpo });
  });

  app.delete("/funcionarios/:id", async (req, reply) => {
    const { id } = idParam.parse(req.params);
    await prisma.funcionario.update({ where: { id }, data: { ativo: false } });
    return reply.code(204).send();
  });
}
