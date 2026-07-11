# SPEC-002

# Thai Command Interpreter Capability

Version

1.0.0

Status

Draft

Repository

KAVEEP-DEV-AGENT

Classification

Engineering Capability Specification

Authority

ENGINEERING-CONSTITUTION.md

---

# Purpose

Define the Thai Command Interpreter Capability responsible for transforming Thai or English natural-language engineering commands into structured Engineering Requests.

The interpreter understands and structures engineering intent.

The interpreter does not execute engineering work.

---

# Scope

In scope:

- Thai engineering command input
- English engineering command input
- deterministic intent interpretation
- target repository, file, and component identification
- preliminary task classification
- requested action classification
- protected-action detection
- ambiguity and missing-context detection
- structured Engineering Request output
- schema validation
- read-only command-line demonstration

Out of scope:

- Engineering Plan generation
- POLICY risk assessment
- approval decisions
- repository modification
- shell or terminal execution
- tool orchestration
- sandbox execution
- Git operations
- deployment
- autonomous engineering
- LLM provider integration

---

# Inputs

The capability accepts a natural-language engineering command as a string.

Input may be Thai, English, or mixed Thai-English engineering language.

Empty input is invalid and must fail safely.

---

# Outputs

The capability produces a DEV-AGENT-owned Engineering Request conforming to:

- ../schemas/engineering-request.schema.json

The Engineering Request is interpreted intent, not a Command Center mission, workflow, task assignment, POLICY decision, approval request, risk assessment, repository assessment, or system assessment.

---

# Processing Stages

1. Preserve original command.
2. Normalize whitespace.
3. Detect language.
4. Identify engineering intent.
5. Classify preliminary task type.
6. Classify requested actions.
7. Identify repositories, files, and components explicitly named by the command.
8. Detect protected-action language.
9. Detect ambiguity or missing context.
10. Produce a structured Engineering Request.
11. Validate the request against the Engineering Request schema.

---

# Status Semantics

received

The command was accepted but not fully interpreted.

interpreted

The command was structured but not yet ready for planning.

needs_clarification

The command contains material ambiguity or insufficient instruction detail.

ready_for_planning

The command is sufficiently structured for the future Planning Engine.

blocked

The command requests prohibited or unsafe behavior that cannot proceed without governance.

no_action

The safest outcome is to do nothing.

unverified

The command relies on missing factual support.

unsupported

The command is outside DEV-AGENT interpretation scope.

The interpreter shall never mark a request as approved, executed, implemented, completed, merged, released, or deployed.

---

# Clarification Behavior

When intent cannot be determined confidently, the interpreter shall:

- set taskType to unknown.
- record detected ambiguity.
- set status to needs_clarification or unverified.
- avoid guessing.
- avoid fabricating repository, file, acceptance, or execution details.

---

# Safety Boundaries

The interpreter shall never:

- execute the interpreted command.
- modify repository files.
- invoke a Tool Runner.
- invoke shell or PowerShell.
- execute terminal commands.
- create or delete repositories.
- perform Git writes.
- commit, push, merge, tag, release, deploy, or publish.
- access credentials.
- access external APIs.
- access the network.
- approve its own request.
- produce a POLICY authorization decision.
- claim implementation success.

Protected-action language shall be detected and represented as preliminary risk indicators only.

Detection does not authorize execution.

---

# Error Behavior

Empty input shall produce a safe rejected result during runtime tests or a structured request with status no_action when an object is required.

Unsupported input shall produce status unsupported or needs_clarification.

Missing factual support shall produce unverified.

Material ambiguity shall produce needs_clarification.

---

# Planning Engine Integration

The interpreter is the controlled entry point before planning.

```text
Command Input
to Interpreter Interface
to Deterministic Interpreter or future LLM Adapter
to Structured Engineering Request
to Schema Validation
to Planning Engine
```

The structured Engineering Request contract shall remain provider-independent.

Future LLM Adapter integration may improve interpretation quality but shall not change repository ownership, safety boundaries, schema validation, or authorization requirements.

---

# Acceptance Criteria

The capability is acceptable when:

- Thai commands can produce valid Engineering Requests.
- English commands can produce valid Engineering Requests.
- empty commands fail safely.
- ambiguous commands produce needs_clarification or unverified.
- protected-action language is detected.
- protected actions are never authorized.
- output validates against the Engineering Request schema.
- no LLM, network, Git, shell, sandbox, deployment, or destructive behavior is introduced.

---

End of Specification
