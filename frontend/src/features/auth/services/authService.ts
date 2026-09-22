import axiosClient from '../../../services/axiosClient';
import { LoginCredentials, User } from '../types';

export const authService = {
  login: (credentials: LoginCredentials) => axiosClient.post<{ user: User; token: string }>('/auth/login', credentials),
  getCurrentUser: () => axiosClient.get<User>('/auth/me'),
};

export default authService;
