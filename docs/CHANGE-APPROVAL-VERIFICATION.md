# Exact-Hash Change Approval Verification

Authority: SPEC-017 and KAVEEP-POLICY-owned approval/risk contracts

DEV-AGENT does not create human approval. It verifies a signed integration attestation that binds one reviewer decision to one Reviewed Change patch hash and correlated POLICY Approval Request and Risk Assessment.

Verification requires exact references, approved POLICY status, execution-allowed risk evidence, matching action/risk levels, HMAC-SHA256 signature, reviewer identity, valid issue/expiry window, non-revoked decision, and an unused one-time nonce/hash pair. Successful evidence is atomically recorded in a local consumption ledger.

The trust secret is supplied only through `KAVEEP_APPROVAL_VERIFY_SECRET`. It is never persisted or returned. Verification produces `eligible_for_revalidation`, not source-write authority. Source and patch hashes must be checked again immediately before any future application.

```text
KAVEEP_APPROVAL_VERIFY_SECRET=<runtime-secret> npm run approval:verify-change -- <reviewed-change.json> <approval-request.json> <risk-assessment.json> <attestation.json> <ledger-root>
```
