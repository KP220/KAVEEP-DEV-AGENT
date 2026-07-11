# KAVEEP-DEV-AGENT Module Contracts

Authority: ENGINEERING-CONSTITUTION.md

This document defines how KAVEEP-DEV-AGENT integrates with sibling KAVEEP repositories without redefining their canonical engineering domains.

## Repository Sovereignty

Each KAVEEP repository owns exactly one engineering domain.

KAVEEP-DEV-AGENT owns engineering request interpretation, engineering plans, task-oriented Repository Intelligence context, deterministic Engineering Context selection, implementation proposals, proposed file changes, sandbox change sets, test plans, validation results, implementation reports, engineering-specific evidence, rollback proposals, and human review packages.

KAVEEP-DEV-AGENT must not redefine canonical contracts owned by KAVEEP-CORE, KAVEEP-POLICY, KAVEEP-SIA, KAVEEP-RO, or KAVEEP-COMMAND-CENTER.

When a required foreign contract is missing, KAVEEP-DEV-AGENT documents the intended integration point instead of inventing a replacement.

## Contract Ownership

KAVEEP-CORE owns shared canonical envelopes, references, session, event, identity, metadata, warning, error, audit reference, evidence reference, policy reference, agent reference, capability reference, plugin reference, and task reference contracts.

KAVEEP-POLICY owns governance policies, safety rules, risk assessments, approval requests, policy evaluation records, execution authorization decisions, evidence requirements, and human approval requirements.

KAVEEP-SIA owns read-only system and storage analysis, file and storage classification, system intelligence reports, recommendations, simulations, environmental observations, and safety-aware system evidence.

KAVEEP-RO owns read-only repository analysis, repository health assessment, engineering standards review, architecture compliance review, schema and documentation consistency review, and repository-level recommendations.

KAVEEP-COMMAND-CENTER owns missions, goals, workflows, tasks, operational coordination, agent registration and supervision, ecosystem status, approval routing, platform monitoring, report aggregation, event coordination, audit visibility, and human operational control.

## DEV-AGENT-Owned Report Artifact

The DEV-AGENT report artifact is:

- ../schemas/dev-agent-report.schema.json
- ../examples/dev-agent-report.example.json

The report composes:

- ../../KAVEEP-CORE/schemas/report-envelope.schema.json
- metadata.devAgentPayload for DEV-AGENT-specific engineering details

Foreign records are referenced by IDs, report references, evidence references, audit references, or schema references. They are not embedded as local DEV-AGENT records.

## DEV-AGENT-Owned Engineering Plan Artifact

The DEV-AGENT Engineering Plan artifact is:

- ../schemas/engineering-plan.schema.json
- ../examples/engineering-plan.example.json

An Engineering Plan is a proposal artifact. It may be used before implementation, during policy evaluation, during sandbox preparation, and inside final engineering reports.

A valid Engineering Plan does not authorize implementation, external writes, Git writes, merge, release, deployment, or destructive action.

Mission, workflow, task, session, policy, risk, approval, repository-analysis, and system-analysis records remain owned by their source repositories and are referenced rather than embedded.

## DEV-AGENT-Owned Engineering Request Artifact

The DEV-AGENT Engineering Request artifact is:

- ../schemas/engineering-request.schema.json
- ../examples/engineering-request.example.json

An Engineering Request is interpreted intent produced by the Thai Command Interpreter.

It is not a Command Center mission, workflow, task assignment, POLICY decision, approval request, risk assessment, RO repository assessment, or SIA system assessment.

A structured Engineering Request may become input to the future Planning Engine, but it does not authorize planning output, implementation, policy approval, sandbox execution, Git writes, merge, release, deployment, or destructive action.

## DEV-AGENT-Owned Planning Engine Runtime

The Planning Engine runtime is:

- ../src/planning/planning-engine.mjs
- ../tools/create-engineering-plan.mjs
- ../tools/test-planning-engine.mjs

It transforms a structured Engineering Request into a DEV-AGENT Engineering Plan.

It does not own POLICY decisions, approval, Repository Intelligence, sandbox execution, Tool Orchestration, Git operations, or implementation.

## DEV-AGENT-Owned Repository Intelligence Runtime

The Repository Intelligence runtime is:

- ../schemas/repository-intelligence.schema.json
- ../examples/repository-intelligence.example.json
- ../src/repository/repository-intelligence.mjs
- ../tools/inspect-repository.mjs
- ../tools/test-repository-intelligence.mjs

It produces bounded, task-oriented repository observations from an explicitly supplied approved root.

It may support planning by providing repositoryIntelligenceRefs, repositoryContextSummary, and relevantFileRefs.

It is not a KAVEEP-RO repository assessment, repository health review, architecture compliance review, standards review, or post-change review.

It does not inspect outside the approved root, follow external symlinks, read secret values, execute repository code, modify files, invoke Git, or authorize engineering actions.

## DEV-AGENT-Owned Context Builder Runtime

The Context Builder runtime is:

- ../schemas/engineering-context.schema.json
- ../examples/engineering-context.example.json
- ../src/context/context-builder.mjs
- ../tools/build-context.mjs
- ../tools/test-context-builder.mjs

It transforms one Engineering Request and one Repository Intelligence result into a deterministic Engineering Context containing only observed artifacts selected by request type and explicit targets.

It does not inspect files, infer semantic meaning, execute tools, make policy or approval decisions, replace KAVEEP-RO, or authorize engineering work.

Planning Engine may optionally consume Engineering Context. Planning remains valid when Engineering Context is absent.

## Related Integration Documents

## DEV-AGENT-Owned Tool Orchestrator Runtime

Tool Orchestrator owns only the local registry and invocation of explicitly registered DEV-AGENT read-only in-process tools: `../src/tools/tool-registry.mjs` and `../src/tools/tool-orchestrator.mjs`.

It does not own the KAVEEP-COMMAND-CENTER agent registry, POLICY evaluation, approval, Secure Sandbox, shell execution, Git, network access, or write-capable tooling. Tool availability does not imply authorization.

## DEV-AGENT-Owned Secure Sandbox Runtime

Secure Sandbox owns bounded isolated workspace preparation, source snapshots, Sandbox Manifests and Results, sandbox-only change detection, and exact marker-verified cleanup: `../src/sandbox/secure-sandbox-manager.mjs` and `../src/sandbox/sandbox-change-detector.mjs`.

It consumes an exact narrow Execution Gate result but owns no POLICY decision or human approval. It does not execute code, expose an editor or process runner, modify the source repository, invoke Git or a network, deploy, or write changes back. Future change-capable components must be separately specified and restricted to a verified sandbox.

- CORE-INTEGRATION.md
- POLICY-INTEGRATION.md
- SIA-INTEGRATION.md
- RO-INTEGRATION.md
- COMMAND-CENTER-INTEGRATION.md
- ARCHITECTURE.md
- SAFETY.md
- CODEX-GUARDRAILS.md
- VALIDATION.md
- NEXT-STEPS.md
# SPEC-009 Sandbox File Editor

`src/sandbox/sandbox-file-editor.mjs` owns explicit regular-file edits inside a verified SPEC-008 workspace. Secure Sandbox Manager remains the sole owner of sandbox identity verification; Change Detection remains the owner of sandbox-versus-source snapshot comparison. The editor owns rollback-ready Change Sets, deterministic non-Git Diff Summaries, and edit evidence. It has no source write-back, process, Build Runner, Test Runner, or Git Runtime authority.

# SPEC-010 Authority Governance

Authority Governance owns the DEV-AGENT-local read-only contracts and deterministic runtime for Authority Snapshot, Mission Lock, and Governance Drift Result:

- `../schemas/authority-snapshot.schema.json`
- `../schemas/mission-lock.schema.json`
- `../schemas/governance-drift-result.schema.json`
- `../src/governance/authority-governance.mjs`

Authority Snapshot records explicit local evidence but does not create authority. Mission Lock represents protected boundaries but does not grant approval. Governance Drift Detector compares hashes and structured proposals but does not make POLICY or KCP decisions. Master Book, Constitution, Roadmap, POLICY, KCP, cross-repository records, Command Center missions and workflows, and human governance remain owned by their respective authorities.

# SPEC-011 DEV-Orchestrator Read-Only State Machine

DEV-Orchestrator owns only deterministic coordination of existing DEV-AGENT read-only capability stages:

- `../schemas/dev-orchestration-run.schema.json`
- `../schemas/dev-orchestration-checkpoint.schema.json`
- `../src/orchestration/dev-orchestrator.mjs`

It does not own KAVEEP-COMMAND-CENTER missions, goals, workflows, tasks, agent supervision, approval routing, or ecosystem operations. It consumes but does not create or reinterpret Authority Snapshot, Mission Lock, POLICY, approval, KCP, RO, or SIA evidence. SPEC-011 invokes no tool, sandbox, editor, process, Git, network, release, or deployment capability.

# SPEC-012 Durable Orchestration Persistence and Audit

The durable store owns DEV-AGENT-local content-addressed orchestration artifacts, append-only hash-chained audit events, atomic run records, durable checkpoints, integrity replay, and restart-from-received recovery. It does not own CORE audit contracts, Command Center operational history, POLICY decisions, KCP decisions, or external archival systems. Recovery never converts a prior checkpoint into execution authority.

# SPEC-013 Sandbox Static Validation Runner

The Static Validation Runner owns only fixed Node.js `--check` parsing of explicit contained `.js`, `.mjs`, and `.cjs` files inside a verified Secure Sandbox. It does not own or provide Build Runner, Test Runner, npm, shell, dependency execution, network isolation, Git, source write-back, release, or deployment capabilities.

# SPEC-014 LLM Adapter and Engineering Brain

Engineering Brain owns bounded reasoning requests and proposal validation. Provider adapters own provider-specific API translation only. Models recommend and never govern. Engineering Proposals are not File Editor requests, POLICY decisions, KCP decisions, approvals, execution gates, or write authority.

# SPEC-015 Iterative Engineering Loop

The loop owns bounded coordination of Engineering Brain, Sandbox File Editor, and Static Validation attempts. It owns no new editing or execution authority. Attempt completion produces reviewable sandbox evidence only; POLICY, approval, KCP, source write-back, Git, build/test execution, release, and deployment remain outside the loop.

# SPEC-016 Reviewed Change and Patch Artifact

Reviewed Change owns deterministic bounded text-patch evidence correlated to one sandbox, proposal, and loop result. It verifies source snapshot hashes but owns no approval, source write-back, Git operation, merge, release, or deployment authority.

# SPEC-017 Exact-Hash Change Approval Verification

DEV-AGENT owns only verification and one-time consumption evidence. KAVEEP-POLICY retains approval and risk ownership; human governance retains the decision. The signed attestation is an integration binding and does not redefine POLICY records. A verified result permits only immediate revalidation before a separately specified write capability.

# SPEC-018 Controlled Source Write-Back

Controlled Source Write owns exact revalidation, one-time write reservation, bounded staging, source application, post-write verification, and in-process rollback. It owns no POLICY decision, approval, Git operation, release, or deployment. It is not connected to autonomous orchestration.

# SPEC-019 Durable Write Recovery

Durable Write Recovery owns external rollback snapshots, transaction journals, hash-based crash-state classification, and recovery evidence. It does not broaden write authority or provide Git, release, deployment, or autonomous cleanup.
