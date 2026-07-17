require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const pool = require('../src/config/database');
const { hashPassword, comparePassword } = require('../src/utils/auth');
const http = require('http');

const email = process.argv[2] || 'besonglami463@gmail.com';
const newPassword = process.argv[3] || 'Cleaner2026!';

const loginTest = (password) => new Promise((resolve) => {
  const body = JSON.stringify({ email, password, userType: 'cleaner' });
  const req = http.request({
    hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': body.length },
  }, (res) => {
    let data = '';
    res.on('data', (c) => { data += c; });
    res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(data) }));
  });
  req.on('error', (e) => resolve({ error: e.message }));
  req.write(body);
  req.end();
});

(async () => {
  const hash = await hashPassword(newPassword);
  await pool.query(
    'UPDATE cleaners SET password_hash = ?, must_change_password = TRUE WHERE email = ?',
    [hash, email]
  );

  const [rows] = await pool.query('SELECT password_hash FROM cleaners WHERE email = ?', [email]);
  const ok = await comparePassword(newPassword, rows[0].password_hash);
  console.log('DB password verify:', ok);

  const login = await loginTest(newPassword);
  console.log('Login test:', login.status, login.data?.message || login.error);
  console.log('\nUse these credentials:');
  console.log('  Login as: Cleaner');
  console.log('  Email:', email);
  console.log('  Password:', newPassword);
  process.exit(login.status === 200 ? 0 : 1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
