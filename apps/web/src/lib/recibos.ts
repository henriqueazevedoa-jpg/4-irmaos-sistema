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
      return `
        <div>${esc(it.descricao)}</div>
        ${linha(`<span class="sm">${formatarNumero(it.quantidade)} x ${formatarMoeda(unit)}</span>`, formatarMoeda(it.total))}`;
    })
    .join("");

  const pagamentos = v.pagamentos
    .map((p) => linha(esc(LABEL_FORMA[p.forma]), formatarMoeda(p.valor)))
    .join("");

  const desconto = Number(v.desconto) > 0 ? linha("Desconto", "- " + formatarMoeda(v.desconto)) : "";

  return envelope(`
    ${cabecalho("RECIBO DE VENDA")}
    ${linha(`Venda nº ${v.numero}`, formatarDataHora(v.dataVenda))}
    ${v.cliente ? `<div>Cliente: ${esc(v.cliente.nome)}</div>` : ""}
    <hr>
    ${itens}
    <hr>
    ${linha("Subtotal", formatarMoeda(v.subtotal))}
    ${desconto}
    ${linha("TOTAL", formatarMoeda(v.total), "b lg")}
    <hr>
    <div class="b">Pagamento:</div>
    ${pagamentos}
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
    body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #000; margin: 0; }
    h1 { font-size: 20px; margin: 0; }
    .sub { color: #555; }
    .cab { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #333; padding-bottom: 8px; }
    .titulo { text-align: center; font-size: 15px; font-weight: bold; margin: 16px 0; text-transform: uppercase; letter-spacing: 1px; }
    .info { margin: 4px 0; }
    .info b { display: inline-block; min-width: 100px; }
    table { width: 100%; border-collapse: collapse; margin-top: 4px; }
    th, td { border: 1px solid #ccc; padding: 4px 6px; text-align: left; }
    th { background: #f0f0f0; }
    .r { text-align: right; }
    .venda-cab { margin-top: 14px; font-weight: bold; }
    .total { text-align: right; font-size: 16px; font-weight: bold; margin-top: 14px; border-top: 2px solid #333; padding-top: 8px; }
    .rodape { margin-top: 28px; text-align: center; color: #777; font-size: 11px; }
  </style></head><body>${corpo}</body></html>`;
}

export function reciboContaA4(conta: ContaCliente): string {
  const d = dadosDemonstrativo(conta);

  const linhasCompras = d.compras.length
    ? d.compras
        .map(
          (v) => `
        <tr><td colspan="4" style="background:#f2f2f2;font-weight:bold">Venda nº ${v.numero} — ${formatarData(v.dataVenda)}</td></tr>
        ${v.itens
          .map(
            (it) =>
              `<tr><td>${esc(it.descricao)}</td><td class="r">${formatarNumero(it.quantidade)}</td><td class="r">${formatarMoeda(it.precoUnitario)}</td><td class="r">${formatarMoeda(it.total)}</td></tr>`
          )
          .join("")}`
        )
        .join("")
    : `<tr><td colspan="4">Nenhuma compra no período.</td></tr>`;

  const linhasPagamentos = d.pagamentos.length
    ? d.pagamentos
        .map(
          (p) =>
            `<tr><td>${formatarData(p.data)}</td><td>${esc(p.descricao ?? "Pagamento")}</td><td class="r">${formatarMoeda(p.valor)}</td></tr>`
        )
        .join("")
    : `<tr><td colspan="3">Nenhum pagamento no período.</td></tr>`;

  return envelopeA4(`
    <div class="cab">
      <div><h1>${LOJA.nome}</h1><div class="sub">${LOJA.sub}</div></div>
      <div class="sub">Emitido em ${formatarDataHora(new Date().toISOString())}</div>
    </div>
    <div class="titulo">Demonstrativo da Conta</div>
    <div class="info"><b>Cliente:</b> ${esc(conta.cliente.nome)}</div>

    <div class="venda-cab">Compras no período</div>
    <table>
      <thead><tr><th>Item</th><th class="r">Qtd</th><th class="r">Unit.</th><th class="r">Total</th></tr></thead>
      <tbody>${linhasCompras}</tbody>
    </table>
    <div style="text-align:right;font-weight:bold;margin-top:4px">Total comprado: ${formatarMoeda(d.totalComprado)}</div>

    <div class="venda-cab">Pagamentos no período</div>
    <table>
      <thead><tr><th>Data</th><th>Movimento</th><th class="r">Valor</th></tr></thead>
      <tbody>${linhasPagamentos}</tbody>
    </table>
    <div style="text-align:right;font-weight:bold;margin-top:4px">Total pago: ${formatarMoeda(d.totalPago)}</div>

    <div class="total">
      <div style="font-weight:normal">Total comprado: ${formatarMoeda(d.totalComprado)}</div>
      <div style="font-weight:normal">Total pago: − ${formatarMoeda(d.totalPago)}</div>
      <div style="font-size:18px">SALDO DEVEDOR: ${formatarMoeda(d.deve)}</div>
      ${d.haver > 0 ? `<div style="font-weight:normal">Crédito a favor: ${formatarMoeda(d.haver)}</div>` : ""}
    </div>
    <div class="rodape">*** Documento sem valor fiscal ***</div>
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
  const itens = d.itens
    .map(
      (it) => `
        <div>${esc(it.descricao)}</div>
        ${linha(`<span class="sm">${formatarNumero(it.quantidade)} x ${formatarMoeda(it.valorUnitario)}</span>`, formatarMoeda(it.valorTotal))}`
    )
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
