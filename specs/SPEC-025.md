# SPEC-025

## Local Review, Approval, and Apply Workflow

SPEC-025 composes Reviewed Change, POLICY-compatible approval/risk records, one-time exact-hash attestation verification, and durable controlled write-back for standalone/local use.

Approval is never inferred. The human must inspect the patch and type `APPROVE <full 64-character patch SHA-256>`. The bundle is bound to the Reviewed Change, reviewer identity, short validity window, random nonce, HMAC-SHA256 signature, and one-time consumption ledger. A mismatch, expiry, revocation, forged signature, reused nonce/hash, source drift, sandbox drift, protected path, or missing provenance fails closed.

Apply immediately regenerates and compares the reviewed patch, creates an external transaction journal and backups, writes atomically, verifies post-write hashes, and rolls back on ordinary failures. It performs no Git, commit, push, release, or deployment action.
