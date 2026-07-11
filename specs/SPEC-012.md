# SPEC-012

## Durable Orchestration Persistence and Audit

Owner: KAVEEP-DEV-AGENT

### Purpose

SPEC-012 adds a dependency-free local durable store for SPEC-011 runs. It preserves orchestration inputs and results as content-addressed artifacts, records transitions in an append-only SHA-256 hash chain, writes atomic durable checkpoints, detects corruption, verifies deterministic event replay, and supports safe cross-process recovery.

### Storage model

```text
store-manifest.json
artifacts/<sha256>.json
runs/<run-id>/run-record.json
runs/<run-id>/events.jsonl
runs/<run-id>/checkpoint.json
```

Artifacts use canonical JSON and their filename is their SHA-256 digest. Run records and checkpoints are replaced atomically through same-directory temporary files and rename. Event records are append-only and form a sequence-checked hash chain. A cross-process exclusive lock serializes store mutation.

### Redaction and secret behavior

Persistence is allow-structured and reject-on-secret. Keys that appear to contain passwords, secrets, tokens, credentials, private keys, or authorization values are rejected before persistence. Known credential-like value patterns are rejected. The store does not silently redact data required for recovery because silent redaction would make replay ambiguous. Callers must submit already-safe structured input.

### Retention

The manifest records retention days and maximum runs. SPEC-012 reports expired records but performs no automatic deletion. Destructive retention enforcement requires a later explicit cleanup capability and approval boundary.

### Migration

Store and record formats are versioned. Unknown major versions fail closed. SPEC-012 performs no implicit migration. Migration must create a new verified store or use a separately reviewed forward migration that preserves artifact hashes and audit provenance.

### Corruption detection

Replay verifies event sequence, previous-event hash, event hash, payload artifact existence, canonical artifact hash, checkpoint correlation, and run-record correlation. Any mismatch returns corrupted and prevents recovery.

### Recovery and cross-process resume

SPEC-012 never resumes by jumping directly to a previously reported state. Recovery loads and verifies the original persisted input, verifies the complete audit chain and checkpoint, and then starts a new linked recovery attempt from `received`. SPEC-011 therefore reruns Governance Drift Detection before interpretation and after planning. Previous transitions remain immutable evidence.

This restart-from-received behavior is the only supported cross-process resume semantic in SPEC-012. Mid-stage continuation is intentionally unsupported.

### Acceptance criteria

- persistence, audit event, replay, and recovery contracts validate;
- artifacts are content-addressed and verified;
- events are append-only, ordered, and hash chained;
- checkpoints are written atomically after transitions;
- secret-like input is rejected;
- tampered events, artifacts, checkpoints, or records prevent recovery;
- recovery creates a linked attempt and reruns governance from received;
- retention and migration limitations remain explicit;
- existing quality gates continue to pass.

