# SPEC-017

## Exact-Hash Change Review and Approval Verification

Owner: KAVEEP-DEV-AGENT

### Purpose

SPEC-017 verifies that a human-review attestation is cryptographically bound to one Reviewed Change patch hash and correlated KAVEEP-POLICY approval and risk records. It does not replace POLICY ownership or create approval.

### Required evidence

- a `ready_for_review` Reviewed Change with verified source snapshot;
- a POLICY-owned Approval Request with approved status;
- a POLICY-owned Risk Assessment allowing the exact declared action;
- a signed review attestation referencing all records, patch hash, reviewer, issue time, expiry, nonce, and one-time-use requirement;
- an invocation-only trusted verification secret;
- an append-only local consumption ledger.

### Verification

The verifier checks schema shape, exact references, patch hash, risk and approval agreement, HMAC-SHA256 signature, validity window, non-revoked decision, and unused nonce/hash binding. Approved evidence is atomically consumed once. Reuse, mismatch, expiry, rejection, corruption, or unverifiable identity fails closed.

### Boundary

Verification produces evidence only. It does not apply changes, authorize itself, modify source, invoke Git, or replace future revalidation immediately before write-back.

