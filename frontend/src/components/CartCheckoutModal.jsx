import api from '../services/api';
import { formatCFA } from '../utils/currency';
import toast from 'react-hot-toast';
import { printPaymentReceipt } from '../utils/receipt';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import { useCheckoutForm } from '../utils/useCheckoutForm';
import CheckoutFields from './CheckoutFields';
import {
  handleFlutterwaveResponse,
  initiateProductOrderFlutterwave,
} from '../utils/flutterwave';

const CartCheckoutModal = ({ onClose, onSuccess }) => {
  const { user } = useAuth();
  const { items, totalAmount, clearCart } = useCart();
  const checkout = useCheckoutForm(user);

  if (!items.length) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const {
      paymentMethod, deliveryAddress, deliveryPhone, contactEmail,
      network, transactionRef, notes, setLoading,
    } = checkout;
    setLoading(true);
    try {
      const ref = transactionRef || `MOMO-${Date.now()}`;
      const res = await api.post('/customer/product-orders/cart', {
        items: items.map((i) => ({ product_id: i.id, quantity: i.quantity })),
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
            : 'Payment submitted! Confirmation email sent.'
        );
      }

      if (paymentMethod === 'mobile_money') {
        printPaymentReceipt({
          receipt_no: `CART-${data?.order_group_id?.slice(0, 8) || Date.now()}`,
          service_name: `${items.length} marketplace item(s)`,
          company_name: 'CleanPro Marketplace',
          amount: data?.total_amount || totalAmount,
          payment_method: 'mobile_money',
          status: 'payment_pending',
          transaction_ref: ref,
          created_at: new Date().toISOString(),
        });
      }

      clearCart();
      onSuccess?.();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Checkout failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cart-checkout-overlay">
      <div className="card cart-checkout-modal">
        <h2>Checkout Cart</h2>
        <p className="cart-checkout-subtitle">{items.length} item(s) in your cart</p>

        <div className="cart-checkout-items">
          {items.map((item) => (
            <div key={item.id} className="cart-checkout-line">
              <span>{item.name} x{item.quantity}</span>
              <strong>{formatCFA(parseFloat(item.price) * item.quantity)}</strong>
            </div>
          ))}
        </div>

        <p className="cart-checkout-total">Total: {formatCFA(totalAmount)}</p>

        <form onSubmit={handleSubmit}>
          <CheckoutFields checkout={checkout} onClose={onClose} />
        </form>
      </div>
    </div>
  );
};

export default CartCheckoutModal;
