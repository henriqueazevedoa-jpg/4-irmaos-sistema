import Fastify, { type FastifyError } from "fastify";
import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { env } from "./env.js";
import { prisma } from "./prisma.js";
import { rotasCategorias } from "./routes/categorias.js";
import { rotasFornecedores } from "./routes/fornecedores.js";
import { rotasClientes } from "./routes/clientes.js";
import { rotasProdutos } from "./routes/produtos.js";
import { rotasNotas } from "./routes/notas.js";
import { rotasVendas } from "./routes/vendas.js";
import { rotasContas } from "./routes/contas.js";
import { rotasRelatorios } from "./routes/relatorios.js";

const app = Fastify({
  logger: {
    transport: { target: "pino-pretty" },
  },
});

await app.register(cors, { origin: true });
await app.register(sensible);

// Tratamento central de erros: transforma erros técnicos em respostas claras em português.
app.setErrorHandler((error: FastifyError, req, reply) => {
  if (error instanceof ZodError) {
    return reply.code(400).send({
      erro: "Dados inválidos. Confira os campos.",
      detalhes: error.issues.map((i) => ({
        campo: i.path.join("."),
        mensagem: i.message,
      })),
    });
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      const campos = (error.meta?.target as string[] | undefined)?.join(", ");
      return reply.code(409).send({
        erro: `Já existe um cadastro com esse valor${campos ? ` (${campos})` : ""}.`,
      });
    }
    if (error.code === "P2025") {
      return reply.code(404).send({ erro: "Registro não encontrado." });
    }
    if (error.code === "P2003") {
      return reply.code(409).send({
        erro: "Este registro está sendo usado em outro lugar e não pode ser removido.",
      });
    }
  }

  req.log.error(error);
  return reply.code(error.statusCode ?? 500).send({
    erro: error.message || "Erro interno no servidor.",
  });
});

// Rotas de saúde
app.get("/health", async () => ({
  status: "ok",
  servico: "api-4-irmaos",
  horario: new Date().toISOString(),
}));

app.get("/health/db", async () => {
  await prisma.$queryRaw`SELECT 1`;
  const produtos = await prisma.produto.count();
  return { banco: "ok", totalProdutos: produtos };
});

// Rotas dos cadastros (prefixo /api)
await app.register(
  async (api) => {
    await api.register(rotasCategorias);
    await api.register(rotasFornecedores);
    await api.register(rotasClientes);
    await api.register(rotasProdutos);
    await api.register(rotasNotas);
    await api.register(rotasVendas);
    await api.register(rotasContas);
    await api.register(rotasRelatorios);
  },
  { prefix: "/api" }
);

app.addHook("onClose", async () => {
  await prisma.$disconnect();
});

try {
  await app.listen({ port: env.PORT, host: "0.0.0.0" });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
