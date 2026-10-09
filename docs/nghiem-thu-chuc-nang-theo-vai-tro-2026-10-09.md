# Nghiệm thu chức năng theo vai trò — 09/10/2026

## Kết luận

**Chưa ký nghiệm thu toàn hệ thống. P1 phân quyền housekeeping đã được sửa và retest đạt** ở giao diện, backend, stored procedure, và các gate tự động. Những luồng còn được liệt kê là chưa thử lại/chưa đủ bằng chứng vẫn không được tính PASS; các giới hạn này không bị che bởi gate xanh.

Các luồng an toàn đã được thao tác trên `http://localhost:5173/`, dữ liệu ghi thành công được đối chiếu SQL. Lỗi dữ liệu không hợp lệ được xác nhận không ghi hoặc không đổi số dư ở các trường hợp đã thử. Bằng chứng browser/API trước đó vẫn được giữ tại `docs/kiem-tra-hardcut-web-2026-10-08.md`, phần “Kết luận hiện hành — sửa và kiểm chứng lại ngày 09/10/2026”; bảng dưới phân biệt rõ thao tác có bằng chứng và phần chưa được lặp lại/chưa đủ bằng chứng, không tự nâng các mục còn thiếu thành PASS.

## Phạm vi và kết quả theo vai trò

| Vai trò | Luồng hợp lệ đã thao tác | Dữ liệu sai đã thử | Quyền truy cập | Đối chiếu DB / kết quả |
|---|---|---|---|---|
| CUSTOMER | Xem 64 phòng, lọc loại/tầng, xem chi tiết và tính giá theo ngày/giờ. Không gửi booking mới trong lượt này. | Lượt kiểm tra trước đã thử số điện thoại `abc` và form hồ sơ không hợp lệ; UI hướng dẫn/từ chối, không tạo dữ liệu. | Chỉ thấy dữ liệu/đặt phòng của khách đăng nhập; booking cần đăng nhập. | Không phát sinh ghi DB trong lượt này. Trạng thái baseline vẫn 6 booking, 2 đặt dịch vụ. Booking/thanh toán mới chưa nghiệm thu lại. |
| FRONTDESK | Xem khách, sơ đồ phòng, tình trạng lưu trú; mở luồng khách hàng, giao ca và két. Booking/checkout hợp lệ đã có bằng chứng trong biên bản 08–09/10 trước đó, không lặp lại trong lượt này. | Tạo hồ sơ khách rỗng bị HTML `required` chặn. | Két/bàn giao chưa đủ checklist và số tiền thì nút xác nhận bị khóa; không ghi tài chính trong lượt này. | Form rỗng không thêm khách. Không có giao dịch/bàn giao mới. Các bằng chứng booking/checkout cũ được dẫn riêng ở `docs/kiem-tra-hardcut-web-2026-10-08.md`, không tính là thao tác mới ngày 09/10 này. |
| HOUSEKEEPING | Bắt đầu dọn phòng 502, hoàn thành cả 3 mục checklist; tạo báo sự cố hợp lệ phòng 802; nhập kho 1 bộ linen. | Báo sự cố rỗng và phòng `ZZ999` bị từ chối; xuất 46 khi tồn 45 bị từ chối, tồn không giảm. | **P1 cũ đã đóng:** lần test trước phát hiện HOUSEKEEPING tự nghiệm thu được; bản vá 09/10 đã retest bằng account thật, UI không còn nút này. | Bản ghi vi phạm lịch sử task 1 / phòng 502 / actor HOUSEKEEP / CLEANED→READY đã được lưu bằng backup trước khi reset demo. Sau bản vá, SQL Server regression xác nhận cả service và stored procedure từ chối, không đổi task/phòng/version/audit/claim; manager vẫn nghiệm thu được khi đủ điều kiện. Incident 802 và linen `LINEN-KING` 45→46 được đối chiếu ở lượt trước rồi reset về demo seed. |
| TECHNICAL | Báo hoàn thành work order #1 với ghi chú kết quả; trạng thái sang chờ nghiệm thu. | Gửi kết quả rỗng bị chặn với thông báo yêu cầu ghi kết quả/vật tư. | Chỉ thao tác lệnh kỹ thuật được phân công; không tự nghiệm thu phiếu trong lượt này. | SQL trước cleanup: work order #1, actor TECHNICAL, trạng thái `Chờ nghiệm thu`, có `ghiChuKetQua`. Không lưu khi submit rỗng. |
| HR | Tạo ca demo qua đêm cho HR ngày 10/10, 22:00–06:00 ngày kế tiếp; xem hồ sơ và lịch. | Không gửi hồ sơ nhân viên rỗng/rác; chấm công không sửa trong lượt này. | Xem lịch/hồ sơ; không thấy chức năng HR phê duyệt nghỉ phép hoặc cấp quyền tài khoản. | SQL trước cleanup xác nhận ca có ngày kết thúc sang 11/10. Marker ca thử không còn sau reset. Cấp tài khoản mới chưa thử trong lượt này. |
| KITCHEN / FNB | Nhập 1 món kho DECOR; tạo đề nghị đổi giá dịch vụ BADMINTON 150.000→155.000. | Nhập kho số lượng 0 và đề nghị giá 0 đều bị từ chối. | Đề nghị giá ở trạng thái chờ duyệt, không tự đổi giá đang bán; không gửi xác nhận phục vụ vì có thể phát sinh phí booking. | SQL trước cleanup xác nhận tồn DECOR 29→30 và ledger RECEIVE +1; approval do KITCHEN tạo ở trạng thái pending; `DichVu` vẫn 150.000. |
| ACCOUNTING | Xem bảng thanh toán, hóa đơn/VAT, bộ lọc và số liệu seed. | Không có form nhập khoản thanh toán sai được submit trong lượt này. | Không gọi API thanh toán/hoàn tiền, không quyết toán hoặc tất toán công nợ trong lượt này. | Chỉ đọc dữ liệu seed; không có ghi tài chính mới. Các luồng thanh toán/refund không được nghiệm thu trong lượt này. |
| MANAGER | Xem dashboard, danh sách chờ duyệt, phòng/vận hành và báo cáo; tiếp nhận incident phòng 802. | Gửi nhận xét nghiệm thu work order rỗng bị chặn. | Có thể xem luồng phê duyệt/vận hành; không tự nghiệm thu phiếu do mình tạo theo bằng chứng kiểm tra trước đó. Không duyệt giá/hoàn tiền trong lượt này. | SQL trước cleanup ghi incident 802 sang `Đã tiếp nhận` kèm ghi chú. Nhận xét rỗng không đổi trạng thái phiếu. |
| DIRECTOR | Đăng nhập thành công; xem dashboard, các yêu cầu chờ duyệt, vận hành, nhân sự và báo cáo. | Không gửi payload phê duyệt sai vì các yêu cầu đang chờ có thể đổi giá/tác động tài chính. | Quyền phê duyệt đã quan sát trên console; không quyết định các giao dịch demo trong lượt này. | Không phát sinh ghi DB bởi DIRECTOR trong lượt này. Phê duyệt/refund không tính PASS lại. |
| ADMIN | Xem tổng quan, 10 tài khoản, ma trận quyền và audit log. | Không tạo/khóa tài khoản hoặc gửi cấu hình rác vì các thao tác này đổi quyền/credential. | Trang cấu hình ghi rõ backend chưa có API lưu cấu hình động; không thể nghiệm thu chức năng lưu cấu hình như một chức năng hoạt động. | Chỉ đọc. Không có tài khoản/cấu hình mới. Đây là chức năng chưa được triển khai, không phải test pass. |
| STAFF | Xem dashboard 64 phòng, sơ đồ và cài đặt đọc; UI báo không có quyền tài chính/booking. | Không có form ghi nghiệp vụ cho STAFF trong các trang đã kiểm tra. | Không hiển thị thao tác booking/tài chính; các gate HTTP STAFF/finance-ceiling có trong báo cáo E2E trước đó. Không thử truy cập API trái quyền bằng token thủ công trong lượt này. | Chỉ đọc, không có ghi DB. |

## Lỗi P1 đã phát hiện (trước bản vá) và vì sao gate xanh chưa đủ

- Hợp đồng quyền frontend khai báo HOUSEKEEPING `canMarkAvailable: false` tại `frontend/src/app/navigation/permissions.ts:170`.
- Nhưng `frontend/src/features/housekeeping/HousekeepingStation.tsx:972-974` luôn render nút “Nghiệm thu đạt”; handler tại dòng 1672 gửi `status: "READY"`.
- API `PATCH /tasks/{id}` chỉ yêu cầu `HOUSEKEEPING_TASK_WRITE` tại `backend/src/main/java/com/hospitality/mis/controller/operations/HousekeepingController.java:56`. Service chỉ truyền cờ `hasManagementRole()` xuống DAO, không từ chối riêng HOUSEKEEPING chuyển READY (`HousekeepingService.java:35`).
- Stored procedure `uspCapNhatNhiemVuBuongPhong` tại `backend/src/main/resources/db/migration/V5__stored_procedures.sql:1708-1730` kiểm tra người được phân công, checklist và blocker, nhưng không bắt buộc `@management=1` cho trạng thái READY.
- Tại thời điểm phát hiện, regression frontend còn kỳ vọng station HOUSEKEEPING gọi `updateTask(... READY)` và chưa có test từ chối READY cho HOUSEKEEPING. Các thiếu sót đó đã được xử lý trong bản vá bên dưới.

## Retest sau bản vá — 09/10/2026

- **Web thật:** đăng nhập `HOUSEKEEP` trên `http://localhost:5173/`, mở “Kiểm tra & Nghiệm thu” và chi tiết phòng 701. Màn hình ghi “Chờ quản lý nghiệm thu”, có hướng dẫn “chỉ quản lý mới được chuyển phòng sang Sẵn sàng”, chỉ có nút “Xem chi tiết”/“Hủy / Đóng”; không có nút “Nghiệm thu đạt”. Console browser không có lỗi JavaScript.
- **DB sau thao tác UI chỉ đọc:** truy vấn `NhiemVuBuongPhong` + `Phong` xác nhận bốn task demo vẫn ở trạng thái seed: 502 `Cần dọn phòng`, 602 `Đang thực hiện`, 702 `Chờ kỹ thuật`, 701 `Đã dọn xong`; phòng 701 vẫn `Đang dọn phòng`, `phienBan=0`. Mở màn hình/chi tiết không ghi task hoặc đổi phiên bản phòng.
- **Backend + SQL Server:** `mvn -f backend/pom.xml -Dtest=SqlServerHousekeepingTaskTest test` — 8 tests, 0 failure/error/skip. Regression mới gọi service và DAO/SQL command với principal HOUSEKEEPING; cả hai bị từ chối và xác nhận task, trạng thái phòng, phiên bản, audit, idempotency claim không đổi. Test lifecycle riêng xác nhận manager vẫn chuyển READY được khi đủ checklist và phòng không bị khóa.
- **Toàn bộ gates:** `mvn -f backend/pom.xml -Ddebug=false clean package` — 2.239 tests, 94 XML reports, 0 failure/error/skip; `npm test` — 27 files / 161 tests pass; `npm run build` pass (còn cảnh báo bundle JS 1,104.83 kB vượt ngưỡng khuyến nghị 500 kB). Flyway đã chạy/validate V1–V6; không repair checksum hay sửa lịch sử.
- **Dữ liệu demo:** sau backup `QLKS_after_hk_permission_gates_20261009.bak` đã chạy lại `database/demo/reset_demo.sql`. Kiểm tra sau reset: 10 nhân viên, 64 phòng, 6 reservations, 2 service bookings, 4 housekeeping tasks; 10 trigger enabled; không còn marker kiểm thử; `DBCC CHECKCONSTRAINTS` không báo vi phạm. Backup được `RESTORE VERIFYONLY` thành công.
- Bản sửa nằm trong `HousekeepingService`, `HousekeepingTaskDatabase`, `V5__stored_procedures.sql`, `HousekeepingStation.tsx` và regression tests tương ứng. Vẫn giữ đúng sáu migration V1–V6; không tạo migration mới.

## Gates trước lượt sửa, cleanup và giới hạn nghiệm thu

- Gate lịch sử trước khi phát hiện P1 được ghi nhận trong `docs/kiem-tra-hardcut-web-2026-10-08.md`; kết quả mới nhất sau sửa nằm ở mục “Retest sau bản vá” phía trên.
- Trước cleanup, đã sao lưu trạng thái thao tác tại `/var/opt/mssql/data/QLKS_after_role_acceptance_20261009.bak` trong container `web-hotel-mis-sqlserver-1433`; `BACKUP ... COPY_ONLY, CHECKSUM` và `RESTORE VERIFYONLY` thành công.
- Sau backup, đã chạy script demo data-only hiện có `database/demo/reset_demo.sql` đúng trên DB `QLKS` đã được chủ dự án cho phép reset. Kiểm tra sau reset: 10 nhân viên, 64 phòng, 6 booking, 2 đơn dịch vụ; Flyway V6 success và migration mới nhất là `6/triggers`; marker stock/shift/work-order/incident test đều 0; `DBCC CHECKCONSTRAINTS` không báo vi phạm. Không sửa schema, checksum hoặc lịch sử Flyway.
- Không gửi email/OTP, không chạy gateway thanh toán thật. Trong lượt này không tạo booking mới, thu/hoàn tiền, duyệt giá, cấp credential hoặc thực hiện thao tác có thể gây hậu quả ngoài phạm vi demo. Các phần đó còn thiếu bằng chứng nghiệm thu mới.

## Quyết định

Đóng lỗi P1 HOUSEKEEPING→READY: bản vá và retest trên UI thật, service/SQL Server cùng regression đều đạt; test manager xác nhận luồng nghiệm thu hợp lệ vẫn hoạt động khi đủ điều kiện. **Không ký nghiệm thu toàn bộ ứng dụng** vì còn các phạm vi chưa được thao tác/chứng minh lại như luồng đặt phòng online đầy đủ, đổi/hủy/gia hạn, toàn bộ nhóm dịch vụ, bàn giao két hợp lệ, hoàn tiền qua UI, kích hoạt giá, import vân tay, mọi luồng in/export và một số chức năng ADMIN/TECHNICAL. Không gửi email/OTP hoặc gọi cổng thanh toán thật. Kết quả hiện tại là nghiệm thu có điều kiện theo từng mục đã có bằng chứng, không phải chứng nhận mọi chức năng của web.

## Rà soát F1–F4 và quyết định VIP mới — 09/10/2026

### Kết quả kiểm tra bản sửa được bàn giao

| Mục | Kết quả và sửa bổ sung |
|---|---|
| F1 — nhãn chấm công | Bản sửa đúng: bảng và chi tiết chấm công dùng “Giờ vào/Giờ ra”. 5 test HR pass, gồm regression loại bỏ nhãn nhận/trả phòng. |
| F2 — polling VNPay | Bản sửa ban đầu chỉ dựa vào expiry từ server nên chưa đủ. Đã thêm trần 120 giây không bị gia hạn bởi response mới; dừng ở expiry sớm hơn của giao dịch/giữ phòng, terminal status hoặc mất đăng nhập; không chồng request chậm, hủy khi unmount. Giữ kiểm tra lại thủ công và thông báo hết thời gian chờ. 16 test trang kết quả pass bằng fake timers, gồm API liên tục lỗi, request chậm, expiry thay đổi và đặt cọc đã PAID. |
| F3 — phân trang kế toán | Bản sửa ban đầu vẫn tải hàng loạt rồi chia trang local. Đã thay bằng SQL Server OFFSET/FETCH, size 10 khi xem; tìm kiếm literal và lọc phương thức trước phân trang, metadata/counts từ server, booking/service projection không phụ thuộc 100 hóa đơn đầu. Chỉ tải các trang size 100 khi người dùng yêu cầu CSV; không tải file thiếu trang. KPI dùng aggregate server thay vì dữ liệu của trang. 8 test Accounting và 9 test API pass; SQL/HTTP test có 150 hóa đơn/giao dịch xác nhận trang cuối, liên kết booking, tìm kiếm ngoài trang, literal injection không mở rộng kết quả và STAFF bị 403. |
| F4 — VIP | Source được bàn giao đã bỏ min/max toàn booking, nhưng fixture regression sai thời điểm check-in và QLKS vẫn chạy procedure cũ. Sau đó chủ dự án đổi nghiệp vụ: **combo ngày-đêm (PACKAGE / Theo gói) checkout hoàn tất tính 1 lượt; HOURLY không tính dù 24/48/72 giờ**. V5 hiện xét hình thức thuê, không còn ngưỡng 24 giờ. Một đêm chuẩn 14:00→12:00 ngày sau là 22 giờ. Đã cập nhật customer-policy.md, rule.md và các test cũ có kỳ vọng trái quy tắc mới. |

### Bằng chứng tự động hiện hành

- `mvn -f backend/pom.xml -Ddebug=false -Dlogging.level.root=WARN clean package`: **2.253 tests, 94 XML reports, 0 failure/error/skip**, BUILD SUCCESS lúc 13:03:43 ngày 09/10/2026. DB integration dùng riêng `QLKS_F1_F4_REVIEW_20261009`, không dùng QLKS.
- Trước gate đầy đủ, 32 test SQL/HTTP của ReservationServiceSqlTest, BillingP0CorrectnessTest, SqlServerCheckoutConcurrencyTest, CrossShiftReservationWorkflowTest và SqlServerPaymentReportingTest đã pass. Test VIP xác nhận combo 22 giờ cộng 1, thuê giờ 3/22/24/48/72 giờ cộng 0; nhiều phòng/nhiều đêm và checkout replay/concurrent không cộng trùng; đến muộn/trả sớm không đổi sản phẩm; combo thứ 10 lên Bạc; không cộng khi mới đặt/check-in hoặc no-show.
- `npm test`: **29 files / 189 tests pass** trên source cuối cùng. `npm run build`: PASS; vẫn có cảnh báo bundle JS 1.109,62 kB >500 kB. Một số test không liên quan còn log request chưa mock đến backend đang dừng và cảnh báo React act; không tuyên bố mọi warning đã được xử lý.
- DB test chạy Flyway sạch V1–V6, V5 checksum **940376418**. Sau gate, dùng script data-only `database/demo/reset_demo.sql` hiện có để chuẩn bị demo trên DB test: 10 nhân viên, 64 phòng, 6 booking, 10 trigger enabled; DBCC CHECKCONSTRAINTS không báo vi phạm. DB test được giữ lại để tiếp tục kiểm tra runtime; không thêm migration hay SQL object/helper file.
- MailConfigurationTest PASS; hai dòng SMTP owner-managed không bị sửa.

### Triển khai QLKS, chẩn đoán Maven và browser retest — 09/10/2026

- Log `mvn spring-boot:run` cho thấy Java 24 và Maven đã build project thành công; ứng dụng mở kết nối tới SQL Server và database `QLKS`. Lỗi xảy ra ở Flyway validation: V5 đã lưu trong QLKS có checksum `1521148759`, còn file V5 hiện tại có checksum `940376418`. Flyway từ chối khởi động đúng như cấu hình.
- Trước khi dựng lại QLKS, backup COPY_ONLY/CHECKSUM tại `/var/opt/mssql/data/QLKS_before_f1_f4_review_20261009_4bdde0b1.bak` được `RESTORE VERIFYONLY` xác nhận hợp lệ.
- Theo quyền chủ dự án đã cấp, đã dựng sạch đúng database demo `QLKS`, giữ collation `SQL_Latin1_General_CP1_CI_AS`, cho JAR mới chạy Flyway V1–V6. Cả 6 migration success; checksum V5 trong QLKS là `940376418`. Không chạy `repair`, không sửa lịch sử Flyway và không tạo migration khác.
- Sau migration, dùng đúng `database/demo/reset_demo.sql` hiện có. Trạng thái cuối QLKS: 10 nhân viên, 64 phòng, 6 booking, 2 service booking, 4 housekeeping task, 4 payment seed; 10 trigger bật; không còn marker fixture `F1F4-PAGE-*`; `DBCC CHECKCONSTRAINTS` không có vi phạm. Endpoint health trả `UP`; backend mới chạy PID 29620 trên cổng 8080.
- Browser thật tại `http://localhost:5173/`, tài khoản HR demo: bảng chấm công hiển thị cột **Giờ vào/Giờ ra** và dữ liệu vào/ra nhân viên đúng; không sửa/chấm công dữ liệu.
- Browser thật, vai trò kế toán: khi có 112 giao dịch trong ngày, sổ hiển thị `112 giao dịch`, cho tới trang `12`, trang cuối hiện `PAY-5` và `PAY-2` (`Hiển thị 111–112 trên 112 giao dịch`). Tìm mã tham chiếu `F1F4-PAGE-001` trả đúng một bản ghi; tab Thẻ hiển thị 55 kết quả qua nhiều trang. Việc tạo 111 giao dịch fixture chỉ dùng để chứng minh trang web; sau đó chạy lại script reset data-only. Xác minh cuối không còn marker fixture và dữ liệu QLKS trở về baseline.
- Lúc xử lý lỗi Maven, đã kiểm tra log, checksum và Flyway, không chạy repair. Vì V5 thay đổi trực tiếp trong lịch sử migration, chỉ dựng lại database QLKS đã được chủ dự án cho phép.

Kết luận riêng lượt này: F1–F4 đã qua gate source/test; sửa Maven được xác nhận bằng nguyên nhân trong log, triển khai sạch V1–V6 trên QLKS và browser retest HR/kế toán đã hoàn tất. Điều này **không thay đổi kết luận ở phần “Quyết định” phía trên**: các luồng ứng dụng ngoài phạm vi này còn thiếu bằng chứng và chưa ký nghiệm thu toàn hệ thống.
