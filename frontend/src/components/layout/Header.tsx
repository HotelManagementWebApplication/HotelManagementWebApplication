import React from 'react';
import { useAuthStore } from '../../store/authStore';

export const Header: React.FC = () => {
  const { user, logout } = useAuthStore();

  return (
    <header className="header">
      <div className="header-title">
        <h3>Hệ Thống Quản Lý Khách Sạn</h3>
      </div>
      <div className="header-actions">
        <span>Xin chào, {user?.name || 'Admin'}</span>
        <button onClick={logout} className="btn-logout">Đăng xuất</button>
      </div>
    </header>
  );
};

export default Header;
