# Frontend surface inventory

This is a concise, non-gating inventory of the frontend screens that are wired
from `frontend/src/app/App.tsx`. It is not generated from source, is not a
row-by-row action proof, and does not claim browser or live-backend acceptance.
For HTTP paths, payloads, and authorization, use
[`api-contract.md`](api-contract.md) and the focused tests beside the source.

## Screen selection

The app uses a React `View` state rather than URL routes. Employee login calls
the backend and maps the returned role to a station; the static
`staffAccounts` table is a compatibility/fallback mapping, not authorization.
Backend permissions remain authoritative.

| Screen | Source | Intended user |
|---|---|---|
| Customer portal | `frontend/src/features/customer/CustomerPortal.tsx` and its `components/` | Public visitor or authenticated customer |
| Front desk | `frontend/src/features/front-desk/FrontDeskPMS.tsx` | `FRONT_DESK` |
| Housekeeping | `frontend/src/features/housekeeping/HousekeepingStation.tsx` | `HOUSEKEEPING` |
| Kitchen and inventory | `frontend/src/features/kitchen-inventory/KitchenInventory.tsx` | `KITCHEN` |
| Maintenance | `frontend/src/features/maintenance/MaintenanceStation.tsx` | `TECHNICAL` |
| Accounting | `frontend/src/features/accounting/AccountingStation.tsx` | `ACCOUNTING` |
| Management | `frontend/src/features/management/ManagerDashboard.tsx` | `MANAGER` and `DIRECTOR` |
| HR | `frontend/src/features/hr/HRStation.tsx` | `HR` |
| Administration | `frontend/src/features/admin/AdminStation.tsx` | `ADMIN` |

`features/auth/LoginPage.tsx` is the employee/customer login surface. `ScreenRouter.tsx` imports the
screens above; they are not merely unreachable legacy pages.

## Data and evidence boundary

- Runtime API calls are centralized under `frontend/src/shared/api/`; shared
  transport/session behavior is in `client.ts`. Tests next to callers verify
  the cases they name, not every rendered interaction.
- Page/component tests use controlled fixtures where needed. Those fixtures
  are test data, not evidence that production runtime falls back to sample
  business data.
- Live HTTP contract scenarios are in
  `frontend/e2e/specs/live-contract.test.ts`. They mutate state, require a
  disposable SQL Server database and real fixture credentials/IDs, and may skip when
  prerequisites are absent. Setup and safety rules are in
  [`frontend/e2e/README.md`](../frontend/e2e/README.md).
- There is no per-action generated matrix or successful live browser acceptance
  implied by this inventory. A row-level status must be added only with
  current focused test evidence; live proof must identify the exact run and
  report zero skipped scenarios.
