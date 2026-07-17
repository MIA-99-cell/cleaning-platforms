import { useEffect, useState } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { formatCFA } from '../../utils/currency';
import PaymentModal, { canPayBooking } from '../../components/PaymentModal';

const CustomerBookings = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reviewForm, setReviewForm] = useState(null);
  const [payBooking, setPayBooking] = useState(null);

  const fetchBookings = () => {
    setLoading(true);
    setError('');
    api.get('/customer/bookings')
      .then((res) => setBookings(res.data.data || []))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load bookings'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchBookings(); }, []);

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

  const makePayment = async (booking) => {
    setPayBooking(booking);
  };

  return (
    <div>
      <PaymentModal
        booking={payBooking}
        onClose={() => setPayBooking(null)}
        onSuccess={fetchBookings}
      />
      <div className="page-header"><h1>My Bookings</h1></div>
      <div className="card table-wrapper">
        {loading ? <p>Loading...</p> : error ? (
          <div className="empty-state">{error}</div>
        ) : bookings.length === 0 ? (
          <div className="empty-state">No bookings yet. Browse services to book your first cleaning.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Company</th>
                <th>Service</th>
                <th>Date</th>
                <th>Time</th>
                <th>Amount</th>
                <th>Cleaner</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.id}>
                  <td>{b.company_name}</td>
                  <td>{b.service_name}</td>
                  <td>{b.scheduled_date?.split('T')[0]}</td>
                  <td>{b.scheduled_time}</td>
                  <td>{formatCFA(b.total_amount)}</td>
                  <td>{b.cleaner_name || '-'}</td>
                  <td><span className="badge badge-info">{b.status}</span></td>
                  <td>
                    {canPayBooking(b) && (
                      <button className="btn btn-primary btn-sm" onClick={() => makePayment(b)}>Pay</button>
                    )}
                    {b.payment_status === 'pending' && (
                      <span className="badge badge-warning">Payment Pending</span>
                    )}
                    {b.payment_status === 'confirmed' && (
                      <span className="badge badge-success">Paid</span>
                    )}
                    {b.status === 'completed' && !b.review_id && (
                      <button className="btn btn-outline btn-sm" onClick={() => setReviewForm({
                        booking_id: b.id, company_rating: 5, cleaner_rating: 5, comment: '',
                      })}>Review</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {reviewForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div className="card" style={{ width: '100%', maxWidth: 420 }}>
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
    </div>
  );
};

export default CustomerBookings;
