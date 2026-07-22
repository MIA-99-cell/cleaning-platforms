import { useState } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';

const PasswordChangeForm = ({ submitLabel = 'Change Password', submittingLabel = 'Changing...', onSuccess }) => {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.newPassword !== form.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/change-password', {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      onSuccess?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label>Current Password</label>
        <input type="password" className="form-control" value={form.currentPassword}
          onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} required />
      </div>
      <div className="form-group">
        <label>New Password</label>
        <input type="password" className="form-control" value={form.newPassword}
          onChange={(e) => setForm({ ...form, newPassword: e.target.value })} minLength={8} required />
      </div>
      <div className="form-group">
        <label>Confirm New Password</label>
        <input type="password" className="form-control" value={form.confirmPassword}
          onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} required />
      </div>
      <button type="submit" className="btn btn-primary" disabled={loading}>
        {loading ? submittingLabel : submitLabel}
      </button>
    </form>
  );
};

export default PasswordChangeForm;
