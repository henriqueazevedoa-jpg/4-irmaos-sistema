import { z } from "zod";

// Parâmetros de listagem (paginação + busca) usados por todas as telas de cadastro.
export const paginacaoQuery = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  porPagina: z.coerce.number().int().min(1).max(100).default(20),
  busca: z.string().trim().optional(),
  incluirInativos: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .optional()
    .transform((v) => v === true || v === "true"),
});

export function montarPaginacao(pagina: number, porPagina: number, total: number) {
  return {
    pagina,
    porPagina,
    total,
    totalPaginas: Math.max(1, Math.ceil(total / porPagina)),
  };
}
