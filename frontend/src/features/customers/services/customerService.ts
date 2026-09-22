import axiosClient from '../../../services/axiosClient';

export const customerService = {
  getAll: () => axiosClient.get('/customers'),
  getById: (id: string) => axiosClient.get(`/customers/${id}`),
  create: (data: unknown) => axiosClient.post('/customers', data),
  update: (id: string, data: unknown) => axiosClient.put(`/customers/${id}`, data),
  delete: (id: string) => axiosClient.delete(`/customers/${id}`),
};

export default customerService;
