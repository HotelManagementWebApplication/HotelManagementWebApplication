# Hotel MIS backend

Spring Boot API for the Hotel MIS. Java code lives under
`src/main/java/com/hospitality/mis`, grouped into `controller`, `service`,
`dao`, `dto`, `entity`, and `config` packages.

## Chạy local

Start local SQL Server from the repository root, clear any stale database
variables from the current PowerShell session, then run from this directory.
The backend accepts only `jdbc:sqlserver://` URLs and SQL Server credentials.

```powershell
docker compose -f ..\docker-compose.yml up -d
Remove-Item Env:DB_URL, Env:DB_USERNAME, Env:DB_PASSWORD -ErrorAction SilentlyContinue
$env:DB_URL = "jdbc:sqlserver://localhost:1433;databaseName=QLKS;encrypt=true;trustServerCertificate=true"
$env:DB_USERNAME = "sa"
$env:DB_PASSWORD = "<local-sqlserver-password>"
mvn spring-boot:run
```

Flyway applies the single canonical demo baseline `V1__baseline_schema.sql`
from `src/main/resources/db/migration/`; Hibernate uses `ddl-auto=validate` and
does not create or update tables. This database is disposable demo data: schema
fixes belong in V1 and the local database is recreated. Do not add V2/V3 for
demo-only schema fixes.

## Lần theo một thay đổi nghiệp vụ

1. Find the endpoint in the domain controller and read its request/response DTO.
2. Follow the service method for validation, authorization scope, state changes,
   and transaction boundaries.
3. Check the DAO/repository and entity to see how state is persisted.
4. If schema behavior changes, inspect/add a Flyway migration.
5. Update the focused test and the [API contract](../docs/api-contract.md) if
   the externally visible behavior changes.

Controllers should not write to the database directly, and entities should not
be returned as API responses. Authenticated actor identity comes from the
security context, not a client-supplied actor field.

## SQL Server acceptance tests

Tests requiring SQL Server must use a separate disposable database. Set
`MIGRATION_TEST_DB_URL`, `MIGRATION_TEST_DB_USERNAME`, and
`MIGRATION_TEST_DB_PASSWORD` explicitly; these variables are separate from the
running application's `DB_*` settings. Never point an acceptance test at a
shared or production schema. The live HTTP contract scenarios have a separate
setup and safety guide at [`frontend/e2e/README.md`](../frontend/e2e/README.md).

The backend is the only business-data writer. Frontend, agent, and operational
clients must use authorized backend use cases rather than direct SQL Server writes.
