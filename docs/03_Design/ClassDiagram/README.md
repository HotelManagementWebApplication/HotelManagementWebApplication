# Biểu đồ Lớp (Class Diagram)

## Các lớp chính trong kiến trúc hệ thống
- **Lớp Thực thể (Entities)**: `User`, `Customer`, `Room`, `RoomType`, `Booking`, `BookingRoom`, `Service`, `ServiceOrder`, `Invoice`, `Payment`.
- **Lớp Dịch vụ (Services)**: `AuthService`, `RoomService`, `BookingService`, `CustomerService`, `InvoiceService`.
- **Lớp Điều khiển (Controllers)**: `AuthController`, `RoomController`, `BookingController`, `CustomerController`, `InvoiceController`.
- **Lớp Truy xuất Dữ liệu (Repositories)**: Kế thừa `JpaRepository` tương ứng cho từng thực thể.
