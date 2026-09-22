import React from 'react';
import { useAuthStore } from '../../../store/authStore';

export const Profile: React.FC = () => {
  const user = useAuthStore((state) => state.user);

  return (
    <div className="profile-page">
      <h2>Thông tin cá nhân</h2>
      <p><strong>Tên:</strong> {user?.name}</p>
      <p><strong>Vai trò:</strong> {user?.role}</p>
    </div>
  );
};

export default Profile;
