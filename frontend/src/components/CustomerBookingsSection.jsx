import { useEffect, useState } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { formatCFA } from '../utils/currency';
import PaymentModal, { canPayBooking } from './PaymentModal';

const CustomerBookingsSection = ({ refreshKey = 0 }) => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [payBooking, setPayBooking] = useState(null);
  const [reviewForm, setReviewForm] = useState(null);

  const fetchBookings = () => {
    setLoading(true);
    api.get('/customer/bookings')
      .then((res) => setBookings(res.data.data || []))
      .catch(() => setBookings([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchBookings(); }, [refreshKey]);

  const submitReview = async (e) => {
    e.preventDefault();
    try {
      await api.post('/customer/reviews', reviewForm);
      toast.success('Review submitted');
      setReviewForm(null);
      fetchBookings();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit review');
    }
  };

  return (
    <section className="landing-bookings">
      <PaymentModal
        booking={payBooking}
        onClose={() => setPayBooking(null)}
        onSuccess={fetchBookings}
      />

      <div className="landing-services-header">
        <h3>My Bookings</h3>
        <p>View, pay, and review your cleaning bookings — all from the home page.</p>
      </div>

      {loading ? (
        <p className="landing-services-empty">Loading your bookings...</p>
      ) : bookings.length === 0 ? (
        <p className="landing-services-empty">No bookings yet. Book a service below to get started.</p>
      ) : (
        <div className="landing-bookings-list">
          {bookings.map((b) => (
            <article key={b.id} className="landing-booking-card">
              <div className="landing-booking-main">
                <strong>{b.service_name}</strong>
                <span className="service-company">{b.company_name}</span>
                <p className="landing-booking-meta">
                  {b.scheduled_date?.split('T')[0]} at {String(b.scheduled_time || '').slice(0, 5)}
                  {' · '}{formatCFA(b.total_amount)}
                  {b.cleaner_name ? ` · Cleaner: ${b.cleaner_name}` : ''}
                </p>
              </div>
              <div className="landing-booking-actions">
                <span className="badge badge-info">{b.status}</span>
                {b.payment_status === 'pending' && (
                  <span className="badge badge-warning">Payment Pending</span>
                )}
                {b.payment_status === 'confirmed' && (
                  <span className="badge badge-success">Paid</span>
                )}
                {canPayBooking(b) && (
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => setPayBooking(b)}>
                    Pay
                  </button>
                )}
                {b.status === 'completed' && !b.review_id && (
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => setReviewForm({
                      booking_id: b.id, company_rating: 5, cleaner_rating: 5, comment: '',
                    })}
                  >
                    Review
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {reviewForm && (
        <div className="landing-modal-backdrop">
          <div className="card landing-modal">
            <h2 style={{ marginBottom: '1rem' }}>Leave a Review</h2>
            <form onSubmit={submitReview}>
              <div className="form-group">
                <label>Company Rating (1-5)</label>
                <input type="number" min={1} max={5} className="form-control" value={reviewForm.company_rating}
                  onChange={(e) => setReviewForm({ ...reviewForm, company_rating: parseInt(e.target.value, 10) })} required />
              </div>
              <div className="form-group">
                <label>Cleaner Rating (1-5)</label>
                <input type="number" min={1} max={5} className="form-control" value={reviewForm.cleaner_rating}
                  onChange={(e) => setReviewForm({ ...reviewForm, cleaner_rating: parseInt(e.target.value, 10) })} />
              </div>
              <div className="form-group">
                <label>Comment</label>
                <textarea className="form-control" rows={3} value={reviewForm.comment}
                  onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })} />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="submit" className="btn btn-primary">Submit Review</button>
                <button type="button" className="btn btn-outline" onClick={() => setReviewForm(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};

export default CustomerBookingsSection;
