import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../../services/api';

const ApproveCompany = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('approving');
  const [message, setMessage] = useState('');
  const [companyName, setCompanyName] = useState('');
  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('No approval token provided.');
      return;
    }

    api.post('/auth/approve-company', { token })
      .then((res) => {
        setCompanyName(res.data.data?.companyName || '');
        setMessage(res.data.message);
        setStatus('success');
      })
      .catch((err) => {
        setMessage(err.response?.data?.message || 'Approval failed');
        setStatus('error');
      });
  }, [token]);

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Company Approval</h1>

        {status === 'approving' && <p className="subtitle">Approving company...</p>}

        {status === 'success' && (
          <>
            <p className="subtitle" style={{ color: 'var(--success)' }}>
              {companyName ? <><strong>{companyName}</strong> has been approved!</> : message}
            </p>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
              The company owner has been notified by email and can now log in.
            </p>
            <Link to="/login" className="btn btn-primary" style={{ display: 'block', textAlign: 'center', marginTop: '1rem' }}>
              Go to Login
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <p className="subtitle" style={{ color: 'var(--danger)' }}>{message}</p>
            <Link to="/login" className="btn btn-outline" style={{ display: 'block', textAlign: 'center', marginTop: '1rem' }}>
              Go to Login
            </Link>
          </>
        )}
      </div>
    </div>
  );
};

export default ApproveCompany;
