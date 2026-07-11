# SPEC-022

## Durable Standalone Session

SPEC-022 persists standalone engineering sessions in a dependency-free local store. Requests and results are content-addressed; state events form an append-only SHA-256 chain; checkpoints and records are atomically replaced; a cross-process lock serializes mutation.

Persistence rejects secret-like keys and credential patterns. Retention is declarative and never deletes automatically. Unknown major formats and implicit migration fail closed. Replay verifies every event, payload, request/result artifact, and record correlation.

Recovery never continues inside a prior sandbox or skips a prior gate. It creates a linked attempt at `received` and reruns Authority Snapshot/Mission Lock drift checks before any repository analysis. Cancellation verifies the chain first, cleans a retained sandbox, and only then records `cancelled`. Corruption blocks both recovery and cleanup mutation pending explicit inspection.

Acceptance requires terminal replay, injected-crash replay, restart-from-received with governance recheck, tamper rejection, secret rejection, cancellation cleanup, and preservation of the source repository.
