# Nghiệm thu logic các bộ phận — 15/10/2026

Web kiểm tra trực tiếp: http://localhost:5173/.

## Kết quả sau sửa

- Lễ tân đếm phòng sẵn sàng theo trạng thái vận hành `available`, cùng nguồn định nghĩa với quản lý. Không cộng mọi phòng có nhãn vệ sinh sạch. Hai màn hiện cùng 57 phòng; 3 phòng đang dọn.
- Kỹ thuật không đếm phiếu COMPLETED hoặc ROOM_RELEASED vào cảnh báo khẩn cấp. Đã thao tác thực tế: báo hoàn thành → giám đốc nghiệm thu → xác nhận sự cố đã xử lý → kỹ thuật mở phòng. Khi phiếu đã nghiệm thu nhưng chưa mở phòng, KPI khẩn cấp là 0 và nút mở phòng vẫn có.
- Nhân sự gộp các ngày nghỉ được duyệt với chấm công có phép, bỏ đơn chờ/từ chối/đổi ca, cắt theo tháng và loại ngày trùng. Ngày có mặt trùng ngày nghỉ được đánh dấu cần đối soát. Lễ tân nghỉ ốm 13–14/10 hiện 2 ngày có phép.
- Đã tải CSV nhân sự tháng bằng nút trên web, đọc lại file: BOM UTF-8, 10 dòng gồm tiêu đề và 9 nhân viên, 10 cột, dòng FRONTDESK có 2 ngày phép.
- Demo bổ sung bút toán REVENUE_RECOGNIZED của booking đã checkout, theo tổng hóa đơn sau giảm giá và ngày trả phòng. Doanh thu tháng là 4.410.000đ, thu/hoàn ròng tháng là 10.510.000đ. Doanh thu ngày hiện tại vẫn có thể là 0 khi không có checkout trong ngày; tiền thu không được tự coi là doanh thu ngày đó.

## Dữ liệu local sau nghiệm thu

Đã dùng script reset dữ liệu có backup và RESTORE VERIFYONLY trên đúng QLKS trong container `web-hotel-mis-sqlserver-1433`. Lần cuối đưa dữ liệu về các kịch bản sạch để chủ repo tiếp tục test: 502 cần dọn, 602 đang dọn, 701 chờ kiểm tra, 702 chờ kỹ thuật, 802 sẵn sàng. Nhân viên thử HK0001, chấm công/đơn nghỉ thử và ghi chú nghiệm thu tạm đã được loại khỏi bộ demo.

Hai bản backup trước mỗi lần reset được giữ ngoài repo trong `%USERPROFILE%/.codex/backups/web-hotel-mis/`:

- QLKS-before-demo-reset-20261015-104210.bak
- QLKS-before-demo-reset-20261015-104510.bak

Không đổi cấu trúc SQL trong lượt sửa này. Backend khởi động lại thành công và Flyway xác nhận đủ 6 migration hợp lệ; không sửa checksum hoặc lịch sử Flyway.

## Kiểm tra bổ sung

- Frontend `npm run build`: thành công; còn cảnh báo bundle Vite trên 500 kB.
- 27 ca hồi quy thuộc FrontDeskPMS, MaintenanceStation, HRStation và attendanceSummary: qua. Bao gồm trạng thái phòng, cảnh báo việc đã nghiệm thu, ngày phép giao tháng/trùng nhau và đối soát chấm công. Bộ test lễ tân cũ còn cảnh báo React act ở ca mô phỏng lỗi rồi thử lại; đây không phải lỗi từ thao tác web.
- Đã xem giao diện HR và giám đốc ở desktop và rộng 600px: menu/bảng cuộn trong vùng riêng, body không tràn ngang.
- Việc nghiệm thu là các luồng vừa sửa và các luồng HR/quản lý đã ghi nhận trước đó; không khẳng định mọi chức năng chưa đi qua đều không có lỗi.

Ảnh chứng minh:

- [Nhân sự: 2 ngày phép](evidence-2026-10-15/hr-leave-summary.png)
- [Kỹ thuật đã nghiệm thu: khẩn cấp 0](evidence-2026-10-15/technical-accepted.png)
- [Lễ tân: 57 phòng sẵn sàng](evidence-2026-10-15/reception-ready.png)
- [Báo cáo giám đốc: doanh thu 4.410.000đ](evidence-2026-10-15/director-revenue.png)
- [HR trên màn hình nhỏ](evidence-2026-10-15/hr-mobile.png)
- [Giám đốc trên màn hình nhỏ](evidence-2026-10-15/director-mobile.png)

## Đích xuất bản đã được chủ repo xác nhận

- Repo `mtuyenn/web-hotel-mis`: nhánh main.
- Repo `HotelManagementWebApplication/HotelManagementWebApplication`: nhánh dev.
- Loại `backend/src/main/resources/application.yml`, README.md chứa secret và cache pytest khỏi commit. Cấu hình SMTP local được giữ nguyên.
