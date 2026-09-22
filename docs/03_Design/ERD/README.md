# Thiết kế Thực thể Liên kết (ERD)

Chi tiết quan hệ dữ liệu:
- **Customer (1) --- (N) Booking**: Một khách hàng có thể có nhiều đơn đặt phòng theo thời gian.
- **Booking (1) --- (N) Booking_Rooms (N) --- (1) Room**: Một đơn đặt phòng có thể đặt một hoặc nhiều phòng cùng lúc.
- **Room_Type (1) --- (N) Room**: Mỗi loại phòng (Deluxe, Standard...) có nhiều phòng vật lý cụ thể.
- **Booking (1) --- (N) Service_Order (N) --- (1) Service**: Khách trong đợt đặt phòng có thể gọi nhiều dịch vụ.
- **Booking (1) --- (1) Invoice**: Mỗi lần lưu trú tương ứng với một hóa đơn tổng thanh toán.
- **Invoice (1) --- (N) Payment**: Một hóa đơn có thể được thanh toán làm nhiều lần (đặt cọc, thanh toán nốt).
