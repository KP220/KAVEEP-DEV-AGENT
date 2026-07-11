# KAVEEP-SIA Integration

Authority: ENGINEERING-CONSTITUTION.md

KAVEEP-SIA owns system and storage intelligence. KAVEEP-DEV-AGENT consumes SIA as a read-only analysis provider, not as an execution engine.

## Resolved Contracts

The current sibling layout contains:

- ../../KAVEEP-SIA/schemas/storage-report.schema.json
- ../../KAVEEP-SIA/schemas/classification-report.schema.json
- ../../KAVEEP-SIA/schemas/recommendation-report.schema.json
- ../../KAVEEP-SIA/schemas/decision-report.schema.json
- ../../KAVEEP-SIA/schemas/simulation-report.schema.json
- ../../KAVEEP-SIA/schemas/audit-report.schema.json

KAVEEP-DEV-AGENT references only SIA reports that are relevant to the engineering task.

## Read-Only Use

KAVEEP-DEV-AGENT may consume SIA outputs for storage availability, filesystem observations, environment readiness, protected path classification, resource risk indicators, system warnings, and simulation results.

KAVEEP-DEV-AGENT must not ask SIA to delete files, move files, rename files, overwrite files, clean storage, modify the operating system, or execute destructive actions.

## Integration Flow

DEV-AGENT resource question

to SIA analysis request

to SIA report

to evidence review

to policy evaluation

to engineering decision

Formal SIA reports are referenced through metadata.devAgentPayload.siaReportRefs. DEV-AGENT schemas must not copy SIA analytical fields.
