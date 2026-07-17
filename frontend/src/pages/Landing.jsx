import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { formatCFA } from '../utils/currency';
import { useAuth } from '../contexts/AuthContext';
import PaymentModal from '../components/PaymentModal';
import MarketplaceSection from '../components/MarketplaceSection';
import toast from 'react-hot-toast';
import './Landing.css';

const Landing = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [services, setServices] = useState([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [selectedService, setSelectedService] = useState(null);
  const [showBooking, setShowBooking] = useState(false);
  const [payBooking, setPayBooking] = useState(null);
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
      toast.success('Booking created. Complete payment now.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Booking failed');
    }
  };

  return (
    <div className="landing">
      <PaymentModal booking={payBooking} onClose={() => setPayBooking(null)} />
      <header className="landing-header">
        <h1>CleanPro</h1>
        <div>
          <Link to="/login" className="btn btn-outline">Sign In</Link>
          <Link to="/register" className="btn btn-primary" style={{ marginLeft: '0.5rem' }}>Get Started</Link>
        </div>
      </header>

      <section className="landing-hero">
        <h2>Multi-Tenant Cleaning Platform</h2>
        <p>Manage your cleaning business, assign jobs to cleaners, and let customers book services online.</p>
        <div className="landing-actions">
          <Link to="/register" className="btn btn-primary btn-lg">Register Your Company</Link>
          <Link to="/login" className="btn btn-outline btn-lg">Customer Login</Link>
        </div>
      </section>

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
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div className="card" style={{ width: '100%', maxWidth: 450 }}>
            <h2 style={{ marginBottom: '0.35rem' }}>Book Service</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
              {selectedService?.name} - {selectedService?.company_name}
            </p>
            <form onSubmit={submitBooking}>
              <div className="form-group">
                <label>Date</label>
                <input type="date" className="form-control" value={bookingForm.scheduled_date}
                  onChange={(e) => setBookingForm({ ...bookingForm, scheduled_date: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Time</label>
                <input type="time" className="form-control" value={bookingForm.scheduled_time}
                  onChange={(e) => setBookingForm({ ...bookingForm, scheduled_time: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Address</label>
                <input className="form-control" value={bookingForm.address}
                  onChange={(e) => setBookingForm({ ...bookingForm, address: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Special Instructions</label>
                <textarea className="form-control" value={bookingForm.special_instructions}
                  onChange={(e) => setBookingForm({ ...bookingForm, special_instructions: e.target.value })} />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="submit" className="btn btn-primary">Continue to Payment</button>
                <button type="button" className="btn btn-outline" onClick={() => setShowBooking(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <footer className="landing-footer">
        <p>&copy; 2026 CleanPro Platform</p>
      </footer>
    </div>
  );
};

export default Landing;
