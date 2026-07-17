import { useEffect, useState } from 'react';
import api from '../../services/api';
import { formatCFA } from '../../utils/currency';
import PaymentModal, { canPayBooking } from '../../components/PaymentModal';

const StatCard = ({ title, value }) => (
  <div className="stat-card">
    <h3>{title}</h3>
    <div className="value">{value ?? 0}</div>
  </div>
);

const CustomerDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [payBooking, setPayBooking] = useState(null);

  const fetchDashboard = () => {
    setLoading(true);
    setError('');
    api.get('/customer/dashboard')
      .then((res) => setData(res.data.data))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load dashboard'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchDashboard(); }, []);

  return (
    <div>
      <PaymentModal
        booking={payBooking}
        onClose={() => setPayBooking(null)}
        onSuccess={fetchDashboard}
      />

      <div className="page-header"><h1>My Dashboard</h1></div>
      {loading && <p>Loading...</p>}
      {error && <div className="alert alert-danger">{error}</div>}
      <div className="stats-grid">
        <StatCard title="Upcoming Bookings" value={data?.stats?.upcoming} />
        <StatCard title="Completed" value={data?.stats?.completed} />
        <StatCard title="Cancelled" value={data?.stats?.cancelled} />
        <StatCard title="Total Payments" value={data?.stats?.total_payments} />
      </div>

      {data?.upcomingBookings?.length > 0 ? (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>Upcoming Bookings</h3>
          {data.upcomingBookings.map((b) => (
            <div key={b.id} style={{
              padding: '0.75rem 0', borderBottom: '1px solid var(--border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem',
            }}>
              <div>
                <strong>{b.service_name}</strong> — {b.company_name}
                <br />
                <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                  {b.scheduled_date?.split('T')[0]} at {b.scheduled_time} | {formatCFA(b.total_amount)} | {b.status}
                </span>
                {b.payment_status === 'pending' && (
                  <span className="badge badge-warning" style={{ marginLeft: 8 }}>Payment Pending</span>
                )}
                {b.payment_status === 'confirmed' && (
                  <span className="badge badge-success" style={{ marginLeft: 8 }}>Paid</span>
                )}
              </div>
              {canPayBooking(b) && (
                <button className="btn btn-primary btn-sm" onClick={() => setPayBooking(b)}>Make Payment</button>
              )}
            </div>
          ))}
        </div>
      ) : !loading && !error && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <div className="empty-state">No upcoming bookings. Browse services to book your first cleaning.</div>
        </div>
      )}
    </div>
  );
};

export default CustomerDashboard;
