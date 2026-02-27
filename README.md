# Clonador de SaaS

Clona sites em **modo mobile** com Playwright: abre a URL, espera o carregamento e salva HTML + screenshot. Cada site clonado ganha uma pasta em `clones/<hostname>/` com todo o fluxo; a raiz do projeto fica só com os scripts.

## Pré-requisito

```bash
npm install
npx playwright install
```

(Se os browsers do Playwright ainda não estiverem instalados.)

## Uso

**Por argumentos (uma ou mais URLs):**

```bash
npm run clonar -- https://exemplo.com
npm run clonar -- https://a.com https://b.com
```

**Por arquivo:**

Crie `urls.txt` na raiz do projeto com uma URL por linha e execute:

```bash
npm run clonar
```

**Modo headless (sem abrir janela):**

```bash
npm run clonar -- --headless https://exemplo.com
npm run clonar:headless
```

(Com `clonar:headless` você ainda pode passar URLs ou usar `urls.txt`.)

## Onde ficam os arquivos

- Toda saída fica em **`clones/`**.
- Cada site tem sua pasta: **`clones/<hostname>/`** (ex.: `clones/exemplo.com/`).
- Dentro da pasta: `index.html` (HTML completo) e `screenshot.png` (captura full page).

A raiz do projeto contém apenas `package.json`, `clonar.js`, `README.md` e, opcionalmente, `urls.txt`.
