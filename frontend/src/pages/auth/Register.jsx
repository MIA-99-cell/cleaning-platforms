import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import toast from 'react-hot-toast';

const Register = () => {
  const [userType, setUserType] = useState('customer');
  const [form, setForm] = useState({
    full_name: '', email: '', password: '', phone: '', address: '',
    company_name: '', license_number: '',
  });
  const [loading, setLoading] = useState(false);
  const [verifyUrl, setVerifyUrl] = useState('');
  const navigate = useNavigate();

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setVerifyUrl('');
    try {
      const endpoint = userType === 'tenant' ? '/auth/register/tenant' : '/auth/register/customer';
      const payload = userType === 'tenant'
        ? {
            full_name: form.full_name,
            email: form.email,
            password: form.password,
            phone: form.phone,
            company_name: form.company_name,
            license_number: form.license_number,
            address: form.address,
          }
        : {
            full_name: form.full_name,
            email: form.email,
            password: form.password,
            phone: form.phone,
            address: form.address,
          };

      const res = await api.post(endpoint, payload);

      if (userType === 'tenant') {
        toast.success(res.data.message || 'Registration successful!');
        if (res.data.data?.verificationUrl) {
          setVerifyUrl(res.data.data.verificationUrl);
          toast('Verification link shown below (dev mode)', { icon: 'ℹ️' });
        } else {
          setTimeout(() => navigate('/login'), 2000);
        }
      } else {
        toast.success('Registration successful!');
        navigate('/login');
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Registration failed';
      const errors = err.response?.data?.errors;
      if (errors?.length) {
        toast.error(errors.map((e) => e.msg).join(', '));
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: verifyUrl ? 480 : 420 }}>
        <div className="auth-topbar">
          <h2>CleanPro</h2>
          <Link to="/" className="btn btn-outline btn-sm auth-home-btn">Back to Home</Link>
        </div>
        <h1>Create Account</h1>
        <p className="subtitle">Join the cleaning platform</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Register As</label>
            <select className="form-control" value={userType} onChange={(e) => setUserType(e.target.value)}>
              <option value="customer">Customer</option>
              <option value="tenant">Cleaning Company</option>
            </select>
          </div>

          {userType === 'tenant' && (
            <>
              <div className="form-group">
                <label>Company Name *</label>
                <input name="company_name" className="form-control" value={form.company_name}
                  onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label>License Number *</label>
                <input name="license_number" className="form-control" value={form.license_number}
                  onChange={handleChange} placeholder="e.g. CLN-2024-001" required />
              </div>
            </>
          )}

          <div className="form-group">
            <label>{userType === 'tenant' ? 'Contact Person Name *' : 'Full Name *'}</label>
            <input name="full_name" className="form-control" value={form.full_name} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label>Email *</label>
            <input name="email" type="email" className="form-control" value={form.email} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label>Phone</label>
            <input name="phone" className="form-control" value={form.phone} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>{userType === 'tenant' ? 'Company Address' : 'Address'}</label>
            <input name="address" className="form-control" value={form.address} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>Password *</label>
            <input name="password" type="password" className="form-control" value={form.password}
              onChange={handleChange} minLength={8} required />
          </div>

          {userType === 'tenant' && (
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              After registration, verify your email. Your account must also be approved by the platform admin before you can log in.
            </p>
          )}

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Creating...' : 'Create Account'}
          </button>
        </form>

        {verifyUrl && (
          <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#eff6ff', borderRadius: 8, fontSize: '0.8125rem' }}>
            <strong>Verify your email:</strong>
            <br />
            <a href={verifyUrl} style={{ wordBreak: 'break-all' }}>{verifyUrl}</a>
          </div>
        )}

        <div className="auth-links">
          Already have an account? <Link to="/login">Sign In</Link>
        </div>
      </div>
    </div>
  );
};

export default Register;
