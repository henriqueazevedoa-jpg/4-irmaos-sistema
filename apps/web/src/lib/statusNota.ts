import type { StatusNota } from "./tipos";

export const STATUS_NOTA: Record<StatusNota, { label: string; cor: string }> = {
  IMPORTADA: { label: "Importada", cor: "blue" },
  PENDENTE_REVISAO: { label: "Em revisão", cor: "yellow" },
  PROCESSADA: { label: "No estoque", cor: "teal" },
  CANCELADA: { label: "Cancelada", cor: "gray" },
};
