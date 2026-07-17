import { useEffect, useState } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const CompanyProfile = () => {
  const [form, setForm] = useState({
    company_name: '', address: '', phone: '', email: '', license_number: '', description: '',
    latitude: '', longitude: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/tenant/company').then((res) => {
      if (res.data.data) {
        const d = res.data.data;
        setForm({
          company_name: d.company_name || '',
          address: d.address || '',
          phone: d.phone || '',
          email: d.email || '',
          license_number: d.license_number || '',
          description: d.description || '',
          latitude: d.latitude ?? '',
          longitude: d.longitude ?? '',
        });
      }
    }).finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/tenant/company', form);
      toast.success('Profile updated');
    } catch {
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <div className="page-header"><h1>Company Profile</h1></div>
      <div className="card" style={{ maxWidth: 600 }}>
        <form onSubmit={handleSubmit}>
          {['company_name', 'address', 'phone', 'license_number'].map((field) => (
            <div className="form-group" key={field}>
              <label>{field.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}</label>
              <input className="form-control" name={field} value={form[field] || ''}
                onChange={(e) => setForm({ ...form, [field]: e.target.value })} />
            </div>
          ))}
          <div className="form-group">
            <label>Email (required)</label>
            <input type="email" className="form-control" name="email" value={form.email || ''}
              onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            <small style={{ color: 'var(--text-muted)' }}>Used for order alerts and customer review notifications</small>
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea className="form-control" rows={4} value={form.description || ''}
              onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="form-group">
              <label>Latitude</label>
              <input type="number" step="any" className="form-control" placeholder="e.g. 4.0511"
                value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Longitude</label>
              <input type="number" step="any" className="form-control" placeholder="e.g. 9.7679"
                value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} />
            </div>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Set latitude and longitude to show your company on the dashboard map. You can find coordinates from Google Maps (right-click a place → coordinates).
          </p>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CompanyProfile;
