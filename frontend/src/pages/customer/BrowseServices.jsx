import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { formatCFA } from '../../utils/currency';

const BrowseServices = () => {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState([]);
  const [services, setServices] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [bookingForm, setBookingForm] = useState({
    service_id: '', scheduled_date: '', scheduled_time: '', address: '', special_instructions: '',
  });
  const [showBooking, setShowBooking] = useState(false);

  useEffect(() => {
    api.get('/customer/companies').then((res) => setCompanies(res.data.data));
    api.get('/customer/services').then((res) => setServices(res.data.data));
  }, []);

  const filteredServices = services.filter((s) =>
    !selectedCompany || s.tenant_id === selectedCompany
  ).filter((s) =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.company_name?.toLowerCase().includes(search.toLowerCase())
  );

  const handleBook = (service) => {
    setBookingForm({ ...bookingForm, service_id: service.id });
    setShowBooking(true);
  };

  const submitBooking = async (e) => {
    e.preventDefault();
    try {
      await api.post('/customer/bookings', bookingForm);
      toast.success('Booking created successfully!');
      setShowBooking(false);
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Booking failed');
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Browse Services</h1>
        <input className="form-control" style={{ maxWidth: 300 }} placeholder="Search services..."
          value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <button className={`btn ${!selectedCompany ? 'btn-primary' : 'btn-outline'} btn-sm`}
          onClick={() => setSelectedCompany(null)}>All Companies</button>
        {companies.map((c) => (
          <button key={c.id} className={`btn ${selectedCompany === c.tenant_id ? 'btn-primary' : 'btn-outline'} btn-sm`}
            onClick={() => setSelectedCompany(c.tenant_id)}>
            {c.company_name} ({c.rating}★)
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
        {filteredServices.map((s) => (
          <div key={s.id} className="card">
            <h3>{s.name}</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{s.company_name}</p>
            <p>{s.description}</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
              <strong>{formatCFA(s.price)}</strong>
              <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{s.duration_minutes} min</span>
            </div>
            <button className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }} onClick={() => handleBook(s)}>
              Book Now
            </button>
          </div>
        ))}
      </div>

      {showBooking && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div className="card" style={{ width: '100%', maxWidth: 450 }}>
            <h2 style={{ marginBottom: '1rem' }}>Book Service</h2>
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
                <button type="submit" className="btn btn-primary">Confirm Booking</button>
                <button type="button" className="btn btn-outline" onClick={() => setShowBooking(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BrowseServices;
