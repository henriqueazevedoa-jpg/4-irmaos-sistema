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

# 5) Sobe o servidor (API) em segundo plano e a interface (web) na frente.
echo ""
echo "======================================================"
echo "  ✅ Tudo pronto!"
echo "  • Abra no navegador:  http://127.0.0.1:5173"
echo "  • Painel do banco:    http://127.0.0.1:55323"
echo ""
echo "  Para parar: aperte Ctrl+C aqui e depois rode ./stop.sh"
echo "======================================================"
echo ""

# Inicia a API em segundo plano
npm run dev -w @quatro-irmaos/api &
API_PID=$!

# Ao encerrar (Ctrl+C), derruba também a API
trap 'kill $API_PID 2>/dev/null' EXIT INT TERM

# Inicia a interface web (fica em primeiro plano)
npm run dev -w @quatro-irmaos/web
