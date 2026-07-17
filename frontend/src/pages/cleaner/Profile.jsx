import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import toast from 'react-hot-toast';

const CleanerProfile = () => {
  const { user } = useAuth();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [saving, setSaving] = useState(false);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (form.newPassword !== form.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setSaving(true);
    try {
      await api.post('/auth/change-password', {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      toast.success('Password changed');
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="page-header"><h1>My Profile</h1></div>
      <div className="card" style={{ maxWidth: 500, marginBottom: '1.5rem' }}>
        <p><strong>Name:</strong> {user?.name}</p>
        <p><strong>Email:</strong> {user?.email}</p>
        <p><strong>Role:</strong> Cleaner</p>
      </div>

      <div className="card" style={{ maxWidth: 500 }}>
        <h3 style={{ marginBottom: '1rem' }}>Change Password</h3>
        <form onSubmit={handleChangePassword}>
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
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CleanerProfile;
