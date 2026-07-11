# KAVEEP-RO Integration

Authority: ENGINEERING-CONSTITUTION.md

KAVEEP-RO owns repository analysis. KAVEEP-DEV-AGENT consumes RO as a repository analysis and post-change review authority, not as a code execution engine.

## Resolved Contract

The current sibling layout contains:

- ../../KAVEEP-RO/schemas/common-report.schema.json

KAVEEP-DEV-AGENT references RO reports by report IDs, evidence references, audit references, or namespaced external analysis references.

## Read-Only Use

KAVEEP-DEV-AGENT may consume RO outputs for repository structure analysis, architecture compliance, documentation completeness, schema consistency, repository health, engineering recommendations, and policy or CORE alignment findings.

KAVEEP-DEV-AGENT must not duplicate RO repository-analysis payloads inside DEV-AGENT-owned schemas.

DEV-AGENT Repository Intelligence may collect bounded task-oriented repository context for planning, but it is not a formal RO assessment.

Repository Intelligence observations must be referenced or summarized separately from RO reports.

When formal RO output exists, DEV-AGENT must reference it rather than reproduce it.

## Integration Flow

Engineering request

to RO repository assessment

to DEV-AGENT engineering plan

to POLICY evaluation

to human approval if required

to sandbox implementation

to tests

to RO post-change review

to final DEV-AGENT report
