import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useBookingCart } from '../contexts/BookingCartContext';
import { formatCFA } from '../utils/currency';
import PaymentModal from './PaymentModal';
import api from '../services/api';
import toast from 'react-hot-toast';
import './CartPanel.css';

const ServiceBookingPanel = ({ open, onClose }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const {
    items, totalItems, totalAmount, removeBooking, clearCart,
  } = useBookingCart();
  const [payBooking, setPayBooking] = useState(null);
  const [payingId, setPayingId] = useState(null);

  const handleMakePayment = async (item) => {
    if (!user) {
      toast('Please sign in as a customer to book and pay.', { icon: 'ℹ️' });
      navigate('/login');
      return;
    }
    if (user.role !== 'customer') {
      toast.error('Only customer accounts can book services.');
      return;
    }

    setPayingId(item.cartId);
    try {
      const res = await api.post('/customer/bookings', {
        service_id: item.service_id,
        scheduled_date: item.scheduled_date,
        scheduled_time: item.scheduled_time,
        address: item.address,
        special_instructions: item.special_instructions || '',
      });
      const bookingId = res.data?.data?.id;
      if (!bookingId) throw new Error('Missing booking id');

      removeBooking(item.cartId);
      onClose();
      setPayBooking({
        id: bookingId,
        service_name: item.name,
        company_name: item.company_name,
        total_amount: item.price,
      });
      toast.success('Booking saved. Complete payment now.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Booking failed');
    } finally {
      setPayingId(null);
    }
  };

  if (!open && !payBooking) return null;

  return (
    <>
      <PaymentModal
        booking={payBooking}
        onClose={() => setPayBooking(null)}
        onSuccess={() => {
          if (items.length === 0) clearCart();
        }}
      />

      {open && (
        <>
          <div className="cart-backdrop" onClick={onClose} />
          <aside className="cart-drawer card booking-drawer">
            <div className="cart-drawer-header">
              <h3>Booking Cart ({totalItems})</h3>
              <button type="button" className="icon-btn" onClick={onClose}>✕</button>
            </div>

            {items.length === 0 ? (
              <p className="cart-empty">No services in your booking cart. Click Book Now on a service to add one.</p>
            ) : (
              <>
                <div className="cart-items">
                  {items.map((item) => (
                    <div key={item.cartId} className="cart-item">
                      <div>
                        <strong>{item.name}</strong>
                        <p>{item.company_name}</p>
                        <p>{formatCFA(item.price)}</p>
                        <p className="booking-cart-meta">
                          {item.scheduled_date} at {String(item.scheduled_time || '').slice(0, 5)}
                        </p>
                        <p className="booking-cart-meta">{item.address}</p>
                      </div>
                      <div className="cart-item-actions">
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          disabled={payingId === item.cartId}
                          onClick={() => handleMakePayment(item)}
                        >
                          {payingId === item.cartId ? '...' : 'Make Payment'}
                        </button>
                        <button type="button" className="btn btn-danger btn-sm" onClick={() => removeBooking(item.cartId)}>
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="cart-footer">
                  <strong>Total: {formatCFA(totalAmount)}</strong>
                </div>
              </>
            )}
          </aside>
        </>
      )}
    </>
  );
};

export default ServiceBookingPanel;
