# SPEC-004

# Repository Intelligence Read-Only Runtime Capability

Version

1.0.0

Status

Draft

Repository

KAVEEP-DEV-AGENT

Classification

Engineering Runtime Capability Specification

Authority

ENGINEERING-CONSTITUTION.md

---

# Numbering Decision

SPEC-000 through SPEC-003 already exist.

SPEC-001 defines a broad Repository Intelligence capability family.

SPEC-004 is used for this milestone because it defines the first controlled read-only runtime prototype for that capability without rewriting the existing broad capability specification.

---

# Purpose

Define the Repository Intelligence read-only runtime responsible for collecting bounded, task-oriented repository context from an explicitly approved repository root.

Repository Intelligence improves planning accuracy.

Repository Intelligence does not provide repository authority.

---

# Scope

In scope:

- explicit repository-root input.
- canonical root resolution.
- root-boundary validation.
- read-only directory and file inventory.
- bounded traversal.
- deterministic engineering artifact detection.
- deterministic technology indicators.
- documentation, specification, schema, source, test, package, and validation entry-point discovery.
- architectural, ownership, and integration signals.
- warnings, errors, limitations, and ignored-path reporting.
- structured output conforming to ../schemas/repository-intelligence.schema.json.

Out of scope:

- KAVEEP-RO repository assessment.
- architecture compliance judgment.
- repository health scoring.
- standards compliance judgment.
- semantic code understanding.
- LLM-based analysis.
- dependency installation or resolution.
- code execution.
- file modification.
- Git operations.
- policy or approval decisions.
- sandbox execution.
- deployment.

---

# Input Contract

The runtime accepts one explicitly supplied repository root path.

The path must resolve to an existing directory.

No default repository inspection is authorized without an explicit root.

Options may configure traversal bounds only through validated numeric limits.

---

# Output Contract

The runtime produces a DEV-AGENT-owned Repository Intelligence object conforming to:

- ../schemas/repository-intelligence.schema.json

The output is bounded observation context.

It is not a KAVEEP-RO report.

It is not authorization to modify the repository.

---

# Approved-Root Requirement

All inspected paths must remain inside the canonical approved repository root.

The runtime must reject missing roots, inaccessible roots, file roots, and path escape attempts.

Every collected path must be stored as a relative path from the approved root.

---

# Discovery Stages

1. Resolve the supplied repository root.
2. Validate that the root exists and is a directory.
3. Establish the canonical root boundary.
4. Traverse directories without following symlinks.
5. Apply ignored-path rules.
6. Enforce traversal bounds.
7. Collect relative file and directory paths.
8. Detect engineering artifacts.
9. Detect technology indicators.
10. Detect validation entry points.
11. Detect architecture, ownership, and integration signals.
12. Produce the structured Repository Intelligence object.

---

# Bounded Inspection

The prototype uses conservative defaults:

- maximum depth: 6.
- maximum files: 500.
- maximum directories: 150.
- maximum readable text manifest size: 65536 bytes.
- maximum relevant files returned: 80.

When a bound is reached, traversal stops safely for the affected path and a warning is recorded.

Partial observation must be reported as completed_with_warnings.

---

# Ignored Paths

The prototype ignores common generated, dependency, binary, cache, temporary, virtual environment, and VCS directories by default.

Examples include:

- .git
- node_modules
- dist
- build
- coverage
- .cache
- .next
- target
- vendor
- __pycache__
- .venv
- venv
- tmp
- temp

Ignored paths are not assumed irrelevant forever.

They are ignored by this prototype for safe bounded structural discovery.

---

# Symlink Behavior

The prototype does not follow symbolic links, junctions, or equivalent links.

If a link target can be resolved and the target escapes the approved root, the runtime records a warning.

If the target cannot be resolved, the runtime records a warning and continues without following the link.

---

# Sensitive Artifact Protection

The runtime must not read or expose contents of sensitive-looking artifacts.

Sensitive examples include:

- .env
- credential files
- private keys
- secret stores
- token files
- password files
- SSH keys
- certificate private keys

The runtime may record only a safe classification such as sensitive_artifact_detected.

Secret values must never be printed.

---

# RO Ownership Boundary

KAVEEP-DEV-AGENT Repository Intelligence owns task-oriented discovery context only.

KAVEEP-RO owns authoritative repository assessment, architecture compliance review, repository health review, standards review, and post-change repository review.

When formal RO output exists, DEV-AGENT must reference it rather than reproduce it.

Repository Intelligence must not claim compliance, correctness, security, approval, or architecture validity.

---

# Errors And Warnings

Invalid or disallowed path produces blocked.

No approved repository supplied produces no_action.

Inaccessible repository path produces blocked or unverified.

Traversal limits, ignored links, sensitive artifacts, unreadable entries, and partial observations produce warnings.

Warnings must be explicit.

---

# Status Semantics

pending

Inspection has not started.

inspecting

Inspection is underway.

completed

Bounded inspection completed without warnings.

completed_with_warnings

Bounded inspection completed with disclosed warnings or limitations.

blocked

The supplied root is invalid, unsafe, disallowed, inaccessible, or not a directory.

unverified

Evidence is insufficient for a reliable observation.

unsupported

The requested inspection mode is outside this prototype.

no_action

No approved repository root was supplied.

The runtime must never use approved, executed, implemented, merged, released, or deployed.

---

# Future Context Builder Integration

Repository Intelligence may later feed a Context Builder.

The future Context Builder may select task-specific subsets of Repository Intelligence output.

This milestone does not implement Context Builder, embeddings, semantic indexing, or LLM summarization.

---

# Future LLM Adapter Boundary

Future repository understanding may route selected evidence through an LLM Adapter.

The Repository Intelligence schema remains provider-independent.

No LLM provider may become the source of repository authority.

---

# Acceptance Criteria

The capability is acceptable when:

- an explicit repository root is required.
- invalid roots fail safely.
- inspection remains read-only.
- traversal remains inside the approved root.
- symlinks are not followed.
- ignored paths are disclosed.
- traversal bounds are enforced and disclosed.
- sensitive file contents are not read or exposed.
- deterministic engineering artifacts are detected.
- technology indicators include supporting evidence.
- validation entry points are detected but never executed.
- output validates against ../schemas/repository-intelligence.schema.json.
- Planning Engine can optionally consume concise repository context without requiring it.
- KAVEEP-RO ownership remains explicit.

---

End of Specification
