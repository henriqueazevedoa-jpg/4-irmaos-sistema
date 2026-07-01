import { z } from "zod";

// Helpers de validação reutilizados nos cadastros.
// Convertem texto vazio ("") em null, para não guardar strings vazias no banco.

const vazioParaNulo = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? null : v;

export const textoObrigatorio = (msg = "Campo obrigatório") =>
  z.string({ required_error: msg }).trim().min(1, msg);

export const textoOpcional = z.preprocess(vazioParaNulo, z.string().trim().nullish());

export const emailOpcional = z.preprocess(
  vazioParaNulo,
  z.string().trim().email("E-mail inválido").nullish()
);

// Valor monetário/numérico (aceita número ou texto numérico).
export const numeroNaoNegativo = z.coerce.number().min(0, "Não pode ser negativo");
