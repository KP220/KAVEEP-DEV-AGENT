# Controlled Source Write-Back

Authority: SPEC-018

Controlled Source Write is the first capability permitted to modify the original source repository. It remains disconnected from DEV-Orchestrator and may run only from an explicit request containing a Reviewed Change, SPEC-017 verification result, and trusted approval-consumption ledger reference.

Immediately before staging, the runtime regenerates the complete Reviewed Change from current source and sandbox state and requires exact patch hash and change inventory equality. Modified and deleted originals are moved to same-directory backups; new content is written to exclusive same-directory stage files. Failure triggers reverse-order rollback.

Every approval verification may reserve only one write attempt. Successful and failed attempts cannot be replayed. The result records no Git operation and requires repository validation after success.

```text
npm run write:controlled -- <controlled-write-request.json> <write-ledger-root>
```

Unexpected process termination during the commit section remains a prototype limitation requiring manual recovery of `.kaveep-backup-*` artifacts. A durable transaction journal and recovery command are required before production enablement.
