# Kiểm toán tích hợp giao diện – backend hiện tại

Ngày cập nhật: 20/09/2026

## Cập nhật kiểm chứng runtime ngày 21/09/2026

- MySQL đang chạy trong container `web-hotel-mis-mysql-3307`, database `QLKS`, cổng host `3307`; backend duy nhất chạy cổng `8080` và Flyway đang ở v34.
- Đối chiếu trực tiếp bằng ID: `rooms` trong database = 64 và `/api/public/rooms` = 64, không có ID lệch; `services` active trong database = 34 và `/api/public/services` = 34, không có ID lệch.
- Đăng nhập customer `0901234567` thành công; API customer trả booking có các nguồn `DIRECT` và `AGODA`. Các API đọc thật của FRONTDESK, HOUSEKEEP, ACCOUNTING, KITCHEN và MANAGER đều trả HTTP 200 với tài khoản seed tương ứng.
- V31 lưu metadata dùng chung của loại phòng; V33 bổ sung mô tả quảng cáo riêng trên từng bản ghi `rooms` và V34 phân bổ 3 ảnh gốc khác nhau cho từng `room_id` trong `room_images`. Public API và giao diện ưu tiên dữ liệu riêng của phòng, chỉ dùng metadata loại phòng làm dự phòng cho dữ liệu cũ.
- V34 đổi RT009 thành `Biệt thự Hoàng gia · Nguyên căn`: mỗi mã phòng là một căn villa hoàn chỉnh cho tối đa 8 khách, có mô tả riêng theo từng căn và gallery villa riêng.
- Nút bàn giao két của kế toán đã chuyển từ đổi trạng thái local sang gửi tổng tiền và chi tiết mệnh giá qua `POST /api/finance/cash-handovers`.

### Phân biệt dữ liệu vận hành và nội dung giao diện

Danh mục phòng, giá, diện tích, hướng, giường, sức chứa, mô tả riêng từng phòng,
ảnh riêng từng phòng, tagline, gallery,
danh mục dịch vụ, giá dịch vụ và trạng thái booking là dữ liệu backend/database.
Ảnh hero, tiêu đề trang, icon tiện ích và nội dung bố cục marketing còn lại là
tài sản trình bày tĩnh của giao diện; chúng không đại diện cho bản ghi phòng hay
dịch vụ và không được dùng để đặt phòng.

Các test component vẫn có fixture mock riêng để kiểm thử trạng thái lỗi/loading;
đó không phải nguồn dữ liệu runtime. Bộ E2E live hiện vẫn bỏ qua nếu chưa cung cấp
các biến môi trường fixture disposable, vì vậy không được tính là bằng chứng live.

## Kết luận vận hành

- Frontend chạy tại `http://localhost:5173`.
- Một backend duy nhất chạy tại `http://localhost:8080`.
- Vite proxy chuyển các request `/api` từ frontend sang backend 8080.
- Backend kết nối MySQL `QLKS` tại cổng 3307.
- API kiểm tra thực tế đang trả về 64 phòng và 34 dịch vụ từ database; database có 192 ảnh hoạt động, 192 URL ảnh khác nhau và 64/64 phòng có đủ 3 URL ảnh khác nhau.
- Database đang ở Flyway v34; 24 dịch vụ thương mại có mặt bằng/voucher tương ứng,
  còn các dịch vụ nội bộ như minibar, bữa sáng tại phòng, giặt ủi, trang trí,
  đưa đón và tour không bị gắn nhầm vào đối tác thuê mặt bằng.
- Các mặt bằng thương mại đã có dữ liệu cho nhà hàng, bar, spa, thể thao, hội nghị
  và hồ bơi theo tầng. Hồ bơi yêu cầu booking `PACKAGE` đã cọc của đúng khách.
- Giao diện khách hàng không còn lấy danh sách phòng từ `frontend/src/data.ts` và không còn tự rơi về danh sách dịch vụ mẫu khi API lỗi.

## Các màn hình đã dùng dữ liệu backend

| Màn hình | Dữ liệu và thao tác đã nối |
|---|---|
| `CustomerPortal` | Phòng, tình trạng còn phòng, chi tiết phòng, dịch vụ, mặt bằng thương mại, tạo booking online, mã cọc và `booking_source`. |
| `FrontDeskPMS` | Dashboard khách đến/đi/đang ở, phòng, booking, check-in, check-out, gia hạn, chuyển phòng, thêm dịch vụ, hóa đơn, thanh toán, biên lai, bàn giao két. |
| `HousekeepingStation` | Nhiệm vụ buồng, checklist, kiểm tra minibar, sự cố, tồn đồ vải và nhập/xuất đồ vải. |
| `MaintenanceStation` | Phiếu kỹ thuật, cập nhật trạng thái, nghiệm thu/mở khóa phòng, danh mục tài sản và trạng thái tài sản. |
| `KitchenInventory` | Danh mục dịch vụ, tồn kho, biến động nhập/xuất, đề xuất đổi giá và hàng đợi phê duyệt. |
| `AccountingStation` | Hóa đơn, công nợ, bàn giao két, đối soát OTA, VAT/XML, đối tác/mặt bằng và xuất công nợ tháng. |
| `HRStation` | Nhân viên, ca làm, import chấm công, nghỉ phép, phê duyệt nghỉ phép và tự sinh tài khoản nhân viên. |
| `AdminStation` | Danh sách nhân viên, khóa/mở tài khoản, audit log, tạo tài khoản nhân viên và đổi vai trò theo hợp đồng backend. |
| `ManagerDashboard` | Hàng đợi phê duyệt, phòng, nhân sự, nhiệm vụ buồng, sự cố, hóa đơn và chi phí. |
| `StaffPortal` | Ảnh chụp tổng quan theo vai trò từ phòng, booking, nhiệm vụ, nhân sự và hóa đơn backend. |

## Luồng booking online đúng nghiệp vụ

1. Khách đăng nhập rồi tạo booking.
2. Backend lưu booking ở trạng thái `DRAFT`, tiền cọc ở trạng thái `PENDING`, đồng thời lưu nguồn đặt phòng.
3. Giao diện hiển thị mã booking, mã thanh toán cọc và số tiền cọc thật do backend trả về.
4. Cổng thanh toán gọi `POST /api/public/payment-callbacks/deposit` với chữ ký HMAC hợp lệ.
5. Backend đổi booking sang `DEPOSIT_PAID`.
6. Dashboard lễ tân mới đưa booking đó vào nhóm “Khách đến hôm nay”. Booking chưa cọc vẫn nằm ở nhóm “Booking chưa thanh toán cọc”, không hiện nhầm ở danh sách khách đến.

Với voucher hồ bơi, frontend lấy booking đêm đã cọc của tài khoản khách và gửi
`reservation_id`; backend kiểm tra đúng chính sách `GUEST_ONLY` trước khi phát hành mã.

Tiền cọc hiện là 50% theo chính sách backend. Thuê theo giờ dùng `hourly_price` của `room_types`; nếu loại phòng chưa cấu hình giá giờ thì backend mới dùng giá ngày chia 24 làm dự phòng nghiệp vụ.

## Phần còn phụ thuộc hệ thống ngoài hoặc chưa phải thao tác backend

- Xác nhận thanh toán cọc trên giao diện khách chưa thể tự hoàn tất nếu chưa có cổng thanh toán thật; frontend chỉ hiển thị hướng dẫn/mã cọc. Việc xác nhận phải đi qua webhook HMAC.
- Một số nút tiện ích của màn hình quản trị như sao lưu snapshot, xuất audit CSV, gửi email và cài đặt bảo mật hiện mới là giao diện; chưa có API nghiệp vụ tương ứng nên không được xem là đã ghi database.
- Backend chưa có thao tác xóa ca trực; giao diện HR báo rõ thay vì giả vờ lưu.
- Các dịch vụ nội bộ không có mặt bằng voucher sẽ cần luồng “yêu cầu dịch vụ gắn vào booking”
  riêng nếu muốn khách tự đặt trực tiếp từ portal; hiện chúng vẫn hiển thị đúng catalog
  backend nhưng không phát hành voucher đối tác.
- Một số thông tin trang trí như avatar, thời tiết, tên ca trực ở header không phải dữ liệu vận hành.

Các phần trên không ảnh hưởng đến luồng đặt phòng, cọc, lễ tân, buồng phòng, kỹ thuật, kho, kế toán và nhân sự đã nối backend.
