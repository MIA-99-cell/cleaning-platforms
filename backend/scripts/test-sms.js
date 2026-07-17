require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const config = require('../src/config');
const { sendSms, isTwilioConfigured, normalizePhone } = require('../src/services/smsService');

(async () => {
  const to = process.argv[2] || config.superAdmin.notifyPhone;
  if (!to) {
    console.error('Usage: node scripts/test-sms.js [+237XXXXXXXXX]');
    process.exit(1);
  }

  console.log('Twilio configured:', isTwilioConfigured());
  console.log('Normalized phone:', normalizePhone(to));

  const result = await sendSms({
    to,
    message: 'Mycleaning test SMS: admin notifications are working.',
  });

  console.log('Result:', result);
  process.exit(result.success ? 0 : 1);
})();
