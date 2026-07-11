# Durable Orchestration Persistence and Audit

Authority: SPEC-012

SPEC-012 stores safe structured orchestration inputs, transitions, checkpoints, and terminal results without external dependencies. JSON artifacts are canonicalized, addressed by SHA-256, and verified when read. Audit events are append-only JSONL records with strict sequence and previous-event hashes. Run records and checkpoints use same-directory atomic replacement.

## Recovery semantics

Cross-process resume is deliberately implemented as verified restart from `received`. Replay must first verify the event chain, payload artifacts, run record, and checkpoint. Recovery then creates a linked attempt and reruns both SPEC-010 governance checks. It never jumps to `planned`, `completed`, or any earlier checkpoint state.

## Redaction

The store rejects secret-like keys and credential-like values before persistence. It does not silently redact recovery-critical fields. Inputs must already be safe and structured.

## Retention and migration

Retention days and maximum runs are recorded, but automatic deletion is disabled. Unknown major format versions fail closed. No implicit migration occurs. Cleanup and migration require separately reviewed capabilities.

## CLI

```text
npm run orchestrate:persist -- <store-root> <repository-root> <snapshot.json> <mission-lock.json> <command>
npm run orchestrate:replay -- <store-root> <run-id>
npm run orchestrate:recover -- <store-root> <run-id>
```
