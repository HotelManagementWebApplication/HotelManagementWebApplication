# Ma trận truy cập cơ sở dữ liệu production

Tài liệu này là inventory của code đang chạy, không phải danh sách thành tích.
Production chỉ đọc view/function và ghi qua stored procedure; JPA repository
chỉ còn trong test source làm fixture, entity chỉ dùng kiểm tra mapping. Quyền truy cập vẫn do service/controller
kiểm tra; view và procedure không thay thế authorization ở backend.

## Truy cập SQL viết tay

| HTTP/job/use case | Java caller | Kiểu truy cập | Bảng đọc | Bảng ghi | Transaction/lock và hành vi phải giữ | Object đích | Test bảo vệ | Trạng thái |
|---|---|---|---|---|---|---|---|---|
| Kiểm tra phòng trống khi đặt/chuyển/release phòng | `RoomDatabase` | bound JDBC function | `PhieuDatPhong`, `ChiTietDatPhong` | — | Nửa khoảng thời gian, draft online hết hạn không chặn phòng; chuẩn hóa `datetime2(6)` cho probe dưới 1 microsecond | `fnKiemTraPhongTrong` | `SqlServerMigrationTest`, `SqlServerTechnicalEquipmentAcceptanceTest` | Đã nghiệm thu |
| Đặt/xem/hủy/xác nhận sử dụng dịch vụ khách sạn | `HotelServiceBookingDatabase` | view/function/procedure | reservation/service read models | booking, service stock, movement, audit | Khóa booking + idempotency key; hạn mức miễn phí, command tại quầy atomic; replay không trừ kho hai lần | `vwDatDichVuKhachSan`, `fnTongDichVuKhachSanDaDung`, `uspDatDichVuKhachSan`, `uspXacNhanSuDungDichVu`, `uspHuyDatDichVu`, `uspHuyDichVuTheoDatPhong` | `SqlServerHotelServiceBookingTest` | Đã nghiệm thu |
| Nạp dịch vụ vào customer reservation response | `HotelServiceBookingDatabase.reservationServices` | view | `vwDatDichVuKhachSan` | — | Projection tường minh, thứ tự thời gian/ID; không nuốt lỗi schema | `vwDatDichVuKhachSan` | `CustomerReservationApiContractTest`, `VnpayPaymentApiContractTest` trên SQL Server | Đã nghiệm thu |
| OTA reconciliation, VAT invoice/XML | `EnterpriseDatabase` | views/procedures | OTA/VAT views | booking/VAT | Khóa invoice, một VAT/invoice, XML escape và trạng thái; ID thật | `vwDoiSoatOta`, `vwHoaDonGiaTriGiaTang`, `uspCapNhatDoiSoatOta`, `uspPhatHanhHoaDonVat`, `uspLuuXmlHoaDonVat` | `SqlServerEnterpriseCommandsTest` | Đã nghiệm thu |
| Chấm công/import thiết bị | `EnterpriseDatabase` | view/procedure | `vwChamCong` | `ChamCong` | JSON batch atomic; khóa nhân viên/ngày theo thứ tự; duplicate giữ thứ tự input | `vwChamCong`, `uspNhapChamCong` | `SqlServerAttendanceImportConcurrencyTest`, `SqlServerEnterpriseCommandsTest` | Đã nghiệm thu |
| Nghỉ phép | `EnterpriseDatabase` | view/procedures | `vwDonNghiPhep` | `DonNghiPhep` | Pending chỉ quyết định một lần, actor/time đầy đủ | `uspTaoDonNghiPhep`, `uspQuyetDinhNghiPhep` | `SqlServerEnterpriseCommandsTest` | Đã nghiệm thu |
| Kho vận hành/minibar | `EnterpriseDatabase` | view/procedure | `vwTonKhoHienTai` | stock/movement | ADJUST là giá trị tuyệt đối; lock, không âm kho, movement rollback cùng stock | `uspDieuChinhTonKho` | `SqlServerEnterpriseCommandsTest`, `SqlServerMigrationTest` | Đã nghiệm thu |
| Tài sản kỹ thuật | `EnterpriseDatabase` | view/procedures | `vwTaiSanKyThuat` | `TaiSanKyThuat` | Giá trị/status/location converter và not-found contract | `uspTaoTaiSanKyThuat`, `uspCapNhatTaiSanKyThuat` | `SqlServerEnterpriseCommandsTest`, `SqlServerTechnicalEquipmentAcceptanceTest` | Đã nghiệm thu |
| Tiện nghi public/internal theo loại phòng | `PublicCatalogDatabase`, `RoomMediaDatabase` | views | amenity read models | — | Chỉ active; public chỉ loại phòng active; nội bộ giữ draft; thứ tự tên/ID | `vwTienNghiCongKhai`, `vwTienNghiTheoLoaiPhong` | `PublicGuestApiContractTest`, `SqlServerRoomMediaTest` | Đã nghiệm thu |
| Tổng tiền mặt theo nhân viên/ca và đối soát | `PaymentReportingDatabase` | function/view | completed payment reporting | — | Tiền ca `(from,to]`; báo cáo `[from,to)`; payment trừ refund, đúng actor/tender | `fnTienMatRongTheoCa`, `vwGiaoDichDoiSoat` | `SqlServerPaymentReportingTest`, `FinanceHttpReconciliationIntegrationTest` | Đã nghiệm thu |

## Persistence và transaction owner hiện tại

Mỗi dòng dưới đây ghi rõ caller hiện tại và object thực sự được Java gọi.
Không giữ song song JPA write và procedure write cho cùng một use case.

Public room/service catalog đã qua `PublicCatalogDatabase` và các view ở V4,
được bảo vệ bằng `PublicGuestApiContractTest` trên SQL Server thật. Catalog nội bộ
và command dùng các adapter SQL riêng bên dưới.

| Module/use case | Repository/service owner | Bảng đọc/ghi | Hành vi cần giữ | Object đích | Trạng thái |
|---|---|---|---|---|---|
| Đăng ký/đăng nhập customer | `CustomerAccountDatabase`, `CustomerAccountService`, `AuthService`, `OtpController` | account/guest views; registration/password procedures | Cross-principal unique phone/email, BCrypt, OTP precedence, credential privacy, profile ownership | `vwTaiKhoanKhachHang`, `uspKhoaDangKyTaiKhoan`, `uspLenhTaiKhoanKhachHang`; SQL customer command/HTTP/security tests | Đã nghiệm thu |
| Rotate/revoke refresh token | `RefreshTokenDatabase`, `AuthService`, `EmployeeJwtAuthenticationConverter` | token view; principal lock and token commands | Rotate once, replay revokes successors, expiry/logout, account-state recheck; rollback and disable-vs-rotate race | `vwMaLamMoiDangNhap`, `uspKhoaChuTheDangNhap`, `uspKhoaMaLamMoiDangNhap`, `uspLenhMaLamMoiDangNhap`; `SqlServerRefreshConcurrencyTest` 5 real SQL tests | Đã nghiệm thu |
| Login audit nhân viên | `EmployeeDatabase`, `EmployeeService` | login/employee views; login event/counter command and audit | Atomic counter/event/audit, fifth failure lock, success does not silently unlock, stable paging; two-connection increments | `vwSuKienDangNhapNhanVien`, `uspLenhNhanVien`; `EmployeeServiceTest`, SQL HTTP/security/HR tests | Đã nghiệm thu |
| Nhân viên và role ceiling | `EmployeeDatabase`, `EmployeeService` | employee view; SQL context lock and commands | Role ceiling, self guards, employment/status, session revocation; no nullable persistence fallbacks | `vwNhanVien`, `uspKhoaNhanVien`, `uspLenhNhanVien`; `EmployeeServiceTest` 10 SQL tests, HR/admin/security HTTP | Đã nghiệm thu |
| Phân ca | `EmployeeShiftDatabase`, `EmployeeShiftService` | shift/employee read model; shift/audit writes | Assign/update/status atomic, employee-first lock; coverage loại nhân viên không khả dụng | `vwLichLamViecNhanVien`, `fnKiemTraTrungCaLamViec`, `uspPhanCongCa`, `uspSuaCaLamViec`, `uspChuyenTrangThaiCa` | Đã nghiệm thu |
| Hồ sơ khách | `GuestDatabase`, `GuestService`, `CustomerAccountService` | guest view; profile/create commands | PII/ownership, shared registry, stable search, null-vs-blank profile, optimistic version preserves counters | `vwKhachLuuTru`, `uspLenhKhachLuuTru`; `GuestServiceTest` 7 SQL tests and SQL customer/profile HTTP | Đã nghiệm thu |
| Lịch sử hạng thành viên | `GuestDatabase`, `MembershipHistoryService`, `ReservationDatabase` | membership view; checkout guest counters/history | Checkout cập nhật hai bộ đếm độc lập và chuyển hạng trong cùng transaction; replay không tăng hai lần | `vwLichSuHangThanhVien`, `uspLenhDatPhong`; `BillingP0CorrectnessTest`, `SqlServerCheckoutConcurrencyTest` | Đã nghiệm thu |
| Loại phòng/catalog/giá | `RoomTypeDatabase`, `RoomTypeCatalogService` | internal type/history views; catalog command | Draft/revision/approval/activation, room repoint và lịch sử giá cùng transaction; concurrent consume một lần | `vwLoaiPhongNoiBo`, `vwLichSuGiaLoaiPhong`, `uspKhoaDanhMucPhong`, `uspLenhLoaiPhong`; SQL Server catalog/API/concurrency tests | Đã nghiệm thu |
| Phòng/admin | `RoomDatabase`, `RoomAdminService`, `RoomService` | internal room view; SQL context/status/admin commands | Actor/state/role guards, version, half-open microsecond overlap, metadata/status rollback, same-transition concurrency | `vwPhongNoiBo`, `uspKhoaPhongNoiBo`, `uspChuyenTrangThaiPhong`, `uspLenhQuanTriPhong`; 35 SQL Server room/public/migration/mail tests | Đã nghiệm thu |
| Ảnh phòng | `RoomMediaDatabase`, `RoomMediaService`, orphan cleanup | image read model; metadata/audit writes | Room lock, tối đa 10 ảnh; chỉ xóa file sau commit; rollback upload dọn file mới | `vwHinhAnhPhongNoiBo`, `uspThemAnhPhong`, `uspXoaAnhPhong`; `SqlServerRoomMediaTest` | Đã nghiệm thu |
| Thiết bị phòng | `RoomEquipmentDatabase`, `RoomEquipmentService` | equipment view; room/equipment/audit/idempotency writes | Active/quantity/value; room-first lock; replay snapshot qua instance mới; scoped update và rollback | `vwThietBiPhong`, `uspThemThietBiPhong`, `uspSuaThietBiPhong`; `SqlServerRoomEquipmentTest`, `RoomEquipmentControllerTest` | Đã nghiệm thu |
| Tiện nghi CRUD | `RoomMediaDatabase` | amenity/mapping views; amenity/mapping/audit writes | Unique tên; replace mappings atomic; không mất mapping khi input lỗi | `uspTaoTienNghi`, `uspSuaTienNghi`, `uspGanTienNghiLoaiPhong`; `SqlServerRoomMediaTest` | Đã nghiệm thu |
| Reservation staff | `ReservationDatabase`, `ReservationService` | reservation/financial-document views; atomic commands | Create/confirm/check-in/extend/cancel/no-show/checkout; availability, actor, version, audit, durable replay; nhiều phòng khóa theo ID | `vwDatPhongChiTiet`, `vwTaiLieuTaiChinhDatPhong`, `fnKiemTraPhongTrong`, `uspTaoDatPhong`, `uspLenhDatPhong`; `ReservationServiceSqlTest`, SQL cancellation/cross-shift/search/checkout concurrency tests | Đã nghiệm thu |
| Reservation customer | `ReservationDatabase`, `CustomerReservationService` | customer-scoped reservation read model; booking commands | Ownership, deposit hold, reschedule/extend, rollback expiry, durable idempotency | `vwDatPhongChiTiet`, `uspTaoDatPhong`, `uspLenhDatPhong`; `CustomerReservationApiContractTest`, live CUSTOMER E2E | Đã nghiệm thu |
| Hết hạn giữ cọc | `CustomerReservationExpiryDatabase`, `CustomerReservationExpiryService` (`@Scheduled`) | expiry command | Draft expiry, rollback extension, VNPay attempt và audit trong một batch transaction theo ID | `uspHetHanGiuCoc`; `CustomerReservationExpiryServiceTest` 2 SQL Server branches | Đã nghiệm thu |
| Chuyển phòng | `RoomTransferDatabase`, `RoomTransferService` | transfer command and view result projection | Booking trước, hai phòng theo ID; overlap, room states, history/audit và durable replay atomic | `uspChuyenPhong`, `vwChuyenPhong`; `RoomTransferCorrectnessTest` 4 SQL Server tests including two-thread race | Đã nghiệm thu |
| Hóa đơn | `InvoiceDatabase`, `BillingService` | invoice/deposit views; atomic invoice commands | Issue/adjust/void, canonical formula/rounding, net deposit chỉ trừ một lần; consume approval/audit cùng transaction | `vwHoaDonChiTiet`, `vwSoDuTienCoc`, `fnTinhSoDuHoaDon`, `uspKhoaHoaDon`, `uspLenhHoaDon`; `BillingP0CorrectnessTest`, `SqlServerBillingWorkflowTest` | Đã nghiệm thu |
| Thanh toán/refund | `PaymentDatabase`, `PaymentTransactionService`, `BillingService` | payment/invoice views; payment/refund command | Invoice-first lock, SQL balance, ledger/approval/audit/replay atomic | `vwGiaoDichThanhToan`, `uspKhoaHoaDon`, `uspLenhGiaoDichThanhToan`; `SqlServerBillingConcurrencyTest`, billing workflow and live ACCOUNTING/DIRECTOR E2E | Đã nghiệm thu |
| Biên lai | `ReceiptDatabase`, `ReceiptService` | receipt view; issue procedure | Unique receipt number, tender coverage and locked net balance; multi-row DB integrity | `vwBienLai`, `uspPhatHanhBienLai`; `SqlServerBillingWorkflowTest`, `SqlServerFinancialTriggerTest` | Đã nghiệm thu |
| Dòng dịch vụ hóa đơn | `ReservationDatabase`, `ReservationService`, `InvoiceDatabase` | reservation/invoice projections; service usage command | Snapshot price/quantity, stock movement, invoice total and caller audit commit together; replay không trừ kho lần hai | `uspLenhDatPhong`, `vwHoaDonChiTiet`; `ReservationInventoryProducerIntegrationTest`, `BillingP0CorrectnessTest` | Đã nghiệm thu |
| Catalog dịch vụ và giá | `ServiceCatalogDatabase`, `ServiceCatalogService` | internal service/history views; catalog command; canonical inventory command | Metadata/tồn đầu kỳ, low-stock, approval giá và lịch sử giá atomic | `vwDichVuNoiBo`, `vwLichSuGiaDichVu`, `uspKhoaDichVuDanhMuc`, `uspLenhDanhMucDichVu`; SQL Server price/inventory/catalog tests | Đã nghiệm thu |
| Tạo yêu cầu VNPay | `DepositPaymentDatabase`, `VnpayPaymentService` | attempt view; bound SQL commands | Customer ownership, unique merchant reference, exact amount, expiry and retry state | `vwYeuCauThanhToanVnpay`, `uspLenhThanhToanCocOnline`; `VnpayPaymentApiContractTest`, `SqlServerDepositFinalizationTest` | Đã nghiệm thu |
| Webhook cọc | `DepositPaymentDatabase`, `DepositPaymentWebhookService` | atomic deposit command | HMAC ngoài transaction; exact external event binding, one payment/receipt; callback race/replay/rollback | `uspLenhThanhToanCocOnline`; `SqlServerDepositFinalizationTest` dùng hai thread SQL thật | Đã nghiệm thu |
| Email sau thanh toán cọc | `BookingDepositEmailListener` | committed event; network only | AFTER_COMMIT, suspend transaction khi gửi; rollback/replay không gửi email | `SqlServerDepositFinalizationTest`: kiểm tra thời điểm commit và trạng thái transaction khi mail được gọi | Đã nghiệm thu |
| Chi phí | `FinanceDatabase`, `FinanceService` | expense view; command writes | Expense/ledger/audit/idempotency atomic; bound filter/paging | `vwKhoanChi`, `uspLenhTaiChinh`; SQL Server finance command/HTTP tests | Đã nghiệm thu |
| Sổ tài chính | `FinanceDatabase`, `FinancialLedgerService` | finalized ledger view; append command | Mandatory caller transaction; append-only; source/actor/financial signs | `vwButToanTaiChinh`, `uspGhiButToanTaiChinh`; SQL Server finance command/HTTP tests | Đã nghiệm thu |
| Bàn giao tiền ca | `FinanceDatabase`, `FinanceService` | handover/denomination views; cash function/command | Per-cashier SQL transaction lock; no double-counting cash; ordered denomination lines, rollback/replay | `vwBanGiaoTienCa`, `vwChiTietTienBanGiao`, `fnTienMatRongTheoCa`, `uspLenhTaiChinh`; two-connection finance tests | Đã nghiệm thu |
| Công nợ đối tác | `FinanceDatabase`, `FinanceService` | debt/settlement views; command writes | Unique reference; locked balance; settlement/history/ledger/audit atomic | `vwCongNoDoiTac`, `vwThanhToanCongNoDoiTac`, `uspLenhTaiChinh`; two-connection finance tests | Đã nghiệm thu |
| Approval | `ApprovalDatabase`, `ApprovalService`, `ApprovalAuthorization` | approval view; lifecycle/audit commands | SoD, refund Director, exact binding, expiry, one-time consume in caller transaction | `vwYeuCauPheDuyet`, `uspLenhPheDuyet`; SQL lifecycle/queue/concurrency, catalog acceptance and HTTP contract | Đã nghiệm thu |
| Audit | `AuditDatabase`, `AuditService`, `SecurityAuditService` | audit view; append procedure | Business rollback; security independent commit; bound filters/paging; immutable projection | `vwNhatKyKiemSoat`, `uspGhiNhatKyKiemSoat`; `AuditBehaviorIntegrationTest` 5 SQL Server tests | Đã nghiệm thu |
| Idempotency | `IdempotencyDatabase`, `DurableIdempotencyService` | claim/complete procedures | SQL bucket lock, exact actor/hash, restart replay, rollback, no memory fallback | `uspNhanKhoaChongTrung`, `uspHoanThanhChongTrung`; `DurableIdempotencyServiceTest` 7 SQL Server tests | Đã nghiệm thu |
| Notification outbox | `NotificationDatabase`, `NotificationOutboxService` | outbox view; procedure writes | Enqueue/update atomic; unique-key lock, rollback cùng caller, TOP 100 trước role filter | `vwThongBao`, `uspThemThongBao`, `uspDanhDauThongBaoDaGui`; `NotificationBehaviorIntegrationTest` trên SQL Server thật | Đã nghiệm thu |
| Housekeeping task | `HousekeepingTaskDatabase`, `HousekeepingService` | task read model; task/room/audit/idempotency writes | Assignment/state/latest checklist/blocking/readiness, room version và durable snapshot | `vwCongViecBuongPhong`, `uspTaoNhiemVuBuongPhong`, `uspCapNhatNhiemVuBuongPhong`; `SqlServerHousekeepingTaskTest`, SQL Server lifecycle/technical acceptance | Đã nghiệm thu |
| Housekeeping checklist | `HousekeepingEvidenceDatabase`, `HousekeepingChecklistService` | template/result/scope views; template/result/task/audit writes | Active template exact-name; latest result từng item; ownership/state recheck dưới lock; concurrent writes không mất flag | `vwMauChecklistBuongPhong`, `vwKetQuaChecklistBuongPhong`, `uspTaoMauChecklistBuongPhong`, `uspGhiKetQuaChecklistBuongPhong`; `SqlServerHousekeepingEvidenceTest` | Đã nghiệm thu |
| Housekeeping inspection | `HousekeepingEvidenceDatabase`, `HousekeepingInspectionService` | inspection/scope views; inspection/audit writes | Actor scope, closed-task guard, enum converter, order/time và rollback | `vwKiemTraBuongPhong`, `uspGhiKiemTraBuongPhong`; `SqlServerHousekeepingEvidenceTest` | Đã nghiệm thu |
| Technical work order | `TechnicalWorkOrderDatabase`, `TechnicalWorkOrderService` | technical read model; order/room/audit/idempotency writes | Ownership, manager SoD, state, result/acceptance; release guard đúng thứ tự và durable replay | `vwCongViecKyThuat`, `uspLenhCongViecKyThuat`; SQL Server technical/equipment acceptance, durable contract và `SqlServerTechnicalWorkOrderTest` | Đã nghiệm thu |
| Maintenance | `MaintenanceDatabase`, `MaintenanceService` | maintenance read model; order/room/audit writes | State transition/no-op; room version; duplicate create và same-transition concurrency; scoped rollback | `vwPhieuBaoTri`, `uspTaoPhieuBaoTri`, `uspChuyenTrangThaiBaoTri`; `SqlServerMaintenanceTest` | Đã nghiệm thu |
| Equipment incident | `EquipmentIncidentDatabase`, `EquipmentIncidentService` | incident view; incident/audit/outbox/idempotency writes | Registry snapshot, Java exact-name selection under SQL locks, compensation, handoff/role, rollback and durable replay | `vwSuCoThietBi`, `fnTinhBoiThuongThietBi`, `uspKhoaLenhSuCoThietBi`, `uspGhiSuCoThietBi`; `SqlServerEquipmentIncidentTest` 11 tests, HTTP/related SQL tests 47/47 | Đã nghiệm thu |
| Biến động kho dịch vụ | `ServiceInventoryDatabase`, `InventoryMovementService` | movement/stock views; procedure writes stock/movement/audit/idempotency | Service-first lock; ADJUST là delta; retry qua instance mới; không âm kho; rollback không lưu claim | `vwBienDongKhoDichVu`, `vwTonKhoDichVu`, `uspGhiBienDongKhoDichVu`; `SqlServerInventoryConcurrencyTest`, `InventoryHttpWorkflowTest` trên SQL Server | Đã nghiệm thu |
| Dashboard lễ tân | `FrontDeskDashboardDatabase` | dashboard/internal-room/incident read models | DB lọc/sort/count/page; chỉ room assignment active; bucket giữ contract | `vwDashboardLeTan`, `fnDashboardDatPhong`, `vwPhongNoiBo`, `vwSuCoLeTan`; SQL Server dashboard acceptance/query tests | Đã nghiệm thu |

| Toàn vẹn biên lai/tiền thu | SQL Server DML triggers, chỉ ở V6 | `BienLai`, `GiaoDichThanhToan` | Kiểm tra cả batch, invoice lock, không cho biên lai vượt gross completed collection hoặc sửa/xóa funding payment; refund không xóa lịch sử | `trgBienLaiBaoDamTienThu`, `trgThanhToanBaoDamBienLai`; `SqlServerFinancialTriggerTest` | Đã nghiệm thu |
| Toàn vẹn phân ca khi DML trực tiếp | SQL Server DML trigger, chỉ ở V6 | `CaLamViecNhanVien`, khóa `NhanVien` | INSERT/UPDATE/batch/kích hoạt lại không tạo chồng lấn; cho ca nối tiếp/đã hủy và DELETE giải phóng lịch | `trgCaLamViecKhongTrung`; `SqlServerHrShiftConcurrencyTest` | SQL đã kiểm chứng; UI ca đêm còn sai giờ, xem báo cáo web |

## Gate để đổi trạng thái

Chỉ đổi một dòng thành `Đã nghiệm thu` sau khi cùng lúc có object SQL, Java chỉ
gọi object đó cho use case, đường ghi/đọc cũ đã bị xóa, SQL Server integration
test chạy thật không skip, và API/security contract vẫn qua. Việc object V3–V6
đã tồn tại nhưng Java chưa gọi không được tính là cutover.

## Lượt kiểm chứng backend trước — 08/10/2026, hardcut V1–V6

Phần dưới là lịch sử lượt chạy trước, không phải kết luận nghiệm thu web.
Kết quả mới nhất và lỗi UI được ghi ở mục tiếp theo.

- Theo yêu cầu mới nhất, đúng sáu file SQL trong migration và build output:
  V1 schema/constraints/seed, V2 indexes, V3 functions, V4 views, V5 procedure/
  transaction, V6 chỉ hai trigger cần thiết. Không V7+, SQL object phụ, định
  nghĩa trùng, checksum repair hoặc sửa Flyway history.
- SQL Server có 10 functions (9 scalar + 1 inline table), 61 views, 68 procedures
  và 2 triggers enabled. Đã bỏ 13 procedure prototype không còn caller; helper
  nội bộ chỉ dùng trong các transaction SQL vẫn được giữ.
- Production không còn JPA repository, EntityManager hoặc SQL đọc/ghi bảng trực
  tiếp. JPA fixture repositories chỉ thuộc test source, không đóng vào runtime
  JAR; Hibernate runtime chỉ validate schema. JDBC bind parameter vào view/
  function/procedure; authorization và scope actor vẫn thuộc backend.
- Full backend `mvn -q -f backend/pom.xml -Ddebug=false
  -Dlogging.level.root=WARN clean package` thành công: 2.227 tests, 94 reports,
  0 failures, 0 errors, 0 skipped. Biến MIGRATION_TEST_DB_* trỏ database riêng
  `QLKS_HARDCUT_20261008`, dựng từ trống bằng Flyway V1–V6.
  Có report đủ 32 lớp `SqlServer*Test`, 161 tests, không skip.
- `SqlServerMigrationTest` 11 tests kiểm tra Flyway history/file list V1–V6,
  metadata, Hibernate mapping, functions, views, procedures, triggers, overlap,
  pricing, rollback và SQL dictionary.
- Booking/checkout/payment/inventory/approval/shift/refresh concurrency dùng
  connection/thread SQL Server thật. Checkout replay không tăng guest counters
  lần hai; deposit callback đồng thời chỉ tạo một payment/receipt/email.
  Event khác không được nhận thành replay hợp lệ; HMAC sai/số tiền sai/rollback
  không ghi tài chính và không gửi mail.
- `SqlServerFinancialTriggerTest` 2 tests: hai trigger enabled, batch biên lai
  thiếu tiền rollback toàn bộ, sửa/xóa funding payment bị chặn, refund giữ
  biên lai lịch sử. `SqlServerDepositFinalizationTest` kiểm tra mail chỉ chạy
  sau commit, không có transaction đang hoạt động khi gọi network.
  `MailConfigurationTest` qua, hai cấu hình SMTP owner-managed không thay đổi.
- Frontend: `npm test` 140 tests/25 files qua; `npm run build` qua. Warning
  bundle lớn còn tồn tại, không phải failure.
- Live HTTP/role E2E trên baseline cuối `e2e_hardcut_v6_20261008`, cổng 8081:
  8/8 qua, configured=8 skipped=0 blocked=0. Bao phủ anonymous, CUSTOMER,
  FRONT_DESK, HOUSEKEEPING, TECHNICAL, MANAGER, KITCHEN, ACCOUNTING, DIRECTOR,
  HR, ADMIN, STAFF. Refund qua request/Director approval/consume/replay thật.
  Backend E2E đã dừng; hai database E2E tạm của lượt này đã xóa, không đụng DB khác.
- QLKS chính được sao lưu COPY_ONLY/CHECKSUM và RESTORE VERIFYONLY trước khi
  dựng lại demo theo phép chủ repo. Bản sao nằm tại
  `/var/opt/mssql/data/QLKS_before_hardcut_v6_20261008.bak` trong SQL Server container.
  Flyway V1–V6 thành công; reset demo chạy hai lần, còn 10 nhân viên/64 phòng/
  6 reservations. FK/CHECK disabled/untrusted = 0, DBCC CHECKCONSTRAINTS không
  có vi phạm, biên lai thiếu tiền bảo đảm = 0. Cả mười trigger đang enabled.
  Backend JAR cuối đang chạy cổng 8080; public rooms HTTP 200, JSON hợp lệ.
- Hai kế hoạch chuyển đổi đã hoàn thành và được bỏ khỏi danh sách việc còn lại.
  Bằng chứng và inventory hiện hành được giữ trong tài liệu này và automated tests.

Trong SSMS, refresh `QLKS → Tables → dbo.BienLai → Triggers` và
`QLKS → Tables → dbo.GiaoDichThanhToan → Triggers`; DML trigger thuộc bảng,
không nằm ở nhóm Database Triggers cấp database.

## Kiểm chứng bổ sung — 08/10/2026, trigger và web thật

- V1–V6 vẫn là sáu migration duy nhất. V6 hiện có **10 trigger enabled**;
  không tạo SQL object/helper/migration mới ngoài sáu file đã chốt.
  SQL Server vẫn có 10 functions, 61 views và 68 procedures.
- Full `clean package` trên database trống `QLKS_TRIGGER_TEN_20261008`:
  **2.236 tests / 94 reports**, failures=0, errors=0, skipped=0. Đủ 32 lớp
  `SqlServer*Test` / **170 tests**, không skip. `SqlServerHrShiftConcurrencyTest`
  có 3 tests: hai connection tranh phân ca, DML batch rollback, ca nối tiếp/
  ca hủy/UPDATE/kích hoạt lại/DELETE. `SqlServerFinancialTriggerTest` 2 tests
  và `MailConfigurationTest` vẫn pass; SMTP owner-managed không thay đổi.
- Frontend: `npm test` **140 tests / 25 files** và `npm run build` pass.
  Live HTTP E2E trên `e2e_ui_trigger_audit_20261008`, backend 8081:
  **8/8**, configured=8, skipped=0, blocked=0. Đây là HTTP, không phải browser.
- Đã thao tác web `http://localhost:5173/` với 11 vai trò và dữ liệu QLKS demo.
  **Gate nghiệm thu web FAIL ở lượt browser audit**: lễ tân gửi actor `EMP001`; đặt bữa trưa lúc
  18:30 được lưu; ca đêm chỉ lưu đến 23:59:59; STAFF mất toàn bộ danh sách
  phòng do gọi API vượt quyền; form HR gọi endpoint cấp tài khoản bị từ chối.
  Không lấy test xanh để phủ nhận các lỗi đã tái hiện này.
  Sau đó trigger V6 đã chặn bữa sai giờ ở database; form mặc định sai giờ
  và các lỗi UI còn lại chưa được coi là đã nghiệm thu.
- Chi tiết tái hiện, giới hạn từng bằng chứng và phần chưa kiểm chứng nằm trong
  [báo cáo kiểm tra web](kiem-tra-hardcut-web-2026-10-08.md).
  Các dòng “Đã nghiệm thu” ở bảng trên chỉ mô tả persistence/backend được test,
  **không đồng nghĩa mọi nút và luồng UI đã nghiệm thu**.
- QLKS demo đã được backup COPY_ONLY/CHECKSUM + RESTORE VERIFYONLY trước khi
  dựng V1–V6 mới: `/var/opt/mssql/data/QLKS_before_ui_trigger_audit_20261008.bak`.
  Trigger ca nằm tại `QLKS → Tables → dbo.CaLamViecNhanVien → Triggers`.
- Sau audit: backup thêm `QLKS_after_ui_trigger_audit_20261008.bak` có checksum
  và verify; reset demo data-only hai lần thành công, 10 nhân viên/64 phòng/
  6 reservations. DBCC không vi phạm; FK/CHECK disabled/untrusted=0,
  biên lai thiếu funding=0. Lần dựng mới nhất dùng backup
  `QLKS_before_v6_ten_triggers_20261008.bak`, Flyway 1–6 và 10 trigger enabled.

## Chốt bổ sung 10 trigger — 09/10/2026

- Đã bỏ giới hạn “minimal necessary” trong `AGENTS.md`, giữ nguyên đúng sáu
  file V1–V6. Mười trigger đều nằm trong V6, đã áp dụng lên QLKS demo.
- Gate cuối `mvn test package` trên database mới `QLKS_TRIGGER_FINAL_20261009`:
  **2.237 tests / 94 reports**, failures=0, errors=0, skipped=0; 32 lớp
  `SqlServer*Test` / **171 tests**. Bản JAR chạy trên QLKS đã được build từ lượt này.
- Đã bổ sung mapping lỗi trigger dịch vụ thành domain error, không để lỗi giờ
  bữa ăn rơi xuống HTTP 500. HTTP thật trên backend 8080: LUNCH lúc 18:30 và
  DINNER lúc 12:00 cùng trả **422 / SERVICE_OUTSIDE_MEAL_HOURS**. Tổng đơn dịch
  vụ trên QLKS vẫn là 2; không lưu các đơn sai giờ. Test SQL kiểm tra rollback
  đơn/audit và chấp nhận đúng các mốc 11:30, 14:00, 18:00, 22:00.
- QLKS validate sáu migration thành công, V1–V6 đều success; 10 trigger enabled,
  DBCC CHECKCONSTRAINTS không có vi phạm. Backend 8080 health UP; Vite 5173
  vẫn chạy. Database test riêng của lượt chốt đã được xóa, không xóa database khác.
- Backup demo trước/sau dựng 10 trigger đều COPY_ONLY/CHECKSUM và đã VERIFYONLY:
  `/var/opt/mssql/data/QLKS_before_v6_ten_triggers_20261008.bak` và
  `/var/opt/mssql/data/QLKS_after_v6_ten_triggers_20261008.bak` trong container SQL.
- Đây là chốt phần trigger/backend, **không đóng gate UI đang FAIL** trong báo
  cáo browser audit. Các lỗi form/scope/ca đêm vẫn cần sửa và kiểm tra lại trên web.

## Đóng lỗi browser audit — 09/10/2026

- Các lỗi P1/P2 cụ thể trong báo cáo 08/10 đã sửa và có bằng chứng thay thế:
  actor/nguồn booking lễ tân, khung giờ bữa ăn và số lượng, ca NIGHT qua ngày,
  scope/phòng/tầng STAFF, form HR vượt quyền, checklist chưa đủ, lý do lỗi,
  X modal màn hình hẹp, login xã hội giả, profile fallback và nesting bảng HR.
  Không mở rộng quyền STAFF/HR để làm UI xanh.
- Đã thao tác lại web thật với STAFF, FRONTDESK, CUSTOMER, HR, HOUSEKEEPING,
  TECHNICAL và MANAGER; booking, bữa trưa, ca đêm, bàn giao checklist được đối
  chiếu SQL. Chi tiết bằng chứng và giới hạn trong
  [báo cáo hiện hành](kiem-tra-hardcut-web-2026-10-08.md).
- Full backend SQL Server mới `QLKS_UI_FIXES_20261009`: **2.238 tests / 94
  reports**, 0 failures/errors/skipped; 32 lớp SqlServer*Test / 171 tests.
  Frontend **161 tests / 27 files** pass, build pass. JAR đóng gói sau full test
  chạy 8080 health UP; HTTP nguồn booking lạ trả 400, không tạo booking.
- V1–V6 và 10 trigger giữ nguyên; không sửa checksum/history. QLKS backup trước
  và sau browser có checksum, đã VERIFYONLY. Sau reset data-only được phép:
  10 nhân viên/64 phòng/6 reservations/2 đơn dịch vụ; DBCC không vi phạm,
  FK/CHECK disabled/untrusted=0. Database test riêng đã được xóa.
- Trạng thái FAIL ở các mục ngày 08/10 là lịch sử trước sửa. Lượt này đóng các
  lỗi đã nêu, **không chứng nhận mọi nút/đầu vào của toàn ứng dụng**; không chạy
  lại live HTTP E2E 8/8 hay CI remote. SMTP owner-managed không thay đổi.
