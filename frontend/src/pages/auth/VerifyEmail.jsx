import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { supabase, isSupabaseFrontendConfigured } from '../../services/supabase';

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('verifying');
  const [message, setMessage] = useState('');
  const [manualToken, setManualToken] = useState(searchParams.get('token') || '');
  const [resendEmail, setResendEmail] = useState('');
  const [verifyUrl, setVerifyUrl] = useState('');
  const [resending, setResending] = useState(false);
  const token = searchParams.get('token');
  const tokenHash = searchParams.get('token_hash');
  const otpType = searchParams.get('type');

  const verifyToken = async (verificationToken) => {
    if (!verificationToken) {
      setStatus('idle');
      return;
    }
    setStatus('verifying');
    try {
      const res = await api.post('/auth/verify-email', { token: verificationToken });
      setMessage(res.data.message || 'Email verified successfully!');
      setStatus('success');
    } catch (err) {
      setMessage(err.response?.data?.message || 'Verification failed');
      setStatus('error');
    }
  };

  useEffect(() => {
    if (token) {
      verifyToken(token);
      return;
    }

    const verifySupabase = async () => {
      if (!tokenHash || !isSupabaseFrontendConfigured || !supabase) {
        setStatus('idle');
        return;
      }
      setStatus('verifying');
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: otpType || 'email',
      });
      if (error) {
        setStatus('error');
        setMessage(error.message || 'Verification failed');
      } else {
        try {
          const { data: userData } = await supabase.auth.getUser();
          const verifiedEmail = userData?.user?.email;
          if (verifiedEmail) {
            const res = await api.post('/auth/verify-email-by-email', { email: verifiedEmail });
            setMessage(res.data?.message || 'Email verified successfully!');
          } else {
            setMessage('Email verified. Please continue to login.');
          }
          setStatus('success');
        } catch (syncErr) {
          setStatus('error');
          setMessage(syncErr.response?.data?.message || 'Email verified but app sync failed');
        }
      }
    };

    verifySupabase();
  }, [token, tokenHash, otpType]);

  const handleManualVerify = (e) => {
    e.preventDefault();
    verifyToken(manualToken.trim());
  };

  const handleResend = async (e) => {
    e.preventDefault();
    if (!resendEmail) return;
    setResending(true);
    setVerifyUrl('');
    try {
      const res = await api.post('/auth/resend-verification', { email: resendEmail });
      toast.success(res.data.message);
      if (res.data.data?.verificationUrl) {
        setVerifyUrl(res.data.data.verificationUrl);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to resend');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: 460 }}>
        <h1>Email Verification</h1>

        {status === 'verifying' && <p className="subtitle">Verifying your email...</p>}

        {status === 'success' && (
          <>
            <p className="subtitle" style={{ color: 'var(--success)' }}>{message}</p>
            <div style={{ background: '#fef3c7', padding: '0.75rem', borderRadius: 8, marginTop: '1rem', fontSize: '0.875rem' }}>
              <strong>What happens next?</strong> The platform admin has been notified by <strong>email and SMS</strong> to approve your company. You will receive an email once approved.
            </div>
            <Link to="/login" className="btn btn-primary" style={{ display: 'block', textAlign: 'center', marginTop: '1rem' }}>
              Go to Login
            </Link>
          </>
        )}

        {(status === 'error' || status === 'idle') && (
          <>
            {status === 'error' && (
              <p className="subtitle" style={{ color: 'var(--danger)', marginBottom: '1rem' }}>{message}</p>
            )}
            {status === 'idle' && (
              <p className="subtitle">Enter your verification token or request a new link.</p>
            )}

            <form onSubmit={handleManualVerify} style={{ marginBottom: '1.5rem' }}>
              <div className="form-group">
                <label>Verification Token</label>
                <input className="form-control" value={manualToken}
                  onChange={(e) => setManualToken(e.target.value)} placeholder="Paste token from email or registration" />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Verify Email</button>
            </form>

            <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '1.5rem 0' }} />

            <form onSubmit={handleResend}>
              <div className="form-group">
                <label>Resend verification link</label>
                <input type="email" className="form-control" value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)} placeholder="Your registered email" required />
              </div>
              <button type="submit" className="btn btn-outline" style={{ width: '100%' }} disabled={resending}>
                {resending ? 'Sending...' : 'Resend Verification Link'}
              </button>
            </form>

            {verifyUrl && (
              <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#eff6ff', borderRadius: 8, fontSize: '0.8125rem' }}>
                <strong>Your verification link:</strong>
                <br />
                <a href={verifyUrl} style={{ wordBreak: 'break-all' }}>{verifyUrl}</a>
              </div>
            )}

            <div className="auth-links" style={{ marginTop: '1rem' }}>
              <Link to="/login">Back to Login</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default VerifyEmail;
