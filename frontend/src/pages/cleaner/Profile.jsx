import { useAuth } from '../../contexts/AuthContext';
import PasswordChangeForm from '../../components/PasswordChangeForm';
import toast from 'react-hot-toast';

const CleanerProfile = () => {
  const { user } = useAuth();

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
        <PasswordChangeForm
          submitLabel="Update Password"
          submittingLabel="Saving..."
          onSuccess={() => toast.success('Password changed')}
        />
      </div>
    </div>
  );
};

export default CleanerProfile;
