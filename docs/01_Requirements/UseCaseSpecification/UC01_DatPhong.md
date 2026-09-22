# Đặc Tả Use Case: Đặt Phòng (UC01)

- **Mã Use Case**: UC01
- **Tên Use Case**: Đặt phòng khách sạn
- **Tác nhân**: Khách hàng, Lễ tân
- **Mục đích**: Cho phép khách hàng hoặc lễ tân tạo mới một đơn đặt phòng cho khách.

## 1. Tiền điều kiện
- Khách sạn có phòng còn trống phù hợp với ngày check-in và check-out yêu cầu.

## 2. Luồng sự kiện chính (Basic Flow)
1. Lễ tân/Khách chọn khoảng ngày lưu trú (Ngày đến, Ngày đi) và số lượng khách.
2. Hệ thống hiển thị danh sách các phòng còn trống theo từng loại phòng.
3. Người dùng chọn phòng và nhập thông tin khách hàng (Họ tên, CCCD/Hộ chiếu, SĐT, Email).
4. Hệ thống tính toán tổng tiền tạm tính và số tiền đặt cọc cần thanh toán.
5. Người dùng xác nhận thông tin đặt phòng.
6. Hệ thống lưu thông tin đặt phòng với trạng thái `CONFIRMED` (hoặc `PENDING`) và sinh mã đặt phòng (Booking Code).
7. Hệ thống thông báo đặt phòng thành công.

## 3. Luồng rẽ nhánh / Ngoại lệ (Alternative / Exception Flows)
- **Hết phòng**: Nếu không còn phòng trống trong khoảng thời gian đã chọn, hệ thống thông báo và gợi ý ngày/hạng phòng khác.
- **Khách hàng cũ**: Khi nhập CCCD, hệ thống tự động điền các thông tin họ tên, số điện thoại đã có.
