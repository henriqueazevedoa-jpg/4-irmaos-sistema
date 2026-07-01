import type { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { textoObrigatorio, textoOpcional, emailOpcional } from "../lib/campos.js";
import { paginacaoQuery, montarPaginacao } from "../lib/http.js";

const corpoFornecedor = z.object({
  tipoPessoa: z.enum(["PF", "PJ"]).default("PJ"),
  cpfCnpj: textoObrigatorio("Informe o CPF/CNPJ"),
  razaoSocial: textoObrigatorio("Informe a razão social / nome"),
  nomeFantasia: textoOpcional,
  inscricaoEstadual: textoOpcional,
  email: emailOpcional,
  telefone: textoOpcional,
  cep: textoOpcional,
  logradouro: textoOpcional,
  numero: textoOpcional,
  complemento: textoOpcional,
  bairro: textoOpcional,
  cidade: textoOpcional,
  uf: textoOpcional,
  observacoes: textoOpcional,
  ativo: z.boolean().optional(),
});

const idParam = z.object({ id: z.string() });

export async function rotasFornecedores(app: FastifyInstance) {
  app.get("/fornecedores", async (req) => {
    const { pagina, porPagina, busca, incluirInativos } = paginacaoQuery.parse(req.query);

    const where: Prisma.FornecedorWhereInput = {
      ...(incluirInativos ? {} : { ativo: true }),
      ...(busca
        ? {
            OR: [
              { razaoSocial: { contains: busca, mode: "insensitive" } },
              { nomeFantasia: { contains: busca, mode: "insensitive" } },
              { cpfCnpj: { contains: busca } },
            ],
          }
        : {}),
    };

    const [dados, total] = await Promise.all([
      prisma.fornecedor.findMany({
        where,
        orderBy: { razaoSocial: "asc" },
        skip: (pagina - 1) * porPagina,
        take: porPagina,
      }),
      prisma.fornecedor.count({ where }),
    ]);

    return { dados, paginacao: montarPaginacao(pagina, porPagina, total) };
  });

  app.get("/fornecedores/:id", async (req) => {
    const { id } = idParam.parse(req.params);
    return prisma.fornecedor.findUniqueOrThrow({ where: { id } });
  });

  app.post("/fornecedores", async (req, reply) => {
    const corpo = corpoFornecedor.parse(req.body);
    const fornecedor = await prisma.fornecedor.create({ data: corpo });
    return reply.code(201).send(fornecedor);
  });

  app.put("/fornecedores/:id", async (req) => {
    const { id } = idParam.parse(req.params);
    const corpo = corpoFornecedor.parse(req.body);
    return prisma.fornecedor.update({ where: { id }, data: corpo });
  });

  // "Remover" = inativar (mantém o histórico de notas ligado ao fornecedor).
  app.delete("/fornecedores/:id", async (req, reply) => {
    const { id } = idParam.parse(req.params);
    await prisma.fornecedor.update({ where: { id }, data: { ativo: false } });
    return reply.code(204).send();
  });
}
