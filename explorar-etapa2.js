/**
 * Explora a próxima etapa do premiaon.vercel.app após clicar em VER MEU SALDO DISPONÍVEL
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://premiaon.vercel.app';
const OUT_DIR = path.join(__dirname, 'clones', 'premiaon.vercel.app');
const VIEWPORT_W = 447;
const VIEWPORT_H = 708;
const MOBILE_UA = 'Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

async function main() {
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({
    viewport: { width: VIEWPORT_W, height: VIEWPORT_H },
    userAgent: MOBILE_UA,
    locale: 'pt-BR',
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();

  const MAX_WAIT_MS = 2 * 60 * 1000 + 30 * 1000; // 2 minutos e 30 segundos

  console.log('Abrindo', BASE_URL);
  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 60000 });

  console.log('Aguardando botão "VER MEU SALDO DISPONÍVEL" (máx. 2min 30s)...');
  const btn = await page.waitForSelector('text=VER MEU SALDO', { timeout: MAX_WAIT_MS, state: 'visible' });
  if (btn) {
    await btn.click();
    console.log('Botão clicado.');
  }

  await page.waitForTimeout(3000);

  const url = page.url();
  console.log('URL após clique:', url);

  await page.screenshot({ path: path.join(OUT_DIR, 'etapa2.png'), fullPage: true });
  console.log('Screenshot: etapa2.png');

  const html = await page.content();
  fs.writeFileSync(path.join(OUT_DIR, 'etapa2.html'), html, 'utf8');
  console.log('HTML: etapa2.html');

  await browser.close();
  console.log('Concluído.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
