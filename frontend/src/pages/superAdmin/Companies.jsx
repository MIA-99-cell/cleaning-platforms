import { useEffect, useState } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { formatCFA } from '../../utils/currency';

const normalizeStatus = (status) => String(status || 'pending').toLowerCase();

const statusBadge = (status) => {
  const key = normalizeStatus(status);
  const map = { approved: 'success', pending: 'warning', suspended: 'danger', rejected: 'danger' };
  return <span className={`badge badge-${map[key] || 'secondary'}`}>{key}</span>;
};

const emailBadge = (verified) => (
  verified
    ? <span className="badge badge-success">Verified</span>
    : <span className="badge badge-secondary">Not verified</span>
);

const Companies = () => {
  const [companies, setCompanies] = useState([]);
  const [pendingCompanies, setPendingCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [updatingId, setUpdatingId] = useState(null);

  const fetchCompanies = async () => {
    setLoading(true);
    try {
      const params = { limit: 100 };
      if (search.trim()) params.search = search.trim();
      if (statusFilter !== 'all') params.status = statusFilter;

      const [listRes, pendingRes] = await Promise.all([
        api.get('/super-admin/companies', { params }),
        api.get('/super-admin/companies', { params: { status: 'pending', limit: 100 } }),
      ]);

      setCompanies(Array.isArray(listRes.data?.data) ? listRes.data.data : []);
      setPendingCompanies(Array.isArray(pendingRes.data?.data) ? pendingRes.data.data : []);
    } catch {
      toast.error('Failed to load companies');
      setCompanies([]);
      setPendingCompanies([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCompanies(); }, [statusFilter]);

  const updateStatus = async (id, status) => {
    if (status === 'rejected' && !confirm('Reject this company registration?')) return;
    if (status === 'approved' && !confirm('Approve this company? They will receive an email at their registered address and can then log in.')) return;

    setUpdatingId(id);
    try {
      const res = await api.patch(`/super-admin/companies/${id}/status`, { status });
      const { emailSent, tenantEmail } = res.data?.data || {};
      if (status === 'approved' && emailSent === false) {
        toast.error(res.data?.message || `Approved, but email to ${tenantEmail || 'tenant'} failed to send.`);
      } else {
        toast.success(res.data?.message || `Company ${status}`);
      }
      fetchCompanies();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update status');
    } finally {
      setUpdatingId(null);
    }
  };

  const deleteCompany = async (id) => {
    if (!confirm('Are you sure you want to delete this company?')) return;
    try {
      await api.delete(`/super-admin/companies/${id}`);
      toast.success('Company deleted');
      fetchCompanies();
    } catch {
      toast.error('Failed to delete');
    }
  };

  const renderActions = (c) => {
    const status = normalizeStatus(c.status);
    const busy = updatingId === c.id;

    return (
      <div className="company-actions">
        {status === 'pending' && (
          <>
            <button
              type="button"
              className="btn btn-success btn-sm"
              disabled={busy}
              onClick={() => updateStatus(c.id, 'approved')}
            >
              {busy ? '...' : 'Approve'}
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              disabled={busy}
              onClick={() => updateStatus(c.id, 'rejected')}
            >
              Reject
            </button>
          </>
        )}
        {status === 'approved' && (
          <button type="button" className="btn btn-warning btn-sm" disabled={busy} onClick={() => updateStatus(c.id, 'suspended')}>
            Suspend
          </button>
        )}
        {status === 'suspended' && (
          <button type="button" className="btn btn-success btn-sm" disabled={busy} onClick={() => updateStatus(c.id, 'approved')}>
            Activate
          </button>
        )}
        {status === 'rejected' && (
          <button type="button" className="btn btn-success btn-sm" disabled={busy} onClick={() => updateStatus(c.id, 'approved')}>
            Approve
          </button>
        )}
        <button type="button" className="btn btn-danger btn-sm" onClick={() => deleteCompany(c.id)}>Delete</button>
      </div>
    );
  };

  const renderRow = (c) => (
    <tr key={c.id} className={normalizeStatus(c.status) === 'pending' ? 'row-pending' : ''}>
      <td>
        <strong>{c.company_name || c.full_name}</strong>
        {c.license_number && <div className="text-muted-sm">License: {c.license_number}</div>}
      </td>
      <td>{c.email}</td>
      <td>{emailBadge(c.email_verified)}</td>
      <td>{statusBadge(c.status)}</td>
      <td>{c.cleaner_count ?? 0}</td>
      <td>{c.booking_count ?? 0}</td>
                  <td>{formatCFA(c.total_sales || 0)}</td>
                  <td>{formatCFA(c.monthly_sales || 0)}</td>
                  <td>{formatCFA(c.monthly_commission || 0)}</td>
                  <td>{renderActions(c)}</td>
    </tr>
  );

  return (
    <div>
      <div className="page-header">
        <h1>Company Management</h1>
        <div className="page-header-actions">
          <input
            className="form-control"
            style={{ maxWidth: 280 }}
            placeholder="Search companies..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchCompanies()}
          />
          <button type="button" className="btn btn-outline btn-sm" onClick={fetchCompanies}>Search</button>
        </div>
      </div>

      {pendingCompanies.length > 0 && (
        <div className="card pending-approval-card">
          <div className="pending-approval-header">
            <div>
              <h2>Pending Approval ({pendingCompanies.length})</h2>
              <p>Review and approve companies that have registered. They can log in after approval.</p>
            </div>
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Email</th>
                  <th>Email verified</th>
                  <th>Registered</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingCompanies.map((c) => (
                  <tr key={`pending-${c.id}`}>
                    <td><strong>{c.company_name || c.full_name}</strong></td>
                    <td>{c.email}</td>
                    <td>{emailBadge(c.email_verified)}</td>
                    <td>{c.created_at ? new Date(c.created_at).toLocaleDateString() : '—'}</td>
                    <td>{renderActions(c)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="status-tabs">
        {[
          { value: 'all', label: 'All' },
          { value: 'pending', label: 'Pending' },
          { value: 'approved', label: 'Approved' },
          { value: 'suspended', label: 'Suspended' },
          { value: 'rejected', label: 'Rejected' },
        ].map((tab) => (
          <button
            key={tab.value}
            type="button"
            className={`btn btn-sm ${statusFilter === tab.value ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setStatusFilter(tab.value)}
          >
            {tab.label}
            {tab.value === 'pending' && pendingCompanies.length > 0 && (
              <span className="tab-count">{pendingCompanies.length}</span>
            )}
          </button>
        ))}
      </div>

      <div className="card table-wrapper">
        {loading ? <p style={{ padding: '1rem' }}>Loading...</p> : companies.length === 0 ? (
          <p style={{ padding: '1rem', color: 'var(--text-muted)' }}>
            No companies found{statusFilter !== 'all' ? ` with status "${statusFilter}"` : ''}.
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Company</th>
                <th>Email</th>
                <th>Email verified</th>
                <th>Status</th>
                <th>Cleaners</th>
                <th>Bookings</th>
                <th>Total Sales (All Time)</th>
                <th>Sales (This Month)</th>
                <th>Your Cut (This Month)</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {companies.map(renderRow)}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default Companies;
