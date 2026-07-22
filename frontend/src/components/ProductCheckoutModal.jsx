import { useState } from 'react';
import api from '../services/api';
import { formatCFA } from '../utils/currency';
import toast from 'react-hot-toast';
import { printPaymentReceipt } from '../utils/receipt';
import {
  FLUTTERWAVE_NETWORKS,
  handleFlutterwaveResponse,
  initiateProductOrderFlutterwave,
} from '../utils/flutterwave';
import './CartPanel.css';
import useLockBodyScroll from '../hooks/useLockBodyScroll';

const ProductCheckoutModal = ({ product, onClose, onSuccess }) => {
  const [paymentMethod, setPaymentMethod] = useState('flutterwave');
  const [quantity, setQuantity] = useState(1);
  const [fullName, setFullName] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryPhone, setDeliveryPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [network, setNetwork] = useState('MTN');
  const [transactionRef, setTransactionRef] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  useLockBodyScroll(!!product);

  if (!product) return null;

  const total = parseFloat(product.price) * quantity;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const ref = transactionRef || `MOMO-${Date.now()}`;
      const res = await api.post('/public/product-orders/cart', {
        full_name: fullName,
        email: contactEmail.trim(),
        items: [{ product_id: product.id, quantity }],
        payment_method: paymentMethod,
        delivery_address: deliveryAddress,
        delivery_phone: deliveryPhone,
        contact_email: contactEmail.trim(),
        transaction_ref: paymentMethod === 'mobile_money' ? ref : undefined,
        notes,
      });

      const data = res.data?.data;

      if (paymentMethod === 'flutterwave') {
        const flw = await initiateProductOrderFlutterwave({
          orderGroupId: data.order_group_id,
          phone: deliveryPhone,
          network,
          contactEmail: contactEmail.trim(),
        });
        handleFlutterwaveResponse(flw);
        toast.success('Order placed. Complete payment on your phone.');
      } else {
        toast.success(
          paymentMethod === 'cash_on_delivery'
            ? 'Order placed! Confirmation email sent.'
            : 'MoMo payment submitted! Confirmation email sent.'
        );
      }

      if (paymentMethod === 'mobile_money') {
        printPaymentReceipt({
          receipt_no: `ORD-${data?.orders?.[0]?.id || Date.now()}`,
          service_name: product.name,
          company_name: product.company_name,
          amount: total,
          payment_method: 'mobile_money',
          status: 'payment_pending',
          transaction_ref: ref,
          created_at: new Date().toISOString(),
        });
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Order failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="card modal-panel" onClick={(e) => e.stopPropagation()}>
        <h2 style={{ marginBottom: '0.35rem' }}>Buy Product</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
          {product.name} — {product.company_name}
        </p>
        <p style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1rem' }}>
          Total: {formatCFA(total)}
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Full Name</label>
            <input className="form-control" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Quantity</label>
            <input
              type="number"
              min={1}
              max={product.stock_quantity > 0 ? product.stock_quantity : 99}
              className="form-control"
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
              required
            />
          </div>
          <div className="form-group">
            <label>Payment Method</label>
            <select
              className="form-control"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              required
            >
              <option value="flutterwave">Pay with Flutterwave (MoMo / Card)</option>
              <option value="cash_on_delivery">Pay on Delivery</option>
              <option value="mobile_money">Mobile Money (Manual)</option>
            </select>
          </div>
          <div className="form-group">
            <label>Delivery Address</label>
            <input
              className="form-control"
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Email (required for order confirmation)</label>
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
              value={deliveryPhone}
              onChange={(e) => setDeliveryPhone(e.target.value)}
              placeholder="+237..."
              required
            />
          </div>
          {paymentMethod === 'flutterwave' && (
            <div className="form-group">
              <label>Mobile Money Network</label>
              <select className="form-control" value={network} onChange={(e) => setNetwork(e.target.value)} required>
                {FLUTTERWAVE_NETWORKS.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </div>
          )}
          {paymentMethod === 'mobile_money' && (
            <div className="form-group">
              <label>MoMo Transaction Reference</label>
              <input
                className="form-control"
                value={transactionRef}
                onChange={(e) => setTransactionRef(e.target.value)}
                placeholder="e.g. MTN-123456"
              />
            </div>
          )}
          <div className="form-group">
            <label>Notes (optional)</label>
            <textarea
              className="form-control"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Processing...' : paymentMethod === 'flutterwave' ? 'Pay with Flutterwave' : paymentMethod === 'mobile_money' ? 'Submit Payment' : 'Place Order'}
            </button>
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProductCheckoutModal;
