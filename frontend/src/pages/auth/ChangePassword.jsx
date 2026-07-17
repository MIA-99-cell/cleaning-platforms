import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import toast from 'react-hot-toast';

const ChangePassword = () => {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const { user, getDashboardPath, updateUser } = useAuth();
  const navigate = useNavigate();

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
      updateUser({ mustChangePassword: false });
      toast.success('Password changed successfully');
      navigate(getDashboardPath(user.role), { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Change Password</h1>
        <p className="subtitle">You must change your password before continuing</p>
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
            {loading ? 'Changing...' : 'Change Password'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChangePassword;
