# 🗄️ Database - Hotel Management System (Thiết Kế & Quản Trị CSDL)

Thư mục này chứa toàn bộ tài liệu thiết kế mô hình dữ liệu, các kịch bản SQL (DDL, DML, DCL, Procedures, Triggers) và tệp tin sao lưu phục vụ cho Hệ thống Quản lý Khách sạn, sử dụng hệ quản trị cơ sở dữ liệu **PostgreSQL** (hoặc tương thích với MySQL).

---

## 📁 Chi tiết công dụng từng thư mục và tệp tin

```text
database/
├── design/             # Bản vẽ thiết kế mô hình dữ liệu (ERD)
│   ├── ERD.drawio
│   └── DatabaseDiagram.png
│
├── scripts/            # Kịch bản SQL khởi tạo và vận hành dữ liệu
│   ├── create_database.sql
│   ├── create_table.sql
│   ├── constraint.sql
│   ├── trigger.sql
│   ├── procedure.sql
│   └── sample_data.sql
│
└── backup/             # Tệp tin sao lưu dữ liệu dự phòng
    └── hotel_management.bak
```

---

### 1. Thư mục `design/` (Thiết Kế & Biểu Đồ Thực Thể)

| Tệp tin | Định dạng | Công dụng & Trách nhiệm |
| :--- | :--- | :--- |
| **`ERD.drawio`** | XML (Draw.io) | Tệp sơ đồ Thực thể - Liên kết (Entity Relationship Diagram) định dạng chuẩn của diagrams.net / Draw.io. Cho phép chỉnh sửa trực tiếp bằng VS Code extension (Draw.io Integration) hoặc trình duyệt web. Bao gồm đầy đủ 12 bảng thực thể, các trường thuộc tính, khóa chính (PK), khóa ngoại (FK) và đường nối biểu thị mối quan hệ (1-N, N-N). |
| **`DatabaseDiagram.png`** | PNG (Hình ảnh) | Ảnh sơ đồ trực quan được kết xuất từ bản thiết kế CSDL. Dùng để xem nhanh cấu trúc bảng hoặc nhúng trực tiếp vào các tài liệu thuyết minh báo cáo đồ án mà không cần mở phần mềm vẽ sơ đồ. |

---

### 2. Thư mục `scripts/` (Kịch Bản SQL Khởi Tạo & Vận Hành)

Các file SQL được sắp xếp theo đúng thứ tự thực thi chuẩn khi triển khai cơ sở dữ liệu mới từ đầu:

#### Bước 1: `create_database.sql`
- **Công dụng**: Chứa câu lệnh `CREATE DATABASE hotel_db` với bảng mã ký tự chuẩn `UTF-8` và thiết lập ngôn ngữ chuẩn (`LC_COLLATE = 'C'`, `LC_CTYPE = 'C'`). Đảm bảo hệ thống lưu trữ tiếng Việt có dấu chính xác và không bị lỗi font chữ.

#### Bước 2: `create_table.sql`
- **Công dụng**: Chứa các câu lệnh DDL (`CREATE TABLE IF NOT EXISTS`) khởi tạo 12 bảng dữ liệu cốt lõi:
  1. `users`: Lưu tài khoản người dùng và phân quyền (Admin, Quản lý, Lễ tân, Nhân viên).
  2. `customers`: Hồ sơ khách hàng (Họ tên, CCCD/Hộ chiếu, SĐT, Email, Giới tính, Địa chỉ).
  3. `room_types`: Danh mục hạng phòng (Standard, Deluxe, Suite, VIP) và giá niêm yết cơ bản.
  4. `rooms`: Danh sách phòng cụ thể (Số phòng, tầng, trạng thái: AVAILABLE, OCCUPIED, DIRTY, MAINTENANCE).
  5. `bookings`: Thông tin phiếu đặt phòng (Mã đơn, ngày đặt, ngày nhận/trả dự kiến, tiền cọc, trạng thái).
  6. `booking_rooms`: Chi tiết các phòng được gắn vào đơn đặt và đơn giá tại thời điểm đặt.
  7. `services`: Danh mục các dịch vụ phụ trợ (Buffet sáng, giặt ủi, spa, thuê xe) kèm đơn vị tính.
  8. `service_orders`: Chi tiết các lượt gọi dịch vụ từ khách lưu trú trong phòng.
  9. `invoices`: Hóa đơn thanh toán tổng hợp tiền phòng, tiền dịch vụ, chiết khấu và thuế VAT.
  10. `payments`: Ghi nhận các giao dịch thanh toán (tiền mặt, thẻ, chuyển khoản ngân hàng).
  11. `maintenance_records`: Nhật ký báo hỏng thiết bị và tiến độ sửa chữa bảo trì phòng.
  12. `audit_logs`: Bảng lưu trữ nhật ký thao tác người dùng phục vụ an toàn thông tin và kiểm toán.

#### Bước 3: `constraint.sql`
- **Công dụng**: Thiết lập các ràng buộc toàn vẹn dữ liệu nâng cao (`ALTER TABLE ADD CONSTRAINT`):
  - **Khóa ngoại (Foreign Keys)**: Ràng buộc mối quan hệ giữa các bảng với các quy tắc toàn vẹn (`ON DELETE CASCADE` khi xóa đơn đặt thì xóa chi tiết phòng đặt; `ON DELETE RESTRICT` khi phòng đang có đơn đặt thì không cho xóa phòng).
  - **Kiểm tra logic (CHECK Constraints)**:
    - Ngày trả phòng phải lớn hơn hoặc bằng ngày nhận phòng (`checkout_date >= checkin_date`).
    - Giá phòng, đơn giá dịch vụ và số lượng phải luôn là số dương (`base_price >= 0`, `quantity > 0`).
    - Số tiền thanh toán trên hóa đơn không được âm (`final_amount >= 0`).

#### Bước 4: `trigger.sql`
- **Công dụng**: Tự động hóa các nghiệp vụ logic mức cơ sở dữ liệu:
  - `trg_users_update_time`, `trg_rooms_update_time`: Tự động cập nhật cột thời gian `updated_at = CURRENT_TIMESTAMP` mỗi khi có thao tác sửa đổi bản ghi.
  - `trg_service_order_total`: Tự động nhân `quantity * unit_price` để cập nhật trường `total_price` khi có lượt gọi dịch vụ.
  - `trg_sync_room_status`: Tự động đồng bộ trạng thái phòng khi trạng thái phiếu đặt phòng thay đổi:
    - Khi đặt phòng chuyển sang `CHECKED_IN` -> Tự động chuyển phòng sang `OCCUPIED`.
    - Khi đặt phòng chuyển sang `CHECKED_OUT` -> Tự động chuyển phòng sang `DIRTY` để nhân viên buồng phòng nhận biết dọn dẹp.

#### Bước 5: `procedure.sql`
- **Công dụng**: Chứa các hàm (Functions) và thủ tục lưu trữ (Stored Procedures) xử lý logic phức tạp:
  - `sp_generate_invoice_for_booking`: Thủ tục tự động tính tổng tiền phòng (đơn giá * số đêm), tổng tiền dịch vụ đã gọi, cộng thuế VAT 8%, trừ tiền giảm giá và tự động sinh mã hóa đơn thanh toán cho khách khi Check-out.
  - `fn_get_revenue_report`: Hàm trả về bảng tổng hợp doanh thu theo khoảng thời gian tùy chọn (từ ngày... đến ngày...), bao gồm tổng số hóa đơn, doanh thu phòng, doanh thu dịch vụ và tổng tiền thực thu.

#### Bước 6: `sample_data.sql`
- **Công dụng**: Kịch bản nạp dữ liệu mẫu ban đầu (Seeding / Mock Data):
  - 3 tài khoản mẫu với các vai trò khác nhau: `admin` (Quản trị), `manager` (Quản lý), `reception` (Lễ tân).
  - Khách hàng mẫu kèm số CCCD và thông tin liên hệ.
  - 4 hạng phòng chuẩn và danh sách các phòng từ tầng 1 đến tầng 4.
  - Danh mục các dịch vụ phổ biến của khách sạn để có thể chạy thử nghiệm và kiểm thử ngay lập tức.

---

### 3. Thư mục `backup/` (Sao Lưu & Phục Hồi)

| Tệp tin | Công dụng |
| :--- | :--- |
| **`hotel_management.bak`** | Tệp tin sao lưu cơ sở dữ liệu (Database Backup Dump). Dùng để phục hồi nhanh toàn bộ cấu trúc và dữ liệu của hệ thống thông qua lệnh `pg_restore` hoặc `psql` mà không cần phải thực thi lại từng tệp tin script nhỏ lẻ. |

---

## 🛠️ Hướng dẫn thực thi khởi tạo CSDL

Chạy tuần tự các lệnh sau trong PostgreSQL:

```bash
# 1. Tạo database
psql -U postgres -f scripts/create_database.sql

# 2. Tạo bảng, ràng buộc, trigger, thủ tục và dữ liệu mẫu vào hotel_db
psql -U postgres -d hotel_db -f scripts/create_table.sql
psql -U postgres -d hotel_db -f scripts/constraint.sql
psql -U postgres -d hotel_db -f scripts/trigger.sql
psql -U postgres -d hotel_db -f scripts/procedure.sql
psql -U postgres -d hotel_db -f scripts/sample_data.sql
```
