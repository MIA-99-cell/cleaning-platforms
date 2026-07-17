require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { generateToken } = require('../src/utils/auth');

(async () => {
  const base = 'http://localhost:5000/api';
  const token = generateToken({
    id: 2,
    email: 'customer@gmail.com',
    role: 'customer',
    name: 'customer Ele',
  });
  const headers = { Authorization: `Bearer ${token}` };

  const dash = await fetch(`${base}/customer/dashboard`, { headers });
  const dashBody = await dash.json();
  console.log('dashboard:', dash.status, dashBody.data?.stats, 'upcoming:', dashBody.data?.upcomingBookings?.length);

  const bookings = await fetch(`${base}/customer/bookings`, { headers });
  const bookingsBody = await bookings.json();
  console.log('bookings:', bookings.status, bookingsBody.message, 'count:', bookingsBody.data?.length);

  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
