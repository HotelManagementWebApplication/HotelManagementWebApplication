# Đơn vị và khả dụng dịch vụ theo lịch

Tab Dịch vụ có bộ lọc Từ thời điểm / Đến thời điểm. Cột Khả dụng theo lịch lấy
số chỗ trống **trong toàn bộ khoảng đã chọn**, không lấy số giờ/ngày đang lưu
trong tồn kho rồi đổi nhãn thành sân/phòng. Đơn vị tính giá vẫn hiển thị riêng.

`GET /api/services/availability?from=<ISO local datetime>&to=<ISO local datetime>`
yêu cầu `SERVICE_READ`; khoảng chọn phải tăng dần và không dài quá 31 ngày.
API trả `service_id`, `unit`, `capacity`, `booked`, `available`, `mode`.
`booked` là mức chiếm dụng đồng thời lớn nhất trong khoảng; `available` không âm.
Thời điểm kết thúc là biên mở: lượt kết thúc 11:00 không chiếm chỗ từ 11:00.
Lượt Đã hủy và booking phòng đã hủy/không đến không chiếm tài nguyên.

## Cấu hình demo

Cấu hình nằm trong `CauHinhLichDichVu`, được nạp từ
`database/demo/seed_lehuy_demo.sql`. Công suất là **số mẫu để kiểm thử**,
cần thống nhất số thực tế của khách sạn trước khi dùng chung.

| Nhóm | Đơn vị khả dụng | Cách tính lượt đặt |
| --- | --- | --- |
| Cầu lông/Tennis | sân | Một lượt giữ 1 sân; số lượng là số giờ, mỗi giờ 60 phút |
| Bóng bàn | bàn | Một lượt giữ 1 bàn theo số giờ |
| Phòng họp | phòng | Một lượt giữ 1 phòng theo số ngày, mỗi ngày 1.440 phút |
| Tour | suất | Số lượng khách giữ chỗ trong 240 phút |
| Xe đưa đón | xe | Số lượng giữ trong 120 phút |
| Nhà hàng/bữa sáng | suất | Giữ chỗ trong 120/60 phút |
| Spa/massage/sauna | suất | Theo số lượng; thời lượng 60/75/60 phút |
| Hồ bơi/Gym | suất | Hạn mức theo ngày; các vé cùng ngày chiếm hạn mức ngày đó |
| Giường phụ | giường | Theo số lượng; giữ đến thời điểm trả phòng của kỳ lưu trú |
| Giặt nhanh/ủi | món | Giữ trong 240/60 phút |
| Giặt qua đêm | lượt | Từ lúc nhận đến 08:00 ngày kế tiếp |
| Trang trí phòng | bộ | Giữ trong 120 phút |
| Bổ sung minibar | bộ | Tồn hiện tại trừ các lượt đã xác nhận chưa phục vụ; không trừ lại lượt đã dùng |

Hàng tồn kho ở tab Kho vẫn dùng đơn vị vật lý chai/lon/gói/cái; hiển thị đơn giá
cho cả hàng nội bộ. Script mẫu chỉ bổ sung giá các đồ dùng có giá 0, giữ nguyên
giá khác đã được nhập. Hàng nội bộ vẫn không công khai cho khách hàng.

Lịch hiển thị phản ánh dữ liệu đặt hiện có, không giữ chỗ khi người dùng xem.
Khi gửi đặt dịch vụ, backend kiểm tra lại công suất trong transaction trước khi
lưu CONFIRMED; việc chỉ xem lịch không giữ chỗ. Hai yêu cầu cùng chỗ cuối được
tuần tự hóa để chỉ một yêu cầu thành công. Luồng tính tiền khi USED giữ nguyên.
Khi không tải được lịch hoặc thiếu cấu hình, giao diện hiển thị rõ trạng thái,
không dùng số tồn để giả định sân/phòng còn trống.

Điều phối dùng `GET /api/operations/restaurant/service-bookings?date=YYYY-MM-DD`
và `POST /api/operations/restaurant/service-bookings/{id}/use`, cùng quyền điều phối
hiện có. Danh sách bao gồm mọi nhóm dịch vụ; lọc nhóm và tìm phòng/booking trên
giao diện. Ba trạng thái hiển thị là Đã đặt, Đã sử dụng và Đã hủy.
Xem [sơ đồ luồng](kho-dich-vu-sequence.md) cho trình tự kiểm tra và ghi nhận.

Tài nguyên và hàng tiêu hao dùng chính sách riêng, lưu trong database. Trong tab
Dịch vụ, nút Cấu hình nhập công suất thực tế và bật/tắt trừ tồn khi sử dụng.
Xem [quy tắc dữ liệu và hướng dẫn tích hợp](service-stock-policy.md). Báo cáo dịch
vụ lấy lượt đã dùng, không lấy phiếu xuất kho để đếm số lần dùng sân/phòng.

`seed_lehuy_demo.sql` tạo 5 lượt mẫu cho database riêng của Lê Huy,
không chạy trên database chung. Ngày nạp mẫu, chọn 10:00–11:00 để thấy một sân
cầu lông đang bận, phòng họp đã được giữ, tour đã đặt 4 suất và massage đã đặt 2 suất.
