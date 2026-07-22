import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { formatCFA } from '../utils/currency';
import { useBookingCart } from '../contexts/BookingCartContext';
import MarketplaceSection from '../components/MarketplaceSection';
import ServiceBookingPanel from '../components/ServiceBookingPanel';
import toast from 'react-hot-toast';
import './Landing.css';
import { fetchWithRetry } from '../utils/fetchWithRetry';
import useLockBodyScroll from '../hooks/useLockBodyScroll';

const Landing = () => {
  const { addBooking, totalItems } = useBookingCart();
  const [services, setServices] = useState([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [servicesError, setServicesError] = useState('');
  const [selectedService, setSelectedService] = useState(null);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [showBookingCart, setShowBookingCart] = useState(false);
  const [bookingForm, setBookingForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    scheduled_date: '',
    scheduled_time: '',
    address: '',
    special_instructions: '',
  });

  useLockBodyScroll(showBookingForm || showBookingCart);

  useEffect(() => {
    const scrollToHash = () => {
      const id = window.location.hash.replace('#', '');
      if (!id) return;
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    scrollToHash();
    window.addEventListener('hashchange', scrollToHash);
    return () => window.removeEventListener('hashchange', scrollToHash);
  }, []);

  useEffect(() => {
    const loadServices = () => {
      setLoadingServices(true);
      setServicesError('');
      fetchWithRetry(() => api.get('/public/services', { params: { limit: 50 } }))
        .then((res) => {
          const list = Array.isArray(res.data?.data) ? res.data.data : [];
          setServices(list);
        })
        .catch(() => {
          setServices([]);
          setServicesError('Could not load services. The server may be waking up — please wait a moment and refresh.');
        })
        .finally(() => setLoadingServices(false));
    };

    loadServices();
    const onFocus = () => loadServices();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  const handleBookNow = (service) => {
    setSelectedService(service);
    setBookingForm({
      full_name: '',
      email: '',
      phone: '',
      scheduled_date: '',
      scheduled_time: '',
      address: '',
      special_instructions: '',
    });
    setShowBookingForm(true);
  };

  const addToBookingCart = (e) => {
    e.preventDefault();
    addBooking({
      service_id: selectedService.id,
      name: selectedService.name,
      company_name: selectedService.company_name,
      price: selectedService.price,
      tenant_id: selectedService.tenant_id,
      ...bookingForm,
    });
    setShowBookingForm(false);
    setShowBookingCart(true);
    toast.success('Service added to booking cart');
  };

  return (
    <div className="landing">
      <ServiceBookingPanel open={showBookingCart} onClose={() => setShowBookingCart(false)} />

      <header className="landing-header">
        <h1 className="landing-brand">CleanPro</h1>
        <nav className="landing-header-nav" aria-label="Home page sections">
          <a href="#marketplace" className="landing-nav-link">Marketplace</a>
          <a href="#services" className="landing-nav-link">Services</a>
        </nav>
        <div className="landing-header-actions">
          <Link to="/login" className="btn btn-outline btn-sm landing-header-btn">Sign In</Link>
          <Link to="/register" className="btn btn-primary btn-sm landing-header-btn">Get Started</Link>
        </div>
      </header>

      <section className="landing-hero">
        <h2>Multi-Tenant Cleaning Platform</h2>
        <p>Manage your cleaning business, assign jobs to cleaners, and let customers book services online.</p>
        <div className="landing-actions">
          <Link to="/register" className="btn btn-primary btn-lg">Get Started</Link>
          <Link to="/login" className="btn btn-outline btn-lg">Sign In</Link>
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
          <p>Browse services, shop cleaning products, book cleanings, pay online, and leave reviews — no account needed.</p>
        </div>
      </section>

      <MarketplaceSection limit={12} showCart />

      <section id="services" className="landing-services">
        <div className="landing-services-header">
          <h3>Available Services</h3>
          <p>Compare company offers and prices in FCFA. Book instantly — no login required.</p>
        </div>

        {loadingServices ? (
          <p className="landing-services-empty">Loading services… (first load can take up to a minute on free hosting)</p>
        ) : servicesError ? (
          <p className="landing-services-empty">{servicesError}</p>
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
                <button type="button" className="btn btn-primary service-pay-btn" onClick={() => handleBookNow(service)}>
                  Book Now
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      {totalItems > 0 && (
        <button
          type="button"
          className="booking-fab"
          onClick={() => setShowBookingCart(true)}
          aria-label="Open booking cart"
        >
          📅
          <span className="cart-fab-badge">{totalItems}</span>
        </button>
      )}

      {showBookingForm && selectedService && (
        <div className="landing-modal-backdrop" onClick={() => setShowBookingForm(false)}>
          <div className="card landing-modal" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginBottom: '0.35rem' }}>Book Service</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
              {selectedService.name} — {selectedService.company_name} ({formatCFA(selectedService.price)})
            </p>
            <form onSubmit={addToBookingCart}>
              <div className="form-group">
                <label>Full Name</label>
                <input className="form-control" value={bookingForm.full_name}
                  onChange={(e) => setBookingForm({ ...bookingForm, full_name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input type="email" className="form-control" value={bookingForm.email}
                  onChange={(e) => setBookingForm({ ...bookingForm, email: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input className="form-control" value={bookingForm.phone} placeholder="670000000"
                  onChange={(e) => setBookingForm({ ...bookingForm, phone: e.target.value })} required />
              </div>
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
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button type="submit" className="btn btn-primary">Add to Booking Cart</button>
                <button type="button" className="btn btn-outline" onClick={() => setShowBookingForm(false)}>Cancel</button>
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
