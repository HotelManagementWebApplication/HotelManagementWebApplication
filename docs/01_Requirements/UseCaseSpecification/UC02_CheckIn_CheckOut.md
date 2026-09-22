# Đặc Tả Use Case: Check-in / Check-out (UC02)

- **Mã Use Case**: UC02
- **Tên Use Case**: Xử lý thủ tục Check-in và Check-out
- **Tác nhân**: Nhân viên Lễ tân

## 1. Quy trình Check-in
1. Lễ tân tra cứu mã đặt phòng hoặc CCCD của khách.
2. Hệ thống hiển thị thông tin đặt phòng và phòng được phân công.
3. Lễ tân đối chiếu giấy tờ tùy thân và xác nhận nhận phòng.
4. Hệ thống cập nhật trạng thái đặt phòng thành `CHECKED_IN` và trạng thái phòng sang `OCCUPIED`.

## 2. Quy trình Check-out
1. Lễ tân chọn phòng cần trả.
2. Hệ thống tải thông tin tiền phòng, tổng tiền dịch vụ phát sinh, tiền cọc.
3. Hệ thống sinh hóa đơn thanh toán cuối cùng.
4. Khách hoàn tất thanh toán, hệ thống chuyển trạng thái phòng sang `DIRTY` để bộ phận buồng phòng dọn dẹp.
