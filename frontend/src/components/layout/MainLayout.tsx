import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

export const MainLayout: React.FC = () => {
  return (
    <div className="main-layout" style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <div className="main-content-wrapper" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Header />
        <main className="main-content" style={{ padding: '20px', flex: 1 }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
