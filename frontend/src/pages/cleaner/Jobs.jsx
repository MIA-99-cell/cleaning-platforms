import { useEffect, useState } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const Jobs = () => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchJobs = () => {
    api.get('/cleaner/jobs').then((res) => setJobs(res.data.data)).finally(() => setLoading(false));
  };

  useEffect(() => { fetchJobs(); }, []);

  const updateJob = async (assignmentId, action) => {
    try {
      await api.patch(`/cleaner/jobs/${assignmentId}`, { action });
      toast.success(`Job ${action}`);
      fetchJobs();
    } catch {
      toast.error('Action failed');
    }
  };

  return (
    <div>
      <div className="page-header"><h1>My Jobs</h1></div>
      <div className="card table-wrapper">
        {loading ? <p>Loading...</p> : jobs.length === 0 ? (
          <div className="empty-state">No jobs assigned yet</div>
        ) : (
          <table>
            <thead>
              <tr><th>Service</th><th>Customer</th><th>Date</th><th>Time</th><th>Address</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.assignment_id}>
                  <td>{j.service_name}</td>
                  <td>{j.customer_name}</td>
                  <td>{j.scheduled_date?.split('T')[0]}</td>
                  <td>{j.scheduled_time}</td>
                  <td>{j.address}</td>
                  <td><span className="badge badge-info">{j.assignment_status}</span></td>
                  <td>
                    {j.assignment_status === 'assigned' && (
                      <>
                        <button className="btn btn-success btn-sm" onClick={() => updateJob(j.assignment_id, 'accepted')}>Accept</button>
                        <button className="btn btn-danger btn-sm" style={{ marginLeft: 4 }} onClick={() => updateJob(j.assignment_id, 'rejected')}>Reject</button>
                      </>
                    )}
                    {j.assignment_status === 'accepted' && (
                      <button className="btn btn-primary btn-sm" onClick={() => updateJob(j.assignment_id, 'in_progress')}>Start Job</button>
                    )}
                    {j.assignment_status === 'in_progress' && (
                      <button className="btn btn-success btn-sm" onClick={() => updateJob(j.assignment_id, 'completed')}>Complete</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default Jobs;
