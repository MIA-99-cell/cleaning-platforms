import { useEffect, useState } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { formatCFA } from '../../utils/currency';

const Customers = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchCustomers = () => {
    api.get('/tenant/customers')
      .then((res) => setCustomers(res.data.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchCustomers(); }, []);

  const toggleBlacklist = async (customer) => {
    const reason = customer.is_blacklisted ? null : prompt('Blacklist reason:');
    if (!customer.is_blacklisted && !reason) return;
    try {
      await api.patch(`/tenant/customers/${customer.id}/blacklist`, {
        is_blacklisted: !customer.is_blacklisted,
        blacklist_reason: reason,
      });
      toast.success(customer.is_blacklisted ? 'Customer unblocked' : 'Customer blacklisted');
      fetchCustomers();
    } catch {
      toast.error('Action failed');
    }
  };

  return (
    <div>
      <div className="page-header"><h1>Customers</h1></div>
      <div className="card table-wrapper">
        {loading ? <p>Loading...</p> : customers.length === 0 ? (
          <div className="empty-state">No customers yet</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Bookings</th>
                <th>Total Spent</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id}>
                  <td>{c.full_name}</td>
                  <td>{c.email}</td>
                  <td>{c.phone || '-'}</td>
                  <td>{c.total_bookings}</td>
                  <td>{formatCFA(c.total_spent || 0)}</td>
                  <td>
                    <span className={`badge badge-${c.is_blacklisted ? 'danger' : 'success'}`}>
                      {c.is_blacklisted ? 'Blacklisted' : 'Active'}
                    </span>
                  </td>
                  <td>
                    <button className={`btn btn-sm ${c.is_blacklisted ? 'btn-success' : 'btn-danger'}`}
                      onClick={() => toggleBlacklist(c)}>
                      {c.is_blacklisted ? 'Unblock' : 'Blacklist'}
                    </button>
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

export default Customers;
