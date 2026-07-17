import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

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
