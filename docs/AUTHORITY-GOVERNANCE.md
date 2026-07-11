# Authority Governance

Authority: ENGINEERING-CONSTITUTION.md and SPEC-010

## Purpose

Authority Governance establishes the read-only Mission Lock boundary that must precede DEV-Orchestrator. It makes authority evidence explicit and detects observable governance drift without granting authority or redefining records owned by the KAVEEP Master Book, Constitution, Roadmap, POLICY, KCP, or KAVEEP-COMMAND-CENTER.

## Runtime flow

```text
Explicit approved repository root
        |
        v
Explicit authority document configuration
        |
        v
Authority Snapshot (path + precedence + SHA-256 evidence)
        |
        v
Mission Lock (principles + protected artifacts + prohibited categories)
        |
        v
Governance Drift Detector
        |
        +-- aligned ----> read-only pipeline may continue
        |
        +-- blocked ----> restore evidence or use owning governance process
        |
        +-- unverified -> gather more evidence
```

## Authority Snapshot rules

- Inputs are explicit regular UTF-8 text files beneath one canonical approved root.
- Paths, document IDs, and precedence values are unique.
- Links, escapes, sensitive paths, ignored paths, binary content, and oversized files are rejected.
- Each document is recorded with a SHA-256 digest and byte count.
- The snapshot is evidence and never creates or replaces authority.
- Cross-repository authority remains owned by its source repository.

## Mission Lock rules

- Every snapshotted authority document must be protected.
- At least one locked principle and one prohibited autonomous change category are required by runtime validation.
- Mission, identity, constitution, governance, authority hierarchy, protected policy, budget authority, human approval rules, KCP authority, and repository ownership may not be changed autonomously.
- Mission Lock grants no planning, execution, write, Git, release, or deployment authority.

## Drift semantics

`aligned` means every supplied authority document still matches its snapshot and no supplied proposal targets a protected boundary. It does not authorize execution.

`blocked` means a document is missing or modified, a protected artifact or locked principle is targeted, a prohibited change category is declared, or a proposed path is unsafe.

`unverified` means evidence could not be checked reliably. Missing Mission Lock or Snapshot evidence fails before a result is produced.

Hash changes are intentionally strict. The detector does not infer that rewritten governance text is semantically equivalent. A legitimate governance amendment must complete its owning process before a new snapshot is established.

## Orchestrator integration rule

SPEC-011 DEV-Orchestrator consumes only schema-valid `aligned` Governance Drift Results before interpretation and after planning. It does not recreate, reinterpret, weaken, or silently refresh Authority Snapshot or Mission Lock evidence.
