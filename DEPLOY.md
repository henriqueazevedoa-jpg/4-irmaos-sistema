# Guia de publicação (colocar o sistema na nuvem)

Este guia coloca o sistema no ar **de graça**, acessível de qualquer lugar, com HTTPS automático (a câmera do celular funciona direto).

Usaremos:
- **GitHub** — guarda o código (e o Render publica a partir dele).
- **Supabase (nuvem)** — banco de dados, com painel visual e backups.
- **Render** — roda o sistema (não pede cartão no plano grátis).

> ⚠️ **Sobre o plano grátis do Render:** o sistema "dorme" após ~15 minutos sem uso e leva ~30–60 segundos para acordar no primeiro acesso. Para uma loja usando o dia todo, isso quase não incomoda; se quiser que fique sempre instantâneo, dá para migrar para o plano pago (~US$ 7/mês) depois.

---

## Passo 1 — Código no GitHub

1. Crie uma conta em https://github.com (se ainda não tiver).
2. Crie um repositório **novo e vazio** (ex.: `4-irmaos-gestao`), **privado**. Não marque nada (sem README).
3. Me avise o endereço do repositório — eu envio o código para lá com você (ou você roda os comandos que eu te passar).

---

## Passo 2 — Banco de dados no Supabase (nuvem)

1. Crie uma conta em https://supabase.com e clique em **New project**.
2. Dê um nome (ex.: `4-irmaos`), **crie uma senha forte para o banco e guarde-a**, e escolha a região mais próxima (ex.: São Paulo).
3. Espere alguns minutos até o projeto ficar pronto.
4. Clique no botão **Connect** (no topo). Você vai precisar de duas conexões (ambas do **pooler**):
   - **Transaction pooler** (porta **6543**) → será a `DATABASE_URL` (adicione `?pgbouncer=true` no final).
   - **Session pooler** (porta **5432**, mesmo endereço `...pooler.supabase.com`) → será a `DIRECT_URL`.
   - Em ambas, troque `[YOUR-PASSWORD]` pela senha que você criou.
   - ⚠️ **Não** use a "Direct connection" (`db.SEU_PROJETO.supabase.co`): no plano grátis ela é só IPv6 e não funciona a partir do Render.
5. Vá em **Project Settings → API** e anote a **Project URL** e as chaves (**anon** e **service_role**).

*(Referência dos valores: `apps/api/.env.production.example`.)*

---

## Passo 3 — Publicar no Render

1. Crie uma conta em https://render.com (pode entrar com o GitHub).
2. **New + → Blueprint** e selecione o repositório do Passo 1. O Render vai ler o arquivo `render.yaml` automaticamente.
3. Ele vai pedir as variáveis marcadas como secretas. Preencha:
   - `DATABASE_URL` → a do **pooler (6543)** com `?pgbouncer=true`
   - `DIRECT_URL` → a **direta (5432)**
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY` → do Passo 2.5
4. Clique em **Apply / Create**. O Render vai instalar, compilar e publicar.
   - Na primeira vez, ele **cria as tabelas** no banco automaticamente.
5. Quando terminar, o Render te dá um endereço tipo `https://quatro-irmaos-gestao.onrender.com`. **Esse é o sistema!** Abra no navegador (e no celular).

---

## Passo 4 (opcional) — Dados de exemplo

O banco começa **vazio** (sem os dados de teste). Para popular com exemplos, me avise que eu te passo o comando (ou fazemos os primeiros cadastros direto na tela).

---

## Como atualizar o sistema depois

Toda vez que fizermos melhorias, é só enviar as mudanças para o GitHub — o Render **republica sozinho**. Você não precisa fazer nada manual.

---

## Sobre a câmera no celular na nuvem

Com o sistema na nuvem, o endereço já é **https://** (seguro), então a **câmera do celular funciona direto**, sem o passo do certificado que usamos na rede local.
