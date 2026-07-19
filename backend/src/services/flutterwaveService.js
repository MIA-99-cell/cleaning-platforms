const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

const FLW_TOKEN_URL = 'https://idp.flutterwave.com/realms/flutterwave/protocol/openid-connect/token';
const FLW_API_BASE = process.env.FLW_ENV === 'live'
  ? 'https://api.flutterwave.com'
  : 'https://developersandbox-api.flutterwave.com';

let cachedToken = null;
let tokenExpiresAt = 0;

const trimEnv = (value) => {
  if (value == null) return '';
  return String(value).trim().replace(/^["']|["']$/g, '');
};

const isConfigured = () => Boolean(
  trimEnv(process.env.FLW_CLIENT_ID) && trimEnv(process.env.FLW_CLIENT_SECRET)
);

const getAccessToken = async () => {
  if (!isConfigured()) {
    throw new Error('Flutterwave credentials are not configured');
  }

  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) {
    return cachedToken;
  }

  const clientId = trimEnv(process.env.FLW_CLIENT_ID);
  const clientSecret = trimEnv(process.env.FLW_CLIENT_SECRET);

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'client_credentials',
  });

  const res = await fetch(FLW_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error_description || data.error || 'Flutterwave authentication failed');
  }

  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in || 3600) * 1000;
  return cachedToken;
};

const formatFlwError = (data) => {
  const err = data?.error || {};
  const details = Array.isArray(err.validation_errors) && err.validation_errors.length
    ? err.validation_errors
      .map((v) => {
        const field = v.field_name || v.field || '';
        const msg = v.message || JSON.stringify(v);
        return field ? `${field}: ${msg}` : msg;
      })
      .join('; ')
    : '';
  return details
    ? `${err.message || data?.message || 'Request is not valid'} (${details})`
    : (err.message || data?.message || 'Flutterwave request failed');
};

const flwRequest = async (path, { method = 'GET', body } = {}) => {
  const token = await getAccessToken();
  const headers = {
    Authorization: `Bearer ${token}`,
    'X-Trace-Id': uuidv4(),
  };

  if (method !== 'GET') {
    headers['Content-Type'] = 'application/json';
    headers['X-Idempotency-Key'] = uuidv4();
  }

  const res = await fetch(`${FLW_API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();
  if (!res.ok) {
    console.error('[Flutterwave] API error:', JSON.stringify(data, null, 2));
    throw new Error(formatFlwError(data));
  }

  return data;
};

const normalizePhone = (phone) => {
  let digits = String(phone || '').replace(/\D/g, '');
  if (digits.startsWith('237')) digits = digits.slice(3);
  if (digits.startsWith('0')) digits = digits.slice(1);
  return { countryCode: '237', number: digits };
};

/** Flutterwave requires ASCII names matching ^[A-Za-z ,.'-]{2,50}$ */
const sanitizeNamePart = (value, fallback) => {
  const cleaned = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z ,.'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.length >= 2) return cleaned.slice(0, 50);
  return fallback;
};

const parseName = (fullName) => {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  const first = sanitizeNamePart(parts[0], 'Customer');
  const last = sanitizeNamePart(parts.slice(1).join(' '), 'User');
  return { first, last };
};

const normalizeNetwork = (network) => {
  const value = String(network || 'MTN').toUpperCase().replace(/\s+/g, '');
  if (value.includes('ORANGE')) return 'ORANGE';
  return 'MTN';
};

const buildRedirectUrl = (reference) => {
  const viaBackend = process.env.FLW_REDIRECT_VIA_BACKEND === 'true';
  const configured = (
    process.env.FLW_REDIRECT_BASE
    || process.env.FRONTEND_URL
    || ''
  ).replace(/\/$/, '');

  if (configured.startsWith('https://')) {
    if (viaBackend) {
      return `${configured}/api/payments/flutterwave/return/${encodeURIComponent(reference)}`;
    }
    return `${configured}/payment/return/${encodeURIComponent(reference)}`;
  }

  // Sandbox-safe HTTPS URL (Flutterwave rejects localhost)
  return 'https://www.google.com';
};

const createDirectCharge = async ({
  amount,
  currency = 'XAF',
  reference,
  customerEmail,
  customerName,
  phone,
  network,
  meta,
}) => {
  const { countryCode, number } = normalizePhone(phone);
  const name = parseName(customerName);
  const chargeRef = reference || uuidv4();

  if (!number || number.length < 8) {
    throw new Error('Enter a valid Cameroon mobile number (e.g. 670000000)');
  }

  const chargeAmount = Math.round(Number(amount));
  if (!Number.isFinite(chargeAmount) || chargeAmount < 1) {
    throw new Error('Invalid payment amount');
  }

  const payload = {
    amount: chargeAmount,
    currency,
    reference: chargeRef,
    redirect_url: buildRedirectUrl(chargeRef),
    customer: {
      email: customerEmail,
      name,
      phone: {
        country_code: countryCode,
        number,
      },
    },
    payment_method: {
      type: 'mobile_money',
      mobile_money: {
        country_code: countryCode,
        network: normalizeNetwork(network),
        phone_number: number,
      },
    },
    meta: Object.fromEntries(
      Object.entries(meta || {}).map(([k, v]) => [k, String(v)])
    ),
  };

  console.log('[Flutterwave] Creating charge:', {
    amount: payload.amount,
    currency: payload.currency,
    reference: payload.reference,
    network: payload.payment_method.mobile_money.network,
    phone: `${countryCode}${number}`,
    name,
    redirect_url: payload.redirect_url,
  });

  return flwRequest('/orchestration/direct-charges', {
    method: 'POST',
    body: payload,
  });
};

const verifyCharge = async (chargeId) => flwRequest(`/charges/${chargeId}`, { method: 'GET' });

const verifyWebhookSignature = (rawBody, signature) => {
  const secret = process.env.FLW_WEBHOOK_HASH;
  if (!secret || !signature) return false;

  const hash = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
  if (hash === signature) return true;

  return signature === secret;
};

const isSuccessfulCharge = (charge) => {
  const status = String(charge?.status || '').toLowerCase();
  return status === 'succeeded' || status === 'successful';
};

/** Checks whether Flutterwave OAuth accepts the configured credentials. */
const verifyCredentials = async () => {
  if (!isConfigured()) {
    return {
      configured: false,
      verified: false,
      error: 'FLW_CLIENT_ID or FLW_CLIENT_SECRET missing',
      hint: 'Add both keys in Render Environment (not Vercel).',
    };
  }

  try {
    cachedToken = null;
    tokenExpiresAt = 0;
    await getAccessToken();
    return {
      configured: true,
      verified: true,
      env: process.env.FLW_ENV || 'test',
      clientIdPrefix: trimEnv(process.env.FLW_CLIENT_ID).slice(0, 8),
      secretLength: trimEnv(process.env.FLW_CLIENT_SECRET).length,
    };
  } catch (error) {
    return {
      configured: true,
      verified: false,
      env: process.env.FLW_ENV || 'test',
      clientIdPrefix: trimEnv(process.env.FLW_CLIENT_ID).slice(0, 8),
      secretLength: trimEnv(process.env.FLW_CLIENT_SECRET).length,
      error: error.message,
      hint: /invalid client/i.test(error.message)
        ? 'Render has the wrong Client ID or Client Secret. Copy fresh values from Flutterwave dashboard — no quotes, no spaces.'
        : 'Check Flutterwave dashboard credentials and FLW_ENV=test for sandbox keys.',
    };
  }
};

module.exports = {
  isConfigured,
  verifyCredentials,
  createDirectCharge,
  verifyCharge,
  verifyWebhookSignature,
  isSuccessfulCharge,
  buildRedirectUrl,
  normalizeNetwork,
};
