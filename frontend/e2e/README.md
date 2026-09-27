# Live E2E contract

`e2e/specs/live-contract.test.ts` is a real HTTP contract suite. It calls the
running backend and does not mock `fetch`, the application, or backend
responses. Run it only against a disposable SQL Server database. Do not use a local or
production schema containing data that must be preserved.

## Required variables by flow

- Anonymous: public rooms and services. `E2E_API_BASE_URL`.
- Customer: `E2E_API_BASE_URL`, `E2E_CUSTOMER_PHONE`,
  `E2E_CUSTOMER_PASSWORD`, `E2E_CUSTOMER_FULL_NAME`,
  `E2E_CUSTOMER_IDENTITY_NUMBER`, `E2E_CUSTOMER_ROOM_ID`,
  `E2E_CUSTOMER_CHECK_IN`, `E2E_CUSTOMER_CHECK_OUT`,
  `E2E_CUSTOMER_FOREIGN_RESERVATION_ID`, `E2E_SQLSERVER_DATABASE`, and
  `E2E_SQLSERVER_DISPOSABLE=true`.
- Front Desk: `E2E_API_BASE_URL`, `E2E_FRONT_DESK_EMPLOYEE_ID`,
  `E2E_FRONT_DESK_PASSWORD`, `E2E_FRONT_DESK_RESERVATION_ID`,
  `E2E_FRONT_DESK_CHECK_IN_AT`, `E2E_FRONT_DESK_CHECK_OUT_AT`,
  `E2E_SQLSERVER_DATABASE`, and `E2E_SQLSERVER_DISPOSABLE=true`.
- Housekeeping/Technical/Manager: `E2E_API_BASE_URL`,
  `E2E_HOUSEKEEPING_EMPLOYEE_ID`, `E2E_HOUSEKEEPING_PASSWORD`,
  `E2E_TECHNICAL_EMPLOYEE_ID`, `E2E_TECHNICAL_PASSWORD`,
  `E2E_MANAGER_EMPLOYEE_ID`, `E2E_MANAGER_PASSWORD`, `E2E_WORK_ORDER_ID`,
  `E2E_WORK_ORDER_ROOM_ID`, `E2E_SQLSERVER_DATABASE`, and
  `E2E_SQLSERVER_DISPOSABLE=true`.
- Kitchen: `E2E_API_BASE_URL`, `E2E_KITCHEN_EMPLOYEE_ID`,
  `E2E_KITCHEN_PASSWORD`, `E2E_MANAGER_EMPLOYEE_ID`,
  `E2E_MANAGER_PASSWORD`, `E2E_SERVICE_ID`, `E2E_KITCHEN_STOCK_QUANTITY`,
  `E2E_NEW_SERVICE_PRICE`, `E2E_SQLSERVER_DATABASE`, and
  `E2E_SQLSERVER_DISPOSABLE=true`.
- Accounting/Director: `E2E_API_BASE_URL`, `E2E_ACCOUNTING_EMPLOYEE_ID`,
  `E2E_ACCOUNTING_PASSWORD`, `E2E_ACCOUNTING_INVOICE_ID`,
  `E2E_ACCOUNTING_PAYMENT_AMOUNT`, `E2E_ACCOUNTING_REFUND_AMOUNT`,
  `E2E_ACCOUNTING_REFUND_KEY`, `E2E_ACCOUNTING_REFUND_APPROVAL_ID`,
  `E2E_DIRECTOR_EMPLOYEE_ID`, `E2E_DIRECTOR_PASSWORD`,
  `E2E_SQLSERVER_DATABASE`, and `E2E_SQLSERVER_DISPOSABLE=true`.
- HR/Admin: `E2E_API_BASE_URL`, `E2E_ADMIN_EMPLOYEE_ID`,
  `E2E_ADMIN_PASSWORD`, `E2E_HR_EMPLOYEE_ID`, and `E2E_HR_PASSWORD`.

The customer flow registers the supplied customer, so its phone and identity
number must be unused in the disposable schema. Its room ID must identify an
available room, and `E2E_CUSTOMER_FOREIGN_RESERVATION_ID` must be a positive ID
belonging to another customer. The other flows mutate existing records and
require IDs whose state matches the scenario: a check-in-ready reservation, a
housekeeping task/work order in the expected initial state, a service, an
invoice, and an already approved refund approval. Employee IDs must be real
accounts with the exact roles checked by the test; actors must be distinct
where the test requires it.

Date-time variables must be ISO local date-times such as
`2031-01-10T14:00:00`. Quantities and amounts must be positive. The accounting
refund amount cannot exceed the payment amount, and
`E2E_ACCOUNTING_REFUND_KEY` must be a 1–35 character ASCII idempotency key.

## Disposable SQL Server and backend

Create or select a disposable SQL Server database whose name matches `e2e_<name>`, for
example `e2e_live_contract_20260918`. The backend uses JPA
`ddl-auto=validate`; Flyway applies the repository migrations on startup. The
database must therefore be reachable by the configured SQL Server login and compatible
with the current migrations.

The repository includes a deterministic fixture path for the local demo SQL Server
container. First create a disposable schema named `e2e_<name>`, start the
backend once so Flyway applies all migrations, then stop any backend connected
to that schema. Run `database/demo/reset_demo.sql` followed by
`database/demo/seed_live_e2e.sql` against that schema only. The latter refuses
to run outside an `e2e_*` schema. The reset script supplies demo employee
accounts (password `hotel123`); do not reuse these credentials outside local
testing. Do not run either script against `QLKS` or a database with data to
preserve.

For the checked-in fixture, query actual identifiers after seeding rather than
assuming auto-increment values:

```sql
SELECT maNhanVien, vaiTro FROM NhanVien
WHERE maNhanVien IN ('FRONTDESK','HOUSEKEEP','TECHNICAL','MANAGER',
                     'KITCHEN','ACCOUNTING','DIRECTOR','ADMIN','HR');
SELECT maPhieuDatPhong, trangThai FROM PhieuDatPhong ORDER BY maPhieuDatPhong;
SELECT maHoaDon, trangThai FROM HoaDon ORDER BY maHoaDon;
SELECT maDichVu FROM DichVu WHERE maDichVu = 'BREAKFAST';
SELECT maPhieuCongViecKyThuat FROM PhieuCongViecKyThuat
WHERE vatTuSuDung = 'E2E_FIXTURE_TECHNICAL_ORDER';
```

`frontend/e2e/specs/live-contract.test.ts` exercises seven live HTTP scenarios
covering public/customer, front desk, housekeeping/technical/manager, kitchen,
accounting/director, and HR/admin behavior. It is not a browser-driven UI
suite; report it as live HTTP/role E2E, not UI E2E.

The backend uses `DB_URL`, `DB_USERNAME`, and `DB_PASSWORD` and listens on port
8080 by default. `MIGRATION_TEST_DB_URL`, `MIGRATION_TEST_DB_USERNAME`, and
`MIGRATION_TEST_DB_PASSWORD` are separate variables used by the backend's
SQL Server integration tests; they do not configure a running backend. If you use the
same disposable schema for those tests, set the migration variables to that
schema deliberately and run them before creating live-E2E fixtures. Never
point either path at a shared or production database.

From `C:\web-hotel-mis`, set backend-only process variables and start the
backend in one PowerShell window. Replace the password and schema details
locally; do not commit them or put them in a tracked file:

```powershell
$env:DB_URL = "jdbc:sqlserver://localhost:1433;databaseName=e2e_live_contract_20260918;encrypt=true;trustServerCertificate=true"
$env:DB_USERNAME = "sa"
$env:DB_PASSWORD = "<local-sqlserver-password>"
Set-Location C:\web-hotel-mis\backend
mvn spring-boot:run
```

If validating the migration-test connection separately, these are process-scoped
variables and are not a substitute for the backend `DB_*` variables:

```powershell
$env:MIGRATION_TEST_DB_URL = "jdbc:sqlserver://localhost:1433;databaseName=e2e_live_contract_20260918;encrypt=true;trustServerCertificate=true"
$env:MIGRATION_TEST_DB_USERNAME = "sa"
$env:MIGRATION_TEST_DB_PASSWORD = "<local-sqlserver-password>"
```

## Configure and run

In a second PowerShell window, set only process-scoped variables. Replace every
placeholder with a real value supplied for this disposable environment. Do not
use dummy IDs, dummy passwords, or `...` values.

```powershell
Set-Location C:\web-hotel-mis\frontend

$env:E2E_API_BASE_URL = "http://localhost:8080"
$env:E2E_SQLSERVER_DATABASE = "e2e_live_contract_20260918"
$env:E2E_SQLSERVER_DISPOSABLE = "true"

$env:E2E_CUSTOMER_PHONE = "<unused-real-test-phone>"
$env:E2E_CUSTOMER_PASSWORD = "<real-disposable-customer-password>"
$env:E2E_CUSTOMER_FULL_NAME = "<real-disposable-customer-name>"
$env:E2E_CUSTOMER_IDENTITY_NUMBER = "<unused-real-test-identity-number>"
$env:E2E_CUSTOMER_ROOM_ID = "<available-room-id>"
$env:E2E_CUSTOMER_CHECK_IN = "2031-01-10T14:00:00"
$env:E2E_CUSTOMER_CHECK_OUT = "2031-01-11T12:00:00"
$env:E2E_CUSTOMER_FOREIGN_RESERVATION_ID = "<other-customer-reservation-id>"

$env:E2E_FRONT_DESK_EMPLOYEE_ID = "<real-front-desk-employee-id>"
$env:E2E_FRONT_DESK_PASSWORD = "<real-front-desk-password>"
$env:E2E_FRONT_DESK_RESERVATION_ID = "<check-in-ready-reservation-id>"
$env:E2E_FRONT_DESK_CHECK_IN_AT = "2031-01-10T14:00:00"
$env:E2E_FRONT_DESK_CHECK_OUT_AT = "2031-01-11T12:00:00"

$env:E2E_HOUSEKEEPING_EMPLOYEE_ID = "<real-housekeeping-employee-id>"
$env:E2E_HOUSEKEEPING_PASSWORD = "<real-housekeeping-password>"
$env:E2E_TECHNICAL_EMPLOYEE_ID = "<real-technical-employee-id>"
$env:E2E_TECHNICAL_PASSWORD = "<real-technical-password>"
$env:E2E_MANAGER_EMPLOYEE_ID = "<real-manager-employee-id>"
$env:E2E_MANAGER_PASSWORD = "<real-manager-password>"
$env:E2E_WORK_ORDER_ID = "<new-work-order-id>"
$env:E2E_WORK_ORDER_ROOM_ID = "<matching-room-id>"

$env:E2E_KITCHEN_EMPLOYEE_ID = "<real-kitchen-employee-id>"
$env:E2E_KITCHEN_PASSWORD = "<real-kitchen-password>"
$env:E2E_SERVICE_ID = "<real-service-id>"
$env:E2E_KITCHEN_STOCK_QUANTITY = "<positive-stock-quantity>"
$env:E2E_NEW_SERVICE_PRICE = "<positive-new-price>"

$env:E2E_ACCOUNTING_EMPLOYEE_ID = "<real-accounting-employee-id>"
$env:E2E_ACCOUNTING_PASSWORD = "<real-accounting-password>"
$env:E2E_ACCOUNTING_INVOICE_ID = "<real-invoice-id>"
$env:E2E_ACCOUNTING_PAYMENT_AMOUNT = "<positive-payment-amount>"
$env:E2E_ACCOUNTING_REFUND_AMOUNT = "<positive-refund-amount>"
$env:E2E_ACCOUNTING_REFUND_KEY = "<unique-refund-key>"
$env:E2E_ACCOUNTING_REFUND_APPROVAL_ID = "<approved-refund-approval-id>"
$env:E2E_DIRECTOR_EMPLOYEE_ID = "<real-director-employee-id>"
$env:E2E_DIRECTOR_PASSWORD = "<real-director-password>"

$env:E2E_ADMIN_EMPLOYEE_ID = "<real-admin-employee-id>"
$env:E2E_ADMIN_PASSWORD = "<real-admin-password>"
$env:E2E_HR_EMPLOYEE_ID = "<real-hr-employee-id>"
$env:E2E_HR_PASSWORD = "<real-hr-password>"

npm run test:e2e
```

The exact test command is run from `frontend` while the backend is running
against the same schema. A truthful successful result has
`configured=7 skipped=0 blocked=0` and all seven tests pass. A missing variable
produces `[E2E][SKIP]`; skipped tests are not passes. An unavailable configured
backend or response/state mismatch fails the relevant test. Do not report live
E2E proof unless the command actually ran with no skips and passed. The
accounting flow requires an approved refund; it does not authorize bypassing
approval.

## Cleanup

Stop the backend, then remove only the disposable database using the SQL Server
administration process approved for your environment. Do not drop a shared,
local, or production schema. In each PowerShell process that received
variables, close the window or clear the process environment explicitly:

```powershell
$names = @(
  "DB_URL", "DB_USERNAME", "DB_PASSWORD", "MIGRATION_TEST_DB_URL", "MIGRATION_TEST_DB_USERNAME", "MIGRATION_TEST_DB_PASSWORD",
  "E2E_API_BASE_URL", "E2E_SQLSERVER_DATABASE", "E2E_SQLSERVER_DISPOSABLE",
  "E2E_CUSTOMER_PHONE", "E2E_CUSTOMER_PASSWORD", "E2E_CUSTOMER_FULL_NAME", "E2E_CUSTOMER_IDENTITY_NUMBER", "E2E_CUSTOMER_ROOM_ID", "E2E_CUSTOMER_CHECK_IN", "E2E_CUSTOMER_CHECK_OUT", "E2E_CUSTOMER_FOREIGN_RESERVATION_ID",
  "E2E_FRONT_DESK_EMPLOYEE_ID", "E2E_FRONT_DESK_PASSWORD", "E2E_FRONT_DESK_RESERVATION_ID", "E2E_FRONT_DESK_CHECK_IN_AT", "E2E_FRONT_DESK_CHECK_OUT_AT",
  "E2E_HOUSEKEEPING_EMPLOYEE_ID", "E2E_HOUSEKEEPING_PASSWORD", "E2E_TECHNICAL_EMPLOYEE_ID", "E2E_TECHNICAL_PASSWORD", "E2E_MANAGER_EMPLOYEE_ID", "E2E_MANAGER_PASSWORD", "E2E_WORK_ORDER_ID", "E2E_WORK_ORDER_ROOM_ID",
  "E2E_KITCHEN_EMPLOYEE_ID", "E2E_KITCHEN_PASSWORD", "E2E_SERVICE_ID", "E2E_KITCHEN_STOCK_QUANTITY", "E2E_NEW_SERVICE_PRICE",
  "E2E_ACCOUNTING_EMPLOYEE_ID", "E2E_ACCOUNTING_PASSWORD", "E2E_ACCOUNTING_INVOICE_ID", "E2E_ACCOUNTING_PAYMENT_AMOUNT", "E2E_ACCOUNTING_REFUND_AMOUNT", "E2E_ACCOUNTING_REFUND_KEY", "E2E_ACCOUNTING_REFUND_APPROVAL_ID", "E2E_DIRECTOR_EMPLOYEE_ID", "E2E_DIRECTOR_PASSWORD",
  "E2E_ADMIN_EMPLOYEE_ID", "E2E_ADMIN_PASSWORD", "E2E_HR_EMPLOYEE_ID", "E2E_HR_PASSWORD"
)
foreach ($name in $names) { Remove-Item "Env:$name" -ErrorAction SilentlyContinue }
```

The suite creates and mutates disposable customer, reservation, payment,
receipt, inventory, approval, and work-order data. Treat all resulting data as
temporary and discard the schema after the run.
