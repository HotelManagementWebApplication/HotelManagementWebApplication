# web-hotel-mis

Hệ thống quản lý khách sạn cho một khách sạn, gồm API Spring Boot, ứng dụng web React/TypeScript, cơ sở dữ liệu Microsoft SQL Server và dịch vụ trợ lý khách hàng dùng RAG. Kho mã này lưu mã nguồn ứng dụng và các migration cơ sở dữ liệu.

## Cấu trúc kho mã

```text
backend/              API Spring Boot, bộ kiểm thử và migration Flyway
frontend/             Giao diện khách hàng và nhân viên viết bằng React/TypeScript
database/demo/        Tệp dữ liệu mẫu và đặt lại dữ liệu thủ công cho máy local
agent/                Dịch vụ trợ lý khách hàng FastAPI, RAG, công cụ API, chính sách và đánh giá
rule.md               Quy tắc nội bộ về sản phẩm, triển khai và vận hành
customer-policy.md    Điều khoản đã duyệt dành cho khách hàng, được lập chỉ mục cho chatbot
docs/                 Tài liệu kiến trúc, hợp đồng API, vận hành và hướng dẫn
.github/workflows/    Cấu hình CI
docker-compose.yml    Dịch vụ SQL Server và Qdrant chạy local
```

## Ranh giới dữ liệu và môi trường chạy

- API backend là nơi duy nhất được ghi dữ liệu nghiệp vụ. Frontend và agent không kết nối trực tiếp tới SQL Server.
- Chỉ có đúng sáu tệp Flyway trong `backend/src/main/resources/db/migration/` được định nghĩa thay đổi cơ sở dữ liệu: V1 schema, V2 indexes, V3 functions, V4 views, V5 stored procedures và V6 triggers. Không tạo V7 trở đi hoặc tệp DDL phụ; xem `AGENTS.md` ở thư mục gốc.
- Các script đặt lại dữ liệu mẫu có thể xóa dữ liệu và chỉ được dùng local. Đọc [`database/demo/README.md`](database/demo/README.md) trước khi chạy; không trỏ chúng vào dữ liệu dùng chung hoặc production.
- Thông tin xác thực và bí mật của production phải được lưu trong secret manager, không lưu trong mã nguồn, tệp `.env` hay lịch sử lệnh.

## Phát triển local

Stack RAG local sử dụng volume Qdrant có lưu dữ liệu `web-hotel-mis_hotel-qdrant`. Khi chuẩn bị hoặc lập chỉ mục lại chính sách khách hàng, chỉ khởi động Qdrant:

```powershell
Set-Location C:\web-hotel-mis
docker compose up -d qdrant
```

Để khởi động đầy đủ các dịch vụ phụ thuộc local, chạy SQL Server hiện có, Qdrant và customer agent. Dịch vụ init chỉ tạo `QLKS` nếu không đặt lại hoặc xóa cơ sở dữ liệu. Không chạy `docker compose down -v` vì lệnh này xóa các volume dữ liệu có tên.

```powershell
Set-Location C:\web-hotel-mis
docker compose up -d --build sqlserver sqlserver-init qdrant agent
```

Tạo môi trường cho agent từ thư mục gốc. Lệnh sao chép có điều kiện sẽ giữ nguyên `.env` local nếu tệp đã tồn tại. Mở tệp bằng trình soạn thảo rồi nhập Gemini key vào đó; không nhập key trong lệnh hoặc lịch sử shell:

```powershell
Set-Location C:\web-hotel-mis
py -3.11 -m venv agent\.venv
.\agent\.venv\Scripts\python.exe -m pip install -e .\agent
Set-Location C:\web-hotel-mis\agent
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
notepad .env
```

Mẫu cấu hình mô tả `AI_PROVIDER=gemini`, cặp model đã duyệt `gemini-3.5-flash-lite` và `gemini-embedding-2`, embedding 768 chiều, Qdrant, URL backend, các CORS origin và cổng agent 8090. Gemini là provider duy nhất khi chạy thực tế; tài khoản và key phải xác thực thành công với các model đã cấu hình. Nếu thông tin xác thực hiện tại trả về lỗi 401 thì việc thiết lập đang bị chặn cho đến khi nhập key hợp lệ; không được xem đó là trạng thái hoạt động. Website không có chế độ dự phòng offline. Chỉ dùng mock trong kiểm thử.

Lập chỉ mục nguồn đã được duyệt từ thư mục `agent/`. Điểm vào của dự án là console script được khai báo trong `agent/pyproject.toml`:

```powershell
Set-Location C:\web-hotel-mis\agent
.\.venv\Scripts\index-customer-policy.exe
```

Chạy backend, agent và frontend trong các terminal riêng:

```powershell
Set-Location C:\web-hotel-mis\backend
mvn spring-boot:run
```

Backend lắng nghe tại cổng 8080. Lệnh này không đặt lại hoặc xóa dữ liệu SQL Server. Ứng dụng dùng quy trình kiểm tra Flyway hiện có và vòng đời cơ sở dữ liệu local.

```powershell
Set-Location C:\web-hotel-mis\agent
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8090
```

```powershell
Set-Location C:\web-hotel-mis\frontend
npm ci
npm run dev -- --host 127.0.0.1 --port 5173
```

Vite proxy chuyển `/api` và `/media` tới cổng 8080, còn `/agent-api` tới cổng 8090. Chỉ đặt `DB_URL`, `DB_USERNAME` và `DB_PASSWORD` khi dùng cơ sở dữ liệu khác dịch vụ Compose local.

Sau khi thay đổi `customer-policy.md`, chạy lại lệnh lập chỉ mục nói trên. Quy trình so sánh hash nội dung của từng đoạn: đoạn không đổi sẽ không được tạo embedding lại; đoạn mới hoặc đã sửa sẽ được tạo embedding; đoạn bị xóa khỏi chính sách sẽ bị xóa khỏi Qdrant. `rule.md` không bao giờ được lập chỉ mục.

Xem collection và số lượng point chính xác mà không cần khởi động thêm dịch vụ:

```powershell
$collection = "customer_policy"
Invoke-RestMethod "http://localhost:6333/collections/$collection" |
  ConvertTo-Json -Depth 20
Invoke-RestMethod -Method Post `
  -Uri "http://localhost:6333/collections/$collection/points/count" `
  -ContentType "application/json" `
  -Body '{"exact":true}' |
  ConvertTo-Json -Depth 5
```

SMTP local/demo dùng các giá trị dự phòng do chủ sở hữu quản lý trong `application.yml`. Hai dòng cấu hình này được bảo vệ có chủ ý bởi `AGENTS.md`, `rule.md` và một regression test; không thay đổi nếu chưa có yêu cầu rõ ràng từ chủ sở hữu.

## VNPay Sandbox

Sau khi VNPay gửi thông tin sandbox, đặt các biến môi trường trước khi chạy backend:

```powershell
$env:VNPAY_TMN_CODE = "<vnp_TmnCode>"
$env:VNPAY_HASH_SECRET = "<vnp_HashSecret>"
$env:VNPAY_RETURN_URL = "https://<public-backend-host>/api/public/payments/vnpay/return"
$env:VNPAY_FRONTEND_RESULT_URL = "http://localhost:5173/payment/vnpay-result"
cd backend
mvn spring-boot:run
```

`VNPAY_RETURN_URL` phải là địa chỉ HTTPS công khai để VNPay gọi Return/IPN. Máy này đã có `cloudflared`; có thể dùng Quick Tunnel để thử nhanh:

```powershell
cloudflared tunnel --url http://localhost:8080
```

Lấy URL `https://...trycloudflare.com` được in ra, ghép với đường dẫn Return ở trên, rồi khởi động lại backend với biến môi trường mới. Nếu cần URL cố định, tạo Named Tunnel trong tài khoản Cloudflare và cấu hình hostname tương ứng. Trên trang quản trị sandbox, IPN URL là:

```text
https://<public-backend-host>/api/public/payments/vnpay/ipn
```

Backend không gửi `vnp_BankCode`, vì vậy cổng VNPay tự hiển thị phương thức thanh toán được sandbox hỗ trợ. Tiền cọc là 50% tiền phòng; booking giữ tạm 10 phút. Các giá trị `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET` và URL callback phải được cấu hình qua môi trường; không đặt credential hoặc URL tunnel dùng một lần trong tài liệu/kho mã.

## Kiểm tra và tài liệu tham chiếu

Cấu hình CI nằm trong [`.github/workflows/ci.yml`](.github/workflows/ci.yml). Xem thêm tài liệu [kiến trúc](docs/architecture.md), [hợp đồng API](docs/api-contract.md), [danh mục giao diện và thao tác](docs/ui-action-matrix.md) và [ma trận truy cập cơ sở dữ liệu](docs/database-access-matrix.md).

Hướng dẫn thiết lập E2E trực tiếp và các yêu cầu đối với cơ sở dữ liệu dùng một lần được ghi trong [`frontend/e2e/README.md`](frontend/e2e/README.md).
