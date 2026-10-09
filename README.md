# web-hotel-mis

Hotel MIS for one hotel: a Spring Boot API, React/TypeScript web app, Microsoft
SQL Server schema, and a customer RAG-agent service. This repository is the source of
truth for application code and database migrations.

## Repository map

```text
backend/              Spring Boot API, tests, and Flyway migrations
frontend/             React/TypeScript customer and staff screens
database/demo/        Manual local demo seed/reset files
agent/                FastAPI customer assistant, RAG, API tools, policies, and evals
rule.md              Internal product, implementation, and operating rules
customer-policy.md   Approved customer-facing terms indexed by the chatbot
docs/                 Architecture, API contract, operations plan, and guides
.github/workflows/    CI configuration
docker-compose.yml    Local SQL Server and Qdrant services
```

## Data and runtime boundaries

- The backend API is the only business-data writer. Frontend and agent code do
  not connect directly to SQL Server.
- Exactly six Flyway files under `backend/src/main/resources/db/migration/`
  own database changes: V1 schema, V2 indexes, V3 functions, V4 views, V5
  procedures, V6 triggers. Never create V7+ or auxiliary DDL files; see root `AGENTS.md`.
  Hibernate validates mappings; it does not create or update schema.
- Demo reset scripts are destructive and local-only. Read
  [`database/demo/README.md`](database/demo/README.md) before using them; never
  point them at shared or production data.
- Production credentials and secrets belong in a secret manager, not in source
  files, `.env` files, or command history.

## Local development

The local RAG stack uses the persistent Qdrant volume
`web-hotel-mis_hotel-qdrant`. Start only Qdrant when preparing or re-indexing
the customer policy:

```powershell
Set-Location C:\web-hotel-mis
docker compose up -d qdrant
```

For the complete local dependency set, start the existing SQL Server services,
Qdrant and the customer agent. The init service only creates `QLKS` when it does
not reset or delete the database. Do not use `docker compose down -v` because it
removes the named data volumes.

```powershell
Set-Location C:\web-hotel-mis
docker compose up -d --build sqlserver sqlserver-init qdrant agent
```

Create the agent environment from the repository root. The conditional copy
keeps an existing local `.env`; open it in an editor and enter the Gemini key
there, never in a command or shell history:

```powershell
Set-Location C:\web-hotel-mis
py -3.11 -m venv agent\.venv
.\agent\.venv\Scripts\python.exe -m pip install -e .\agent
Set-Location C:\web-hotel-mis\agent
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
notepad .env
```

The template documents `AI_PROVIDER=gemini`, the approved model pair
`gemini-3.5-flash-lite` and `gemini-embedding-2`, 768-dimensional embeddings,
Qdrant, the backend URL, CORS origins, and agent port 8090. Gemini is the only
runtime provider: the account and key must authenticate successfully for the
configured models. A 401 from the current environment credential means setup
is blocked until a valid key is entered; it must not be treated as working.
There is no offline website fallback. Mocks are for tests only.

Index the one approved source from `agent/`; the installed console script is
the project entry point declared in `agent/pyproject.toml`:

```powershell
Set-Location C:\web-hotel-mis\agent
.\.venv\Scripts\index-customer-policy.exe
```

Run the backend, agent, and frontend in separate terminals:

```powershell
Set-Location C:\web-hotel-mis\backend
mvn spring-boot:run
```

The backend listens on 8080. This command does not reset or delete SQL Server
data. It uses the existing Flyway validation and local database lifecycle.

```powershell
Set-Location C:\web-hotel-mis\agent
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8090
```

```powershell
Set-Location C:\web-hotel-mis\frontend
npm ci
npm run dev -- --host 127.0.0.1 --port 5173
```

The frontend Vite proxy sends `/api` and `/media` to port 8080 and `/agent-api`
to port 8090. Set `DB_URL`, `DB_USERNAME`, and `DB_PASSWORD` only when using a
database other than the local Compose service.

After changing `customer-policy.md`, run the same index command again. Indexing
compares each chunk's content hash: unchanged chunks are not re-embedded,
changed or new chunks are embedded, and chunks removed from the policy are
deleted from Qdrant. `rule.md` is never indexed.

Inspect the collection and exact point count without starting another service:

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

Local/demo SMTP uses the owner-managed fallback values in `application.yml`.
Those two lines are deliberately protected by `AGENTS.md`, `rule.md` and a
regression test; do not change them without an explicit owner request.

## VNPay Sandbox

Sau khi VNPay gửi thông tin sandbox, đặt biến môi trường trước khi chạy backend:

```powershell
$env:VNPAY_TMN_CODE = "<vnp_TmnCode>"
$env:VNPAY_HASH_SECRET = "<vnp_HashSecret>"
$env:VNPAY_RETURN_URL = "https://<public-backend-host>/api/public/payments/vnpay/return"
$env:VNPAY_FRONTEND_RESULT_URL = "http://localhost:5173/payment/vnpay-result"
cd backend
mvn spring-boot:run
```

`VNPAY_RETURN_URL` phải là HTTPS public để VNPay gọi Return/IPN. Máy này đã có
`cloudflared`; có thể dùng Quick Tunnel khi thử nhanh:

```powershell
cloudflared tunnel --url http://localhost:8080
```

Lấy URL `https://...trycloudflare.com` được in ra, ghép đường dẫn Return ở trên,
rồi khởi động lại backend với biến môi trường mới. Nếu cần URL không đổi, tạo
Named Tunnel trong tài khoản Cloudflare và cấu hình hostname cố định. Trên trang
quản trị sandbox, IPN URL là
`https://<public-backend-host>/api/public/payments/vnpay/ipn`.

Backend không gửi `vnp_BankCode`, vì vậy cổng VNPay tự hiển thị QR, ATM/tài khoản
ngân hàng, thẻ quốc tế và ví. Số tiền gửi sang VNPay là đúng 50% tiền phòng;
booking được giữ 30 phút và mỗi lần “Thanh toán lại” tạo một `vnp_TxnRef` mới
trên cùng booking.

The project has completed its SQL Server cutover. Docker Compose contains the
SQL Server services and the persistent Qdrant service; the disposable demo
database is `QLKS`.

## Verification and canonical docs

CI configuration lives in [`.github/workflows/ci.yml`](.github/workflows/ci.yml).
See [architecture](docs/architecture.md), the
[API contract](docs/api-contract.md), the
[frontend surface inventory](docs/ui-action-matrix.md), and the
[database access and acceptance evidence](docs/database-access-matrix.md).
Live E2E setup
and disposable-database requirements are documented in
[`frontend/e2e/README.md`](frontend/e2e/README.md).

$TUNNEL_URL = "https://reflected-kills-himself-large.trycloudflare.com"

$env:JWT_SECRET = "mamh-demo-jwt-secret-2026-local-key-very-long"

$env:CORS_ALLOWED_ORIGINS = "http://localhost:5173,https://mam-hotel.vercel.app"

$env:VNPAY_TMN_CODE = "A9O5JZ0G"
$env:VNPAY_HASH_SECRET = "ZSJNHRBJAJBLTFFRRIIZFRNQWYPDIJBH"

$env:VNPAY_RETURN_URL = "https://reflected-kills-himself-large.trycloudflare.com/api/public/payments/vnpay/return"
$env:VNPAY_FRONTEND_RESULT_URL = "https://mam-hotel.vercel.app/payment/vnpay-result"

Set-Location C:\web-hotel-mis\backend
mvn spring-boot:run
