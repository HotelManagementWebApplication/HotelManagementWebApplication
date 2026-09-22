# Từ Điển Dữ Liệu (Database Design & Data Dictionary)

| Tên Bảng | Mô tả | Khóa chính | Khóa ngoại |
|----------|-------|------------|------------|
| `users` | Danh sách tài khoản nhân viên & quản trị | `id` | - |
| `customers` | Thông tin hồ sơ khách hàng | `id` | - |
| `room_types` | Danh mục các hạng phòng và giá niêm yết | `id` | - |
| `rooms` | Danh sách phòng vật lý theo tầng | `id` | `room_type_id` -> `room_types.id` |
| `bookings` | Thông tin đặt phòng của khách | `id` | `customer_id` -> `customers.id` |
| `booking_rooms`| Chi tiết các phòng được đặt trong đơn | `id` | `booking_id`, `room_id` |
| `services` | Bảng giá các dịch vụ phụ trợ | `id` | - |
| `service_orders`| Các lượt sử dụng dịch vụ phát sinh | `id` | `booking_id`, `service_id` |
| `invoices` | Hóa đơn thanh toán tổng hợp | `id` | `booking_id` -> `bookings.id` |
| `payments` | Nhật ký thanh toán / giao dịch | `id` | `invoice_id` -> `invoices.id` |
