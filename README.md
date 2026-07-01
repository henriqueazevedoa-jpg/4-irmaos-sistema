# Sistema de Gestão — Loja 4 Irmãos

Sistema para gerenciar a loja de materiais de construção e diversos: **estoque, entrada de mercadoria por nota fiscal (XML ou foto), fornecedores, clientes, vendas e conta do cliente (fiado)**. No futuro, emissão fiscal ligada à Receita.

---

## ▶️ Como rodar (passo a passo)

Você precisa ter instalado: **Node.js**, **Docker** e o **Supabase CLI** (já estão na sua máquina).

Abra o terminal, entre na pasta do projeto e rode **um comando só**:

```bash
./start.sh
```

Esse comando sobe o banco de dados, prepara as tabelas, liga o servidor e abre a interface. Quando aparecer **"Tudo pronto!"**, o sistema está no ar.

Abra no navegador:

- **🖥️ O sistema (use por aqui):** http://127.0.0.1:5173
- **Painel do banco de dados (ver/editar dados por fora):** http://127.0.0.1:55323

Para **parar**:

- O servidor: aperte `Ctrl + C` na janela do terminal.
- O banco de dados: rode `./stop.sh`.

---

## 🧭 O que já existe

- ✅ Banco de dados PostgreSQL (via Supabase) com **login e armazenamento de arquivos** prontos.
- ✅ Modelo de dados completo: produtos, estoque (com histórico de movimentos), fornecedores, clientes, notas de entrada, vendas e conta corrente do cliente.
- ✅ Servidor (API) em funcionamento, com dados de exemplo para teste.
- ✅ **Interface web** com painel inicial e **cadastros de produtos, fornecedores e clientes** (buscar, criar, editar e inativar).
- ✅ **Entrada de mercadoria por XML da NF-e**: importa a nota, reconhece o fornecedor pelo CNPJ, casa itens com produtos pelo código de barras, permite vincular/criar produtos e dá entrada no estoque com histórico de movimentos.
- ✅ **Vendas (PDV) + conta do cliente (fiado)**: registra a venda, dá baixa no estoque, aceita as formas de pagamento (dinheiro, PIX, cartão, fiado…), controla o fiado com limite de crédito, permite cancelar (estorna estoque e fiado) e registrar pagamentos do cliente com extrato.

## 🗺️ Próximas etapas (roadmap)

1. ~~**Cadastros** — telas de fornecedores, clientes e produtos.~~ ✅ **feito**
2. ~~**Entrada por nota fiscal (XML)** — ler o XML da NF-e e dar entrada no estoque.~~ ✅ **feito**
3. ~~**Vendas + conta do cliente (fiado)** — venda de balcão, pagamentos e fiado.~~ ✅ **feito**
4. **PDV offline** — deixar a venda funcionar sem internet e sincronizar depois (a base de dados já está preparada para isso).
5. **Entrada por foto da nota** — quando não houver o XML, ler a nota a partir de uma foto.
6. **Relatórios** — estoque baixo, vendas do dia, contas a receber.
7. **Emissão fiscal** — integração com serviço homologado (fase posterior).

---

## 🧱 Como o projeto é organizado

```
4-irmãos-gestão/
├── apps/
│   ├── api/          → servidor do sistema (regras de negócio)
│   │   ├── prisma/   → modelo do banco de dados e migrações
│   │   └── src/      → código do servidor
│   └── web/          → interface visual (a construir)
├── supabase/         → configuração do banco/login/arquivos
├── start.sh          → sobe tudo com um comando
└── stop.sh           → para o banco de dados
```

## 🛠️ Tecnologias

- **Banco/Login/Arquivos:** Supabase (PostgreSQL)
- **Servidor:** Node.js + Fastify + Prisma (TypeScript)
- **Interface:** React + Vite + Mantine (uso offline no balcão virá na fase de vendas/PDV)

---

## ℹ️ Detalhes técnicos

- As portas locais do Supabase deste projeto usam a faixa **55xxx** (API `55321`, banco `55322`, painel `55323`) para **não conflitar** com outros projetos Supabase na mesma máquina.
- As configurações locais (senhas de teste) ficam em `apps/api/.env`, que **não** é enviado ao Git. O modelo está em `apps/api/.env.example`.
- Para abrir uma visão de tabelas via Prisma: `npm run prisma:studio -w @quatro-irmaos/api`.
