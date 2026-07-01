import { notifications } from "@mantine/notifications";
import { ApiError } from "./api";

// Mostra uma mensagem de erro amigável (converte erros técnicos em texto claro).
export function notificarErro(erro: unknown, titulo = "Ops!") {
  let mensagem = "Ocorreu um erro inesperado.";
  if (erro instanceof ApiError) {
    mensagem =
      erro.detalhes && erro.detalhes.length
        ? erro.detalhes.map((d) => d.mensagem).join(" • ")
        : erro.message;
  } else if (erro instanceof Error) {
    mensagem = erro.message;
  }
  notifications.show({ color: "red", title: titulo, message: mensagem });
}

export function notificarSucesso(mensagem: string) {
  notifications.show({ color: "teal", title: "Pronto!", message: mensagem });
}
