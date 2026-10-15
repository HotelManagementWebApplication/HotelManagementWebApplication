# Tài nguyên dịch vụ và hàng tiêu hao

Áp dụng cho dữ liệu danh mục trong database đang kết nối, gồm cả dữ liệu thật của
nhóm; không nhận diện dịch vụ bằng tên hoặc danh sách mã demo trong frontend.

## Dữ liệu và quy tắc

`CauHinhLichDichVu.truTonKhiSuDung` lưu chính sách riêng cho từng dịch vụ. Công suất,
đơn vị khả dụng, thời lượng và chính sách tiêu hao độc lập với đơn vị tính giá.

- `false`: giữ chỗ theo lịch; xác nhận USED không giảm tồn và không tạo phiếu xuất.
  Lượt đã dùng vẫn chiếm tài nguyên trong khung đã đặt, tự hết chiếm dụng khi hết
  khung giờ. Sân, phòng họp, xe, spa, giường phụ… dùng cách này.
- `true`: đặt trước giữ phần hàng chưa phục vụ; xác nhận USED trừ tồn và ghi đúng
  một phiếu xuất. Khả dụng không vượt cả công suất lịch lẫn số hàng còn có thể cấp.
- Chế độ STOCK luôn là tiêu hao. Không cho cấu hình STOCK với cờ tiêu hao false.
- Nếu chưa có cờ cấu hình: các danh mục doanh nghiệp, tại phòng, giải trí, spa,
  đưa đón, giặt ủi mặc định là tài nguyên. Nhóm khác và dữ liệu cũ chưa có danh mục
  giữ quản lý tồn hiện có; cần rà soát phân loại trước khi sử dụng thật.
- Tài nguyên thiếu cấu hình công suất/thời lượng không được đặt mới. Không lấy
  số tồn cũ 999 giờ hoặc 4 ngày để suy ra số sân/phòng thực tế.

Một hàm SQL `fnDichVuTruTon` làm nguồn quyết định cho đặt, sử dụng, khả dụng và
ghi biến động kho. API nhập/xuất từ chối tài nguyên thay vì thay đổi số tồn của nó.
Lễ tân ghi dịch vụ tài nguyên qua cùng luồng đặt/xác nhận, kể cả mã mới không nằm
trong dữ liệu mẫu. Hàng hóa ghi trực tiếp tiếp tục luồng hiện có.

## Cấu hình dữ liệu thật

Trong Dịch vụ, bấm **Cấu hình** tại từng hàng, nhập công suất thực tế, đơn vị khả
dụng, số phút mỗi đơn vị/lượt, cách tính và có trừ tồn hay không. Bắt buộc ghi lý
do; backend lấy người thao tác từ tài khoản đăng nhập và ghi audit.

`GET/PUT /api/services/{id}/schedule` đọc/lưu cấu hình theo mã thật trong database.
PUT dành cho Kho/Quản lý/Giám đốc/Admin theo quyền tồn kho. Khi còn lượt đặt giữ
chỗ, hệ thống từ chối đổi cấu hình để không diễn giải lại dữ liệu đặt đang có.
Lưu lại cùng cấu hình là thao tác lặp an toàn, không tạo thêm audit.

Không chạy `seed_service_schedule.sql` để áp công suất demo lên database dev.
Script đó chỉ là số mẫu; nhóm cần nhập và xác nhận số liệu thật qua giao diện.
Không tự bù các số tồn tài nguyên đã bị trừ trước đây: số cũ được giữ nguyên để
truy vết, còn khả dụng tài nguyên dùng công suất và lịch thực tế.

## Báo cáo và tương thích

`GET /api/services/consumption?from=YYYY-MM-DD&to=YYYY-MM-DD` đọc các lượt USED và
dịch vụ ghi trực tiếp từ view, không suy từ biến động kho. Tiền dùng đơn giá đã
ghi nhận sau phần miễn phí, không dùng giá danh mục hiện tại. Vì vậy tài nguyên
vẫn lên báo cáo; hàng tiêu hao có cả lượt dùng và phiếu xuất không bị tính hai lần.
Phần Hàng xuất dùng giữ cách định giá tham chiếu và tồn cuối trước đó.

Schema vẫn thuộc đúng sáu baseline V1–V6. Khi tích hợp, tuân thủ AGENTS.md: không
repair checksum hoặc sửa Flyway history; chỉ tạo lại database demo/test đã được
cho phép. Việc chuyển dữ liệu database dùng chung phải do nhóm thực hiện theo
kế hoạch bảo toàn dữ liệu, không dùng script reset demo.

Đã kiểm tra 49 test backend, gồm mã tài nguyên mới, cấp qua Lễ tân, giữ chỗ,
tiêu hao một lần, hạn mức miễn phí, báo cáo, phân quyền và các luồng kho liên quan.
Chỉ làm việc trên nhánh cá nhân; chưa commit/push hoặc merge vào dev.
