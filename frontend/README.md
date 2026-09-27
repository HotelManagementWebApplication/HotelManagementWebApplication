# Web frontend

React/TypeScript application for the public customer experience and hotel staff
stations. `src/app/App.tsx` owns authentication flow and delegates screen
selection to `src/app/navigation/ScreenRouter.tsx`; this is not a URL-based
router. Business screens and their colocated tests live under `src/features/`.
Shared API callers, reusable components, types, utilities, and assets live under
`src/shared/`. Customer session restoration is in `src/app/session/`.

Run locally from this directory:

```powershell
npm ci
npm run dev -- --host 127.0.0.1 --port 5173
```

The Vite development proxy sends `/api` requests to the local backend. For a
hosted static build, set `VITE_API_BASE_URL` to the backend origin (without a
trailing `/api`) and configure the backend CORS allowlist for the frontend
origin. A browser on the public internet cannot reach a developer's
`localhost:8080`.

Run frontend unit tests with `npm test` and a production build with
`npm run build`. The live HTTP scenarios are in `e2e/specs/`; read
[`e2e/README.md`](e2e/README.md) before running `npm run test:e2e`. They mutate
business data and the mutating scenarios require a disposable SQL Server
database;
skipped scenarios are not a passing live test.
