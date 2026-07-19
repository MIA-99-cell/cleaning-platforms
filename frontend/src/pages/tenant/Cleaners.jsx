import { useEffect, useState } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const CredentialsModal = ({ credentials, onClose }) => {
  if (!credentials) return null;

  const copyAll = () => {
    const text = `CleanPro Login Credentials\nEmail: ${credentials.email}\nPassword: ${credentials.tempPassword}\nLogin as: Cleaner\nURL: ${window.location.origin}/login`;
    navigator.clipboard.writeText(text);
    toast.success('Credentials copied to clipboard');
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
      <div className="card" style={{ width: '100%', maxWidth: 440 }}>
        <h2 style={{ marginBottom: '0.5rem' }}>Cleaner Credentials</h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
          {credentials.emailSent
            ? 'Credentials have been emailed to the cleaner.'
            : 'Email could not be sent. Share these credentials with the cleaner manually.'}
        </p>

        <div style={{ background: '#f1f5f9', padding: '1rem', borderRadius: 8, marginBottom: '1rem', fontSize: '0.875rem' }}>
          <p><strong>Name:</strong> {credentials.name}</p>
          <p><strong>Email:</strong> {credentials.email}</p>
          <p><strong>Temporary Password:</strong> <code style={{ background: '#e2e8f0', padding: '2px 6px', borderRadius: 4 }}>{credentials.tempPassword}</code></p>
          <p style={{ marginTop: '0.5rem', color: 'var(--text-muted)' }}>Cleaner must select <strong>Cleaner</strong> on the login page and change password on first login.</p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-primary" onClick={copyAll}>Copy Credentials</button>
          <button className="btn btn-outline" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
};

const Cleaners = () => {
  const [cleaners, setCleaners] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ full_name: '', email: '', phone: '' });
  const [loading, setLoading] = useState(true);
  const [credentials, setCredentials] = useState(null);

  const fetchCleaners = () => {
    api.get('/tenant/cleaners').then((res) => setCleaners(res.data.data)).finally(() => setLoading(false));
  };

  useEffect(() => { fetchCleaners(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/tenant/cleaners', form);
      const { email, tempPassword, emailSent, emailError } = res.data.data;

      setCredentials({
        name: form.full_name,
        email,
        tempPassword,
        emailSent,
      });

      toast.success(res.data.message);
      if (!emailSent) {
        toast.error(
          emailError
            ? `Email not sent: ${emailError}`
            : 'Email not sent. On Render, Gmail SMTP is blocked — add RESEND_API_KEY instead.'
        );
      }
      setShowForm(false);
      setForm({ full_name: '', email: '', phone: '' });
      fetchCleaners();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create cleaner');
    }
  };

  const resetPassword = async (id, name, email) => {
    try {
      const res = await api.post(`/tenant/cleaners/${id}/reset-password`);
      const { tempPassword, emailSent, emailError } = res.data.data;
      setCredentials({ name, email, tempPassword, emailSent });
      toast.success(res.data.message);
      if (!emailSent) {
        toast.error(
          emailError
            ? `Email not sent: ${emailError}`
            : 'Email not sent. On Render, Gmail SMTP is blocked — add RESEND_API_KEY instead.'
        );
      }
    } catch {
      toast.error('Failed to reset password');
    }
  };

  const toggleStatus = async (id, status) => {
    const newStatus = status === 'active' ? 'suspended' : 'active';
    await api.put(`/tenant/cleaners/${id}`, { status: newStatus });
    fetchCleaners();
  };

  return (
    <div>
      <CredentialsModal credentials={credentials} onClose={() => setCredentials(null)} />

      <div className="page-header">
        <h1>Cleaners</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : 'Add Cleaner'}
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: '1.5rem', maxWidth: 500 }}>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Full Name *</label>
              <input className="form-control" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>Email *</label>
              <input type="email" className="form-control" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              <small style={{ color: 'var(--text-muted)' }}>A temporary password will be generated and sent to this email</small>
            </div>
            <div className="form-group">
              <label>Phone</label>
              <input className="form-control" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <button type="submit" className="btn btn-primary">Create & Send Credentials</button>
          </form>
        </div>
      )}

      <div className="card table-wrapper">
        {loading ? <p>Loading...</p> : cleaners.length === 0 ? (
          <div className="empty-state">No cleaners yet. Add a cleaner to get started.</div>
        ) : (
          <table>
            <thead>
              <tr><th>Name</th><th>Email</th><th>Phone</th><th>Rating</th><th>Jobs</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {cleaners.map((c) => (
                <tr key={c.id}>
                  <td>{c.full_name}</td>
                  <td>{c.email}</td>
                  <td>{c.phone}</td>
                  <td>{c.performance_rating}</td>
                  <td>{c.total_jobs_completed}</td>
                  <td><span className={`badge badge-${c.status === 'active' ? 'success' : 'danger'}`}>{c.status}</span></td>
                  <td>
                    <button className="btn btn-outline btn-sm" onClick={() => resetPassword(c.id, c.full_name, c.email)}>Reset Password</button>
                    <button className="btn btn-outline btn-sm" style={{ marginLeft: 4 }} onClick={() => toggleStatus(c.id, c.status)}>
                      {c.status === 'active' ? 'Suspend' : 'Activate'}
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

export default Cleaners;
