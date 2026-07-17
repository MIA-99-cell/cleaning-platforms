require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const http = require('http');

const request = (options, body) => new Promise((resolve, reject) => {
  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (c) => { data += c; });
    res.on('end', () => resolve({ status: res.statusCode, body: data }));
  });
  req.on('error', reject);
  if (body) req.write(body);
  req.end();
});

(async () => {
  const loginBody = JSON.stringify({
    email: 'admincleaning43@gmail.com',
    password: 'admin@1234.*',
    userType: 'super_admin',
  });
  const login = await request({
    hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': loginBody.length },
  }, loginBody);
  const token = JSON.parse(login.body).data.token;

  const dashboard = await request({
    hostname: 'localhost', port: 5000, path: '/api/super-admin/dashboard', method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log('dashboard', dashboard.status, dashboard.body.slice(0, 300));

  const announceBody = JSON.stringify({ title: 'Hi', message: 'Test', type: 'info' });
  const announce = await request({
    hostname: 'localhost', port: 5000, path: '/api/super-admin/announcements', method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'Content-Length': announceBody.length,
    },
  }, announceBody);
  console.log('announce', announce.status, announce.body);
})().catch(console.error);
