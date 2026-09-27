# Kế hoạch chuyển đổi QLKS từ MySQL sang Microsoft SQL Server

> **Trạng thái thực hiện (25/09/2026): Đã hoàn tất các gate kỹ thuật và cutover.** Ứng dụng
> mặc định dùng SQL Server; Flyway chỉ có một baseline V1 cho demo, reset/fixture, CI, audit tools và
> live-E2E guard đã được chuyển sang SQL Server. Backend full test, frontend
> build/test, migration thật, seed và các audit SQL Server đều đã đạt. Compose
> chỉ còn SQL Server; service và volume MySQL đã được gỡ sau nghiệm thu.

## 1. Mục tiêu

Chuyển backend hiện tại từ MySQL 8.4 sang Microsoft SQL Server mà không thay
đổi hợp đồng REST, JSON, mã Java/API, kiểu TypeScript, quy tắc nghiệp vụ hoặc dữ
liệu minh họa người dùng nhìn thấy.

Database hiện tại là database demo có thể dựng lại. SQL Server mới được dựng từ
duy nhất baseline Flyway V1; mọi sửa schema demo được gộp trực tiếp vào V1 và
database local được tạo lại, không tạo V2/V3 và không chuyển dữ liệu production.

Không thể cam kết không bao giờ có lỗi chỉ bằng việc sửa cú pháp. Mức an toàn
được bảo đảm bằng các gate độc lập: schema metadata, Hibernate validation, test
chức năng, test concurrency trên SQL Server thật, seed/audit và live E2E.

## 2. Baseline trước chuyển đổi (đã đóng)

- Backend là Spring Boot 3.4.5, Hibernate 6.6.13.Final, Flyway 10.20.1.
- MySQL connector trước chuyển đổi là 9.1.0; H2 test là 2.3.232.
- Flyway V1 là baseline schema demo duy nhất và đã chứa trực tiếp bản sửa
  constraint mã ca cho SQL Server; `ddl-auto` là `validate` ở runtime.
- Schema đích hiện tại có 51 bảng nghiệp vụ, 459 cột, 51 khóa ngoại, 25 quy tắc
  unique và 121 check constraint.
- V1 có 40 cột `AUTO_INCREMENT`, 51 khai báo InnoDB/charset, 23
  `DATETIME(6)`, 18 `BOOLEAN`, 5 `TEXT` và các cột `LONGTEXT`.
- Có 57 cột từ điển nghiệp vụ yêu cầu so sánh phân biệt dấu và chữ hoa.
- Có 3 service dùng `JdbcTemplate`, 3 repository có native query và một adapter
  dùng `EntityManager.createNativeQuery`.
- Các cú pháp phụ thuộc MySQL trong runtime gồm `ON DUPLICATE KEY`,
  `LAST_INSERT_ID()`, `FOR UPDATE`, boolean literal và `GREATEST`.
- Trước chuyển đổi có 13 lớp test mang tên MySQL; 32 chỗ H2 chạy `MODE=MySQL`.
- `MySqlMigrationTest` cũ đọc metadata bằng cú pháp MySQL (`database()`,
  `information_schema.statistics`) và gọi `last_insert_id()`.
- Demo seed dùng `FOREIGN_KEY_CHECKS`, `INSERT IGNORE`, `AUTO_INCREMENT`,
  `NOW(6)`, `DATE_ADD`, `CURDATE`, `TIMESTAMP`, `LIMIT`, `UNSIGNED`,
  `ON DUPLICATE KEY`, procedure/`DELIMITER` và `SIGNAL SQLSTATE`.
- Các công cụ audit/BCNF/column-ledger gọi trực tiếp MySQL CLI và metadata MySQL.
- Frontend không truy cập database trực tiếp; phần cần đổi là live-E2E guard,
  tên biến môi trường và tài liệu vận hành.

Baseline lịch sử tại thời điểm lập kế hoạch:

- Backend: 2.107 test, 0 fail, 0 error, 36 skip.
- Frontend: 123 test, 0 fail.
- Frontend production build: thành công.
- Các test SQL thật đang skip khi không có `MIGRATION_TEST_DB_URL`; đây không
  được xem là bằng chứng SQL Server.

Worktree hiện có 128 file modified, 85 file deleted và 25 file untracked do đợt
Việt hóa/tái cấu trúc. Bắt buộc tạo checkpoint có thể quay lại trước khi sửa.

## 3. Quyết định kiến trúc đích

1. Dùng SQL Server 2022 Developer cho local/CI, database `QLKS`, schema `dbo`.
2. Chạy SQL Server ở cổng 1433 song song với MySQL 3307 trong suốt chuyển đổi.
3. Giữ nguyên tên bảng/cột tiếng Việt không dấu và tất cả JPA mapping hiện tại.
4. Dùng Unicode end-to-end:
   - Chuỗi JPA dùng nationalized character support.
   - Cột chuỗi nghiệp vụ dùng `NVARCHAR`; chuỗi cố định dùng `NCHAR` khi phù hợp.
   - LOB chuỗi dùng `NVARCHAR(MAX)`.
   - Literal tiếng Việt trong T-SQL dùng tiền tố `N`, ví dụ `N'Đã xác nhận'`.
5. Database collation mặc định dự kiến `Vietnamese_100_CI_AI`; 57 cột từ điển
   dùng explicit `Vietnamese_100_CS_AS`. Trước khi chốt phải kiểm tra hai
   collation này có trên image đích và chạy test sai dấu/sai hoa.
6. `LocalDate` dùng `date`; `LocalTime` dùng `time`; `LocalDateTime` dùng
   `datetime2(6)`; thuộc tính `Instant` phải được thử với SQL Server dialect và
   chốt `datetimeoffset(6)` hoặc mapping UTC tương đương trước khi viết V1.
7. Không giữ compatibility layer MySQL và SQL Server lâu dài. Chỉ giữ MySQL như
   đường rollback tạm thời cho tới khi nghiệm thu.
8. Không dùng `sa` cho ứng dụng ngoài local bootstrap. Tạo login/user ứng dụng
   có quyền DML và tài khoản migration có quyền DDL phù hợp.

## 4. Ma trận chuyển đổi schema

| MySQL hiện tại | SQL Server đích |
|---|---|
| `BIGINT AUTO_INCREMENT` | `BIGINT IDENTITY(1,1)` |
| `BOOLEAN`, `TRUE`, `FALSE` | `BIT`, `1`, `0` |
| `DATETIME(6)` / `DATETIME` | `DATETIME2(6)` theo mapping thời gian |
| `VARCHAR(n)` | `NVARCHAR(n)` |
| `CHAR(n)` | `NCHAR(n)` hoặc `CHAR(n)` nếu được chứng minh chỉ ASCII |
| `TEXT`, `LONGTEXT` | `NVARCHAR(MAX)` |
| `ENGINE=InnoDB`, `CHARSET=utf8mb4` | bỏ |
| `utf8mb4_0900_as_cs` | `Vietnamese_100_CS_AS` sau khi test |
| `CURRENT_TIMESTAMP` | default được chốt theo hợp đồng UTC/local |
| `REGEXP` | `LIKE`/`PATINDEX` với binary/case-sensitive collation |
| `LIMIT 1` | `TOP (1)` |
| `DATE_ADD/DATE_SUB` | `DATEADD` |
| `CURDATE()` | `CAST(SYSDATETIME() AS date)` theo timezone đã chốt |
| `CAST(... AS UNSIGNED)` | `TRY_CONVERT(int, ...)` |
| `LAST_INSERT_ID()` | `OUTPUT INSERTED.<id>`/`KeyHolder` |
| `ON DUPLICATE KEY UPDATE` | transaction update/insert có lock và unique guard |
| `SELECT ... FOR UPDATE` | JPA pessimistic lock hoặc `WITH (UPDLOCK, HOLDLOCK)` |

V1 SQL Server phải mô tả trực tiếp hình dạng cuối. Không bê nguyên chuỗi thao tác
MySQL đang tạo cột rồi `DROP COLUMN`, tạo check rồi drop/add lại, hay `MODIFY
COLUMN` ở cuối file.

### Unique nullable

SQL Server coi hai `NULL` là trùng trong unique index/constraint, khác MySQL.
Các cột nullable sau phải dùng filtered unique index `WHERE column IS NOT NULL`:

- `KhachLuuTru.email`.
- `PhieuDatPhong.khoaChongTrung`.
- `PhieuDatPhong.maThanhToanDatCoc`.
- `GiaoDichThanhToan.khoaChongTrung`.
- `GiaoDichThanhToan.maSuKienBenNgoai`.

Gate metadata phải đếm 25 quy tắc uniqueness theo nghĩa nghiệp vụ, gồm unique
constraint và filtered unique index, thay vì đòi cả 25 đều là constraint.

### Khóa ngoại và cascade

Giữ đúng 51 FK và ý nghĩa 8 `ON DELETE CASCADE`, nhưng tạo thử toàn bộ schema để
bắt lỗi SQL Server multiple cascade paths. Nếu có đường cascade kép, ưu tiên
`NO ACTION` và xóa dependent rõ ràng trong service; không dùng trigger nếu chưa
có test chứng minh hành vi.

## 5. Kế hoạch triển khai theo giai đoạn

### Giai đoạn 0 — Đóng băng baseline và tạo đường lui

1. Chốt/commit toàn bộ đợt Việt hóa hiện tại trên một nhánh riêng; không trộn
   migration SQL Server với 238 trạng thái file chưa sạch hiện nay.
2. Ghi SHA checkpoint, kết quả test, schema counts và checksum V1.
3. Dựng một database MySQL disposable và chạy lại toàn bộ `*MySql*Test` cùng
   live E2E để có baseline thực, không chỉ H2.
4. Giữ nguyên volume/container MySQL cho tới sau nghiệm thu cuối.

Gate: worktree migration sạch; backend, frontend, MySQL integration và live E2E
đều xanh tại checkpoint.

### Giai đoạn 1 — Hạ tầng SQL Server tối thiểu

1. Thêm SQL Server 2022 Developer vào Compose với volume riêng và healthcheck.
2. Thêm bootstrap tạo `QLKS`, schema `dbo`, collation và user ứng dụng.
3. Pin image/tag đã kiểm thử thay vì phụ thuộc lâu dài vào `latest`.
4. Thêm `.env.example`; không commit mật khẩu thật.
5. Xác minh SQL Server chấp nhận tiếng Việt, collation và precision thời gian.

Gate: container healthy; kết nối được bằng user ứng dụng; round-trip chuỗi có
dấu và thời gian đạt.

### Giai đoạn 2 — Driver, Flyway và cấu hình Spring

1. Trong `backend/pom.xml`:
   - bỏ `mysql-connector-j` và `flyway-mysql`;
   - thêm `com.microsoft.sqlserver:mssql-jdbc` runtime;
   - thêm `org.flywaydb:flyway-sqlserver`, để Spring Boot BOM quản lý version.
2. Đổi JDBC URL local/runtime/test sang `jdbc:sqlserver://...;databaseName=QLKS`.
3. Local dùng certificate setting phù hợp môi trường; không biến
   `trustServerCertificate=true` thành mặc định production.
4. Bật `hibernate.use_nationalized_character_data=true` nếu chọn toàn bộ
   `NVARCHAR`; xác nhận bằng `ddl-auto=validate` trên schema thật.
5. Giữ `PhysicalNamingStrategyStandardImpl`, `open-in-view=false` và
   `ddl-auto=validate`.

Gate: dependency tree không còn MySQL runtime; ứng dụng kết nối SQL Server; chưa
được tắt validation để né mismatch.

### Giai đoạn 3 — Viết lại Flyway V1 cho T-SQL

1. Chuyển 51 table definition sang T-SQL theo hình dạng cuối.
2. Chuyển 40 identity, toàn bộ kiểu chuỗi/thời gian/boolean/LOB và default.
3. Prefix `N` cho mọi literal tiếng Việt trong default/check/seed.
4. Đặt collation mặc định và explicit collation cho 57 cột từ điển ngay trong
   định nghĩa cột; bỏ 56 lệnh MySQL `MODIFY COLUMN` cuối file.
5. Tạo 25 quy tắc unique, trong đó 5 nullable dùng filtered unique indexes.
6. Port 121 check constraints; thay hai check `REGEXP` cho mã ca bằng biểu thức
   `PATINDEX`/`LIKE` đã test với ASCII collation.
7. Tạo 51 FK và toàn bộ index, kiểm tra key width sau khi đổi sang `NVARCHAR`.
8. Không dùng `GO` nếu script cần chạy ở ngữ cảnh Flyway transaction mà không
   cần batch boundary; nếu dùng phải kiểm thử bằng chính Flyway.

Gate:

- Flyway migrate từ database rỗng thành công hai lần trên hai database mới.
- Flyway validate sạch, chỉ có version 1, không pending.
- Metadata có 51 bảng, 459 cột, 51 FK, 25 logical unique và 121 check.
- Không constraint/index nào disabled hoặc `is_not_trusted=1`.
- Hibernate `ddl-auto=validate` khởi động thành công.

### Giai đoạn 4 — Đồng bộ JPA mapping và kiểu dữ liệu

1. Bỏ các `columnDefinition="TEXT"`, `LONGTEXT` phụ thuộc vendor trong:
   `ApprovalRequest`, `AuditLog`, `IdempotencyRecord`, `NotificationOutbox`.
2. Chuẩn hóa `@Lob`/`@Nationalized` hoặc mapping `LONGNVARCHAR` để Hibernate và
   V1 cùng nhìn thấy `NVARCHAR(MAX)`.
3. Rà toàn bộ `Instant`, `LocalDateTime`, `LocalDate`, `LocalTime` bằng metadata
   thực; đặc biệt refresh token, audit và approval timestamps.
4. Giữ nguyên converter tiếng Việt và mã JSON/API; không dịch lại enum Java.
5. Kiểm tra precision/scale của tất cả trường tiền và VAT.

Gate: schema validation không warning/mismatch; CRUD round-trip đủ Unicode,
null, max length, decimal và thời gian.

### Giai đoạn 5 — Loại bỏ SQL MySQL trong runtime

Các điểm phải xử lý và proof tương ứng:

| Khu vực | Thay đổi bắt buộc | Proof |
|---|---|---|
| `IdempotencyRecordRepository` | bỏ `ON DUPLICATE KEY`; dùng lock bucket JPA hiện có hoặc atomic SQL Server claim | hai request cùng key chỉ chạy command một lần; replay đúng |
| `EnterpriseExtensionService` | `OUTPUT INSERTED`/`KeyHolder`, thay attendance upsert, boolean literal và `FOR UPDATE` | VAT/leave trả đúng ID; attendance idempotent; kho không âm |
| `HotelServiceBookingService` | thay ba `FOR UPDATE`, boolean literal | không double-use dịch vụ, không oversell tồn kho |
| `AmenityRepository` | boolean thành parameter/JPQL hoặc `= 1` | catalog active đúng |
| `JpaReservationOverlapAdapter` | giữ SQL chuẩn nhưng chuyển literal Unicode và metadata type | không overbooking |
| `PaymentTransactionRepository` | kiểm tra native aggregate với Unicode/collation | tổng tiền mặt/refund đúng |

Ưu tiên JPA pessimistic lock cho các aggregate đã có repository. Chỉ dùng table
hint SQL Server ở các luồng `JdbcTemplate` không thể chuyển hợp lý; lock order
phải cố định để tránh deadlock.

Idempotency là workstream rủi ro cao nhất. Phương án an toàn cho dự án này là
dùng 64 dòng `NhomKhoaChongTrung` và `IdempotencyLockBucketRepository` để khóa
bucket bằng JPA trước khi find/create record, sau đó khóa record và chạy command
trong cùng transaction. Phải cập nhật comment hiện tại và test collision giữa
hai key khác nhau cùng bucket.

Gate: không còn `LAST_INSERT_ID`, `ON DUPLICATE KEY`, `FOR UPDATE`, `REGEXP`,
`TRUE/FALSE` trong native SQL runtime; concurrency suite SQL Server xanh lặp lại.

### Giai đoạn 6 — Chuyển seed và fixture

1. Viết lại `reset_demo.sql` bằng T-SQL với `SET XACT_ABORT ON`, `TRY/CATCH` và
   transaction.
2. Giữ delete theo thứ tự FK; tránh tắt constraint. Nếu bắt buộc `NOCHECK`, phải
   bật lại bằng `WITH CHECK CHECK` và assert toàn bộ constraint trusted.
3. Thay reset identity bằng `DBCC CHECKIDENT`; với ID cố định trong fixture dùng
   `SET IDENTITY_INSERT ... ON/OFF` cho từng bảng.
4. Thay date/time, `LIMIT`, unsigned cast, insert-ignore và upsert bằng T-SQL.
5. Viết lại `seed_live_e2e.sql`; guard phải kiểm tra `DB_NAME()` khớp
   `e2e[_]%` trước mọi mutation và fail bằng `THROW`.
6. Seed phải chạy lặp lại được và cho cùng logical dataset.

Gate: reset hai lần liên tiếp đều thành công; row counts và toàn bộ dữ liệu hiển
thị chính giữ nguyên; không orphan FK; dictionary không có giá trị lạ.

### Giai đoạn 7 — Chuyển test và công cụ chứng minh

1. Đổi 13 lớp `MySql*` thành `SqlServer*`, comment và fixture prefix tương ứng.
2. Đổi biến môi trường thành `MIGRATION_TEST_DB_URL/USERNAME/PASSWORD` trung
   tính hoặc `SQLSERVER_TEST_*`; không để guard tên MySQL.
3. Viết lại `MySqlMigrationTest` bằng `INFORMATION_SCHEMA`/`sys.*` của SQL
   Server, `SCOPE_IDENTITY`/`OUTPUT`, filtered-index metadata và collation.
4. Đổi 32 H2 URL sang `MODE=MSSQLServer` cho fast suite. H2 chỉ là test nhanh,
   không được dùng làm proof dialect/concurrency.
5. Các tool audit/generate phục vụ giai đoạn Việt hóa đã không còn là proof
   route hiện hành; xóa chúng sau khi các contract cần thiết đã được giữ trong
   V1 và bộ test SQL Server.
6. Mapping/import script lịch sử không nằm trong checkout vận hành; Git giữ
   lịch sử thay đổi khi cần tái hiện giai đoạn cũ.
7. Đổi live E2E guard `E2E_MYSQL_*` thành `E2E_SQLSERVER_*` và cập nhật hướng dẫn.

Gate:

- Fast backend suite không giảm số test và không fail.
- SQL Server integration tests thực sự chạy, không skip do thiếu env.
- Các suite dialect/concurrency SQL Server đều chạy thật; CI kiểm tra đủ 14
  report suite và không có skip.
- Frontend 123 test và production build tiếp tục xanh.
- Live E2E chạy trên database disposable SQL Server đã seed.

### Giai đoạn 8 — CI và tài liệu

1. Thay MySQL service trong `.github/workflows/ci.yml` bằng SQL Server image.
2. Chờ readiness bằng `sqlcmd`, tạo database sạch, chạy Maven với biến kết nối.
3. Fail CI nếu SQL Server tests bị skip ngoài danh sách skip cho phép.
4. Tách fast tests và SQL Server integration nếu cần thời gian, nhưng cả hai là
   required checks.
5. Cập nhật root/backend/frontend/e2e README, architecture, migration policy
   và các lệnh vận hành; báo cáo Việt hóa lịch sử không nằm trong checkout.
6. Quét repository: không còn MySQL runtime URL, dependency, container, test
   class hay tài liệu vận hành đang được dùng. Từ “MySQL” chỉ được phép còn trong
   lịch sử/biên bản migration đã ghi rõ là legacy.

Gate: CI chạy lại từ checkout sạch và database rỗng; không dựa vào máy local.

### Giai đoạn 9 — Nghiệm thu và cutover

1. Chạy full backend + SQL Server integration + frontend + live E2E.
2. Chạy các kịch bản thủ công: đăng nhập nhân viên/khách, OTP, đặt phòng, chống
   overbooking, nhận/trả/chuyển phòng, dịch vụ, tồn kho, hóa đơn, payment/refund,
   biên lai, giao ca, approval, audit, buồng phòng, kỹ thuật, HR và kế toán.
3. So sánh API response quan trọng trước/sau; endpoint, field, enum code và status
   HTTP phải không đổi.
4. Chạy concurrency mỗi kịch bản nhiều vòng để bắt deadlock/race không ổn định.
5. Chuyển default `DB_URL` sang SQL Server. Sau nghiệm thu, Compose chỉ còn
   SQL Server và một volume demo; không còn rollback database trong môi trường
   demo.

Sau cutover, mọi ghi mới đều đi vào SQL Server. Database demo `QLKS` có thể
được dựng lại từ baseline V1 khi cần; không có đồng bộ hai chiều với MySQL.

## 6. Thứ tự commit đề xuất

1. `chore: checkpoint vietnamized mysql baseline`
2. `infra: add isolated sql server development service`
3. `build: replace mysql jdbc and flyway modules`
4. `db: port canonical v1 schema to sql server`
5. `persistence: align unicode lob and temporal mappings`
6. `persistence: replace mysql native sql and locking semantics`
7. `db: port demo and e2e fixtures to t-sql`
8. `test: replace mysql dialect proofs with sql server proofs`
9. `ci: run required sql server integration suite`
10. `docs: document sql server operation and migration closeout`

Mỗi commit chỉ được nhập khi gate của nó xanh. Không gom schema, runtime SQL,
seed và test vào một commit lớn vì sẽ mất khả năng khoanh vùng regression.

## 7. Rủi ro ưu tiên

| Mức | Rủi ro | Cách chặn |
|---|---|---|
| Rất cao | idempotency claim thay đổi semantics | lock-order design + real concurrency tests |
| Rất cao | overbooking/oversell vì khác row locking | SQL Server concurrent acceptance tests |
| Cao | mất dấu hoặc so sánh sai dấu/hoa | NVARCHAR, `N''`, explicit collation, negative tests |
| Cao | unique nullable chặn bản ghi NULL thứ hai | filtered unique indexes |
| Cao | `Instant`/hotel local time bị lệch 7 giờ | temporal matrix + fixed-clock round-trip tests |
| Cao | Hibernate validate lệch `NVARCHAR(MAX)`/LOB | bỏ MySQL columnDefinition, validate schema thật |
| Cao | cascade path bị SQL Server từ chối | build V1 sớm, kiểm tra toàn bộ FK/cascade |
| Trung bình | seed identity/FK không chạy lặp | identity-insert/checkident + double-run test |
| Trung bình | CI xanh vì tests dialect bị skip | fail-on-unexpected-skip và required DB job |
| Trung bình | tool audit tiếp tục đo MySQL | port metadata layer trước closeout |

## 8. Definition of Done

Chỉ được tuyên bố chuyển đổi hoàn tất khi tất cả điều kiện sau đúng:

- Không còn MySQL driver/Flyway module/runtime configuration.
- SQL Server V1 dựng sạch, validate sạch và đúng 51 bảng/459 cột/51 FK/25
  logical unique/121 check.
- Hibernate `ddl-auto=validate` thành công trên SQL Server.
- 57 cột từ điển có collation exact và reject chuỗi sai dấu/sai hoa.
- Unicode tiếng Việt round-trip đúng ở entity, native SQL, seed và API.
- Không còn cú pháp MySQL trong runtime/seed/CI đang hoạt động.
- Tất cả fast tests, SQL Server integration, concurrency, frontend và live E2E
  đều chạy thật và xanh; không có skip bất ngờ.
- API contract và hành vi nghiệp vụ trước/sau không đổi.
- Tài liệu và lệnh local/CI chỉ dẫn SQL Server chính xác.
- MySQL rollback service và volume đã được gỡ có chủ đích sau nghiệm thu.

## 9. Ước lượng

Một kỹ sư làm tập trung nên dự kiến 7–10 ngày làm việc:

- 0,5–1 ngày checkpoint và hạ tầng.
- 1,5–2 ngày schema/collation/metadata.
- 1–2 ngày JPA và native SQL.
- 1–2 ngày seed, audit tools và integration tests.
- 1–2 ngày concurrency, live E2E, CI và sửa regression.
- 0,5–1 ngày tài liệu/nghiệm thu.

Không nên rút ngắn bằng cách bỏ test SQL Server thật; đó là phần chứng minh các
luồng tiền, tồn kho, idempotency và đặt phòng vẫn hoạt động như trước.
