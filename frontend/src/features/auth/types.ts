export interface User {
  id: string;
  name: string;
  role: 'admin' | 'manager' | 'receptionist' | 'staff';
  email?: string;
}

export interface LoginCredentials {
  username?: string;
  password?: string;
}
