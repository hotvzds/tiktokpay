# Clone — premiaon.vercel.app (TikTok Bônus)

Clone estático do fluxo de "verificação de saldo" do site original.

## Conteúdo

- **index.html** — Página clonada: mesma estrutura visual, animação de progresso (etapas → OK, barra 0→100%), assets locais.
- **assets/** — CSS (Tailwind/Next), fontes (Geist), ícones (favicon, apple-touch).
- **step_01.png … step_10.png** — Screenshots do fluxo capturados com Playwright.
- **step_01.html … step_10.html** — HTML de cada etapa da exploração.

## Como ver o clone

Abra `index.html` no navegador (duplo clique ou `npx serve .` na pasta do clone). A animação das etapas e da barra de progresso roda automaticamente.

## Deploy na Vercel (só este projeto, sem scripts da raiz)

1. No painel da Vercel, ao importar o repositório, defina **Root Directory** como:
   ```text
   clones/premiaon.vercel.app
   ```
   Assim só esta pasta será deployada (nenhum script da raiz como `clonar.js`, `explorar-*.js` sobe).

2. Em **Settings → Environment Variables** adicione:
   - `GHOSTSPAY_SECRET_KEY` — chave da API GhostsPays
   - `GHOSTSPAY_COMPANY_ID` — Company ID da GhostsPays
   - (opcional) `GHOSTSPAY_POSTBACK_URL` — URL do webhook para notificações de pagamento

3. Deploy: a Vercel vai servir os arquivos estáticos (index.html, saldo.html, etc.) e as rotas:
   - `POST /api/ghostspay/pix-taxa` — cria pagamento PIX da taxa
   - `GET /api/ghostspay/transactions/[id]` — consulta status da transação

## Observação

O site original não exibe formulário de CPF na primeira tela; o fluxo começa direto na tela "Seu saldo está sendo calculado" com a verificação em andamento. O vídeo (ConverteAI/smartplayer) foi substituído por um placeholder de loading estático.
