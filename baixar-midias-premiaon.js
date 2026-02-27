/**
 * Baixa fontes e ícones faltantes de premiaon.vercel.app para assets/
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

const BASE = 'https://premiaon.vercel.app';
const OUT = path.join(__dirname, 'clones', 'premiaon.vercel.app', 'assets');

const ASSETS = [
  // fontes
  '/_next/static/media/797e433ab948586e-s.p.dbea232f.woff2',
  '/_next/static/media/caa3a2e1cccd8315-s.p.853070df.woff2',
  '/_next/static/media/8a480f0b521d4e75-s.8e0177b5.woff2',
  '/_next/static/media/7178b3e590c64307-s.b97b3418.woff2',
  '/_next/static/media/4fa387ec64143e14-s.c1fdd6c2.woff2',
  '/_next/static/media/bbc41e54d2fcbd21-s.799d8ef8.woff2',
  // ícones principais
  '/icon-light-32x32.png',
  '/icon-dark-32x32.png',
  '/icon.svg',
  '/apple-icon.png',
  // logos da página de confirmação de identidade
  '/images/tiktok-logo.png',
  '/images/bacen.png',
  '/images/gov-br.webp',
  '/images/receita-federal.png',
];

function download(url) {
  return new Promise((resolve) => {
    const full = url.startsWith('http') ? url : BASE + url;
    const outPath = path.join(OUT, url.replace(/^\//, '').replace(/\?.*$/, ''));
    const dir = path.dirname(outPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    https.get(full, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        download(res.headers.location).then(resolve);
        return;
      }
      const stream = fs.createWriteStream(outPath);
      res.pipe(stream);
      stream.on('finish', () => {
        stream.close();
        console.log('OK', url);
        resolve();
      });
    }).on('error', (e) => {
      console.log('Erro', url, e.message);
      resolve();
    });
  });
}

async function main() {
  for (const url of ASSETS) {
    await download(url);
  }
  console.log('Concluído.');
}

main();
