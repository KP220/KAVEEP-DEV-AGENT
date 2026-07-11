# SPEC-007

## Execution Gate -- Policy and Human Approval Capability

DEV-AGENT evaluates Plan and Tool Request eligibility using referenced POLICY, risk, approval, evidence, and audit records. It never creates those records, grants approval, invokes tools, creates a sandbox, or performs side effects. Decisions are allow_read_only, waiting_for_policy, waiting_for_approval, blocked, no_action, or unverified. POLICY and Approval Gateway retain ownership; future Secure Sandbox remains outside scope.

An `allow_read_only` result authorizes only the exact Tool Request identified by its `toolRequestRef` and correlated request and plan references. It is not reusable authorization. The Tool Orchestrator must validate and enforce the result without changing or reevaluating it. Missing, invalid, mismatched, waiting, blocked, no_action, unverified, contradictory, or insufficient results default to denial. Neither an Engineering Plan nor a Tool Request may authorize itself.
