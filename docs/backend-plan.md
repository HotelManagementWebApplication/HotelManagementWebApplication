# Kế hoạch hoàn thiện backend Hotel OS

> Cập nhật 14/09/2026. Đây là kế hoạch backend hợp nhất thay thế các gap plan, rule audit, migration plan và báo cáo review lịch sử trong `docs`. Phạm vi phát hành đầu tiên là **một khách sạn**, timezone `Asia/Ho_Chi_Minh`, tiền tệ VND.

$env:DB_URL = "jdbc:mysql://localhost:3306/QLKS?useUnicode=true&characterEncoding=utf8&serverTimezone=Asia/Ho_Chi_Minh"
$env:DB_USERNAME = "<local-username>"
$env:DB_PASSWORD = "<local-password>"

$env:MIGRATION_TEST_DB_URL = $env:DB_URL
$env:MIGRATION_TEST_DB_USERNAME = $env:DB_USERNAME
$env:MIGRATION_TEST_DB_PASSWORD = $env:DB_PASSWORD

## 1. Quyết định đã khóa

- Xây Hotel OS cho một khách sạn trước; multi-hotel/multi-tenant để ngoài phạm vi.
- Spring Boot modular monolith là backend duy nhất được ghi MySQL.
- Flyway sở hữu schema; Hibernate chỉ `validate`.
- Anonymous public portal chỉ đọc phòng, chi tiết phòng và dịch vụ bằng DTO riêng.
- CUSTOMER phải đăng nhập đầy đủ mới được tạo booking cho chính mình và nhận mã/hướng dẫn thanh toán tiền cọc.
- Public/customer API không trả PII của khách khác, booking của khách khác, invoice nội bộ hoặc dữ liệu vận hành không cần thiết.
- Tất cả dịch vụ `ACTIVE` được public; dịch vụ ngừng phục vụ không public.
- Ảnh phòng lưu local giai đoạn đầu, tối đa 10 ảnh/phòng, 5 MB/ảnh, JPEG/PNG/WebP.
- MANAGER phân công housekeeping; HOUSEKEEPING cập nhật tiến độ; TECHNICAL báo hoàn thành, MANAGER nghiệm thu, TECHNICAL mở khóa phòng.
- Nhân viên dùng một hệ thống chung; quyền được kiểm tra ở controller và service, không dựa vào việc frontend ẩn menu.
- Pet Agent đọc qua API có actor context, không truy cập database trực tiếp và không tự thực hiện mutation.
- Các quy tắc VIP, hủy/cọc và quyền liên ca tiếp tục theo `rule.md`.

## 2. Nền tảng hiện đã có

Các capability sau đã có code và test ở mức nền tảng, cần giữ trong regression suite:

- JWT access/refresh, đăng nhập nhân viên/khách hàng, khóa phiên và account state.
- RBAC theo role/capability và actor binding từ security context.
- Guest create/search/detail và membership history.
- Room search, availability, status và equipment cơ bản.
- Reservation create/search/detail, check-in, check-out, cancel, no-show, extend, dịch vụ và chuyển phòng.
- Invoice, payment ledger, receipt, deposit refund và invoice adjustment.
- Approval requester/approver, consume-once và audit log.
- Maintenance, equipment incident, inventory movement, cash handover, expense và partner debt ở mức cơ bản.
- Flyway V1, JPA mapping và các test MySQL/H2 hiện có.

Không coi một entity/controller hoặc HTTP 200 là bằng chứng module đã hoàn chỉnh cho vận hành thực tế.

## 3. Khoảng trống ưu tiên P0

### P0.1 — Public read model và customer booking an toàn

Đã triển khai các endpoint công khai:

- `GET /api/public/rooms`
- `GET /api/public/rooms/{room_id}`
- `GET /api/public/rooms/availability?from=&to=&type=`
- `GET /api/public/services`

Tạo `PublicRoomResponse`, `PublicRoomDetailResponse` và `PublicServiceResponse` riêng. Không tái sử dụng DTO nội bộ. Public DTO chỉ chứa mã/tên phòng, loại phòng, tầng, giá công khai, ảnh, tiện nghi và trạng thái công khai.

Backend đã có allow-list field và contract test khẳng định response không chứa
guest, phone, identity number, reservation ID, invoice, payment, employee hoặc
internal note. Danh sách hỗ trợ `page`/`size` (tối đa 100) và trả metadata qua
`X-Total-Count`, `X-Page`, `X-Page-Size`; public API có rate limit cho anonymous,
cache ngắn hạn cho catalog/detail và `no-store` cho availability.

Customer booking command/query riêng đã được triển khai ở `/api/customer/**`.
Backend lấy guest từ token, không nhận `guest_id` tùy ý; kiểm tra khoảng thời gian,
trạng thái phòng, booking overlap và điều kiện booking của khách. Khi tạo booking,
booking ở `DRAFT` và phát hành payment instruction/mã cọc `PENDING`. Callback
thanh toán cọc đã có ở `/api/public/payment-callbacks/deposit`: xác minh HMAC,
khóa event provider duy nhất, kiểm tra mã/số tiền/hạn, ghi ledger BANK_TRANSFER và
chuyển `DRAFT → DEPOSIT_PAID`. Việc chọn provider, QR thật và production secret
vẫn cần cấu hình khi tích hợp cổng thanh toán cụ thể. Customer chỉ được xem
booking/payment instruction của chính mình; mã thanh toán không được xem là bằng
chứng đã trả tiền. Worker hết hạn hold chạy theo `HOTEL_DEPOSIT_HOLD_MINUTES`,
chuyển `DRAFT/PENDING` quá hạn thành `CANCELLED/EXPIRED` và ghi audit.

### P0.2 — Ảnh và tiện nghi phòng

Đã triển khai migration V4, model/repository, local storage abstraction và API
catalog nội bộ. Public room detail đọc ảnh active và tiện nghi active qua DTO
allow-list. Upload đã kiểm tra giới hạn 10 ảnh/phòng, 5 MB/ảnh, MIME và magic
signature JPEG/PNG/WebP; server tự sinh filename và chặn path traversal.

Các endpoint đã có:

- `GET /api/rooms/{room_id}/media`
- `POST /api/rooms/{room_id}/images`
- `DELETE /api/rooms/{room_id}/images/{image_id}`
- `POST /api/amenities`
- `PUT /api/room-types/{room_type_id}/amenities`

Đã có scheduled orphan-file cleanup với grace period và cơ chế xóa file sau khi
transaction xóa metadata commit. Pagination catalog lớn và chuyển storage
implementation sang object storage vẫn là hardening ngoài P0.

Migration V4 tạo mới (không sửa migration đã chạy) gồm:

- `room_images`: đường dẫn tương đối, thứ tự hiển thị, ảnh đại diện, MIME type, kích thước và trạng thái.
- `amenities` và `room_type_amenities` hoặc mô hình tương đương.

Ảnh được lưu local trong giai đoạn đầu qua một storage service abstraction. Upload phải giới hạn định dạng/kích thước, tự sinh tên file, chống path traversal, không cho client quyết định đường dẫn vật lý và có quy tắc dọn file mồ côi.

Áp dụng giới hạn đã chốt: tối đa 10 ảnh/phòng, 5 MB/ảnh, chỉ JPEG, PNG và WebP.

### P0.3 — Trạng thái phòng và khả dụng

Chuẩn hóa state machine phòng cho sáu trạng thái vận hành: `READY`, `RESERVED`, `OCCUPIED`, `CLEANING`, `MAINTENANCE`, `OUT_OF_SERVICE`. Loại bỏ việc để controller tùy ý chuyển trạng thái.

Trạng thái public phải được ánh xạ từ read model và không chứa nguyên nhân/sự cố nội bộ. Availability theo khoảng thời gian phải dựa vào booking overlap; trạng thái hiện tại và khả dụng tương lai là hai khái niệm riêng.

State guard và overlap/locking logic đã được giữ ở service layer; H2 contract
tests đã bao phủ các đường đi chính và test MySQL billing hiện có vẫn là bằng
chứng tích hợp. Acceptance còn lại là chạy bộ MySQL integration trên database
thật để xác nhận migration, unique constraint và transaction isolation cho
create booking/check-in/extend/transfer/maintenance/status.

### P0.4 — Durable idempotency và transaction/audit

Đã thay bằng V6 `idempotency_records` và các bucket lock bền vững. Record lưu
`scope + key + actor + request_hash + response/status`; cùng một key/payload sẽ
replay kết quả sau restart, còn actor hoặc payload khác bị từ chối. Bucket được
khóa pessimistic trước khi đọc/tạo record để serialize cùng key giữa nhiều
instance.

Áp dụng cho mọi mutation có thể retry: reservation, check-in/out, cancel, no-show, extend, transfer, incident, room equipment, payment, receipt, adjustment, stock movement và approval action.

Các mutation P0 đã dùng durable idempotency trong cùng transaction; audit của
workflow hiện có tiếp tục chạy trong transaction nghiệp vụ. Transactional
outbox cho notification/asynchronous integration vẫn để P1.

### P0.5 — Clock và hợp đồng thời gian

Đã tiêm business `Clock` dùng `Asia/Ho_Chi_Minh` vào reservation, room,
billing, finance, inventory, incident, payment, transfer và governance. Business
service không còn phụ thuộc trực tiếp vào timezone máy; entity default chỉ là
fallback cho persistence/test.

Chuẩn hóa JSON time field, quy tắc inclusive/exclusive tại mốc check-in, check-out, hủy 48 giờ, no-show và ranh giới ca. Có boundary test tại đúng mốc.

### P0.6 — Object authorization và PII

- Mỗi query/mutation kiểm tra capability và phạm vi object tại service.
- Housekeeping/Technical chỉ nhận dữ liệu khách tối thiểu cần thiết.
- Accounting không được sửa reservation hoặc room state.
- HR không xem dữ liệu tài chính/lương và không tự đổi role.
- FRONT_DESK được xử lý reservation liên ca theo rule đã chốt.
- Request không được tự khai actor; actor lấy từ token.

Thêm negative test cho anonymous, sai role, account khóa, actor mismatch, object ngoài phạm vi và response PII.

Đã chuẩn hóa số điện thoại tại boundary dùng chung trước khi kiểm tra unique,
lưu hoặc đăng nhập; hỗ trợ dạng `0...`, `84...` và `+84...`. Customer login trả
lỗi xác thực tổng quát cho số không tồn tại, sai mật khẩu, disabled hoặc locked,
không làm lộ trạng thái tài khoản.

### Trạng thái thực thi P0 — 14/09/2026

P0 đã hoàn tất implementation, regression H2 và acceptance MySQL: public
DTO/privacy, pagination/rate-limit/cache, customer deposit flow, media orphan
cleanup, business Clock, phone normalization và durable idempotency cho các
mutation retryable. Toàn bộ 991 test đã chạy với database acceptance MySQL thật:
0 failure, 0 error, 0 skipped. Trong đó 11 test MySQL bao phủ Flyway V1→V6,
Hibernate schema validation, unique constraint, billing workflow, payment
idempotency, concurrent booking/locking và security smoke. Acceptance MySQL đã
phát hiện và sửa kiểu `request_hash` trong V6 từ `CHAR(64)` thành `VARCHAR(64)`
để khớp JPA mapping. P0 không còn hạng mục code hoặc acceptance tồn đọng.

## 4. Module vận hành P1

### P1.1 — Room/Room Type administration

- CRUD có kiểm soát cho room type, room, ảnh, tiện nghi và equipment registry.
- Technical tạo/sửa ở `DRAFT`.
- Manager/Director approve hoặc reject; requester không tự duyệt.
- Chỉ bản `ACTIVE` mới xuất hiện trên public portal hoặc dùng để tạo booking.
- Thay đổi giá lưu snapshot/lịch sử và chỉ có hiệu lực sau approval.

#### Trạng thái triển khai — 14/09/2026

Đã triển khai vòng đời catalog cho `room_types`: migration V7, trạng thái
`DRAFT`/`ACTIVE`/`REJECTED`, API tạo/sửa/xem/submit/activate, durable
idempotency và audit. Technical tạo và submit; Manager/Director/Admin duyệt;
requester không thể tự duyệt. Public portal và customer booking chỉ nhận loại
phòng `ACTIVE`. V8 bổ sung bảng price history append-only và API đọc lịch sử;
khi activate sẽ lưu snapshot giá gắn với approval/approver. Reject approval
`ROOM_TYPE_ACTIVATE` cập nhật catalog về `REJECTED`. Room CRUD quản trị và
revision workflow cho loại phòng đã `ACTIVE` cũng đã có:
revision tạo mã draft mới từ snapshot ACTIVE, không làm thay đổi bản đang bán.

### P1.2 — Front Desk daily operations

Tạo query tối ưu cho dashboard trong ngày:

- arrivals, departures và current stays;
- phòng trống/khóa/cần dọn;
- booking thiếu cọc;
- invoice còn số dư;
- incident cần chú ý;
- tìm nhanh guest/reservation.

Hoàn thiện reservation update/confirm, filter/sort/pagination, receipt idempotency và timeline tổng hợp booking–room transfer–service–invoice–audit.

#### Trạng thái P1.2 — 14/09/2026

Đã có `GET /api/front-desk/dashboard` với ngày nghiệp vụ, tìm kiếm guest/phone/
reservation/room, lọc trạng thái và phân trang; response tổng hợp arrivals,
departures, current stays, cọc chưa thu, invoice còn số dư, trạng thái phòng,
incident và room counts. Quyền riêng `FRONT_DESK_DASHBOARD` chỉ cấp cho
Front Desk/Manager/Director/Admin.

Reservation nội bộ đã có thao tác confirm `DRAFT → CONFIRMED`, cập nhật lịch
trước check-in với overlap guard và timeline audit; room admin CRUD được kiểm
soát bằng `ROOM_ADMIN_READ/WRITE` và chỉ nhận loại phòng `ACTIVE`.

### P1.3 — Housekeeping

Thêm mô hình:

- `employee_shifts` hoặc shift assignment dùng chung;
- `housekeeping_tasks`;
- checklist template và checklist result;
- minibar inspection/count;
- room asset inspection;
- incident severity và handoff.

Workflow chuẩn:

```text
NEEDS_CLEANING → IN_PROGRESS → CLEANED → READY
                             └→ WAITING_TECHNICAL
```

Chỉ chuyển `READY` khi checklist bắt buộc hoàn tất, không còn blocking incident và phòng không bị maintenance khóa.

Manager là người phân công task; Housekeeping chỉ nhận task và cập nhật trạng thái.

#### Trạng thái P1.3 — 14/09/2026

Đã có migration V9 và task API housekeeping với các trạng thái
`NEEDS_CLEANING`, `IN_PROGRESS`, `CLEANED`, `READY`, `WAITING_TECHNICAL`.
Task lưu assignee, người giao, checklist, incident blocking và ghi audit; phòng
đồng bộ `CLEANING`/`MAINTENANCE`/`READY`. Chuyển READY bị chặn nếu checklist
chưa hoàn tất hoặc còn incident blocking. V13 bổ sung shift assignment dùng chung
(lọc theo ngày/nhân viên, chống ca kết thúc trước khi bắt đầu) và checklist
template/result có audit, phân quyền theo department cho Housekeeping.
V14 bổ sung inspection minibar/tài sản theo task; equipment incident có severity
và handoff `OPEN → ACKNOWLEDGED → RESOLVED`.

### P1.4 — Technical và equipment

- Equipment registry là nguồn giá trị/ngày mua; incident không tin giá trị do request tự nhập.
- Work order có assignee, priority, SLA, vật tư sử dụng, kết quả sửa và người nghiệm thu.
- Workflow: `NEW → ACKNOWLEDGED → IN_PROGRESS → WAITING_ACCEPTANCE → COMPLETED → ROOM_RELEASED`.
- Mở khóa phòng là command riêng, kiểm tra booking overlap, housekeeping readiness và work order đã nghiệm thu.

Technical chỉ báo hoàn thành; Manager nghiệm thu; sau khi có nghiệm thu hợp lệ,
Technical mới được thực hiện command mở khóa phòng.

#### Trạng thái P1.4 — 14/09/2026

Đã có migration V10 và technical work-order API với lifecycle
`NEW` → `ACKNOWLEDGED` → `IN_PROGRESS` → `WAITING_ACCEPTANCE` → `COMPLETED`
→ `ROOM_RELEASED`. Work order lưu assignee, priority, SLA, vật tư, kết quả,
nghiệm thu và audit; release kiểm tra phòng không OCCUPIED trước khi đưa về
`READY`.

### P1.5 — Kitchen/Minibar và kho

Tách rõ danh mục bán, giá bán và sổ kho:

- movement type: `RECEIVE`, `ISSUE`, `ADJUST`, `WASTE`, `RETURN`;
- tồn không âm và cập nhật dưới row lock;
- lịch sử giá append-only;
- low-stock threshold và mặt hàng active/inactive;
- tồn minibar theo phòng nếu nghiệp vụ yêu cầu;
- báo cáo tiêu thụ ngày/tháng.

Mọi thay đổi giá do Kitchen tạo phải qua Manager approval trước khi active.

#### Trạng thái P1.5 — 14/09/2026

Inventory movement đã hỗ trợ `RECEIVE/ISSUE/ADJUSTMENT/WASTE/RETURN`, khóa
dòng dịch vụ và từ chối tồn âm. Có endpoint low-stock và migration V11 cho
price history append-only; thay đổi giá dịch vụ đi qua approval exact payload
trước khi activate. Báo cáo tiêu thụ theo ngày/tháng có tổng hợp biến động
nhập/xuất/hủy/hoàn/điều chỉnh.

### P1.6 — Accounting và finance

- Pagination/filter cho invoice, payment, receipt, expense và debt.
- Đối soát riêng CASH, CARD và BANK_TRANSFER.
- Settlement/tất toán partner debt và lịch sử thanh toán.
- Refund/adjustment dùng exact payload approval, requester khác approver.
- Báo cáo doanh thu phải phân biệt doanh thu ghi nhận, tiền thực thu, hoàn tiền, công nợ và chênh lệch giao ca.
- Financial ledger đã finalized chỉ thay đổi bằng bút toán append-only.

#### Trạng thái P1.6 — 14/09/2026

Finance đã có tất toán công nợ đối tác dưới row lock và báo cáo đối soát theo
khoảng ngày, tách CASH/CARD/BANK_TRANSFER cùng tổng payment/refund/net; audit
ghi nhận thao tác tất toán. Danh sách cash handover, expense và partner debt có
pagination `page/size` với giới hạn tối đa 100. Invoice, payment và receipt cũng
đã có endpoint phân trang theo invoice, giữ response list tương thích khi không
truyền tham số phân trang.

### P1.7 — HR và Admin

HR:

- Employee list/detail, trạng thái làm việc, nghỉ và inactive.
- Phân ca/lịch trực ngày–tuần, kiểm tra trùng ca và thiếu người.
- Không có field hoặc endpoint lương trong release này.

Admin:

- List/create/disable/enable account, reset password và role assignment theo ceiling.
- Revoke session, xem security event và lịch sử đăng nhập.
- Không ai tự đổi role hoặc tự nâng quyền.

#### Trạng thái P1.7 — 14/09/2026

HR/Admin đã có API list/detail nhân viên (lọc inactive), trả trạng thái khóa,
login history và không lộ password; status enable/disable tuân thủ role ceiling
và ghi audit. Provision/reset password vẫn dùng các policy hiện có.
V13 bổ sung API phân ca ngày/tuần (`/api/hr/shifts`) với quyền HR/Admin/Manager
và kiểm tra khoảng thời gian ca. Admin có thể xem/thu hồi từng refresh session
theo role ceiling; thao tác thu hồi được ghi security audit.

### P1.8 — Approval, audit và thông báo

- Approval queue lọc theo status/action/target/requester/date/risk.
- Audit query có pagination, correlation ID và filter actor/action/target/time.
- Thông báo sự cố dùng transactional outbox; giao diện nhận bằng polling trước, có thể nâng lên SSE/WebSocket sau.
- Sự cố thường báo Front Desk và Technical; severity cao báo thêm Manager.

#### Trạng thái P1.8 — 14/09/2026

Approval queue và audit hỗ trợ filter/pagination theo status/action/target/requester/
date và entity/correlation/time; V12 bổ sung transactional
notification outbox với dedupe key, polling và trạng thái delivered. Incident
thiết bị phát event cho Front Desk và Technical; quyền notification giới hạn
theo department.

#### P1 integrity closeout — 14/09/2026

V15 đóng các lỗ hổng được phát hiện khi audit lại P1: bồi thường thiết bị chỉ
dùng giá/ngày mua từ equipment registry; severity cao gửi thêm Manager;
housekeeping READY được suy ra từ checklist result thực và bị chặn bởi incident
hoặc maintenance lock. Quyền giao task tách khỏi quyền cập nhật của Housekeeping.

Technical báo hoàn thành bằng trạng thái `WAITING_ACCEPTANCE`, Manager dùng
command nghiệm thu riêng có `accepted_by/accepted_at`, và command release kiểm
tra booking overlap cùng housekeeping readiness. Room admin chuyển trạng thái
qua state-machine command thay vì ghi trực tiếp.

Approval queue lưu/lọc `risk` và `requested_at`; HR chặn ca trùng dưới employee
row lock, hỗ trợ lịch tối đa bảy ngày và báo thiếu người theo ca. Finance bổ sung
bộ lọc, lịch sử tất toán công nợ và finalized ledger append-only. Reservation
timeline tổng hợp thêm audit của invoice, payment và receipt.

#### Đánh giá lại P1 — 15/09/2026

P1 **chưa được chấp nhận hoàn tất**. Clean suite hiện có 1.645 test, 0
failure/0 error/0 skipped; các test MySQL migration, billing workflow, billing
concurrency và security smoke đều pass. Tuy nhiên test hiện tại chưa bao phủ
đầy đủ các đường vòng và yêu cầu vận hành sau:

- Technical vẫn có thể gọi API trạng thái phòng chung để chuyển
  `MAINTENANCE → READY`, bỏ qua nghiệm thu Manager và command release của work
  order.
- Housekeeping có thể tự đổi `assignee` khi PATCH task; chưa kiểm tra actor chỉ
  được cập nhật task được giao cho mình.
- Approval đổi giá dịch vụ không khớp workflow: Kitchen tạo approval nhưng
  Manager/Admin/Director activate; consume hiện lại ràng buộc requester phải là
  người activate.
- Dashboard Front Desk tính biến `paged` nhưng không dùng trong response; các
  danh sách vẫn trả toàn bộ dữ liệu và service tải toàn bộ reservation/incident
  vào bộ nhớ.
- Housekeeping task, checklist result và technical work order chưa có row lock
  hoặc optimistic version cho state transition; chưa có MySQL concurrency proof
  riêng cho các workflow này.
- Finance ledger mới ghi expense, partner debt và settlement; chưa ghi đầy đủ
  invoice revenue, payment, refund, receipt và variance giao ca. Invoice chưa
  có filter; payment/receipt chỉ phân trang trong bộ nhớ theo từng invoice.
- HR/Admin chưa có employment/leave status, hủy hoặc sửa ca, role reassignment
  theo ceiling và login history đầy đủ; hiện chủ yếu là enabled flag, list và
  refresh session.
- Room, room type, amenity và equipment registry chưa có đầy đủ CRUD/lifecycle.
  Revision room type tạo mã mới nhưng chưa liên kết/retire bản cũ hoặc cập nhật
  các phòng đang dùng bản cũ.
- Notification polling nhận `role` từ query client nên có nguy cơ đọc chéo
  notification của department khác; outbox service còn dùng system clock trực
  tiếp.
- Inventory contract chưa đồng bộ: code dùng `RECEIPT/ADJUSTMENT` trong khi
  contract yêu cầu `RECEIVE/ADJUST`; adjustment chỉ tăng tồn và low-stock dùng
  điều kiện không nhất quán (`<` so với `<=`).
- `docs/api-contract.md` chưa cập nhật các endpoint acceptance, shift coverage,
  settlement history và finalized ledger; DTO incident vẫn giữ các field giá/
  ngày mua compatibility dù backend đã chuyển nguồn dữ liệu sang registry.

Thứ tự xử lý bắt buộc tiếp theo: khóa đường vòng release và sửa approval giá;
đóng object authorization/locking cho housekeeping–technical; sửa dashboard
pagination/query; hoàn thiện finance ledger/report/filter; hoàn thiện HR/Admin
và catalog lifecycle; sau đó đồng bộ contract, bổ sung negative/concurrency
test MySQL và chỉ đánh dấu P1 hoàn tất khi acceptance pass lại.

#### Re-audit P1 — 16/09/2026

Đã xử lý các gap nêu trên trong phần triển khai tiếp theo:

- Technical chỉ release phòng qua work-order đã được Manager nghiệm thu; approval
  giá và revision đều tách requester/approver.
- Housekeeping, Technical và shift transition dùng row lock; assignee scope,
  role ceiling và trạng thái lao động được kiểm tra tại service.
- Dashboard dùng đúng danh sách phân trang; invoice/payment/receipt có filter
  phân trang toàn cục; reconciliation bổ sung revenue, payment, refund, công nợ
  và variance; finalized ledger chỉ append-only.
- HR có employment/leave status, role reassignment, sửa/hủy ca và login history;
  coverage loại nhân viên disabled/terminated/đang nghỉ.
- Room type revision liên kết bản gốc, retire bản cũ và chuyển phòng khi active;
  amenity/equipment có lifecycle update.
- Notification role bị giới hạn theo JWT; inventory thống nhất RECEIVE/ADJUST,
  hỗ trợ adjustment âm và boundary low-stock nhất quán.
- API contract và authorization matrix đã cập nhật endpoint mới.

Clean acceptance cần chạy với Flyway V1→V18, Hibernate validation và toàn bộ
test H2/MySQL; chỉ đánh dấu P1 hoàn tất khi mọi nhóm MySQL đều pass.

**Kết quả nghiệm thu 16/09/2026:** đã chạy clean suite với database MySQL cấu
hình từ `DB_URL`, gồm 1.775 test — 0 failure, 0 error, 0 skipped; các nhóm
MySQL migration, billing workflow/concurrency và security smoke đều pass. P1
backend được đánh dấu hoàn tất ở commit `c6aade0`.

## 5. Báo cáo điều hành P2

Tạo read model/query service cho:

- doanh thu và tiền thực thu;
- occupancy/công suất phòng;
- arrivals/departures/no-show/cancellation;
- phòng bảo trì và SLA sự cố;
- tồn kho dưới ngưỡng và tiêu thụ minibar;
- công nợ đối tác;
- chênh lệch giao ca;
- approval và security event rủi ro cao.

Các báo cáo phải định nghĩa rõ công thức, timezone, trạng thái được tính và cách xử lý refund/adjustment; không tính trực tiếp ở frontend.

## 6. Pet Agent Copilot P2

Triển khai theo ba nấc:

1. RAG trả lời SOP/policy có nguồn tham chiếu và version tài liệu.
2. Tool read-only gọi backend bằng actor hiện tại để tóm tắt room, reservation, invoice, incident và inventory.
3. Action proposal tạo payload xem trước; chỉ thực hiện sau confirmation, backend authorization và approval nếu cần.

Mỗi tool phải typed, allow-listed, giới hạn dữ liệu theo role và ghi audit/correlation. Agent không có credential database và không được tự gọi mutation dựa trên nội dung hội thoại.

## 7. Production readiness P2

- Bootstrap tài khoản quản trị an toàn; không hard-code mật khẩu.
- Demo/seed data tách khỏi production migration.
- Health/readiness kiểm tra dependency nhưng không lộ secret.
- Correlation ID xuyên HTTP, audit, payment và agent tool call.
- Backup/restore runbook và ít nhất một lần restore rehearsal.
- Structured logging, metric, alert và retention policy.
- CI chạy backend test, MySQL migration/locking test, frontend build/test và contract test.
- Không skip MySQL acceptance khi thiếu cấu hình; fail rõ nguyên nhân.

## 8. Thứ tự delivery

1. Đồng bộ `rule.md`, API contract và authorization matrix cho public portal chỉ đọc.
2. Public DTO/API, ảnh, tiện nghi và privacy tests.
3. Durable idempotency, business Clock, object authorization và concurrency proof.
4. Room/type draft–approval và Front Desk daily operations.
5. Housekeeping + notification handoff.
6. Technical/equipment + room release.
7. Kitchen/inventory, Accounting/finance, HR/Admin.
8. Báo cáo Manager/Director.
9. Pet Agent read-only, sau đó mới action proposal.
10. Production hardening và acceptance toàn hệ thống.

## 9. Các quyết định đã chốt ngày 13/09/2026

1. Khi chưa chọn thời gian, public hiển thị trạng thái vận hành hiện tại. Khi đã chọn thời gian nhận/trả, availability phản ánh đúng khoảng khách tìm; không public lịch hoặc danh tính booking của người khác.
2. Customer phải đăng nhập đầy đủ mới được đặt phòng; sau khi tạo booking được nhận mã/hướng dẫn thanh toán tiền cọc.
3. Tất cả dịch vụ đang active và phục vụ khách được public; dịch vụ ngừng phục vụ không public.
4. Manager phân công housekeeping; Housekeeping nhận và cập nhật tiến độ.
5. Technical báo hoàn thành; Manager nghiệm thu; sau đó Technical mở khóa phòng.
6. Tối đa 10 ảnh/phòng, 5 MB/ảnh, hỗ trợ JPEG, PNG và WebP.
7. Public portal hiển thị số/tên phòng, loại phòng, tầng, giá, ảnh, tiện nghi và trạng thái công khai; không hiển thị người đặt, người đang ở hoặc dữ liệu nội bộ.

Không tự triển khai các nhánh phụ thuộc sáu quyết định này; các phần độc lập vẫn có thể tiếp tục.

## 10. Definition of Done

Một capability chỉ hoàn thành khi:

- Rule, API contract, authorization matrix, DTO, schema và frontend type đồng bộ.
- Có validation, object authorization, transaction, idempotency và audit phù hợp.
- Có unit/service/API test và negative security/privacy test.
- Có MySQL proof nếu phụ thuộc locking, unique constraint hoặc transaction isolation.
- Query danh sách có pagination/filter/sort và không trả PII vượt quyền.
- UI xử lý success/loading/empty/error/retry.
- Tài liệu vận hành và acceptance command được cập nhật.
- Clean build/test/migration pass trên môi trường được hỗ trợ.
