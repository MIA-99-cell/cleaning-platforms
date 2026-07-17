import { useEffect, useState } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { formatCFA } from '../../utils/currency';

const statusBadge = (status) => {
  const map = { approved: 'success', pending: 'warning', suspended: 'danger', rejected: 'danger' };
  return <span className={`badge badge-${map[status] || 'secondary'}`}>{status}</span>;
};

const Companies = () => {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchCompanies = () => {
    api.get('/super-admin/companies', { params: { search } })
      .then((res) => setCompanies(res.data.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchCompanies(); }, []);

  const updateStatus = async (id, status) => {
    try {
      await api.patch(`/super-admin/companies/${id}/status`, { status });
      toast.success(`Company ${status}`);
      fetchCompanies();
    } catch {
      toast.error('Failed to update status');
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

  return (
    <div>
      <div className="page-header">
        <h1>Company Management</h1>
        <input className="form-control" style={{ maxWidth: 300 }} placeholder="Search companies..."
          value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && fetchCompanies()} />
      </div>

      <div className="card table-wrapper">
        {loading ? <p>Loading...</p> : (
          <table>
            <thead>
              <tr>
                <th>Company</th>
                <th>Email</th>
                <th>Status</th>
                <th>Cleaners</th>
                <th>Bookings</th>
                <th>Revenue</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => (
                <tr key={c.id}>
                  <td>{c.company_name || c.full_name}</td>
                  <td>{c.email}</td>
                  <td>{statusBadge(c.status)}</td>
                  <td>{c.cleaner_count}</td>
                  <td>{c.booking_count}</td>
                  <td>{formatCFA(c.revenue || 0)}</td>
                  <td>
                    {c.status === 'pending' && <button className="btn btn-success btn-sm" onClick={() => updateStatus(c.id, 'approved')}>Approve</button>}
                    {c.status === 'approved' && <button className="btn btn-warning btn-sm" onClick={() => updateStatus(c.id, 'suspended')}>Suspend</button>}
                    {c.status === 'suspended' && <button className="btn btn-success btn-sm" onClick={() => updateStatus(c.id, 'approved')}>Activate</button>}
                    <button className="btn btn-danger btn-sm" style={{ marginLeft: 4 }} onClick={() => deleteCompany(c.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default Companies;
