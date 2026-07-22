import { useState } from 'react';
import api from '../services/api';
import { formatCFA } from '../utils/currency';
import toast from 'react-hot-toast';
import { printPaymentReceipt } from '../utils/receipt';
import {
  FLUTTERWAVE_NETWORKS,
  handleFlutterwaveResponse,
  initiateBookingFlutterwave,
} from '../utils/flutterwave';
import './CartPanel.css';
import useLockBodyScroll from '../hooks/useLockBodyScroll';

const PaymentModal = ({ booking, onClose, onSuccess }) => {
  const [method, setMethod] = useState('flutterwave');
  const [transactionRef, setTransactionRef] = useState('');
  const [phone, setPhone] = useState(booking?.customer_phone || '');
  const [network, setNetwork] = useState('MTN');
  const [contactEmail, setContactEmail] = useState(booking?.customer_email || '');
  const [loading, setLoading] = useState(false);

  useLockBodyScroll(!!booking);

  if (!booking) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (method === 'flutterwave') {
        const data = await initiateBookingFlutterwave({
          bookingId: booking.id,
          phone,
          network,
          contactEmail: contactEmail.trim(),
        });
        handleFlutterwaveResponse(data);
        toast.success('Flutterwave payment started. Approve the prompt on your phone.');
        onSuccess?.();
        onClose();
        return;
      }

      const ref = transactionRef || `TXN-${Date.now()}`;
      const res = await api.post('/public/payments', {
        booking_id: booking.id,
        email: contactEmail.trim(),
        payment_method: method,
        transaction_ref: ref,
      });
      toast.success('Payment submitted successfully');
      printPaymentReceipt({
        receipt_no: `RCP-${res.data?.data?.id || Date.now()}`,
        service_name: booking.service_name,
        company_name: booking.company_name,
        amount: booking.total_amount,
        payment_method: method,
        status: 'pending',
        transaction_ref: ref,
        created_at: new Date().toISOString(),
      });
      onSuccess?.();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Payment failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="card modal-panel" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ marginBottom: '0.5rem' }}>Make Payment</h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
          {booking.service_name} — {booking.company_name}
        </p>
        <p style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>
          Amount: {formatCFA(booking.total_amount)}
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Payment Method</label>
            <select className="form-control" value={method} onChange={(e) => setMethod(e.target.value)} required>
              <option value="flutterwave">Pay with Flutterwave (MoMo / Card)</option>
              <option value="mobile_money">Mobile Money (Manual)</option>
              <option value="card">Card Payment (Manual)</option>
              <option value="cash">Cash</option>
            </select>
          </div>

          {method === 'flutterwave' && (
            <>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  className="form-control"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label>Phone Number</label>
                <input
                  className="form-control"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="670000000"
                  required
                />
              </div>
              <div className="form-group">
                <label>Mobile Money Network</label>
                <select className="form-control" value={network} onChange={(e) => setNetwork(e.target.value)} required>
                  {FLUTTERWAVE_NETWORKS.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {method !== 'flutterwave' && (
            <div className="form-group">
              <label>Transaction Reference (optional)</label>
              <input className="form-control" value={transactionRef}
                onChange={(e) => setTransactionRef(e.target.value)} placeholder="e.g. MTN-123456" />
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Processing...' : method === 'flutterwave' ? 'Pay with Flutterwave' : 'Submit Payment'}
            </button>
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const canPayBooking = (booking) => {
  if (!booking) return false;
  const blocked = ['cancelled', 'rejected', 'completed'];
  if (blocked.includes(booking.status)) return false;
  if (booking.payment_status === 'confirmed') return false;
  if (booking.payment_status === 'pending') return false;
  return true;
};

export default PaymentModal;
