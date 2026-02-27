/**
 * Percorre o fluxo completo: VER MEU SALDO -> Obrigado -> Sacar -> preenche CPF (env CPF_TESTE) -> até o final
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://premiaon.vercel.app';
const OUT_DIR = path.join(__dirname, 'clones', 'premiaon.vercel.app');
const CPF = process.env.CPF_TESTE || '';
const CPF_FORMATTED = CPF; // usar mesmo valor; formatação pode ser aplicada no script se necessário
const VIEWPORT_W = 447;
const VIEWPORT_H = 708;
const MOBILE_UA = 'Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
const MAX_WAIT_BTN_MS = 2 * 60 * 1000 + 30 * 1000;

let stepNum = 0;

function saveStep(page, prefix) {
  return (async () => {
    stepNum++;
    const name = `${prefix}_${String(stepNum).padStart(2, '0')}`;
    await page.screenshot({ path: path.join(OUT_DIR, name + '.png'), fullPage: true });
    const html = await page.content();
    fs.writeFileSync(path.join(OUT_DIR, name + '.html'), html, 'utf8');
    console.log('  Salvo:', name + '.png', name + '.html');
  })();
}

async function fillCpfIfPresent(page) {
  const cpfSelectors = [
    'input[name*="cpf"]', 'input[id*="cpf"]', 'input[placeholder*="CPF"]', 'input[placeholder*="cpf"]',
    'input[placeholder*="000.000.000"]', 'input[placeholder*="000000000"]', 'input[name*="document"]'
  ];
  for (const sel of cpfSelectors) {
    const el = await page.$(sel);
    if (el) {
      const name = await el.getAttribute('name') || await el.getAttribute('id') || '';
      const placeholder = await el.getAttribute('placeholder') || '';
      if (name.toLowerCase().includes('cpf') || name.toLowerCase().includes('document') || sel.includes('cpf') ||
          placeholder.toUpperCase().includes('CPF') || placeholder.includes('000.000.000')) {
        await el.fill(CPF_FORMATTED);
        console.log('  CPF preenchido:', CPF_FORMATTED);
        return true;
      }
    }
  }
  const modal = page.locator('[class*="fixed"][class*="inset-0"]').first();
  if (await modal.isVisible().catch(() => false)) {
    const cpfInput = modal.locator('input[placeholder*="000.000.000"], input[inputmode="numeric"]').first();
    if (await cpfInput.isVisible().catch(() => false)) {
      const val = await cpfInput.inputValue();
      if (!val || val.replace(/\D/g, '').length < 11) {
        await cpfInput.fill(CPF_FORMATTED);
        console.log('  CPF preenchido (campo no modal):', CPF_FORMATTED);
        return true;
      }
    }
  }
  return false;
}

async function clickInsideModal(page) {
  const modal = page.locator('[class*="fixed"][class*="inset-0"]').first();
  if (await modal.isVisible().catch(() => false)) {
    const enviar = modal.locator('button:has-text("Enviar")').first();
    if (await enviar.isVisible().catch(() => false)) {
      try {
        await enviar.click({ force: true, timeout: 5000 });
      } catch (_) {
        await page.evaluate(() => {
          const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Enviar'));
          if (btn) btn.click();
        });
      }
      console.log('  Clique: Enviar (modal)');
      return true;
    }
    const pixBtn = modal.locator('button:has-text("PIX")').first();
    if (await pixBtn.isVisible().catch(() => false)) {
      await pixBtn.click();
      console.log('  Clique: PIX (dentro do modal)');
      return true;
    }
    const obrigado = modal.locator('button:has-text("Obrigado")').first();
    if (await obrigado.isVisible().catch(() => false)) {
      await obrigado.click();
      console.log('  Clique: Obrigado');
      return true;
    }
  }
  return false;
}

async function clickNextButton(page) {
  const clickedModal = await clickInsideModal(page);
  if (clickedModal) return true;

  const texts = ['Continuar', 'Confirmar', 'Enviar', 'Avançar', 'Próximo', 'OK', 'Concluir', 'Finalizar', 'Receber'];
  for (const t of texts) {
    const btn = page.locator(`button:has-text("${t}"), a:has-text("${t}")`).first();
    if (await btn.isVisible().catch(() => false)) {
      await btn.click({ force: true });
      console.log('  Clique:', t);
      return true;
    }
  }
  const sacarDinheiro = page.locator('button:has-text("Sacar dinheiro")').first();
  if (await sacarDinheiro.isVisible().catch(() => false)) {
    await sacarDinheiro.click({ force: true });
    console.log('  Clique: Sacar dinheiro');
    return true;
  }
  const anySubmit = await page.$('button[type="submit"], input[type="submit"]');
  if (anySubmit) {
    await anySubmit.click();
    console.log('  Clique: submit');
    return true;
  }
  return false;
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
    console.log('1. Abrindo', BASE_URL);
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 60000 });

    console.log('2. Aguardando botão VER MEU SALDO (máx. 2min 30s)...');
    const btnSaldo = await page.waitForSelector('text=VER MEU SALDO', { timeout: MAX_WAIT_BTN_MS, state: 'visible' });
    await btnSaldo.click();
    console.log('   Clique VER MEU SALDO.');
    await page.waitForTimeout(2000);

    console.log('3. Fechando modal Gol de Prêmios (Obrigado)...');
    const btnObrigado = await page.waitForSelector('text=Obrigado', { timeout: 15000, state: 'visible' }).catch(() => null);
    if (btnObrigado) {
      await btnObrigado.click();
      await page.waitForTimeout(1500);
    }

    console.log('4. Clicando Sacar...');
    const btnSacar = await page.locator('button:has-text("Sacar")').first();
    await btnSacar.click();
    await page.waitForTimeout(3000);

    await saveStep(page, 'sacar');

    let maxSteps = 30;
    while (maxSteps-- > 0) {
      const filled = await fillCpfIfPresent(page);
      if (filled) {
        await page.waitForTimeout(1500);
        await saveStep(page, 'sacar');
      }

      let clicked = false;
      try {
        clicked = await clickNextButton(page);
      } catch (e) {
        console.log('  Timeout no clique, salvando e continuando...');
        await saveStep(page, 'sacar');
      }
      if (!clicked) {
        console.log('  Nenhum botão de próximo encontrado. Fim do fluxo.');
        await page.waitForTimeout(1500);
        await saveStep(page, 'sacar');
        break;
      }
      await page.waitForTimeout(3000);
      await saveStep(page, 'sacar');
    }

    console.log('Concluído. Arquivos em', OUT_DIR);
  } catch (err) {
    console.error(err);
    await saveStep(page, 'sacar').catch(() => {});
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
