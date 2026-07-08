// Imprime um recibo (HTML pronto) usando a impressão do próprio navegador.
// Cria um quadro invisível (iframe), escreve o recibo dentro e manda imprimir —
// assim só o recibo é impresso, sem o resto do sistema, e sem abrir uma nova aba.
export function imprimirHtml(html: string) {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) return;
  doc.open();
  doc.write(html);
  doc.close();

  const janela = iframe.contentWindow!;
  const imprimir = () => {
    janela.focus();
    janela.print();
    // remove o quadro depois de um tempo (dá tempo do diálogo abrir)
    setTimeout(() => iframe.remove(), 2000);
  };

  // espera o conteúdo renderizar antes de imprimir
  if (doc.readyState === "complete") {
    setTimeout(imprimir, 200);
  } else {
    janela.onload = () => setTimeout(imprimir, 200);
  }
}
