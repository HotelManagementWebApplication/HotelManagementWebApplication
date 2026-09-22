# ☕ Backend - Hotel Management System (Máy Chủ & Xử Lý Nghiệp Vụ)

Phần máy chủ và xử lý nghiệp vụ của Hệ thống Quản lý Khách sạn được xây dựng theo kiến trúc **Spring Boot 3 (Java 17)** kết hợp **Spring Data JPA**, **Spring Security**, cơ sở dữ liệu **PostgreSQL** và cơ chế xác thực **JSON Web Token (JWT)** không lưu phiên (Stateless).

Mã nguồn được tổ chức theo kiến trúc **Modular Monolith (Kiến trúc đơn khối module hóa)**, chia tách rõ ràng giữa các phân hệ nghiệp vụ, giúp hệ thống dễ bảo trì, dễ mở rộng và dễ dàng chuyển đổi sang kiến trúc Microservices khi cần thiết.

---

## 📁 Chi tiết công dụng từng thư mục và tệp tin

### 1. Thư mục gốc Backend (`backend/`)

| Tệp tin / Thư mục | Công dụng & Trách nhiệm |
| :--- | :--- |
| **`pom.xml`** | Tệp tin cấu hình Maven quản lý toàn bộ thư viện phụ thuộc: Spring Boot Web, Spring Data JPA, Spring Security, PostgreSQL Driver, Project Lombok, JJWT (Json Web Token) và các plugin đóng gói mã nguồn thành tệp `.jar`. |
| **`src/main/resources/application.yml`** | Tệp cấu hình tham số hoạt động: cổng máy chủ (`server.port: 5000`), thông số kết nối CSDL PostgreSQL (`jdbc:postgresql://localhost:5432/hotel_db`), cấu hình Hibernate (`ddl-auto: update`, format SQL log) và khóa bí mật JWT (`jwt.secret`, `expiration`). |
| **`README.md`** | Tài liệu hướng dẫn, giải thích kiến trúc tầng và cấu trúc các module nghiệp vụ của backend. |

---

### 2. Cấu trúc mã nguồn Java (`src/main/java/com/hotel/`)

#### 2.1. Tệp tin khởi chạy chính
- **`Application.java`**: Điểm khởi đầu của ứng dụng Spring Boot, chứa hàm `main(String[] args)` được gắn chú thích `@SpringBootApplication` để quét component (`Component Scan`) và kích hoạt cơ chế tự động cấu hình (`Auto-configuration`).

---

#### 2.2. Thư mục `config/` (Cấu hình hệ thống)
- **`SecurityConfig.java`**: Lớp cấu hình bảo mật Spring Security:
  - Thiết lập cơ chế không lưu trạng thái phiên (`SessionCreationPolicy.STATELESS`).
  - Vô hiệu hóa CSRF (do backend phục vụ RESTful API cho ứng dụng SPA).
  - Khai báo quyền truy cập các endpoint: cho phép truy cập công khai endpoint `/api/auth/**`, bắt buộc xác thực đối với các endpoint nghiệp vụ khác.
  - Cung cấp Bean `PasswordEncoder` sử dụng thuật toán mã hóa mật khẩu `BCryptPasswordEncoder`.
- **`DatabaseConfig.java`**: Kích hoạt tính năng JPA Auditing (`@EnableJpaAuditing`), cho phép tự động gán thời gian tạo (`createdAt`) và thời gian cập nhật (`updatedAt`) trên các thực thể.

---

#### 2.3. Thư mục `middleware/` (Bộ lọc trung gian)
- **`JwtAuthenticationFilter.java`**: Bộ lọc kế thừa `OncePerRequestFilter`, thực thi trên mỗi HTTP Request gửi đến server:
  1. Đọc và trích xuất chuỗi Token từ tiêu đề `Authorization: Bearer <token>`.
  2. Xác minh chữ ký và tính hợp lệ của Token thông qua `JwtUtils`.
  3. Nạp thông tin người dùng và quyền hạn (Roles/Authorities) vào `SecurityContextHolder` để Spring Security kiểm soát phân quyền.

---

#### 2.4. Thư mục `exception/` (Xử lý lỗi tập trung)
- **`GlobalExceptionHandler.java`**: Lớp xử lý lỗi toàn cục được đánh dấu `@RestControllerAdvice`:
  - Bắt các ngoại lệ `ResourceNotFoundException` và trả về mã lỗi `404 NOT FOUND`.
  - Bắt các ngoại lệ hệ thống không mong muốn `Exception` và trả về mã lỗi `500 INTERNAL SERVER ERROR`.
  - Chuẩn hóa cấu trúc JSON thông báo lỗi đồng nhất gửi về phía client (`timestamp`, `status`, `error`, `message`).
- **`ResourceNotFoundException.java`**: Ngoại lệ tùy chỉnh kế thừa `RuntimeException`, được ném ra khi không tìm thấy đối tượng (ví dụ: phòng không tồn tại, mã đặt phòng sai...).

---

#### 2.5. Thư mục `utils/` (Công cụ & Tiện ích dùng chung)
- **`ApiResponse.java`**: Lớp vỏ bọc (Generic Wrapper) chuẩn hóa định dạng JSON phản hồi của toàn bộ API hệ thống:
  ```json
  {
    "success": true,
    "message": "Thông báo trạng thái",
    "data": { ... }
  }
  ```
- **`JwtUtils.java`**: Chứa các phương thức tiện ích để tạo Token JWT từ thông tin người dùng, trích xuất Username/Role từ Token và kiểm tra tính toàn vẹn cũng như thời hạn của Token.

---

### 3. Thư mục `modules/` (Các Phân Hệ Nghiệp Vụ)

Mỗi module nghiệp vụ đại diện cho một tính năng cốt lõi của khách sạn và được tổ chức theo **Mô hình 5 tầng kiến trúc chuẩn (5-Layer Pattern)**:

```text
modules/<tên_module>/
├── controller/     # Tiếp nhận HTTP Request và điều hướng phản hồi
├── service/        # Chứa toàn bộ logic nghiệp vụ (Business Logic)
├── repository/     # Giao tiếp với CSDL qua Spring Data JPA
├── entity/         # Lớp thực thể ánh xạ tới bảng trong cơ sở dữ liệu
└── dto/            # Đối tượng truyền tải dữ liệu (Data Transfer Object)
```

#### Ý nghĩa 5 tầng trong từng module:
1. **`controller/`**: Chứa các lớp `@RestController`, định nghĩa các endpoint URL (`@GetMapping`, `@PostMapping`, `@PutMapping`, `@DeleteMapping`), nhận dữ liệu từ Client, gọi Service tương ứng và trả về `ResponseEntity<ApiResponse<T>>`.
2. **`service/`**: Chứa interface và các lớp `@Service` cài đặt, đảm bảo tính toàn vẹn dữ liệu, xử lý các quy tắc nghiệp vụ (ví dụ: kiểm tra trùng phòng, tính tiền phòng theo ngày đêm, trừ tiền cọc, áp dụng mã giảm giá), quản lý giao dịch CSDL (`@Transactional`).
3. **`repository/`**: Chứa các interface kế thừa `JpaRepository<Entity, Long>`, cung cấp sẵn các thao tác CRUD và các phương thức truy vấn nâng cao (JPQL hoặc Native Query).
4. **`entity/`**: Chứa các lớp thực thể Java ánh xạ trực tiếp sang bảng CSDL (`@Entity`, `@Table`, `@Id`, `@Column`, quan hệ `@ManyToOne`, `@OneToMany`...).
5. **`dto/`**: Các đối tượng thuần túy (POJO) dùng để đóng gói dữ liệu đầu vào (Request DTO) và dữ liệu đầu ra (Response DTO), ngăn chặn việc để lộ các trường nhạy cảm của Entity ra môi trường bên ngoài.

---

#### Phân tích công dụng của từng module:

| Tên Module | Trách nhiệm & Nghiệp vụ cốt lõi |
| :--- | :--- |
| **`auth/`** | **Quản lý Xác thực & Phân quyền**:<br>- `entity/User.java`: Bảng tài khoản người dùng (`users`).<br>- `dto/LoginRequest.java`: Dữ liệu gửi lên khi đăng nhập (`username`, `password`).<br>- `dto/AuthResponse.java`: Dữ liệu trả về gồm token JWT, thông tin user và quyền.<br>- `repository/UserRepository.java`: Tìm kiếm người dùng theo username.<br>- `service/AuthService.java`: Kiểm tra mật khẩu, cấp phát token JWT.<br>- `controller/AuthController.java`: Endpoint `/api/auth/login`. |
| **`customer/`** | **Quản lý Khách hàng**:<br>- `entity/Customer.java`: Lưu trữ CCCD, họ tên, số điện thoại, email, địa chỉ.<br>- `dto/CustomerDto.java`: Đối tượng truyền dữ liệu khách hàng.<br>- `repository/CustomerRepository.java`: Tìm kiếm khách theo CCCD/SĐT.<br>- `service/CustomerService.java`: Thêm, sửa, xóa, tìm kiếm lịch sử lưu trú.<br>- `controller/CustomerController.java`: Endpoint `/api/customers`. |
| **`room/`** | **Quản lý Phòng & Loại phòng**:<br>- Quản lý danh mục loại phòng (Standard, Deluxe, Suite, VIP) kèm đơn giá cơ bản và sức chứa.<br>- Quản lý từng phòng cụ thể (số phòng, tầng, trạng thái: AVAILABLE, OCCUPIED, DIRTY, MAINTENANCE). |
| **`booking/`** | **Nghiệp vụ Đặt phòng**:<br>- Xử lý đơn đặt phòng của khách: kiểm tra phòng trống trong khoảng thời gian `checkin_date` đến `checkout_date`.<br>- Lưu thông tin tiền cọc, số lượng khách, liên kết giữa đơn đặt và danh sách phòng (`booking_rooms`). |
| **`employee/`** | **Quản lý Nhân sự & Phân ca**:<br>- Quản lý hồ sơ nhân viên khách sạn, bộ phận làm việc (Lễ tân, Kế toán, Buồng phòng, Quản lý). |
| **`service/`** | **Quản lý Dịch vụ Khách sạn**:<br>- Danh mục dịch vụ bổ trợ (Ẩm thực Buffet, Giặt ủi, Spa thư giãn, Đưa đón sân bay...).<br>- Xử lý các đơn gọi dịch vụ phát sinh từ các phòng đang có khách (`service_orders`). |
| **`payment/`** | **Hóa đơn & Thanh toán**:<br>- Tự động tổng hợp chi phí phòng, chi phí dịch vụ, tính thuế VAT và trừ tiền đặt cọc để xuất hóa đơn (`invoices`).<br>- Ghi nhận các giao dịch thanh toán (`payments`) theo nhiều phương thức (Tiền mặt, Chuyển khoản, Thẻ). |
| **`maintenance/`** | **Quản lý Bảo trì & Cơ sở vật chất**:<br>- Tiếp nhận báo cáo sự cố hỏng hóc từ lễ tân hoặc buồng phòng (hỏng điều hòa, mất nước, hỏng khóa).<br>- Theo dõi trạng thái sửa chữa và ghi nhận chi phí sửa chữa. |
| **`report/`** | **Thống kê & Báo cáo Doanh thu**:<br>- Cung cấp số liệu báo cáo doanh thu theo ngày/tháng/năm.<br>- Thống kê tỷ lệ lấp đầy phòng (Occupancy Rate) và các dịch vụ được sử dụng nhiều nhất. |
| **`audit/`** | **Nhật ký Hệ thống (Audit Log)**:<br>- Ghi lại lịch sử các thao tác quan trọng trên hệ thống (ai thực hiện, hành động gì, thời gian nào, dữ liệu trước và sau khi đổi) phục vụ công tác tra cứu và bảo mật. |
