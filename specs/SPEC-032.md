# SPEC-032

## Per-session Durable Concurrency

SPEC-032 replaces the store-wide mutation lock with an async-context lock identity derived from the durable session ID. Different sessions can progress concurrently while the same session ID retains exclusive mutation and duplicate-record rejection.

Artifacts remain content-addressed and atomic; events, checkpoints, records, and cleanup are scoped by session. The production soak launches twenty durable sessions concurrently and verifies every independent hash chain afterward. Orphan lock detection covers per-session lock files.

This certifies concurrent sessions within one Node process and the existing cross-process exclusive-file lock behavior. Distributed multi-host storage is not implied.
