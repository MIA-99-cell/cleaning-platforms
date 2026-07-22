import { useReport } from '../../utils/reports';

const Reports = () => {
  const { reportType, setReportType, data, loading, generateReport, exportReport } = useReport('/super-admin/reports');

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
              <option value="cleaners">Cleaners</option>
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

      {data.length > 0 && (
        <div className="card table-wrapper">
          <table>
            <thead>
              <tr>{Object.keys(data[0]).map((key) => <th key={key}>{key}</th>)}</tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr key={i}>{Object.values(row).map((val, j) => <td key={j}>{String(val ?? '')}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Reports;
