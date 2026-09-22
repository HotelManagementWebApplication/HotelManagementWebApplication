import { create } from 'zustand';
import { User } from '../features/auth/types';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: { id: '1', name: 'Admin Demo', role: 'admin' }, // Default authenticated for easy testing
  token: 'mock-token',
  isAuthenticated: true,
  login: (user, token) => {
    localStorage.setItem('access_token', token);
    set({ user, token, isAuthenticated: true });
  },
  logout: () => {
    localStorage.removeItem('access_token');
    set({ user: null, token: null, isAuthenticated: false });
  },
}));

export default useAuthStore;
