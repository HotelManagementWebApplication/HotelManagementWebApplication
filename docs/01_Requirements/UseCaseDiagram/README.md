# Sơ đồ Use Case Tổng Quan (Use Case Diagram)

## 1. Danh sách Tác nhân (Actors)
- **Khách hàng (Customer)**: Xem phòng, yêu cầu đặt phòng, gọi dịch vụ phòng.
- **Lễ tân (Receptionist)**: Quản lý đặt phòng, làm thủ tục Check-in / Check-out, gọi dịch vụ thay khách.
- **Quản lý (Manager)**: Quản lý danh mục phòng, giá, nhân viên, xem báo cáo doanh thu.
- **Kế toán (Cashier / Accountant)**: Lập và xuất hóa đơn, thống kê thu chi.
- **Nhân viên bảo trì (Maintenance Staff)**: Cập nhật tình trạng hỏng hóc, sửa chữa phòng.

## 2. Danh mục Phân hệ Use Case
| STT | Phân hệ | Danh sách Use Case | Tác nhân chính |
|-----|---------|-------------------|----------------|
| 1 | Xác thực | Đăng nhập, Đổi mật khẩu, Đăng xuất | Tất cả |
| 2 | Quản lý Đặt phòng | Tìm phòng, Đặt phòng, Hủy đặt phòng | Khách hàng, Lễ tân |
| 3 | Lưu trú | Làm thủ tục Check-in, Check-out | Lễ tân |
| 4 | Dịch vụ | Đặt dịch vụ, Hủy dịch vụ | Lễ tân, Khách hàng |
| 5 | Thanh toán | Tạo hóa đơn, Thanh toán, In hóa đơn | Kế toán, Lễ tân |
| 6 | Quản trị | Quản lý phòng, Quản lý giá, Báo cáo | Quản lý |
