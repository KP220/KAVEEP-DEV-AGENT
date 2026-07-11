# SPEC-010

## Authority Snapshot, Mission Lock, and Governance Drift Detection

Owner: KAVEEP-DEV-AGENT

### Purpose

This capability establishes a deterministic, read-only governance boundary before DEV-Orchestrator is introduced. It captures an evidence-backed authority chain, represents protected mission and governance invariants, and detects observable drift or proposed protected changes without interpreting policy, granting approval, invoking KCP, or authorizing execution.

### Authority Snapshot

An Authority Snapshot is built only from explicitly declared UTF-8 text documents beneath one canonical approved repository root. Every document has an explicit precedence, authority type, repository owner, relative path, SHA-256 digest, byte count, and verification status. Duplicate precedence, duplicate paths, missing files, path escapes, directories, links, sensitive paths, binary content, and files above the configured bound are rejected.

The snapshot records evidence; it does not declare itself authoritative and does not replace the KAVEEP Master Book, Constitution, Roadmap, POLICY, KCP, or human governance. Cross-repository authority must be supplied by its owning repository through separately verified evidence rather than silently copied or redefined.

### Mission Lock

Mission Lock is an explicit contract defining:

- protected mission and identity principles;
- protected authority and governance artifacts;
- autonomous change categories that are prohibited;
- decisions requiring KCP consideration;
- decisions requiring explicit human approval.

A Mission Lock never grants permission. An empty or missing lock is unverified and cannot be interpreted as freedom to change governance.

### Governance Drift Detection

The detector compares a verified Authority Snapshot with the current files under the same approved root and optionally evaluates a structured proposed-change list. It detects missing, modified, inaccessible, escaped, linked, or otherwise unverifiable authority artifacts. It also blocks proposed create, modify, rename, or delete operations that target protected artifacts or declare effects on locked principles or prohibited autonomous change categories.

Results are deterministic and default to `blocked` for observed governance drift or protected proposals, `unverified` for insufficient or unverifiable evidence, and `aligned` only when all supplied evidence remains consistent.

### Safety and ownership boundaries

- The capability is read-only and performs no file modification.
- It does not infer semantic equivalence between document versions.
- A changed hash is drift even when prose appears equivalent.
- It does not create POLICY decisions, approvals, KCP decisions, missions, workflows, or Command Center records.
- It does not authorize planning, sandbox creation, editing, source write-back, Git, release, or deployment.
- DEV-Orchestrator must consume an aligned result but must not reinterpret or weaken it.
- Governance changes require their owning authority process; refreshing a snapshot is not approval of a change.

### Acceptance criteria

- Authority Snapshot, Mission Lock, and Governance Drift Result schemas and examples validate.
- Explicit authority files are hashed deterministically beneath an approved canonical root.
- path escape, links, missing files, duplicate precedence, duplicate paths, binary files, and oversized inputs are rejected.
- current-file modification or removal is detected and blocked.
- protected proposed changes are detected and blocked.
- unrelated proposed changes do not create false governance authority.
- focused tests prove read-only behavior and all existing quality gates continue to pass.

