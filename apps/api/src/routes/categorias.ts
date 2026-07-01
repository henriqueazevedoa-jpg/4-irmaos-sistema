import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { textoObrigatorio } from "../lib/campos.js";

const corpoCategoria = z.object({
  nome: textoObrigatorio("Informe o nome da categoria"),
});

export async function rotasCategorias(app: FastifyInstance) {
  // Lista todas as categorias (usada em listas de seleção)
  app.get("/categorias", async () => {
    const dados = await prisma.categoria.findMany({ orderBy: { nome: "asc" } });
    return { dados };
  });

  app.post("/categorias", async (req, reply) => {
    const corpo = corpoCategoria.parse(req.body);
    const categoria = await prisma.categoria.create({ data: corpo });
    return reply.code(201).send(categoria);
  });

  app.put("/categorias/:id", async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const corpo = corpoCategoria.parse(req.body);
    return prisma.categoria.update({ where: { id }, data: corpo });
  });

  app.delete("/categorias/:id", async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    await prisma.categoria.delete({ where: { id } });
    return reply.code(204).send();
  });
}
