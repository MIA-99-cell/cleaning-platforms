require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const config = require('../src/config');
const { sendNotificationEmail, isSmtpConfigured } = require('../src/services/emailService');
const { isSupabaseConfigured } = require('../src/services/supabaseService');

(async () => {
  const to = process.argv[2] || config.superAdmin.notifyEmail;
  if (!to) {
    console.error('Usage: node scripts/test-email.js [recipient@email.com]');
    process.exit(1);
  }

  console.log('SMTP configured:', isSmtpConfigured());
  console.log('Supabase email enabled:', config.supabase.useEmail && isSupabaseConfigured());
  console.log('Sending test email to:', to);

  const result = await sendNotificationEmail({
    to,
    subject: 'Mycleaning - Email Test',
    html: '<p>This is a test email from the Mycleaning platform.</p>',
    text: 'This is a test email from the Mycleaning platform.',
    actionUrl: `${config.frontendUrl}/login`,
  });

  console.log('Result:', result);
  process.exit(result.success ? 0 : 1);
})();
