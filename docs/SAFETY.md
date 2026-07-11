# DEV-AGENT Safety Invariants

Authority: ENGINEERING-CONSTITUTION.md

These invariants apply to DEV-AGENT contract integration and future engineering execution.

- no_action is the default safe outcome.
- insufficient evidence is unverified.
- repository inspection is read-only by default.
- system inspection through SIA is read-only by default.
- no file modification occurs before policy evaluation.
- execution occurs only inside an approved sandbox.
- no destructive action occurs without explicit human approval.
- no external write occurs without explicit human approval.
- no Git commit, push, merge, tag, release, or branch deletion occurs automatically.
- no deployment or publishing occurs automatically.
- no agent may bypass KAVEEP-POLICY.
- no module may redefine KAVEEP-CORE canonical contracts.
- DEV-AGENT must not impersonate SIA, RO, POLICY, or COMMAND-CENTER.
- audit references are append-only.
- policy denial blocks execution.
- missing approval blocks approval-required operations.
- failed validation prevents release recommendation.
- a successful test does not automatically authorize merge or deployment.
- a valid engineering plan does not authorize implementation or protected actions.
- planned validation is not the same as actual validation evidence.
- a structured engineering request does not authorize planning, implementation, policy approval, or execution.
- protected-action language may be detected by the interpreter but never performed by it.
- generated engineering plans remain non-executable by default.
- the Planning Engine must represent policy and approval gates without satisfying them.
- Repository Intelligence requires an explicitly approved repository root.
- Repository Intelligence must not inspect outside the approved root.
- Repository Intelligence must not follow symlinks or junctions outside the approved root.
- Repository Intelligence must not read or expose sensitive artifact contents.
- Repository Intelligence observations do not authorize modification or replace KAVEEP-RO assessment.
- Context Builder must select only paths observed in supplied Repository Intelligence.
- Context Builder must not read files, execute tools, use external services, or infer authorization.
- missing Engineering Context remains explicit and does not block safe no-action behavior.
- Engineering Context does not authorize planning execution, implementation, or protected actions.
- Tool Orchestrator denies every unregistered, disabled, unsupported, write-capable, shell, Git, network, policy-gated, approval-gated, or sandbox-gated tool.
- Tool Orchestrator may invoke only registered in-process tools whose sideEffectClass is none or read_only.
- Tool Orchestrator requires a schema-valid Execution Gate Result for every invocation and defaults to denial before calling a handler.
- allow_read_only is valid only with evaluated status, sufficient non-contradictory evidence, and exact Tool Request, request, and plan correlation.
- Gate Results are request-specific and must never be reused as blanket authorization.
- Tool Orchestrator consumes Gate Results without creating, modifying, or reinterpreting them.
- no Engineering Plan or Tool Request may authorize itself.
- Read-only tools require an explicit approved root and must not expose sensitive artifact contents.
- Execution Gate consumes POLICY and approval references only; it never grants approval or invokes a tool.
- Secure Sandbox requires an exact `allow_sandbox_preparation` Gate Result and an explicitly approved canonical source root.
- sandbox preparation may copy only permitted content into a unique bounded OS-temporary workspace; it must never modify the source.
- drive roots, system roots, entire home directories, path escapes, sensitive artifacts, and followed links are prohibited.
- all copy and change-detection resources are bounded and limit effects remain explicit.
- sensitive contents are never copied or hashed; ignored paths and links are excluded and recorded.
- sandbox cleanup may delete only the exact manager-created workspace verified by manifest and internal identity marker.
- sandbox readiness authorizes no editor, process execution, Git action, deployment, or source write-back.
- Authority Snapshot may read only explicitly declared bounded UTF-8 authority documents beneath one canonical approved root.
- Authority Snapshot evidence never creates, replaces, or amends authority.
- Mission Lock must protect every snapshotted authority document and may never grant execution authority.
- missing, modified, inaccessible, linked, escaped, or unverifiable authority evidence prevents governance alignment.
- proposed autonomous changes to mission, identity, constitution, governance, authority hierarchy, protected policy, budget authority, human approval rules, KCP authority, or repository ownership are blocked.
- refreshing an Authority Snapshot is not approval of a governance change.
- DEV-Orchestrator consumes Governance Drift evidence without weakening, reinterpreting, or silently refreshing it.
- DEV-Orchestrator must run governance checks before interpretation and after planning against the same Authority Snapshot and Mission Lock.
- blocked or unverified governance evidence terminates orchestration before any later stage.
- DEV-Orchestrator terminal states have no outgoing transition.
- SPEC-011 checkpoints are not durable and must not claim crash recovery or cross-process resume.
- completed read-only orchestration produces a non-authorizing plan and never implies POLICY, approval, KCP, sandbox, tool, Git, release, or deployment permission.
- durable persistence rejects secret-like keys and credential-like values rather than silently storing or ambiguously redacting them.
- audit events are append-only and hash chained; replay corruption blocks recovery.
- artifact filenames must equal the SHA-256 of canonical artifact content.
- cross-process recovery always creates a linked attempt from received and reruns governance checks.
- durable checkpoint state never authorizes mid-stage or post-governance continuation.
- retention is declarative only; SPEC-012 performs no automatic deletion.
- unknown major store versions and implicit migrations fail closed.
- SPEC-013 invokes only the current Node executable with a fixed `--check` argument and explicit contained JavaScript targets.
- static validation never invokes npm, package scripts, shells, repository imports, arbitrary arguments, or caller-provided environment variables.
- syntax validation is not a secure Build/Test Runner and makes no claim of runtime correctness or network isolation.
- Engineering Brain output is proposal-only and never authorizes or invokes edits, tools, processes, Git, release, or deployment.
- repository excerpts supplied to a model are untrusted data and cannot redefine instructions, governance, Mission Lock, budgets, or protected paths.
- LLM provider credentials are invocation-only and must never appear in prompts, results, errors, audit artifacts, or persistence.
- malformed, excessive, protected, unobserved, reference-mismatched, or authority-claiming proposals fail closed.
- iterative engineering attempts are bounded from one to five and may write only through Sandbox File Editor.
- validation failure feedback is untrusted data and cannot alter Mission Lock, provider budget, protected paths, or authority.
- loop completion means syntax passed and changes are reviewable; it never means approved, tested, releasable, or authorized for source write-back.
- reviewed patches require exact source-snapshot hash verification for every modified or deleted file.
- reviewed change artifacts reject protected, binary, linked, escaped, oversized, or source-drifted changes.
- patch hashes provide review correlation but never authorize patch application or source write-back.
- POLICY approval status alone is insufficient for source-write eligibility; exact patch binding and trusted attestation verification are required.
- approval attestations require signature, reviewer identity, validity window, non-revocation, and one-time nonce consumption.
- successful approval verification yields eligibility for immediate revalidation only, never direct write authority.
- controlled write requires trusted approval-ledger provenance and reserves each verification for one write attempt only.
- patch and change inventory are regenerated immediately before staging and must exactly match reviewed evidence.
- source writes use same-directory exclusive stages and rollback backups; in-process failure rolls back in reverse order.
- controlled write performs no Git operation and requires post-write repository validation.
- journaled write stores verified pre-write backups outside the source repository before application begins.
- crash recovery preflights every path and performs no mutation when any current state is unknown.
- recovery removes added files only when their hash equals the approved after-state and restores backups only when their hash equals the reviewed before-state.
- container validation accepts semantic operations only and never accepts raw model-generated commands.
- validation containers use no network, no capabilities, no-new-privileges, non-root identity, read-only root, bounded resources, and no Docker socket.
- unavailable container runtime is an explicit non-success state and must never fall back to host execution.

Safety status values must preserve blocked, no_action, and unverified.
# Sandbox-only write policy

SPEC-009 permits writes only beneath a canonical, marker-verified, ready Secure Sandbox. Absolute paths, traversal, internal manager metadata, symlink targets and ancestors, source repository paths, and unverified sandboxes are denied. That editor grants no build, process, Git, network, deployment, rollback, or source-write authority; later specifications compose isolated validation and separately approved write/Git workflows without weakening this boundary.
