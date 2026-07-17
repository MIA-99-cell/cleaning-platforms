import { useState, useEffect } from 'react';

import api from '../services/api';

import { formatCFA } from '../utils/currency';

import toast from 'react-hot-toast';

import { printPaymentReceipt } from '../utils/receipt';

import { useCart } from '../contexts/CartContext';

import { useAuth } from '../contexts/AuthContext';

import {

  FLUTTERWAVE_NETWORKS,

  handleFlutterwaveResponse,

  initiateProductOrderFlutterwave,

} from '../utils/flutterwave';



const CartCheckoutModal = ({ onClose, onSuccess }) => {

  const { user } = useAuth();

  const { items, totalAmount, clearCart } = useCart();

  const [paymentMethod, setPaymentMethod] = useState('flutterwave');

  const [deliveryAddress, setDeliveryAddress] = useState('');

  const [deliveryPhone, setDeliveryPhone] = useState('');

  const [contactEmail, setContactEmail] = useState(user?.email || '');

  const [network, setNetwork] = useState('MTN');

  const [transactionRef, setTransactionRef] = useState('');

  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(false);



  useEffect(() => {

    if (user?.email) setContactEmail(user.email);

  }, [user?.email]);



  if (!items.length) return null;



  const handleSubmit = async (e) => {

    e.preventDefault();

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

          <div className="form-group">

            <label>Payment Method</label>

            <select className="form-control" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} required>

              <option value="flutterwave">Pay with Flutterwave (MoMo / Card)</option>

              <option value="cash_on_delivery">Pay on Delivery</option>

              <option value="mobile_money">Mobile Money (Manual)</option>

            </select>

          </div>

          <div className="form-group">

            <label>Delivery Address</label>

            <input className="form-control" value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} required />

          </div>

          <div className="form-group">

            <label>Email (required for order confirmation)</label>

            <input type="email" className="form-control" value={contactEmail}

              onChange={(e) => setContactEmail(e.target.value)} required />

          </div>

          <div className="form-group">

            <label>Phone Number</label>

            <input className="form-control" value={deliveryPhone} onChange={(e) => setDeliveryPhone(e.target.value)} placeholder="+237..." required />

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

              <input className="form-control" value={transactionRef} onChange={(e) => setTransactionRef(e.target.value)} placeholder="e.g. MTN-123456" />

            </div>

          )}

          <div className="form-group">

            <label>Notes (optional)</label>

            <textarea className="form-control" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />

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



export default CartCheckoutModal;

