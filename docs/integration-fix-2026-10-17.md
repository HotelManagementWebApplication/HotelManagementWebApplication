# Tích hợp ba nhánh fix vào main — 17/10/2026

## Nền và nguồn

Nền: `main` tại `ba339b616adff3b6094775db4be70b22fce8db63` của dự án hiện tại.
Tích hợp chọn phần chức năng trên nhánh `codex/integrate-hotel-fixes`; không
merge toàn bộ lịch sử repository nguồn vì khác lịch sử, có thay đổi ngoài phạm
vi và xóa cấu hình local của dự án hiện tại.

| Nguồn | Commit đã đối chiếu | Phần lấy |
|---|---|---|
| `fix/truong-tan-phat-buong-phong-maintenance` | `e701faec1e79c7ffa38ba68215abbafba0e820ad` | Giao diện buồng phòng, đồ vải và minibar; thay thao tác cục bộ bằng API |
| `fix/nguyen-le-huy-ke-toan-fb` | `fe59d86b519bb218bf3cae12f8c524d0a1f816b2` | Đề xuất danh mục, duyệt giá, báo cáo tiêu thụ và phiếu kho; sửa theo nghiệp vụ đã chốt |
| `fix/tran-hai-dat-hr-admin-manager` | `8e070d5dd3bb4c375610dcfe010a758cee87c3be` | Bảng nhân sự trực để Quản lý phân công buồng phòng, cải tiến hiển thị đề xuất |

## Các quyết định đã thực hiện

- Một module Kho & Dịch vụ, phân biệt vật tư và dịch vụ.
- Tạo mặt hàng/dịch vụ mới qua đề xuất và Quản lý duyệt; mặt hàng có ngưỡng
  tồn an toàn. Cảnh báo tồn thấp dùng phép so sánh nhỏ hơn ngưỡng đã cấu hình.
- Buồng phòng gửi yêu cầu cấp/trả kèm số lượng và lý do; Kho xử lý, chống ghi
  biến động lặp. Báo hỏng chỉ ghi thông báo, không nhập hàng hỏng vào tồn dùng được.
- Gom đồ vải và vật tư về `DichVu`/`BienDongKhoDichVu`; bỏ hai bảng tồn riêng
  `MatHangTonKho`/`BienDongTonKho` và các API/DTO/converter không còn được sử dụng.
- Giữ thời lượng riêng của từng dịch vụ; lưu giờ kết thúc trên đơn. Thay cấu
  hình sau đó không tính lại đơn cũ. Giặt nhanh/tiêu chuẩn dùng chung nhóm máy.
- Một lượt đặt tài nguyên chiếm một máy/sân/phòng/xe. Khả dụng được tính tại
  một nguồn SQL và kiểm tra dưới khóa giao dịch khi khách đặt.
- Khách trả trước toàn bộ phần tính phí qua VNPay; giữ chỗ 10 phút. Giữ quyền
  lợi miễn phí. Kiểm tra chữ ký, số tiền, chính chủ, callback lặp và callback muộn.
- Khách hủy/không đến/không dùng sau khi thanh toán không được hoàn. Tổng hóa
  đơn và checkout giữ phí đó, khấu trừ payment đã thu. Không thêm quy trình hoàn
  dịch vụ do khách sạn; sự cố vận hành xử lý ngoài web theo quyết định chủ repo.
- Lễ tân kiểm đếm/gửi bàn giao; kế toán được chỉ định chỉ xem và xác nhận nhận.
- Quản lý giao nhiệm vụ cho nhân viên buồng phòng đang trực, kể cả ca qua đêm.
  Giữ luồng HR lập hồ sơ và chờ duyệt trước khi cấp tài khoản của main hiện tại.

## Phần bỏ hoặc viết lại để giảm nợ kỹ thuật

- Bỏ các biểu mẫu BP_BM, in/PDF và dữ liệu giả phục vụ biểu mẫu buồng phòng.
- Bỏ nút buồng phòng tự duyệt nhập kho, thông báo giả và phiếu trả chỉ lưu cục bộ.
- Bỏ mô hình sáu chế độ lịch dịch vụ và việc tính lại lịch cũ theo cấu hình mới.
- Bỏ popup đếm mệnh giá/tạo bàn giao tại kế toán; giữ khả năng lễ tân kiểm đếm.
- Không khôi phục STAFF, HR tự cấp tài khoản hoặc HR giao việc buồng phòng.
- Chuông Quản lý hiển thị việc cần xử lý, không thêm hệ thống hộp thư đã đọc/chưa đọc.

## Database và phạm vi local

Giữ đúng sáu file Flyway V1–V6; triggers vẫn ở V6. Demo reset chỉ ghi dữ liệu.
Chủ repo đã cho phép sao lưu rồi dựng lại đúng `QLKS` trong container
`web-hotel-mis-sqlserver-1433`, chạy V1–V6 rồi nạp demo. Không repair checksum
hoặc sửa Flyway history.

Backup trước tích hợp: `QLKS_before_fix_merge_20261017_0245.bak`, đã chạy
`RESTORE VERIFYONLY ... WITH CHECKSUM` và chép ra thư mục báo cáo local.
Không đưa backup, log, helper tạm hay cấu hình SMTP local vào commit.

## Kiểm tra và bàn giao

Kết quả trước merge: backend 97 suite, 2.399 test qua, không lỗi hoặc bỏ qua,
chạy trên SQL Server rỗng `QLKS_merge_fix_test_v12`; frontend 37 file,
223 test qua; build TypeScript/Vite thành công. Build vẫn có cảnh báo chunk
JavaScript lớn hơn 500 kB.

Đã thao tác giao diện với database demo: buồng phòng gửi cấp 3 chai sữa tắm,
Kho duyệt phiếu và ghi biến động; kế toán xác nhận bàn giao; Quản lý giao
phòng 1001 cho nhân viên đang trực, bảng phân công cập nhật từ 4 lên 5 phòng.
Sửa nhãn đơn chờ thanh toán/hết hạn tại màn điều phối và kiểm tra rằng các
đơn này không được xác nhận sử dụng. Chưa thực hiện giao dịch VNPay ngoài hệ
thống; callback được kiểm tra bằng chữ ký hợp lệ/sai, retry và race trên SQL Server.

Commit main và kết quả dựng lại QLKS được ghi trong báo cáo hoàn thành.
Các lớp kiểm tra gồm build/test frontend, các test backend trên SQL Server
thật, sáu migration trên database rỗng, các ca sức chứa/thanh toán đồng thời,
checkout sau hủy đã trả tiền, phiếu kho, xác nhận bàn giao và ma trận phân quyền.
Giao diện được xem ở màn hình nhỏ và desktop, với dữ liệu demo thực.

Các chỉnh sửa có sẵn trong `README.md` và `application.yml` của chủ repo được
giữ riêng, nguyên nội dung. Chỉ merge local vào main; không push remote.
