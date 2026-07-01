export function formatarMoeda(valor: string | number): string {
  const n = typeof valor === "string" ? Number(valor) : valor;
  return (Number.isFinite(n) ? n : 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function formatarNumero(valor: string | number): string {
  const n = typeof valor === "string" ? Number(valor) : valor;
  return (Number.isFinite(n) ? n : 0).toLocaleString("pt-BR", {
    maximumFractionDigits: 3,
  });
}

export function formatarData(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR");
}
