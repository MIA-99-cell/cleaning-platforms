import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { formatCFA } from '../../utils/currency';

const StatCard = ({ title, value, highlight }) => (
  <div className="stat-card" style={highlight ? { borderColor: 'var(--warning)', borderWidth: 2 } : {}}>
    <h3>{title}</h3>
    <div className="value">{value ?? 0}</div>
  </div>
);

const SuperAdminDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/super-admin/dashboard').then((res) => setData(res.data.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div>Loading dashboard...</div>;
  const stats = data?.stats || {};
  const commissionHistory = data?.commissionHistory || [];
  const commissionRate = ((stats.platform_commission_rate || 0.05) * 100).toFixed(0);

  return (
    <div>
      <div className="page-header"><h1>Platform Dashboard</h1></div>

      {stats.pending_approval > 0 && (
        <div className="card" style={{
          marginBottom: '1.5rem', background: '#fef3c7', borderColor: '#d97706',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem',
        }}>
          <div>
            <strong style={{ color: '#92400e' }}>
              {stats.pending_approval} compan{stats.pending_approval === 1 ? 'y' : 'ies'} awaiting your approval
            </strong>
            <p style={{ fontSize: '0.875rem', color: '#92400e', margin: '0.25rem 0 0' }}>
              Check your email/SMS for one-click approve links, or approve from the Companies page.
            </p>
          </div>
          <Link to="/super-admin/companies" className="btn btn-primary">Review Companies</Link>
        </div>
      )}

      <div className="card" style={{ marginBottom: '1.5rem', borderColor: '#2563eb' }}>
        <h3 style={{ marginBottom: '0.35rem' }}>Platform Commission ({commissionRate}%)</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1rem' }}>
          CleanPro earns {commissionRate}% of tenant sales — that is your platform revenue, not the full sales amount.
          Period: {stats.platform_commission_period || 'current month'}
        </p>
        <div className="stats-grid" style={{ marginBottom: 0 }}>
          <StatCard title="This Month's Commission (Your Revenue)" value={formatCFA(stats.platform_commission_this_month || 0)} highlight />
          <StatCard title="Tenant Sales This Month" value={formatCFA(stats.platform_gross_sales_this_month || 0)} />
        </div>
      </div>

      {commissionHistory.length > 0 && (
        <div className="card table-wrapper" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>Commission History</h3>
          <table>
            <thead>
              <tr>
                <th>Month</th>
                <th>Total Tenant Sales</th>
                <th>Your Platform Revenue ({commissionRate}%)</th>
                <th>Transactions</th>
              </tr>
            </thead>
            <tbody>
              {commissionHistory.map((row) => (
                <tr key={row.period_month}>
                  <td>{row.period_month}</td>
                  <td>{formatCFA(row.gross_sales || 0)}</td>
                  <td>{formatCFA(row.platform_commission || 0)}</td>
                  <td>{row.transaction_count || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="stats-grid">
        <StatCard title="Pending Approval" value={stats.pending_approval} highlight={stats.pending_approval > 0} />
        <StatCard title="Total Companies" value={stats.total_companies} />
        <StatCard title="Active Companies" value={stats.active_companies} />
        <StatCard title="Total Cleaners" value={stats.total_cleaners} />
        <StatCard title="Total Customers" value={stats.total_customers} />
        <StatCard title="Total Bookings" value={stats.total_bookings} />
        <StatCard title="Total Tenant Sales (All Time)" value={formatCFA(stats.total_tenant_sales || 0)} />
        <StatCard title="Platform Revenue (All Time)" value={formatCFA(stats.total_platform_revenue || 0)} highlight />
        <StatCard title="Pending Bookings" value={stats.pending_bookings} />
        <StatCard title="Completed Bookings" value={stats.completed_bookings} />
        <StatCard title="Suspended Companies" value={stats.suspended_companies} />
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
