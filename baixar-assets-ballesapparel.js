/**
 * Baixa recursos externos (CSS, JS, fontes) e atualiza o index.html com paths locais.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const OUT_DIR = path.join(__dirname, 'clones', 'ballesapparel.com');
const ASSETS_DIR = path.join(OUT_DIR, 'assets');
const CSS_DIR = path.join(ASSETS_DIR, 'css');
const JS_DIR = path.join(ASSETS_DIR, 'js');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const URLS = {
  criticalCss: 'https://dcdn-us.mitiendanube.com/stores/003/292/886/themes/recife/dart-style-critical-78562015c29acbe1693178f1673764ee.css',
  asyncCss: 'https://dcdn-us.mitiendanube.com/stores/003/292/886/themes/recife/dart-style-async-6151ad3c4fcd54362dc83eb13344c3bc.css',
  themeJs: 'https://dcdn-us.mitiendanube.com/stores/003/292/886/themes/recife/dart-external-no-dependencies-2020a4748d2e0fc983451e7972c49502.js',
  linkedstoreJs: 'https://dcdn-us.mitiendanube.com/assets/stores/js/linkedstore-v2-f776f6205af36f3d1b9315a06893835330.js',
  fontsCss: 'https://fonts.googleapis.com/css2?family=Roboto:wght@400;600&display=swap',
};

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function download(url) {
  return new Promise((resolve, reject) => {
    const fullUrl = url.startsWith('//') ? 'https:' + url : url;
    try {
      const u = new URL(fullUrl);
      const protocol = u.protocol === 'https:' ? https : http;
      const req = protocol.get(fullUrl, { headers: { 'User-Agent': UA } }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          download(res.headers.location).then(resolve).catch(reject);
          return;
        }
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => resolve(data));
      });
      req.on('error', reject);
      req.setTimeout(20000, () => { req.destroy(); reject(new Error('Timeout')); });
    } catch (e) {
      reject(e);
    }
  });
}

function downloadToFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const fullUrl = url.startsWith('//') ? 'https:' + url : url;
    try {
      const u = new URL(fullUrl);
      ensureDir(path.dirname(destPath));
      const protocol = u.protocol === 'https:' ? https : http;
      const req = protocol.get(fullUrl, { headers: { 'User-Agent': UA } }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          downloadToFile(res.headers.location, destPath).then(resolve).catch(reject);
          return;
        }
        const stream = fs.createWriteStream(destPath);
        res.pipe(stream);
        stream.on('finish', () => { stream.close(); resolve(); });
      });
      req.on('error', reject);
      req.setTimeout(20000, () => { req.destroy(); reject(new Error('Timeout')); });
    } catch (e) {
      reject(e);
    }
  });
}

async function main() {
  ensureDir(CSS_DIR);
  ensureDir(JS_DIR);

  console.log('Baixando CSS e JS...\n');

  await downloadToFile(URLS.criticalCss, path.join(CSS_DIR, 'dart-style-critical.css'));
  console.log('  OK: dart-style-critical.css');

  await downloadToFile(URLS.asyncCss, path.join(CSS_DIR, 'dart-style-async.css'));
  console.log('  OK: dart-style-async.css');

  await downloadToFile(URLS.themeJs, path.join(JS_DIR, 'dart-external.js'));
  console.log('  OK: dart-external.js');

  await downloadToFile(URLS.linkedstoreJs, path.join(JS_DIR, 'linkedstore-v2.js'));
  console.log('  OK: linkedstore-v2.js');

  await downloadToFile(URLS.fontsCss, path.join(CSS_DIR, 'fonts-roboto.css'));
  console.log('  OK: fonts-roboto.css');

  const indexPath = path.join(OUT_DIR, 'index.html');
  let html = fs.readFileSync(indexPath, 'utf8');

  html = html.replace(/href="\.\/assets\/images\/css_246\.jpg[^"]*"/g, 'href="./assets/css/fonts-roboto.css"');
  html = html.replace(/@import\s+url\(['"]?\.\/assets\/images\/css_246\.jpg['"]?\)/g, '@import url("./assets/css/fonts-roboto.css")');
  html = html.replace(/href="\/\/fonts\.googleapis\.com\/[^"]+"/g, 'href="./assets/css/fonts-roboto.css"');
  html = html.replace(/url\(['"]?\/\/fonts\.googleapis\.com\/[^"')]+['"]?\)/g, 'url("./assets/css/fonts-roboto.css")');

  html = html.replace(/href="\/\/dcdn-us\.mitiendanube\.com\/stores\/003\/292\/886\/themes\/recife\/dart-style-critical-[^"]+\.css"/g, 'href="./assets/css/dart-style-critical.css"');
  html = html.replace(/href="\/\/dcdn-us\.mitiendanube\.com\/stores\/003\/292\/886\/themes\/recife\/dart-style-async-[^"]+\.css"/g, 'href="./assets/css/dart-style-async.css"');
  html = html.replace(/href="\/\/dcdn-us\.mitiendanube\.com\/stores\/003\/292\/886\/themes\/recife\/dart-external-no-dependencies-[^"]+\.js"/g, 'href="./assets/js/dart-external.js"');
  html = html.replace(/src="\/\/dcdn-us\.mitiendanube\.com\/stores\/003\/292\/886\/themes\/recife\/dart-external-no-dependencies-[^"]+\.js"/g, 'src="./assets/js/dart-external.js"');
  html = html.replace(/src="\/\/dcdn-us\.mitiendanube\.com\/assets\/stores\/js\/linkedstore-v2-[^"]+\.js[^"]*"/g, 'src="./assets/js/linkedstore-v2.js"');

  fs.writeFileSync(indexPath, html, 'utf8');
  console.log('\nindex.html atualizado com paths locais.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
