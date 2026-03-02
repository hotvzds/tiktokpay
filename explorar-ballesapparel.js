/**
 * Explora ballesapparel.com:
 * - Abre em modo desktop (loja precisa de viewport maior)
 * - Faz scroll para carregar imagens lazy
 * - Salva HTML completo
 * - Baixa todas as imagens e atualiza paths no HTML
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');

const BASE_URL = 'https://www.ballesapparel.com';
const OUT_DIR = path.join(__dirname, 'clones', 'ballesapparel.com');
const ASSETS_DIR = path.join(OUT_DIR, 'assets');
const IMAGES_DIR = path.join(ASSETS_DIR, 'images');
const VIEWPORT_W = 1280;
const VIEWPORT_H = 900;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const downloadedUrls = new Map(); // url -> localPath

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function getExtensionFromUrl(url) {
  try {
    const pathname = new URL(url).pathname;
    const ext = path.extname(pathname).toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg', '.avif'].includes(ext)) return ext;
    return '.jpg';
  } catch {
    return '.jpg';
  }
}

function slugFromUrl(url) {
  try {
    const u = new URL(url);
    const base = u.pathname.replace(/^\//, '').replace(/\/$/, '');
    const slug = base.replace(/[^a-zA-Z0-9\-_.]/g, '_').replace(/_+/g, '_').slice(0, 120) || 'img';
    return slug;
  } catch {
    return 'img_' + Math.random().toString(36).slice(2, 10);
  }
}

function downloadAsset(url, destPathNoExt) {
  return new Promise((resolve) => {
    if (downloadedUrls.has(url)) return resolve(downloadedUrls.get(url));

    try {
      const u = new URL(url);
      const ext = getExtensionFromUrl(url);
      const finalPath = destPathNoExt.endsWith(ext) ? destPathNoExt : destPathNoExt + ext;
      ensureDir(path.dirname(finalPath));

      const protocol = u.protocol === 'https:' ? https : http;
      const req = protocol.get(url, { headers: { 'User-Agent': UA } }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          downloadAsset(res.headers.location, destPathNoExt).then(resolve);
          return;
        }
        const stream = fs.createWriteStream(finalPath);
        res.pipe(stream);
        stream.on('finish', () => {
          stream.close();
          const relPath = path.relative(OUT_DIR, finalPath).replace(/\\/g, '/');
          downloadedUrls.set(url, relPath);
          console.log('  Baixado:', relPath);
          resolve(relPath);
        });
      });
      req.on('error', () => resolve(null));
      req.setTimeout(15000, () => {
        req.destroy();
        resolve(null);
      });
    } catch {
      resolve(null);
    }
  });
}

function extractImageUrls(html, baseUrl) {
  const urls = new Set();
  const base = new URL(baseUrl);

  const imgRegex = /<(?:img|source)[^>]+(?:src|srcset)=["']([^"']+)["']/gi;
  let m;
  while ((m = imgRegex.exec(html)) !== null) urls.add(m[1]);

  const srcsetRegex = /srcset=["']([^"']+)["']/gi;
  while ((m = srcsetRegex.exec(html)) !== null) {
    m[1].split(',').forEach((s) => urls.add(s.trim().split(/\s+/)[0]));
  }

  const bgRegex = /url\(["']?([^"')]+)["']?\)/g;
  while ((m = bgRegex.exec(html)) !== null) {
    const u = m[1].trim();
    if (u.startsWith('data:')) continue;
    urls.add(u);
  }

  const linkRegex = /<link[^>]+href=["']([^"']+\.(?:png|jpg|jpeg|webp|gif|svg|avif)[^"']*)["']/gi;
  while ((m = linkRegex.exec(html)) !== null) urls.add(m[1]);

  const result = [];
  for (const ref of urls) {
    try {
      const absolute = ref.startsWith('http') ? ref : new URL(ref, base).href;
      if (absolute.startsWith('https://') || absolute.startsWith('http://')) {
        if (!absolute.startsWith('data:')) result.push(absolute);
      }
    } catch (_) {}
  }
  return result;
}

async function main() {
  ensureDir(OUT_DIR);
  ensureDir(ASSETS_DIR);
  ensureDir(IMAGES_DIR);

  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-blink-features=AutomationControlled'],
    ignoreDefaultArgs: ['--enable-automation'],
  });

  const ctx = await browser.newContext({
    viewport: { width: VIEWPORT_W, height: VIEWPORT_H },
    userAgent: UA,
    locale: 'pt-BR',
    javaScriptEnabled: true,
  });

  const page = await ctx.newPage();

  const allImageUrls = new Set();

  page.on('response', async (response) => {
    const url = response.url();
    if (url.startsWith('data:')) return;
    const ct = response.headers()['content-type'] || '';
    if (ct.includes('image/')) allImageUrls.add(url);
  });

  console.log('\n--- Navegando para', BASE_URL, '---');
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(4000);

  console.log('--- Scroll para carregar imagens lazy ---');
  for (let i = 0; i < 15; i++) {
    await page.evaluate(() => window.scrollBy(0, 400));
    await page.waitForTimeout(400);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);

  const html = await page.evaluate(() => document.documentElement.outerHTML);
  const extractedUrls = extractImageUrls(html, BASE_URL);
  extractedUrls.forEach((u) => allImageUrls.add(u));

  await page.screenshot({ path: path.join(OUT_DIR, 'screenshot.png'), fullPage: true });
  console.log('  screenshot.png salvo');

  await browser.close();

  const allUrlsToDownload = new Set([...allImageUrls, ...extractImageUrls(html, BASE_URL)]);

  console.log('\n--- Baixando imagens (' + allUrlsToDownload.size + ' encontradas) ---');
  let idx = 0;
  for (const imgUrl of allUrlsToDownload) {
    if (!imgUrl.startsWith('https://') && !imgUrl.startsWith('http://')) continue;
    if (imgUrl.startsWith('data:')) continue;
    const baseSlug = slugFromUrl(imgUrl) || 'img';
    const slug = baseSlug + '_' + idx;
    const destBase = path.join(IMAGES_DIR, slug);
    await downloadAsset(imgUrl, destBase);
    idx++;
  }

  let finalHtml = html;
  const sortedByLength = [...downloadedUrls.entries()].sort((a, b) => b[0].length - a[0].length);
  for (const [origUrl, localPath] of sortedByLength) {
    if (!localPath) continue;
    const relPath = './' + localPath;
    finalHtml = finalHtml.split(origUrl).join(relPath);
    finalHtml = finalHtml.split(origUrl.replace(/&/g, '&amp;')).join(relPath);
  }

  fs.writeFileSync(path.join(OUT_DIR, 'index.html'), finalHtml, 'utf8');
  console.log('\n  index.html salvo com paths locais');

  fs.writeFileSync(path.join(OUT_DIR, 'image-urls.txt'), [...allUrlsToDownload].join('\n'), 'utf8');
  console.log('  image-urls.txt salvo');

  console.log('\nConcluído. Clone em:', OUT_DIR);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
