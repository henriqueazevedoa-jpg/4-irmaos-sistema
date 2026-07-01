#!/usr/bin/env bash
# ============================================================
#  Sistema de Gestão - Loja 4 Irmãos
#  Este script sobe TUDO com um comando só.
#  Use assim, no terminal, dentro da pasta do projeto:
#     ./start.sh
# ============================================================
set -euo pipefail

# Vai para a pasta onde este script está (raiz do projeto)
cd "$(dirname "$0")"

echo "======================================================"
echo "  Iniciando o sistema da loja 4 Irmãos..."
echo "======================================================"

# 1) Verifica se as ferramentas necessárias existem
for cmd in node docker supabase; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "❌ '$cmd' não está instalado. Instale antes de continuar."
    exit 1
  fi
done

# 2) Instala as dependências (só na primeira vez)
if [ ! -d "node_modules" ]; then
  echo "📦 Instalando dependências (primeira vez, pode demorar um pouco)..."
  npm install
fi

# 3) Sobe o banco de dados (Supabase). Se já estiver rodando, apenas segue.
echo "🗄️  Subindo o banco de dados (Supabase)..."
supabase start >/dev/null 2>&1 || supabase start

# 4) Aplica as tabelas/atualizações do banco
echo "🔧 Atualizando as tabelas do banco..."
( cd apps/api && npx prisma migrate deploy && npx prisma generate >/dev/null 2>&1 )

# 5) Sobe API (segundo plano), encaminhador HTTPS p/ celular (se houver certificado)
#    e a interface web (primeiro plano).

# Descobre o IP desta máquina na rede da loja (para acesso pelo celular)
IP_LOJA=$(ip route get 1.1.1.1 2>/dev/null | grep -oP 'src \K[\d.]+' || echo "SEU_IP")

echo ""
echo "======================================================"
echo "  ✅ Tudo pronto!"
echo "  • No computador:      http://127.0.0.1:5173"
echo "  • Painel do banco:    http://127.0.0.1:55323"
if [ -f apps/web/certs/cert.pem ]; then
  echo "  • No celular (rede):  https://$IP_LOJA:5443"
  echo "    (a câmera no celular precisa do certificado instalado — veja o README)"
fi
echo ""
echo "  Para parar: aperte Ctrl+C aqui e depois rode ./stop.sh"
echo "======================================================"
echo ""

# Inicia a API em segundo plano
npm run dev -w @quatro-irmaos/api &
API_PID=$!

# Inicia o encaminhador HTTPS para o celular (só age se houver certificado)
node apps/web/https-proxy.mjs &
PROXY_PID=$!

# Ao encerrar (Ctrl+C), derruba também a API e o encaminhador
trap 'kill $API_PID $PROXY_PID 2>/dev/null' EXIT INT TERM

# Inicia a interface web (fica em primeiro plano)
npm run dev -w @quatro-irmaos/web
