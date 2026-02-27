/**
 * Percorre TODO o fluxo no site original (premiaon.vercel.app) e captura cada tela.
 * Apoio total na página que estamos clonando para ver cada etapa.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://premiaon.vercel.app';
const OUT_DIR = path.join(__dirname, 'clones', 'premiaon.vercel.app');
const CPF = '112.389.905-33';
const VIEWPORT_W = 447;
const VIEWPORT_H = 708;
const MOBILE_UA = 'Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
const MAX_WAIT_MS = 2 * 60 * 1000 + 30 * 1000;

let step = 0;

async function capturar(page, nome) {
  step++;
  const id = String(step).padStart(2, '0');
  const base = nome || 'fluxo_' + id;
  await page.screenshot({ path: path.join(OUT_DIR, base + '.png'), fullPage: true });
  const html = await page.content();
  fs.writeFileSync(path.join(OUT_DIR, base + '.html'), html, 'utf8');
  console.log('  [' + id + '] Salvo:', base + '.png', base + '.html');
}

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

  try {
    console.log('--- Etapa 1: Página inicial ---');
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(2000);
    await capturar(page, 'fluxo_01_inicial');

    console.log('--- Etapa 2: Aguardando VER MEU SALDO (máx. 2min 30s) ---');
    const btnSaldo = await page.waitForSelector('text=VER MEU SALDO', { timeout: MAX_WAIT_MS, state: 'visible' });
    await btnSaldo.click();
    await page.waitForTimeout(2500);
    await capturar(page, 'fluxo_02_apos_ver_saldo');

    console.log('--- Etapa 3: Fechar modal Gol de Prêmios (Obrigado) ---');
    const btnObrigado = await page.waitForSelector('text=Obrigado', { timeout: 12000, state: 'visible' }).catch(() => null);
    if (btnObrigado) {
      await btnObrigado.click();
      await page.waitForTimeout(2000);
    }
    await capturar(page, 'fluxo_03_apos_obrigado');

    console.log('--- Etapa 4: Clicar Sacar (na página de saldo) ---');
    await page.locator('button:has-text("Sacar")').first().click();
    await page.waitForTimeout(3500);
    await capturar(page, 'fluxo_04_apos_sacar');

    console.log('--- Etapa 5: Clicar Sacar dinheiro (card) ---');
    const btnSacarDinheiro = page.locator('button:has-text("Sacar dinheiro")').first();
    await btnSacarDinheiro.click({ timeout: 8000 }).catch(() => {
      console.log('  (tentando força)');
      return page.evaluate(() => {
        const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent.includes('Sacar dinheiro'));
        if (b) b.click();
      });
    });
    await page.waitForTimeout(2500);
    await capturar(page, 'fluxo_05_modal_metodo_saque');

    console.log('--- Etapa 6: Clicar PIX no modal ---');
    const modal = page.locator('[class*="fixed"][class*="inset-0"]').first();
    const pixBtn = modal.locator('button:has-text("PIX")').first();
    await pixBtn.click({ timeout: 8000 }).catch(() =>
      page.evaluate(() => {
        const m = document.querySelector('[class*="fixed"]');
        if (m) {
          const b = m.querySelector('button');
          if (b && b.textContent.includes('PIX')) b.click();
        }
      })
    );
    await page.waitForTimeout(2500);
    await capturar(page, 'fluxo_06_modal_chave_pix');

    console.log('--- Etapa 7: Preencher CPF ---');
    const cpfInput = page.locator('input[placeholder*="000.000.000"], input[inputmode="numeric"]').first();
    await cpfInput.fill(CPF, { timeout: 5000 });
    await page.waitForTimeout(1500);
    await capturar(page, 'fluxo_07_cpf_preenchido');

    console.log('--- Etapa 8: Clicar Enviar ---');
    const btnEnviar = page.locator('button:has-text("Enviar")').first();
    await btnEnviar.click({ force: true, timeout: 5000 }).catch(() =>
      page.evaluate(() => {
        const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent.trim() === 'Enviar');
        if (b) b.click();
      })
    );
    await page.waitForTimeout(4000);
    await capturar(page, 'fluxo_08_apos_enviar');

    console.log('--- Etapa 9: Aguardar e capturar tela final (possível confirmação) ---');
    await page.waitForTimeout(3000);
    await capturar(page, 'fluxo_09_tela_final');

    console.log('\nConcluído. Todas as telas em:', OUT_DIR);
  } catch (err) {
    console.error('Erro:', err.message);
    await capturar(page, 'fluxo_erro').catch(() => {});
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
