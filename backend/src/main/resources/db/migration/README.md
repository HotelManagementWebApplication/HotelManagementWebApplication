# Flyway SQL Server — baseline demo V1–V6

Quyết định chủ repo ngày 08/10/2026: chỉ giữ đúng sáu file, không tạo V7+.
Quy tắc bắt buộc nằm trong `AGENTS.md` ở root repository.

| File | Nội dung |
|---|---|
| `V1__baseline_schema.sql` | Bảng, cột, ràng buộc và baseline seed |
| `V2__indexes.sql` | Index độc lập |
| `V3__functions.sql` | Function |
| `V4__views.sql` | View/read model |
| `V5__stored_procedures.sql` | Stored procedure và transaction nghiệp vụ |
| `V6__triggers.sql` | Mười trigger bảo vệ tài chính, ca làm, governance và đặt dịch vụ |

Mỗi object chỉ có một định nghĩa cuối cùng trong file sở hữu, có tiêu đề và
mục lục để tra cứu. Sửa object ngay trong file đó; không thêm migration, SQL
phụ hoặc script sinh DDL để né quy tắc. Các thay đổi checksum yêu cầu dựng lại
database demo/test đã được chủ repo cho phép, rồi chạy Flyway từ V1 tới V6.
Không dùng repair, sửa checksum hoặc chỉnh lịch sử Flyway để ép validate qua.
Không dựng lại database ngoài phạm vi đã được cho phép.

Sau migration, nạp `database/demo/reset_demo.sql` để tạo dữ liệu mẫu. Script
reset chỉ quản lý dữ liệu, không chứa định nghĩa bảng/function/view/procedure/trigger.

Schema có 52 bảng nghiệp vụ, 479 cột, 52 khóa ngoại, 26 quy tắc UNIQUE và
130 ràng buộc CHECK. Tên bảng PascalCase không dấu; tên cột camelCase không
dấu. Java/API giữ tên tiếng Anh; các converter ánh xạ giá trị nghiệp vụ tiếng
Việt. Hibernate dùng `ddl-auto: validate`.

`SqlServerMigrationTest` thực thi Flyway thật trên database SQL Server trống,
kiểm tra lịch sử chỉ có V1–V6, metadata, Hibernate mapping và các hành vi SQL.

V6 định nghĩa đúng mười DML trigger. Hai trigger
`trgBienLaiBaoDamTienThu` trên `BienLai` và
`trgThanhToanBaoDamBienLai` trên `GiaoDichThanhToan`. Chúng kiểm tra toàn bộ
batch, khóa hóa đơn và ngăn biên lai vượt tiền thu gốc theo từng phương thức;
không cho sửa/xóa payment làm mất tiền bảo đảm cho biên lai. Refund vẫn giữ
biên lai lịch sử. Procedure tiếp tục sở hữu authorization, audit và số dư ròng.
Trong SSMS, xem dưới Tables → bảng tương ứng → Triggers, hoặc `sys.triggers`.

`trgCaLamViecKhongTrung` trên `CaLamViecNhanVien` chặn INSERT/UPDATE tạo
ca chồng lấn cho cùng nhân viên, kể cả batch và kích hoạt lại ca đã hủy.
Khóa nhân viên cùng thứ tự với procedure; hai ca nối tiếp vẫn hợp lệ.
DELETE chỉ giải phóng lịch nên không cần trigger; không lặp lại authorization
hoặc audit vốn do V5 sở hữu.

Hai trigger governance ngắn giữ các luật dễ trình bày nhưng vẫn có giá trị:
`trgNhatKyKiemSoatKhongSua` không cho UPDATE bằng chứng audit đã ghi (sửa sai
bằng event mới), và `trgYeuCauPheDuyetKhongTuDuyet` chặn requester tự làm
approver kể cả INSERT/UPDATE trực tiếp. DELETE audit chỉ dành cho reset demo/
test cleanup; production writer không có quyền ghi bảng trực tiếp.

Đây là yêu cầu phân quyền cho môi trường triển khai, không phải quyền đã được
V6 tự cấp/thu hồi. Local demo hiện chạy bằng tài khoản quản trị SQL Server;
các trigger vẫn chặn DML sai nhưng không thay thế việc giới hạn quyền database.

Hai trigger lịch sử `trgButToanTaiChinhKhongSua` và
`trgLichSuHangThanhVienKhongSua` ngăn sửa chứng từ tài chính hoặc lần đổi hạng
đã ghi; sửa sai phải tạo bút toán điều chỉnh hoặc sự kiện mới.

Ba trigger trên `DatDichVuKhachSan` kiểm tra giờ bữa trưa/tối theo chính sách,
buộc thời điểm dịch vụ nằm trong kỳ lưu trú và chỉ cho chuyển sang `Đã sử dụng`
khi booking ở trạng thái `Đã nhận phòng`. Các trigger xử lý theo tập `inserted`
nên vẫn đúng với lệnh nhiều dòng và DML trực tiếp.

Backend chuyển lỗi trigger dịch vụ thành lỗi nghiệp vụ HTTP 422:
`SERVICE_OUTSIDE_MEAL_HOURS`, `SERVICE_OUTSIDE_STAY` hoặc `INVALID_STATE`.
Đặt bữa sai giờ phải rollback cả đơn và audit; các mốc đầu/cuối khung giờ
phục vụ vẫn được chấp nhận, miễn còn trong kỳ lưu trú.
