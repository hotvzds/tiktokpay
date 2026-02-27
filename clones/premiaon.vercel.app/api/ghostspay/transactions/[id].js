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
  if (req.method !== 'GET') {
    return res.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Use GET' } });
  }

  const secretKey = process.env.GHOSTSPAY_SECRET_KEY || '';
  const companyId = process.env.GHOSTSPAY_COMPANY_ID || '';
  const id = req.query.id;

  if (!id) {
    return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'ID da transação é obrigatório.' } });
  }

  if (!secretKey || !companyId) {
    return res.status(500).json({
      error: {
        code: 'MISSING_CREDENTIALS',
        message: 'Configuração GhostsPays ausente.'
      }
    });
  }

  try {
    const { status, body } = await callGhostsPays(`/transactions/${id}`, {
      method: 'GET',
      headers: {
        Authorization: buildAuthHeader(secretKey, companyId)
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
}
