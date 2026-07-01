// Camada de comunicação com o servidor (API).
// Todas as telas usam estas funções para ler e gravar dados.

const BASE = "/api";

export interface DetalheErro {
  campo: string;
  mensagem: string;
}

export class ApiError extends Error {
  detalhes?: DetalheErro[];
  status: number;
  constructor(mensagem: string, status: number, detalhes?: DetalheErro[]) {
    super(mensagem);
    this.status = status;
    this.detalhes = detalhes;
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(BASE + path, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return null as T;

  const dados = await res.json().catch(() => null);

  if (!res.ok) {
    const mensagem = dados?.erro ?? "Não foi possível comunicar com o servidor.";
    throw new ApiError(mensagem, res.status, dados?.detalhes);
  }

  return dados as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body: unknown) => request<T>("POST", path, body),
  put: <T>(path: string, body: unknown) => request<T>("PUT", path, body),
  del: (path: string) => request<null>("DELETE", path),
};

// Monta a query string (?pagina=1&busca=...) a partir de um objeto.
export function query(params: Record<string, string | number | boolean | undefined>): string {
  const partes = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return partes.length ? `?${partes.join("&")}` : "";
}
