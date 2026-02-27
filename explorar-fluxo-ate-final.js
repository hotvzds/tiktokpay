/**
 * Fluxo completo no site original: preenche CPF + Chave PIX (quando existir), Enviar, e captura a tela APÓS.
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

async function capturar(page, nome) {
  await page.screenshot({ path: path.join(OUT_DIR, nome + '.png'), fullPage: true });
  fs.writeFileSync(path.join(OUT_DIR, nome + '.html'), await page.content(), 'utf8');
  console.log('  Salvo:', nome + '.png', nome + '.html');
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
    console.log('1. Abrindo e aguardando VER MEU SALDO...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForSelector('text=VER MEU SALDO', { timeout: MAX_WAIT_MS, state: 'visible' });
    await page.locator('text=VER MEU SALDO').first().click();
    await page.waitForTimeout(2000);

    console.log('2. Obrigado...');
    await page.locator('text=Obrigado').first().click();
    await page.waitForTimeout(1500);

    console.log('3. Sacar...');
    await page.locator('button:has-text("Sacar")').first().click();
    await page.waitForTimeout(3000);

    console.log('4. Sacar dinheiro (card)...');
    await page.locator('button:has-text("Sacar dinheiro")').first().click({ force: true });
    await page.waitForTimeout(2500);

    console.log('5. PIX no modal...');
    const modal = page.locator('[class*="fixed"][class*="inset-0"]').first();
    await modal.locator('button:has-text("PIX")').first().click();
    await page.waitForTimeout(2000);

    console.log('5.5. Abrir \"Escolha o tipo de chave PIX\" e selecionar CPF (exatamente como no app)...');
    await page.waitForTimeout(800);
    // 1) Clicar na linha \"Escolha o tipo de chave PIX\" do modal Link PIX
    const triggerTipoGlobal = page.locator('button:has-text(\"Escolha o tipo de chave PIX\")').first();
    await triggerTipoGlobal.click({ timeout: 6000 }).catch(async () => {
      // fallback: clicar em qualquer elemento que contenha esse texto
      await page.locator('text=Escolha o tipo de chave PIX').first().click({ timeout: 6000 }).catch(() => {});
    });
    await page.waitForTimeout(800);

    // 2) Bottom sheet \"Tipo de Chave PIX\" (lista: CPF / Telefone / E-mail / Chave aleatória)
    const sheet = page
      .locator('div[class*=\"fixed\"][class*=\"inset-0\"]')
      .filter({ hasText: 'Tipo de Chave PIX' })
      .last();
    await sheet.waitFor({ state: 'visible', timeout: 6000 }).catch(() => {});

    // 3) Clicar na opção CPF dentro da lista
    const opcaoCPF = sheet.locator('text=CPF').first();
    await opcaoCPF.click({ timeout: 6000 }).catch(async () => {
      await page.locator('text=CPF').last().click({ timeout: 6000 }).catch(() => {});
    });
    await page.waitForTimeout(1500);

    console.log('6. Preencher Chave PIX (campo da chave) com CPF...');
    const inputs = await page.locator('[class*="fixed"] input[type="text"], [class*="fixed"] input[type="tel"], [class*="fixed"] input:not([type="hidden"])').all();
    for (const input of inputs) {
      try {
        await input.fill(CPF, { timeout: 2000 });
        await page.waitForTimeout(300);
      } catch (_) {}
    }
    await page.waitForTimeout(1000);
    await capturar(page, 'fluxo_antes_enviar');

    console.log('7. Clicar Enviar...');
    await page.locator('button:has-text("Enviar")').first().click({ force: true, timeout: 5000 }).catch(() =>
      page.evaluate(() => {
        const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent.trim() === 'Enviar');
        if (b) b.click();
      })
    );
    await page.waitForTimeout(5000);
    await capturar(page, 'fluxo_apos_enviar'); // página de confirmação de identidade / taxa

    console.log('8. Aguardar possível animação/spinner...');
    await page.waitForTimeout(3000);
    await capturar(page, 'fluxo_tela_final'); // ainda mesma página, só para registro

    console.log('9. Clicar \"Pagar taxa para Liberar Saque\" e capturar próxima página...');
    const btnTaxa = await page.locator('button:has-text(\"Pagar taxa para Liberar Saque\")').first();
    await btnTaxa.click({ timeout: 10000 }).catch(() =>
      page.evaluate(() => {
        const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent.includes('Pagar taxa'));
        if (b) b.click();
      })
    );
    await page.waitForTimeout(7000);
    await capturar(page, 'fluxo_apos_pagar_taxa');

    console.log('\nConcluído. Arquivos em', OUT_DIR);
  } catch (err) {
    console.error(err);
    await capturar(page, 'fluxo_erro').catch(() => {});
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
