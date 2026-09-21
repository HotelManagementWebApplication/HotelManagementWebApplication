# Demo database reset

These scripts are manual-only. The application must not drop or seed the
database during startup.

## Clean database flow

1. Create an empty MySQL 8.4 schema.

```sql
CREATE DATABASE QLKS
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

2. Run the backend with Flyway enabled and Hibernate validation enabled.

```powershell
$env:DB_URL="jdbc:mysql://localhost:3307/QLKS?useUnicode=true&characterEncoding=utf8&serverTimezone=Asia/Ho_Chi_Minh"
$env:DB_USERNAME="root"
$env:DB_PASSWORD="<database-password>"
cd backend
mvn spring-boot:run
```

Expected configuration:

```yaml
spring:
  flyway:
    enabled: true
  jpa:
    hibernate:
      ddl-auto: validate
```

Do not use `ddl-auto=create`, `ddl-auto=update`, or startup scripts that drop
the schema.

## Reset demo data

After Flyway has migrated the schema, run:

```powershell
mysql -h localhost -P 3307 -u root -p QLKS < database/demo/reset_demo.sql
```

Use direct file redirection as shown above; do not pipe `Get-Content` into the
MySQL client on Windows PowerShell, because that can transcode Vietnamese text
before MySQL receives it.

`reset_demo.sql` clears and reseeds the complete demo fixture: rooms, guests,
services, reservations, hourly booking hold, invoices, payments, receipts,
housekeeping/technical tasks, inventory, finance, commercial partners,
vouchers, and pending approvals. It also includes one future `DEPOSIT_PAID`
overnight booking for the demo customer so the guest-only pool voucher can be
tested end to end. Dates are generated from `CURDATE()` so the fixture remains
usable when the demo is run later.

For normal local startup, use the guarded script below instead of resetting by
hand. It seeds only when all four core tables are empty; it refuses to reset a
partially populated database:

```powershell
docker compose up -d mysql
# Start backend once so Flyway creates/updates QLKS, then run:
.\database\demo\ensure_demo_data.ps1
```

The Compose file always uses the persistent Docker volume
`web-hotel-mis_hotel-mysql` on MySQL port `3307`. `docker compose down -v` cannot
remove this external volume, so restarting the container does not switch to a
different empty database.

Demo logins created by this script:

- Customer: `0901234567 / hotel123`
- Employees: `FRONTDESK`, `HOUSEKEEP`, `TECHNICAL`, `ACCOUNTING`, `KITCHEN`,
  `MANAGER`, `DIRECTOR`, `ADMIN`, `HR`, `STAFF` — all use `hotel123`.

The SQL stores only BCrypt hashes; it does not store plaintext passwords.

## Admin bootstrap

Provision employee login accounts through the security/admin bootstrap path for
the target environment. If a SQL-based emergency bootstrap is approved, pass
only a BCrypt hash from an environment secret into that one-off command; do not
write plaintext passwords into SQL files.

Example for a precomputed hash stored in `DEMO_ADMIN_BCRYPT_HASH`:

```powershell
if ($env:DEMO_ADMIN_BCRYPT_HASH -notmatch '^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$') {
  throw "DEMO_ADMIN_BCRYPT_HASH must be a BCrypt hash"
}

mysql -h localhost -u root -p QLKS --execute "
INSERT INTO employees (id, full_name, password, position, phone)
VALUES ('NV_ADMIN', 'Demo Admin', '$env:DEMO_ADMIN_BCRYPT_HASH', 'QUAN_LY', '0900000000')
ON DUPLICATE KEY UPDATE
  password = VALUES(password),
  position = VALUES(position)"
```
