import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import PasswordChangeForm from '../../components/PasswordChangeForm';
import toast from 'react-hot-toast';

const ChangePassword = () => {
  const { user, getDashboardPath, updateUser } = useAuth();
  const navigate = useNavigate();

  const handleSuccess = () => {
    updateUser({ mustChangePassword: false });
    toast.success('Password changed successfully');
    navigate(getDashboardPath(user.role), { replace: true });
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Change Password</h1>
        <p className="subtitle">You must change your password before continuing</p>
        <PasswordChangeForm onSuccess={handleSuccess} />
      </div>
    </div>
  );
};

export default ChangePassword;
