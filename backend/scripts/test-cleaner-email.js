require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { sendCleanerCredentialsEmail } = require('../src/services/cleanerEmailService');
const { isSmtpConfigured } = require('../src/services/emailService');

(async () => {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: node scripts/test-cleaner-email.js cleaner@example.com');
    process.exit(1);
  }

  console.log('SMTP configured:', isSmtpConfigured());
  console.log('Resend configured:', !!process.env.RESEND_API_KEY);

  const result = await sendCleanerCredentialsEmail({
    name: 'Test Cleaner',
    email,
    password: 'TestPass123!',
    companyName: 'Demo Cleaning Co',
  });

  console.log('Result:', result);
  process.exit(result.emailSent ? 0 : 1);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
