# Web Hotel MIS architecture

## Target boundary

```text
Public portal --------> public read controllers/DTO
Employee React app ---> JWT/RBAC application API <--- agent typed API tools
                              |       |        |
                            Auth   Use cases  Audit/approval
                                      |
                                      v
                              Database adapters -> SQL Server

Chat UI -> Agent orchestrator
                       |
                       +-> RAG index: SOP, policy, forms, manuals
```

The backend API is the only business-data boundary and the only SQL Server writer.
Anonymous public endpoints are read-only and return allow-listed public DTOs;
they never reuse employee responses or expose guest, reservation, invoice or
internal operational data.
The agent must never connect directly to SQL Server or generate production SQL.
Live room availability, booking, invoice, inventory and cash data are
structured business data and must be read or changed through authenticated API
tools. RAG is reserved for versioned documents and policies, with source
citations and access control.

## Flyway schema history

The owner fixed the demo baseline to exactly six files under
`backend/src/main/resources/db/migration/`: V1 tables/constraints, V2 indexes,
V3 functions, V4 views, V5 stored procedures/business transactions, and V6 triggers.
Edit the owning file, keeping one final definition per object; never add V7+
or auxiliary DDL files. After checksum changes, recreate only the authorized
demo/disposable test database and apply V1–V6 from scratch. Do not repair
checksums or rewrite Flyway history. The binding rule is in root `AGENTS.md`.

Hibernate is configured with `ddl-auto=validate`. It validates the schema
created by Flyway and is not permitted to create, update or otherwise mutate
database structure.

## Backend modules

The backend is a single Spring Boot modular monolith rooted at
`com.hospitality.mis`.

```text
com.hospitality.mis
├── middleware        JWT, actor identity and authorization
├── controller        REST controllers grouped by module
├── service           business services and transaction boundaries
├── dao               Bound JDBC view/function/procedure adapters
├── dto               request/response objects grouped by module
├── entity            JPA entities and business types grouped by module
├── common            shared API errors and exception handling
└── config            Spring and web configuration
```

- `identity`: authentication, roles and permissions.
- `room`: room types, rooms, availability and maintenance state.
- `guest`: guest profile, membership and booking restrictions.
- `reservation`: booking, check-in, check-out, room transfer and cancellation.
- `billing`: pricing policy, services, deposits, invoices and payments.
- `operations`: housekeeping, minibar/inventory, equipment and maintenance.
- `finance`: cash handover, receipts, expenses and supplier debts (some current
  API paths retain the historical `partner-debts` name).
- `governance`: audit log, approval workflow and reporting.

Controllers depend on services. Services coordinate database adapters and projections;
controllers do not access the database directly. DTOs are used at the HTTP
boundary; entities remain for Hibernate schema validation, not runtime writes. Cross-module workflows are
coordinated in services, not by controllers or direct database access.

Start as a modular monolith. Split services only after a measured operational
need exists.

## Non-negotiable safety rules

- All writes use application use cases with transaction boundaries.
- Sensitive actions (invoice deletion, deposit refund, price override) require
  RBAC, explicit confirmation, approver identity and audit log.
- Tools are allow-listed, typed and idempotent.
- The model may propose an action; the backend decides whether it is valid and
  authorized.
- Secrets come from environment/secret management, never source control.
