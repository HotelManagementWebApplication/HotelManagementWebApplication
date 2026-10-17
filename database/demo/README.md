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

## Dựng lại dữ liệu minh họa hiện có

reset_demo.sql xóa và nạp lại dữ liệu nghiệp vụ cho demo. Để sửa dữ liệu đang
bị lệch sau nhiều lần thử trên máy local, mở PowerShell ở thư mục gốc repo và
chạy:

    docker compose up -d
    .\database\demo\reset_demo_data.ps1 -ResetExistingDemo

Script chỉ nhắm tới container local cố định web-hotel-mis-sqlserver-1433 và
cơ sở dữ liệu QLKS; nó kiểm tra Flyway V1–V6 cùng tài khoản demo, sao lưu rồi
xác minh backup trước khi reset, tạm chặn các kết nối ghi đồng thời, và luôn
khôi phục chế độ truy cập bình thường. Bản backup được giữ ngoài repo tại
%USERPROFILE%\.codex\backups\web-hotel-mis. Nếu reset lỗi, dữ liệu được
rollback và script vẫn giữ backup để phục hồi.

Không chạy reset_demo.sql trực tiếp trên môi trường chia sẻ hoặc production.
Script ensure_demo_data.ps1 chỉ dành cho cơ sở dữ liệu mới, chưa có dữ liệu
nghiệp vụ; nó không sửa một bộ demo đã chạy lâu.

Fixture được tính lại theo giờ Việt Nam tại lúc reset, nên các lượt đến/trả,
ca làm và ngày giao dịch không bị cũ theo thời gian. Một số kịch bản để test:

- Buồng phòng: 502 cần dọn; 602 đang dọn và còn checklist chưa xong; 701 đã dọn,
  chờ nghiệm thu; 702 chờ kỹ thuật vì sự cố điều hòa; 802 đã sẵn sàng.
- Lễ tân: phòng 501 có khách đang ở; booking 6 nhận phòng ngày mai ở phòng 1401,
  đã thu cọc 3.900.000đ và còn số dư cần thanh toán.
- Tài chính: hóa đơn và các khoản thu khớp số dư; có booking đã thanh toán,
  thanh toán một phần, cùng yêu cầu VNPay demo thành công và chờ thanh toán.

Để khởi tạo demo trên một cơ sở dữ liệu mới, đã áp dụng Flyway và chưa có dữ
liệu nghiệp vụ, dùng ensure_demo_data.ps1 như bên dưới. Lệnh này sẽ từ chối
đụng vào demo hiện có:

    docker compose up -d
    # Chạy máy chủ một lần để Flyway tạo/cập nhật QLKS, sau đó dừng máy chủ.
    .\database\demo\ensure_demo_data.ps1

Trong khi reset demo, hãy dừng backend và các tiến trình khác đang ghi vào QLKS.
Reset sẽ làm mất các phiên đăng nhập demo cũ; đăng nhập lại bằng tài khoản bên
dưới sau khi script hoàn tất.
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


## Kịch bản demo Kho & Dịch vụ và kế toán

- Vật tư, đồ vải dùng chung danh mục `DichVu` và sổ `BienDongKhoDichVu`.
  Nước `WATER330` thấp hơn ngưỡng 80; có yêu cầu cấp 24 chai, trả 3 vỏ gối
  sạch và thông báo 2 khăn hỏng. Kho phải nhập đủ hàng trước khi cấp; báo hỏng
  không cộng lại tồn.
- Giặt nhanh và tiêu chuẩn dùng chung 40 máy, thời lượng lần lượt 240/600 phút.
  Có một đơn giặt 2 món chiếm một máy; cả hai gói đọc cùng khả dụng 39 máy.
- Có sân tennis đang được dùng, đơn phòng họp giữ chỗ chờ thanh toán 10 phút,
  đơn cầu lông khách đã trả tiền rồi hủy. Các khoản đã trả có payment, receipt
  và ledger thực, được tạo bằng stored procedure nghiệp vụ.
- Giữ các trạng thái demo hiện hành của lễ tân, nhân sự, buồng phòng và kỹ thuật.
  Kế toán xem bàn giao, người nhận được chỉ định xác nhận; không đếm lại tiền.

Thời gian demo được tính theo giờ Việt Nam tại lúc reset. Khả dụng thay đổi theo
thời gian thực; đơn chờ thanh toán tự hết hiệu lực sau 10 phút.
