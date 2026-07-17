require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const pool = require('../src/config/database');
const { comparePassword } = require('../src/utils/auth');

(async () => {
  const [cleaners] = await pool.query(
    `SELECT id, email, full_name, is_active, must_change_password, status, tenant_id
     FROM cleaners ORDER BY id DESC LIMIT 10`
  );
  console.log('Recent cleaners:', cleaners);

  const testEmail = process.argv[2];
  const testPass = process.argv[3];
  if (testEmail && testPass) {
    const [rows] = await pool.query(
      `SELECT * FROM cleaners WHERE email = ? AND is_active IN (TRUE, '1', 'true', 't', 'yes', 'TRUE')`,
      [testEmail]
    );
    console.log('Found:', rows.length ? rows[0].email : 'none');
    if (rows[0]) {
      const valid = await comparePassword(testPass, rows[0].password_hash);
      console.log('Password match:', valid);
    }
  }
  process.exit(0);
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
