import React from 'react';

export const Dashboard: React.FC = () => {
  return (
    <div className="dashboard-container">
      <h2>Tổng quan Khách sạn</h2>
      <div className="dashboard-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginTop: '20px' }}>
        <div style={{ background: '#fff', padding: '16px', borderRadius: '8px' }}>
          <h4>Phòng đang có khách</h4>
          <p style={{ fontSize: '24px', fontWeight: 'bold' }}>18/25</p>
        </div>
        <div style={{ background: '#fff', padding: '16px', borderRadius: '8px' }}>
          <h4>Đặt phòng hôm nay</h4>
          <p style={{ fontSize: '24px', fontWeight: 'bold' }}>5</p>
        </div>
        <div style={{ background: '#fff', padding: '16px', borderRadius: '8px' }}>
          <h4>Khách đến (Check-in)</h4>
          <p style={{ fontSize: '24px', fontWeight: 'bold' }}>4</p>
        </div>
        <div style={{ background: '#fff', padding: '16px', borderRadius: '8px' }}>
          <h4>Doanh thu ngày</h4>
          <p style={{ fontSize: '24px', fontWeight: 'bold' }}>12.500.000 đ</p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
