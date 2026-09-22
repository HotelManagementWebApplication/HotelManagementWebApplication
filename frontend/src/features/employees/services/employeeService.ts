import axiosClient from '../../../services/axiosClient';

export const employeeService = {
  getAll: () => axiosClient.get('/employees'),
  getById: (id: string) => axiosClient.get(`/employees/${id}`),
};

export default employeeService;
