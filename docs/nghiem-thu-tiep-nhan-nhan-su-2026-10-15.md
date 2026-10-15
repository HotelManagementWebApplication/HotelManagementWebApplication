# Tiếp nhận và quản lý hồ sơ nhân viên — 15/10/2026

## Luồng được triển khai

1. HR tạo hồ sơ nháp và đề xuất vai trò. Nháp chưa tạo nhân viên/tài khoản.
2. HR bổ sung đủ thông tin rồi gửi duyệt. Hồ sơ chờ duyệt không được sửa.
3. Quản lý xét các vai trò HR, lễ tân, buồng phòng, kỹ thuật, kho/dịch vụ và kế toán. Đề nghị Quản lý, Admin hoặc Giám đốc do Giám đốc xét.
4. Người xét chọn duyệt, yêu cầu bổ sung hoặc từ chối và nhập lý do. Người lập không được tự duyệt.
5. Phê duyệt tạo nhân viên, mật khẩu tạm, hồ sơ và quyết định trong cùng transaction. Nhân viên phải đổi mật khẩu khi đăng nhập. Mật khẩu không lưu dạng rõ trong audit hoặc kết quả idempotency; chỉ trả trong phản hồi cấp tài khoản đầu tiên.
6. Hồ sơ cần bổ sung/bị từ chối có thể được HR sửa và gửi lại. HR tiếp tục cập nhật hồ sơ sau tiếp nhận, không đổi vai trò/trạng thái tài khoản.

Admin vẫn có endpoint cấp tài khoản quản trị trong ceiling hiện hành. Quản lý/Giám đốc bị chặn tại cả hai endpoint tạo trực tiếp cũ, phải đi qua đề nghị HR.

## Giao diện đã thay đổi

- HR: hai mục Hồ sơ nhân viên và Đề nghị tiếp nhận; form lưu nháp/gửi duyệt, xem ý kiến xét duyệt, chỉnh sửa hồ sơ, tìm kiếm/lọc, tải CSV và xem bản in A4.
- Quản lý/Giám đốc: bỏ nút tạo nhân viên trực tiếp; bổ sung hàng chờ và cửa sổ xét hồ sơ đầy đủ. Đề nghị còn xuất hiện trong Trung tâm Phê duyệt với nút Xét hồ sơ.
- Bỏ modal hướng dẫn tiếp nhận cũ, nút in chỉ hiện toast và các mục tổng quan HR giả: 65 nhân sự, cảnh báo hợp đồng/thử việc và sinh nhật tháng 9 cố định, nút chúc mừng báo gửi email dù không gửi.
- Tổng quan HR lấy số nhân viên theo bộ phận từ danh sách API. Nút Phân ca tuần tiếp theo mở đúng tuần sau.
- Hồ sơ nhân viên cũ có thể bổ sung dần, không bắt nhập giấy tờ/ngày sinh/hợp đồng chỉ để lưu thông tin liên hệ. Trường chưa có dữ liệu hiển thị Chưa cập nhật.
- Bản in nằm trong ứng dụng, chỉ chứa nhân viên đang chọn, có nút In / Lưu PDF gọi hộp thoại in của trình duyệt.

## Kiểm tra thực tế trên localhost:5173

Các thao tác sau được thực hiện qua trình duyệt trong Codex, dùng backend và SQL Server đang chạy:

| Thao tác | Kết quả quan sát |
|---|---|
| HR lưu nháp chỉ có tên/lý do | Có dòng Bản nháp, Chưa cấp tài khoản; danh sách vẫn 9 nhân viên |
| HR bổ sung và gửi duyệt | Chờ duyệt; nút sửa biến mất |
| Quản lý mở chi tiết | Hiện đủ dữ liệu hồ sơ và vai trò đề xuất |
| Quản lý yêu cầu bổ sung | HR đọc được người xét và lý do; chưa có tài khoản |
| HR sửa và gửi lại | Trở về hàng chờ xét duyệt |
| Quản lý duyệt từ Trung tâm Phê duyệt | Tạo HK0001 và hồ sơ buồng phòng cùng thông tin đã gửi |
| HR cập nhật địa chỉ sau tiếp nhận | Đọc lại thấy địa chỉ mới, người cập nhật HR và thời điểm cập nhật |
| HR lưu hồ sơ FRONTDESK còn thiếu dữ liệu nhân sự | Lưu thành công với thông tin liên hệ hiện có; các trường thiếu vẫn null |
| Xuất CSV với bộ lọc Mai Anh | Tải file thật: UTF-8 BOM, 8 cột, 2 dòng gồm tiêu đề và một nhân viên |
| Mở bản in | Hiện riêng hồ sơ HK0001, địa chỉ đã cập nhật, định dạng A4; không còn toast giả |
| Giám đốc xem đề nghị Admin | Xem đủ hồ sơ; có quyền xét trong khi Quản lý bị API từ chối |
| Giám đốc từ chối | Bị từ chối, lưu đúng lý do; không tạo tài khoản |
| Form HR/cửa sổ Giám đốc ở 600 × 900 | Body rộng 600px, dialog rộng 576px; không tràn ngang body |
| Nút Phân ca tuần tiếp theo | Mở 19/10/2026–25/10/2026; đã trả lại tuần hiện tại |
| Tải mới HR sau dọn giao diện | Tổng quan/hồ sơ mở bình thường; tổng nhân viên 9, phân ca 7/9 |

Lượt tải mới cuối phát hiện import `employeeRoleLabel` bị thiếu sau khi dọn giao diện. Đã sửa, tải mới lại HR và build lại thành công.

### Kiểm tra API thật

16 mục đã được đối chiếu qua HTTP với backend local, không dùng mock:

- Kết quả duyệt và cập nhật bằng UI đã lưu trong database.
- Kế toán không đọc endpoint hồ sơ nhân sự.
- HR, Quản lý, Giám đốc đều không dùng được endpoint auto-provision cũ để bỏ qua quy trình.
- Quản lý không dùng endpoint cập nhật hồ sơ dành cho HR; HR không gọi được endpoint xét duyệt.
- Phiên bản hồ sơ cũ bị từ chối.
- Lưu nháp thiếu thông tin được phép; gửi duyệt thiếu thông tin bị từ chối.
- Hồ sơ chờ duyệt không được sửa.
- Quản lý không được duyệt Admin và không thấy đề nghị đó trong hàng chờ của mình.
- Giám đốc trả đề nghị vai trò cấp cao để bổ sung; HR sửa và gửi lại được.
- Ba request duyệt đồng thời với cùng khóa chỉ tạo một nhân viên; chỉ phản hồi đầu có mật khẩu tạm.
- Gửi quyết định thứ hai với khóa khác bị từ chối và không tạo thêm nhân viên.

## Build và database

- `npm run build`: thành công sau thay đổi cuối. Vite còn cảnh báo bundle lớn hơn 500kB; chưa xử lý tách bundle trong phạm vi này.
- `mvn -DskipTests package`: thành công. Không chạy bộ unit/integration tự động trong lượt này; không dùng kết quả build để thay cho kiểm tra chức năng web.
- Đã chạy mới đủ Flyway V1–V6 trên staging, chuyển dữ liệu rồi đổi sang QLKS local. Backend khởi động cuối xác nhận đủ sáu migration và schema phiên bản 6 hợp lệ.
- Lần chuyển đầu bảo toàn 52 bảng dữ liệu hiện có; lần cuối bảo toàn 54 bảng, gồm hai bảng nhân sự mới. Không sửa checksum/history để ép Flyway qua.
- Giữ nguyên `application.yml` và SMTP do chủ repo quản lý.

Backup có checksum, đã `RESTORE VERIFYONLY`, nằm ngoài repo:

- `C:\Users\minht\.codex\backups\web-hotel-mis\QLKS-before-personnel-20261015-1437.bak`
- `C:\Users\minht\.codex\backups\web-hotel-mis\QLKS-before-personnel-final-20261015.bak`

Hai database trước thay đổi cũng được giữ lại dưới tên `QLKS_before_personnel_20261015` và `QLKS_before_personnel_final_20261015`.

## Trạng thái dữ liệu cuối

Đã dọn đúng ba đề nghị và hai tài khoản được tạo trong lượt kiểm tra, có kiểm tra ID/điện thoại và đối chiếu nhân viên gốc trước khi dọn. SQL xác nhận cuối: **9 nhân viên, 0 đề nghị kiểm tra còn lại, 64 phòng, 6 migration thành công**. Không reset dữ liệu nghiệp vụ của các bộ phận khác. Metadata cập nhật hồ sơ FRONTDESK được giữ lại; thông tin liên hệ gốc không đổi.

Các ảnh có HK0001/tên nhân viên mới ghi nhận trạng thái tạm thời khi kiểm tra, trước khi dọn. Ảnh `hr-clean.png` và `director-clean.png` ghi nhận danh sách sau khi dọn.

## Bằng chứng giao diện

- [HR gửi duyệt](evidence-personnel-2026-10-15/hr-pending.png)
- [Quản lý xét hồ sơ](evidence-personnel-2026-10-15/manager-review.png)
- [Bản in hồ sơ](evidence-personnel-2026-10-15/profile-print.png)
- [Form HR ở màn hình nhỏ](evidence-personnel-2026-10-15/hr-form-mobile.png)
- [Giám đốc ở màn hình nhỏ](evidence-personnel-2026-10-15/director-review-mobile.png)
- [Giám đốc từ chối có lý do](evidence-personnel-2026-10-15/director-rejected.png)
- [Tổng quan HR từ dữ liệu thật](evidence-personnel-2026-10-15/hr-overview.png)
- [HR sau khi dọn dữ liệu kiểm tra](evidence-personnel-2026-10-15/hr-clean.png)
- [Giám đốc sau khi dọn dữ liệu kiểm tra](evidence-personnel-2026-10-15/director-clean.png)

Phạm vi nghiệm thu: tiếp nhận nhân viên, phân quyền liên quan, hồ sơ/CSV/bản in và các mục giao diện đã sửa. Không kết luận toàn bộ chức năng còn lại của khách sạn không còn lỗi. Bản in được kiểm tra nội dung trên trình duyệt; chưa gửi lệnh tới máy in vật lý.
