import type { FormaPagamento } from "./tipos";

export const FORMAS_PAGAMENTO: { value: FormaPagamento; label: string }[] = [
  { value: "DINHEIRO", label: "Dinheiro" },
  { value: "PIX", label: "PIX" },
  { value: "CARTAO_DEBITO", label: "Cartão de débito" },
  { value: "CARTAO_CREDITO", label: "Cartão de crédito" },
  { value: "FIADO", label: "Fiado (conta do cliente)" },
  { value: "TRANSFERENCIA", label: "Transferência" },
  { value: "OUTRO", label: "Outro" },
];

// Formas usadas para receber pagamento de fiado (sem a própria opção "Fiado").
export const FORMAS_RECEBIMENTO = FORMAS_PAGAMENTO.filter((f) => f.value !== "FIADO");

export const LABEL_FORMA = Object.fromEntries(
  FORMAS_PAGAMENTO.map((f) => [f.value, f.label])
) as Record<FormaPagamento, string>;
