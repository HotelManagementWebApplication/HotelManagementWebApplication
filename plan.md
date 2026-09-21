# Kế hoạch tiếp tục xây dựng Hotel MIS Web

> Kế hoạch chi tiết hiện hành nằm tại [kế hoạch backend](docs/backend-plan.md) và [kế hoạch frontend](plan_fontend.md). `rule.md` luôn là nguồn quyết định nghiệp vụ ưu tiên.

## 1. Mục tiêu và nguyên tắc bắt buộc

Dự án hiện tại là hệ thống web mới cho Hotel MIS. Backend trong workspace này là nguồn sự thật duy nhất cho nghiệp vụ, API, authentication và database.

Các nguyên tắc áp dụng từ nay:

- Không hỗ trợ backward compatibility với contract cũ.
- Không dual-read, dual-write, facade, alias, adapter runtime hoặc route compatibility.
- Không khôi phục hoặc duy trì desktop app, entity legacy, schema legacy hay direct database writer ngoài backend.
- Mỗi aggregate chỉ có một concrete JPA entity owner.
- Frontend và chatbot chỉ được truy cập nghiệp vụ qua API backend.
- Thay đổi contract phải cập nhật đồng bộ Java domain, DTO/API, Flyway schema, frontend client và test.
- Database production phải dùng MySQL; H2 chỉ được dùng cho test phù hợp, không phải proof duy nhất.

## 2. Trạng thái baseline hiện tại

Baseline hard cut hiện tại: commit `8a0153f` (`Implement canonical backend hard cut`).

Đã hoàn thành:

- Backend canonical package `com.hospitality.mis`.
- Các concrete JPA owner canonical cho identity, guest, room, reservation, billing và operations.
- API/security theo contract mới, RBAC, actor binding, account disable/lockout và failed-login audit.
- Flyway chỉ còn schema sạch `V1__baseline_schema.sql`, tên bảng/cột lower snake_case.
- Hibernate dùng `ddl-auto=validate`.
- Không còn legacy-desktop hoặc production direct DB writer trong workspace.
- Frontend có thể build bằng Vite.
- Backend test không phụ thuộc MySQL đã pass.
- `MySqlMigrationTest` trên database MySQL sạch đã pass; test migration không được skip.

Việc còn thiếu không phải là dọn legacy nữa, mà là hoàn thiện các use case web, contract API, giao diện, dữ liệu nghiệp vụ và proof production.

## 3. Kiến trúc mục tiêu

```text
React/TypeScript frontend
        |
        v
Spring Boot REST API - com.hospitality.mis
        |
        +-- identity/auth/security
        +-- guest
        +-- room
        +-- reservation
        +-- billing
        +-- operations
        +-- governance/audit
        |
        v
MySQL - Flyway V1 - Hibernate validate
```

Chatbot/RAG, nếu triển khai, chỉ là một API client có quyền hạn riêng:

- Đọc tài liệu qua RAG.
- Đọc dữ liệu vận hành qua backend API/tool.
- Không truy cập trực tiếp MySQL.
- Không tự thực hiện thao tác nhạy cảm nếu thiếu approval và actor authorization.

## 4. Các quyết định contract đã chốt và còn mở

Các quyết định nền tảng đã được chốt trong `rule.md` và được chuẩn hóa thành
`docs/api-contract.md` cùng `docs/authorization-matrix.md`:

1. Thời lượng hourly dưới 3 giờ vẫn tính tối thiểu 3 giờ; thời lượng lẻ phút
   làm tròn lên theo giờ.
2. Grace checkout là 12:20; sau đó áp dụng các mốc phụ phí trong `rule.md`.
3. Hủy trước hơn 48 giờ được hoàn cọc; trong 48 giờ mất cọc và cập nhật
   late-cancellation counter.
4. VIP gồm Silver/Gold/Platinum; giảm giá chỉ áp dụng trên tiền phòng.
5. Role/approval matrix được ghi tại `docs/authorization-matrix.md`.
6. State transition reservation/room/payment đã được ghi tại API contract;
   invoice/maintenance sẽ bổ sung khi hoàn thiện các use case tương ứng.
7. Phạm vi hiện tại là một khách sạn, timezone `Asia/Ho_Chi_Minh`, tiền tệ VND.
8. Chỉ làm tròn tổng cuối hóa đơn đến 1.000 VND.
9. Mô hình vận hành gồm bốn vùng: tầng 0–2 cho đối tác thương mại/F&B/retail;
   tầng 3–4 cho spa, sauna và gym; tầng 5–20 là phòng nghỉ; tầng 21 là hồ bơi.
10. Đối tác mặt bằng chịu tiền thuê cố định, phí dịch vụ và hoa hồng doanh thu.
    Hoa hồng tháng bằng giá trị lớn hơn giữa 5% doanh thu voucher ghi nhận và
    mức sàn cam kết; công nợ tháng được xuất từ màn hình kế toán.
11. F&B/retail mở cho khách vãng lai; khu phòng nghỉ chỉ dành cho khách có
    keycard; spa/gym dùng miễn phí cho khách lưu trú và hỗ trợ day-pass cho
    khách vãng lai; hồ bơi tầng 21 chỉ dành cho khách thuê phòng ngày đêm.
12. Voucher dịch vụ/bàn được phát hành qua backend, gắn với khách và mặt bằng;
    khách VIP nhận nhãn Voucher VIP, khách thường nhận mã voucher thông thường.

`NO_SHOW` đã được chốt: khách được check-in đến trước giờ trả; hết giờ trả mà
chưa check-in thì chuyển `NO_SHOW` và mất cọc. Lượt VIP lấy theo thời lượng đặt
trong booking: dưới 24 giờ không tính, từ đủ 24 giờ tính đúng một lượt cho mỗi
booking hoàn tất; booking nhiều phòng vẫn chỉ tính một lượt. Hủy đúng 48 giờ
trước giờ nhận phòng mất cọc và không thu thêm phí hủy ngoài tiền cọc.

Sau khi chốt, mọi API/DTO/enum/schema/test phải dùng đúng contract này. Không tạo tên thay thế để hỗ trợ quyết định cũ.

## 5. Roadmap triển khai

### Phase 0 — Đóng băng contract và baseline

Deliverables:

- Hoàn thiện `docs/api-contract.md` và `docs/authorization-matrix.md`.
- Liệt kê endpoint, HTTP verb, request/response DTO, enum và lỗi chuẩn.
- Liệt kê bảng, cột, khóa ngoại, unique constraint, index và representation của enum.
- Xác định actor cho từng command/query và dữ liệu PII được phép xem.
- Ghi rõ các invariant nghiệp vụ trước khi viết thêm service.

Proof:

- Contract review hoàn tất.
- Không có endpoint/DTO/enum mới không có trong contract.
- API contract test dùng contract hiện hành, không kiểm tra literal legacy.

### Phase 1 — Hoàn thiện nền tảng backend

Phạm vi:

- Chuẩn hóa error response, validation, pagination, sorting và correlation/audit metadata.
- Hoàn thiện authentication, password policy, refresh/session policy nếu cần.
- Hoàn thiện RBAC, actor binding, PII authorization và approval enforcement.
- Bổ sung optimistic/pessimistic locking đúng nơi cần thiết.
- Tách rõ command/query service và transaction boundary.
- Bổ sung health/readiness endpoint không làm lộ secret hoặc PII.

Proof:

- Unit/service tests tại owning boundary.
- Security tests cho anonymous, role sai, actor sai, account disabled/locked và failed-login audit.
- Không có controller/service nào bypass authorization hoặc transaction policy.

### Phase 2 — Guest, Room và Reservation

Phạm vi:

- Guest CRUD/search với PII authorization và audit.
- Room type, room, room status và availability.
- Reservation create, update, confirm, check-in, check-out, cancel và các transition hợp lệ.
- Multi-room reservation với locking/concurrency protection.
- Idempotency key được xử lý atomic tại database/transaction boundary.
- Không cho phép double booking, transition ngược hoặc thay đổi vượt quyền.

Proof bắt buộc:

- API tests cho happy path và negative path.
- Concurrency test cho cùng phòng và nhiều phòng.
- Idempotency test với retry đồng thời.
- Reservation state-machine test.
- MySQL integration test cho constraint và locking thực tế.

### Phase 3 — Billing, Payment và Operations

Phạm vi:

- Invoice, line item, deposit, payment, refund và adjustment.
- Approval bắt buộc cho refund, adjustment, override giá và thao tác nhạy cảm theo matrix.
- Không cho sửa dữ liệu tài chính đã finalized nếu không qua workflow hợp lệ.
- Maintenance, room block, room release và room transfer.
- Kiểm tra conflict giữa maintenance, reservation, check-in và transfer.
- Audit đầy đủ cho financial và operational commands.

Proof bắt buộc:

- Billing invariant tests: tổng tiền, deposit, refund, adjustment, rounding.
- Approval negative tests: thiếu approval, sai role, sai actor, approval hết hạn.
- Operations concurrency tests.
- Regression tests ở API boundary, không test alias/tên đã retired.

### Phase 4 — Frontend web production flow (Bảo tồn 100% Giao diện MAM Hotel)

> [!IMPORTANT]
> **Quy định bất di bất dịch về Frontend**: Giữ nguyên vẹn 100% giao diện cao cấp MAM Hotel và toàn bộ 12 trạm màn hình tại `frontend/src/pages/` (`CustomerPortal`, `LoginPage`, `FrontDeskPMS`, `HousekeepingStation`, `MaintenanceStation`, `KitchenInventory`, `AccountingStation`, `HRStation`, `AdminStation`, `ManagerDashboard`, `StaffPortal`, `LandingPage`). Nghiêm cấm xóa bỏ, ghi đè hoặc thay thế bằng các component thô sơ.

Nguyên tắc tích hợp Backend vào Giao diện hiện hành:
- **Cơ chế Progressive Hydration / Graceful Fallback**: Frontend giữ nguyên layout, style Tailwind/CSS và tương tác phong phú. Logic state ưu tiên nạp dữ liệu từ backend Spring Boot qua `frontend/src/shared/api/*`; nếu backend offline hoặc dữ liệu rỗng, tự động fallback về mock data trong `data.ts`, đảm bảo giao diện luôn hiển thị hoàn hảo khi trình diễn cho khách.
- **Nối ruột Backend dần dần từng trạm**:
  1. Login & Auth: Nối `LoginPage.tsx` với `/api/auth/login` (nhân viên) và `/api/auth/customers/login` (khách), vẫn giữ 10 nút bấm tài khoản demo.
  2. Cổng khách hàng: Nối `CustomerPortal.tsx` với `/api/public/rooms`, `/api/public/services` và tạo booking qua `/api/customer/reservations`.
  3. Lễ tân PMS: Nối `FrontDeskPMS.tsx` với `/api/front-desk/dashboard`, nhận phòng (check-in), trả phòng (check-out), đổi phòng và folio thanh toán.
  4. Buồng phòng & Kỹ thuật: Nối `HousekeepingStation.tsx` và `MaintenanceStation.tsx` với task dọn phòng, checklist và work order sự cố.
  5. Kho bếp & Kế toán: Nối `KitchenInventory.tsx` và `AccountingStation.tsx` với tồn kho minibar, sổ quỹ thu chi và đối soát.
  6. Nhân sự & Điều hành: Nối `HRStation.tsx` và `ManagerDashboard.tsx` với ca trực và phê duyệt approval.

Yêu cầu chất lượng:
- Dùng typed API client trong `frontend/src/shared/api/`.
- Luôn hiển thị trơn tru, không vỡ layout khi mất mạng hoặc thiếu dữ liệu backend.
- Build production từ clean checkout (`npm run build` pass 100%).

### Phase 5 — MySQL, release và CI hardening

Phạm vi:

- Chạy Flyway V1 trên MySQL database rỗng.
- Chạy Hibernate validation sau migration.
- Kiểm tra index, foreign key, unique constraint và collation/case behavior.
- Chuẩn hóa biến môi trường, secret handling và profile local/CI/production.
- Seed/demo data chỉ dùng cho môi trường dev/test, không trộn vào production migration.
- CI phải chạy backend build, test, migration test, frontend build và contract test.
- Không skip `MySqlMigrationTest` khi thiếu cấu hình; phải fail rõ ràng.

Acceptance command tối thiểu:

```powershell
& "C:\Users\minht\tools\apache-maven-3.9.16\bin\mvn.cmd" -B clean test
```

Migration acceptance phải cung cấp `MIGRATION_TEST_DB_URL`, `MIGRATION_TEST_DB_USERNAME` và `MIGRATION_TEST_DB_PASSWORD` trỏ tới MySQL sạch. Database sai contract phải fail-fast.

### Phase 6 — Chatbot/RAG sau khi API ổn định

Chỉ bắt đầu sau khi Phase 2–5 đạt acceptance.

- RAG cho policy, hướng dẫn và tài liệu nghiệp vụ có version.
- Live facts lấy qua backend API/tool với actor context.
- Không cho chatbot đọc DB trực tiếp.
- Không cho chatbot tự bypass RBAC, approval, locking hoặc idempotency.
- Mutation qua chatbot phải tạo command có confirmation/approval phù hợp.
- Có audit cho prompt intent, actor, tool call và kết quả command.

## 6. Definition of Done cho mỗi feature

Một feature chỉ được coi là hoàn thành khi:

- Contract API, DTO, enum và schema đã được cập nhật đồng bộ.
- Có authorization, actor binding, validation và audit phù hợp.
- Có transaction boundary và locking/idempotency analysis nếu có ghi dữ liệu.
- Có unit/integration/API tests ở boundary sở hữu nghiệp vụ.
- Có MySQL proof khi feature phụ thuộc behavior của database.
- Frontend đã xử lý đủ success, validation error, authorization error và retry.
- Không thêm alias, facade, dual-read, dual-write hoặc compatibility field.
- README/docs/config/CI được cập nhật.
- `git diff --check`, backend test, migration test và frontend build pass.

## 7. Thứ tự công việc ngay tiếp theo

Lead tiếp tục theo thứ tự này:

1. Audit từng endpoint/DTO theo `docs/api-contract.md`; bổ sung contract test.
2. Sửa logic reservation và billing đang lệch contract (48 giờ, hourly,
   VIP, late checkout, rounding).
3. Hoàn thiện test security, error contract và state transition.
4. Viết frontend flow typed cho login, guest, room và reservation.
5. Sau khi reservation ổn định mới hoàn thiện billing/operations.
6. Chạy acceptance MySQL sạch trong CI và local.
7. Chỉ sau khi web core ổn định mới bắt đầu chatbot/RAG.

## 8. Rủi ro và cách xử lý

- Database local đang chạy hoặc container acceptance đang tồn tại: không xóa dữ liệu khi chưa có yêu cầu rõ ràng; dùng database/container riêng cho acceptance.
- Thiếu biến `MIGRATION_TEST_DB_*`: cấu hình secret/env ở máy hoặc CI, không sửa test để skip.
- Thay đổi contract giữa frontend và backend: cập nhật contract trước, sau đó sửa cả hai phía trong cùng một change set.
- Nghiệp vụ tài chính và approval dễ sai: ưu tiên invariant, audit và negative test trước UI polish.
- Concurrency chỉ đúng trên H2 nhưng sai trên MySQL: mọi claim về locking phải có MySQL integration proof.

## 9. Ngoài phạm vi của kế hoạch mới

- Khôi phục, sửa hoặc migrate runtime cho desktop cũ.
- Giữ schema/table/entity/API cũ để tương thích.
- Tạo migration V2/V3 để kéo dài lịch sử schema đã retired.
- Tạo blacklist, tombstone registry hoặc source-substring gate để chứng minh đã xóa legacy.
- Cho phép bất kỳ ứng dụng nào ghi trực tiếp vào production MySQL ngoài backend.
