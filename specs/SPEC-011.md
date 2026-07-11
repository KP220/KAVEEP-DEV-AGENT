# SPEC-011

## DEV-Orchestrator Read-Only State Machine

Owner: KAVEEP-DEV-AGENT

### Purpose

DEV-Orchestrator coordinates the existing deterministic read-only engineering capabilities as one bounded state machine. It consumes an existing verified Authority Snapshot and active Mission Lock, checks governance before and after engineering analysis, and produces a traceable orchestration run. It does not create Command Center missions or workflows and does not authorize or invoke tools, sandboxes, file edits, processes, Git, network access, release, or deployment.

### State model

```text
received
  -> governance_prechecked
  -> interpreted
  -> repository_inspected
  -> context_built
  -> planned
  -> governance_postchecked
  -> completed
```

Any stage may transition to `blocked`, `no_action`, or `failed`. Terminal states have no outgoing transition in this milestone.

### Stage behavior

1. Validate exact root correlation between orchestration input and Authority Snapshot.
2. Run Governance Drift Detection using the supplied snapshot, Mission Lock, and structured proposed-change declarations.
3. Stop on blocked or unverified governance evidence.
4. Interpret the command as an Engineering Request.
5. Stop safely for blocked, unsupported, no-action, or clarification-required requests.
6. Inspect the exact approved repository root with Repository Intelligence.
7. Build deterministic Engineering Context from observed repository evidence.
8. Create a non-authorizing Engineering Plan.
9. Re-run Governance Drift Detection against the same immutable snapshot and Mission Lock.
10. Complete only when the post-check remains aligned.

### Transition and checkpoint rules

Transitions are ordered, append-only records with sequence, previous state, next state, stage, outcome, reason, artifact reference, and timestamp. The runtime emits a checkpoint after every successful transition. Checkpoints are audit-ready resume boundaries, but durable persistence and cross-process resume are reserved for a separately specified persistence milestone.

No caller may inject, skip, reorder, delete, or reinterpret transitions. Snapshot refresh is not a transition and cannot be performed by the orchestrator.

### Ownership boundaries

DEV-Orchestrator owns only coordination of DEV-AGENT engineering capabilities. KAVEEP-COMMAND-CENTER continues to own ecosystem missions, goals, workflows, tasks, agent supervision, approval routing, and operational control. POLICY owns policy decisions. KCP owns applicable consensus decisions. Human governance owns protected approval. RO and SIA retain their assessment ownership.

### Failure behavior

- governance `blocked` or `unverified` stops the run;
- protected or unsupported interpreted intent stops the run;
- repository inspection failure stops the run;
- insufficient context remains explicit and prevents false completion;
- unexpected runtime errors produce a terminal failed run with normalized error evidence;
- no failure path creates execution authority or side effects.

### Acceptance criteria

- orchestration run and checkpoint schemas and examples validate;
- the exact state sequence is deterministic and auditable;
- aligned read-only repository analysis reaches completed;
- governance drift blocks before interpretation;
- drift introduced during execution is caught by the post-check;
- no-action and protected commands stop safely;
- every completed stage has an ordered transition and checkpoint;
- all existing quality gates continue to pass.

