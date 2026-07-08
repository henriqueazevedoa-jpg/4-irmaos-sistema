import path from "node:path";
import { fileURLToPath } from "node:url";
import Fastify, { type FastifyError } from "fastify";
import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import fastifyStatic from "@fastify/static";
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
import { rotasCaixa } from "./routes/caixa.js";

const EH_PRODUCAO = process.env.NODE_ENV === "production";

const app = Fastify({
  // Em desenvolvimento, logs coloridos e legíveis; em produção, logs simples (mais rápidos).
  logger: EH_PRODUCAO ? true : { transport: { target: "pino-pretty" } },
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
    await api.register(rotasCaixa);
  },
  { prefix: "/api" }
);

// Em produção, a própria API serve a interface (as telas) já compilada.
// Em desenvolvimento isso não roda — o Vite cuida das telas.
if (EH_PRODUCAO) {
  // Caminho para as telas compiladas, calculado a partir deste arquivo
  // (apps/api/dist/index.js → ../../web/dist = apps/web/dist).
  const aqui = path.dirname(fileURLToPath(import.meta.url));
  const pastaWeb = process.env.WEB_DIST ?? path.resolve(aqui, "../../web/dist");
  await app.register(fastifyStatic, { root: pastaWeb, prefix: "/" });

  // Qualquer endereço que não seja da API devolve a página principal (roteamento das telas).
  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith("/api") || req.url.startsWith("/health")) {
      return reply.code(404).send({ erro: "Rota não encontrada." });
    }
    return reply.sendFile("index.html");
  });
}

// Cria dados de exemplo quando a chave SEED_DEMO está ligada (útil para testar na nuvem).
if (process.env.SEED_DEMO === "true") {
  try {
    const { semearDemo } = await import("./seed-demo.js");
    await semearDemo(prisma);
    app.log.info("✅ Dados de exemplo (SEED_DEMO) criados/atualizados.");
  } catch (e) {
    app.log.error(e, "Falha ao criar dados de exemplo (SEED_DEMO).");
  }
}

app.addHook("onClose", async () => {
  await prisma.$disconnect();
});

try {
  await app.listen({ port: env.PORT, host: "0.0.0.0" });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
