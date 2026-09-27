# Dựng lại cơ sở dữ liệu minh họa

Chỉ chạy các tập lệnh này theo cách thủ công. Ứng dụng không được xóa hoặc nạp
dữ liệu vào cơ sở dữ liệu khi khởi động.

## Dựng cấu trúc cơ sở dữ liệu sạch

1. Tạo một cơ sở dữ liệu SQL Server 2022 rỗng.

```sql
CREATE DATABASE [QLKS] COLLATE Vietnamese_100_CI_AI;
```

2. Chạy máy chủ ứng dụng với Flyway được bật và Hibernate ở chế độ kiểm tra cấu trúc.

```powershell
$env:DB_URL="jdbc:sqlserver://localhost:1433;databaseName=QLKS;encrypt=true;trustServerCertificate=true"
$env:DB_USERNAME="sa"
$env:DB_PASSWORD="<mat-khau-sa>"
cd backend
mvn spring-boot:run
```

Cấu hình cần có:

```yaml
spring:
  flyway:
    enabled: true
  jpa:
    hibernate:
      ddl-auto: validate
```

Không dùng `ddl-auto=create`, `ddl-auto=update` hoặc tập lệnh khởi động có thao
tác xóa lược đồ.

## Dựng lại dữ liệu minh họa (thao tác xóa dữ liệu)

`reset_demo.sql` xóa trực tiếp rồi nạp lại dữ liệu vào nhiều bảng nghiệp vụ.
Chạy trực tiếp tệp SQL sẽ bỏ qua bước kiểm tra trước bằng PowerShell ở dưới.
Chỉ chạy lệnh trực tiếp trên lược đồ cục bộ đã biết là rỗng và có thể hủy; tuyệt
đối không chạy trên cơ sở dữ liệu dùng chung, chứa dữ liệu cần giữ hoặc đang vận
hành thật. Khi thiết lập cục bộ thông thường, hãy dùng tập lệnh có bước bảo vệ.

Sau khi Flyway đã cập nhật lược đồ, chạy:

```powershell
docker cp database/demo/reset_demo.sql web-hotel-mis-sqlserver-1433:/tmp/reset_demo.sql
docker exec web-hotel-mis-sqlserver-1433 /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "$env:MSSQL_SA_PASSWORD" -C -d QLKS -b -I -i /tmp/reset_demo.sql
```

Dùng `docker cp` rồi `sqlcmd -i`; không chuyển đầu ra của `Get-Content` qua pipe
vào `sqlcmd` trong Windows PowerShell vì BOM/mã hóa có thể làm hỏng ký tự Unicode.

`reset_demo.sql` xóa và nạp lại đầy đủ dữ liệu minh họa: phòng, khách lưu trú,
dịch vụ, phiếu đặt phòng, phiếu giữ phòng theo giờ, hóa đơn, giao dịch thanh
toán, biên lai, công việc buồng phòng/kỹ thuật, kho, tài chính, lượt đặt dịch
vụ do khách sạn cung cấp, công nợ nhà cung cấp và yêu cầu phê duyệt đang chờ.
Tệp cũng tạo một phiếu đặt phòng qua đêm trong tương lai ở trạng thái
`DEPOSIT_PAID` để kiểm tra việc đặt dịch vụ trước. Ngày được tính từ
`CAST(SYSDATETIME() AS date)` để dữ liệu vẫn dùng được khi dựng lại bản minh họa vào thời điểm khác.

Khi khởi chạy cục bộ thông thường, dùng tập lệnh có bước bảo vệ dưới đây. Tập
lệnh kiểm tra mọi bảng dữ liệu trong lược đồ đích, chỉ bỏ qua bảng lịch sử
migration của Flyway. Tập lệnh nhận diện 64 dòng cố định trong
`NhomKhoaChongTrung` là dữ liệu hạ tầng khởi tạo lược đồ, chỉ nạp dữ liệu khi
các bảng nghiệp vụ đang rỗng, không đụng vào cơ sở dữ liệu minh họa đã có dữ
liệu và từ chối dựng lại cơ sở dữ liệu mới chỉ có một phần dữ liệu:

```powershell
docker compose up -d
# Khởi chạy máy chủ một lần để Flyway tạo/cập nhật QLKS, sau đó dừng máy chủ và
# mọi tiến trình khác đang ghi vào cơ sở dữ liệu trước khi chạy tập lệnh dựng lại:
.\database\demo\ensure_demo_data.ps1
```

Tệp Compose luôn dùng vùng lưu trữ Docker bền vững
`web-hotel-mis_hotel-sqlserver` trên cổng SQL Server `1433`. Lệnh `docker compose down -v`
không xóa được vùng lưu trữ bên ngoài này; vì vậy khởi động lại vùng chứa không
đồng nghĩa với chuyển sang một cơ sở dữ liệu rỗng khác.

Thông tin đăng nhập minh họa do tập lệnh tạo:

- Khách hàng: `0901234567 / hotel123`
- Nhân viên: `FRONTDESK`, `HOUSEKEEP`, `TECHNICAL`, `ACCOUNTING`, `KITCHEN`,
  `MANAGER`, `DIRECTOR`, `ADMIN`, `HR`, `STAFF` — tất cả dùng `hotel123`.

SQL chỉ lưu giá trị băm BCrypt, không lưu mật khẩu dạng văn bản thuần.

## Khởi tạo tài khoản quản trị

Tạo tài khoản đăng nhập nhân viên thông qua luồng khởi tạo quản trị/bảo mật của
môi trường đích. Nếu được duyệt cách khởi tạo khẩn cấp bằng SQL, chỉ truyền giá
trị băm BCrypt lấy từ bí mật môi trường vào lệnh dùng một lần; không ghi mật
khẩu dạng văn bản thuần vào tệp SQL.

Ví dụ với giá trị băm tạo sẵn được lưu trong `DEMO_ADMIN_BCRYPT_HASH`:

```powershell
if ($env:DEMO_ADMIN_BCRYPT_HASH -notmatch '^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$') {
  throw "DEMO_ADMIN_BCRYPT_HASH phải là giá trị băm BCrypt"
}

sqlcmd -S localhost -U sa -P $env:MSSQL_SA_PASSWORD -C -d QLKS -Q "
IF EXISTS (SELECT 1 FROM NhanVien WHERE maNhanVien=N'NV_ADMIN')
  UPDATE NhanVien SET matKhau=N'$env:DEMO_ADMIN_BCRYPT_HASH', vaiTro=N'Quản lý' WHERE maNhanVien=N'NV_ADMIN';
ELSE
  INSERT INTO NhanVien (maNhanVien, hoVaTen, matKhau, vaiTro, soDienThoai)
  VALUES (N'NV_ADMIN', N'Demo Admin', N'$env:DEMO_ADMIN_BCRYPT_HASH', N'Quản lý', N'0900000000');"
```
