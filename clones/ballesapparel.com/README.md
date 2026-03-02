# Camisas Brasil — Clone remodelado

Clone do [ballesapparel.com](https://www.ballesapparel.com) remodelado para projeto de **vendas de camisas do Brasil**.

## Conteúdo

- **index.html** — Página principal com imagens locais
- **assets/images/** — 247 imagens de produtos, carrossel e logo
- **screenshot.png** — Captura da página

## Como foi gerado

```bash
npm run explorar:ballesapparel   # Playwright + download de imagens
node fix-ballesapparel-paths.js  # Corrige paths no HTML
```

## Alterações feitas

- Marca: **Balles Apparel** → **Camisas Brasil**
- Imagens com paths locais (`./assets/images/...`)
- Links de navegação apontam para `#`
- Meta tags e descrições ajustadas

## Observações

- O site original usa Tiendanube; o CSS principal ainda vem de CDN externo.
- Para rodar offline completo, faça download do CSS em `assets/` e atualize os `<link>`.
