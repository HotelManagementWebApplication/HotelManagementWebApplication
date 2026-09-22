import React from 'react';
import { NavLink } from 'react-router-dom';

export const Sidebar: React.FC = () => {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <h2>Hotel MS</h2>
      </div>
      <nav className="sidebar-nav">
        <NavLink to="/dashboard">Dashboard</NavLink>
        <NavLink to="/rooms">Quản lý Phòng</NavLink>
        <NavLink to="/booking">Đặt Phòng</NavLink>
        <NavLink to="/checkin">Check-in / Out</NavLink>
        <NavLink to="/customers">Khách Hàng</NavLink>
        <NavLink to="/services">Dịch Vụ</NavLink>
        <NavLink to="/payment">Thanh Toán</NavLink>
        <NavLink to="/reports">Báo Cáo</NavLink>
      </nav>
    </aside>
  );
};

export default Sidebar;
