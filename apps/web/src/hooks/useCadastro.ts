import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, query } from "../lib/api";
import type { RespostaLista } from "../lib/tipos";
import { notificarErro, notificarSucesso } from "../lib/notificacoes";

export interface ParamsLista {
  pagina: number;
  porPagina: number;
  busca?: string;
  incluirInativos?: boolean;
  [extra: string]: string | number | boolean | undefined;
}

// Lê uma lista paginada de um recurso (ex: "fornecedores").
export function useLista<T>(recurso: string, params: ParamsLista) {
  return useQuery({
    queryKey: [recurso, params],
    queryFn: () => api.get<RespostaLista<T>>(`/${recurso}${query(params)}`),
    placeholderData: (anterior) => anterior,
  });
}

// Cria (sem id) ou edita (com id) um registro.
export function useSalvar<T>(recurso: string, aoConcluir?: () => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dados }: { id?: string; dados: unknown }) =>
      id ? api.put<T>(`/${recurso}/${id}`, dados) : api.post<T>(`/${recurso}`, dados),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [recurso] });
      notificarSucesso("Cadastro salvo com sucesso.");
      aoConcluir?.();
    },
    onError: (erro) => notificarErro(erro),
  });
}

// Remove (inativa) um registro.
export function useRemover(recurso: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del(`/${recurso}/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [recurso] });
      notificarSucesso("Registro removido.");
    },
    onError: (erro) => notificarErro(erro),
  });
}
