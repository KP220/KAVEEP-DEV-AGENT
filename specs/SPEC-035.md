# SPEC-035

## Repository Truthfulness and Zero-Budget Readiness Baseline

Version: 0.1

Status: SPECIFIED 

Repository: KAVEEP-DEV-AGENT

---

## 1. Purpose

This specification defines the correction baseline required before
KAVEEP-DEV-AGENT receives additional major capabilities.

The correction milestone exists to repair:

- inaccurate maturity claims
- documentation drift
- provider and runtime configuration mismatches
- permissive external-contract test fixtures
- misleading integration claims
- ambiguous verification language
- inaccurate release and distribution claims
- inaccurate quality-gate reporting

This milestone is a correction pass.

It is not a feature-development milestone.

---

## 2. Product Direction

KAVEEP-DEV-AGENT is the first KAVEEP engineering product being developed
toward complete operational maturity.

When mature, it will be used to build, verify, improve, and maintain other
KAVEEP repositories and agents.

KAVEEP-DEV-AGENT must eventually provide:

- repository inspection
- specification discovery
- architecture discovery
- natural-language task input
- Thai and English interaction
- engineering planning
- sandboxed editing
- deterministic validation
- bounded repair attempts
- diff review
- evidence reporting
- explicit human approval
- controlled source writes
- controlled Git delivery
- durable recovery
- zero-cost local-model operation
- a practical user experience comparable to Codex

These are product requirements.

They must not be reported as completed until executable evidence supports
the claim.

---

## 3. Zero-Budget Requirement

KAVEEP-DEV-AGENT shall provide a fully usable core operating mode that
requires:

- no paid API
- no mandatory subscription
- no mandatory paid cloud service
- no mandatory credit card
- no mandatory metered token service

The core operating mode must use software and models that are free to
install and use under their applicable licenses.

Optional paid providers may be supported later.

Paid providers must never be required for the core product to operate.

Until a real local-model runtime is implemented and live tested, the
zero-budget operating mode status must remain:

`PLANNED` or `UNVERIFIED`

It must not be reported as complete.

---

## 4. Codex-Level Experience Requirement

KAVEEP-DEV-AGENT is not considered product-complete until a user can:

1. Open the application.
2. Select a repository.
3. Enter a natural-language task in Thai or English.
4. Observe repository discovery.
5. Review the proposed engineering plan.
6. Allow work inside a secure sandbox.
7. Observe progress while tools execute.
8. Review test, lint, typecheck, and build results.
9. Observe bounded repair attempts.
10. Review changed files and diffs.
11. Approve or reject source writes.
12. Perform controlled Git delivery.
13. Recover an interrupted session.

The user must not normally be required to:

- manually construct multiple JSON configuration files
- copy session identifiers between commands
- enter long internal runtime commands
- understand internal schema structures
- manually prepare authority artifacts for routine operation

Until this workflow exists and is tested with real repositories, the
Codex-level experience status must remain:

`PLANNED`, `IMPLEMENTED`, `UNIT_TESTED`, or `UNVERIFIED`

It must not be marked `LIVE_CERTIFIED` without live evidence.

---

## 5. Scope

This specification permits correction of existing implementation and
documentation only.

The correction work may include:

- provider validation
- configuration validation
- status correction
- maturity correction
- quality-gate reporting correction
- external-contract certification correction
- test-fixture labeling
- secret-boundary regression tests
- release-readiness correction
- documentation consistency checks

---

## 6. Out of Scope

This specification must not implement:

- Ollama support
- Local LLM execution
- Qwen integration
- DeepSeek integration
- Gemma integration
- Typhoon integration
- generic local OpenAI-compatible endpoints
- desktop application UI
- autonomous pull-request delivery
- new multi-agent behavior
- new self-development authority
- paid API execution

These capabilities require later specifications.

---

## 7. Verification States

The following verification conclusions are authoritative.

### VERIFIED

Executed evidence sufficiently supports the claim.

### REJECTED

Executed evidence proves that the requirement was not met.

### UNVERIFIED

The requirement was not executed, evidence is incomplete, evidence is
inaccessible, or evidence is insufficient.

### BLOCKED

Verification could not proceed because a required dependency, contract,
runtime, permission, secret, or environment was unavailable.

### CONFLICTED

Material evidence sources disagree and the conflict remains unresolved.

---

## 8. Maturity States

### SPECIFIED

A normative specification exists.

### IMPLEMENTED

Executable implementation exists.

### UNIT_TESTED

Automated unit tests using isolated or mocked dependencies executed
successfully.

### INTEGRATION_TESTED

Real compatible components were tested together successfully.

### LIVE_CERTIFIED

The capability was executed successfully in its required real runtime or
external environment.

### PLANNED

The capability is described but executable implementation does not yet
exist.

### UNVERIFIED

Implementation or execution evidence is insufficient.

### BLOCKED

A required dependency or environment prevented execution.

---

## 9. Evidence Rules

The following rules are mandatory:

1. Test existence is not test execution.
2. Unit testing is not integration testing.
3. Integration testing is not live certification.
4. A mock is not a real dependency.
5. A fixture is not a canonical external contract.
6. A permissive schema is not compatibility evidence.
7. Confidence is not truth.
8. Absence of evidence is not evidence of falsehood.
9. Insufficient evidence must result in `UNVERIFIED`.
10. Missing required infrastructure must result in `BLOCKED`.
11. A result must never be called successful merely because a file was
    created.
12. Live certification must identify the real runtime used.

---

## 10. External Contract Rules

KAVEEP-DEV-AGENT internal tests must remain executable without sibling
KAVEEP repositories.

However:

- missing external contracts must not be replaced by allow-all schemas
- test-only fixtures must not be treated as canonical contracts
- test-only fixtures must not produce `VERIFIED`
- external integration must be reported separately from internal tests
- unavailable required contracts must produce `BLOCKED`
- compatibility not executed must produce `UNVERIFIED`

Test-only external fixtures must be visibly labeled:

- `TEST_ONLY`
- `NOT_CANONICAL`
- `NOT_CERTIFICATION_EVIDENCE`

---

## 11. Provider Truthfulness

The runtime must execute the provider selected by configuration.

The following rules are mandatory:

- unsupported provider identifiers fail early
- provider metadata must match the executing adapter
- no silent provider fallback is permitted
- no silent fallback to a paid provider is permitted
- provider secret requirements must be explicit
- network requirements must be explicit
- offline capability must be explicit
- missing required credentials must produce `BLOCKED`
- secret values must never appear in reports or durable records

Until local-model providers are implemented, they must be marked
`PLANNED`.

---

## 12. Secret Safety

Raw secrets must never enter:

- persisted configuration
- durable sessions
- workspace indexes
- retrieval snippets
- model transcripts
- reports
- audit events
- validation output
- test-generated Git diffs

Secret redaction must occur before persistence boundaries.

The implementation must continue protecting:

- private keys
- API-key-like values
- bearer tokens
- authorization headers

---

## 13. Quality-Gate Reporting

Quality-gate reporting must distinguish:

- `PASSED`
- `FAILED`
- `BLOCKED`
- `SKIPPED`
- `UNVERIFIED`

The gate count must be calculated from the executable gate list.

A manually written stale gate count must not be authoritative.

Mock-based gates must identify their evidence as unit-level evidence.

Runtime-unavailable live checks must report `BLOCKED`, not `PASSED`.

---

## 14. Release Truthfulness

The repository must report only distribution modes supported by evidence.

It must not claim the existence of:

- a public npm release
- a signed Windows installer
- a portable executable
- an automatic updater
- a signed production release
- production deployment
- a completed rollback release manager

unless those artifacts exist and were tested.

The package `private` setting must not be removed merely to make a release
claim pass.

---

## 15. Human Authority

Humans remain the final authority.

The agent must not:

- write reviewed source changes without required approval
- promote its own unreviewed changes
- weaken approval requirements
- treat silence as approval
- claim ecosystem-wide authority
- approve its own self-development release

---

## 16. Acceptance Criteria

SPEC-035 is accepted when evidence confirms that:

1. Documentation reflects the actual repository state.
2. The highest SPEC is reported accurately.
3. The executable quality-gate count is reported accurately.
4. Unsupported provider identifiers are rejected.
5. Provider metadata matches the executing adapter.
6. Missing required secrets produce `BLOCKED`.
7. No silent paid-provider fallback exists.
8. External allow-all contracts are not used as certification evidence.
9. Test-only fixtures cannot produce `VERIFIED`.
10. Missing external contracts produce `BLOCKED` or `UNVERIFIED`.
11. Mock tests are not described as live certification.
12. Runtime-unavailable checks are not reported as passed.
13. Release claims match actual artifacts.
14. Raw secrets remain outside persistence boundaries.
15. Internal tests require no paid API call.
16. No other KAVEEP repository is modified.
17. No unsupported major capability is added.
18. `git diff --check` reports no whitespace errors when executed in a Git
    environment.

---

## 17. Required Next Milestone

After this correction specification is implemented and verified, the next
planned specification is:

`SPEC-036 — Zero-Cost Local LLM Runtime`

SPEC-036 will define the implementation of a real no-paid-API operating
mode using a free local model runtime.
