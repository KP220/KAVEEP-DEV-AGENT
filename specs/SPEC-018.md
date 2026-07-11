# SPEC-018

## Controlled Source Write-Back

Owner: KAVEEP-DEV-AGENT

### Purpose

SPEC-018 applies one exactly reviewed and approved sandbox change set back to its original source repository. It is the first source-writing capability and is therefore isolated from DEV-Orchestrator, Engineering Brain, Git, release, and deployment.

### Preconditions

- exact verified Secure Sandbox identity;
- `ready_for_review` Reviewed Change;
- consumed SPEC-017 verification result with matching patch hash;
- immediate regeneration of Reviewed Change from current source and sandbox;
- identical patch hash and change inventory;
- no protected, linked, binary, drifted, oversized, or escaped path;
- unused write-verification binding in a dedicated ledger.

### Transaction

All added and modified content is staged in same-directory exclusive temporary files. Original modified/deleted files are moved to same-directory rollback backups immediately before replacement/removal. Operations are committed in deterministic path order. Any failure triggers reverse-order rollback and removal of staged artifacts. A failed or successful write binding cannot be reused.

### Boundary

SPEC-018 performs no Git operation, branch, commit, push, merge, release, deployment, dependency execution, or test execution. Successful write-back still requires subsequent repository validation and review.

