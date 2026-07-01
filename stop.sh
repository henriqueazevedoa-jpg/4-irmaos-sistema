#!/usr/bin/env bash
# Para o banco de dados (Supabase) deste projeto.
# O servidor da API você para com Ctrl+C na janela onde ele está rodando.
set -euo pipefail
cd "$(dirname "$0")"

echo "🛑 Parando o banco de dados (Supabase)..."
supabase stop
echo "✅ Parado."
