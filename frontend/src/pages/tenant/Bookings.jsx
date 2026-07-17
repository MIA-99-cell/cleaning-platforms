import { useEffect, useState } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { formatCFA } from '../../utils/currency';

const Bookings = () => {
  const [bookings, setBookings] = useState([]);
  const [cleaners, setCleaners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assignModal, setAssignModal] = useState(null);
  const [selectedCleaner, setSelectedCleaner] = useState('');

  const fetchData = () => {
    Promise.all([
      api.get('/tenant/bookings'),
      api.get('/tenant/cleaners'),
    ]).then(([bookingsRes, cleanersRes]) => {
      setBookings(bookingsRes.data.data);
      setCleaners(cleanersRes.data.data.filter((c) => c.status === 'active'));
    }).finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const updateBooking = async (id, action, extra = {}) => {
    try {
      await api.patch(`/tenant/bookings/${id}`, { action, ...extra });
      toast.success(`Booking ${action}ed`);
      setAssignModal(null);
      setSelectedCleaner('');
      fetchData();
    } catch {
      toast.error('Action failed');
    }
  };

  const handleAssign = () => {
    if (!selectedCleaner) {
      toast.error('Please select a cleaner');
      return;
    }
    updateBooking(assignModal, 'assign', { cleaner_id: parseInt(selectedCleaner, 10) });
  };

  return (
    <div>
      <div className="page-header"><h1>Bookings</h1></div>
      <div className="card table-wrapper">
        {loading ? <p>Loading...</p> : (
          <table>
            <thead>
              <tr><th>Customer</th><th>Service</th><th>Date</th><th>Time</th><th>Amount</th><th>Status</th><th>Cleaner</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.id}>
                  <td>{b.customer_name}</td>
                  <td>{b.service_name}</td>
                  <td>{b.scheduled_date?.split('T')[0]}</td>
                  <td>{b.scheduled_time}</td>
                  <td>{formatCFA(b.total_amount)}</td>
                  <td><span className="badge badge-info">{b.status}</span></td>
                  <td>{b.cleaner_name || '-'}</td>
                  <td>
                    {b.status === 'pending' && (
                      <>
                        <button className="btn btn-success btn-sm" onClick={() => updateBooking(b.id, 'accept')}>Accept</button>
                        <button className="btn btn-danger btn-sm" style={{ marginLeft: 4 }} onClick={() => updateBooking(b.id, 'reject')}>Reject</button>
                      </>
                    )}
                    {b.status === 'accepted' && (
                      <button className="btn btn-primary btn-sm" onClick={() => setAssignModal(b.id)}>Assign Cleaner</button>
                    )}
                    {['assigned', 'in_progress'].includes(b.status) && (
                      <button className="btn btn-success btn-sm" onClick={() => updateBooking(b.id, 'complete')}>Complete</button>
                    )}
                    {!['completed', 'cancelled', 'rejected'].includes(b.status) && (
                      <button className="btn btn-outline btn-sm" style={{ marginLeft: 4 }}
                        onClick={() => updateBooking(b.id, 'cancel')}>Cancel</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {assignModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div className="card" style={{ width: '100%', maxWidth: 400 }}>
            <h2 style={{ marginBottom: '1rem' }}>Assign Cleaner</h2>
            <div className="form-group">
              <label>Select Cleaner</label>
              <select className="form-control" value={selectedCleaner} onChange={(e) => setSelectedCleaner(e.target.value)}>
                <option value="">Choose a cleaner...</option>
                {cleaners.map((c) => (
                  <option key={c.id} value={c.id}>{c.full_name} ({c.email})</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-primary" onClick={handleAssign}>Assign</button>
              <button className="btn btn-outline" onClick={() => { setAssignModal(null); setSelectedCleaner(''); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Bookings;
