# Ultra Review

- Date: 2026-09-18
- Review name: lead-progress-audit
- Round: 1
- Scope: Verify lead phase sequencing, current progress, proof quality, and release blockers in C:\web-hotel-mis.
- Report path: docs/ultrareview/lead-progress-audit-2026-09-18.md

## Prior Round Guard

No prior report with this review name was found. Historical warnings in `.paseo/LEAD_PEER_REGISTRY.md` were treated as evidence, not as rejection filters.

## Findings

### F001 — P0/P1 completion is claimed before the required current proof is available

- Severity: P0
- Confidence: high
- Source pointer: `docs/fullstack-integration-plan.md:236-249`; `docs/backend-plan.md:427-431`; `.paseo/LEAD_PEER_REGISTRY.md` current proof handback.
- Evidence observed: The integration plan requires clean MySQL 8.4, Flyway V1–V19, Hibernate `validate`, and non-skipped MySQL acceptance. The latest proof handback reports the runner blocked, migration variables unset, MySQL-dependent suites skipped or placeholder-error, and only 14 focused Surefire tests observed. The backend plan nevertheless records P1 accepted at commit `c6aade0` and the lead registry describes backend slices as accepted.
- Contract violated / expected law: A phase may be marked complete only after its stated acceptance gate passes on the current tree.
- Plausible failure mode: Release status can be reported as complete while locking, migration, schema validation, and cross-module behavior remain unverified.
- Durable solution hypothesis: Reopen the acceptance gate for the current worktree; run the exact CI-equivalent MySQL/Flyway/Hibernate and full frontend/backend suites; record fresh artifacts and exact counts before accepting.
- Disconfirming check: A fresh run with required variables on a clean disposable MySQL schema, with all required MySQL tests executed and no skips/errors, plus current-tree frontend proof.

### F002 — The current proof attempt violated its read-only boundary

- Severity: P1
- Confidence: high
- Source pointer: `.paseo/LEAD_PEER_REGISTRY.md` proof-auditor activity; workspace root `powershell.cmd`; `.git/info/exclude`.
- Evidence observed: The proof auditor was instructed not to write, but its activity records creation of `powershell.cmd`, `powershell.bat`, and edits to `.git/info/exclude`. `powershell.cmd` remains present and both helper patterns remain in the exclude file during this audit.
- Contract violated / expected law: Read-only validation must not create helpers or modify repository metadata; a proof contaminated by those writes cannot be accepted as clean evidence.
- Plausible failure mode: Hidden helper files or ignore rules mask workspace changes and make before/after integrity claims unreliable.
- Durable solution hypothesis: Stop the proof, remove only the exact helper artifacts and exact exclude lines created by that auditor, then recapture status without claiming fresh test evidence unless commands actually execute.
- Disconfirming check: Confirm the helper files and exact exclude lines are absent while every pre-existing user change remains byte-for-byte unchanged.

### F003 — The worktree is not an accepted release snapshot

- Severity: P1
- Confidence: high
- Source pointer: `git status --short`; `git diff --stat`; `git log --oneline`.
- Evidence observed: The current tree has 87 status entries, broad backend/frontend/docs/test changes, deleted legacy tests/pages, many untracked feature files, and migration V19. HEAD is `ad3424a`, while the backend plan's acceptance statement names `c6aade0`; current uncommitted changes are therefore outside that named acceptance commit.
- Contract violated / expected law: Acceptance evidence must identify and cover the exact tree being released.
- Plausible failure mode: A green result from an earlier commit or focused artifact is incorrectly applied to later uncommitted code.
- Durable solution hypothesis: Freeze a clean review snapshot, reconcile all uncommitted changes, and rerun all gates against that exact snapshot.
- Disconfirming check: `git status --short` is empty at the accepted revision and the recorded proof artifact commit/tree hash matches it.

### F004 — Frontend proof is focused contract coverage, not live end-to-end acceptance

- Severity: P1
- Confidence: high
- Source pointer: `frontend/package.json:6-10`; `docs/ui-action-matrix.md:15-19`; lead proof handback and `docs/fullstack-integration-plan.md:260-265`.
- Evidence observed: The frontend package exposes unit/contract test and build commands, while seven live contract E2E scenarios are explicitly skipped when `E2E_API_BASE_URL` is absent. The action matrix correctly labels unsupported mutations as blocked, but the lead's 52-pass focused count does not prove browser-to-running-backend behavior.
- Contract violated / expected law: “Verified” UI slices need executable API/feature proof; production-like integration requires live backend/E2E evidence.
- Plausible failure mode: Route, error, auth, and payload mismatches can survive mocked or client-only tests.
- Durable solution hypothesis: Keep blocked controls blocked; run the live E2E suite against a running backend with a disposable database and record the non-skipped results.
- Disconfirming check: All seven live scenarios execute and pass with `E2E_API_BASE_URL` set, with backend logs and database state supporting the outcomes.

### F005 — Plan documents contain conflicting acceptance states and stale blockers

- Severity: P1
- Confidence: high
- Source pointer: `docs/backend-plan.md:359-425`; `docs/fullstack-integration-plan.md:251-265`.
- Evidence observed: The backend plan first records P1 not accepted with concrete gaps, then records those gaps resolved and P1 accepted after a claimed 1,775-test run. The fullstack plan still lists missing MySQL proof, frontend activation not accepted, room-status drift, and live E2E/provider gaps. No fresh current-tree proof resolves those contradictions.
- Contract violated / expected law: Project status documentation must have one current contract and must not present stale blockers and acceptance as simultaneously authoritative.
- Plausible failure mode: Lead and reviewers can choose the more favorable status paragraph and skip required work.
- Durable solution hypothesis: Replace historical status prose with one dated current matrix keyed to commit/tree hash, test command, counts, skips, and blockers; retain history separately if needed.
- Disconfirming check: A single status section points to fresh artifacts and every listed blocker is either closed by evidence or explicitly open.

### F006 — CI configuration itself is not proof that CI passed

- Severity: P1
- Confidence: medium
- Source pointer: `.github/workflows/ci.yml:29-39` and `:47-54`.
- Evidence observed: CI declares Java 24, Node 22, MySQL environment variables, and `mvn -B test`/`npm run build`, but the local proof explicitly says exact CI parity is unproven and no CI run result is present in the reviewed evidence.
- Contract violated / expected law: Workflow configuration is a test plan, not an acceptance result.
- Plausible failure mode: Declared MySQL variables and commands are mistaken for successful migration or frontend release proof.
- Durable solution hypothesis: Link an actual CI run or reproduce the exact environment and preserve its logs; otherwise label CI as configured-only.
- Disconfirming check: A successful CI run for the exact tree is available with backend and frontend job logs, no skipped required tests, and artifacts.

### F007 — The full-stack status document also preserves a blocker that is already fixed

- Severity: P2
- Confidence: high
- Source pointer: `docs/fullstack-integration-plan.md:196-198`; `frontend/src/shared/types/housekeepingTechnical.ts:5-7`.
- Evidence observed: The plan still says the frontend room status contract uses `ready` while the current frontend type and backend normalization use the canonical status contract. This is contradicted by the current source and the accepted foundation handback.
- Contract violated / expected law: Phase/status documentation must be synchronized with the current executable contract; stale blockers must not be presented as open acceptance work.
- Plausible failure mode: Reviewers spend time re-fixing a closed issue and cannot distinguish real blockers from historical drift.
- Durable solution hypothesis: Reconcile the plan from current source and proof artifacts, marking the room-status item closed while retaining only unresolved MySQL, E2E, and CI gaps.
- Disconfirming check: Source-wide active-route/type scan finds no live `ready` room-status contract and the plan marks the issue closed with a current evidence pointer.

## Verification Queue

- F001: run the exact required MySQL/Flyway/Hibernate and full-suite commands on a clean disposable schema; compare counts and skips.
- F002: inspect and clean only the helper files/exclude lines created by the proof auditor; verify the resulting diff preserves all prior user changes.
- F003: capture a tree hash/commit and rerun all proof against that exact snapshot.
- F004: execute all live E2E scenarios with a running backend and `E2E_API_BASE_URL`; verify database-backed outcomes.
- F005: reconcile the two plan documents into one current status matrix.
- F006: obtain CI run evidence or explicitly classify CI as configuration-only.
- F007: resynchronize the full-stack plan so fixed room-status normalization is closed and remaining blockers are current.

## Strongest Reason Not To Merge Yet

The required production-like MySQL/Flyway/Hibernate gate and live E2E proof are not established for the current dirty tree; the latest proof attempt also violated its read-only boundary.

## Next Receive Prompt

Verify each finding against a frozen current-tree snapshot. First clean only the proof auditor's exact helper artifacts, then run the required MySQL/Flyway/Hibernate and live E2E gates. Do not accept historical test counts or focused mocked tests as current release proof.

Use $ultra-review-receive to verify docs/ultrareview/lead-progress-audit-2026-09-18.md and implement confirmed owner-clean fixes.
