const ServiceBookingModal = ({ service, bookingForm, setBookingForm, onSubmit, onClose, submitLabel = 'Confirm Booking' }) => {
  const update = (field) => (e) => setBookingForm({ ...bookingForm, [field]: e.target.value });

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '1rem' }}>
      <div className="card" style={{ width: '100%', maxWidth: 450 }}>
        <h2 style={{ marginBottom: service ? '0.35rem' : '1rem' }}>Book Service</h2>
        {service && (
          <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
            {service.name} - {service.company_name}
          </p>
        )}
        <form onSubmit={onSubmit}>
          <div className="form-group">
            <label>Date</label>
            <input type="date" className="form-control" value={bookingForm.scheduled_date}
              onChange={update('scheduled_date')} required />
          </div>
          <div className="form-group">
            <label>Time</label>
            <input type="time" className="form-control" value={bookingForm.scheduled_time}
              onChange={update('scheduled_time')} required />
          </div>
          <div className="form-group">
            <label>Address</label>
            <input className="form-control" value={bookingForm.address}
              onChange={update('address')} required />
          </div>
          <div className="form-group">
            <label>Special Instructions</label>
            <textarea className="form-control" value={bookingForm.special_instructions}
              onChange={update('special_instructions')} />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="submit" className="btn btn-primary">{submitLabel}</button>
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ServiceBookingModal;
