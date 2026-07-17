import { useEffect, useState } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const Reviews = () => {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchReviews = () => {
    api.get('/tenant/reviews').then((res) => setReviews(res.data.data)).finally(() => setLoading(false));
  };

  useEffect(() => { fetchReviews(); }, []);

  const replyToReview = async (id) => {
    const reply = prompt('Enter your reply:');
    if (!reply) return;
    try {
      await api.post(`/tenant/reviews/${id}/reply`, { reply });
      toast.success('Reply added');
      fetchReviews();
    } catch {
      toast.error('Failed to reply');
    }
  };

  const hideReview = async (id) => {
    await api.delete(`/tenant/reviews/${id}`);
    toast.success('Review hidden');
    fetchReviews();
  };

  return (
    <div>
      <div className="page-header"><h1>Reviews</h1></div>
      <div className="card">
        {loading ? <p>Loading...</p> : reviews.length === 0 ? (
          <div className="empty-state">No reviews yet</div>
        ) : reviews.map((r) => (
          <div key={r.id} style={{ padding: '1rem 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <strong>{r.customer_name}</strong>
              <span>Company: {'★'.repeat(r.company_rating)} {r.cleaner_rating && `| Cleaner: ${'★'.repeat(r.cleaner_rating)}`}</span>
            </div>
            <p style={{ margin: '0.5rem 0' }}>{r.comment}</p>
            {r.tenant_reply && <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Reply: {r.tenant_reply}</p>}
            <div style={{ marginTop: '0.5rem' }}>
              <button className="btn btn-outline btn-sm" onClick={() => replyToReview(r.id)}>Reply</button>
              <button className="btn btn-danger btn-sm" style={{ marginLeft: 4 }} onClick={() => hideReview(r.id)}>Hide</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Reviews;
