import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { formatCFA } from '../utils/currency';
import { useAuth } from '../contexts/AuthContext';
import PaymentModal from '../components/PaymentModal';
import MarketplaceSection from '../components/MarketplaceSection';
import ServiceBookingModal from '../components/ServiceBookingModal';
import CustomerBookingsSection from '../components/CustomerBookingsSection';
import toast from 'react-hot-toast';
import './Landing.css';

const Landing = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isCustomer = user?.role === 'customer';
  const [services, setServices] = useState([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [selectedService, setSelectedService] = useState(null);
  const [showBooking, setShowBooking] = useState(false);
  const [payBooking, setPayBooking] = useState(null);
  const [bookingsRefresh, setBookingsRefresh] = useState(0);
  const [bookingForm, setBookingForm] = useState({
    service_id: '',
    scheduled_date: '',
    scheduled_time: '',
    address: '',
    special_instructions: '',
  });

  useEffect(() => {
    api
      .get('/customer/services')
      .then((res) => {
        const list = Array.isArray(res.data?.data) ? res.data.data : [];
        setServices(list.slice(0, 9));
      })
      .catch(() => setServices([]))
      .finally(() => setLoadingServices(false));
  }, []);

  const handleServiceClick = (service) => {
    if (!user) {
      toast('Please sign in as customer to book and pay.', { icon: 'ℹ️' });
      navigate('/login');
      return;
    }
    if (user.role !== 'customer') {
      toast.error('Only customer accounts can make service payments.');
      return;
    }

    setSelectedService(service);
    setBookingForm({
      service_id: service.id,
      scheduled_date: '',
      scheduled_time: '',
      address: '',
      special_instructions: '',
    });
    setShowBooking(true);
  };

  const submitBooking = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/customer/bookings', bookingForm);
      const bookingId = res.data?.data?.id;
      if (!bookingId) throw new Error('Missing booking id');

      setShowBooking(false);
      setPayBooking({
        id: bookingId,
        service_name: selectedService?.name,
        company_name: selectedService?.company_name,
        total_amount: selectedService?.price,
      });
      setBookingsRefresh((k) => k + 1);
      toast.success('Booking created. Complete payment now.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Booking failed');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="landing">
      <PaymentModal
        booking={payBooking}
        onClose={() => setPayBooking(null)}
        onSuccess={() => setBookingsRefresh((k) => k + 1)}
      />
      <header className="landing-header">
        <h1>CleanPro</h1>
        <div className="landing-header-actions">
          {isCustomer ? (
            <>
              <span className="landing-user-name">Hello, {user.name}</span>
              <button type="button" className="btn btn-outline" onClick={handleLogout}>Logout</button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-outline">Sign In</Link>
              <Link to="/register" className="btn btn-primary" style={{ marginLeft: '0.5rem' }}>Get Started</Link>
            </>
          )}
        </div>
      </header>

      <section className="landing-hero">
        <h2>{isCustomer ? 'Welcome back' : 'Multi-Tenant Cleaning Platform'}</h2>
        <p>
          {isCustomer
            ? 'Book services, shop products, pay online, and track your bookings — all on this page.'
            : 'Manage your cleaning business, assign jobs to cleaners, and let customers book services online.'}
        </p>
        {!isCustomer && (
          <div className="landing-actions">
            <Link to="/register" className="btn btn-primary btn-lg">Register Your Company</Link>
            <Link to="/login" className="btn btn-outline btn-lg">Customer Login</Link>
          </div>
        )}
      </section>

      {isCustomer && <CustomerBookingsSection refreshKey={bookingsRefresh} />}

      {!isCustomer && (
        <section className="landing-features">
          <div className="feature-card">
            <h3>For Companies</h3>
            <p>Manage services, cleaners, bookings, payments, and reports all in one place.</p>
          </div>
          <div className="feature-card">
            <h3>For Cleaners</h3>
            <p>View assigned jobs, update status, and complete work with photo evidence.</p>
          </div>
          <div className="feature-card">
            <h3>For Customers</h3>
            <p>Browse services, shop cleaning products, book cleanings, pay online, and leave reviews.</p>
          </div>
        </section>
      )}

      <MarketplaceSection limit={12} showCart />

      <section className="landing-services">
        <div className="landing-services-header">
          <h3>Available Services</h3>
          <p>Compare company offers and prices in FCFA.</p>
        </div>

        {loadingServices ? (
          <p className="landing-services-empty">Loading services...</p>
        ) : services.length === 0 ? (
          <p className="landing-services-empty">No services available yet.</p>
        ) : (
          <div className="services-grid">
            {services.map((service) => (
              <article key={service.id} className="service-card">
                <h4>{service.name}</h4>
                <p className="service-company">{service.company_name}</p>
                <p className="service-description">{service.description || 'Professional cleaning service.'}</p>
                <div className="service-footer">
                  <span className="service-price">{formatCFA(service.price)}</span>
                  <span className="service-duration">{service.duration_minutes} min</span>
                </div>
                <button className="btn btn-primary service-pay-btn" onClick={() => handleServiceClick(service)}>
                  Book & Pay
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      {showBooking && (
        <ServiceBookingModal
          service={selectedService}
          bookingForm={bookingForm}
          setBookingForm={setBookingForm}
          onSubmit={submitBooking}
          onClose={() => setShowBooking(false)}
          submitLabel="Continue to Payment"
        />
      )}

      <footer className="landing-footer">
        <p>&copy; 2026 CleanPro Platform</p>
      </footer>
    </div>
  );
};

export default Landing;
