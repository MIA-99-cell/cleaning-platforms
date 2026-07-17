import { useEffect, useState } from 'react';
import api from '../../services/api';

const StatCard = ({ title, value }) => (
  <div className="stat-card">
    <h3>{title}</h3>
    <div className="value">{value ?? 0}</div>
  </div>
);

const CleanerDashboard = () => {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get('/cleaner/dashboard').then((res) => setStats(res.data.data));
  }, []);

  return (
    <div>
      <div className="page-header"><h1>Cleaner Dashboard</h1></div>
      <div className="stats-grid">
        <StatCard title="Assigned Jobs" value={stats?.assigned} />
        <StatCard title="Pending Jobs" value={stats?.pending} />
        <StatCard title="Completed Jobs" value={stats?.completed} />
        <StatCard title="Performance Rating" value={stats?.rating} />
      </div>
    </div>
  );
};

export default CleanerDashboard;
