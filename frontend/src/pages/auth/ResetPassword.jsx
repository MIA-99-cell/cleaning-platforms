import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { supabase, isSupabaseFrontendConfigured } from '../../services/supabase';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const legacyToken = searchParams.get('token');
  const tokenHash = searchParams.get('token_hash');
  const otpType = searchParams.get('type');
  const userType = searchParams.get('userType') || 'tenant';
  const isSupabaseRecovery = Boolean(tokenHash && otpType === 'recovery');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (legacyToken) {
        await api.post('/auth/reset-password', { token: legacyToken, password, userType });
      } else if (isSupabaseRecovery && isSupabaseFrontendConfigured && supabase) {
        const { error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: 'recovery',
        });
        if (verifyError) throw verifyError;

        const { error: updateError } = await supabase.auth.updateUser({ password });
        if (updateError) throw updateError;

        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          await api.post('/auth/sync-password', {
            access_token: session.access_token,
            password,
            userType,
          });
        }
      } else {
        throw new Error('Missing or invalid reset link');
      }
      toast.success('Password reset successful');
      navigate('/login');
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Reset failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Reset Password</h1>
        <p className="subtitle">Enter your new password</p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>New Password</label>
            <input type="password" className="form-control" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;
