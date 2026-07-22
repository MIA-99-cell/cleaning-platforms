import { useState } from 'react';
import api from '../services/api';
import { formatCFA } from '../utils/currency';
import toast from 'react-hot-toast';
import { printPaymentReceipt } from '../utils/receipt';
import { useAuth } from '../contexts/AuthContext';
import { useCheckoutForm } from '../utils/useCheckoutForm';
import CheckoutFields from './CheckoutFields';
import {
  handleFlutterwaveResponse,
  initiateProductOrderFlutterwave,
} from '../utils/flutterwave';

const ProductCheckoutModal = ({ product, onClose, onSuccess }) => {
  const { user } = useAuth();
  const checkout = useCheckoutForm(user);
  const [quantity, setQuantity] = useState(1);

  if (!product) return null;

  const total = parseFloat(product.price) * quantity;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const {
      paymentMethod, deliveryAddress, deliveryPhone, contactEmail,
      network, transactionRef, notes, setLoading,
    } = checkout;
    setLoading(true);
    try {
      const ref = transactionRef || `MOMO-${Date.now()}`;
      const res = await api.post('/customer/product-orders', {
        product_id: product.id,
        quantity,
        payment_method: paymentMethod,
        delivery_address: deliveryAddress,
        delivery_phone: deliveryPhone,
        contact_email: contactEmail.trim(),
        transaction_ref: paymentMethod === 'mobile_money' ? ref : undefined,
        notes,
      });

      const order = res.data?.data;

      if (paymentMethod === 'flutterwave') {
        const flw = await initiateProductOrderFlutterwave({
          orderGroupId: order.order_group_id,
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
          receipt_no: `ORD-${order?.id || Date.now()}`,
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
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
      <div className="card" style={{ width: '100%', maxWidth: 460, maxHeight: '90vh', overflowY: 'auto' }}>
        <h2 style={{ marginBottom: '0.35rem' }}>Buy Product</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
          {product.name} — {product.company_name}
        </p>
        <p style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1rem' }}>
          Total: {formatCFA(total)}
        </p>

        <form onSubmit={handleSubmit}>
          <CheckoutFields checkout={checkout} onClose={onClose}>
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
          </CheckoutFields>
        </form>
      </div>
    </div>
  );
};

export default ProductCheckoutModal;
