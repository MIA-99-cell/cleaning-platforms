import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { formatCFA } from '../utils/currency';
import { useAuth } from '../contexts/AuthContext';
import { useBookingCart } from '../contexts/BookingCartContext';
import MarketplaceSection from '../components/MarketplaceSection';
import ServiceBookingPanel from '../components/ServiceBookingPanel';
import ServiceBookingModal from '../components/ServiceBookingModal';
import toast from 'react-hot-toast';
import './Landing.css';

const Landing = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { addBooking, totalItems } = useBookingCart();
  const [services, setServices] = useState([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [selectedService, setSelectedService] = useState(null);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [showBookingCart, setShowBookingCart] = useState(false);
  const [bookingForm, setBookingForm] = useState({
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

  const requireCustomer = () => {
    if (!user) {
      toast('Please sign in as a customer to book services.', { icon: 'ℹ️' });
      navigate('/login');
      return false;
    }
    if (user.role !== 'customer') {
      toast.error('Only customer accounts can book services.');
      return false;
    }
    return true;
  };

  const handleBookNow = (service) => {
    if (!requireCustomer()) return;
    setSelectedService(service);
    setBookingForm({
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
                <button type="button" className="btn btn-primary service-pay-btn" onClick={() => handleBookNow(service)}>
                  Book Now
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      {user?.role === 'customer' && (
        <button
          type="button"
          className="booking-fab"
          onClick={() => setShowBookingCart(true)}
          aria-label="Open booking cart"
        >
          📅
          {totalItems > 0 && <span className="cart-fab-badge">{totalItems}</span>}
        </button>
      )}

      {showBookingForm && selectedService && (
        <ServiceBookingModal
          service={selectedService}
          bookingForm={bookingForm}
          setBookingForm={setBookingForm}
          onSubmit={addToBookingCart}
          onClose={() => setShowBookingForm(false)}
          submitLabel="Add to Booking Cart"
        />
      )}

      <footer className="landing-footer">
        <p>&copy; 2026 CleanPro Platform</p>
      </footer>
    </div>
  );
};

export default Landing;
