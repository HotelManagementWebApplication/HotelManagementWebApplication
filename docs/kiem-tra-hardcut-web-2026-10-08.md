# Kiểm tra hardcut, test và web thật — 08/10/2026

## Kết luận hiện hành — sửa và kiểm chứng lại ngày 09/10/2026

**Các lỗi P1/P2 được liệt kê trong báo cáo này đã được xử lý.** Đã sửa source,
bổ sung regression và thao tác lại các luồng liên quan trên web thật tại
`http://localhost:5173/`, đối chiếu bản ghi SQL cho booking, bữa ăn, ca đêm và
checklist. Không đồng nhất việc đóng những lỗi này với chứng nhận exhaustive
“mọi nút/mọi đầu vào” của toàn ứng dụng. Các mục tái hiện và gate ngày 08/10
bên dưới là **lịch sử trước sửa**, không còn là danh sách lỗi đang mở.

| Lỗi | Bản sửa và bằng chứng hiện hành |
|---|---|
| Actor booking lễ tân | Lấy actor từ profile, không còn fallback EMP001. Web tạo booking #7 phòng 802; SQL ghi FRONTDESK, nguồn Trực tiếp, cọc 725.000, lịch 09–10/11/2026. Regression kiểm tra payload actor và DIRECT. |
| Nguồn booking và bước tiền cọc phát hiện khi retest | Đổi DIRECT_FRONT_DESK thành DIRECT; input cọc step=1 chấp nhận 725.000. Backend validate nguồn không hợp lệ thành 400/VALIDATION_ERROR thay vì 500; HTTP thật trên JAR cuối bị từ chối, tổng booking vẫn 6 sau reset. |
| Khung giờ nhà hàng và số lượng | Bữa trưa chỉ 11:30–14:00, bữa tối chỉ 18:00–22:00; lọc thêm kỳ lưu trú và thời điểm tương lai. Web từ chối -2, 0, 1.5, 21 và rỗng, không clamp thành 1. Đơn #5 lưu Bữa trưa, 10/10 lúc 12:30, số lượng 1, miễn phí 1; SQL xác nhận. Regression kiểm tra đổi bữa, checkout boundary, ngày ngoài kỳ và lỗi API inline. |
| Ca đêm HR | Cả tạo/sửa NIGHT gửi 22:00 đến 06:00 ngày kế tiếp. Web tạo ca #8; SQL xác nhận 480 phút ngày 09–10/10. Probe giao nhau 05:00–07:00 bị trigger 51004 từ chối và rollback; regression kiểm tra hai payload tạo/sửa. |
| STAFF mất danh sách phòng | Không gọi reservations, housekeeping, directory, finance, approvals hoặc audit ngoài quyền. Public rooms lấy đủ 64; bộ lọc sinh từ tầng thật 5–20, tầng 20 có bốn phòng. Có loading/error/retry; không giả dữ liệu booking bị giới hạn quyền. Browser và regression đều xác nhận. Không mở rộng quyền backend. |
| Form HR cấp tài khoản sai quyền | Bỏ form auto-provision khỏi HR; “Tiếp nhận nhân viên mới” giải thích phải dùng luồng cấp tài khoản của người có quyền. Không tạo endpoint hồ sơ độc lập khi hệ thống chưa có hợp đồng đó; không nới quyền HR. Browser mở/đóng hướng dẫn; regression xác nhận không gọi autoProvisionEmployee. |
| Bàn giao checklist chưa đủ | Nút hoàn tất bị khóa và ghi rõ 0/3; handler cũng chặn trước ghi API. Web tick đủ ba mục rồi bàn giao; SQL task CLEANED với daHoanThanhChecklist=1 và ba kết quả passed, phòng vẫn chờ nghiệm thu, không tự READY. |
| Lỗi chung, mất lý do | Giữ message/details có cấu trúc; lỗi form guest/booking nằm trong modal. Web báo thiếu tồn khi xuất 46 trong kho 45, không tìm thấy phòng ZZ999, số điện thoại abc có hướng dẫn tiếng Việt. Manager tự nghiệm thu phiếu #0 bị chặn với lý do “Người tạo hoặc người được giao không được tự nghiệm thu”, modal vẫn mở. |
| X modal bị che | X có z-index và accessible name. Hit-test tại 684×879 và desktop 1280×900 xác nhận phần tử trên cùng là nút X; click đóng dialog, count=0 ở cả hai kích thước. Đã reset viewport override. |
| Đăng nhập xã hội giả | Bỏ nút Google chỉ prefill tài khoản; bản source hiện hành không có nút Apple. Không tuyên bố đã triển khai OAuth. Web login không còn control giả này. |
| Profile lỗi vẫn fallback role | Login/restore không xác nhận được profile thì xóa session; role không biết bị từ chối, không dùng alias để suy quyền. Regression 403/500 và role thật khác alias đều pass. Không giả lập lỗi profile trên browser để gọi đó là bằng chứng HTTP thật. |
| Cấu trúc bảng HR | Fragment thay div trong tbody; browser HR không còn cảnh báo div/tr nesting. Regression render bảng và luồng ca pass. |

### Gate cuối của lượt sửa

- Backend `mvn -f backend/pom.xml -Ddebug=false -Dlogging.level.root=WARN test`
  trên SQL Server mới từ trống `QLKS_UI_FIXES_20261009`: **2.238 tests / 94
  XML reports**, failures=0, errors=0, skipped=0. Đủ **32 lớp SqlServer*Test /
  171 tests**, không skip. `ReservationCreationHttpActorTest` có ba test, bao
  gồm invalid source không ghi booking. `MailConfigurationTest` pass; không
  sửa hai dòng SMTP owner-managed.
- Frontend `npm test`: **161 tests / 27 files**, tất cả pass. `npm run build`
  pass sau các sửa cuối; còn cảnh báo bundle >500 kB, không phải failure.
  Logs: `frontend/test-ui-fixes-final.log`, `frontend/build-ui-fixes-final.log`;
  backend: `backend/target/ui-fixes-gate-20261009.log`.
- Sau full test, `mvn -f backend/pom.xml -DskipTests package` đóng gói cùng
  source đã test. Đây là bước package, không tính là một lượt test mới.
  JAR mới chạy cổng 8080, PID 17044, health UP; Flyway validate sáu migration
  thành công. Vite 5173 của chủ repo được giữ nguyên.
  Sau restart, browser đăng nhập STAFF đọc đủ 64 phòng và logout thành công;
  không có console warn/error trong smoke test cuối này.
- Browser retest thực sự chạy với STAFF, FRONTDESK, CUSTOMER, HR,
  HOUSEKEEPING, TECHNICAL và MANAGER. Các kết quả trực tiếp nằm trong bảng
  trên, không chỉ suy ra từ test mock hoặc việc mở màn hình.
- HTTP E2E 8/8 và CI remote trong mục lịch sử giữ nguyên phạm vi/ngày chạy:
  **không chạy lại tám scenario E2E hoặc CI remote trong lượt sửa này**.
  Không tự đổi các luồng chưa kiểm chứng phía dưới thành PASS.

### Dữ liệu và bằng chứng được giữ

- Trước thao tác web, backup `QLKS_before_ui_fixes_20261009.bak`; sau thao tác,
  backup `QLKS_after_ui_fixes_20261009.bak`. Cả hai nằm tại
  `/var/opt/mssql/data/` trong container `web-hotel-mis-sqlserver-1433`,
  COPY_ONLY/CHECKSUM và RESTORE VERIFYONLY thành công.
- Sau backup, chạy script hiện có `database/demo/reset_demo.sql` data-only
  trên QLKS demo đã được chủ repo cho phép reset. Dữ liệu thử của lượt này đã
  được dọn, về **10 nhân viên / 64 phòng / 6 reservations / 2 đơn dịch vụ**;
  các bản ghi #7/#5/#8 nêu trên nằm trong backup sau test, không phải dữ liệu
  còn tồn tại sau reset. Không xóa dữ liệu ở database khác.
- Vẫn đúng V1–V6 success, **10 trigger enabled / 10 functions / 61 views /
  68 procedures**. DBCC CHECKCONSTRAINTS không vi phạm, FK/CHECK disabled hoặc
  untrusted=0. Không sửa migration, checksum hoặc Flyway history trong lượt
  sửa UI. Database test riêng `QLKS_UI_FIXES_20261009` đã được xóa sau full gate.
- Ảnh hiện hành:
  `C:/Users/minht/.codex/visualizations/2026/10/09/hotel-ui-fixes/`:
  `frontdesk-booking-success.jpg`, `restaurant-valid-lunch.jpg`,
  `hr-night-shift.jpg`, `hr-provisioning-boundary.jpg`, `staff-floor20.jpg`,
  `housekeeping-incomplete-checklist.jpg`, `linen-insufficient-stock.jpg`,
  `incident-unknown-room.jpg`, `manager-self-accept-rejected.jpg`,
  `guest-invalid-phone.jpg`, `service-close-684.jpg`, `service-close-desktop.jpg`.
- Không thực hiện thanh toán gateway thật, OTP hoặc gửi mail tới người ngoài.
  Không có chứng nhận production/remote hay exhaustive cho toàn ứng dụng.

## Lịch sử lỗi trước sửa — browser audit 08/10/2026

Các mô tả sau giữ lại để truy vết nguyên nhân và so sánh; trạng thái hiện hành
và bằng chứng thay thế nằm ở mục 09/10/2026 phía trên.

### P1 — Lễ tân không tạo được booking bằng actor đang đăng nhập

- Đăng nhập mẫu Lễ tân (`FRONTDESK`), Khách hàng → Tạo đặt phòng; chọn khách
  demo, phòng 802, số khách 1 và khoảng lưu trú hợp lệ rồi gửi.
- Web báo **“Actor không khớp nhân viên của booking”**; không tạo reservation.
  Khách demo `UI audit Demo` đã được tạo thành công trước đó, nên không phải
  việc chọn khách không tồn tại.
- `frontend/src/features/front-desk/FrontDeskPMS.tsx:1718` vẫn gửi
  `employee_id: "EMP001"`, khác actor thật `FRONTDESK`. Đây là residue frontend
  còn sống, không phải lỗi quyền của SQL.
- Ảnh: `frontdesk-actor-error.jpg` trong thư mục bằng chứng bên dưới.
- Bằng chứng test cần thay thế/bổ sung: browser booking bằng actor từ profile
  thật; HTTP test tự gửi actor đúng không chứng minh form hiện tại gửi đúng.

### P1 — Bữa trưa lúc 18:30 vẫn được xác nhận và lưu

- Khách Nguyễn Văn An → Đặt thêm dịch vụ → MaM Restaurant → Xem & đặt bàn;
  booking 6, ngày 09/10/2026. Form mặc định **Bữa trưa / 18:30**.
- Nhập số lượng -2 bị tự đổi thành 1; bấm xác nhận tạo đơn dịch vụ #2 thành
  công, số lượng 1, miễn phí 1. SQL xác nhận đơn bữa trưa lúc 18:30.
- Bếp mở điều phối ngày 09/10 cũng thấy đúng đơn **18:30 / Bữa trưa**;
  xác nhận phục vụ bị khóa vì chưa đến giờ. Đơn sai khung giờ không chỉ là
  chữ hiển thị ở form khách.
- `customer-policy.md:196`: bữa trưa 11:30–14:00, bữa tối 18:00–22:00.
  `LuxuryFnBView.tsx:84–86` khởi tạo LUNCH với 18:30; lựa chọn giờ ở dòng 606
  không giới hạn theo bữa. Cần kiểm tra tổ hợp bữa/ngày/giờ ở owner nghiệp vụ,
  không chỉ sửa một giá trị mặc định. V6 hiện đã có trigger chặn lưu sai khung
  giờ ở database; lỗi mặc định/UX của form vẫn là bằng chứng cần sửa riêng.
- Ảnh: `kitchen-lunch-at-evening.jpg`.
- Số lượng rác được clamp mà không báo lỗi là hành vi quan sát được, không
  phải bằng chứng hệ thống từ chối yêu cầu số lượng âm ở tầng nghiệp vụ.

### P1 — Ca đêm quảng cáo 22:00–06:00 nhưng chỉ lưu gần hai giờ

- HR → Lịch phân ca → ô trống ngày 09/10 của Nguyễn Minh Lễ Tân →
  **Ca Đêm (22:00 - 06:00)**. UI báo lưu và hiển thị Ca Đêm.
- SQL thực tế: `2026-10-09 22:00:00` đến `2026-10-09 23:59:59`, không đến
  06:00 ngày 10/10. Điều này làm sai độ dài ca và phạm vi kiểm tra chồng lấn.
- `frontend/src/features/hr/HRStation.tsx:445` đặt NIGHT end=23:59:59 rồi
  ghép cùng `cell.isoDate` ở dòng 451/454. Trigger chống trùng ca kiểm tra
  khoảng đã gửi, không thể tự đoán UI muốn ca tám giờ để sửa dữ liệu hộ.
- Cần regression qua UI và SQL xác nhận timestamp ngày kế tiếp, kèm ca giao
  nhau qua nửa đêm; test shift hiện tại không kiểm chứng payload ca đêm của UI.

### P1 — Cổng STAFF không đọc được phòng và hiển thị số liệu rỗng

- Đăng nhập mẫu Nhân viên vận hành (`STAFF`) → Tổng quan và Tình trạng phòng.
  UI giữ 0/0 phòng, ma trận trống và “Đang kết nối”; chọn Tầng 1 không có phòng.
  Catalog public và các station khác có 64 phòng.
- Console ghi `Backend staff portal data unavailable`, API từ chối quyền
  tại `Promise.all (index 2)`, cùng lỗi directory/finance vượt quyền.
- `frontend/src/features/staff-portal/StaffPortal.tsx:221` gộp public rooms,
  reservations và housekeeping tasks vào một Promise.all. Một API vượt scope
  thất bại làm catch dòng 269 xóa toàn bộ danh sách phòng được phép đọc.
- **Backend từ chối tài chính là đúng**, nhưng không chứng minh cổng STAFF
  sử dụng được. Không đề xuất mở rộng quyền STAFF để làm màn hình xanh.
- Ảnh: `staff-empty-room-matrix.jpg`.

### P1 — Form HR “Thêm nhân viên” gọi nhầm luồng cấp tài khoản

- HR → Hồ sơ nhân sự → Thêm nhân viên mới: rỗng bị required; email rác không
  hợp lệ. Khi form có tên/điện thoại, thao tác gửi báo không thể tạo tài khoản.
- Audit thật ghi `HR access denied /api/auth/employees/auto-provision` lúc
  20:16:45. Không kết luận lỗi này là do số điện thoại rác: request đã bị chặn
  quyền trước nghiệp vụ.
- `HRStation.tsx:491` gọi `enterpriseApi.autoProvisionEmployee`, không phải
  luồng HR tạo hồ sơ. Cần khớp control surface với scope hiện hành; không
  nới quyền cấp credential của HR chỉ để né lỗi form.
- Chưa tạo credential mới hoặc đổi quyền tài khoản qua UI trong lượt này.

### P2 — Handoff vệ sinh 0/3 và thông báo lỗi thiếu lý do

- HOUSEKEEP → phòng 502 → Bắt đầu → Tiếp tục → không tick checklist →
  Hoàn tất vệ sinh & Bàn giao. UI chuyển sang Đang kiểm tra, vẫn **0/3**;
  SQL task có `Đã dọn xong`, `daHoanThanhChecklist=0`.
- Nghiệm thu đạt bị chặn **“Cần hoàn thành toàn bộ checklist”**: bảo vệ READY
  vẫn hoạt động. Không gọi đây là phòng được mở bán trái phép; vấn đề là nút
  “Hoàn tất” bàn giao một checklist chưa đạt mà không giải thích.
- `HousekeepingStation.tsx:1640/1655` gửi các item chưa tick với passed=false,
  sau đó CLEANED. Test `HousekeepingStation.test.tsx:261` dùng mock và chỉ
  assert updateTask(CLEANED), không bảo vệ trải nghiệm hoàn tất checklist.
- Quản lý là người tạo phiếu kỹ thuật #0: tự nghiệm thu bị chặn đúng SoD,
  nhưng UI chỉ báo “Không thể nghiệm thu...”. Giám đốc khác người tạo nghiệm
  thu thành công. Nút READY cho phòng 701 vẫn bị chặn vì incident blocking.
- Xuất đồ vải vượt kho, số phòng sự cố rác và số điện thoại khách sai đều bị
  từ chối nhưng nhiều form chỉ hiện lỗi chung, thiếu lý do theo trường.
- Ảnh: `housekeeping-missing-checklist.jpg`.

### P2 / cần phân biệt giới hạn bằng chứng

- Nút X modal đặt dịch vụ không đóng được tại viewport khoảng 684×879,
  kể cả bấm trực tiếp vùng nút; nút Hoàn tất ở modal thành công đóng được.
  `LuxuryFnBView.tsx:475` đặt X trước aside relative, không z-index. Khả năng
  bị lớp aside che là suy luận từ source, chưa xác nhận bằng hit-test DOM.
- Bấm Google chỉ điền mẫu khách, không mở OAuth. Apple ID chưa thao tác được
  trong lượt cuối vì browser-control bị kẹt; source cũng là prefill demo.
  Không lấy các nút này làm bằng chứng đăng nhập Google/Apple hoạt động thật.
- `frontend/src/app/App.tsx:84–92` còn fallback staffAccounts nếu profile
  lỗi không phải 401. Đây là residue đọc từ source, **chưa tái hiện mất API
  profile trên browser**, không phải bằng chứng bypass authorization backend.
- HR console có cảnh báo div trong tbody/tr trong div. Chưa chứng minh gây
  crash hoặc hydration lỗi trong bản CSR hiện tại; không nâng thành P1.

## Gate và bằng chứng đã chạy — lịch sử 08/10/2026

| Gate | Kết quả ngày 08/10 | Phạm vi chứng minh |
|---|---|---|
| Backend `clean package` | PASS: 2.236 tests, 94 XML reports, 0 fail/error/skip | SQL Server thật + contracts; không phải mọi UI |
| 32 lớp SqlServer*Test | PASS: 170 tests, 0 skip | Migration, SQL behavior, transaction/concurrency được test |
| Frontend `npm test` | PASS: 140 tests, 25 files | Component/API tests; có mock, không thay browser thật |
| Frontend `npm run build` | PASS, warning bundle lớn | Compile/build artifact, không nghiệm thu nghiệp vụ |
| Live HTTP role E2E | PASS: 8/8, configured=8, skipped=0, blocked=0 | Request thật/backend thật; không đọc payload từ nút UI |
| Browser nghiệp vụ | **FAIL** | Đã có lỗi thực tế ở các luồng nêu trên; chưa exhaustive |
| CI remote | CHƯA KIỂM CHỨNG LƯỢT REMOTE | Workflow frontend hiện chỉ install/build, không chạy npm test hoặc browser |

Lệnh backend: `mvn -q -f backend/pom.xml -Ddebug=false -Dlogging.level.root=WARN clean package`.
Database mới từ trống: `QLKS_TRIGGER_AUDIT_20261008`; Flyway V1–V6,
Hibernate validate. Lượt thành công chạy khoảng 19:20–19:30 ngày 08/10.
Lượt clean đầu bị process dev giữ class file; đã dừng process rồi chạy lại
toàn bộ thành công, không dùng kết quả lượt thất bại để tính pass.

Frontend chạy `npm test` và `npm run build`. HTTP E2E chạy trên
`e2e_ui_trigger_audit_20261008`, backend jar 8081, kết thúc 19:36:31.
Fixtures E2E có chủ ý giải phóng blocker để test happy path, nên không suy
ra mọi phòng demo ở UI cũng đủ điều kiện READY. Tám scenario thực sự chạy:
anonymous; customer booking/deposit/ownership; frontdesk checkin/checkout/
payment/receipt; housekeeping–technical–manager; kitchen stock/price;
accounting–director refund/approval/replay; HR/admin ceiling; STAFF read/finance ceiling.

## Thao tác browser thực tế trên QLKS demo

Đã đăng nhập từng mẫu trong 11 vai trò bằng UI tại `http://localhost:5173/`.
Dữ liệu nhập mới là dữ liệu tổng hợp có nhãn UI audit/demo, không dùng CCCD,
số điện thoại hoặc giao dịch thật của người ngoài. Bảng này chỉ ghi các thao
tác đã làm; mở tab không tự tính là kiểm chứng toàn bộ các nút trong tab.

| Vai trò / luồng | Thao tác và kết quả quan sát |
|---|---|
| Public | Catalog 64 phòng; tìm phòng trống; khoảng ngày đảo bị cảnh báo; đặt phòng chưa login yêu cầu đăng nhập |
| Auth | Login rỗng bị chặn; tài khoản chứa script bị từ chối; sai password bị từ chối; các mẫu vai trò đăng nhập được; logout được |
| CUSTOMER hồ sơ | Mở hồ sơ; tên rỗng/email rác bị validity chặn; Hủy không lưu dữ liệu đang sửa |
| CUSTOMER đơn | Chỉ thấy booking của An (6/5/1 trước checkout), không thấy cả sáu booking; nút đổi/gia hạn không hiện khi không đủ cutoff |
| CUSTOMER dịch vụ | Đặt restaurant tạo đơn thật nhưng sai khung bữa; lượng âm clamp; ngày ngoài stay bị HTML validity chặn; Hoàn tất đóng modal |
| FRONT_DESK khách | Tìm chuỗi SQL/script cho 0 kết quả; tạo rỗng bị chặn; năm sinh ngoài giới hạn bị chặn; phone rác bị từ chối; khách demo hợp lệ tạo được |
| FRONT_DESK booking | Số khách âm bị min chặn; booking hợp lệ bị actor EMP001 làm thất bại (P1) |
| FRONT_DESK checkout | Mở phòng 501 đúng khách; Trả phòng & Quyết toán; xác nhận hóa đơn/thu tiền mặt demo 2.380.000đ; SQL booking checked out, invoice paid, thêm payment |
| FRONT_DESK giao ca | Mở két/lịch sử; thiếu tiền/người nhận/checklist thì nút xác nhận disabled; số tờ âm clamp 0; chưa submit handover hợp lệ bằng UI |
| HOUSEKEEP checklist | Bắt đầu, Tiếp tục, bàn giao 0/3; xem Nhiệm vụ; Nghiệm thu đạt thiếu checklist bị chặn; chưa READY trái phép |
| HOUSEKEEP đồ vải | Xuất 999999 bị từ chối, tồn 45 giữ nguyên; xuất 1 thành công, tồn 44 |
| HOUSEKEEP sự cố | Rỗng bị chặn; phòng zzz bị từ chối; báo sự cố demo phòng 602 thành công |
| TECHNICAL | Báo hoàn thành rỗng bị chặn; ghi kết quả → WAITING_ACCEPTANCE; thêm tài sản rỗng bị required; tài sản demo hợp lệ tạo được; mở tab khu chung/bảo trì chưa có fixture |
| KITCHEN điều phối | Chuyển ngày bằng phím trên datepicker, thấy đơn bữa trưa 18:30; phục vụ sớm disabled |
| KITCHEN kho | Nhập lượng -3 báo lỗi số nguyên dương; nhập BREAKFAST +2 thành công; CSV tải thật, hàng RECEIVE +2 khớp thao tác |
| KITCHEN giá | Giá âm bị chặn; BADMINTON 160.000đ tạo request chờ duyệt; chưa kiểm chứng activation giá qua UI |
| MANAGER | Phê duyệt request giá, danh sách giảm một; self-accept workorder bị chặn đúng; xem phòng/phân ca/báo cáo; tiếp nhận sự cố 602 có audit thật |
| DIRECTOR | Nghiệm thu workorder #0 của MANAGER thành công, SQL acceptedBy=DIRECTOR; READY 701 bị chặn vì còn incident |
| ACCOUNTING | Xem VAT chi tiết; đóng modal; xem payment mới 2.380.000đ; lọc script/thẻ cho rỗng; Agoda đối soát thành công; công nợ demo tất toán về 0/SETTLED |
| HR lịch | Sửa ca STARTED bị chặn (console chỉ ASSIGNED mới được sửa); tạo ca mới thành công nhưng ca đêm sai giờ (P1) |
| HR hồ sơ/chấm công | Xem 10 hồ sơ và chấm công; rỗng/email rác chặn; gửi tạo nhân viên bị access denied; mở điều chỉnh và lưu thủ công, chưa chứng minh case time đảo bằng input thực |
| HR nghỉ | Tạo đơn thay ACCOUNTING thành công, PENDING; không có nút HR tự duyệt; default select nhìn có nhân viên nhưng cần chọn rõ để state có ID |
| ADMIN | 10 tài khoản thật; tìm script cho rỗng; mở/hủy sửa STAFF; xem role/audit/cấu hình; không cấp quyền, đổi credential hoặc vô hiệu hóa tài khoản |
| STAFF | Login được; Tổng quan/Ma trận phòng lỗi rỗng (P1); Tầng 1 không có phòng; Cài đặt chỉ đọc |

## Trigger phù hợp đã bổ sung và kiểm chứng

Chỉ sửa V6, không tạo migration thứ bảy hoặc SQL helper object. Chọn trigger
theo invariant cross-row; authorization/audit/business transaction giữ ở V5.

| Trigger | DML | Invariant / proof |
|---|---|---|
| trgBienLaiBaoDamTienThu / BienLai | INSERT, UPDATE | Tổng receipt không vượt gross completed payment cùng invoice/tender; invalid batch rollback |
| trgThanhToanBaoDamBienLai / GiaoDichThanhToan | INSERT, UPDATE, DELETE | Không làm mất funding cho receipt; update/delete sai rollback; refund không xóa lịch sử |
| trgCaLamViecKhongTrung / CaLamViecNhanVien (mới) | INSERT, UPDATE | Không ca chồng nhau cùng nhân viên; batch/UPDATE/reactivation reject; adjacent/cancelled/delete hợp lệ |
| trgNhatKyKiemSoatKhongSua / NhatKyKiemSoat | UPDATE | Audit đã ghi không được viết lại; sửa sai bằng event mới |
| trgYeuCauPheDuyetKhongTuDuyet / YeuCauPheDuyet | INSERT, UPDATE | Requester và approver phải khác nhau |
| trgButToanTaiChinhKhongSua / ButToanTaiChinh | UPDATE | Bút toán đã ghi là bất biến; sửa sai bằng bút toán điều chỉnh |
| trgLichSuHangThanhVienKhongSua / LichSuHangThanhVien | UPDATE | Lần đổi hạng đã ghi không được viết lại |
| trgDatDichVuDungKhungGioBuaAn / DatDichVuKhachSan | INSERT, UPDATE | Bữa trưa 11:30–14:00; bữa tối 18:00–22:00 |
| trgDatDichVuTrongKyLuuTru / DatDichVuKhachSan | INSERT, UPDATE | Dịch vụ nằm trong khoảng lưu trú `[nhận, trả)` |
| trgDatDichVuChiDungKhiDangO / DatDichVuKhachSan | INSERT, UPDATE | Chỉ ghi `Đã sử dụng` khi booking `Đã nhận phòng` |

`SqlServerFinancialTriggerTest`: 2 tests. `SqlServerHrShiftConcurrencyTest`:
3 tests, bao gồm DML trực tiếp để bỏ trigger sẽ làm assertion rollback sai.
Concurrency hai thread hiện kiểm chứng procedure employee-first lock; không
gọi đây là exhaustive mọi deadlock/interleaving của DML trực tiếp.
Không thêm DELETE trigger ca: xóa chỉ giải phóng khoảng thời gian. Mười trigger
đều có invariant và behavior test; không lặp FK/CHECK chỉ để tăng số lượng.

QLKS đã migrate đúng sáu version, có 10 functions / 61 views / 68 procedures /
10 triggers enabled. Trong SSMS, refresh **Tables → bảng tương ứng → Triggers**;
đây không phải Database Triggers cấp database.

## Kiểm tra debt của bằng chứng

- **Keep (behavior):** SQL transaction/concurrency và raw-DML trigger tests,
  chúng thực thi và kiểm tra kết quả/rollback, không chỉ grep tên object.
- **Keep (contract):** metadata/history V1–V6 kiểm tra invariant sáu file hiện
  hành của chủ repo; metadata tồn tại một mình không chứng minh business flow.
- **Escalate:** HTTP happy path gửi payload đúng bỏ qua bug form EMP001;
  component mock không bắt được giờ bữa ăn/ca đêm và scope API STAFF.
- **Escalate:** test mock housekeeping assert CLEANED, chưa quan sát checklist
  thật và phản hồi tới nhân viên khi chưa đủ item.
- **Closeout-only:** kiểm tra production không còn JPA repository/direct-table
  path và kiểm tra nội dung jar. Đây là inventory thời điểm này, không tự biến
  thành permanent regex/prose gate chứng minh nghiệp vụ.
- **Demote claim:** “Đã nghiệm thu” trong database-access-matrix chỉ áp dụng
  SQL/backend use case được test, không được dùng như chứng nhận web toàn diện.

## Giới hạn chưa nghiệm thu và vận hành sau test

- Chưa test exhaustive tất cả nút/filter/menu trên mọi kích thước màn hình.
  Chưa browser happy path tạo booking mới online tới cọc/đổi lịch/gia hạn/hủy,
  toàn bộ service categories, full handover, refund qua UI, price activation,
  biometric file import, mọi XML/print/export, chatbot/network agent.
- Không đổi password/OTP/role hoặc credential; không gửi tiền qua VNPay/ngân
  hàng thật, không tự gửi email tới người ngoài. SQL/API mock provider chứng
  minh commit/timing không chứng minh email đã được nhận hoặc gateway thật.
- Một số date/time fill của công cụ chỉ đổi DOM nhưng không commit React state.
  Không ghi nhận việc giá trị tự quay lại mặc định đó là lỗi ứng dụng. Ngày
  bếp đã được đổi bằng thao tác phím datepicker và xác nhận ở UI.
- Sau bấm “Mở phòng” ở TECHNICAL, browser-control bị timeout/hộp cảnh báo;
  các cách khôi phục trên cùng browser không hoàn tất thao tác. Tab mới đọc
  được catalog nhưng các click không đổi view. **Không có kết quả pass/fail
  nghiệp vụ cho bước release cuối**, không gán timeout công cụ thành bug web.
- Backup trước dựng QLKS:
  `/var/opt/mssql/data/QLKS_before_ui_trigger_audit_20261008.bak` trong container
  `web-hotel-mis-sqlserver-1433`, COPY_ONLY/CHECKSUM và RESTORE VERIFYONLY.
  Đã backup thêm trạng thái sau test tại
  `/var/opt/mssql/data/QLKS_after_ui_trigger_audit_20261008.bak`, COPY_ONLY/
  CHECKSUM + RESTORE VERIFYONLY đều thành công, để giữ khả năng tái kiểm tra
  các bản ghi đã được nhắc trong báo cáo.
- Sau lưu bằng chứng, đã dừng backend dev và 8081, chạy script data-only
  `database/demo/reset_demo.sql` **hai lần thành công** trên QLKS. Đã xóa dữ
  liệu tổng hợp của lượt browser test, trả về 10 nhân viên / 64 phòng /
  6 reservations. Có backup trước và sau test để phục hồi dữ liệu tương ứng.
- `DBCC CHECKCONSTRAINTS WITH ALL_CONSTRAINTS` không có vi phạm;
  FK/CHECK disabled hoặc untrusted=0; nhóm receipt thiếu funding=0;
  10 trigger enabled. Không sửa Flyway history/checksum.
- Bản JAR cuối `backend/target/web-hotel-mis-backend-0.1.0-SNAPSHOT.jar` được
  build sau full gate 2.236 tests; public rooms HTTP 200/JSON hợp lệ sau restart.
  Vite 5173 của chủ repo giữ nguyên (PID 38164). Backend E2E 8081 đã dừng;
  hai database tạm **do lượt này tạo** `e2e_ui_trigger_audit_20261008` và
  `QLKS_TRIGGER_AUDIT_20261008` đã xóa. Không xóa database khác.

Bằng chứng ảnh local:
`C:/Users/minht/.codex/visualizations/2026/10/08/hotel-ui-audit/`.
CSV kho tải thật: `C:/Users/minht/Downloads/bao-cao-ton-kho-2026-10-08.csv`.
Không có source/frontend regression được sửa để ép test xanh.

## Chốt yêu cầu 10 trigger — 09/10/2026, trước lượt sửa UI

Đã bỏ câu giới hạn “minimal necessary” trong quy tắc số 1 của `AGENTS.md`.
Vẫn chỉ có sáu SQL migration V1–V6; V6 chứa đúng 10 trigger như bảng trên.

- Full backend cuối: `mvn test package` trên database SQL Server mới
  `QLKS_TRIGGER_FINAL_20261009`, **2.237 tests / 94 reports**, 0 failures,
  0 errors, 0 skipped. 32 lớp `SqlServer*Test` có **171 tests**. Database này
  đã được xóa sau kiểm thử; không dùng repair hoặc chỉnh Flyway history.
- `SqlServerHotelServiceBookingTest` có 12 tests: thêm case lỗi giờ bữa ăn trả
  DomainException, rollback cả đơn/audit; bốn mốc đầu/cuối khung bữa trưa/tối
  hợp lệ. Mapping 53609/53610/53611 trả các mã lỗi nghiệp vụ tương ứng thay vì
  để lỗi SQL thành HTTP 500.
- HTTP thật trên JAR mới cổng 8080, CUSTOMER demo: LUNCH 18:30 và DINNER 12:00
  cùng trả **422 / SERVICE_OUTSIDE_MEAL_HOURS**. Sau hai yêu cầu bị từ chối,
  `DatDichVuKhachSan` vẫn có 2 đơn demo. Phiên kiểm thử đã logout.
- QLKS đã validate 6 migration, cả V1–V6 success, 10 trigger enabled;
  DBCC CHECKCONSTRAINTS không vi phạm. Backend PID 24312 health UP;
  frontend Vite PID 38164 vẫn phục vụ cổng 5173.
- Bản dựng QLKS 10 trigger có backup trước/sau đã VERIFYONLY:
  `/var/opt/mssql/data/QLKS_before_v6_ten_triggers_20261008.bak` và
  `/var/opt/mssql/data/QLKS_after_v6_ten_triggers_20261008.bak`.
- Frontend gate gần nhất vẫn là 140 tests / 25 files và build pass. Không thay
  source frontend trong phần bổ sung 10 trigger. **Gate browser tổng thể vẫn
  FAIL** với các lỗi đã ghi ở trên; lỗi dữ liệu bữa ăn đã được database/API chặn
  nhưng không đồng nghĩa form và toàn bộ nghiệp vụ UI đã được nghiệm thu.
