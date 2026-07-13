# Version 1 acceptance matrix

Status recorded: 2026-07-13. This document is a release-decision aid, not a
release declaration. A green test suite cannot promote an item without the
listed evidence.

| Requirement | Current status | Authoritative evidence | Version 1 decision |
| --- | --- | --- | --- |
| Ecosystem contracts and governance boundaries | passed | Contract examples, capability-manifest regression tests, and `docs/ECOSYSTEM-INTEGRATION-BASELINE.md` | accepted |
| No autonomous source-write, Git, release, or deployment authority | passed | Standalone-session, controlled-write, controlled-Git, and Command Center tests | accepted |
| Durable session integrity, recovery, and cancellation | passed | Durable-session tests plus cancellation regression in `tools/test-standalone-engineering-session.mjs` | accepted |
| Governed local interaction | passed | Command Center SSE/cancellation regression and loopback live check in `docs/LOCAL-RUNTIME-EVIDENCE.md` | accepted |
| Local model endpoint | scoped live-certified | `/v1/models` and completion probes recorded in `docs/LOCAL-RUNTIME-EVIDENCE.md` | accepted only for endpoint availability |
| Package integrity and installable preview | passed | `node tools/release-readiness.mjs` runs syntax and `npm pack --dry-run` | accepted for preview only |
| Windows CurrentUser DPAPI | live-certified | `evidence/windows-dpapi-current-user.json` consumed by release readiness | accepted on this Windows user/runtime only |
| Node container isolation | blocked | Docker CLI is installed but the Docker daemon pipe is unavailable | not accepted |
| Python, Go, and Rust container profiles | blocked | Python command is present; Go and Rust are absent; no profile has live Docker evidence | not accepted |
| Representative real-task quality, cost, and latency evaluation | pending | Deterministic four-task scoring baseline exists in `tools/test-engineering-evaluation-runner.mjs`; no live-model corpus or provider cost evidence exists | not accepted |
| Signed migration and upgrade path | pending | Signed JSON migration primitive and regression test exist; no target upgrade plan, backup rehearsal, or independent review exists | not accepted |

## Current release decision

The package is an **installable preview**, not a Version 1 production release.
`npm test` must pass all registered quality gates, but that is only one input to
this matrix. A Version 1 decision additionally requires the currently blocked
or pending rows to become evidence-backed on the target runtime.

## Required evidence before Version 1

1. Start Docker Desktop and live-certify the Node profile, then the Python, Go,
   and Rust profiles against pinned images and representative fixtures.
2. Add a scored, reproducible evaluation corpus covering bug fixes, refactors,
   test writing, and multi-file changes. Record quality, cost, and latency
   baselines without treating provider output as authorization.
3. Implement, test, and independently review signed migration/upgrade tooling.
4. Re-run this matrix on the intended production target and make the release
   decision explicitly; no tool, test, or manifest may self-promote the status.
