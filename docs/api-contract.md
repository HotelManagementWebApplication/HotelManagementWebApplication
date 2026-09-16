# API contract V1

Đây là contract HTTP chuẩn của backend. `rule.md` là nguồn nghiệp vụ; tài liệu
này là nguồn tra cứu endpoint/DTO cho frontend, agent và test.

## Quy ước chung

- Base URL: `/api`.
- JSON request/response dùng `lower_snake_case` (`employee_id`,
  `check_in_at`, `payment_method`). Không tạo alias camelCase.
- Thời gian dùng `LocalDateTime` theo múi giờ nghiệp vụ `Asia/Ho_Chi_Minh`.
- Tiền tệ là VND. Số tiền dùng JSON number; chỉ làm tròn tổng cuối hóa đơn
  theo quy tắc trong `rule.md`.
- Endpoint ghi dữ liệu phải đi qua controller → service → DAO và chịu kiểm tra
  actor/RBAC tại middleware hoặc controller.

## Response lỗi

Lỗi nghiệp vụ/validation từ backend có dạng:

```json
{
  "timestamp": "2026-09-08T10:00:00Z",
  "status": 422,
  "code": "BUSINESS_ERROR_CODE",
  "message": "Mô tả lỗi cho người dùng",
  "details": []
}
```

Các mã nền tảng hiện có: `VALIDATION_ERROR` (400), `DATA_CONFLICT` (409),
`ACCESS_DENIED` (403). Lỗi xác thực JWT dùng response riêng của middleware;
client phải xử lý cả 401 và 403.

## Endpoint và quyền

| Method | Path | Quyền hiện tại |
|---|---|---|
| POST | `/auth/login` | Public |
| POST | `/auth/refresh` | Public |
| POST | `/auth/logout` | Đã xác thực |
| POST | `/auth/employees` | MANAGER |
| POST | `/auth/employees/{employee_id}/password` | MANAGER |
| GET | `/auth/employees?include_inactive=` / `/auth/employees/{employee_id}` | `EMPLOYEE_READ`; không trả password, có trạng thái account/login history |
| GET | `/auth/employees/{employee_id}/sessions` | `EMPLOYEE_READ`; danh sách refresh session, family và thời hạn, không trả token gốc |
| GET | `/auth/employees/{employee_id}/login-history?page=&size=` | `EMPLOYEE_READ`; lịch sử mọi lần đăng nhập thành công/thất bại, phân trang |
| DELETE | `/auth/employees/{employee_id}/sessions/{session_id}` | `EMPLOYEE_PROVISION` + role ceiling; thu hồi một session và ghi security audit |
| PATCH | `/auth/employees/{employee_id}/status` | `EMPLOYEE_PROVISION` + role ceiling; bật/tắt tài khoản và audit |
| PATCH | `/auth/employees/{employee_id}/role` | `EMPLOYEE_PROVISION` + role ceiling; đổi role không vượt ceiling và không tự nâng quyền |
| PATCH | `/auth/employees/{employee_id}/employment` | `EMPLOYEE_PROVISION` + role ceiling; WORKING/ON_LEAVE/TERMINATED và khoảng nghỉ hợp lệ |
| GET | `/guests`, `/guests/{id}` | ADMIN, DIRECTOR, MANAGER, FRONT_DESK |
| POST | `/guests` | MANAGER, FRONT_DESK |
| GET | `/rooms`, `/rooms/availability` | ADMIN, DIRECTOR, MANAGER, FRONT_DESK, HOUSEKEEPING, TECHNICAL, STAFF |
| PATCH | `/rooms/{id}/status` | ADMIN, DIRECTOR, MANAGER, FRONT_DESK, HOUSEKEEPING, TECHNICAL |
| GET/POST/PUT | `/rooms/admin`, `/rooms/admin/{id}` | `ROOM_ADMIN_READ/WRITE`; CRUD phòng chỉ gán loại phòng ACTIVE |
| GET/POST | `/rooms/{room_id}/equipment` | GET: MANAGER, HOUSEKEEPING, TECHNICAL, FRONT_DESK; POST: MANAGER, TECHNICAL |
| GET | `/rooms/{room_id}/media` | Có `ROOM_READ`; chỉ metadata ảnh active và tên tiện nghi |
| GET | `/front-desk/dashboard?date=&q=&status=&page=&size=` | Có `FRONT_DESK_DASHBOARD`; arrivals/departures/current stays, cọc chưa thu, công nợ hóa đơn, phòng và incident; phân trang danh sách booking |
| GET | `/operations/housekeeping/tasks?room_id=&assignee=&status=` | `HOUSEKEEPING_TASK_READ`; danh sách task dọn phòng |
| POST/PATCH | `/operations/housekeeping/tasks`, `/operations/housekeeping/tasks/{id}` | `HOUSEKEEPING_TASK_WRITE`; workflow NEEDS_CLEANING → IN_PROGRESS → CLEANED → READY hoặc WAITING_TECHNICAL; READY bắt buộc checklist hoàn tất và không có incident blocking |
| GET/POST | `/operations/housekeeping/checklist-templates` | `HOUSEKEEPING_TASK_READ/WRITE`; template checklist đang hoạt động |
| PATCH | `/operations/housekeeping/tasks/{id}` | `HOUSEKEEPING_TASK_WRITE`; chỉ assignee hoặc manager được cập nhật, không cho Housekeeping tự đổi assignee |
| GET/POST | `/operations/housekeeping/tasks/{id}/checklist-results` | `HOUSEKEEPING_TASK_READ/WRITE`; kết quả checklist theo task, có audit |
| GET/POST | `/hr/shifts?date=&employee_id=` | `SHIFT_READ/SHIFT_WRITE`; phân ca theo ngày/nhân viên, kiểm tra khoảng thời gian |
| GET | `/hr/shifts/coverage?date=&shift_code=&minimum_staff=` | `SHIFT_READ`; báo thiếu người theo ca |
| GET/POST/PATCH | `/operations/technical/work-orders`, `/operations/technical/work-orders/{id}` | `TECHNICAL_WORK_ORDER_READ/WRITE`; quản lý work order theo assignee, priority, SLA, vật tư và kết quả |
| POST | `/operations/technical/work-orders/{id}/release` | `TECHNICAL_WORK_ORDER_RELEASE`; chỉ release sau COMPLETED, kiểm tra phòng không OCCUPIED và chuyển ROOM_RELEASED/READY |
| POST | `/operations/technical/work-orders/{id}/accept` | `TECHNICAL_WORK_ORDER_ACCEPT`; Manager/Admin/Director nghiệm thu WAITING_ACCEPTANCE thành COMPLETED |
| POST | `/rooms/{room_id}/images` | TECHNICAL, MANAGER, DIRECTOR, ADMIN; multipart `file`, tối đa 10 ảnh/phòng, 5 MB/ảnh, JPEG/PNG/WebP |
| DELETE | `/rooms/{room_id}/images/{image_id}` | TECHNICAL, MANAGER, DIRECTOR, ADMIN; soft-delete metadata và xóa file local |
| POST | `/amenities` | TECHNICAL, MANAGER, DIRECTOR, ADMIN |
| GET/PUT | `/amenities`, `/amenities/{id}` | `ROOM_CATALOG_WRITE`; quản trị tên và active lifecycle của tiện nghi |
| POST | `/room-types` | Có `ROOM_CATALOG_WRITE`; tạo `DRAFT`, bắt buộc `Idempotency-Key` |
| GET/PUT | `/room-types/{room_type_id}` | GET: có `ROOM_READ`; PUT: `ROOM_CATALOG_WRITE`, chỉ sửa `DRAFT`/`REJECTED`, bắt buộc `Idempotency-Key` |
| POST | `/room-types/{room_type_id}/revision` | `ROOM_CATALOG_WRITE`; snapshot loại phòng ACTIVE thành mã draft mới, bắt buộc `Idempotency-Key` |
| POST | `/room-types/{room_type_id}/submit` | `ROOM_CATALOG_WRITE`; tạo approval nội bộ, bắt buộc `Idempotency-Key` |
| POST | `/room-types/{room_type_id}/activate` | ADMIN, DIRECTOR, MANAGER; approver khác requester consume approval exact payload; revision sẽ retire bản cũ và chuyển phòng |
| GET | `/room-types/{room_type_id}/price-history` | Có `ROOM_READ`; trả snapshot giá theo thời gian, approval và actor thay đổi |
| PUT | `/room-types/{room_type_id}/amenities` | TECHNICAL, MANAGER, DIRECTOR, ADMIN; thay toàn bộ liên kết tiện nghi |
| POST | `/reservations` | MANAGER, FRONT_DESK |
| GET | `/reservations?status=&guest_id=&page=&size=` | Có `RESERVATION_READ`; front_desk/manager/director/admin xem toàn khách sạn, role khác xem phạm vi actor; mặc định 20, tối đa 100 bản ghi/trang; trả `items`, `page`, `size`, `total_elements`, `total_pages` |
| GET | `/reservations/{id}` | ADMIN, DIRECTOR, MANAGER, ACCOUNTING, FRONT_DESK, HOUSEKEEPING, TECHNICAL, STAFF |
| POST | `/reservations/{id}/check-in` | MANAGER, FRONT_DESK |
| POST | `/reservations/{id}/confirm` | MANAGER, FRONT_DESK; chuyển DRAFT → CONFIRMED và giữ phòng |
| PATCH | `/reservations/{id}` | MANAGER, FRONT_DESK; cập nhật lịch các phòng đã gán trước check-in, bắt buộc `Idempotency-Key` và kiểm tra overlap |
| GET | `/reservations/{id}/timeline` | Có `RESERVATION_READ`; audit timeline của booking trong phạm vi actor |
| POST | `/reservations/{id}/check-out` | MANAGER, FRONT_DESK |
| POST | `/reservations/{id}/cancel` | MANAGER, FRONT_DESK |
| POST | `/reservations/{id}/no-show` | MANAGER, FRONT_DESK; chỉ sau khi hết giờ trả dự kiến, giữ tiền cọc |
| POST | `/reservations/{id}/extend` | MANAGER, FRONT_DESK |
| POST | `/reservations/{id}/services` | MANAGER, FRONT_DESK |
| POST | `/reservations/{id}/equipment-incidents` | MANAGER, FRONT_DESK, HOUSEKEEPING |
| GET | `/invoices/reservation/{reservation_id}` | MANAGER, ACCOUNTING, FRONT_DESK |
| POST | `/invoices/reservation/{reservation_id}/deposit/refund` | MANAGER, ACCOUNTING, FRONT_DESK; mọi lần hoàn cọc cần approval do DIRECTOR duyệt |
| POST | `/invoices/{invoice_id}/adjust` | MANAGER, ACCOUNTING; bắt buộc `Idempotency-Key` và approval exact payload |
| GET | `/services` | ADMIN, DIRECTOR, MANAGER, ACCOUNTING, FRONT_DESK, HOUSEKEEPING, KITCHEN |
| GET | `/services/low-stock` | ADMIN, DIRECTOR, MANAGER, ACCOUNTING, FRONT_DESK, HOUSEKEEPING, KITCHEN; danh sách dưới safety threshold |
| POST | `/services` | ADMIN, DIRECTOR, MANAGER, ACCOUNTING, KITCHEN |
| POST | `/services/{id}/stock` | ADMIN, DIRECTOR, MANAGER, ACCOUNTING, FRONT_DESK, HOUSEKEEPING, KITCHEN |
| GET | `/operations/maintenance/room/{room_id}` | ADMIN, DIRECTOR, MANAGER, FRONT_DESK, HOUSEKEEPING, TECHNICAL |
| POST | `/operations/maintenance` | MANAGER, HOUSEKEEPING |
| PATCH | `/operations/maintenance/{id}/status` | MANAGER, HOUSEKEEPING |
| POST | `/operations/reservations/{reservation_id}/room-transfers` | MANAGER, FRONT_DESK |
| POST | `/operations/reservations/{reservation_id}/equipment-incidents` | MANAGER, FRONT_DESK, HOUSEKEEPING |
| PATCH | `/operations/reservations/incidents/{id}/handoff` | `INCIDENT_HANDOFF`; cập nhật severity handoff OPEN/ACKNOWLEDGED/RESOLVED và ghi audit |
| POST | `/governance/approvals` | MANAGER, ACCOUNTING, FRONT_DESK |
| POST | `/governance/approvals/{id}/approve` | Có `APPROVAL_APPROVE`, khác requester; action refund bắt buộc role DIRECTOR |
| GET | `/governance/approvals?status=PENDING` | Có `APPROVAL_APPROVE` |
| GET | `/governance/approvals?status=&action=&target_id=&requester=&from=&to=&risk=&page=&size=` | Approval queue filter/pagination theo trạng thái, action, target, requester và thời gian; không có query vẫn trả list tương thích |
| POST | `/governance/approvals/{id}/reject` | Có `APPROVAL_APPROVE`, khác requester; action refund bắt buộc role DIRECTOR |
| GET | `/invoices?page=&size=` | `BILLING_READ`; danh sách invoice phân trang tối đa 100 bản ghi/trang |
| GET/POST | `/invoices/{invoice_id}/payments?page=&size=` | GET hỗ trợ phân trang; MANAGER, ACCOUNTING, FRONT_DESK |
| GET/POST | `/invoices/{invoice_id}/receipts?page=&size=` | GET hỗ trợ phân trang; MANAGER, ACCOUNTING, FRONT_DESK |
| GET | `/finance/payments?page=&size=&invoice_id=&method=&type=&status=&from=&to=` | `FINANCE_READ`; truy vấn payment/refund toàn cục có filter và phân trang |
| GET | `/finance/receipts?page=&size=&invoice_id=&method=&issued_by=&from=&to=` | `FINANCE_READ`; truy vấn receipt toàn cục có filter và phân trang |
| GET/POST | `/services/{service_id}/inventory-movements` | ADMIN, DIRECTOR, MANAGER, ACCOUNTING, FRONT_DESK, HOUSEKEEPING, KITCHEN |
| GET | `/services/{service_id}/inventory-movements/inventory-report?from=&to=` | `INVENTORY_READ`; tổng hợp RECEIVE/ISSUE/WASTE/RETURN/ADJUST theo ngày |
| POST | `/services/{service_id}/price/submit` | KITCHEN tạo approval exact payload; Manager/Admin/Director phê duyệt |
| POST | `/services/{service_id}/price/activate` | Manager/Admin/Director consume approval và ghi price history append-only |
| GET | `/services/{service_id}/price-history` | Có `SERVICE_READ`; lịch sử giá và actor/approval |
| POST | `/finance/partner-debts/{id}/settle` | `FINANCE_WRITE`; tất toán một phần/toàn bộ, khóa dòng và không vượt dư nợ |
| GET | `/finance/partner-debts/{id}/settlements`, `/finance/ledger` | `FINANCE_READ`; lịch sử tất toán và finalized ledger append-only có filter/pagination |
| GET | `/finance/reconciliation?from=&to=` | `FINANCE_READ`; đối soát payment/refund/net, doanh thu ghi nhận, công nợ đối tác và variance giao ca |
| GET | `/finance/cash-handovers?page=&size=`, `/finance/expenses?page=&size=`, `/finance/partner-debts?page=&size=` | `FINANCE_READ`; truyền page/size trả `items` và metadata, không truyền giữ response list tương thích |
| POST | `/finance/cash-handovers`, `/finance/expenses`, `/finance/partner-debts` | MANAGER, ACCOUNTING, DIRECTOR; actor giao ca lấy từ JWT |
| GET | `/governance/audit` | ADMIN, DIRECTOR, MANAGER, ACCOUNTING; scoped by actor for accounting |
| GET | `/governance/audit?action=&entity_type=&entity_id=&correlation_key=&from=&to=&page=&size=` | Filter/pagination audit theo actor scope, action, entity, correlation và thời gian; trả metadata khi có query |
| GET | `/governance/notifications/outbox?role=` | `NOTIFICATION_READ`; role được giới hạn theo authority JWT, không đọc chéo department |
| POST | `/governance/notifications/outbox/{id}/delivered` | `NOTIFICATION_WRITE`; đánh dấu event đã giao |
| POST | `/auth/customers/register` | Public |
| POST | `/auth/customers/login` | Public |
| GET | `/auth/customers/me` | CUSTOMER; only the authenticated guest |
| GET | `/public/rooms`, `/public/rooms/{room_id}` | Public; DTO công khai |
| GET | `/public/rooms/availability` | Public; khả dụng theo khoảng thời gian, không lộ booking |
| GET | `/public/services` | Public; chỉ dịch vụ active |
| POST | `/public/payment-callbacks/deposit` | Payment provider; public route nhưng bắt buộc HMAC `X-Payment-Signature` |
| POST | `/customer/reservations` | CUSTOMER; guest lấy từ JWT |
| GET | `/customer/reservations`, `/customer/reservations/{id}` | CUSTOMER; chỉ booking của chính mình |
| GET | `/customer/reservations/{id}/deposit-payment` | CUSTOMER; chỉ hướng dẫn cọc của chính mình |

## DTO chính

- Auth: `login`, `refresh_token`, `logout`, `token_response`, `provision` và
  `employee_response` dùng các field snake_case tương ứng.
- Guest: `full_name`, `birth_year`, `identity_number`, `phone`, `email`,
  `address`, `membership_tier`, `total_spend`, `late_cancellation_count`,
  `late_checkout_count`, `booking_blocked`.
- Reservation create: `guest_id`, `employee_id`, `deposit`, `rental_type`,
  `rooms[]`; mỗi room có `room_id`, `expected_check_in`,
  `expected_check_out`. Các action dùng `at`, `new_expected_check_out`,
  `service_id`, `quantity`, `used_at`.
- Room: `room_id`, `room_type_id`, `room_type_name`, `daily_price`, `floor`,
  `status`, `available`.
- Room media: `images[]` gồm `id`, `url`, `display_order`, `cover`,
  `content_type`, `size_bytes`; `amenities[]` chỉ là tên tiện nghi active.
- Invoice: `reservation_id`, `room_total`, `service_total`, `late_surcharge`,
  `compensation`, `extension_total`, `adjustment_total`, `discount`, `deposit`, `payable`,
  `payment_method`, `status`.
- Payment transaction: `amount`, `method`, `type`, `reference`, `idempotency_key` (bắt buộc, tối đa 35 ký tự; retry phải giữ nguyên payload và actor).
- Cash handover request: `shift_code`, `from_actor`, `to_actor`, `actual_amount`,
  `note`. Backend tự tính `expected_amount` từ các giao dịch CASH hoàn tất của
  actor kể từ lần giao ca trước; client không gửi trường này.

## Trạng thái chuẩn

- Reservation: `DRAFT → DEPOSIT_PAID/CONFIRMED → CHECKED_IN → CHECKED_OUT`;
  `DRAFT`, `DEPOSIT_PAID`, `CONFIRMED` có thể chuyển `CANCELLED`. Chỉ
  `DEPOSIT_PAID`/`CONFIRMED` chưa check-in mới được chuyển `NO_SHOW`, và chỉ
  sau giờ trả dự kiến; tiền cọc bị giữ.
- Room: `READY`, `OCCUPIED`, `CLEANING`, `MAINTENANCE`, `OUT_OF_SERVICE`,
  `RESERVED`, `RETURNED`, `CANCELLED`. Giá trị JSON hiện giữ mã database như
  `SAN_SANG`, `DANG_O`, `DANG_DON_DEP`.
- Payment: `DA_THANH_TOAN`, `CHUA_THANH_TOAN`, `DU_KIEN`.

## Điểm cần hoàn thiện trong bước nghiệp vụ kế tiếp

Contract đã chốt quy tắc trong `rule.md`. Checkout lập hóa đơn theo số dư còn
phải thu; payment transaction mới làm giảm số dư và chuyển trạng thái đã thanh
toán. Lượt VIP lấy theo thời lượng đặt trong booking: dưới 24 giờ không tính,
từ đủ 24 giờ tính đúng một lượt cho mỗi booking hoàn tất; booking nhiều phòng
vẫn chỉ tính một lượt, còn hủy và `NO_SHOW` không tính. Hủy đúng mốc 48 giờ
trước giờ nhận phòng mất cọc; không thu thêm phí hủy ngoài tiền cọc. `NO_SHOW`
chỉ được ghi nhận sau giờ trả dự kiến khi khách chưa check-in và tiền cọc bị giữ.
Các endpoint mới phải được thêm vào bảng contract trước khi frontend sử dụng.

## Public portal và customer booking

Phát hành Hotel OS một khách sạn có các endpoint anonymous chỉ đọc:

- `GET /api/public/rooms`
- `GET /api/public/rooms/{room_id}`
- `GET /api/public/rooms/availability?from=&to=&type=` (khi khách chọn khoảng thời gian)
- `GET /api/public/services`

Ba endpoint này phải dùng DTO public riêng. Room public chỉ được chứa mã/tên
phòng, loại phòng, tầng, giá công khai, ảnh, tiện nghi và trạng thái công khai.
Service public chỉ chứa thông tin giới thiệu đang active; không trả tồn kho,
giá vốn hoặc lịch sử giá. Không response public nào được chứa guest/employee,
PII, reservation, invoice, payment, receipt, incident detail hoặc internal note.

Các endpoint trên đã có controller, authorization và privacy contract test. Danh sách
`/api/public/rooms` hỗ trợ query `page` (mặc định 0) và `size` (mặc định 20,
tối đa 100). Để giữ tương thích response body vẫn là array; tổng số phần tử và
trang hiện tại nằm ở `X-Total-Count`, `X-Page`, `X-Page-Size`. Catalog/detail có
cache ngắn hạn; availability luôn trả `Cache-Control: no-store`. Anonymous public
request vượt rate limit nhận `429` với error code chuẩn.

Chi tiết
phòng đã đọc ảnh active và tiện nghi active từ media/catalog store. Khi
không truyền khoảng thời gian, trạng thái trả về là trạng thái vận hành hiện tại;
khi truyền `from`/`to`, response chỉ trả `current_status` và `available`, không trả
lịch hoặc danh tính booking.

Customer đã đăng nhập sẽ có command/query riêng cho booking của chính mình,
không dùng endpoint reservation nội bộ:

- `POST /api/customer/reservations`
- `GET /api/customer/reservations`
- `GET /api/customer/reservations/{reservation_id}`
- `GET /api/customer/reservations/{reservation_id}/deposit-payment`

Các endpoint customer đã được triển khai ở mức tạo booking DRAFT và trả mã/hướng
dẫn cọc `PENDING`. Backend lấy guest từ principal, không nhận `guest_id` tùy ý;
customer chỉ xem được booking/payment instruction của chính mình. Callback thanh
toán `/api/public/payment-callbacks/deposit` được xác minh bằng HMAC và xử lý
idempotent theo `provider_event_id`; callback thành công tạo ledger BANK_TRANSFER,
chuyển booking `DRAFT → DEPOSIT_PAID` và không chấp nhận số tiền lệch hoặc mã hết
hạn. Cấu hình secret qua `HOTEL_PAYMENT_WEBHOOK_SECRET`. Mã thanh toán không phải
bằng chứng đã trả tiền nếu chưa có callback hợp lệ. Worker sẽ tự chuyển booking
`DRAFT/PENDING` hết hạn thành `CANCELLED/EXPIRED` để giải phóng phòng.

## Phạm vi tài khoản

`employees` và `customer_accounts` là hai aggregate account riêng, cùng dùng
số điện thoại duy nhất làm định danh đăng nhập. Customer account phải gắn đúng
một guest. Anonymous chỉ dùng public read API; customer muốn đặt phòng phải
đăng ký/đăng nhập đầy đủ, chỉ được tạo và xem booking/payment instruction của
chính mình. Customer không được xem dữ liệu khách khác, invoice nội bộ hoặc
giao diện quản trị. Luồng ownership đã được tách riêng; callback thanh toán đã có
contract test HMAC/idempotency; trước production vẫn cần job hết hạn giữ phòng,
refresh token tự động và tích hợp provider/QR cụ thể.

## Cập nhật quyền đặt phòng ngày 10/09/2026

Theo mục 11–12 của `rule.md`, FRONT_DESK và MANAGER được tạo và thay đổi đặt
phòng, nhận/trả phòng, gia hạn, hủy, thêm dịch vụ và chuyển phòng. ADMIN và
DIRECTOR vẫn có quyền đọc nhưng không được tự động thừa hưởng các command này.
ACCOUNTING không được tạo đặt phòng hoặc checkout, kể cả là người tạo đơn.
Service kiểm tra principal và role trước khi xử lý idempotency; không nhận actor
chưa xác thực. `employee_id` lúc tạo phải khớp principal; các thao tác tiếp theo
không thay nhân viên tạo ban đầu và ghi audit bằng actor đang thao tác.

FRONT_DESK xem danh sách/chi tiết đặt phòng và chứng từ hóa đơn, thanh toán,
biên lai của ca khác để tiếp tục vận hành. Quyền này không cấp quyền đọc báo cáo
tài chính. Mọi refund, gồm hoàn cọc khi hủy miễn phí, chỉ được thực thi sau khi
DIRECTOR duyệt đúng payload và số tiền; approval được tiêu thụ một lần.
