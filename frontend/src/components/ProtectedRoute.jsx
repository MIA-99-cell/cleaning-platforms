import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        Loading...
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    const dashboards = { super_admin: '/super-admin', tenant: '/tenant', cleaner: '/cleaner', customer: '/' };
    return <Navigate to={dashboards[user.role] || '/'} replace />;
  }

  if (user.mustChangePassword && !window.location.pathname.includes('/change-password')) {
    return <Navigate to="/change-password" replace />;
  }

  if (!user.mustChangePassword && window.location.pathname.includes('/change-password')) {
    const dashboards = { super_admin: '/super-admin', tenant: '/tenant', cleaner: '/cleaner', customer: '/' };
    return <Navigate to={dashboards[user.role] || '/'} replace />;
  }

  return children;
};

export default ProtectedRoute;
