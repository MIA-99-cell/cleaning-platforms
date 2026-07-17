import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';
import ChangePassword from './pages/auth/ChangePassword';
import VerifyEmail from './pages/auth/VerifyEmail';
import ApproveCompany from './pages/auth/ApproveCompany';
import CleanerSetup from './pages/auth/CleanerSetup';

import SuperAdminDashboard from './pages/superAdmin/Dashboard';
import Companies from './pages/superAdmin/Companies';
import SuperAdminReports from './pages/superAdmin/Reports';
import Announcements from './pages/superAdmin/Announcements';

import TenantDashboard from './pages/tenant/Dashboard';
import CompanyProfile from './pages/tenant/CompanyProfile';
import Services from './pages/tenant/Services';
import Cleaners from './pages/tenant/Cleaners';
import Bookings from './pages/tenant/Bookings';
import TenantPayments from './pages/tenant/Payments';
import TenantProducts from './pages/tenant/Products';
import Reviews from './pages/tenant/Reviews';
import TenantReports from './pages/tenant/TenantReports';
import Customers from './pages/tenant/Customers';

import CleanerDashboard from './pages/cleaner/Dashboard';
import Jobs from './pages/cleaner/Jobs';
import CleanerProfile from './pages/cleaner/Profile';

import CustomerDashboard from './pages/customer/Dashboard';
import BrowseServices from './pages/customer/BrowseServices';
import CustomerBookings from './pages/customer/Bookings';
import CustomerPayments from './pages/customer/Payments';
import CustomerMarketplace from './pages/customer/Marketplace';
import Landing from './pages/Landing';
import PaymentReturn from './pages/PaymentReturn';

const AppLayout = ({ children }) => <Layout>{children}</Layout>;

function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>Loading...</div>;
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={`/${user.role.replace('_', '-')}`} /> : <Login />} />
      <Route path="/" element={user ? <Navigate to={`/${user.role.replace('_', '-')}`} /> : <Landing />} />
      <Route path="/register" element={user ? <Navigate to="/" /> : <Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/payment/return" element={<PaymentReturn />} />
      <Route path="/payment/return/:ref" element={<PaymentReturn />} />
      <Route path="/approve-company" element={<ApproveCompany />} />
      <Route path="/cleaner/setup" element={<CleanerSetup />} />
      <Route path="/change-password" element={<ProtectedRoute><ChangePassword /></ProtectedRoute>} />

      {/* Super Admin */}
      <Route path="/super-admin" element={<ProtectedRoute allowedRoles={['super_admin']}><AppLayout><SuperAdminDashboard /></AppLayout></ProtectedRoute>} />
      <Route path="/super-admin/companies" element={<ProtectedRoute allowedRoles={['super_admin']}><AppLayout><Companies /></AppLayout></ProtectedRoute>} />
      <Route path="/super-admin/reports" element={<ProtectedRoute allowedRoles={['super_admin']}><AppLayout><SuperAdminReports /></AppLayout></ProtectedRoute>} />
      <Route path="/super-admin/announcements" element={<ProtectedRoute allowedRoles={['super_admin']}><AppLayout><Announcements /></AppLayout></ProtectedRoute>} />

      {/* Tenant */}
      <Route path="/tenant" element={<ProtectedRoute allowedRoles={['tenant']}><AppLayout><TenantDashboard /></AppLayout></ProtectedRoute>} />
      <Route path="/tenant/company" element={<ProtectedRoute allowedRoles={['tenant']}><AppLayout><CompanyProfile /></AppLayout></ProtectedRoute>} />
      <Route path="/tenant/services" element={<ProtectedRoute allowedRoles={['tenant']}><AppLayout><Services /></AppLayout></ProtectedRoute>} />
      <Route path="/tenant/cleaners" element={<ProtectedRoute allowedRoles={['tenant']}><AppLayout><Cleaners /></AppLayout></ProtectedRoute>} />
      <Route path="/tenant/bookings" element={<ProtectedRoute allowedRoles={['tenant']}><AppLayout><Bookings /></AppLayout></ProtectedRoute>} />
      <Route path="/tenant/payments" element={<ProtectedRoute allowedRoles={['tenant']}><AppLayout><TenantPayments /></AppLayout></ProtectedRoute>} />
      <Route path="/tenant/products" element={<ProtectedRoute allowedRoles={['tenant']}><AppLayout><TenantProducts /></AppLayout></ProtectedRoute>} />
      <Route path="/tenant/reviews" element={<ProtectedRoute allowedRoles={['tenant']}><AppLayout><Reviews /></AppLayout></ProtectedRoute>} />
      <Route path="/tenant/customers" element={<ProtectedRoute allowedRoles={['tenant']}><AppLayout><Customers /></AppLayout></ProtectedRoute>} />
      <Route path="/tenant/reports" element={<ProtectedRoute allowedRoles={['tenant']}><AppLayout><TenantReports /></AppLayout></ProtectedRoute>} />

      {/* Cleaner */}
      <Route path="/cleaner" element={<ProtectedRoute allowedRoles={['cleaner']}><AppLayout><CleanerDashboard /></AppLayout></ProtectedRoute>} />
      <Route path="/cleaner/jobs" element={<ProtectedRoute allowedRoles={['cleaner']}><AppLayout><Jobs /></AppLayout></ProtectedRoute>} />
      <Route path="/cleaner/profile" element={<ProtectedRoute allowedRoles={['cleaner']}><AppLayout><CleanerProfile /></AppLayout></ProtectedRoute>} />

      {/* Customer */}
      <Route path="/customer" element={<ProtectedRoute allowedRoles={['customer']}><AppLayout><CustomerDashboard /></AppLayout></ProtectedRoute>} />
      <Route path="/customer/browse" element={<ProtectedRoute allowedRoles={['customer']}><AppLayout><BrowseServices /></AppLayout></ProtectedRoute>} />
      <Route path="/customer/bookings" element={<ProtectedRoute allowedRoles={['customer']}><AppLayout><CustomerBookings /></AppLayout></ProtectedRoute>} />
      <Route path="/customer/payments" element={<ProtectedRoute allowedRoles={['customer']}><AppLayout><CustomerPayments /></AppLayout></ProtectedRoute>} />
      <Route path="/customer/marketplace" element={<ProtectedRoute allowedRoles={['customer']}><AppLayout><CustomerMarketplace /></AppLayout></ProtectedRoute>} />

      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default App;
