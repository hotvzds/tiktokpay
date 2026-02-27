/**
 * Explora a tela que aparece após apertar o botão Sacar no premiaon.vercel.app
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://premiaon.vercel.app';
const OUT_DIR = path.join(__dirname, 'clones', 'premiaon.vercel.app');
const VIEWPORT_W = 447;
const VIEWPORT_H = 708;
const MOBILE_UA = 'Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
const MAX_WAIT_MS = 2 * 60 * 1000 + 30 * 1000;

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

  console.log('1. Abrindo', BASE_URL);
  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 60000 });

  console.log('2. Aguardando botão VER MEU SALDO (máx. 2min 30s)...');
  const btnSaldo = await page.waitForSelector('text=VER MEU SALDO', { timeout: MAX_WAIT_MS, state: 'visible' });
  await btnSaldo.click();
  console.log('   Clique VER MEU SALDO.');
  await page.waitForTimeout(2000);

  console.log('3. Fechando modal (Obrigado)...');
  const btnObrigado = await page.waitForSelector('text=Obrigado', { timeout: 15000, state: 'visible' }).catch(() => null);
  if (btnObrigado) {
    await btnObrigado.click();
    await page.waitForTimeout(1500);
  }

  console.log('4. Clicando Sacar...');
  const btnSacar = await page.locator('button:has-text("Sacar")').first();
  await btnSacar.click();
  await page.waitForTimeout(3500);

  console.log('5. Capturando tela após o botão de saque...');
  await page.screenshot({ path: path.join(OUT_DIR, 'apos-sacar.png'), fullPage: true });
  const html = await page.content();
  fs.writeFileSync(path.join(OUT_DIR, 'apos-sacar.html'), html, 'utf8');
  console.log('   Salvo: apos-sacar.png, apos-sacar.html');

  await browser.close();
  console.log('Concluído.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
