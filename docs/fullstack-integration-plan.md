# Kế hoạch tích hợp full-stack theo contract hiện hành

> Khảo sát & Cập nhật: 19/09/2026
>
> Contract backend: [`api-contract.md`](api-contract.md)

> [!IMPORTANT]
> **QUYẾT ĐỊNH THIẾT KẾ BẮT BUỘC (19/09/2026)**:
> Giữ nguyên vẹn 100% giao diện cao cấp MaM Hotel tại `frontend/src/pages/` và toàn bộ 12 trạm màn hình (`CustomerPortal`, `LoginPage`, `FrontDeskPMS`, `HousekeepingStation`, `MaintenanceStation`, `KitchenInventory`, `AccountingStation`, `HRStation`, `AdminStation`, `ManagerDashboard`, `StaffPortal`, `LandingPage`).
> Tuyệt đối không thay thế giao diện bằng các component thô sơ. Nối ruột backend Spring Boot ngầm bên dưới từng trạm theo cơ chế **Progressive Hydration**: dữ liệu vận hành lấy từ backend API và database là nguồn sự thật duy nhất; khi API lỗi phải hiển thị trạng thái tải lỗi/rỗng để người vận hành không nhầm dữ liệu trình diễn với dữ liệu thật.

## 1. Hiện trạng có thể kiểm chứng từ source

Backend hiện có controller cho auth/customer, public portal, front desk,
reservation, guest, room/catalog/media/equipment, housekeeping, technical,
maintenance, billing, inventory, finance, HR, governance và notification.
Frontend hiện có:

- `frontend/src/shared/api/client.ts`: `VITE_API_BASE_URL`, JSON body, Bearer
  transport, `Idempotency-Key`, timeout, refresh mutex và `ApiError`.
- API modules `auth`, `customer`, `public`, `frontDesk`,
  `housekeepingTechnical`, `kitchenAccounting` với path backend thật.
- React Router routes public/customer/staff; các feature route hiện hành là
  `/staff/front-desk`, `/staff/housekeeping-technical`,
  `/staff/kitchen-accounting` và `/staff/reports`.
- React Query cho các feature đã nối; mutation thành công invalidate query liên
  quan và UI có loading/error/pending state ở các lát cắt hiện có.

Fresh current-head evidence phải được tách khỏi evidence bị skip hoặc bị block:
worktree hiện có **60 backend production paths đang modified** và untracked
`backend/src/main/resources/db/migration/V19__hard_cut_room_status_contract.sql`;
earlier modified ledger-test evidence includes
`PaymentLedgerServiceTest.java`, `FinanceLedgerHandoverTest.java`, and
`FinanceSettlementLedgerTest.java`;
đây là evidence phạm vi thay đổi, không phải tuyên bố không có backend
production change. After the owner clarification, no backend production or test
file was edited during this continuation. Live/browser proof vẫn chưa được coi là đã chạy nếu scenario
bị skip hoặc runner bị block.

## 2. Frontend transport contract

`ApiClient.request(path, options)` thực thi các quy tắc sau:

1. Gửi `Accept: application/json`; khi có body gửi
   `Content-Type: application/json` và `JSON.stringify(body)`.
2. Nếu token tồn tại, gửi `Authorization: Bearer <access_token>`.
3. Nếu mutation truyền `idempotencyKey`, gửi `Idempotency-Key` đúng giá trị đó.
4. Khi nhận 401, chỉ refresh một lần qua `POST /api/auth/refresh` với body
   `refresh_token`; các request đồng thời dùng chung refresh promise, rồi retry
   request gốc đúng một lần. Refresh thất bại thì clear session.
5. Logout gọi `POST /api/auth/logout` với body tùy chọn
   `{ "refresh_token": "..." }`, sau đó luôn clear token local.
6. Response lỗi được chuyển thành `ApiError(status, code, details)`. UI hiện
   đang phân biệt 401, 403, 409, 422 và 429; retry không được biến thành
   optimistic update cho nghiệp vụ.

Body frontend phải dùng snake_case theo DTO backend. Query phải dùng đúng tên
controller đang bind. Vì source backend hiện còn query camelCase như `roomId`,
`includeInactive`, `shiftCode`, frontend hiện sử dụng đúng các tên đó; chưa được
đổi thành alias đoán trước.

## 3. Route và permission frontend hiện hành

| Route | Guard source hiện tại | API slice |
|---|---|---|
| `/`, `/rooms`, `/rooms/:roomId`, `/availability`, `/services` | Public | `publicApi` |
| `/customer/login`, `/customer/register` | Public | `authApi`/`customerApi` |
| `/customer`, `/customer/book`, `/customer/bookings`, `/customer/bookings/:id`, `/customer/bookings/:id/deposit-payment` | Customer session | `customerApi` |
| `/staff/login` | Public | `authApi.employeeLogin` |
| `/staff` | Employee session | `GET /api/auth/me`; landing page còn thông báo module tổng quát bị khóa |
| `/staff/front-desk` | Roles `FRONT_DESK`, `MANAGER`, `DIRECTOR`, `ADMIN` + `FRONT_DESK_DASHBOARD` | `frontDeskApi` |
| `/staff/housekeeping-technical` | Roles `HOUSEKEEPING`, `TECHNICAL`, `MANAGER`, `DIRECTOR`, `ADMIN` + `ROOM_READ` | `housekeepingTechnicalApi` |
| `/staff/kitchen-accounting` | Roles `KITCHEN`, `ACCOUNTING`, `MANAGER`, `DIRECTOR`, `ADMIN` + `SERVICE_READ` | `kitchenAccountingApi` |
| `/staff/reports` | Roles `MANAGER`, `DIRECTOR`, `ADMIN` + `AUDIT_READ` | State panel blocked; reports feature chưa phát hành |

`AUDIT_READ` là capability canonical của backend/frontend route contract. Route
reports hiện mới có guard và state panel; báo cáo chưa phải feature slice được
chấp nhận.

P0 foundation đã được source hiện hành phản ánh: route permission dùng
`AUDIT_READ`; `RouteParamGuard` fast-fail room IDs không blank và booking IDs phải
là positive safe integers, hiển thị lỗi local trước khi render feature/API query.
Đây chỉ là nền tảng đã nối, không phải bằng chứng các feature slice đã hoàn tất.

## 4. Những lát cắt đã có API caller

### 4.1 Dịch vụ nội bộ và quyền lợi lưu trú

Flyway V39 gỡ các bảng đối tác thương mại/voucher cũ, giữ công nợ nhà cung cấp
và tạo `hotel_service_bookings`. CustomerPortal dùng
`POST /api/customer/service-bookings` để đặt dịch vụ cho booking phòng đã xác
nhận cọc; `GET /api/customer/service-bookings?reservation_id=...` để xem;
`POST /api/customer/service-bookings/{id}/cancel` để hủy. Lễ tân dùng
`GET /api/reservations/{id}/service-bookings` và
`POST /api/reservations/{id}/service-bookings/{bookingId}/use` để xác nhận đã
sử dụng. Chỉ phần vượt quyền lợi đã dùng mới tính vào hóa đơn checkout.

Không có voucher, thuê mặt bằng thương mại, hoa hồng hay khách vãng lai đặt
dịch vụ. Hồ bơi chỉ hiển thị trên web và phục vụ trực tiếp theo booking phòng.

### Auth/customer/public

- Employee login: `POST /api/auth/login` body `employee_id`, `password`;
  profile: `GET /api/auth/me`.
- Customer register/login/profile: lần lượt
  `POST /api/auth/customers/register`, `POST /api/auth/customers/login`,
  `GET /api/auth/customers/me`.
- Public catalog: `GET /api/public/rooms`,
  `GET /api/public/rooms/{room_id}`, `GET /api/public/rooms/availability`,
  `GET /api/public/services`.
- Customer booking: `POST /api/customer/reservations` body
  `rental_type`, `rooms`, `idempotency_key`; các query đọc chỉ thuộc customer.

Customer booking không gửi `guest_id`; backend lấy guest từ customer principal.
Retry cùng `idempotency_key` chỉ được coi là replay khi request fingerprint và
owner giống nhau. Payment instruction không tự biến thành payment success.

### Front desk

`frontDeskApi` hiện đọc dashboard, guest, reservation, invoice, payment, receipt
và timeline; mutation callers hiện có:

| Mutation | Method/path | Header/body |
|---|---|---|
| Create reservation | `POST /api/reservations` | `Idempotency-Key` do client tạo; body reservation snake_case |
| Confirm/check-in/check-out/cancel/no-show/extend | `POST /api/reservations/{id}/...` | Client tạo `Idempotency-Key`; body theo action |
| Update reservation | `PATCH /api/reservations/{id}` | Body `rooms`, `deposit`; header key |
| Add service | `POST /api/reservations/{id}/services` | Body `service_id`, `quantity`, `used_at`; header key |
| Room transfer | `POST /api/operations/reservations/{id}/room-transfers` | Body `from_room_id`, `to_room_id`, `transferred_at`, `reason`; header key |
| Incident | `POST /api/reservations/{id}/equipment-incidents` | Body incident snake_case; header key |
| Record payment | `POST /api/invoices/{invoice_id}/payments` | Body `{amount,method,type,reference}`; header bắt buộc `Idempotency-Key`, giữ nguyên khi retry |
| Issue receipt | `POST /api/invoices/{invoice_id}/receipts` | Body `receipt_number`, `amount`, `method`; header key |

UI chỉ enable các reservation action theo status và permission profile. Backend
vẫn là authority cuối cho state machine, overlap, cọc, invoice và scope.

### Housekeeping/technical

`housekeepingTechnicalApi` hiện gọi các query sau:

- `GET /api/operations/housekeeping/tasks` với query source hiện tại `roomId`,
  `assignee`, `status`.
- `GET /api/operations/housekeeping/checklist-templates`.
- `GET /api/operations/technical/work-orders` với `roomId`, `status`.
- `GET /api/rooms`, `GET /api/rooms/availability`,
  `GET /api/rooms/{room_id}/equipment`,
  `GET /api/operations/maintenance/room/{room_id}`.
- Technical acceptance/release:
  `POST /api/operations/technical/work-orders/{id}/accept` với
  `acceptance_note` và key; `POST .../{id}/release` không body và có key.
- Query binding proof is current for the reported controllers: `QueryParameterContractTest`
  has **8/8 passing tests**, covering `GET /api/operations/housekeeping/tasks`
  (`HOUSEKEEPING_TASK_READ`), `GET /api/operations/technical/work-orders`
  (`TECHNICAL_WORK_ORDER_READ`), `GET /api/invoices` (`BILLING_READ`),
  `GET /api/finance/payments` and `GET /api/finance/ledger` (`FINANCE_READ`),
  `GET /api/reservations` (`RESERVATION_READ`), and public room/catalog
  availability reads. The controllers use explicit current `@RequestParam`
  names; no compatibility aliases are inferred.
- Incident query: `GET /api/operations/incidents?roomId=&reservationId=&handoffStatus=`
  is enabled for `TECHNICAL`, `MANAGER`, `DIRECTOR`, and `ADMIN` with
  `INCIDENT_HANDOFF`. `EquipmentIncidentCorrectnessTest` has **7/7 passing
  tests**, including exact camelCase binding/response shape, invalid typed
  values, and the permission boundary. The frontend caller and owning query
  state provide pending/error/empty/success and retry proof, so this row is
  `verified` in the matrix. Incident writes and handoff mutations remain
  blocked and disabled.

UI hiện khóa các command housekeeping/task và các mutation technical chưa được
nối trong module; không đánh dấu chúng là wired chỉ vì backend route tồn tại.
Khi nối mutation, phải giữ lifecycle:

```text
housekeeping: NEEDS_CLEANING → IN_PROGRESS → CLEANED → READY
                              ↘ WAITING_TECHNICAL ↗
technical:    NEW → ACKNOWLEDGED → IN_PROGRESS → WAITING_ACCEPTANCE
              → COMPLETED → ROOM_RELEASED
```

`READY` cần checklist active pass, không incident HIGH/CRITICAL blocking và
không maintenance lock. `accept` cần manager/director/admin khác creator và
assignee; `release` cần acceptance, không overlap/work order còn mở,
housekeeping readiness và phòng không occupied. Những thất bại này là 422,
không phải lý do để UI tự đổi room state.

### Kitchen/accounting

`kitchenAccountingApi` hiện đã nối:

- Service/stock: `GET /api/services`, `GET /api/services/low-stock`,
  `GET /api/services/{service_id}/inventory-movements`, inventory report,
  `POST /api/services/{service_id}/stock` với body `quantity` và header key.
- Price request: `POST /api/services/{service_id}/price/submit` với body
  `price`, `reason` và header key.
- Approval read/decision: `GET /api/governance/approvals`,
  `POST .../{id}/approve`, `POST .../{id}/reject`.
- Accounting read: invoices, global payments/receipts, expenses, partner debt,
  settlements, ledger, reconciliation; receipt mutation có header key.

UI hiện khóa generic inventory movement, refund, expense/debt creation,
settlement/adjustment khi contract phía frontend chưa đủ. Dịch vụ/minibar,
cash handover và thanh toán/biên lai của lễ tân đã dùng backend thật; không
thay các nút chưa nối bằng local success.

Price activation phải là một flow riêng:

```text
KITCHEN submit + key
→ approver khác requester approve
→ POST /api/services/{id}/price/activate với exact price
→ approval atomic consume + price history
```

Backend price activation hiện là mutation retry-safe:
`POST /api/services/{id}/price/activate` bắt buộc `Idempotency-Key`; scope
`service-price-activate` lưu actor/request hash/response bền vững. Cùng actor,
cùng key và cùng body replay response; actor/body khác trả
`IDEMPOTENCY_KEY_CONFLICT`; request đang chạy trả
`IDEMPOTENCY_REQUEST_IN_PROGRESS`. Approval exact payload vẫn phải được consume
một lần.

Frontend `kitchenAccountingApi` đã có activate caller và UI mở nút theo approval;
live MySQL/browser proof vẫn là gate riêng, không suy diễn từ H2/unit evidence.

## 5. DTO và enum phải giữ một contract

- Role frontend phải dùng backend enum: `FRONT_DESK`, `HOUSEKEEPING`,
  `TECHNICAL`, `KITCHEN`, `ACCOUNTING`, `MANAGER`, `DIRECTOR`, `ADMIN`, `HR`,
  `STAFF`.
- Room operational JSON phải là `available`, `occupied`, `cleaning`,
  `maintenance`, `out_of_service`, `reserved`; `returned`/`cancelled` chỉ thuộc
  reservation-room lifecycle.
- Reservation status dùng `DRAFT`, `DEPOSIT_PAID`, `CONFIRMED`, `CHECKED_IN`,
  `CHECKED_OUT`, `CANCELLED`, `NO_SHOW`.
- `PaymentTransaction` dùng HTTP header `Idempotency-Key`, không nhận field JSON
  thay thế. Receipt, reservation command,
  housekeeping/technical command và inventory movement có yêu cầu header theo
  controller.
- Record payment dùng `POST /api/invoices/{invoice_id}/payments` với body
  `amount`, `method`, `type`, `reference` và header `Idempotency-Key` bắt buộc.
  Backend binds actor plus canonical payload durably: cùng invoice, actor, key
  và body replay giao dịch; khác invoice, actor hoặc body trả
  `IDEMPOTENCY_MISMATCH` (422). Thiếu/rỗng hoặc quá 35 ký tự trả
  `IDEMPOTENCY_KEY_REQUIRED`; ký tự ngoài `[A-Za-z0-9._:-]` trả
  `IDEMPOTENCY_KEY_INVALID`; tất cả là 422. Retry giữ nguyên key và body.
- `type=REFUND` cần `reference` làm lý do và approval `PAYMENT_REFUND` exact
  invoice/key/payload/amount, còn hạn, chưa consume; approver phải là `DIRECTOR`
  và khác requester. Backend
  consume approval nguyên tử sau khi xác định payment gốc và kiểm tra số tiền.
  Refund thiếu/sai approval, thiếu `reference`, vượt số đã thu hoặc không có
  payment gốc là 422 (`APPROVAL_REQUIRED`, `REFUND_REASON_REQUIRED`,
  `REFUND_EXCEEDS_PAID`, `REFUND_SOURCE_NOT_FOUND`).
- Refund remains disabled: requester, executor, approval id, and idempotency-key
  authority are still inconsistent across the deposit-refund and payment-refund
  contracts. Invoice adjustment remains blocked for the same unresolved
  approval-id/idempotency authority and missing focused outcome proof.
- Approval queue filtered có wrapper metadata `totalElements`, `totalPages` từ
  controller backend; đây là ngoại lệ response hiện hành so với snake_case và
  phải được map có chủ ý, không thêm alias im lặng.

## 6. Trình tự hoàn thiện

### P0 — Contract và proof boundary

1. Tạo/duy trì typed route catalog từ controller, DTO, permission và query name;
   không thêm endpoint suy diễn từ UI.
2. Sửa drift query naming hoặc chấp nhận rõ current camelCase ở cả hai phía;
   không tạo alias compatibility.
3. Giữ route permission mapping canonical với `AUDIT_READ` và fast-fail invalid
   route IDs; chỉ coi đây là P0 foundation, chưa coi reports/feature slice đã
   phát hành.
4. Mọi mutation giữ pending, error code, confirm khi cần và refetch/invalidate;
   không optimistic update cho room, reservation, money, stock, approval.
5. Giữ payment theo header/body contract hiện hành; chỉ bật refund/adjustment
   khi approval, idempotency và caller/UI flow tương ứng được chấp nhận.

### P1 — Luồng vận hành

- Public → customer registration/login → booking → payment instruction ownership.
- Front desk → guest/reservation → confirm/check-in → service → checkout/invoice.
- Housekeeping → checklist/readiness → technical work order → manager acceptance
  → technical release → refetch room.
- Kitchen → stock movement → price submit → different approver → exact activation.
- Accounting read model chỉ hiển thị dữ liệu backend; mutation tài chính chỉ bật
  khi idempotency/approval contract được chứng minh.

Mỗi lát cắt phải chứng minh cả role, state, body/query/header, response mapping,
retry và refresh trang. “Button rendered” không phải bằng chứng đã tích hợp.

## 7. Proof gate MySQL/Flyway/ddl-auto=validate

Đây là gate bắt buộc trước khi gọi tích hợp backend/frontend production-like:

- MySQL 8.4 chạy thật, schema sạch, với `MIGRATION_TEST_DB_URL`,
  `MIGRATION_TEST_DB_USERNAME`, `MIGRATION_TEST_DB_PASSWORD`.
- Flyway bật và áp dụng đầy đủ V1–V19; không còn migration pending.
- `spring.jpa.hibernate.ddl-auto=validate`; không dùng `create`, `create-drop` hoặc
  `update` cho proof production-like.
- `MySqlMigrationTest` xác nhận product là MySQL, Flyway validation thành công,
  migration applied/pending đúng và mapping Hibernate validate; các MySQL
  acceptance test không được bị skip vì thiếu env.
- CI workflow hiện khai báo MySQL 8.4 và `mvn -B test` với các biến migration;
  tài liệu này không tuyên bố workflow đã pass.

## 8. Blockers không được che giấu

- Chưa có bằng chứng log cho MySQL/Flyway/`ddl-auto=validate` trong lượt này.
- Query names backend không hoàn toàn snake_case; the reported controllers now
  have explicit current bindings and 8/8 passing `QueryParameterContractTest`
  coverage. Remaining query proof blockers are the HR routes
  `GET /api/auth/employees?includeInactive=` (`EMPLOYEE_READ`),
  `GET /api/hr/shifts?date=&to=&employeeId=` (`SHIFT_READ`), and
  `GET /api/hr/shifts/coverage?date=&shiftCode=&minimum_staff=` (`SHIFT_READ`),
  which still lack direct focused binding proof.
- Approval page metadata is no longer a blocker: the current backend
  `GovernanceApiContractTest` proves the filtered wrapper's exact
  `totalElements`/`totalPages` fields and the frontend governance contract keeps
  the corresponding query/invalidation keys. This is a deliberate current
  contract, not an alias requirement.
- Finance UI hiện có **15 focused tests passed** và frontend build passed;
  this proves the current UI/API contract only. Payment recording đã có
  header-only idempotency với durable actor/canonical-
  payload binding; refund vẫn approval-gated và UI flow chưa được chấp nhận.
- Cash handover, expense, partner-debt, settlement và adjustment vẫn là các
  finance mutation chưa có cùng retry/approval contract; UI giữ khóa và không
  được suy diễn thành retry-safe.
- Reports route đã dùng `AUDIT_READ`, nhưng component hiện vẫn là state panel
  “Báo cáo chưa phát hành”; feature slice chưa được chấp nhận.
- Frontend type room status có `ready` trái với canonical backend `available`.
- Provider payment callback, media storage vận hành, expiry worker và các E2E
  live proof chỉ được coi là đã hoàn tất khi có log/config thực tế; hiện không
  ghi nhận là đã pass.
- Windows live runner is complete only after its system-executable invocation
  is proven. No such invocation proof is recorded here: the exact blocker is
  missing configured disposable MySQL/live fixture environment (required
  `E2E_*` variables and `E2E_MYSQL_DISPOSABLE=true`) and no recorded successful
  `powershell.exe`/`pwsh.exe` execution of
  `scripts/e2e/run-live-contract.ps1`; skipped scenarios remain skipped, not
  fresh proof.
