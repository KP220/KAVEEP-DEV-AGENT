# SPEC-003

# Planning Engine Capability

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

Define the Planning Engine Capability responsible for transforming a validated Engineering Request into a structured Engineering Plan.

The Planning Engine plans engineering work.

The Planning Engine does not execute engineering work.

---

# Responsibilities

The Planning Engine is responsible for:

- accepting a structured Engineering Request.
- preserving request traceability.
- deriving technical objective and scope from the request.
- producing ordered engineering steps.
- representing validation, test, review, and rollback-preparation intent.
- representing safety, policy, and approval gates.
- producing an Engineering Plan conforming to schemas/engineering-plan.schema.json.

---

# Inputs

The primary input is:

- schemas/engineering-request.schema.json

The request must be structured before planning.

The prototype may receive the request from the Thai Command Interpreter.

---

# Outputs

The output is:

- schemas/engineering-plan.schema.json

The plan is a proposal artifact. It is not authorization.

---

# Planning Stages

1. Validate request shape.
2. Preserve request identity.
3. Respect request status.
4. Derive engineering objective.
5. Construct scope from explicit request targets.
6. Select conservative task-type planning template.
7. Generate ordered engineering steps.
8. Generate validation, test, review, and rollback intent.
9. Represent policy and approval gates.
10. Produce an Engineering Plan.

---

# Deterministic Prototype Behavior

The prototype uses deterministic mappings from Engineering Request taskType and requestedActions.

It shall not inspect repository files, retrieve context, call an LLM, or infer unstated facts.

Unknown facts remain unknown.

---

# Safe Failure Behavior

needs_clarification requests produce clarification-oriented plans.

unverified requests produce evidence-collection plans.

blocked requests produce non-executable blocked plans.

no_action requests produce no implementation work.

unsupported requests produce no implementation work.

---

# Status Transitions

ready_for_planning may produce a proposed plan.

needs_clarification produces waiting_for_evidence or blocked planning state.

unverified produces unverified planning state.

blocked produces blocked planning state.

no_action produces no_action planning state.

unsupported produces blocked planning state.

The Planning Engine must never mark work completed, implemented, merged, released, deployed, or approved.

---

# Boundaries

POLICY Boundary

The Planning Engine may represent that policy evaluation is required. It must not produce POLICY authorization decisions.

Repository Intelligence Boundary

The Planning Engine may list repository context as missing. It must not inspect repository files or perform repository analysis.

Execution Boundary

The Planning Engine must not execute plan steps, invoke tools, create sandboxes, modify files, access Git, access the network, or call external APIs.

LLM Adapter Boundary

Future planning may route through an LLM Adapter. The Engineering Plan contract remains provider-independent.

```text
Validated Engineering Request
to Planning Interface
to Deterministic Planner or LLM Adapter
to Engineering Plan
to Schema Validation
to POLICY Evaluation
```

---

# Acceptance Criteria

The capability is acceptable when:

- valid Engineering Requests produce valid Engineering Plans.
- protected actions are gated.
- ambiguous requests do not produce fabricated implementation plans.
- unverified requests preserve missing evidence.
- no_action requests produce no implementation work.
- generated plans validate against schemas/engineering-plan.schema.json.
- the Planning Engine does not execute work or authorize protected actions.

---

End of Specification
