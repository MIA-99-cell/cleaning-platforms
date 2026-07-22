import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, Menu, X } from 'lucide-react';
import { useState } from 'react';
import Notifications from './Notifications';
import './Layout.css';

const navItems = {
  super_admin: [
    { path: '/super-admin', label: 'Dashboard' },
    { path: '/super-admin/companies', label: 'Companies' },
    { path: '/super-admin/reports', label: 'Reports' },
    { path: '/super-admin/announcements', label: 'Announcements' },
  ],
  tenant: [
    { path: '/tenant', label: 'Dashboard' },
    { path: '/tenant/company', label: 'Company Profile' },
    { path: '/tenant/services', label: 'Services' },
    { path: '/tenant/cleaners', label: 'Cleaners' },
    { path: '/tenant/bookings', label: 'Bookings' },
    { path: '/tenant/customers', label: 'Customers' },
    { path: '/tenant/payments', label: 'Payments' },
    { path: '/tenant/products', label: 'Products' },
    { path: '/tenant/reviews', label: 'Reviews' },
    { path: '/tenant/reports', label: 'Reports' },
  ],
  cleaner: [
    { path: '/cleaner', label: 'Dashboard' },
    { path: '/cleaner/jobs', label: 'My Jobs' },
    { path: '/cleaner/profile', label: 'Profile' },
  ],
  customer: [],
};

const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const items = navItems[user?.role] || [];

  return (
    <div className="layout">
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h2>CleanPro</h2>
          <button className="close-btn" onClick={() => setSidebarOpen(false)}><X size={20} /></button>
        </div>
        <nav>
          {items.map((item) => (
            <NavLink key={item.path} to={item.path} end={item.path.split('/').length <= 2} onClick={() => setSidebarOpen(false)}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="user-info">
            <strong>{user?.name}</strong>
            <span>{user?.role?.replace('_', ' ')}</span>
          </div>
          <button className="btn btn-logout btn-sm" onClick={handleLogout}>
            <LogOut size={16} /> Logout
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="top-bar">
          <button className="menu-btn" onClick={() => setSidebarOpen(true)}><Menu size={24} /></button>
          <div className="top-bar-right">
            <Notifications />
          </div>
        </header>
        <div className="page-content">{children}</div>
      </main>
    </div>
  );
};

export default Layout;
