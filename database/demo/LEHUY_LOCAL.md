# Môi trường test riêng của Lê Huy

Database: **QLKS_LeHuy_Local**, trên SQL Server Express local cổng 1433.
Kết nối bằng Windows Authentication. Không đổi hoặc reset `QLKS` hiện tại.

Các file riêng:

- `seed_inventory.sql`: thêm 4 món ăn, 4 thức uống, 4 đồ gia dụng và 10 mặt hàng minibar theo mã chưa có;
  không xóa, cập nhật hoặc nhân đôi hàng đã có. Chạy được nhiều lần.
- `seed_lehuy_local.sql`: nạp dữ liệu demo chung và hàng mẫu riêng vào database
  `QLKS_LeHuy_Local` **rỗng**. Từ chối chạy trên database khác hoặc khi đã có dữ liệu.
- `run_lehuy_local.ps1`: chạy backend với database riêng, không tự nạp hoặc xóa dữ liệu.
- `seed_service_schedule.sql`: công suất và đơn vị tài nguyên cho 20 dịch vụ;
  bổ sung giá mẫu cho đồ dùng đang có giá 0, giữ nguyên giá đã nhập.
- `seed_service_schedule_bookings.sql`: 5 lượt đặt mẫu chỉ dành cho database riêng,
  để thử bộ lọc thời gian; không nạp trên database chung.

Từ thư mục gốc repository, sau khi Flyway đã tạo đủ bảng và backend đã dừng:

```powershell
sqlcmd -S 'tcp:localhost,1433' -E -C -d QLKS_LeHuy_Local -b -I -f 65001 -i database/demo/seed_lehuy_local.sql
```

Nếu database riêng đã có dữ liệu và chỉ cần bổ sung mặt hàng:

```powershell
sqlcmd -S 'tcp:localhost,1433' -E -C -d QLKS_LeHuy_Local -b -I -f 65001 -i database/demo/seed_inventory.sql
```

Chạy backend và frontend trong hai terminal:

```powershell
.\database\demo\run_lehuy_local.ps1
```

```powershell
cd frontend
npm.cmd run dev -- --host 127.0.0.1 --port 5173
```

Backend cần cấu hình local hiện có và Microsoft JDBC Windows Authentication
12.8.1 x64. Truyền `-JdbcAuthDirectory` nếu driver nằm ở vị trí khác. Không commit
SMTP, JWT hoặc cấu hình chứa bí mật vào các file demo này.

Truy cập http://127.0.0.1:5173. Tài khoản demo dùng mật khẩu `hotel123`:

- `KITCHEN`: Kho, Dịch vụ, nhập/xuất/điều chỉnh tồn, đề xuất giá.
- `ACCOUNTING`: thanh toán, đối soát, hóa đơn, bàn giao tiền mặt và popup mệnh giá.
- `MANAGER`, `DIRECTOR`: bước phê duyệt có phân quyền tương ứng.
- `HOUSEKEEP`: mục **Trả hàng về Kho** để gửi yêu cầu trả hàng.
- `KITCHEN`: mục **Duyệt trả kho** để kiểm đếm, duyệt hoặc từ chối hàng Buồng phòng gửi.

Kiểm tra các nhóm Món ăn / Thức uống / Đồ gia dụng trong tab Kho và nhóm dịch vụ
khách sạn ở tab Dịch vụ. Mọi thao tác ghi của ứng dụng đi qua backend. Dữ liệu
demo nội bộ không xuất hiện trong danh mục dịch vụ công khai của khách hàng.
Nhóm Minibar chứa nước suối, cola, nước ép, bia, rượu vang chai nhỏ, chocolate,
snack, kẹo, hạt điều và bánh quy. Các mã minibar dùng tiền tố `MINI`; vẫn phân
loại Món ăn / Thức uống để dùng chung bộ lọc và API hiện có.

Chỉ push/merge mã nguồn và các file demo sau khi đã kiểm tra; không đưa database
local hoặc file log vào Git. Dữ liệu test đang chạy không được chuyển sang database
chung tự động: khi merge, nhóm chỉ chạy SQL mẫu bổ sung trên môi trường đã thống nhất.

## Kiểm tra ngày 15/10/2026

- Build frontend thành công; 19 tests giao diện Kho/Dịch vụ, kế toán và popup qua.
- 37 tests backend SQL Server qua: danh mục/đơn vị, kho, đề xuất giá và tài chính.
- File SQL bổ sung chạy lặp không tạo bản ghi trùng.
- Đăng nhập thật qua Vite bằng `KITCHEN` và `ACCOUNTING` thành công; API danh mục,
  thanh toán, đối soát, số dư và người nhận bàn giao trả thành công.

Đây là phạm vi kiểm tra tự động và API đã chạy. Có thể tiếp tục kiểm tra thủ công
toàn bộ thao tác trên môi trường riêng này trước khi commit và push.

## Luồng trả kho bổ sung

Xem [stock-return-workflow.md](../../docs/stock-return-workflow.md) để biết API,
phân quyền và các trạng thái. Popup Kho chỉ còn Nhập kho / Xuất kho / Hao hụt;
phòng nhận chỉ hiện khi chọn Xuất kho.

Môi trường chạy dùng baseline mới có bảng yêu cầu trả hàng. Database test trước
khi thêm luồng này đã được giữ lại dưới tên
`QLKS_LeHuy_BeforeReturns_20261015`; `QLKS` ban đầu không bị đổi.

Đã chạy 8 tests SQL cho trả kho (bao gồm duyệt đồng thời, không tự duyệt,
rollback), 7 tests kho hiện có và 31 tests giao diện Kho/Buồng phòng/Trả kho.
Thử API thật: yêu cầu TK-12 trả 2 ly, duyệt và replay làm tồn HHGLASS tăng
96 → 98 đúng một lần; yêu cầu TK-13 bị từ chối và tồn giữ nguyên. Các bản ghi
này nằm trong database demo riêng, có thể xem ở bộ lọc Đã duyệt / Từ chối.

## Khả dụng theo lịch và giá Kho

Chi tiết quy tắc: [service-availability.md](../../docs/service-availability.md).
Tab Dịch vụ có Từ thời điểm / Đến thời điểm. Đơn vị tính giá giữ riêng với đơn vị
khả dụng: giá sân theo giờ nhưng còn trống tính bằng sân, phòng họp theo ngày
nhưng còn trống tính bằng phòng, tour/nhà hàng theo suất. Không lấy số giờ/ngày
để gắn nhãn thành số tài nguyên.

Database trước khi bổ sung lịch đã được giữ nguyên dưới tên
`QLKS_LeHuy_BeforeSchedule_20261015` (bao gồm TK-12/TK-13 kể trên). Database đang
chạy là bản demo mới, có cấu hình lịch và 5 lượt đặt mẫu. Chọn ngày nạp dữ liệu,
10:00–11:00 để xem cầu lông còn 1 sân, phòng Executive hết chỗ, tour còn 16 suất
và massage còn 4 suất. Đây là công suất mẫu, cần thống nhất số thực trước khi
dùng chung. Giá mẫu của toàn bộ 30 mặt hàng trong Kho đều hiển thị theo đơn vị.

## Đề xuất danh mục

Xem [catalog-proposals.md](../../docs/catalog-proposals.md). Bản demo trước khi
thêm luồng đề xuất được giữ lại nguyên trạng trong
`QLKS_LeHuy_BeforeProposals_20261015`. `QLKS_LeHuy_Local` đã chạy đủ V1–V6 mới
và nạp lại dữ liệu demo riêng. Database `QLKS` ban đầu được giữ nguyên.
Đăng nhập KITCHEN để tạo đề xuất; MANAGER vào hàng đợi để duyệt hoặc từ chối.
