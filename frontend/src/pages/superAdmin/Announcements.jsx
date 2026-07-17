import { useState } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const Announcements = () => {
  const [form, setForm] = useState({ title: '', message: '', type: 'info' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/super-admin/announcements', form);
      toast.success('Announcement sent');
      setForm({ title: '', message: '', type: 'info' });
    } catch {
      toast.error('Failed to send announcement');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="page-header"><h1>Send Announcement</h1></div>
      <div className="card" style={{ maxWidth: 600 }}>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Title</label>
            <input className="form-control" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          </div>
          <div className="form-group">
            <label>Type</label>
            <select className="form-control" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="info">Announcement</option>
              <option value="warning">Maintenance Notice</option>
              <option value="success">Success / Update</option>
              <option value="error">Urgent Alert</option>
            </select>
          </div>
          <div className="form-group">
            <label>Message</label>
            <textarea className="form-control" rows={5} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} required />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Sending...' : 'Send Announcement'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Announcements;
