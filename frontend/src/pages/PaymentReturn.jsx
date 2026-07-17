import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { verifyFlutterwavePayment } from '../utils/flutterwave';
import { formatCFA } from '../utils/currency';

const PaymentReturn = () => {
  const { ref: refParam } = useParams();
  const [searchParams] = useSearchParams();
  const reference = refParam || searchParams.get('ref') || '';
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!reference) {
      setError('Missing payment reference.');
      setLoading(false);
      return;
    }

    verifyFlutterwavePayment(reference)
      .then((data) => setResult(data))
      .catch((err) => {
        setError(err.response?.data?.message || 'Could not verify payment.');
      })
      .finally(() => setLoading(false));
  }, [reference]);

  const confirmed = result?.confirmed;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div className="card" style={{ width: '100%', maxWidth: 480 }}>
        <h2 style={{ marginBottom: '0.75rem' }}>Payment Status</h2>

        {loading && <p>Verifying your payment...</p>}

        {!loading && error && (
          <>
            <p style={{ color: 'var(--danger, #c0392b)' }}>{error}</p>
            <Link to="/customer" className="btn btn-outline" style={{ marginTop: '1rem', display: 'inline-block' }}>
              Go to Dashboard
            </Link>
          </>
        )}

        {!loading && !error && result && (
          <>
            <p style={{ marginBottom: '0.5rem' }}>
              Reference: <strong>{reference}</strong>
            </p>
            {result.amount != null && (
              <p style={{ marginBottom: '0.5rem' }}>
                Amount: <strong>{formatCFA(result.amount)}</strong>
              </p>
            )}
            <p style={{ marginBottom: '1rem' }}>
              Status:{' '}
              <span className={`badge ${confirmed ? 'badge-success' : 'badge-warning'}`}>
                {confirmed ? 'Confirmed' : result.status || 'Pending'}
              </span>
            </p>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
              {confirmed
                ? 'Your payment was successful.'
                : 'Payment is still pending. If you approved on your phone, wait a moment and refresh.'}
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <Link to="/customer/bookings" className="btn btn-primary">My Bookings</Link>
              <Link to="/customer/marketplace" className="btn btn-outline">Marketplace</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PaymentReturn;
