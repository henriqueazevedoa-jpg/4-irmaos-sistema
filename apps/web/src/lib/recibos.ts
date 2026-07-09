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

// ───────────────────────── Recibo da CONTA ─────────────────────────
export function reciboConta(conta: ContaCliente): string {
  const deve = Number(conta.cliente.saldoConta);
  const haver = Number(conta.cliente.saldoHaver);

  // Só as compras que ainda têm valor em aberto
  const abertas = conta.vendasFiado.filter((v) => Number(v.valorFiadoAberto) > 0.001);

  const compras = abertas
    .map((v) => {
      const itens = v.itens
        .map((it) => `<div class="sm">- ${formatarNumero(it.quantidade)}x ${esc(it.descricao)} .... ${formatarMoeda(it.total)}</div>`)
        .join("");
      return `
        <div class="mt b">Venda nº ${v.numero} - ${formatarData(v.dataVenda)}</div>
        ${itens}
        ${linha(`<span class="sm">Em aberto</span>`, formatarMoeda(v.valorFiadoAberto), "sm")}`;
    })
    .join("");

  return envelope(`
    ${cabecalho("CONTA DO CLIENTE")}
    <div>Cliente: ${esc(conta.cliente.nome)}</div>
    ${linha("Emitido em", formatarDataHora(new Date().toISOString()))}
    <hr>
    ${haver > 0 ? linha("Crédito a favor", formatarMoeda(haver)) : ""}
    <div class="b">Compras em aberto:</div>
    ${abertas.length ? compras : '<div class="sm">Nenhuma compra em aberto.</div>'}
    <hr>
    ${linha("TOTAL A PAGAR", formatarMoeda(deve), "b lg")}
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
  const deve = Number(conta.cliente.saldoConta);
  const haver = Number(conta.cliente.saldoHaver);
  const abertas = conta.vendasFiado.filter((v) => Number(v.valorFiadoAberto) > 0.001);

  const secoes = abertas
    .map(
      (v) => `
      <div class="venda-cab">Venda nº ${v.numero} — ${formatarData(v.dataVenda)} (em aberto: ${formatarMoeda(v.valorFiadoAberto)})</div>
      <table>
        <thead><tr><th>Item</th><th class="r">Qtd</th><th class="r">Unit.</th><th class="r">Total</th></tr></thead>
        <tbody>
          ${v.itens
            .map(
              (it) =>
                `<tr><td>${esc(it.descricao)}</td><td class="r">${formatarNumero(it.quantidade)}</td><td class="r">${formatarMoeda(it.precoUnitario)}</td><td class="r">${formatarMoeda(it.total)}</td></tr>`
            )
            .join("")}
        </tbody>
      </table>`
    )
    .join("");

  return envelopeA4(`
    <div class="cab">
      <div><h1>${LOJA.nome}</h1><div class="sub">${LOJA.sub}</div></div>
      <div class="sub">Emitido em ${formatarDataHora(new Date().toISOString())}</div>
    </div>
    <div class="titulo">Demonstrativo da Conta</div>
    <div class="info"><b>Cliente:</b> ${esc(conta.cliente.nome)}</div>
    ${haver > 0 ? `<div class="info"><b>Crédito a favor:</b> ${formatarMoeda(haver)}</div>` : ""}
    <div style="margin-top:12px"><b>Compras em aberto:</b></div>
    ${abertas.length ? secoes : "<div>Nenhuma compra em aberto — conta quitada.</div>"}
    <div class="total">TOTAL A PAGAR: ${formatarMoeda(deve)}</div>
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
