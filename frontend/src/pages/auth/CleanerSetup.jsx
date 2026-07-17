import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../../services/api';

const CleanerSetup = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState('loading');
  const [credentials, setCredentials] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setError('Missing setup link. Ask your company admin to resend your credentials.');
      return;
    }

    api.get(`/auth/cleaner-credentials?token=${encodeURIComponent(token)}`)
      .then((res) => {
        setCredentials(res.data.data);
        setStatus('success');
      })
      .catch((err) => {
        setStatus('error');
        setError(err.response?.data?.message || 'Could not load your login credentials.');
      });
  }, [token]);

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: 520 }}>
        <h1>Cleaner Account Setup</h1>

        {status === 'loading' && <p className="subtitle">Loading your login credentials...</p>}

        {status === 'error' && (
          <>
            <p className="subtitle" style={{ color: 'var(--danger)' }}>{error}</p>
            <Link to="/login" className="btn btn-outline" style={{ display: 'inline-block', marginTop: '1rem' }}>
              Go to Login
            </Link>
          </>
        )}

        {status === 'success' && credentials && (
          <>
            <p className="subtitle" style={{ color: 'var(--success)' }}>
              Welcome{credentials.fullName ? `, ${credentials.fullName}` : ''}! Your account for {credentials.companyName} is ready.
            </p>
            <div style={{ background: '#f1f5f9', padding: '1rem', borderRadius: 8, marginTop: '1rem' }}>
              <p><strong>Login as:</strong> Cleaner</p>
              <p><strong>Email:</strong> {credentials.email}</p>
              <p><strong>Temporary Password:</strong> <code>{credentials.password}</code></p>
            </div>
            <p style={{ marginTop: '1rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              Save these credentials now. You must change your password after first login.
            </p>
            <Link to="/login" className="btn btn-primary" style={{ display: 'block', textAlign: 'center', marginTop: '1rem' }}>
              Login Now
            </Link>
          </>
        )}
      </div>
    </div>
  );
};

export default CleanerSetup;
