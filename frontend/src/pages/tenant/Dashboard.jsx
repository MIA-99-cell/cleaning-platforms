import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { formatCFA } from '../../utils/currency';
import TenantMap from '../../components/TenantMap';
import './Dashboard.css';

const StatCard = ({ title, value }) => (
  <div className="stat-card">
    <h3>{title}</h3>
    <div className="value">{value ?? 0}</div>
  </div>
);

const Stars = ({ rating }) => (
  <span className="tenant-rating-stars">
    {'★'.repeat(Math.round(rating || 0))}
    {'☆'.repeat(5 - Math.round(rating || 0))}
  </span>
);

const TenantDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/tenant/dashboard').then((res) => setData(res.data.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div>Loading...</div>;

  const company = data?.company;
  const reviews = data?.recentReviews || [];
  const rating = parseFloat(company?.rating || 0);
  const commissionRate = ((data?.platform_commission_rate || 0.05) * 100).toFixed(0);

  return (
    <div>
      <div className="page-header"><h1>Company Dashboard</h1></div>

      {!company?.email && (
        <div className="alert alert-warning" style={{ marginBottom: '1rem' }}>
          Company email is required for order and review notifications.{' '}
          <Link to="/tenant/company">Add email in Company Profile</Link>
        </div>
      )}

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ marginBottom: '0.35rem' }}>This Month&apos;s Earnings</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1rem' }}>
          CleanPro charges a {commissionRate}% platform fee on confirmed sales ({data?.commission_period || 'current month'}).
        </p>
        <div className="stats-grid" style={{ marginBottom: 0 }}>
          <StatCard title="Gross Sales" value={formatCFA(data?.monthly_gross_sales || 0)} />
          <StatCard title={`Platform Fee (${commissionRate}%)`} value={formatCFA(data?.monthly_platform_fee || 0)} />
          <StatCard title="Your Net Earnings" value={formatCFA(data?.monthly_net_earnings || 0)} />
        </div>
      </div>

      <div className="stats-grid">
        <StatCard title="Today's Jobs" value={data?.todays_jobs} />
        <StatCard title="Pending Jobs" value={data?.pending_jobs} />
        <StatCard title="Completed Jobs" value={data?.completed_jobs} />
        <StatCard title="Cancelled Jobs" value={data?.cancelled_jobs} />
        <StatCard title="Today's Sales" value={formatCFA(data?.todays_sales || 0)} />
        <StatCard title="Total Customers" value={data?.total_customers} />
        <StatCard title="Total Cleaners" value={data?.total_cleaners} />
        <StatCard title="Customer Rating" value={`${rating.toFixed(1)} ★`} />
        <StatCard title="Total Reviews" value={company?.total_reviews ?? 0} />
      </div>

      <div className="tenant-dashboard-grid">
        <TenantMap company={company} />

        <div className="card tenant-reviews-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h3>Customer Reviews</h3>
            <Link to="/tenant/reviews" className="btn btn-outline btn-sm">View All</Link>
          </div>

          <div className="tenant-rating-summary">
            <div className="tenant-rating-big">{rating.toFixed(1)}</div>
            <div>
              <Stars rating={rating} />
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {company?.total_reviews ?? 0} review(s)
              </p>
            </div>
          </div>

          {reviews.length === 0 ? (
            <p className="tenant-map-empty">No reviews yet. Reviews appear after customers complete bookings.</p>
          ) : (
            reviews.map((r) => (
              <div key={r.id} className="tenant-review-item">
                <div className="tenant-review-meta">
                  <strong>{r.customer_name}</strong>
                  <span>
                    {'★'.repeat(r.company_rating)}
                    {r.cleaner_rating ? ` | Cleaner ${'★'.repeat(r.cleaner_rating)}` : ''}
                  </span>
                </div>
                {r.comment && <p className="tenant-review-comment">{r.comment}</p>}
                {r.tenant_reply && <p className="tenant-review-reply">Your reply: {r.tenant_reply}</p>}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default TenantDashboard;
