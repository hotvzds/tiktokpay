/**
 * Clonador de SaaS — abre sites em modo mobile (Playwright) e salva HTML + screenshot.
 * Uma pasta por site em clones/<hostname>/ com todo o fluxo. Raiz fica só com o script.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const CLONES_DIR = path.join(__dirname, 'clones');
const WAIT_AFTER_LOAD_MS = 5000;
const VIEWPORT_W = 447;
const VIEWPORT_H = 708;
const MOBILE_UA = 'Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

function getUrlsFromArgs() {
  const args = process.argv.slice(2).filter((a) => a !== '--headless');
  return args.filter((a) => a.startsWith('http://') || a.startsWith('https://'));
}

function getUrlsFromFile() {
  const urlsPath = path.join(__dirname, 'urls.txt');
  if (!fs.existsSync(urlsPath)) return [];
  const content = fs.readFileSync(urlsPath, 'utf8');
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && (line.startsWith('http://') || line.startsWith('https://')));
}

function hostnameFromUrl(url) {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '') || 'site';
  } catch {
    return 'site';
  }
}

function sanitizeDirName(name) {
  return name.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '_') || 'site';
}

function printUsage() {
  console.log(`
Uso:
  node clonar.js <url1> [url2] ...
  node clonar.js --headless <url1> [url2] ...

Ou crie um arquivo urls.txt (uma URL por linha) e execute:
  node clonar.js
  node clonar.js --headless

Saída: clones/<hostname>/index.html e clones/<hostname>/screenshot.png
`);
}

async function cloneUrl(page, url, outDir) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(WAIT_AFTER_LOAD_MS);

  const html = await page.evaluate(() => document.documentElement.outerHTML);
  fs.writeFileSync(path.join(outDir, 'index.html'), html, 'utf8');
  console.log('  index.html', (html.length / 1024).toFixed(1), 'KB');

  await page.screenshot({ path: path.join(outDir, 'screenshot.png'), fullPage: true });
  console.log('  screenshot.png');
}

async function main() {
  let urls = getUrlsFromArgs();
  if (urls.length === 0) urls = getUrlsFromFile();
  if (urls.length === 0) {
    printUsage();
    process.exit(1);
  }

  const headless = process.argv.includes('--headless');

  if (!fs.existsSync(CLONES_DIR)) fs.mkdirSync(CLONES_DIR, { recursive: true });

  const browser = await chromium.launch({
    headless,
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

  for (const url of urls) {
    const hostname = hostnameFromUrl(url);
    const dirName = sanitizeDirName(hostname);
    const outDir = path.join(CLONES_DIR, dirName);

    console.log('\nClonando:', url, '->', path.join('clones', dirName));

    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    try {
      await cloneUrl(page, url, outDir);
    } catch (err) {
      console.error('  Erro:', err.message);
    }
  }

  await browser.close();
  console.log('\nConcluído. Saída em:', CLONES_DIR);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
