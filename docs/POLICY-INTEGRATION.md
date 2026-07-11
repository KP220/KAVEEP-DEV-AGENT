# KAVEEP-POLICY Integration

Authority: ENGINEERING-CONSTITUTION.md

KAVEEP-POLICY owns governance policies, safety rules, risk assessments, approval requests, policy evaluation records, execution authorization decisions, evidence requirements, and human approval requirements.

## Resolved Contracts

The current sibling layout contains:

- ../../KAVEEP-POLICY/schemas/risk-assessment.schema.json
- ../../KAVEEP-POLICY/schemas/evidence-record.schema.json
- ../../KAVEEP-POLICY/schemas/approval-request.schema.json
- ../../KAVEEP-POLICY/schemas/policy-report.schema.json

KAVEEP-DEV-AGENT references these contracts. It must not define incompatible local copies of risk assessments, approval requests, evidence records, policy reports, policy decisions, or governance outcomes.

## Policy Outcomes

Policy denial results in:

- blocked
- no_action

Insufficient evidence results in:

- unverified

High-risk operations must not proceed without explicit human approval.

## Integration Flow

Engineering plan

to POLICY evaluation

to risk assessment

to approval request when required

to DEV-AGENT sandbox preparation only when permitted

Policy evaluation references may be recorded in metadata.devAgentPayload.policyEvaluationRefs, riskAssessmentRefs, and approvalRequestRefs.
