# web-hotel-mis

Hotel MIS for one hotel: a Spring Boot API, React/TypeScript web app, Microsoft
SQL Server schema, and an agent health-check scaffold. This repository is the source of
truth for application code and database migrations.

## Repository map

```text
backend/              Spring Boot API, tests, and Flyway migrations
frontend/             React/TypeScript customer and staff screens
database/demo/        Manual local demo seed/reset files
agent/                Health-check scaffold; not a production assistant
docs/                 Architecture, API contract, operations plan, and guides
.github/workflows/    CI configuration
docker-compose.yml    Local SQL Server service
```

## Data and runtime boundaries

- The backend API is the only business-data writer. Frontend and agent code do
  not connect directly to SQL Server.
- Flyway migrations under `backend/src/main/resources/db/migration/` own schema
  changes. Hibernate validates mappings; it does not create or update schema.
- Demo reset scripts are destructive and local-only. Read
  [`database/demo/README.md`](database/demo/README.md) before using them; never
  point them at shared or production data.
- Production credentials and secrets belong in a secret manager, not in source
  files, `.env` files, or command history.

## Local development

Start SQL Server from the repository root, then run the backend and frontend in
separate terminals:

```powershell
docker compose up -d
cd backend
mvn spring-boot:run
```

```powershell
cd frontend
npm ci
npm run dev -- --host 127.0.0.1 --port 5173
```

Set `DB_URL`, `DB_USERNAME`, and `DB_PASSWORD` for the backend when using a
database other than the local Compose service. The frontend uses the Vite API
proxy during local development; hosted builds need a reachable HTTPS backend
configured with `VITE_API_BASE_URL`.

Local/demo SMTP uses the owner-managed fallback values in `application.yml`.
Those two lines are deliberately protected by `AGENTS.md`, `rule.md` and a
regression test; do not change them without an explicit owner request.

The project has completed its SQL Server cutover. Docker Compose contains only
the SQL Server service; the disposable demo database is `QLKS`.

## Verification and canonical docs

CI configuration lives in [`.github/workflows/ci.yml`](.github/workflows/ci.yml).
See [architecture](docs/architecture.md), the
[API contract](docs/api-contract.md), the
[frontend surface inventory](docs/ui-action-matrix.md), and the
[SQL Server closeout criteria](docs/ke-hoach-chuyen-doi-sql-server.md).
The current SQL Server closeout criteria are in
[`docs/ke-hoach-chuyen-doi-sql-server.md`](docs/ke-hoach-chuyen-doi-sql-server.md).
Live E2E setup
and disposable-database requirements are documented in
[`frontend/e2e/README.md`](frontend/e2e/README.md).
