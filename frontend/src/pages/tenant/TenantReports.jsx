import { useState } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const TenantReports = () => {
  const [reportType, setReportType] = useState('bookings');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  const generateReport = async () => {
    setLoading(true);
    try {
      const res = await api.get('/tenant/reports', { params: { reportType } });
      setData(res.data.data);
    } catch {
      toast.error('Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const exportReport = async (format) => {
    try {
      const res = await api.get(`/tenant/reports/export/${format}`, {
        params: { reportType },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `${reportType}-report.${format === 'excel' ? 'xlsx' : 'pdf'}`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Export failed');
    }
  };

  return (
    <div>
      <div className="page-header"><h1>Reports</h1></div>
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'end' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Report Type</label>
            <select className="form-control" value={reportType} onChange={(e) => setReportType(e.target.value)}>
              <option value="bookings">Bookings</option>
              <option value="revenue">Revenue</option>
              <option value="cleaners">Cleaner Performance</option>
              <option value="customers">Customers</option>
            </select>
          </div>
          <button className="btn btn-primary" onClick={generateReport} disabled={loading}>
            {loading ? 'Generating...' : 'Generate Report'}
          </button>
          <button className="btn btn-outline" onClick={() => exportReport('excel')}>Export Excel</button>
          <button className="btn btn-outline" onClick={() => exportReport('pdf')}>Export PDF</button>
        </div>
      </div>
      {data.length > 0 ? (
        <div className="card table-wrapper">
          <table>
            <thead><tr>{Object.keys(data[0]).map((key) => <th key={key}>{key.replace(/_/g, ' ')}</th>)}</tr></thead>
            <tbody>
              {data.map((row, i) => (
                <tr key={i}>{Object.values(row).map((val, j) => <td key={j}>{String(val ?? '')}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        !loading && (
          <div className="card empty-state">
            No data for this report yet. Try another report type or add bookings/customers first.
          </div>
        )
      )}
    </div>
  );
};

export default TenantReports;
