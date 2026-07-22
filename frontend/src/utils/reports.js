import { useState } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';

const triggerBlobDownload = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
};

// Shared report state/actions for the tenant and super-admin report pages.
// `basePath` is the report API prefix, e.g. '/tenant/reports' or '/super-admin/reports'.
export const useReport = (basePath, initialType = 'bookings') => {
  const [reportType, setReportType] = useState(initialType);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  const generateReport = async () => {
    setLoading(true);
    try {
      const res = await api.get(basePath, { params: { reportType } });
      setData(res.data.data);
    } catch {
      toast.error('Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const exportReport = async (format) => {
    try {
      const res = await api.get(`${basePath}/export/${format}`, {
        params: { reportType },
        responseType: 'blob',
      });
      triggerBlobDownload(
        new Blob([res.data]),
        `${reportType}-report.${format === 'excel' ? 'xlsx' : 'pdf'}`
      );
    } catch {
      toast.error('Export failed');
    }
  };

  return { reportType, setReportType, data, loading, generateReport, exportReport };
};
