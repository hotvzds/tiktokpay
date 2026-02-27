/**
 * Explora o fluxo completo de premiaon.vercel.app:
 * - Navega por todas as telas
 * - Preenche CPF onde solicitado (11238990533)
 * - Screenshot a cada etapa
 * - Salva HTML de cada etapa
 * - Baixa mídias (imagens, fontes, CSS)
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');

const BASE_URL = 'https://premiaon.vercel.app';
const CPF = '11238990533';
const OUT_DIR = path.join(__dirname, 'clones', 'premiaon.vercel.app');
const VIEWPORT_W = 447;
const VIEWPORT_H = 708;
const MOBILE_UA = 'Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

let stepIndex = 0;
const downloadedUrls = new Set();

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function stepName() {
  return `step_${String(stepIndex).padStart(2, '0')}`;
}

async function screenshot(page, name) {
  const file = path.join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log('  Screenshot:', file);
}

async function saveHtml(page, name) {
  const html = await page.evaluate(() => document.documentElement.outerHTML);
  const file = path.join(OUT_DIR, `${name}.html`);
  fs.writeFileSync(file, html, 'utf8');
  console.log('  HTML:', file);
}

function downloadAsset(url, baseDir) {
  return new Promise((resolve) => {
    if (downloadedUrls.has(url)) return resolve();
    downloadedUrls.add(url);

    try {
      const u = new URL(url);
      const dir = path.join(baseDir, u.pathname.replace(/^\//, '').replace(/\/[^/]+$/, ''));
      const file = path.join(baseDir, u.pathname.replace(/^\//, '').replace(/\?.*$/, ''));
      if (!file || file.endsWith('/')) return resolve();

      ensureDir(dir);

      const protocol = u.protocol === 'https:' ? https : http;
      const req = protocol.get(url, { headers: { 'User-Agent': MOBILE_UA } }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          downloadAsset(res.headers.location, baseDir).then(resolve);
          return;
        }
        const stream = fs.createWriteStream(file);
        res.pipe(stream);
        stream.on('finish', () => {
          stream.close();
          console.log('  Baixado:', u.pathname);
          resolve();
        });
      });
      req.on('error', () => resolve());
      req.setTimeout(10000, () => { req.destroy(); resolve(); });
    } catch {
      resolve();
    }
  });
}

async function extractAndDownloadAssets(html, baseUrl, assetsDir) {
  const base = new URL(baseUrl);
  const urls = new Set();

  // Imagens
  const imgRegex = /<(?:img|source)[^>]+(?:src|srcset)=["']([^"']+)["']/gi;
  let m;
  while ((m = imgRegex.exec(html)) !== null) urls.add(m[1]);

  // srcset com múltiplas URLs
  const srcsetRegex = /srcset=["']([^"']+)["']/gi;
  while ((m = srcsetRegex.exec(html)) !== null) {
    m[1].split(',').forEach((s) => urls.add(s.trim().split(/\s+/)[0]));
  }

  // CSS
  const linkRegex = /<link[^>]+href=["']([^"']+\.css[^"']*)["']/gi;
  while ((m = linkRegex.exec(html)) !== null) urls.add(m[1]);

  // Scripts (opcional, para referência)
  const scriptRegex = /<script[^>]+src=["']([^"']+)["']/gi;
  while ((m = scriptRegex.exec(html)) !== null) urls.add(m[1]);

  for (const ref of urls) {
    const absolute = ref.startsWith('http') ? ref : new URL(ref, base).href;
    if (absolute.startsWith(base.origin) || absolute.includes('vercel') || absolute.startsWith('https://') || absolute.startsWith('http://')) {
      await downloadAsset(absolute, assetsDir);
    }
  }
}

async function main() {
  ensureDir(OUT_DIR);
  const assetsDir = path.join(OUT_DIR, 'assets');
  ensureDir(assetsDir);

  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-blink-features=AutomationControlled'],
    ignoreDefaultArgs: ['--enable-automation'],
  });

  const ctx = await browser.newContext({
    viewport: { width: VIEWPORT_W, height: VIEWPORT_H },
    userAgent: MOBILE_UA,
    locale: 'pt-BR',
    isMobile: true,
    hasTouch: true,
  });

  const page = await ctx.newPage();

  // Interceptar requisições para listar recursos
  const allResources = [];
  page.on('response', async (response) => {
    const url = response.url();
    if (!url.startsWith('data:')) allResources.push(url);
  });

  console.log('\n--- Etapa 1: Página inicial ---');
  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2000);

  stepIndex = 1;
  await screenshot(page, stepName());
  let html = await page.evaluate(() => document.documentElement.outerHTML);
  await saveHtml(page, stepName());

  // Procurar campo CPF / input e preencher
  const cpfInput = await page.$('input[type="text"], input[name*="cpf"], input[name*="CPF"], input[id*="cpf"], input[placeholder*="CPF"], input[placeholder*="cpf"]');
  if (cpfInput) {
    await cpfInput.fill(CPF);
    await page.waitForTimeout(500);
    stepIndex = 2;
    await screenshot(page, stepName());
    await saveHtml(page, stepName());

    const submitBtn = await page.$('button[type="submit"], input[type="submit"], button:has-text("Continuar"), button:has-text("Enviar"), a:has-text("Continuar")');
    if (submitBtn) {
      await submitBtn.click();
      await page.waitForTimeout(3000);
      stepIndex = 3;
      await screenshot(page, stepName());
      await saveHtml(page, stepName());
    }
  }

  // Aguardar animação da "verificação" (até 30s) e capturar estados intermediários
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(5000);
    stepIndex = 4 + i;
    await screenshot(page, stepName());
    await saveHtml(page, stepName());
  }

  // Última tela (fluxo pode ter terminado)
  await page.waitForTimeout(5000);
  stepIndex = 10;
  await screenshot(page, stepName());
  await saveHtml(page, stepName());

  // Salvar lista de recursos e baixar assets do HTML final
  fs.writeFileSync(path.join(OUT_DIR, 'resources.txt'), allResources.join('\n'), 'utf8');
  const lastHtml = fs.readFileSync(path.join(OUT_DIR, 'step_10.html'), 'utf8');
  await extractAndDownloadAssets(lastHtml, BASE_URL, assetsDir);

  // Baixar assets de todos os HTMLs
  const htmlFiles = fs.readdirSync(OUT_DIR).filter((f) => f.endsWith('.html'));
  for (const f of htmlFiles) {
    const content = fs.readFileSync(path.join(OUT_DIR, f), 'utf8');
    await extractAndDownloadAssets(content, BASE_URL, assetsDir);
  }

  await browser.close();
  console.log('\nExploração concluída. Arquivos em:', OUT_DIR);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
