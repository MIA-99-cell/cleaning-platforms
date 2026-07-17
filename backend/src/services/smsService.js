const config = require('../config');

const normalizePhone = (phone) => {
  if (!phone) return null;
  const cleaned = String(phone).trim().replace(/[\s\-().]/g, '');
  if (!cleaned) return null;
  if (cleaned.startsWith('+')) return cleaned;
  if (cleaned.startsWith('00')) return `+${cleaned.slice(2)}`;
  if (/^237\d{9}$/.test(cleaned)) return `+${cleaned}`;
  if (/^6\d{8}$/.test(cleaned)) return `+237${cleaned}`;
  if (/^\d{10,15}$/.test(cleaned)) return `+${cleaned}`;
  return cleaned;
};

const isTwilioConfigured = () => {
  const { accountSid, authToken, fromNumber } = config.sms;
  return !!(accountSid && authToken && fromNumber && !accountSid.includes('your-'));
};

const sendSms = async ({ to, message }) => {
  const normalizedTo = normalizePhone(to);
  if (!normalizedTo) {
    return { success: false, error: 'Invalid phone number' };
  }

  if (!isTwilioConfigured()) {
    console.log(`[SMS - Dev Mode] To: ${normalizedTo}`);
    console.log(`[SMS - Dev Mode] Message: ${message}`);
    return { success: true, dev: true, to: normalizedTo };
  }

  try {
    const params = new URLSearchParams();
    params.append('To', normalizedTo);
    params.append('From', config.sms.fromNumber);
    params.append('Body', message);

    const auth = Buffer.from(`${config.sms.accountSid}:${config.sms.authToken}`).toString('base64');
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${config.sms.accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      console.error('[SMS Error]', err);
      return { success: false, error: err };
    }

    return { success: true, via: 'twilio', to: normalizedTo };
  } catch (error) {
    console.error('[SMS Error]', error.message);
    return { success: false, error: error.message };
  }
};

module.exports = { sendSms, normalizePhone, isTwilioConfigured };
