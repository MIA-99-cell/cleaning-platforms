import { useEffect, useMemo, useState } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { formatCFA } from '../../utils/currency';

const formatMethod = (method) => {
  const map = {
    flutterwave: 'Flutterwave (MoMo)',
    mobile_money: 'Mobile Money',
    card: 'Card',
    cash: 'Cash',
    bank_transfer: 'Bank Transfer',
  };
  if (map[method]) return map[method];
  return method ? method.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '-';
};

const isConfirmed = (status) => status === 'confirmed' || status === 'successful';

const formatStatus = (status) => {
  if (isConfirmed(status)) return 'Confirmed';
  if (status === 'pending') return 'Pending';
  if (status === 'failed') return 'Failed';
  if (status === 'refunded') return 'Refunded';
  return status || '-';
};

const statusBadge = (status) => {
  if (isConfirmed(status)) return 'success';
  if (status === 'failed') return 'danger';
  if (status === 'cancelled' || status === 'refunded') return 'secondary';
  return 'warning';
};

const Payments = () => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmingId, setConfirmingId] = useState(null);

  const fetchPayments = () => {
    setLoading(true);
    setError('');
    api.get('/tenant/payments')
      .then((res) => setPayments(res.data.data || []))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load payments'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchPayments(); }, []);

  const pendingPayments = useMemo(
    () => payments.filter((p) => p.status === 'pending'),
    [payments],
  );

  const confirmedPayments = useMemo(
    () => payments.filter((p) => isConfirmed(p.status)),
    [payments],
  );

  const confirmedTotal = useMemo(
    () => confirmedPayments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0),
    [confirmedPayments],
  );

  const failedCount = useMemo(
    () => payments.filter((p) => p.status === 'failed').length,
    [payments],
  );

  const confirmPayment = async (id) => {
    setConfirmingId(id);
    try {
      await api.patch(`/tenant/payments/${id}/confirm`);
      toast.success('Payment confirmed');
      fetchPayments();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to confirm payment');
    } finally {
      setConfirmingId(null);
    }
  };

  return (
    <div>
      <div className="page-header"><h1>Payments</h1></div>

      <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="stat-card">
          <h3>Pending Payments</h3>
          <div className="value">{pendingPayments.length}</div>
        </div>
        <div className="stat-card">
          <h3>Confirmed Payments</h3>
          <div className="value">{confirmedPayments.length}</div>
        </div>
        <div className="stat-card">
          <h3>Confirmed Revenue</h3>
          <div className="value">{formatCFA(confirmedTotal)}</div>
        </div>
        <div className="stat-card">
          <h3>Failed / Cancelled</h3>
          <div className="value">{failedCount}</div>
        </div>
      </div>

      {pendingPayments.length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>Awaiting Confirmation</h3>
          {pendingPayments.map((p) => (
            <div key={p.id} style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '0.75rem 0',
              borderBottom: '1px solid var(--border)',
              flexWrap: 'wrap',
              gap: '0.5rem',
            }}>
              <div>
                <strong>{p.customer_name}</strong> — {p.service_name}
                <br />
                <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                  {formatCFA(p.amount)} via {formatMethod(p.payment_method)}
                  {p.transaction_ref ? ` | Ref: ${p.transaction_ref}` : ''}
                </span>
              </div>
              <button
                className="btn btn-success btn-sm"
                disabled={confirmingId === p.id}
                onClick={() => confirmPayment(p.id)}
              >
                {confirmingId === p.id ? 'Confirming...' : 'Confirm Payment'}
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="card table-wrapper">
        <h3 style={{ marginBottom: '1rem' }}>Payment History</h3>
        {loading ? <p>Loading...</p> : error ? (
          <div className="empty-state">{error}</div>
        ) : payments.length === 0 ? (
          <div className="empty-state">No payments yet. Payments appear here when customers pay for bookings.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Service</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Reference</th>
                <th>Status</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td>{p.customer_name}</td>
                  <td>{p.service_name}</td>
                  <td>{formatCFA(p.amount)}</td>
                  <td>{formatMethod(p.payment_method)}</td>
                  <td style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.transaction_ref || '-'}
                  </td>
                  <td>
                    <span className={`badge badge-${statusBadge(p.status)}`}>
                      {formatStatus(p.status)}
                    </span>
                  </td>
                  <td>{p.created_at ? new Date(p.created_at).toLocaleDateString() : '-'}</td>
                  <td>
                    {p.status === 'pending' && (
                      <button
                        className="btn btn-success btn-sm"
                        disabled={confirmingId === p.id}
                        onClick={() => confirmPayment(p.id)}
                      >
                        {confirmingId === p.id ? 'Confirming...' : 'Confirm'}
                      </button>
                    )}
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

export default Payments;
