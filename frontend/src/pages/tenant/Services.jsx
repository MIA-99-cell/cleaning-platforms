import { useEffect, useState } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { formatCFA, CURRENCY_LABEL } from '../../utils/currency';

const Services = () => {
  const [services, setServices] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', price: '', duration_minutes: 60 });
  const [loading, setLoading] = useState(true);

  const fetchServices = () => {
    api.get('/tenant/services').then((res) => setServices(res.data.data)).finally(() => setLoading(false));
  };

  useEffect(() => { fetchServices(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/tenant/services', form);
      toast.success('Service created');
      setShowForm(false);
      setForm({ name: '', description: '', price: '', duration_minutes: 60 });
      fetchServices();
    } catch {
      toast.error('Failed to create service');
    }
  };

  const toggleService = async (id, is_active) => {
    await api.put(`/tenant/services/${id}`, { is_active: !is_active });
    fetchServices();
  };

  const deleteService = async (id) => {
    if (!confirm('Delete this service?')) return;
    await api.delete(`/tenant/services/${id}`);
    toast.success('Service deleted');
    fetchServices();
  };

  return (
    <div>
      <div className="page-header">
        <h1>Services</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : 'Add Service'}
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: '1.5rem', maxWidth: 500 }}>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Name</label>
              <input className="form-control" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea className="form-control" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Price ({CURRENCY_LABEL})</label>
              <input type="number" className="form-control" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>Duration (minutes)</label>
              <input type="number" className="form-control" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })} />
            </div>
            <button type="submit" className="btn btn-primary">Create Service</button>
          </form>
        </div>
      )}

      <div className="card table-wrapper">
        {loading ? <p>Loading...</p> : services.length === 0 ? (
          <div className="empty-state">No services yet. Add your first service.</div>
        ) : (
          <table>
            <thead>
              <tr><th>Name</th><th>Price</th><th>Duration</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {services.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>{formatCFA(s.price)}</td>
                  <td>{s.duration_minutes} min</td>
                  <td><span className={`badge badge-${s.is_active ? 'success' : 'secondary'}`}>{s.is_active ? 'Active' : 'Inactive'}</span></td>
                  <td>
                    <button className="btn btn-outline btn-sm" onClick={() => toggleService(s.id, s.is_active)}>
                      {s.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button className="btn btn-danger btn-sm" style={{ marginLeft: 4 }} onClick={() => deleteService(s.id)}>Delete</button>
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

export default Services;
