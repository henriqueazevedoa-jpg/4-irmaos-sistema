import { formatarMoeda, formatarData, formatarDataHora, formatarNumero } from "./formato";
import { LABEL_FORMA } from "./pagamento";
import type { VendaDetalhe, ContaCliente, DestinoDevolucao } from "./tipos";

// Dados da loja no topo do recibo (ajuste aqui o nome/telefone da loja).
const LOJA = {
  nome: "LOJA 4 IRMÃOS",
  sub: "Materiais de Construção",
  rodape: "Obrigado pela preferência!",
};

const LABEL_DESTINO: Record<DestinoDevolucao, string> = {
  DINHEIRO: "Dinheiro devolvido",
  HAVER: "Crédito na conta",
  ABATER_FIADO: "Abateu o fiado",
};

// Escapa caracteres para não quebrar o HTML.
function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] || c));
}

function linha(esquerda: string, direita: string, classe = ""): string {
  return `<div class="row ${classe}"><span>${esquerda}</span><span>${direita}</span></div>`;
}

// Agrupa itens iguais (mesma descrição) somando quantidade e valor. Evita listar
// um a um — ex.: 20 parafusos devolvidos viram uma linha "20x Parafuso".
function agruparPorDescricao(
  itens: { descricao: string; quantidade: string; valorTotal: string }[]
): { descricao: string; quantidade: number; valorTotal: number }[] {
  const mapa = new Map<string, { descricao: string; quantidade: number; valorTotal: number }>();
  for (const i of itens) {
    const atual = mapa.get(i.descricao) ?? { descricao: i.descricao, quantidade: 0, valorTotal: 0 };
    atual.quantidade += Number(i.quantidade);
    atual.valorTotal += Number(i.valorTotal);
    mapa.set(i.descricao, atual);
  }
  return [...mapa.values()];
}

// Envolve o conteúdo com a estrutura e o estilo do recibo de 80mm.
function envelope(corpo: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Recibo</title><style>
    @page { size: 80mm auto; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { width: 80mm; font-family: 'Courier New', monospace; font-size: 12px; line-height: 1.35; color: #000; padding: 3mm; }
    .c { text-align: center; }
    .b { font-weight: bold; }
    .lg { font-size: 15px; }
    .sm { font-size: 11px; }
    hr { border: 0; border-top: 1px dashed #000; margin: 5px 0; }
    .row { display: flex; justify-content: space-between; gap: 6px; }
    .row > span:last-child { text-align: right; white-space: nowrap; }
    .mt { margin-top: 5px; }
  </style></head><body>${corpo}</body></html>`;
}

function cabecalho(titulo: string): string {
  return `
    <div class="c b lg">${LOJA.nome}</div>
    <div class="c sm">${LOJA.sub}</div>
    <hr>
    <div class="c b">${titulo}</div>`;
}

// ───────────────────────── Recibo de VENDA ─────────────────────────
export function reciboVenda(v: VendaDetalhe): string {
  const itens = v.itens
    .map((it) => {
      const q = Number(it.quantidade);
      const unit = q > 0 ? Number(it.total) / q : 0;
      const dev = Number(it.quantidadeDevolvida);
      return `
        <div>${esc(it.descricao)}</div>
        ${linha(`<span class="sm">${formatarNumero(it.quantidade)} x ${formatarMoeda(unit)}</span>`, formatarMoeda(it.total))}
        ${dev > 0 ? `<div class="sm">&gt;&gt; devolvido: ${formatarNumero(it.quantidadeDevolvida)}</div>` : ""}`;
    })
    .join("");

  const pagamentos = v.pagamentos
    .map((p) => linha(esc(LABEL_FORMA[p.forma]), formatarMoeda(p.valor)))
    .join("");

  const desconto = Number(v.desconto) > 0 ? linha("Desconto", "- " + formatarMoeda(v.desconto)) : "";

  // Seção de devoluções (aparece quando a venda já teve itens devolvidos).
  // Itens iguais são agrupados (somando quantidade e valor) para a lista não crescer.
  const totalDevolvido = v.devolucoes.reduce((s, d) => s + Number(d.valorTotal), 0);
  const itensDevolvidos = agruparPorDescricao(v.devolucoes.flatMap((d) => d.itens));
  const secDevolucoes = v.devolucoes.length
    ? `<hr><div class="b">Devoluções:</div>` +
      itensDevolvidos
        .map((it) =>
          linha(
            `<span class="sm">${formatarNumero(it.quantidade)}x ${esc(it.descricao)}</span>`,
            `<span class="sm">- ${formatarMoeda(it.valorTotal)}</span>`
          )
        )
        .join("") +
      linha("Total devolvido", "- " + formatarMoeda(totalDevolvido), "b") +
      linha("Total líquido", formatarMoeda(Number(v.total) - totalDevolvido), "b lg")
    : "";

  return envelope(`
    ${cabecalho("RECIBO DE VENDA")}
    ${linha(`Venda nº ${v.numero}`, formatarDataHora(v.dataVenda))}
    ${v.cliente ? `<div>Cliente: ${esc(v.cliente.nome)}</div>` : ""}
    ${v.funcionario ? `<div>Vendedor: ${esc(v.funcionario.nome)}</div>` : ""}
    <hr>
    ${itens}
    <hr>
    ${linha("Subtotal", formatarMoeda(v.subtotal))}
    ${desconto}
    ${linha("TOTAL", formatarMoeda(v.total), "b lg")}
    <hr>
    <div class="b">Pagamento:</div>
    ${pagamentos}
    ${secDevolucoes}
    <hr>
    <div class="c sm mt">*** Documento sem valor fiscal ***</div>
    <div class="c sm">${LOJA.rodape}</div>
  `);
}

// Junta os dados do demonstrativo (usado no 80mm e no A4).
function dadosDemonstrativo(conta: ContaCliente) {
  const compras = conta.comprasCiclo;
  const pagamentos = conta.lancamentos.filter((l) => l.tipo === "CREDITO");
  const totalComprado = compras.reduce((s, v) => s + Number(v.valorFiado), 0);
  const totalPago = pagamentos.reduce((s, p) => s + Number(p.valor), 0);
  return {
    compras,
    pagamentos,
    totalComprado,
    totalPago,
    deve: Number(conta.cliente.saldoConta),
    haver: Number(conta.cliente.saldoHaver),
  };
}

// ───────────────── Demonstrativo da CONTA (bobina 80mm) ─────────────
export function reciboConta(conta: ContaCliente): string {
  const d = dadosDemonstrativo(conta);

  const secCompras = d.compras.length
    ? d.compras
        .map(
          (v) => `
        <div class="b mt">Venda nº ${v.numero} — ${formatarData(v.dataVenda)}</div>
        ${v.itens
          .map((it) =>
            linha(
              `<span class="sm">${formatarNumero(it.quantidade)}x ${esc(it.descricao)}</span>`,
              `<span class="sm">${formatarMoeda(it.total)}</span>`
            )
          )
          .join("")}`
        )
        .join("")
    : '<div class="sm">Nenhuma compra no período.</div>';

  const secPagamentos = d.pagamentos.length
    ? d.pagamentos
        .map((p) => linha(`<span class="sm">${formatarData(p.data)} ${esc(p.descricao ?? "Pagamento")}</span>`, `<span class="sm">${formatarMoeda(p.valor)}</span>`))
        .join("")
    : '<div class="sm">Nenhum pagamento no período.</div>';

  return envelope(`
    ${cabecalho("DEMONSTRATIVO DA CONTA")}
    <div>Cliente: ${esc(conta.cliente.nome)}</div>
    ${linha("Emitido em", formatarDataHora(new Date().toISOString()))}
    <hr>
    <div class="b">COMPRAS</div>
    ${secCompras}
    ${linha("Total comprado", formatarMoeda(d.totalComprado), "b")}
    <hr>
    <div class="b">PAGAMENTOS</div>
    ${secPagamentos}
    ${linha("Total pago", formatarMoeda(d.totalPago), "b")}
    <hr>
    ${linha("SALDO DEVEDOR", formatarMoeda(d.deve), "b lg")}
    ${d.haver > 0 ? linha("Crédito a favor", formatarMoeda(d.haver)) : ""}
    <hr>
    <div class="c sm">*** Documento sem valor fiscal ***</div>
  `);
}

// ───────────────── Demonstrativo da CONTA em FOLHA A4 ───────────────
function envelopeA4(corpo: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Demonstrativo da conta</title><style>
    @page { size: A4 portrait; margin: 16mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #222; margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .cab { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid #b5451f; padding-bottom: 10px; }
    .cab h1 { font-size: 22px; margin: 0; color: #b5451f; letter-spacing: .5px; }
    .cab .sub { color: #888; font-size: 12px; }
    .cab .emit { color: #888; font-size: 11px; text-align: right; }
    .titulo { text-align: center; font-size: 13px; font-weight: bold; letter-spacing: 3px; margin: 20px 0 12px; color: #444; }
    .cliente { font-size: 13px; margin-bottom: 4px; }
    .cliente b { color: #666; margin-right: 6px; }
    .secao { font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; color: #b5451f; margin: 22px 0 6px; }
    table.lista { width: 100%; border-collapse: collapse; }
    table.lista th, table.lista td { border: 1px solid #e2e2e2; padding: 6px 9px; text-align: left; }
    table.lista th { background: #f5f5f5; font-size: 10px; text-transform: uppercase; letter-spacing: .5px; color: #666; font-weight: bold; }
    table.lista td.r, table.lista th.r { text-align: right; font-variant-numeric: tabular-nums; }
    table.lista tr.grupo td { background: #faf5f2; font-weight: bold; color: #333; }
    table.lista tfoot td { background: #f5f5f5; font-weight: bold; }
    .saldo-box { display: flex; justify-content: space-between; align-items: center; width: 300px; margin: 24px 0 0 auto; padding: 12px 18px; background: #f8f0eb; border: 1px solid #e6ccbe; border-left: 5px solid #b5451f; }
    .saldo-box .lbl { font-weight: bold; color: #444; letter-spacing: .5px; }
    .saldo-box .val { font-size: 19px; font-weight: bold; color: #b5451f; font-variant-numeric: tabular-nums; }
    .haver-box { display: flex; justify-content: space-between; align-items: center; width: 300px; margin: 8px 0 0 auto; padding: 9px 18px; background: #eef7f0; border-left: 5px solid #2f9e44; color: #2b8a3e; font-weight: bold; }
    .haver-box .val { font-variant-numeric: tabular-nums; }
    .rodape { margin-top: 32px; text-align: center; color: #aaa; font-size: 11px; letter-spacing: .5px; }
  </style></head><body>${corpo}</body></html>`;
}

export function reciboContaA4(conta: ContaCliente): string {
  const d = dadosDemonstrativo(conta);

  const linhasCompras = d.compras.length
    ? d.compras
        .map(
          (v) => `
        <tr class="grupo"><td colspan="4">Venda nº ${v.numero} — ${formatarData(v.dataVenda)}</td></tr>
        ${v.itens
          .map(
            (it) =>
              `<tr><td>${esc(it.descricao)}</td><td class="r">${formatarNumero(it.quantidade)}</td><td class="r">${formatarMoeda(it.precoUnitario)}</td><td class="r">${formatarMoeda(it.total)}</td></tr>`
          )
          .join("")}`
        )
        .join("")
    : `<tr><td colspan="4" style="color:#888">Nenhuma compra no período.</td></tr>`;

  const linhasPagamentos = d.pagamentos.length
    ? d.pagamentos
        .map(
          (p) =>
            `<tr><td>${formatarData(p.data)}</td><td>${esc(p.descricao ?? "Pagamento")}</td><td class="r">${formatarMoeda(p.valor)}</td></tr>`
        )
        .join("")
    : `<tr><td colspan="3" style="color:#888">Nenhum pagamento no período.</td></tr>`;

  return envelopeA4(`
    <div class="cab">
      <div><h1>${LOJA.nome}</h1><div class="sub">${LOJA.sub}</div></div>
      <div class="emit">Emitido em<br>${formatarDataHora(new Date().toISOString())}</div>
    </div>
    <div class="titulo">DEMONSTRATIVO DA CONTA</div>
    <div class="cliente"><b>Cliente:</b> ${esc(conta.cliente.nome)}</div>

    <div class="secao">Compras no período</div>
    <table class="lista">
      <thead><tr><th>Item</th><th class="r">Qtd</th><th class="r">Unit.</th><th class="r">Total</th></tr></thead>
      <tbody>${linhasCompras}</tbody>
      <tfoot><tr><td colspan="3">Total comprado</td><td class="r">${formatarMoeda(d.totalComprado)}</td></tr></tfoot>
    </table>

    <div class="secao">Pagamentos no período</div>
    <table class="lista">
      <thead><tr><th>Data</th><th>Movimento</th><th class="r">Valor</th></tr></thead>
      <tbody>${linhasPagamentos}</tbody>
      <tfoot><tr><td colspan="2">Total pago</td><td class="r">${formatarMoeda(d.totalPago)}</td></tr></tfoot>
    </table>

    <div class="saldo-box">
      <span class="lbl">SALDO DEVEDOR</span>
      <span class="val">${formatarMoeda(d.deve)}</span>
    </div>
    ${
      d.haver > 0
        ? `<div class="haver-box"><span>Crédito a favor (haver)</span><span class="val">${formatarMoeda(d.haver)}</span></div>`
        : ""
    }
    <div class="rodape">Documento sem valor fiscal</div>
  `);
}

// ─────────────────────── Comprovante de QUITAÇÃO ────────────────────
export function reciboQuitacao(conta: ContaCliente): string {
  return envelope(`
    ${cabecalho("COMPROVANTE DE QUITAÇÃO")}
    <div>Cliente: ${esc(conta.cliente.nome)}</div>
    ${linha("Emitido em", formatarDataHora(new Date().toISOString()))}
    <hr>
    <div class="c b mt">CONTA QUITADA</div>
    <div class="c">Nada consta em aberto.</div>
    ${Number(conta.cliente.saldoHaver) > 0 ? linha("Crédito a favor", formatarMoeda(conta.cliente.saldoHaver)) : ""}
    <hr>
    <div class="c sm">*** Documento sem valor fiscal ***</div>
    <div class="c sm">${LOJA.rodape}</div>
  `);
}

// ─────────────────────── Recibo da DEVOLUÇÃO ────────────────────────
interface DevolucaoImpressao {
  data: string;
  valorTotal: string;
  destino: DestinoDevolucao;
  itens: { descricao: string; quantidade: string; valorUnitario: string; valorTotal: string }[];
}

export function reciboDevolucao(v: VendaDetalhe, d: DevolucaoImpressao): string {
  const itens = agruparPorDescricao(d.itens)
    .map((it) => {
      const unit = it.quantidade > 0 ? it.valorTotal / it.quantidade : 0;
      return `
        <div>${esc(it.descricao)}</div>
        ${linha(`<span class="sm">${formatarNumero(it.quantidade)} x ${formatarMoeda(unit)}</span>`, formatarMoeda(it.valorTotal))}`;
    })
    .join("");

  return envelope(`
    ${cabecalho("COMPROVANTE DE DEVOLUÇÃO")}
    ${linha(`Ref. venda nº ${v.numero}`, formatarDataHora(d.data))}
    ${v.cliente ? `<div>Cliente: ${esc(v.cliente.nome)}</div>` : ""}
    <hr>
    ${itens}
    <hr>
    ${linha("TOTAL DEVOLVIDO", formatarMoeda(d.valorTotal), "b lg")}
    ${linha("Destino", esc(LABEL_DESTINO[d.destino]))}
    <hr>
    <div class="c sm">*** Documento sem valor fiscal ***</div>
  `);
}
