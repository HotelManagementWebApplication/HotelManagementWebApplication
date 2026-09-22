import axiosClient from '../../../services/axiosClient';

export const bookingService = {
  getAll: () => axiosClient.get('/bookings'),
  create: (data: unknown) => axiosClient.post('/bookings', data),
  getById: (id: string) => axiosClient.get(`/bookings/${id}`),
};

export default bookingService;
