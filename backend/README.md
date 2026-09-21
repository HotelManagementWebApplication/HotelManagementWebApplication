# Hotel MIS backend

Spring Boot 3.4 modular monolith (Java 24) for the Hotel MIS web system. The
canonical Java package is `com.hospitality.mis`; backend code is organized into
`middleware`, `controller`, `service`, `dao`, `dto` and `entity` layers, grouped
by business module.

## Chạy local

1. Khởi động MySQL local:
   `docker compose up -d mysql`.
2. Cấu hình `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`; không commit credential.
3. Chạy `mvn spring-boot:run` trong thư mục `backend`.

Flyway quản lý schema theo thứ tự `V1` đến phiên bản hiện tại. V1 tại
`src/main/resources/db/migration/V1__baseline_schema.sql` là canonical schema
V1; các migration sau mở rộng cùng một schema contract. Hibernate chỉ validate
mapping bằng `ddl-auto=validate`, không tự tạo hoặc sửa bảng.

## Acceptance MySQL

Các test `*MySql*Test` phải chạy trên một schema tạm, tách biệt và có thể bỏ đi;
không trỏ `MIGRATION_TEST_DB_URL` vào schema local/production đang chứa dữ liệu.
Ví dụ PowerShell:

```powershell
$env:MIGRATION_TEST_DB_URL = "jdbc:mysql://localhost:3306/QLKS_P0_ACCEPTANCE?createDatabaseIfNotExist=true&useUnicode=true&characterEncoding=utf8&serverTimezone=Asia/Ho_Chi_Minh"
$env:MIGRATION_TEST_DB_USERNAME = "root"
$env:MIGRATION_TEST_DB_PASSWORD = "<local-password>"
mvn '-Dtest=MySqlMigrationTest,MySqlBillingConcurrencyTest,MySqlBillingWorkflowTest,MySqlSecuritySmokeTest' test
```

Migration đã được Flyway áp dụng là immutable. Mọi thay đổi schema tiếp theo
phải nằm trong migration phiên bản mới; không dùng `flyway repair` để che checksum
mismatch khi file migration bị sửa.

## API lõi

- `GET /api/rooms`, `GET /api/rooms/availability?from=&to=&type=`
- `POST /api/guests`, `GET /api/guests?q=`, `GET /api/guests/{id}`
- `POST /api/reservations`, `GET /api/reservations?status=&guest_id=&page=0&size=20`, `GET /api/reservations/{id}`
- `POST /api/reservations/{id}/check-in`
- `POST /api/reservations/{id}/check-out`
- `POST /api/reservations/{id}/extend`, `/cancel`, `/services`
- `GET /api/invoices/reservation/{reservationId}`
- `GET /api/services`, `POST /api/services`, `POST /api/services/{id}/stock`
- `POST /api/governance/approvals`, `POST /api/governance/approvals/{id}/approve`
- `GET/POST /api/invoices/{invoiceId}/payments`, `GET/POST /api/invoices/{invoiceId}/receipts`

Các use case ghi dữ liệu đều có transaction. Tạo đặt phòng khóa từng phòng
bằng pessimistic lock, kiểm tra khoảng giao nhau
`existingIn < requestedOut && existingOut > requestedIn`, hỗ trợ idempotency
qua `idempotencyKey`, giới hạn 3 phòng và thuê giờ tối thiểu 3 giờ.

## Policy mặc định

`HOTEL_HOURLY_MINIMUM=3`, miễn checkout trễ đến 12:20, phí trễ theo các mốc
15/20/50/100% và giảm VIP theo hạng Silver/Gold/Platinum. Checkout lập hóa đơn
theo số dư còn phải thu; payment transaction mới ghi nhận tiền thực thu. Có
thể override các policy kỹ thuật bằng biến môi trường; các ngưỡng chưa chốt
được giữ ngoài code nghiệp vụ.

## Authentication, JWT và RBAC

`POST /api/auth/login` và `POST /api/auth/refresh` là các endpoint công khai để
cấp hoặc làm mới cặp access/refresh token. Access token là JWT Bearer; các API
còn lại yêu cầu `Authorization: Bearer <token>`.

JWT dùng mã nhân viên trong `sub`. Spring Security tạo authenticated principal
từ JWT và nạp lại quyền cùng trạng thái tài khoản từ identity store. RBAC dùng
các role như `MANAGER`, `FRONT_DESK`, `ACCOUNTING` và `HOUSEKEEPING`; việc cấp
nhân viên hoặc đặt lại mật khẩu yêu cầu `MANAGER`.

Actor audit lấy từ authenticated principal trong security context.
`X-Actor-Id`, nếu client gửi, chỉ là header do client cung cấp và không được
tin cậy hoặc dùng làm identity/audit actor.

## Database ownership

Backend là DB writer duy nhất. Mọi ghi dữ liệu nghiệp vụ phải đi qua
application service, transaction boundary, authorization và audit policy; các
client không được dùng credential MySQL để ghi trực tiếp.
