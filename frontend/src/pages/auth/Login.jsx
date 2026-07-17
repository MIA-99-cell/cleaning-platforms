import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import toast from 'react-hot-toast';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [userType, setUserType] = useState('customer');
  const [loading, setLoading] = useState(false);
  const [showApprovalRequest, setShowApprovalRequest] = useState(false);
  const [requestingApproval, setRequestingApproval] = useState(false);
  const { login, getDashboardPath } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setShowApprovalRequest(false);
    try {
      const user = await login(email, password, userType);
      toast.success('Login successful');
      navigate(getDashboardPath(user.role));
    } catch (err) {
      const msg = err.response?.data?.message || 'Login failed';
      toast.error(msg);
      if (userType === 'tenant' && msg.toLowerCase().includes('pending approval')) {
        setShowApprovalRequest(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRequestApproval = async () => {
    if (!email) {
      toast.error('Enter your email first');
      return;
    }
    setRequestingApproval(true);
    try {
      const res = await api.post('/auth/request-approval', { email });
      toast.success(res.data.message);
      if (res.data.data?.adminApprovalUrl) {
        toast('Approval link logged on server (dev mode)', { icon: 'ℹ️' });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Request failed');
    } finally {
      setRequestingApproval(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-topbar">
          <h2>CleanPro</h2>
          <Link to="/" className="btn btn-outline btn-sm auth-home-btn">Back to Home</Link>
        </div>
        <h1>Welcome Back</h1>
        <p className="subtitle">Sign in to your account</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Login As</label>
            <select className="form-control" value={userType} onChange={(e) => setUserType(e.target.value)}>
              <option value="customer">Customer</option>
              <option value="tenant">Cleaning Company</option>
              <option value="cleaner">Cleaner</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </div>
          <div className="form-group">
            <label>Email</label>
            <input type="email" className="form-control" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input type="password" className="form-control" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        {showApprovalRequest && (
          <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#eff6ff', borderRadius: 8, fontSize: '0.875rem' }}>
            <p style={{ marginBottom: '0.5rem' }}>Your email is verified but admin approval is pending.</p>
            <button type="button" className="btn btn-outline btn-sm" onClick={handleRequestApproval} disabled={requestingApproval}>
              {requestingApproval ? 'Sending...' : 'Notify Admin to Approve'}
            </button>
          </div>
        )}

        <div className="auth-links">
          <Link to="/forgot-password">Forgot password?</Link>
          {userType === 'tenant' && (
            <p style={{ marginTop: '0.5rem' }}>
              <Link to="/verify-email">Verify email or resend link</Link>
            </p>
          )}
          {userType !== 'super_admin' && userType !== 'cleaner' && (
            <p style={{ marginTop: '0.5rem' }}>
              Don't have an account? <Link to="/register">Register</Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
