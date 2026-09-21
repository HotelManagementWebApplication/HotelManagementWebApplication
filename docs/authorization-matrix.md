# Authorization matrix V1

Middleware xác thực JWT và gắn actor; controller khai báo quyền coarse-grained;
service là nơi kiểm tra ownership, trạng thái và điều kiện nghiệp vụ. Không xem
việc ẩn nút trên frontend là một lớp bảo mật.

Runtime hiện dùng một capability matrix tập trung trong `EmployeeRole` và
`DepartmentAccess`. Mỗi endpoint có một `@PreAuthorize` capability riêng; vì
vậy thêm role mới không tự động được quyền truy cập. `CUSTOMER` chỉ có các API
customer riêng và không nhận capability của nhân viên.

| Role | Phạm vi chính |
|---|---|
| ADMIN | Toàn quyền hệ thống |
| DIRECTOR | Toàn quyền nghiệp vụ và phê duyệt theo policy |
| MANAGER | Toàn quyền vận hành, nhân sự và phê duyệt |
| FRONT_DESK | Guest, reservation, room status và thao tác quầy |
| ACCOUNTING | Invoice, payment, service và yêu cầu approval liên quan tài chính |
| HOUSEKEEPING | Room status, reservation read, service/incident/maintenance |
| TECHNICAL | Room/equipment/maintenance write và reservation read |
| KITCHEN | Service và inventory read/write |
| STAFF | Room, guest và reservation read |

`ROOM_CATALOG_WRITE` chỉ cấp cho TECHNICAL, MANAGER, DIRECTOR và ADMIN để quản lý
ảnh phòng, danh mục tiện nghi và liên kết tiện nghi với loại phòng. Endpoint
submit room type tạo approval nội bộ gắn với actor; approval vẫn phải do actor
khác duyệt. Technical không được gọi generic approval request cho các action
khác. HOUSEKEEPING, FRONT_DESK và STAFF chỉ có quyền đọc media qua `ROOM_READ`.

## Quy tắc bảo vệ bắt buộc

- Login/refresh và các endpoint `/api/public/**` chỉ đọc là public; mọi endpoint nghiệp vụ nội bộ hoặc ghi dữ liệu phải yêu cầu actor. Public endpoint chỉ trả DTO công khai theo allow-list.
- Customer booking/payment instruction là authenticated customer scope; customer chỉ được tạo và xem dữ liệu thuộc guest của chính mình, không được dùng reservation endpoint nội bộ.
- Actor trong token phải được dùng để kiểm tra ownership/scope ở service, không
  tin `employee_id` do client gửi khi thao tác đại diện cho người đang đăng nhập.
- Refund, điều chỉnh hóa đơn, override giá và thay đổi nhạy cảm phải có
  approval/audit phù hợp với `rule.md`.
- 401 là thiếu/sai xác thực; 403 là đã xác thực nhưng không đủ quyền hoặc
  không vượt qua scope/approval.
- Các test security phải kiểm tra cả role hợp lệ, role bị từ chối và truy cập
  chéo scope.
- `DepartmentAuthorizationMatrixTest` bao phủ toàn bộ mapping nội bộ hiện tại;
  các endpoint `/api/public/**` được kiểm tra riêng ở public contract test.
  Ma trận customer booking gồm các principal ADMIN, DIRECTOR, MANAGER, FRONT_DESK,
  ACCOUNTING, HOUSEKEEPING, TECHNICAL, KITCHEN, STAFF, CUSTOMER, role lạ và
  anonymous. Ca bị từ chối phải trả 401/403 trước khi gọi service nghiệp vụ.
- JWT access token gắn với refresh-token family còn hiệu lực qua `session_id`.
  Logout, khóa/vô hiệu hóa tài khoản hoặc refresh-token replay làm access token
  cũ bị từ chối ở lần gọi tiếp theo.
- Các từ chối 401/403 của API được ghi audit với actor đã xác thực hoặc
  `ANONYMOUS`; không ghi token, query string hay body.

## Cập nhật theo rule ngày 10/09/2026

- Chỉ FRONT_DESK/MANAGER có RESERVATION_CREATE, RESERVATION_WRITE,
  RESERVATION_CHECKOUT và RESERVATION_SERVICE_WRITE. Áp dụng ở HTTP và service.
- FRONT_DESK được tìm, xem và xử lý đặt phòng liên ca; invoice/payment/receipt
  cũng cho phép lễ tân ca sau tiếp tục xử lý. Không cấp FINANCE_READ cho lễ tân.
- FRONT_DESK được ghi nhận bàn giao ca bằng `CASH_HANDOVER_WRITE`; backend tự
  tính `expected_amount` và `variance` từ `actual_amount`. Quyền này không mở
  các endpoint expense, partner-debt hay finance read.
- ACCOUNTING không được thay đổi reservation hay checkout, dù là người tạo đơn.
- Không cho actor chưa xác thực gọi ReservationService. Quyền được kiểm tra
  trước cả kết quả idempotency đã lưu.
- Ma trận HTTP hiện kiểm tra 59 endpoint nội bộ × 13 loại principal, cộng 1 test kiểm
  tra độ bao phủ. Đây chỉ là bằng chứng cho quyền endpoint hiện được khai báo;
  các capability chưa hoàn thiện được theo dõi trong `backend-plan.md`.
