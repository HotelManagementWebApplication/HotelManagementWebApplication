# Live E2E fixture setup

`frontend/src/e2e/live-contract.test.ts` contains seven live backend scenarios. They are destructive workflow checks: several create or mutate reservations, payments, receipts, inventory, service prices, approvals, work orders, and room state. Run them only against a disposable MySQL schema and a backend instance connected to that schema.

The test requires `E2E_MYSQL_DISPOSABLE=true` and a schema matching `e2e_<name>` for the five scenarios marked as requiring a disposable schema. Do not point these variables at local shared data or production. The backend README states that the backend is the sole database writer; this repository has no supported seed command or fixture loader for these live records. Provision fixtures through the approved backend/database deployment process, then provide their identifiers below. Do not insert rows from this helper or from a client.

## Environment variables

Copy [`frontend/.env.e2e.example`](../frontend/.env.e2e.example) to an ignored local file and replace every placeholder. The example intentionally contains no real credentials, passwords, tokens, or IDs.

Required by the test:

```text
E2E_API_BASE_URL
E2E_MYSQL_DISPOSABLE
E2E_MYSQL_SCHEMA
E2E_CUSTOMER_PHONE
E2E_CUSTOMER_PASSWORD
E2E_CUSTOMER_FULL_NAME
E2E_CUSTOMER_IDENTITY_NUMBER
E2E_CUSTOMER_ROOM_ID
E2E_CUSTOMER_CHECK_IN
E2E_CUSTOMER_CHECK_OUT
E2E_CUSTOMER_FOREIGN_RESERVATION_ID
E2E_FRONT_DESK_EMPLOYEE_ID
E2E_FRONT_DESK_PASSWORD
E2E_FRONT_DESK_RESERVATION_ID
E2E_FRONT_DESK_CHECK_IN_AT
E2E_FRONT_DESK_CHECK_OUT_AT
E2E_HOUSEKEEPING_EMPLOYEE_ID
E2E_HOUSEKEEPING_PASSWORD
E2E_TECHNICAL_EMPLOYEE_ID
E2E_TECHNICAL_PASSWORD
E2E_MANAGER_EMPLOYEE_ID
E2E_MANAGER_PASSWORD
E2E_WORK_ORDER_ID
E2E_WORK_ORDER_ROOM_ID
E2E_KITCHEN_EMPLOYEE_ID
E2E_KITCHEN_PASSWORD
E2E_SERVICE_ID
E2E_KITCHEN_STOCK_QUANTITY
E2E_NEW_SERVICE_PRICE
E2E_ACCOUNTING_EMPLOYEE_ID
E2E_ACCOUNTING_PASSWORD
E2E_ACCOUNTING_INVOICE_ID
E2E_ACCOUNTING_PAYMENT_AMOUNT
E2E_ACCOUNTING_REFUND_AMOUNT
E2E_ACCOUNTING_REFUND_KEY
E2E_ACCOUNTING_REFUND_APPROVAL_ID
E2E_DIRECTOR_EMPLOYEE_ID
E2E_DIRECTOR_PASSWORD
E2E_ADMIN_EMPLOYEE_ID
E2E_ADMIN_PASSWORD
E2E_HR_EMPLOYEE_ID
E2E_HR_PASSWORD
```

The employee IDs and passwords must authenticate as the exact roles checked by `/api/auth/me`: `FRONT_DESK`, `HOUSEKEEPING`, `TECHNICAL`, `MANAGER`, `KITCHEN`, `ACCOUNTING`, `DIRECTOR`, `ADMIN`, and `HR`. Actors that are compared as distinct in the test must be different accounts. The customer values are registration inputs; use a new phone and identity number for each disposable run.

Fixture requirements are behavioral, not just numeric: the customer room must be available for the requested dates; the foreign reservation must belong to another customer; the Front Desk reservation must be ready for check-in; the work order must be `NEW` and belong to a room whose housekeeping task is `WAITING_TECHNICAL` with a complete, non-blocking checklist; the service must support stock and price changes; the accounting invoice must accept the configured positive payment; and the refund approval must already be `APPROVED`, target that invoice, have action `PAYMENT_REFUND`, amount equal to `E2E_ACCOUNTING_REFUND_AMOUNT`, and payload containing the configured refund key. The refund key must be 1–35 ASCII characters matching the backend Idempotency-Key contract.

## Run all seven live scenarios

From the repository root, load the local environment into the PowerShell process, start the backend against the disposable schema, and run the exact test file:

```powershell
Get-Content .\frontend\.env.e2e | Where-Object { $_ -and $_ -notmatch '^\s*#' } | ForEach-Object { $name, $val = $_ -split '=', 2; Set-Item -Path "Env:$name" -Value $val }
npm --prefix .\frontend exec vitest run src/e2e/live-contract.test.ts
```

The test file is the seven-scenario boundary: public rooms/services; customer register/login/booking/deposit/ownership; Front Desk check-in/checkout/payment/receipt; housekeeping/technical/manager release; kitchen inventory and service-price approval; accounting payment and approved refund; and HR/Admin permission ceiling. Missing variables cause individual scenarios to be skipped, so a successful command with skipped scenarios is not full proof.

After the run, discard the schema and its credentials. Never reuse these fixtures for shared development or production data.
