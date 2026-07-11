# SPEC-019

## Durable Write Transaction Journal and Crash Recovery

Owner: KAVEEP-DEV-AGENT

### Purpose

SPEC-019 wraps Controlled Source Write with an external durable transaction journal and pre-write rollback snapshot. It recovers from abrupt process termination without trusting incomplete in-process state.

### Journal

Before SPEC-018 begins, the wrapper verifies every before/after hash, stores original modified/deleted content in a transaction-owned backup directory, records added paths, writes an atomic `prepared` journal, then advances to `applying`. Terminal states are `completed`, `rolled_back`, `recovered`, and `manual_recovery_required`.

### Recovery

Recovery preflights every path before mutation. Modified files may be restored only when current content equals the approved before or after hash. Deleted files may be restored only when absent or equal to the approved before hash. Added files may be removed only when absent or equal to the approved after hash. Any unknown state blocks all automatic recovery.

Recovery is idempotent, bounded, source-root correlated, and hash verified. It performs no Git operation.

