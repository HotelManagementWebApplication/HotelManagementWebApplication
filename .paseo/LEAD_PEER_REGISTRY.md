# Lead Peer Registry

Session-owned snapshot for one Lead only. Never reuse a Peer by workspace,
provider, name, or capability alone.

Lead agent ID: `c6e1b1f6-43a5-4715-8d3b-5f2c2c0160a6`
Workspace: `C:\web-hotel-mis`

## Active peers

| Agent ID | Parent Lead ID | Provider / role | Capability | Brief | Owned boundary | Status | Handback summary | Context decision | Next action |
|---|---|---|---|---|---|---|---|---|---|
| `c6e1b1f6-43a5-4715-8d3b-5f2c2c0160a6` | `c6e1b1f6-43a5-4715-8d3b-5f2c2c0160a6` | lead | peer-ledger | Read-only SQL Server and Vietnamese localization audit for Hotel MIS: session peer ledger management and audit coordination | `.paseo/LEAD_PEER_REGISTRY.md` | running | Supervising active audit peers 1aeb9444, f17c7aa0, and f34b67d6 | Current Lead session owner; active child peer orchestration | Await handbacks from child audit peers (1aeb9444, f17c7aa0, f34b67d6) |

Only reuse a row when live state confirms the exact Parent Lead ID is this
Lead, the workspace matches, the Peer is not archived, and capability,
boundary, and context remain suitable. A missing or different parent ID means
the Peer belongs to another session and must not be sent to, archived, or
adopted.

## Archived peers

`archive_agent` does not edit this file automatically. Remove archived Peers
from Active and keep at most 12 compact summaries for this Lead session.

| Agent ID | Parent Lead ID | Provider / role | Capability | Brief | Owned boundary | Status | Handback summary | Context decision | Next action | Archive reason |
|---|---|---|---|---|---|---|---|---|---|---|
| `bcd166fa-6e53-415e-99cd-2443b87f1073` | `c6e1b1f6-43a5-4715-8d3b-5f2c2c0160a6` | peer-implementer | registry-maintenance | Session peer ledger maintenance and child peer registration | `.paseo/LEAD_PEER_REGISTRY.md` | archived; accepted | Session ledger was refreshed and the three child audit peers were registered. | accepted | none | ledger update accepted; no remaining assignment |
| `f34b67d6-7d03-408d-bc66-2eb747f4ef66` | `c6e1b1f6-43a5-4715-8d3b-5f2c2c0160a6` | peer-architect | cross-layer-conversion-audit | Read-only cross-layer conversion audit evaluating architecture alignment, data model integrity, and cross-tier conversion risks | Read-only entire repository; no file writes | archived | handback accepted with findings on schema-contract contradiction, production compatibility fallbacks, stale MySQL operational paths, English backend errors reaching the Vietnamese UI, and mock/optional proof gaps | accepted | none | accepted read-only handback; no remaining assignment |
| `1aeb9444-8e1b-43d0-ab7b-5b0d99649893` | `c6e1b1f6-43a5-4715-8d3b-5f2c2c0160a6` | peer-scout | sqlserver-compatibility-audit | Read-only SQL Server compatibility audit across schema, migrations, entities, repositories, and queries | Read-only entire repository; no file writes | archived | handback accepted with confirmed/high-confidence findings including unprefixed Vietnamese T-SQL literals, retained FOR UPDATE dialect path, timezone/default timestamp mismatch, skipped SQL Server/Flyway proof, missing SQL Server database bootstrap, pagination without deterministic ORDER BY, and concurrent UPDATE-then-INSERT risk | accepted | none | accepted read-only handback; no remaining assignment |
| `f17c7aa0-c201-4f47-9dac-ce3bf076a172` | `c6e1b1f6-43a5-4715-8d3b-5f2c2c0160a6` | peer-scout | vietnamese-localization-audit | Read-only Vietnamese localization audit across business terminology, UI strings, documentation, and database mappings | Read-only entire repository; no file writes | archived | handback accepted with findings on untranslated UI/backend strings, terminology/enum mismatches, inconsistent currency/date formatting, absent i18n bundles, and mock-only proof | accepted | none | accepted read-only handback; no remaining assignment |
| `e398d6f5-8ad1-4964-8c31-a12f4c62dd5c` | `c6e1b1f6-43a5-4715-8d3b-5f2c2c0160a6` | peer-reviewer | conversion-audit-proof-review | Read-only independent proof review and classification across SQL Server compatibility and Vietnamese localization audit claims | Read-only entire repository boundary | archived | accepted: 17 of 18 claims confirmed; claim 3 (runtime timezone expiry mismatch) not supported because Java Clock drives both deadline creation and expiry scanning; repository invariants verified | accepted | none | accepted independent proof review; no remaining assignment |

## Handoff packet

When remaining context falls below 70%, record only the objective, constraints,
owned files, exact child IDs/parents, evidence, blockers, and next action here
or in `.paseo/LEAD_HANDOFF.md`. Continue the same session after compaction if
that context remains relevant; otherwise start a new owned session from the
packet and never mix its Peer IDs with the old session.
