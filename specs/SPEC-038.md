SPEC-038

Repository Capability Manifest and Status Truth

Version: 0.1

Status: SPECIFIED

Repository: KAVEEP-DEV-AGENT

Authority: ENGINEERING-CONSTITUTION.md

⸻

1. Purpose

This specification defines the Repository Capability Manifest and Status Truth capability for KAVEEP-DEV-AGENT.

The capability establishes a deterministic and machine-readable source of truth for repository capabilities, implementation state, validation state, certification state, evidence, limitations, and engineering drift.

The capability exists to prevent repository documentation, specifications, schemas, implementations, tests, quality gates, certification evidence, and runtime claims from silently contradicting one another.

Repository status must be derived from evidence.

Repository status must not be inferred from confidence, intention, filenames, roadmap language, or the absence of known failures.

Insufficient evidence must produce UNVERIFIED.

⸻

2. Problem Statement

KAVEEP-DEV-AGENT contains multiple representations of engineering progress, including:

* README status tables;
* architecture version and status declarations;
* engineering specifications;
* JSON schemas;
* source implementations;
* regression tests;
* registered quality gates;
* runtime certification tools;
* durable evidence records;
* release-readiness reports;
* historical engineering reports.

These representations may evolve at different speeds.

A specification may exist without implementation.

Implementation may exist without tests.

Tests may exist without being registered as quality gates.

A quality gate may be registered without successful execution evidence.

A runtime adapter may exist while its required runtime is unavailable.

Documentation may claim an earlier milestone while implementation has advanced further.

Without a canonical status contract, the repository may produce misleading or contradictory claims.

This specification prevents such claims from being silently accepted as repository truth.

⸻

3. Scope

This specification governs:

* repository capability registration;
* capability identity;
* governing specification correlation;
* implementation-path correlation;
* test-path correlation;
* quality-gate correlation;
* capability status;
* certification status;
* evidence requirements;
* limitation reporting;
* milestone claims;
* package-version correlation;
* architecture-version correlation;
* documentation drift detection;
* deterministic manifest validation;
* structured validation results;
* fail-closed status derivation;
* audit evidence for repository status.

This specification applies only to status observation and validation.

Validation performed under this specification is read-only.

⸻

4. Non-Goals

This specification does not authorize:

* automatic source modification;
* automatic README correction;
* automatic architecture correction;
* automatic manifest correction;
* Git staging;
* Git commits;
* Git pushes;
* pull-request creation;
* pull-request merging;
* release publication;
* deployment;
* arbitrary process execution;
* unrestricted shell execution;
* network access;
* credential access;
* policy modification;
* governance modification;
* KCP approval;
* human-approval replacement.

The validator reports contradictions.

The validator must not silently repair contradictions.

⸻

5. Constitutional Authority

This specification derives authority from:

1. KAVEEP Constitution;
2. KAVEEP Roadmap;
3. KAVEEP-POLICY;
4. ENGINEERING-CONSTITUTION.md;
5. ENGINEERING-CHARTER.md;
6. ENGINEERING-PHILOSOPHY.md;
7. ARCHITECTURE.md;
8. ENGINEERING-LIFECYCLE.md;
9. ENGINEERING-WORKFLOW.md;
10. REPOSITORY-STANDARD.md.

This specification must preserve the following constitutional principles:

* Engineering Before Implementation;
* Architecture Before Code;
* Specification Before Development;
* Governance Before Execution;
* Evidence Before Engineering Decisions;
* Validation Before Trust;
* Traceability for Every Engineering Artifact;
* Human Approval for Protected Engineering Actions;
* Unknown Evidence Must Not Strengthen Trust;
* Insufficient Evidence Must Produce UNVERIFIED.

No lower-level implementation may weaken these principles.

⸻

6. Definitions

6.1 Repository Capability

A bounded engineering ability represented by one stable capability identifier.

A capability may include:

* one or more governing specifications;
* source implementation;
* tests;
* quality gates;
* runtime dependencies;
* certification evidence;
* known limitations.

6.2 Canonical Capability Manifest

The committed machine-readable document describing the repository’s declared capability state and supporting evidence.

The canonical manifest is a claim subject to validation.

Its existence does not prove that its claims are true.

6.3 Capability Status

The evidence-supported engineering state of a capability.

6.4 Certification Status

The evidence-supported status of external, runtime, independent, or production verification.

Capability status and certification status are separate concerns.

6.5 Evidence

A concrete repository artifact supporting a status claim.

Evidence may include:

* an approved specification;
* an implementation file;
* a regression test;
* quality-gate registration;
* successful test output preserved as an approved artifact;
* live certification output;
* independent review evidence;
* production evidence.

A path string alone is not proof that the referenced evidence exists or supports the claim.

6.6 Limitation

A known boundary, unavailable dependency, unsupported environment, unresolved contradiction, incomplete certification, or other condition restricting a claim.

6.7 Drift

A contradiction between two or more repository truth representations.

6.8 Fail-Closed

Ambiguous, incomplete, unsupported, conflicting, malformed, or unverifiable status claims must not be accepted as stronger claims.

6.9 Blocking Drift

Drift capable of making the canonical manifest materially misleading, unsafe, or inconsistent with governing authority.

6.10 Non-Blocking Drift

A contradiction that must be reported but does not make the manifest structurally or semantically invalid.

⸻

7. Truth Principles

7.1 Evidence Before Status

Every capability and certification claim must identify supporting evidence.

7.2 No Status by Filename Alone

The existence of a file with an expected name does not independently prove implementation quality, execution, validation, or certification.

7.3 No Automatic Promotion

Capability states must not be automatically promoted merely because a lower state is present.

7.4 Missing Evidence Produces UNVERIFIED

Missing evidence must never be interpreted as successful verification.

7.5 Runtime Unavailable Is Not Failure

When required live infrastructure is unavailable and execution does not occur, the certification status is UNVERIFIED.

It must not be reported as LIVE_CERTIFIED.

It must not be reported as failed unless a real execution occurred and produced a failure result.

7.6 Registered Gate Is Not Execution Evidence

A test registered in the quality-gate runner proves only that the gate is registered.

Successful execution evidence is a separate claim.

7.7 Conflicting Evidence Must Remain Visible

The validator must report conflicting evidence.

It must not select the more favorable claim and discard the contradiction.

7.8 Historical Evidence Must Be Preserved

Historical status records may remain in the repository when clearly identified as historical.

Historical records must not be treated as the current canonical status.

7.9 Human Authority Remains Highest

The manifest and validator provide evidence and status analysis.

They do not replace human review or protected-action approval.

⸻

8. Capability Status Model

The following capability-status values are defined.

8.1 PROPOSED

A capability has been proposed but does not yet have an approved governing specification.

8.2 SPECIFIED

A governing specification exists.

SPECIFIED does not imply implementation.

8.3 IMPLEMENTED

Repository source evidence supporting the capability exists.

IMPLEMENTED does not imply that tests pass.

8.4 SELF_TESTED

Repository-owned automated tests supporting the capability exist and have available self-test evidence.

SELF_TESTED does not imply independent validation.

8.5 INTEGRATION_TESTED

The capability has evidence of integration testing with relevant repository components.

INTEGRATION_TESTED does not imply live-runtime certification.

8.6 LIVE_CERTIFIED

The capability has successful evidence from the real runtime or environment required by its specification.

Mock execution, adapter existence, unit tests, or runtime-unavailable results do not satisfy this state.

8.7 INDEPENDENTLY_REVIEWED

The capability has evidence of review independent from the implementation-producing authority.

Repeated execution by the same implementation and test authority is not automatically independent review.

8.8 PRODUCTION_PROVEN

The capability has approved evidence of successful production operation within defined conditions.

Production evidence must identify scope, version, environment, and limitations.

8.9 DEPRECATED

The capability remains identifiable but is no longer recommended for new use.

Deprecation does not authorize automatic removal.

8.10 BLOCKED

Development, validation, certification, or use is intentionally blocked by authority, policy, security, dependency, or unresolved risk.

8.11 UNVERIFIED

Available evidence is insufficient to determine a stronger supported state.

UNVERIFIED is a valid truth state.

It is not equivalent to passed.

It is not equivalent to failed.

⸻

9. Capability-State Invariants

The following implications are prohibited:

SPECIFIED != IMPLEMENTED
IMPLEMENTED != SELF_TESTED
SELF_TESTED != INTEGRATION_TESTED
INTEGRATION_TESTED != LIVE_CERTIFIED
LIVE_CERTIFIED != INDEPENDENTLY_REVIEWED
INDEPENDENTLY_REVIEWED != PRODUCTION_PROVEN

A capability may simultaneously have:

capabilityStatus: IMPLEMENTED
certificationStatus: UNVERIFIED

A capability may also be:

capabilityStatus: SELF_TESTED
certificationStatus: UNVERIFIED

No validator may strengthen a state merely because a stronger state would make documentation consistent.

⸻

10. Certification Status Model

Certification status must be represented independently from capability status.

The supported certification statuses are:

* NOT_REQUIRED;
* UNVERIFIED;
* SELF_TESTED;
* INTEGRATION_TESTED;
* LIVE_CERTIFIED;
* INDEPENDENTLY_REVIEWED;
* PRODUCTION_PROVEN;
* FAILED;
* BLOCKED;
* EXPIRED.

10.1 FAILED

FAILED requires evidence that a real applicable validation or certification attempt executed and produced a failing result.

Unavailable runtime infrastructure alone is not FAILED.

10.2 EXPIRED

Certification may expire because:

* repository version changed;
* implementation hash changed;
* authority changed;
* policy changed;
* runtime environment changed;
* certification validity period ended.

Expired evidence must not continue supporting a current certified claim.

⸻

11. Evidence Model

Each capability must contain an evidence array.

Each evidence entry must identify:

* evidence type;
* repository-relative path;
* claim supported;
* evidence status;
* limitations.

Supported evidence types include:

* SPECIFICATION;
* IMPLEMENTATION;
* TEST;
* QUALITY_GATE;
* INTEGRATION_RESULT;
* LIVE_CERTIFICATION;
* INDEPENDENT_REVIEW;
* PRODUCTION_RECORD;
* AUTHORITY_DOCUMENT;
* LIMITATION_RECORD.

Supported evidence statuses include:

* PRESENT;
* PASSED;
* FAILED;
* UNVERIFIED;
* UNAVAILABLE;
* EXPIRED;
* BLOCKED.

Evidence must use repository-relative normalized paths.

Absolute paths are prohibited.

Parent traversal such as ../ is prohibited.

Evidence paths must remain inside the repository boundary.

Empty evidence must not support:

* SELF_TESTED;
* INTEGRATION_TESTED;
* LIVE_CERTIFIED;
* INDEPENDENTLY_REVIEWED;
* PRODUCTION_PROVEN.

⸻

12. Canonical Manifest

The canonical manifest path is:

capabilities/repository-capability-manifest.json

The canonical manifest must include:

* schemaVersion;
* manifestVersion;
* repository;
* packageVersion;
* architectureVersion;
* authority;
* highestSpecifiedMilestone;
* highestImplementedMilestone;
* highestSelfTestedMilestone;
* highestLiveCertifiedMilestone;
* overallStatus;
* limitations;
* capabilities.

The canonical committed manifest must avoid volatile values that make deterministic comparison impossible.

A current timestamp must not be required in the canonical manifest.

Generated reports may include timestamps when deterministic comparison requirements are preserved separately.

⸻

13. Capability Entry Contract

Each capability entry must include:

* capabilityId;
* name;
* governingSpecification;
* implementationPaths;
* testPaths;
* qualityGate;
* capabilityStatus;
* certificationStatus;
* evidence;
* limitations;
* dependencies;
* lastReviewedVersion.

Capability identifiers must:

* be non-empty;
* use lowercase ASCII letters, digits, and hyphens;
* begin with a lowercase letter;
* remain stable after publication;
* be unique within the manifest.

Display names may change.

Capability identifiers must not be silently renamed.

⸻

14. Milestone Claims

The manifest must separately identify:

* highest specified milestone;
* highest implemented milestone;
* highest self-tested milestone;
* highest live-certified milestone.

These milestone claims must not be automatically copied from one another.

The highest specified milestone must correlate with an existing specification.

The highest implemented milestone requires implementation evidence governed by that milestone.

The highest self-tested milestone requires applicable test evidence.

The highest live-certified milestone requires successful applicable live-certification evidence.

When no milestone has sufficient live-certification evidence, the value must be UNVERIFIED.

⸻

15. Overall Status

Supported overall statuses are:

* VALID;
* DRIFT_DETECTED;
* UNVERIFIED;
* BLOCKED;
* DEPRECATED.

The repository must not be reported as fully verified merely because its canonical manifest is structurally valid.

Structural validity proves only that the document satisfies its schema.

⸻

16. Drift Classification

The validator must support at least these drift classifications:

16.1 DOCUMENTATION_DRIFT

README, architecture, roadmap, or status documentation contradicts the canonical manifest or repository evidence.

16.2 VERSION_DRIFT

Package, manifest, architecture, schema, or reviewed-version claims contradict one another.

16.3 SPECIFICATION_DRIFT

A referenced specification is missing, malformed, unsupported, or inconsistent with a capability claim.

16.4 IMPLEMENTATION_DRIFT

An implementation claim references missing or contradictory implementation evidence.

16.5 TEST_DRIFT

A test claim references missing tests or unsupported test evidence.

16.6 QUALITY_GATE_DRIFT

A capability claims a quality gate that is missing, mismatched, duplicated, or references a missing test.

16.7 CERTIFICATION_DRIFT

Certification claims exceed available certification evidence.

16.8 EVIDENCE_DRIFT

Evidence is missing, expired, contradictory, malformed, or incapable of supporting its declared claim.

16.9 MANIFEST_DRIFT

The canonical manifest contradicts deterministic repository evidence.

16.10 AUTHORITY_DRIFT

A status claim contradicts governing authority, mission lock, policy, or constitutional requirements.

⸻

17. Threat Model

The validator must defend against at least:

* false status promotion;
* certification inflation;
* missing evidence;
* stale evidence;
* duplicate capability identifiers;
* path traversal;
* absolute-path references;
* symlink ambiguity;
* specification-name spoofing;
* implementation-path spoofing;
* test-path spoofing;
* quality-gate-name spoofing;
* package-version mismatch;
* architecture-version mismatch;
* unsupported schema versions;
* unknown status values;
* undocumented capability removal;
* documentation claims that hide unverified status;
* treating runtime unavailability as successful certification;
* treating quality-gate registration as successful execution;
* silent automatic correction;
* non-deterministic output ordering;
* validator modification of repository files.

⸻

18. Deterministic Validation

Validation must proceed in this order:

Load Canonical Manifest
        ↓
Validate JSON Structure
        ↓
Validate Schema Version
        ↓
Validate Repository Boundary
        ↓
Validate Unique Capability IDs
        ↓
Validate Package Version
        ↓
Validate Specification References
        ↓
Validate Implementation References
        ↓
Validate Test References
        ↓
Validate Quality-Gate Correlation
        ↓
Validate Status and Evidence Consistency
        ↓
Validate Milestone Claims
        ↓
Inspect Documentation Claims
        ↓
Inspect Architecture Claims
        ↓
Classify Drift
        ↓
Produce Structured Result

The same repository state and same validator version must produce semantically equivalent results.

Findings must use stable deterministic ordering.

Validation must not depend on network access.

⸻

19. Validation Result

The validator must return a structured result containing:

* schemaVersion;
* status;
* repository;
* manifestPath;
* errors;
* drift;
* limitations;
* evidenceInspected;
* capabilitiesInspected;
* blocking.

Supported result statuses are:

* VALID;
* INVALID;
* DRIFT_DETECTED;
* UNVERIFIED.

19.1 VALID

The manifest is structurally and semantically valid and no blocking drift was detected.

VALID does not mean every capability is live certified.

19.2 INVALID

The manifest or referenced contract violates structural or semantic requirements.

19.3 DRIFT_DETECTED

The manifest is readable but one or more repository truth representations contradict one another.

19.4 UNVERIFIED

Validation could not determine a stronger result because required evidence or deterministic inspection capability was unavailable.

⸻

20. Failure Behavior

The validator must fail closed for:

* malformed JSON;
* unsupported schema version;
* unknown fields where prohibited;
* unknown status;
* duplicate capability identifiers;
* path traversal;
* absolute paths;
* missing required specification;
* missing claimed implementation;
* missing claimed test;
* missing claimed quality gate;
* certification without sufficient evidence;
* package-version mismatch;
* ambiguous repository root;
* evidence outside the repository boundary.

The validator must not:

* rewrite the manifest;
* update README;
* update architecture;
* create evidence;
* execute arbitrary commands;
* access the network;
* downgrade an error merely to produce a passing result.

⸻

21. Read-Only Requirement

Capability-manifest validation is a read-only engineering operation.

It may read only approved repository artifacts needed for deterministic validation.

It must not:

* modify files;
* create files;
* delete files;
* rename files;
* move files;
* stage Git changes;
* modify Git configuration;
* modify dependency state;
* access credential stores;
* access files outside the repository.

Temporary test fixtures must use isolated temporary directories and must not modify the real repository.

⸻

22. Quality-Gate Correlation

A capability claiming a quality gate must identify:

* the exact quality-gate name;
* the exact test path invoked by the gate.

The validator must confirm that:

* the gate is registered in tools/run-quality-gates.mjs;
* the gate name matches;
* the test path matches;
* the referenced test file exists.

A registered gate does not independently prove that the gate passed.

⸻

23. Documentation Drift

README and architecture documents may contain current-state claims.

The validator must inspect deterministic claims where technically practical, including:

* package version;
* highest implemented specification;
* number or identity of registered quality gates;
* capability implementation status;
* live certification claims;
* planned versus implemented claims.

Historical prose must not be treated as current-state drift when clearly marked as historical.

Ambiguous prose must be reported as a limitation or UNVERIFIED, not interpreted aggressively as fact.

⸻

24. Audit Requirements

Each validation result must preserve:

* manifest path;
* manifest version;
* repository identity;
* package version inspected;
* specifications inspected;
* implementation paths inspected;
* tests inspected;
* quality gates inspected;
* errors;
* drift findings;
* limitations;
* final status.

The validator must not persist raw credentials, secrets, bearer tokens, private keys, or unrelated repository content.

⸻

25. Compatibility

The initial supported manifest schema version is:

1.0.0

Unsupported future or past schema versions must fail closed.

Schema migration must be explicit.

The validator must not silently reinterpret a manifest written for another schema version.

⸻

26. Required Artifacts

Implementation of this specification requires:

specs/SPEC-038.md
capabilities/
  repository-capability-manifest.json
schemas/
  capability-status-evidence.schema.json
  capability-entry.schema.json
  repository-capability-manifest.schema.json
  capability-manifest-validation-result.schema.json
src/capabilities/
  capability-manifest-validator.mjs
tools/
  validate-capability-manifest.mjs
  test-capability-manifest.mjs

Required existing-file updates include:

package.json
tools/run-quality-gates.mjs

⸻

27. Acceptance Criteria

SPEC-038 is accepted only when all applicable criteria pass.

AC-038-001

The canonical manifest exists at the approved path.

AC-038-002

The canonical manifest validates against its JSON schema.

AC-038-003

Unknown capability-status values are rejected.

AC-038-004

Unknown certification-status values are rejected.

AC-038-005

Duplicate capability identifiers are rejected.

AC-038-006

Absolute evidence and artifact paths are rejected.

AC-038-007

Parent traversal paths are rejected.

AC-038-008

Package-version mismatch is detected.

AC-038-009

Missing governing specifications are detected.

AC-038-010

Missing claimed implementation paths are detected.

AC-038-011

Missing claimed test paths are detected.

AC-038-012

Quality-gate name or test-path mismatch is detected.

AC-038-013

A missing quality-gate test file is detected.

AC-038-014

LIVE_CERTIFIED without sufficient live evidence is rejected.

AC-038-015

Runtime-unavailable evidence results in UNVERIFIED, not successful certification.

AC-038-016

Highest milestone claims are validated independently.

AC-038-017

README status contradictions are reported as drift.

AC-038-018

Architecture status contradictions are reported as drift.

AC-038-019

Validation performs no repository modification.

AC-038-020

Repeated validation of the same repository state produces equivalent ordered findings.

AC-038-021

The capability-manifest test is registered as one quality gate.

AC-038-022

All pre-existing quality gates remain registered.

AC-038-023

Invalid fixtures fail for their intended reason.

AC-038-024

The canonical manifest does not claim evidence that is absent from the repository.

AC-038-025

Insufficient certification evidence remains explicitly UNVERIFIED.

⸻

28. Regression Requirements

Regression tests must cover:

* valid canonical manifest;
* deterministic repeated validation;
* unsupported schema version;
* unknown top-level field;
* unknown capability field;
* unknown capability status;
* unknown certification status;
* duplicate capability ID;
* empty capability ID;
* absolute path;
* parent traversal path;
* missing specification;
* missing implementation path;
* missing test path;
* missing quality gate;
* quality-gate test mismatch;
* package-version mismatch;
* highest milestone contradiction;
* self-tested claim without test evidence;
* live-certified claim without live evidence;
* runtime-unavailable evidence;
* README documentation drift;
* architecture drift;
* stable finding ordering;
* read-only validation behavior.

Tests must not modify the real repository.

⸻

29. Security Invariants

The following invariants are mandatory:

validationIsReadOnly = true
shellAllowed = false
networkAllowed = false
sourceWriteAuthorityGranted = false
gitWriteAuthorityGranted = false
dependencyMutationAuthorityGranted = false
automaticCorrectionAllowed = false
approvalBypassAllowed = false

No implementation of SPEC-038 may weaken these invariants.

⸻

30. Completion Rule

SPEC-038 is not complete merely because this specification exists.

Completion requires:

Specification
        ↓
Schemas
        ↓
Canonical Manifest
        ↓
Validator
        ↓
Regression Tests
        ↓
Quality-Gate Registration
        ↓
Repository Validation
        ↓
Engineering Review
        ↓
Human Approval

Until all required evidence exists, implementation or certification claims must remain at their supported state or UNVERIFIED.

⸻

31. Guiding Statement

Repository truth must be derived from evidence.

Documentation must not outrank reality.

Implementation must not certify itself.

Missing evidence must not become confidence.

When the repository cannot prove a claim, KAVEEP must say:

UNVERIFIED
