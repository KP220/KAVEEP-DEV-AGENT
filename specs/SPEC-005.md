# SPEC-005

## Context Builder Read-Only Prototype

Status: Implemented

Owner: KAVEEP-DEV-AGENT

## Purpose

Define the deterministic Context Builder that selects only repository observations relevant to one Engineering Request.

Repository Intelligence discovers bounded repository evidence. Context Builder selects a minimal subset. Planning Engine consumes that subset as optional context.

## Specification Decision

SPEC-004 already defines the Repository Intelligence read-only runtime prototype. SPEC-005 is the next available specification number.

## Input Contracts

The Context Builder accepts:

- one DEV-AGENT Engineering Request conforming to `schemas/engineering-request.schema.json`;
- one DEV-AGENT Repository Intelligence result conforming to `schemas/repository-intelligence.schema.json`.

The Context Builder does not accept raw repository contents and does not inspect the repository.

## Output Contract

The Context Builder produces one Engineering Context conforming to `schemas/engineering-context.schema.json`.

Engineering Context represents selected observations and traceability only. It is not an Engineering Plan, repository review, policy decision, approval record, or execution artifact.

## Deterministic Selection Rules

Selection uses only structured request fields, explicit target paths, task type, and observed Repository Intelligence fields.

- `schema_creation`: observed schemas, examples, validation entry points, specifications, module contracts, and architecture documentation.
- `documentation_update`: observed documentation, README, architecture documents, and engineering contracts.
- `repository_analysis`: README, architecture and ownership signals, repository structure references, validation entry points, package/build files, and planning artifacts.
- `bug_investigation`: observed tests, source artifacts, validation entry points, specifications, and explicit matching targets.
- other supported tasks: explicit observed targets plus the narrow source, test, validation, specification, or documentation categories implied by the task type.

Paths are never fabricated. A selected path must be present in Repository Intelligence observations. Missing expected categories are recorded in `missingContext`.

All arrays are deduplicated and sorted by stable path and type keys. No timestamps or random identifiers are generated, so equal inputs produce equal outputs.

## Status Rules

- empty/no-action request produces `no_action`;
- unsupported request produces `unsupported`;
- blocked request produces `blocked`;
- absent or unusable Repository Intelligence produces `needs_context` or `unverified`;
- valid selection with missing context or warnings produces `completed_with_warnings`;
- valid complete selection produces `completed`.

## Safety Boundaries

The Context Builder:

- performs no filesystem access;
- performs no shell, Git, network, external API, LLM, embedding, vector database, or repository code execution;
- modifies no repository artifact at runtime;
- makes no POLICY or approval decision;
- does not replace KAVEEP-RO assessment;
- does not redefine CORE, POLICY, RO, SIA, or COMMAND-CENTER contracts.

## Planning Integration

Planning Engine may consume Engineering Context as optional context. When supplied, Engineering Context takes precedence over direct Repository Intelligence context for selected file references. Existing planning without context remains valid.

No Engineering Context authorizes implementation.
