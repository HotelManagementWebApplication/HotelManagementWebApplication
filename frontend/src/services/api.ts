export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

export const ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    ME: '/auth/me',
  },
  ROOMS: '/rooms',
  BOOKINGS: '/bookings',
  CUSTOMERS: '/customers',
  SERVICES: '/services',
  INVOICES: '/invoices',
  REPORTS: '/reports',
};
