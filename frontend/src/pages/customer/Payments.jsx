import { useEffect, useState } from 'react';
import api from '../../services/api';
import { formatCFA } from '../../utils/currency';
import PaymentModal, { canPayBooking } from '../../components/PaymentModal';
import { printPaymentReceipt } from '../../utils/receipt';

const CustomerPayments = () => {
  const [payments, setPayments] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [payBooking, setPayBooking] = useState(null);

  const fetchData = () => {
    Promise.all([
      api.get('/customer/payments'),
      api.get('/customer/bookings'),
    ]).then(([paymentsRes, bookingsRes]) => {
      setPayments(paymentsRes.data.data);
      setBookings(bookingsRes.data.data);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const unpaidBookings = bookings.filter(canPayBooking);

  return (
    <div>
      <PaymentModal
        booking={payBooking}
        onClose={() => setPayBooking(null)}
        onSuccess={fetchData}
      />

      <div className="page-header"><h1>Payments</h1></div>

      {unpaidBookings.length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>Unpaid Bookings</h3>
          {unpaidBookings.map((b) => (
            <div key={b.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '0.75rem 0', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: '0.5rem',
            }}>
              <div>
                <strong>{b.service_name}</strong> — {b.company_name}
                <br />
                <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                  {b.scheduled_date?.split('T')[0]} | {formatCFA(b.total_amount)}
                </span>
              </div>
              <button className="btn btn-primary btn-sm" onClick={() => setPayBooking(b)}>Pay Now</button>
            </div>
          ))}
        </div>
      )}

      <div className="card table-wrapper">
        <h3 style={{ marginBottom: '1rem' }}>Payment History</h3>
        {loading ? <p>Loading...</p> : payments.length === 0 ? (
          <div className="empty-state">No payments yet</div>
        ) : (
          <table>
            <thead>
              <tr><th>Service</th><th>Company</th><th>Amount</th><th>Method</th><th>Status</th><th>Date</th><th>Receipt</th></tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td>{p.service_name}</td>
                  <td>{p.company_name}</td>
                  <td>{formatCFA(p.amount)}</td>
                  <td>{p.payment_method?.replace('_', ' ')}</td>
                  <td><span className={`badge badge-${p.status === 'confirmed' ? 'success' : 'warning'}`}>{p.status}</span></td>
                  <td>{new Date(p.created_at).toLocaleDateString()}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => printPaymentReceipt({ ...p, receipt_no: `RCP-${p.id}` })}
                    >
                      Print Receipt
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default CustomerPayments;
