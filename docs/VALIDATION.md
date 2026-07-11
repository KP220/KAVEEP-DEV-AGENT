# Validation

Authority: ENGINEERING-CONSTITUTION.md

KAVEEP-DEV-AGENT uses minimal local validation tooling for DEV-AGENT-owned examples.

## Command

```text
npm.cmd run validate:examples
```

Failure-behavior commands:

```text
npm.cmd run validate:invalid-engineering-request
npm.cmd run validate:invalid-engineering-plan
npm.cmd run validate:invalid-repository-intelligence
npm.cmd run validate:invalid-engineering-context
npm.cmd run validate:failure-test
npm.cmd run test:interpreter
npm.cmd run test:planning-engine
npm.cmd run test:repository-intelligence
npm.cmd run test:context-builder
npm.cmd run test:tool-orchestrator
npm.cmd run validate:invalid-tool-request
npm.cmd run validate:invalid-tool-result
npm.cmd run test:execution-gate
npm.cmd run validate:invalid-gate-result
npm.cmd run validate:invalid-sandbox-request
npm.cmd run validate:invalid-sandbox-manifest
npm.cmd run validate:invalid-sandbox-result
npm.cmd run test:secure-sandbox
```

`validate:invalid-engineering-request` constructs an invalid Engineering Request in memory by setting `status` to `executed`. It must return a non-zero exit code.

`validate:invalid-engineering-plan` constructs an invalid Engineering Plan in memory by setting `safety.planAuthorizesExecution` to `true`. It uses the normal validation failure path and must return a non-zero exit code.

`validate:invalid-repository-intelligence` constructs an invalid Repository Intelligence report in memory by setting `status` to `executed`. It must return a non-zero exit code.

`validate:invalid-engineering-context` constructs an invalid Engineering Context in memory by setting `status` to `executed`. It must return a non-zero exit code.

`validate:failure-test` uses the same invalid in-memory Engineering Plan and returns exit code 0 only when the validator correctly rejects the invalid instance.

## Validator Scope

The validator may:

- read DEV-AGENT schemas.
- read DEV-AGENT examples.
- construct in-memory invalid validation cases.
- resolve explicitly referenced sibling schemas.
- audit JSON Schema $ref integrity for DEV-AGENT schemas and explicitly referenced sibling schemas.
- validate examples.
- report errors.
- report external-owned transitive reference risks as warnings.

The validator must not:

- scan unrelated directories.
- modify files.
- create invalid repository artifacts.
- invoke shell commands.
- execute agent logic.
- call external APIs.
- perform network access.
- run Git writes.
- perform destructive actions.

Validation success may be reported only when external references are resolved and examples are genuinely checked.

External sibling schemas remain owned by their repositories. If a sibling schema exists but contains an internal unresolved reference, the validator reports a warning rather than creating a local DEV-AGENT replacement.

Current DEV-AGENT-owned validation targets:

- ../schemas/engineering-request.schema.json with ../examples/engineering-request.example.json
- ../schemas/engineering-plan.schema.json with ../examples/engineering-plan.example.json
- ../schemas/repository-intelligence.schema.json with ../examples/repository-intelligence.example.json
- ../schemas/engineering-context.schema.json with ../examples/engineering-context.example.json
- ../schemas/tool-descriptor.schema.json with ../examples/tool-descriptor.example.json
- ../schemas/tool-request.schema.json with ../examples/tool-request.example.json
- ../schemas/tool-result.schema.json with ../examples/tool-result.example.json
- ../schemas/dev-agent-report.schema.json with ../examples/dev-agent-report.example.json

Runtime foundation tests:

- ../tools/test-interpreter.mjs validates interpreter behavior.
- ../tools/test-planning-engine.mjs validates generated Engineering Plans against ../schemas/engineering-plan.schema.json.
- ../tools/test-repository-intelligence.mjs validates read-only Repository Intelligence behavior and generated reports against ../schemas/repository-intelligence.schema.json.
- ../tools/test-context-builder.mjs validates deterministic context selection, safe statuses, missing context, and generated output against ../schemas/engineering-context.schema.json.
- ../tools/test-tool-orchestrator.mjs validates mandatory Gate Results, exact correlation, all decision denials, contradictory evidence denial, registry/capability denials, and zero handler calls on denied paths.
- ../tools/test-execution-gate.mjs validates Gate decision production separately from Tool Orchestrator enforcement.
- ../tools/test-secure-sandbox.mjs validates isolated selected and bounded copies, source integrity, broad-root rejection, exclusions, resource limits, change detection, and verified cleanup.

Sandbox contract validation targets are `sandbox-request`, `sandbox-manifest`, and `sandbox-result` schemas with matching examples. Each invalid command substitutes a forbidden status and must exit non-zero. `sandbox:create -- <approved-root>` performs explicit bounded preparation only. `sandbox:cleanup -- <exact-manifest-path>` rejects arbitrary cleanup targets.
# SPEC-009 validation

# SPEC-010 validation

`npm test` validates Authority Snapshot, Mission Lock, and Governance Drift examples and runs focused read-only tests. The suite covers deterministic hashing, schema-valid aligned results, modified authority detection, protected artifact and principle proposals, prohibited change categories, path escape, duplicate precedence, invalid targets, and source integrity.

# SPEC-011 validation

The aggregate quality gate validates orchestration run and checkpoint examples, then exercises the complete read-only state sequence. Tests cover aligned completion, exact transition ordering, one checkpoint per transition, governance precheck blocking, protected intent blocking before repository inspection, no-action behavior, modified authority evidence, non-authorizing plans, and proof that discovered repository code is not executed.

# SPEC-012 validation

Durable-store tests verify canonical content-addressed artifacts, append-only event ordering, SHA-256 hash-chain replay, atomic durable checkpoints, schema-valid run records/events/replay/recovery, secret rejection, abandoned-lock recovery, linked recovery attempts, restart from received, governance rechecks, and corruption blocking after audit-log tampering.

# SPEC-013 validation

Static validation tests prove contained Node.js syntax parsing, normalized syntax failure, no execution of module side effects, path and extension denial, sandbox identity correlation, link denial when supported, and unchanged source files.

# SPEC-014 validation

Engineering Brain tests use deterministic mock providers to verify structured proposal acceptance and rejection of execution claims, protected paths, unobserved targets, and reference mismatch. The OpenAI adapter test captures the Responses API request shape without making a live network call and verifies explicit model, structured JSON Schema format, token budget, usage normalization, and credential non-disclosure.

# SPEC-015 validation

Loop tests prove Brain proposal, sandbox edit, syntax failure capture, bounded feedback, refreshed sandbox context, revised proposal, successful second validation, maximum-attempt exhaustion, complete attempt evidence, and unchanged source repository content.

# SPEC-016 validation

Reviewed-change tests cover deterministic add, modify, and delete patches, repeatable patch hashes, before/after hashes and byte counts, source snapshot verification, protected-path denial, binary denial, source-drift blocking, schema validation, and no source write-back.

# SPEC-017 validation

Approval-verification tests cover exact patch and reference correlation, POLICY approval/risk agreement, HMAC signature verification, expiry, revocation, forged signatures, one-time consumption, replay denial, secret non-disclosure, and verification-result schema compliance.

# SPEC-018 validation

Controlled-write tests cover trusted approval-ledger provenance, immediate patch revalidation, deterministic add/modify/delete application, post-write hashes, one-time write reservation, reuse denial, source-drift denial, injected mid-commit failure, reverse-order rollback, stage cleanup, and no Git operation.

# SPEC-019 validation

Durable write-recovery tests cover pre-write snapshot journals, simulated partial after-state recovery, modified/deleted restoration, approved-added removal, backup hash verification, idempotent repeated recovery, conflict preflight, atomic no-change behavior on unknown content, and no Git operation.

# SPEC-020 validation

Container runner unit tests verify exact hardened Docker arguments, semantic operation mapping, allowlisted image enforcement, missing-script behavior, runtime-unavailable handling, result normalization, and unchanged source. Live daemon isolation testing remains pending in the current environment because Docker service startup was denied.

Run `npm.cmd run test:sandbox-file-editor` for all six operations, containment rejection, identity rejection, rollback evidence, deterministic diff, schema checks, and source-integrity checks. Run `validate:invalid-sandbox-change`, `validate:invalid-sandbox-diff`, and `validate:invalid-sandbox-edit-result`; each must exit nonzero. `validate:examples` validates all canonical examples.
