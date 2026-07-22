import axios from 'axios';

const PRODUCTION_API = 'https://cleaning-platforms.onrender.com/api';

const getApiBase = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return '/api';
    }
    // In production, call Render directly (works for vercel.app and custom domains).
    return PRODUCTION_API;
  }
  return '/api';
};

const api = axios.create({
  baseURL: getApiBase(),
  timeout: 60000,
  headers: { 'Content-Type': 'application/json' },
});

// Uploaded files (e.g. /uploads/products/x.png) live on the backend server,
// so on Vercel they must be prefixed with the Render origin.
export const resolveAssetUrl = (url) => {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  const backendOrigin = getApiBase().replace(/\/api$/, '');
  return `${backendOrigin}${url.startsWith('/') ? '' : '/'}${url}`;
};

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const publicPaths = ['/login', '/register', '/verify-email', '/forgot-password', '/reset-password', '/cleaner/setup', '/payment/return', '/'];
    const isPublic = publicPaths.some((p) => (
      window.location.pathname === p
      || window.location.pathname.startsWith(`${p}/`)
      || window.location.pathname.startsWith(`${p}?`)
    ));
    if (error.response?.status === 401 && !isPublic) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
