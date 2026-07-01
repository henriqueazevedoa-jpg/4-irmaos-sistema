#!/usr/bin/env bash
# Gera (ou regenera) o certificado HTTPS para acesso pelo celular na rede da loja.
# Rode este script se o IP da loja mudar (ex.: trocou de roteador/rede).
set -euo pipefail
cd "$(dirname "$0")"

MKCERT="$HOME/.local/bin/mkcert"
if [ ! -x "$MKCERT" ]; then
  echo "❌ mkcert não encontrado em ~/.local/bin/mkcert."
  exit 1
fi

IP=$(ip route get 1.1.1.1 2>/dev/null | grep -oP 'src \K[\d.]+' || true)
if [ -z "${IP:-}" ]; then
  echo "❌ Não consegui descobrir o IP da rede. Verifique a conexão."
  exit 1
fi

mkdir -p apps/web/certs apps/web/public

# Certificado do servidor (válido para o IP da loja)
"$MKCERT" -cert-file apps/web/certs/cert.pem -key-file apps/web/certs/key.pem "$IP" localhost 127.0.0.1

# Cópia da "autoridade" (o que se instala no celular), baixável pela rede
CAROOT="$("$MKCERT" -CAROOT)"
cp "$CAROOT/rootCA.pem" apps/web/public/certificado-4irmaos.crt
cp "$CAROOT/rootCA.pem" apps/web/certs/certificado-para-o-celular.pem

echo ""
echo "✅ Certificado gerado para o IP: $IP"
echo ""
echo "No CELULAR (na mesma rede Wi-Fi da loja):"
echo "  1) Baixe o certificado abrindo:  http://$IP:5173/certificado-4irmaos.crt"
echo "  2) Instale-o (veja o passo a passo no README)"
echo "  3) Depois acesse o sistema em:   https://$IP:5443"
