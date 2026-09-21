# API contract hiện hành

Tài liệu này mô tả contract đang được thực thi bởi các controller/service hiện
có. Base URL là `/api`; các path bên dưới đã bao gồm `/api`. Không dùng tài liệu
này để suy diễn endpoint chưa có controller.

## Quy ước vận chuyển

- Request/response JSON dùng `lower_snake_case` do `@JsonNaming` hoặc cấu hình
  mapper hiện hành. Ví dụ: `employee_id`, `expected_check_in`,
  `payment_method`, `idempotency_key`.
- `Authorization: Bearer <access_token>` là bắt buộc với route bảo vệ. Route
  public không cần header này. Frontend `ApiClient` tự gắn header từ session.
- `Content-Type: application/json` được dùng khi có JSON body. Upload ảnh dùng
  `multipart/form-data` với part `file`.
- `Idempotency-Key` là HTTP header, không phải query parameter. Header bắt buộc
  ở đúng các controller ghi `@RequestHeader("Idempotency-Key")`; header gửi thêm
  vào route không khai báo không tạo ra cam kết idempotency mới.
- Một số DTO cũng có field body `idempotency_key`: customer booking,
  reservation create và approval request. Payment transaction không nhận khóa
  trong JSON; `POST /api/invoices/{invoiceId}/payments` bắt buộc header
  `Idempotency-Key`.
- Query parameter phải dùng đúng tên đang bind trong controller. JSON naming
  không tự đổi tên query parameter. Vì vậy các query camelCase được liệt kê rõ
  ở mục endpoint; hiện chưa có alias snake_case cho chúng. Đây là blocker contract
  chưa thống nhất, không được tự sửa bằng frontend.
- Ngoại lệ response hiện hành: page wrapper tạo trực tiếp trong
  `ApprovalController` không có `@JsonNaming`, nên khi có filter mở rộng,
  metadata là `totalElements`, `totalPages` (còn `items`, `page`, `size` giữ
  nguyên). Đây là drift cần sửa ở source trước khi tuyên bố toàn bộ response
  snake_case.
- Thời gian là ISO date-time cho `LocalDateTime`, ISO date cho `LocalDate`; múi
  giờ nghiệp vụ mặc định là `Asia/Ho_Chi_Minh`. Tiền là JSON number theo VND.
- Actor được lấy từ JWT/security context. Client không được gửi actor để thay thế
  principal; các field actor trong request chỉ được service kiểm tra hoặc không
  dùng để nâng quyền.

## Response lỗi và status

Lỗi API có schema chung:

```json
{
  "timestamp": "2026-09-18T10:00:00Z",
  "status": 422,
  "code": "BUSINESS_ERROR_CODE",
  "message": "Thông điệp lỗi",
  "details": []
}
```

Mapping hiện hành:

| HTTP | Khi nào | Code tiêu biểu |
|---|---|---|
| 200 | Query và mutation thành công nếu controller không chỉ định status khác | — |
| 201 | Tạo employee, customer account, reservation, service, room type/revision hoặc media khi controller chỉ định `201 Created` | — |
| 204 | Logout, reset password, revoke session, delete image | — |
| 400 | Bean validation, body JSON hỏng, enum/query/path binding sai | `VALIDATION_ERROR`, `INVALID_REQUEST` |
| 401 | Thiếu/sai Bearer token hoặc login/refresh thất bại | `AUTHENTICATION_REQUIRED`, `INVALID_CREDENTIALS`, `ACCOUNT_DISABLED`, `ACCOUNT_LOCKED` |
| 403 | Principal hợp lệ nhưng thiếu capability, sai phạm vi hoặc self-approval | `ACCESS_DENIED` hoặc lỗi miền tương ứng |
| 409 | Vi phạm unique/constraint ở database | `DATA_CONFLICT` |
| 422 | `DomainException`: state machine, approval, idempotency, overlap, readiness, business validation | code miền cụ thể |
| 429 | Anonymous `/api/public/**` vượt fixed window | `RATE_LIMIT_EXCEEDED`, kèm `Retry-After: 60` |

Mọi lỗi có `timestamp`, `status`, `code`, `message`, `details`; frontend phải
giữ `code` và `details`, không gom 400/401/403/409/422/429 thành một thông báo.

## Quyền hiện hành

Controller kiểm tra capability `Permission` từ role trong JWT. Các role canonical
là `ADMIN`, `DIRECTOR`, `MANAGER`, `FRONT_DESK`, `HOUSEKEEPING`, `TECHNICAL`,
`KITCHEN`, `ACCOUNTING`, `HR`, `STAFF`.

- `ADMIN`, `DIRECTOR`, `MANAGER` được khởi tạo với toàn bộ `Permission`; riêng
  `ADMIN` và `DIRECTOR` bị loại `RESERVATION_CREATE`, `RESERVATION_WRITE`,
  `RESERVATION_CHECKOUT`, `RESERVATION_SERVICE_WRITE`.
- `FRONT_DESK`: đọc/ghi guest, room, reservation, dashboard, billing read,
  payment, service read, inventory read/write, incident, maintenance read,
  approval request, notification read, shift read.
- `ACCOUNTING`: employee read, reservation read, billing read/write, payment,
  service read/write, inventory read/write, finance read/write, approval request,
  audit read.
- `HOUSEKEEPING`: room read/write, equipment read, reservation read, housekeeping
  read/write, incident write/handoff, service/inventory read, inventory write,
  maintenance read/write, notification read.
- `TECHNICAL`: room/catalog/admin, equipment, reservation read, maintenance,
  technical work order read/write/release, incident handoff, notification read.
- `KITCHEN`: service read/write, inventory read/write, service-price request.
- `HR`: employee read, shift read/write. `STAFF`: room read, reservation read.

Các capability kiểm tra thêm vai trò/phạm vi: approver phải khác requester;
refund approval chỉ `DIRECTOR`; activation room/service cần role được phép;
assignee/manager giới hạn mutation task/work order.

## Endpoint catalog

### Auth và employee

| Method và path | Query/body/header | Quyền và kết quả |
|---|---|---|
| `POST /api/auth/login` | Body `employee_id`, `password` | Public; 200 `token_response` |
| `POST /api/auth/customers/login` | Body `phone`, `password` | Public; 200 token response |
| `POST /api/auth/refresh` | Body `refresh_token` | Public; 200 token response |
| `POST /api/auth/logout` | Body tùy chọn `refresh_token` | Authenticated; 204 |
| `GET /api/auth/me` | Không body | Employee role; profile lấy từ JWT, trả `employee_id`, `full_name`, `role`, `permissions` |
| `POST /api/auth/customers/register` | Body `phone`, `password`, `full_name`, `identity_number` | Public; 201 |
| `GET /api/auth/customers/me` | Không body | `CUSTOMER`; chỉ customer hiện tại |
| `POST /api/auth/customers/password` | Body `password` | `CUSTOMER`; 204 |
| `POST /api/auth/employees` | Body `employee_id`, `full_name`, `password`, `role`, `phone`, `address` | `EMPLOYEE_PROVISION` và role ceiling; 201 |
| `POST /api/auth/employees/{employeeId}/password` | Body `password` | `EMPLOYEE_PASSWORD_RESET` và target scope; 204 |
| `GET /api/auth/employees` | Query `includeInactive` (default `false`) | `EMPLOYEE_READ`; list không password |
| `GET /api/auth/employees/{employeeId}` | Không body | `EMPLOYEE_READ` |
| `GET /api/auth/employees/{employeeId}/sessions` | Không body | `EMPLOYEE_READ`; không trả raw token |
| `GET /api/auth/employees/{employeeId}/login-history` | Query `page` default 0, `size` default 20 | `EMPLOYEE_READ`; page response |
| `DELETE /api/auth/employees/{employeeId}/sessions/{sessionId}` | Không body | `EMPLOYEE_PROVISION` và target scope; 204 |
| `PATCH /api/auth/employees/{employeeId}/status` | Body `enabled` | `EMPLOYEE_PROVISION`; trả employee response |
| `PATCH /api/auth/employees/{employeeId}/role` | Body `role` | `EMPLOYEE_PROVISION` và role ceiling |
| `PATCH /api/auth/employees/{employeeId}/employment` | Body `status`, `leave_start`, `leave_end` | `EMPLOYEE_PROVISION`; employment hợp lệ |

`employee_id` trong login là mã nhân viên. `GET /api/auth/me` không nhận role hay
permissions từ client.

### Public/customer

| Method và path | Query/body/header | Quyền và kết quả |
|---|---|---|
| `GET /api/public/rooms` | Query `type`, `page` default 0, `size` default 20 | Public; DTO gồm mã loại phòng, giá ngày/giờ, diện tích, hướng, loại giường, sức chứa, mô tả riêng của phòng, metadata loại phòng, tagline, ảnh riêng của phòng và tiện nghi; cache 30s, headers `X-Total-Count`, `X-Page`, `X-Page-Size` |
| `GET /api/public/rooms/{roomId}` | Path `roomId` | Public; chi tiết có mô tả riêng theo `rooms.description`, gallery riêng theo `room_images` và metadata loại phòng/tiện nghi; cache 30s |
| `GET /api/public/rooms/availability` | Query bắt buộc `from`, `to`; tùy chọn `type`, `page`, `size` | Public; availability cùng metadata catalog và ảnh riêng theo phòng, `Cache-Control: no-store` |
| `GET /api/public/services` | Query `page` default 0, `size` default 20 | Public; DTO gồm `category`, `description`, `image_url`; cache 30s |
| `POST /api/public/payment-callbacks/deposit` | Body `provider_event_id`, `payment_code`, `amount`, `reference`, `status`; header `X-Payment-Signature` | Public provider route; HMAC hợp lệ mới được nhận |
| `POST /api/customer/reservations` | Body `rental_type`, `rooms[]`, `idempotency_key`; room item `room_id`, `expected_check_in`, `expected_check_out` | `CUSTOMER`; 201, tối đa 3 phòng, guest lấy từ JWT |
| `GET /api/customer/reservations` | Không body | `CUSTOMER`; chỉ booking của customer |
| `GET /api/customer/reservations/{id}` | Path `id` | `CUSTOMER`; ownership enforced |
| `GET /api/customer/reservations/{id}/deposit-payment` | Path `id` | `CUSTOMER`; payment instruction của chính booking |

Customer booking dùng `idempotency_key` trong body. Cùng customer, cùng key và
cùng fingerprint được trả lại booking đã tạo; khác owner/fingerprint trả 422
`IDEMPOTENCY_KEY_CONFLICT`. Callback deposit có body snake_case và signature
riêng; mã hướng dẫn chưa phải bằng chứng thanh toán nếu callback chưa được chấp
nhận.

### Guest, room và catalog

| Method và path | Query/body/header | Capability |
|---|---|---|
| `GET /api/guests` | Query `q` | `GUEST_READ` |
| `GET /api/guests/{id}` | Path `id` | `GUEST_READ` |
| `POST /api/guests` | Body `full_name`, `birth_year`, `identity_number`, `phone`, `email`, `address` | `GUEST_WRITE`; 201 |
| `GET /api/guests/{guestId}/membership-history` | Path `guestId` | `GUEST_READ` |
| `GET /api/rooms` | Query `type`, `status` | `ROOM_READ` |
| `GET /api/rooms/availability` | Query bắt buộc `from`, `to`; tùy chọn `type` | `ROOM_READ` |
| `PATCH /api/rooms/{id}/status` | Query bắt buộc `status` | `ROOM_WRITE`; không có body/header idempotency |
| `GET /api/rooms/admin` | Không body | `ROOM_ADMIN_READ` |
| `POST /api/rooms/admin` | Body `id`, `name`, `room_type_id`, `floor`, `description`, `status` | `ROOM_ADMIN_WRITE` |
| `PUT /api/rooms/admin/{id}` | Body `id`, `name`, `room_type_id`, `floor`, `description`, `status` | `ROOM_ADMIN_WRITE` |
| `GET /api/rooms/{roomId}/equipment` | Path `roomId` | `EQUIPMENT_READ` |
| `POST /api/rooms/{roomId}/equipment` | Body `room_id`, `name`, `original_value`, `purchased_on`, `quantity`; header bắt buộc `Idempotency-Key` | `EQUIPMENT_WRITE` |
| `PUT /api/rooms/{roomId}/equipment/{equipmentId}` | Body `name`, `original_value`, `purchased_on`, `quantity`, `active` | `EQUIPMENT_WRITE`; không có header idempotency |
| `GET /api/rooms/{roomId}/media` | Path `roomId` | `ROOM_READ` |
| `POST /api/rooms/{roomId}/images` | Multipart part `file` | `ROOM_CATALOG_WRITE`; 201 |
| `DELETE /api/rooms/{roomId}/images/{imageId}` | Path params | `ROOM_CATALOG_WRITE`; 204 |
| `POST /api/amenities` | Body `name` | `ROOM_CATALOG_WRITE`; 201 |
| `GET /api/amenities` | Không body | `ROOM_CATALOG_WRITE` |
| `PUT /api/amenities/{id}` | Body `name`, `active` | `ROOM_CATALOG_WRITE` |
| `PUT /api/room-types/{roomTypeId}/amenities` | Body `amenity_ids` | `ROOM_CATALOG_WRITE` |
| `POST /api/room-types` | Body `id`, `name`, `daily_price`, `description`, tùy chọn `area`, `view`, `hourly_price`, `bed_type`; header bắt buộc `Idempotency-Key` | `ROOM_CATALOG_WRITE`; 201 |
| `PUT /api/room-types/{id}` | Cùng body; header bắt buộc `Idempotency-Key` | `ROOM_CATALOG_WRITE`; chỉ draft/rejected |
| `POST /api/room-types/{id}/revision` | Cùng body; header bắt buộc `Idempotency-Key` | `ROOM_CATALOG_WRITE`; 201 |
| `GET /api/room-types/{id}` | Path `id` | `ROOM_READ` |
| `GET /api/room-types/{id}/price-history` | Path `id` | `ROOM_READ` |
| `POST /api/room-types/{id}/submit` | Không body; header bắt buộc `Idempotency-Key` | `ROOM_CATALOG_WRITE` |
| `POST /api/room-types/{id}/activate` | Không body; header bắt buộc `Idempotency-Key` | `ROOM_CATALOG_WRITE` + role `ADMIN`/`DIRECTOR`/`MANAGER` |

### Reservation, front desk và billing

| Method và path | Query/body/header | Capability |
|---|---|---|
| `GET /api/front-desk/dashboard` | Query `date`, `q`, `status`, `page` default 0, `size` default 20 | `FRONT_DESK_DASHBOARD` |
| `POST /api/reservations` | Body `guest_id`, `employee_id`, `deposit`, `rental_type`, `rooms[]`, optional `idempotency_key`; room `room_id`, `expected_check_in`, `expected_check_out`; header optional | `RESERVATION_CREATE`; 201 |
| `GET /api/reservations` | Query `status`, `guest_id`, `page` default 0, `size` default 20 | `RESERVATION_READ`; page response |
| `GET /api/reservations/{id}` | Path `id` | `RESERVATION_READ`; scope actor trừ global-read role |
| `POST /api/reservations/{id}/confirm` | Không body; header bắt buộc `Idempotency-Key` | `RESERVATION_WRITE`; `DRAFT → CONFIRMED` |
| `PATCH /api/reservations/{id}` | Body `rooms[]`, `deposit`; header bắt buộc `Idempotency-Key` | `RESERVATION_WRITE` |
| `POST /api/reservations/{id}/check-in` | Body tùy chọn `at`; header bắt buộc `Idempotency-Key` | `RESERVATION_WRITE` |
| `POST /api/reservations/{id}/check-out` | Body `at`, `payment_method`; header bắt buộc `Idempotency-Key` | `RESERVATION_CHECKOUT`; trả invoice |
| `POST /api/reservations/{id}/cancel` | Body `reason`; header bắt buộc `Idempotency-Key` | `RESERVATION_WRITE` |
| `POST /api/reservations/{id}/no-show` | Không body; header bắt buộc `Idempotency-Key` | `RESERVATION_WRITE` |
| `POST /api/reservations/{id}/extend` | Body `new_expected_check_out`; header bắt buộc `Idempotency-Key` | `RESERVATION_WRITE` |
| `POST /api/reservations/{id}/services` | Body `service_id`, `quantity`, `used_at`; header bắt buộc `Idempotency-Key` | `RESERVATION_SERVICE_WRITE` |
| `GET /api/reservations/{id}/timeline` | Path `id` | `RESERVATION_READ`; actor scope |
| `POST /api/reservations/{id}/equipment-incidents` | Body `room_id`, `equipment_name`, `equipment_id`, `quantity`, `severity`; header bắt buộc `Idempotency-Key` | `INCIDENT_WRITE` |
| `POST /api/operations/reservations/{reservationId}/room-transfers` | Body `from_room_id`, `to_room_id`, `transferred_at`, `reason`; header bắt buộc `Idempotency-Key` | `RESERVATION_WRITE` |
| `GET /api/invoices` | Query `status`, `reservation_id`, `from`, `to`, `page` default 0, `size` default 20 | `BILLING_READ` |
| `GET /api/invoices/reservation/{reservationId}` | Path `reservationId` | `BILLING_READ` |
| `GET /api/invoices/{invoiceId}/payments` | Query tùy chọn `page`, `size`; không query trả array, có query trả page | `BILLING_READ` |
| `POST /api/invoices/{invoiceId}/payments` | Body `amount`, `method`, `type`, `reference`; header bắt buộc `Idempotency-Key` (1–35 ký tự) | `PAYMENT_WRITE`; cùng actor + key + payload replay giao dịch, khác payload bị `IDEMPOTENCY_MISMATCH` |
| `GET /api/invoices/{invoiceId}/receipts` | Query tùy chọn `page`, `size`; không query trả array, có query trả page | `BILLING_READ` |
| `POST /api/invoices/{invoiceId}/receipts` | Body `receipt_number`, `amount`, `method`; header bắt buộc `Idempotency-Key` | `PAYMENT_WRITE` |
| `POST /api/invoices/reservation/{reservationId}/deposit/refund` | Không body | `PAYMENT_WRITE`; luồng approval refund phải do Director xử lý |
| `POST /api/invoices/{invoiceId}/adjust` | Body `delta`, `reason`; header bắt buộc `Idempotency-Key` | `BILLING_WRITE`; exact approval payload cần khớp |

Payment transaction không nhận `idempotency_key` trong JSON. `Idempotency-Key` là
HTTP header bắt buộc; backend lưu actor JWT và fingerprint canonical gồm
`invoice_id`, `amount`, `method`, `type`, `reference` (reference null được chuẩn
hóa thành chuỗi rỗng) trong persistence. Cùng invoice, actor, key và payload
được replay giao dịch đã ghi; khác invoice, actor hoặc payload bị từ chối với
`IDEMPOTENCY_MISMATCH` (422). Retry phải giữ nguyên header và body. Thiếu/rỗng
hoặc quá 35 ký tự trả `IDEMPOTENCY_KEY_REQUIRED` (422); ký tự ngoài
`[A-Za-z0-9._:-]` trả `IDEMPOTENCY_KEY_INVALID` (422). Response payment ghi
`actor_id`; client không được gửi actor để thay principal.

Refund qua `POST /api/invoices/{invoiceId}/payments` với `type=REFUND` phải có
`reference` làm lý do và approval action `PAYMENT_REFUND` còn hiệu lực, gắn đúng
invoice, key, method, type, reference và amount. Người duyệt phải là `DIRECTOR`
và khác requester;
approval được kiểm tra rồi consume nguyên tử sau khi chọn được payment gốc và
kiểm tra refund không vượt số đã thu. Thiếu, sai, hết hạn hoặc đã consume approval
là 422; thiếu `reference` trả `REFUND_REASON_REQUIRED`, refund vượt số đã thu
trả `REFUND_EXCEEDS_PAID`, hoặc không tìm thấy payment gốc trả
`REFUND_SOURCE_NOT_FOUND` (đều 422).

### Housekeeping và technical

| Method và path | Query/body/header | Capability |
|---|---|---|
| `GET /api/operations/housekeeping/tasks` | Query hiện bind là `roomId`, `assignee`, `status` | `HOUSEKEEPING_TASK_READ` |
| `POST /api/operations/housekeeping/tasks` | Body `room_id`, `assignee`, `note`; header bắt buộc `Idempotency-Key` | `HOUSEKEEPING_TASK_ASSIGN`; 200 |
| `PATCH /api/operations/housekeeping/tasks/{id}` | Body chỉ `status`, `note`, `assignee`; header bắt buộc `Idempotency-Key` | `HOUSEKEEPING_TASK_WRITE`; chỉ assignee hoặc management có scope |
| `GET /api/operations/housekeeping/checklist-templates` | Không body | `HOUSEKEEPING_TASK_READ` |
| `POST /api/operations/housekeeping/checklist-templates` | Body `name` | `HOUSEKEEPING_TASK_WRITE` |
| `GET /api/operations/housekeeping/tasks/{id}/checklist-results` | Path `id` | `HOUSEKEEPING_TASK_READ` |
| `POST /api/operations/housekeeping/tasks/{id}/checklist-results` | Body `item`, `passed`, `note` | `HOUSEKEEPING_TASK_WRITE` |
| `GET /api/operations/housekeeping/tasks/{id}/inspections` | Path `id` | `HOUSEKEEPING_TASK_READ` |
| `POST /api/operations/housekeeping/tasks/{id}/inspections` | Body `inspection_type`, `item`, `quantity`, `item_condition`, `note` | `HOUSEKEEPING_TASK_WRITE` |
| `GET /api/operations/technical/work-orders` | Query hiện bind là `roomId`, `status` | `TECHNICAL_WORK_ORDER_READ` |
| `POST /api/operations/technical/work-orders` | Body `room_id`, optional `equipment_id`, `assignee`, `priority`, `sla_due_at`, `materials`; header bắt buộc `Idempotency-Key` | `TECHNICAL_WORK_ORDER_WRITE`; assignee mặc định actor, ngoài management chỉ được tự nhận việc; 200 |
| `PATCH /api/operations/technical/work-orders/{id}` | Body chỉ `status`, `result_note`, `assignee`, `materials`; header bắt buộc `Idempotency-Key` | `TECHNICAL_WORK_ORDER_WRITE`; assignee hoặc management có scope |
| `POST /api/operations/technical/work-orders/{id}/accept` | Body `acceptance_note`; header bắt buộc `Idempotency-Key` | `TECHNICAL_WORK_ORDER_ACCEPT`; manager/director/admin, khác creator/assignee |
| `POST /api/operations/technical/work-orders/{id}/release` | Không body; header bắt buộc `Idempotency-Key` | `TECHNICAL_WORK_ORDER_RELEASE`; chỉ sau acceptance và readiness |
| `GET /api/operations/maintenance/room/{roomId}` | Path `roomId` | `MAINTENANCE_READ` |
| `POST /api/operations/maintenance` | Body `id`, `room_id`, `type`, `scheduled_date`, `description` | `MAINTENANCE_WRITE` |
| `PATCH /api/operations/maintenance/{id}/status` | Body `status` | `MAINTENANCE_WRITE` |
| `POST /api/operations/reservations/{reservationId}/equipment-incidents` | Body `room_id`, `equipment_name`, optional `equipment_id`, `quantity`, optional `severity`; header bắt buộc `Idempotency-Key` | `INCIDENT_WRITE` |
| `PATCH /api/operations/reservations/incidents/{id}/handoff` | Body `status`, `note`; header bắt buộc `Idempotency-Key` | `INCIDENT_HANDOFF` |

#### Mutation readiness bắt buộc

Housekeeping task dùng status `NEEDS_CLEANING`, `IN_PROGRESS`, `CLEANED`,
`WAITING_TECHNICAL`, `READY` với các transition:

```text
NEEDS_CLEANING → IN_PROGRESS → CLEANED → READY
NEEDS_CLEANING → WAITING_TECHNICAL
IN_PROGRESS → WAITING_TECHNICAL
CLEANED → WAITING_TECHNICAL
WAITING_TECHNICAL → IN_PROGRESS hoặc CLEANED
```

`READY` chỉ thành công khi mọi active checklist đã pass, không có incident HIGH/
CRITICAL chưa `RESOLVED`, và phòng không bị maintenance lock. Nếu sai transition,
assignee scope, checklist hoặc incident, backend trả 422 (`INVALID_HOUSEKEEPING_*`,
`HOUSEKEEPING_TASK_SCOPE_FORBIDDEN`, `HOUSEKEEPING_CHECKLIST_REQUIRED`,
`ROOM_MAINTENANCE_LOCKED`). Chỉ manager/director/admin được phân công; chỉ
assignee hoặc management được update. DTO update không nhận
`checklist_complete` hoặc `blocking_incident`; hai giá trị này là response/domain
state, không phải client override.

Technical work order dùng `NEW → ACKNOWLEDGED → IN_PROGRESS →
WAITING_ACCEPTANCE → COMPLETED → ROOM_RELEASED`. `COMPLETED` và `ROOM_RELEASED`
không được gửi qua generic PATCH: dùng command `accept` và `release`. Tạo work
order đặt phòng thành `maintenance`; accept yêu cầu `acceptance_note`, người
nghiệm thu không được là creator/assignee; release yêu cầu acceptance, không còn
work order chưa hoàn tất, phòng không occupied/overlap, housekeeping checklist
ready và không incident blocking. Thành công mới đặt room status `available`.
`acceptance_note` chỉ thuộc body của `POST .../{id}/accept`, không thuộc body
generic PATCH. Create/update/accept/release đều yêu cầu `Idempotency-Key` và
được bind actor/request fingerprint.

### Service, inventory, finance và governance

| Method và path | Query/body/header | Capability |
|---|---|---|
| `GET /api/services` | Không body | `SERVICE_READ` |
| `POST /api/services` | Body `id`, `name`, `price`, `unit`, `opening_stock`, `safety_threshold`, tùy chọn `category`, `description`, `image_url` | `SERVICE_WRITE`; 201 |
| `POST /api/services/{id}/stock` | Body `quantity`; header bắt buộc `Idempotency-Key` | `INVENTORY_WRITE`; RECEIVE movement |
| `GET /api/services/low-stock` | Không body | `INVENTORY_READ` |
| `GET /api/services/{serviceId}/inventory-movements` | Path `serviceId` | `INVENTORY_READ` |
| `POST /api/services/{serviceId}/inventory-movements` | Body `service_id`, `type`, `quantity`, `reason`; header bắt buộc `Idempotency-Key` | `INVENTORY_WRITE`; `service_id` phải khớp path |
| `GET /api/services/{serviceId}/inventory-movements/inventory-report` | Query `from`, `to` | `INVENTORY_READ` |
| `POST /api/services/{id}/price/submit` | Body `price`, `reason`; header bắt buộc `Idempotency-Key` | `SERVICE_PRICE_REQUEST`; tạo approval |
| `POST /api/services/{id}/price/activate` | Body `price`, `reason`; header bắt buộc `Idempotency-Key` | `SERVICE_PRICE_ACTIVATE`; consume approval exact payload và durable replay |
| `GET /api/services/{id}/price-history` | Path `id` | `SERVICE_READ` |
| `POST /api/governance/approvals` | Body `action`, `target_id`, `payload`, `amount`, `reason`, `idempotency_key` | `APPROVAL_REQUEST`; 201 |
| `GET /api/governance/approvals` | Query `status`, `action`, `target_id`, `requester`, `from`, `to`, `risk`, `page`, `size` | `APPROVAL_APPROVE`; không filter mở rộng trả array, có filter trả page với metadata `totalElements`, `totalPages` |
| `POST /api/governance/approvals/{id}/approve` | Không body; header tùy chọn `Idempotency-Key` | `APPROVAL_APPROVE`, khác requester |
| `POST /api/governance/approvals/{id}/reject` | Không body; header tùy chọn `Idempotency-Key` | `APPROVAL_APPROVE`, khác requester |
| `GET /api/governance/audit` | Query `action`, `entity_type`, `entity_id`, `correlation_key`, `from`, `to`, `page`, `size` | `AUDIT_READ` |
| `GET /api/governance/notifications/outbox` | Query `role` | `NOTIFICATION_READ`; role bị giới hạn theo JWT |
| `POST /api/governance/notifications/outbox/{id}/delivered` | Không body | `NOTIFICATION_WRITE` |
| `POST /api/finance/cash-handovers` | Body `shift_code`, `from_actor`, `to_actor`, `actual_amount`, `note`; header bắt buộc `Idempotency-Key` | `CASH_HANDOVER_WRITE`; `from_actor` phải trùng actor JWT; backend tính `expected_amount` và `variance` (FRONT_DESK chỉ có capability bàn giao, không có quyền đọc/sửa sổ tài chính) |
| `POST /api/finance/expenses` | Body `category`, `description`, `amount` (>0); header bắt buộc `Idempotency-Key` | `FINANCE_WRITE`; `paid_by` lấy từ actor JWT |
| `POST /api/finance/partner-debts` | Body `partner_name`, `reference_code`, `amount` (>0); header bắt buộc `Idempotency-Key` | `FINANCE_WRITE`; `reference_code` phải duy nhất |
| `GET /api/finance/cash-handovers` | Query hiện bind `shiftCode`, `actor`, `from`, `to`, `page`, `size` | `FINANCE_READ` |
| `GET /api/finance/expenses` | Query hiện bind `category`, `status`, `from`, `to`, `page`, `size` | `FINANCE_READ` |
| `GET /api/finance/partner-debts` | Query hiện bind `partner`, `status`, `from`, `to`, `page`, `size` | `FINANCE_READ` |
| `POST /api/finance/partner-debts/{id}/settle` | Body `amount` (>0), `note`; header bắt buộc `Idempotency-Key` | `FINANCE_WRITE`; actor lấy từ JWT; chỉ công nợ chưa `SETTLED`/`VOIDED`, không được tất toán vượt số dư; chuyển `PARTIALLY_SETTLED` hoặc `SETTLED` |
| `GET /api/finance/partner-debts/{id}/settlements` | Path `id` | `FINANCE_READ` |
| `GET /api/finance/ledger` | Query `entry_type`, `from`, `to`, `page` default 0, `size` default 20 | `FINANCE_READ` |
| `GET /api/finance/reconciliation` | Query `from`, `to` | `FINANCE_READ` |
| `GET /api/finance/payments` | Query `invoice_id`, `method`, `type`, `status`, `from`, `to`, `page`, `size` | `FINANCE_READ` |
| `GET /api/finance/receipts` | Query `invoice_id`, `method`, `issued_by`, `from`, `to`, `page`, `size` | `FINANCE_READ` |
| `GET /api/hr/shifts` | Query hiện bind `date`, `to`, `employeeId` | `SHIFT_READ` |
| `GET /api/hr/shifts/coverage` | Query `date`, `shiftCode`, `minimum_staff` | `SHIFT_READ` |
| `POST /api/hr/shifts` | Body `employee_id`, `shift_date`, `shift_code`, `starts_at`, `ends_at` | `SHIFT_WRITE`; actor được ghi nhận bởi service, không có idempotency header |
| `PATCH /api/hr/shifts/{id}/status` | Body `status` | `SHIFT_WRITE` |
| `PUT /api/hr/shifts/{id}` | Body `shift_date`, `shift_code`, `starts_at`, `ends_at` | `SHIFT_WRITE` |

Các mutation finance (`cash-handovers`, `expenses`, `partner-debts` và
`partner-debts/{id}/settle`) dùng `Idempotency-Key` để durable-replay theo scope,
actor JWT và fingerprint canonical của path/body. Cùng actor, key và payload sẽ
replay response; khác actor hoặc payload bị từ chối bởi contract idempotency
hiện hành (422). Không có JSON `idempotency_key` cho các route này. Handover
không cho gửi `from_actor` thay actor đang xác thực; settlement không cho số tiền
vượt phần công nợ còn lại. Approval semantics cho các finance mutation này
không được controller/service công bố, nên client không được tự suy diễn thêm.

HR/Admin mutation binding: actor luôn lấy từ security context. `status`, `role`,
`employment`, session revoke và password reset áp dụng target-scope/role ceiling;
không được tự khóa, tự đổi role, tự terminate hoặc tự revoke session của chính
mình. `ON_LEAVE` bắt buộc có khoảng `leave_start`/`leave_end` hợp lệ; trạng thái
khác không nhận khoảng nghỉ. Shift assignment/status/update không có
`Idempotency-Key` trong controller và không được quảng bá là retry-safe.

#### Service-price activation và retry

`POST /api/services/{id}/price/submit` tạo approval action
`SERVICE_PRICE_CHANGE`; payload được lưu là giá canonical, còn `reason` là metadata.
Approver phải là actor khác requester. `POST .../price/activate` chỉ consume một
approval `APPROVED` có cùng service, giá exact và amount; sau đó ghi price history
append-only. `reason` trong activate không thể thay đổi payload đã duyệt.

Activation bắt buộc nhận `Idempotency-Key` và chạy qua durable idempotency với
scope `service-price-activate`. Binding gồm actor và request hash của service,
giá canonical và reason; cùng actor + cùng request/key sẽ replay response đã lưu,
không consume approval lần hai. Khác actor hoặc payload với key đã dùng trả 422
`IDEMPOTENCY_KEY_CONFLICT`; request cùng key đang chạy trả 422
`IDEMPOTENCY_REQUEST_IN_PROGRESS`. Approval vẫn phải là exact payload, còn
request retry phải giữ nguyên key và body.

## State machine và 422 business behavior

Reservation status là `DRAFT`, `DEPOSIT_PAID`, `CONFIRMED`, `CHECKED_IN`,
`CHECKED_OUT`, `CANCELLED`, `NO_SHOW`:

```text
DRAFT → CONFIRMED hoặc DEPOSIT_PAID hoặc CANCELLED
DEPOSIT_PAID/CONFIRMED → CHECKED_IN hoặc CANCELLED hoặc NO_SHOW
CHECKED_IN → CHECKED_OUT
```

Service còn kiểm tra overlap, thời gian nhận/trả, tiền cọc, booking bị chặn,
no-show chỉ sau giờ trả dự kiến, và command không được lặp. Sai transition hoặc
điều kiện nghiệp vụ là 422, không phải frontend-only validation.

Durable idempotency lưu scope, key, actor, request hash và response trong cùng
transaction. Replay chỉ hợp lệ khi cùng actor và request hash; khác payload/actor
trả 422 `IDEMPOTENCY_KEY_CONFLICT`, command đang chạy trả 422
`IDEMPOTENCY_REQUEST_IN_PROGRESS`. Approval mismatch/expired/self-approval cũng
là 422 (`APPROVAL_REQUIRED`, `APPROVAL_EXPIRED`, `SELF_APPROVAL_FORBIDDEN`).

## Room status canonical

Room operational status dùng chung JSON và database, đúng sáu giá trị
lower_snake_case:

`available`, `occupied`, `cleaning`, `maintenance`, `out_of_service`, `reserved`.

`returned` và `cancelled` chỉ là lifecycle value của `reservation_rooms`, không
phải current operational status của bảng `rooms`. Enum Java dùng `READY` cho
`available`, nhưng `@JsonValue` và converter persistence đều phát ra/đọc giá trị
canonical lower_snake_case. Giá trị uppercase, có khoảng trắng hoặc mã khác bị
từ chối (`INVALID_ROOM_STATUS`/fail-fast converter). Frontend không được dùng
`ready`, `vacant`, `ood` hay nhãn dịch làm giá trị API.

## Proof gate MySQL/Flyway/JPA

Contract production-like chỉ được gọi là đã chứng minh khi gate sau chạy trên
MySQL thật, không bỏ qua acceptance test:

1. Khởi động MySQL 8.4 bằng `docker-compose.yml` hoặc CI service, với
   `MIGRATION_TEST_DB_URL`, `MIGRATION_TEST_DB_USERNAME`,
   `MIGRATION_TEST_DB_PASSWORD` trỏ tới schema sạch.
2. Chạy Flyway thật với migration `V1` đến `V19`; `spring.flyway.enabled=true`.
3. Chạy ứng dụng/test với `spring.jpa.hibernate.ddl-auto=validate` (không
   `create`, `create-drop` hay `update`). `application.yml` production đã đặt
   `ddl-auto: validate` và Flyway locations là `classpath:db/migration`.
4. `MySqlMigrationTest` phải xác nhận database product là MySQL, Flyway
   validation thành công, không còn migration pending và Hibernate mappings
   validate; các MySQL acceptance test phải thực sự được enable bằng biến môi
   trường.

Đây là điều kiện chứng minh, không phải kết quả đã đạt của lượt cập nhật tài
liệu này. Không được ghi “tests/build pass” nếu chưa có log của đúng gate.

## Blockers còn mở

- Query naming chưa đồng nhất: một số controller thực sự bind camelCase như
  `roomId`, `employeeId`, `includeInactive`, `shiftCode`, trong khi nguyên tắc
  JSON là snake_case. Chưa có alias; frontend phải theo tên hiện tại và item chỉ
  được đóng sau khi code/contract được thống nhất.
- Approval queue có page wrapper metadata camelCase (`totalElements`,
  `totalPages`) do controller wrapper chưa áp dụng snake naming.
- Backend payment và price activation đều dùng header idempotency với durable
  actor/request binding; frontend phải giữ nguyên key và canonical payload khi
  retry, không gửi JSON field thay thế.
- Maintenance create/status, room equipment update, employee/shift mutations và
  deposit refund vẫn không có idempotency header ở controller; không suy diễn
  thêm retry hoặc approval semantics cho chúng. Ngược lại, các finance mutation
  hiện có (`cash-handovers`, `expenses`, `partner-debts`, `settle`) đều bắt buộc
  `Idempotency-Key` và bind actor/payload theo mô tả ở trên.
- MySQL/Flyway/`ddl-auto=validate` proof gate chưa được chứng minh trong tài liệu
  này; trạng thái chỉ được đổi khi có log thực tế.
