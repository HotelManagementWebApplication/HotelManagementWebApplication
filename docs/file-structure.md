# Cấu trúc project hiện tại

Tài liệu này là bản đồ thư mục đang có trong repository, không phải kiến trúc
đích. Trước khi tạo package/thư mục mới, kiểm tra source thực tế và cập nhật
bản đồ này nếu cấu trúc thay đổi.

```text
web-hotel-mis/
├── backend/
│   └── src/
│       ├── main/java/com/hospitality/mis/
│       │   ├── config/       # Spring, security, time and web configuration
│       │   ├── controller/   # HTTP endpoints, grouped by domain
│       │   ├── dao/          # SQL Server database adapters
│       │   ├── dto/          # Request and response contracts
│       │   ├── entity/       # JPA persistence models
│       │   └── service/      # Business rules and transaction boundaries
│       ├── main/resources/db/migration/  # Chuỗi migration Flyway của SQL Server
│       └── test/             # Unit, API, security and SQL Server acceptance tests
├── frontend/
│   ├── e2e/                  # Live backend contract test instructions/specs
│   └── src/
│       ├── app/              # App shell, navigation, permissions and sessions
│       ├── features/         # Customer and staff screens with focused tests
│       └── shared/           # API callers, components, types and utilities
├── database/demo/            # Manual demo seed and reset scripts
├── agent/                    # Small service scaffold with health endpoint
├── docs/                     # Current contracts, decisions and guides
├── .github/workflows/        # CI
└── docker-compose.yml        # SQL Server demo service
```

## Change navigation

For a backend behavior change, trace the controller mapping to its DTO, service,
repository/entity and focused test. Database changes belong in exactly six
Flyway files under `backend/src/main/resources/db/migration/`: V1 schema,
V2 indexes, V3 functions, V4 views, V5 stored procedures, V6 triggers. Edit the owning file;
never add V7+ or auxiliary DDL files. Rebuild only authorized demo/test databases
when checksums change, as required by root `AGENTS.md`. For a frontend
change, trace the screen from `src/app/App.tsx` through `src/app/navigation` or
the relevant `src/features` module to its API caller and focused test. The
backend remains the only writer of business data; use the [API contract](api-contract.md)
for current wire details.
