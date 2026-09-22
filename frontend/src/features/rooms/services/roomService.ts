import axiosClient from '../../../services/axiosClient';

export const roomService = {
  getAll: () => axiosClient.get('/rooms'),
  getTypes: () => axiosClient.get('/room-types'),
  updateStatus: (id: string, status: string) => axiosClient.patch(`/rooms/${id}/status`, { status }),
};

export default roomService;
