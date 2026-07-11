# KAVEEP-CORE Integration

Authority: ENGINEERING-CONSTITUTION.md

KAVEEP-CORE owns shared canonical contracts. KAVEEP-DEV-AGENT consumes those contracts rather than redefining them.

## Resolved Contracts

The current sibling layout contains:

- ../../KAVEEP-CORE/schemas/report-envelope.schema.json
- ../../KAVEEP-CORE/schemas/event.schema.json
- ../../KAVEEP-CORE/schemas/identity.schema.json
- ../../KAVEEP-CORE/schemas/session.schema.json
- ../../KAVEEP-CORE/schemas/metadata.schema.json
- ../../KAVEEP-CORE/schemas/warning.schema.json
- ../../KAVEEP-CORE/schemas/error.schema.json
- ../../KAVEEP-CORE/schemas/audit-ref.schema.json
- ../../KAVEEP-CORE/schemas/evidence-ref.schema.json
- ../../KAVEEP-CORE/schemas/policy-ref.schema.json
- ../../KAVEEP-CORE/schemas/agent-ref.schema.json
- ../../KAVEEP-CORE/schemas/capability-ref.schema.json
- ../../KAVEEP-CORE/schemas/plugin-ref.schema.json
- ../../KAVEEP-CORE/schemas/task-ref.schema.json

## Report Composition Rule

Only explicit DEV-AGENT report artifacts compose the CORE report envelope.

The DEV-AGENT report schema composes the CORE report envelope through JSON Schema allOf:

- ../schemas/dev-agent-report.schema.json

DEV-AGENT-specific details live under:

- metadata.devAgentPayload

Operational records must not be wrapped in the report envelope merely because they contain status, riskLevel, auditRefs, evidenceRefs, createdAt, or updatedAt.

## Safe Defaults

The CORE report envelope preserves:

- no_action as the default safe action status.
- unverified as the outcome for insufficient, missing, conflicting, or inaccessible evidence.

KAVEEP-DEV-AGENT inherits these defaults and must not weaken them.
