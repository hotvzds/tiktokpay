/**
 * Corrige paths de imagens no index.html do clone ballesapparel.
 * Mapeia URLs (com ou sem query, protocol-relative) para arquivos locais.
 */
const fs = require('fs');
const path = require('path');
const OUT_DIR = path.join(__dirname, 'clones', 'ballesapparel.com');
const IMAGES_DIR = path.join(OUT_DIR, 'assets', 'images');

function slugFromUrl(url) {
  try {
    const u = new URL(url.startsWith('//') ? 'https:' + url : url);
    const base = u.pathname.replace(/^\//, '').replace(/\/$/, '');
    return base.replace(/[^a-zA-Z0-9\-_.]/g, '_').replace(/_+/g, '_').slice(0, 120) || 'img';
  } catch {
    return 'img';
  }
}

function getExtensionFromUrl(url) {
  const ext = path.extname(new URL(url.startsWith('//') ? 'https:' + url : url).pathname).toLowerCase();
  if (['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg', '.avif'].includes(ext)) return ext;
  return '.jpg';
}

function main() {
  const urlsPath = path.join(OUT_DIR, 'image-urls.txt');
  const indexPath = path.join(OUT_DIR, 'index.html');
  if (!fs.existsSync(urlsPath) || !fs.existsSync(indexPath)) {
    console.error('Arquivos não encontrados');
    process.exit(1);
  }

  const urls = fs.readFileSync(urlsPath, 'utf8').split('\n').filter(Boolean);
  const files = fs.readdirSync(IMAGES_DIR);
  const urlToLocal = new Map();

  let idx = 0;
  for (const url of urls) {
    if (!url.startsWith('https://') && !url.startsWith('http://') && !url.startsWith('//')) continue;
    const baseSlug = slugFromUrl(url);
    const ext = getExtensionFromUrl(url);
    const slug = baseSlug + '_' + idx;
    const candidate = files.find((f) => f.startsWith(slug + '.') || f === slug + ext || f === slug + '.webp' || f === slug + '.jpg' || f === slug + '.png');
    if (candidate) {
      const relPath = 'assets/images/' + candidate;
      urlToLocal.set(url, relPath);
      const urlNoQuery = url.replace(/\?.*$/, '');
      urlToLocal.set(urlNoQuery, relPath);
      if (url.startsWith('https://')) {
        urlToLocal.set('//' + url.slice(8), relPath);
        urlToLocal.set('//' + url.slice(8).replace(/\?.*$/, ''), relPath);
      } else if (url.startsWith('http://')) {
        urlToLocal.set('//' + url.slice(7), relPath);
        urlToLocal.set('//' + url.slice(7).replace(/\?.*$/, ''), relPath);
      }
    }
    idx++;
  }

  let html = fs.readFileSync(indexPath, 'utf8');
  const sorted = [...urlToLocal.entries()].sort((a, b) => b[0].length - a[0].length);
  for (const [origUrl, localPath] of sorted) {
    const relPath = './' + localPath;
    html = html.split(origUrl).join(relPath);
  }

  fs.writeFileSync(indexPath, html, 'utf8');
  console.log('Paths corrigidos em index.html');
}

main();
