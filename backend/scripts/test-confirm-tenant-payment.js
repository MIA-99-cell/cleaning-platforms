require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { generateToken } = require('../src/utils/auth');

(async () => {
  const token = generateToken({
    id: 1,
    email: 'tenant@demo.com',
    role: 'tenant',
    name: 'Tenant',
  });
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const res = await fetch('http://localhost:5000/api/tenant/payments/3/confirm', {
    method: 'PATCH',
    headers,
  });
  const body = await res.json();
  console.log('confirm payment 3:', res.status, body);

  const list = await fetch('http://localhost:5000/api/tenant/payments', { headers });
  const listBody = await list.json();
  console.log('after confirm:', listBody.data?.find((p) => p.id === '3' || p.id === 3));

  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
