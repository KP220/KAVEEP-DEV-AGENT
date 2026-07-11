# DEV-AGENT Integration Architecture

Authority: ARCHITECTURE.md

This document narrows the repository-level architecture to contract integration with sibling KAVEEP repositories.

For the canonical DEV-AGENT architecture, see ../ARCHITECTURE.md.

## Official Engineering Lifecycle

Command Center Mission or User Request

to Thai Command Interpreter

to Engineering Request

to Repository Intelligence when an approved repository root is supplied

to Context Builder

to Planning Engine

to CORE Session Context

to RO Repository Assessment

to SIA Environment Assessment when required

to Engineering Plan

to POLICY Evaluation

to Risk Assessment

to Human Approval when required

to Sandbox Preparation

to Proposed Changes

to Sandbox Implementation

to Tests and Validation

to RO Post-Change Review

to DEV-AGENT Report

to CORE Event and Audit References

to Command Center Review

to Wait for Human Approval before external write, merge, release, or deployment

## Engineering Plan Contract

The reusable Engineering Plan contract is defined in:

- ../schemas/engineering-plan.schema.json

The Engineering Plan is produced by DEV-AGENT after request interpretation and repository analysis. It represents planned engineering intent, scope, ordered steps, validation intent, safety gating, and execution readiness.

The plan is not an execution artifact. It becomes input to POLICY evaluation, approval routing, sandbox preparation, and final DEV-AGENT reporting.

Actual test results, validation results, audit records, approval decisions, and implementation outcomes belong to their respective result or report artifacts.

## Planning Engine

The Planning Engine is a read-only runtime foundation that accepts a validated Engineering Request and produces a structured Engineering Plan.

It owns deterministic request-to-plan transformation only.

It may consume a deterministic Engineering Context when supplied. Direct Repository Intelligence context remains an optional compatibility input.

It does not perform Repository Intelligence, POLICY evaluation, approval, sandbox preparation, tool execution, file modification, Git operations, LLM calls, or deployment.

Future provider boundary:

```text
Validated Engineering Request
to Planning Interface
to Deterministic Planner or future LLM Adapter
to Engineering Plan
to Schema Validation
to POLICY Evaluation
```

A generated Engineering Plan remains a proposal and does not authorize implementation.

## Repository Intelligence

Repository Intelligence is a read-only runtime foundation that accepts an explicitly approved repository root and produces bounded task-oriented repository context:

- ../schemas/repository-intelligence.schema.json
- ../src/repository/repository-intelligence.mjs

It discovers structure, likely engineering artifacts, technology indicators, validation entry points, documentation, specifications, schemas, source and test locations, ownership signals, and integration signals.

It does not execute repository code, inspect outside the approved root, follow external symlinks, read secret values, modify files, invoke Git, perform POLICY evaluation, approve work, or replace KAVEEP-RO.

Controlled context flow:

```text
Approved Repository Root
to Repository Intelligence
to Context Builder
to Engineering Context
to Planning Engine optional context
to Engineering Plan
to Schema Validation
```

Repository observations remain evidence, not authorization.

## Context Builder

The Context Builder accepts one Engineering Request and one Repository Intelligence result, then deterministically selects only observed artifacts relevant to that request:

- ../schemas/engineering-context.schema.json
- ../src/context/context-builder.mjs

It performs no repository access. It uses no LLM, embedding, vector database, shell, Git, network, external API, policy decision, approval decision, or execution capability.

Missing expected context remains explicit. Selected paths retain a relevance reason and source field for traceability.

## Tool Orchestrator

Tool Orchestrator is a default-deny boundary between gate evaluation and registered in-process read-only tools. It requires both a schema-valid Tool Request and a schema-valid Execution Gate Result. Only `allow_read_only` with successful `evaluated` status, no contradictory or unmet evidence, and matching `toolRequestRef`, `requestRef`, and `planRef` may reach a handler. The authorization applies only to that exact request and is neither blanket nor reusable. The orchestrator consumes but never creates, modifies, or reinterprets the Gate Result. The local registry has no relation to the COMMAND-CENTER agent registry, and tool availability grants no authorization.

## Execution Gate

Execution Gate evaluates an Engineering Plan and proposed Tool Request against referenced POLICY, approval, risk, and evidence records. It emits a DEV-AGENT Gate Result only; POLICY owns decisions and Approval Gateway owns human authorization. Future Secure Sandbox remains outside this prototype.

Controlled invocation flow: Tool Request -> Execution Gate evaluation -> exact correlated Gate Result -> Tool Orchestrator enforcement -> registered read-only handler -> Tool Result. A plan or Tool Request cannot authorize itself; all missing or mismatched authorization is denied before handler invocation.

## Secure Sandbox

Secure Sandbox Manager prepares a unique operating-system temporary workspace from an explicitly approved repository root. The source remains read-only; permitted content is copied into the isolated workspace under file, directory, byte, depth, path-length, and lifetime bounds. Shared ignored and sensitive-path rules are reused, and links are never followed.

The Execution Gate may emit `allow_sandbox_preparation` only for the exact Sandbox Request. This narrow decision authorizes bounded copying and manager metadata inside the sandbox, not engineering changes, process execution, source modification, or external write-back. Tool Orchestrator has no automatic sandbox route in SPEC-008. Future File Editor and Process Runner capabilities must be separate, sandbox-only milestones.

Lifecycle: explicit Sandbox Request -> correlated Gate Result -> bounded source snapshot -> isolated copy -> Sandbox Manifest and Result -> sandbox-only change detection -> explicit marker-verified cleanup. Sandbox readiness is isolation state, not protected-action authorization.

## Thai Command Interpreter

The Thai Command Interpreter is the first controlled runtime entry point.

It accepts Thai or English natural-language engineering commands and produces a structured Engineering Request:

- ../schemas/engineering-request.schema.json

It does not generate Engineering Plans, make policy decisions, request approvals, modify repositories, execute tools, access Git, call LLM providers, access the network, or perform sandbox work.

Future provider boundary:

```text
Command Input
to Interpreter Interface
to Deterministic Interpreter or future LLM Adapter
to Structured Engineering Request
to Schema Validation
to Planning Engine
```

The structured Engineering Request contract remains provider-independent.

## Architecture Boundary

DEV-AGENT owns engineering-specific outputs.

CORE owns canonical shared contracts.

POLICY owns governance and authorization.

SIA owns system analysis.

RO owns repository analysis.

COMMAND-CENTER owns operational coordination.

The integration architecture is contract-based. It does not introduce runtime execution, autonomous editing, Git writes, deployment, external API integration, or destructive behavior.
# SPEC-009 write boundary

# SPEC-010 authority governance boundary

Authority Snapshot, Mission Lock, and Governance Drift Detection form a deterministic read-only orchestration boundary. Authority evidence is hash-anchored to explicit documents beneath an approved root. An aligned result permits only continuation of a read-only pipeline; it does not authorize execution. DEV-Orchestrator stops on blocked or unverified governance evidence and routes legitimate amendments to their owning governance, POLICY, KCP, and human approval processes.

# SPEC-011 read-only orchestration boundary

DEV-Orchestrator connects governance precheck, Thai Command Interpreter, Repository Intelligence, Context Builder, Planning Engine, and governance postcheck as an ordered state machine. It owns engineering-stage coordination only and does not duplicate KAVEEP-COMMAND-CENTER mission or workflow ownership. The state machine currently ends with a plan prepared for governed review; execution capabilities remain disconnected.

The controlled flow now extends from Secure Sandbox Workspace to Sandbox File Editor, rollback-ready Change Set, deterministic non-Git Diff, Validation, and Engineering Report. The editor consumes Secure Sandbox Manager identity verification and Change Detection; it cannot write back to the source. Future Build/Test and Git runtimes remain separate controlled capabilities.
