# 📚 Docs - Hotel Management System (Tài Liệu Đồ Án Môn Học)

Thư mục này chứa toàn bộ tài liệu đặc tả yêu cầu, tài liệu phân tích thiết kế phần mềm, bản vẽ giao diện và báo cáo đồ án của môn học **Công nghệ phần mềm (CNPM)** cho đề tài **Hệ thống Quản lý Khách sạn (Hotel Management System)**.

Cấu trúc được chuẩn hóa theo quy trình phát triển phần mềm chuẩn công nghiệp (SDLC):

---

## 📁 Chi tiết công dụng từng thư mục và tệp tin

```text
docs/
├── 01_Requirements/          # Đặc tả yêu cầu phần mềm (SRS)
│   ├── UseCaseDiagram/
│   └── UseCaseSpecification/
│
├── 02_Analysis/              # Phân tích hệ thống (Phân tích động)
│   ├── ActivityDiagram/
│   └── SequenceDiagram/
│
├── 03_Design/                # Thiết kế hệ thống (Kiến trúc & CSDL)
│   ├── ClassDiagram/
│   ├── ERD/
│   └── DatabaseDesign/
│
├── 04_UI/                    # Thiết kế giao diện người dùng (UI/UX)
│   ├── Wireframe/
│   └── Mockup/
│
└── 05_Report/                # Báo cáo tổng kết đồ án
    └── BaoCao.docx
```

---

### 1. Thư mục `01_Requirements/` (Đặc Tả Yêu Cầu Phần Mềm)

Chịu trách nhiệm xác định "Hệ thống làm được những gì?", đóng vai trò là hợp đồng chức năng giữa người sử dụng (khách sạn) và đội ngũ phát triển phần mềm:

| Thư mục / Tệp tin | Công dụng & Trách nhiệm |
| :--- | :--- |
| **`UseCaseDiagram/`**<br>`README.md` | **Sơ đồ Ca Sử Dụng (Use Case Diagram)**:<br>- Định danh danh sách các tác nhân (Actors): Khách hàng, Lễ tân, Quản lý, Kế toán, Kỹ thuật viên bảo trì.<br>- Phân chia các phân hệ chức năng: Phân hệ Xác thực, Phân hệ Đặt phòng, Phân hệ Lưu trú (Check-in/out), Phân hệ Dịch vụ, Phân hệ Thanh toán, Phân hệ Quản trị.<br>- Giúp người đọc có cái nhìn tổng quát về phạm vi chức năng của toàn bộ hệ thống. |
| **`UseCaseSpecification/`**<br>`UC01_DatPhong.md`<br>`UC02_CheckIn_CheckOut.md` | **Đặc Tả Chi Tiết Ca Sử Dụng (Use Case Specification)**:<br>- Mô tả chi tiết từng Use Case theo biểu mẫu chuẩn: Mã UC, Tên UC, Tác nhân tham gia, Tiền điều kiện, Hậu điều kiện, Luồng sự kiện chính (Basic Flow) từng bước từ người dùng đến hệ thống phản hồi.<br>- Luồng rẽ nhánh / ngoại lệ (Alternative / Exception Flows): Xử lý khi hết phòng, khách hàng cũ tự động nhận diện thông tin, xử lý khi hủy đặt phòng.<br>- Làm căn cứ cốt lõi để lập trình viên viết logic nghiệp vụ và viết kịch bản kiểm thử (Test Case). |

---

### 2. Thư mục `02_Analysis/` (Phân Tích Hệ Thống)

Mô tả các luồng nghiệp vụ động và sự tương tác giữa các thực thể phần mềm theo thời gian:

| Thư mục / Tệp tin | Công dụng & Trách nhiệm |
| :--- | :--- |
| **`ActivityDiagram/`**<br>`README.md` | **Biểu Đồ Hoạt Động (Activity Diagram)**:<br>- Trực quan hóa quy trình làm việc (Workflow) từ điểm bắt đầu đến điểm kết thúc của các luồng nghiệp vụ lớn:<br>  1. Luồng quy trình đặt phòng trước.<br>  2. Luồng làm thủ tục nhận phòng (Check-in) và trả phòng (Check-out).<br>  3. Luồng gọi dịch vụ và ghi nhận chi phí vào phòng.<br>- Làm rõ các điểm rẽ nhánh điều kiện (Decision node) và các công việc diễn ra đồng thời (Fork/Join). |
| **`SequenceDiagram/`**<br>`README.md` | **Biểu Đồ Tuần Tự (Sequence Diagram)**:<br>- Mô tả chi tiết luồng trao đổi thông điệp (Method Calls & Return Messages) theo trục thời gian giữa: `Actor (Người dùng)` ➔ `View (React UI)` ➔ `Controller (Spring Boot)` ➔ `Service (Nghiệp vụ)` ➔ `Repository (JPA)` ➔ `Database (PostgreSQL)`.<br>- Áp dụng cho các ca sử dụng quan trọng: Đăng nhập xác thực cấp phát JWT, Quy trình Đặt phòng & Khóa phòng tạm thời, Quy trình Tính tổng tiền & Xuất hóa đơn thanh toán. |

---

### 3. Thư mục `03_Design/` (Thiết Kế Hệ Thống & Cơ Sở Dữ Liệu)

Chuyển đổi các phân tích yêu cầu thành giải pháp kỹ thuật cụ thể ở mức mã nguồn và lưu trữ dữ liệu:

| Thư mục / Tệp tin | Công dụng & Trách nhiệm |
| :--- | :--- |
| **`ClassDiagram/`**<br>`README.md` | **Biểu Đồ Lớp (Class Diagram)**:<br>- Thể hiện kiến trúc hướng đối tượng (OOP) của ứng dụng Backend.<br>- Mô tả các lớp thực thể (`User`, `Customer`, `Room`, `Booking`, `Invoice`...), các lớp dịch vụ (`AuthService`, `BookingService`...), các lớp điều khiển và các mối quan hệ (Inheritance, Association, Dependency). |
| **`ERD/`**<br>`README.md` | **Sơ Đồ Thực Thể Liên Kết (Entity Relationship Diagram)**:<br>- Chi tiết hóa mối quan hệ giữa các thực thể dữ liệu đạt chuẩn hóa bậc 3 (3NF): quan hệ 1-N (Khách hàng - Đơn đặt), N-N (Đơn đặt - Phòng qua bảng trung gian `Booking_Rooms`), 1-1 (Đơn đặt - Hóa đơn).<br>- Ngăn ngừa tình trạng dư thừa dữ liệu hoặc dị thường khi thêm/sửa/xóa. |
| **`DatabaseDesign/`**<br>`README.md` | **Từ Điển Dữ Liệu (Data Dictionary)**:<br>- Bảng tra cứu chi tiết từng bảng: Tên cột, Kiểu dữ liệu (`BIGINT`, `VARCHAR`, `DECIMAL`, `TIMESTAMP`), Ràng buộc (`PRIMARY KEY`, `NOT NULL`, `UNIQUE`), Ý nghĩa thực tế và giá trị mặc định. |

---

### 4. Thư mục `04_UI/` (Thiết Kế Giao Diện Người Dùng)

Cung cấp tài liệu thiết kế trải nghiệm người dùng (UX) và giao diện trực quan (UI):

| Thư mục / Tệp tin | Công dụng & Trách nhiệm |
| :--- | :--- |
| **`Wireframe/`**<br>`README.md` | **Bản Vẽ Bố Cục Khung Xương (Low-fidelity Wireframe)**:<br>- Phác thảo sơ đồ cấu trúc các màn hình chính mà không tập trung vào màu sắc hay đồ họa chi tiết (Dashboard chỉ số, sơ đồ phòng dạng lưới theo màu trạng thái, hộp thoại tạo đơn đặt phòng, mẫu phiếu in hóa đơn).<br>- Giúp thống nhất trải nghiệm thao tác người dùng thuận tiện và nhanh chóng nhất. |
| **`Mockup/`**<br>`README.md` | **Thiết Kế Giao Diện Hoàn Chỉnh (High-fidelity Mockup)**:<br>- Quy chuẩn giao diện hoàn chỉnh: Hệ màu chủ đạo (Primary Navy `#1e293b`, Accent Blue `#0ea5e9`, Background `#f8fafc`), Phông chữ chuẩn Inter, tỷ lệ căn lề và đường cong viền các nút bấm.<br>- Làm mẫu tham chiếu chính xác tuyệt đối cho lập trình viên Frontend khi viết mã CSS/Tailwind. |

---

### 5. Thư mục `05_Report/` (Báo Cáo Tổng Kết)

| Tệp tin | Định dạng | Công dụng & Trách nhiệm |
| :--- | :--- | :--- |
| **`BaoCao.docx`** | Microsoft Word (.docx) | **Tệp Thuyết Minh Báo Cáo Đồ Án Hoàn Chỉnh**:<br>- Định dạng chuẩn văn bản học thuật (có thể mở và chỉnh sửa trực tiếp bằng Microsoft Word, WPS Office hoặc LibreOffice).<br>- Bao gồm: Trang bìa đồ án môn học, Mục lục, Chương 1 (Tổng quan đề tài & Mục tiêu), Chương 2 (Đặc tả yêu cầu & Mô hình hóa Use Case), Chương 3 (Phân tích & Thiết kế hệ thống), Chương 4 (Kết quả cài đặt giao diện & cơ sở dữ liệu), Chương 5 (Đánh giá & Hướng phát triển tiếp theo).<br>- Dùng để nộp trực tiếp cho giảng viên chấm điểm hoặc in ấn bảo vệ đồ án môn học. |
