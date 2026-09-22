# 🏨 Hotel Management System (Hệ Thống Quản Lý Khách Sạn)

> **Đồ án môn học: Công nghệ phần mềm (CNPM)**  
> **Kiến trúc**: Full-stack Web Application (React + Spring Boot + PostgreSQL + Docker)

---

## 📌 Tổng quan dự án

Hệ thống Quản lý Khách sạn (**Hotel Management System**) là giải pháp phần mềm toàn diện nhằm tự động hóa quy trình nghiệp vụ lưu trú khách sạn, bao gồm:
- **Quản lý phòng & đặt phòng**: Theo dõi sơ đồ phòng theo thời gian thực, quản lý các hạng phòng, tiếp nhận và xác nhận đặt phòng.
- **Tiếp đón khách hàng (Lễ tân)**: Xử lý nhanh thủ tục nhận phòng (Check-in), trả phòng (Check-out) và đổi phòng.
- **Dịch vụ gia tăng**: Quản lý danh mục và gọi dịch vụ tại phòng (ăn uống, giặt là, spa, thuê xe).
- **Thanh toán & Hóa đơn**: Tự động tính tiền phòng theo ngày/đêm, tổng hợp chi phí dịch vụ, tính thuế VAT, khấu trừ tiền đặt cọc và xuất hóa đơn chi tiết.
- **Báo cáo & Thống kê**: Biểu đồ doanh thu trực quan theo ngày/tháng, thống kê tỷ lệ lấp đầy phòng và quản lý bảo trì cơ sở vật chất.

---

## 📁 Cấu trúc tổng thể và tài liệu hướng dẫn

Dự án được phân chia thành 4 thành phần chính độc lập, mỗi thành phần đều có tài liệu `README.md` phân tích chi tiết từng thư mục và tệp tin:

```text
HotelManagementWebApplication/
│
├── 💻 frontend/                      # Giao diện người dùng (React, Vite, TypeScript, Zustand)
│   └── README.md                     # Phân tích chi tiết từng component, feature, route, store, service
│
├── ☕ backend/                       # Server API & Nghiệp vụ (Spring Boot 3, Java 17, Spring Data JPA, JWT)
│   └── README.md                     # Phân tích chi tiết từng tầng Controller, Service, Repository, Entity, DTO
│
├── 🗄️ database/                      # Thiết kế & Quản trị CSDL (PostgreSQL)
│   └── README.md                     # Chi tiết sơ đồ ERD, các script tạo bảng, constraint, trigger, procedure
│
├── 📚 docs/                          # Toàn bộ tài liệu đồ án môn học
│   └── README.md                     # Chi tiết đặc tả Use Case, Activity Diagram, Sequence Diagram, Báo cáo Word
│
├── .gitignore                        # Cấu hình loại bỏ file rác cho Git
├── README.md                         # Tài liệu tổng quan dự án (file này)
└── docker-compose.yml                # Cấu hình triển khai container hóa toàn bộ hệ thống
```

---

## 🔗 Hướng dẫn điều hướng tài liệu chi tiết

1. **[Tài liệu chi tiết Frontend](file:///d:/Memo%20Code/Code/CNPM/DAMH/HotelManagementWebApplication/frontend/README.md)**:
   - Phân tích chi tiết thư mục `public/` và `src/`.
   - Cấu trúc component nguyên tử (`Button`, `Input`, `Modal`, `Table`, `Loading`) và khung bố cục (`MainLayout`, `Sidebar`, `Header`).
   - 11 module nghiệp vụ (`auth`, `dashboard`, `customers`, `employees`, `rooms`, `booking`, `checkin-checkout`, `services`, `payment`, `maintenance`, `reports`).
   - Cấu hình Axios interceptor, xác thực JWT và quản lý state toàn cục với Zustand.

2. **[Tài liệu chi tiết Backend](file:///d:/Memo%20Code/Code/CNPM/DAMH/HotelManagementWebApplication/backend/README.md)**:
   - Kiến trúc Modular Monolith chuẩn 5 tầng: `controller`, `service`, `repository`, `entity`, `dto`.
   - Phân tích 10 phân hệ nghiệp vụ (`auth`, `customer`, `room`, `booking`, `employee`, `service`, `payment`, `maintenance`, `report`, `audit`).
   - Cấu hình bảo mật `SecurityConfig.java`, bộ lọc `JwtAuthenticationFilter.java` và xử lý lỗi tập trung `GlobalExceptionHandler.java`.

3. **[Tài liệu chi tiết Database](file:///d:/Memo%20Code/Code/CNPM/DAMH/HotelManagementWebApplication/database/README.md)**:
   - Phân tích bản vẽ sơ đồ thực thể liên kết `ERD.drawio` và ảnh `DatabaseDiagram.png`.
   - Trình tự thực thi 6 kịch bản SQL (`create_database.sql`, `create_table.sql`, `constraint.sql`, `trigger.sql`, `procedure.sql`, `sample_data.sql`).
   - Tệp sao lưu phục hồi `hotel_management.bak`.

4. **[Tài liệu chi tiết Docs](file:///d:/Memo%20Code/Code/CNPM/DAMH/HotelManagementWebApplication/docs/README.md)**:
   - Phân loại tài liệu theo vòng đời phát triển phần mềm: `01_Requirements`, `02_Analysis`, `03_Design`, `04_UI`, `05_Report`.
   - File thuyết minh báo cáo đồ án hoàn chỉnh: [BaoCao.docx](file:///d:/Memo%20Code/Code/CNPM/DAMH/HotelManagementWebApplication/docs/05_Report/BaoCao.docx).

---

## 🚀 Khởi chạy hệ thống

### Cách 1: Khởi chạy nhanh bằng Docker Compose (Khuyên dùng)
Yêu cầu máy tính đã cài đặt [Docker Desktop](https://www.docker.com/).

```bash
# Khởi chạy đồng thời cả 3 dịch vụ: Database (cổng 5432), Backend (cổng 5000), Frontend (cổng 3000)
docker compose up -d
```

### Cách 2: Chạy cục bộ thủ công
1. **Khởi tạo CSDL**: Chạy các file SQL trong thư mục `database/scripts/` vào PostgreSQL.
2. **Khởi chạy Backend**:
   ```bash
   cd backend
   mvn spring-boot:run
   ```
3. **Khởi chạy Frontend**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   Truy cập giao diện tại: `http://localhost:3000`
