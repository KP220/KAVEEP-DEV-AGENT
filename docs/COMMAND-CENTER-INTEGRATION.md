# KAVEEP-COMMAND-CENTER Integration

Authority: ENGINEERING-CONSTITUTION.md

KAVEEP-COMMAND-CENTER owns mission and operational coordination. KAVEEP-DEV-AGENT receives mission, workflow, task, session, status, approval routing, event, audit, and report coordination context from Command Center.

## Resolved Contracts

The current sibling layout contains:

- ../../KAVEEP-COMMAND-CENTER/schemas/mission.schema.json
- ../../KAVEEP-COMMAND-CENTER/schemas/workflow.schema.json
- ../../KAVEEP-COMMAND-CENTER/schemas/task.schema.json
- ../../KAVEEP-COMMAND-CENTER/schemas/agent.schema.json
- ../../KAVEEP-COMMAND-CENTER/schemas/event.schema.json
- ../../KAVEEP-COMMAND-CENTER/schemas/audit.schema.json
- ../../KAVEEP-COMMAND-CENTER/schemas/kcp-session.schema.json
- ../../KAVEEP-COMMAND-CENTER/schemas/command-center-report.schema.json

KAVEEP-DEV-AGENT must not redefine Command Center mission, workflow, task, agent registry, event, audit, or report aggregation records.

## Command Center Responsibilities

Command Center assigns or routes missions and tasks, provides session and correlation context, receives DEV-AGENT status updates, receives final engineering reports, receives event and audit references, routes human approval requirements, and displays blocked, waiting, failed, completed, no_action, and unverified states.

## DEV-AGENT Responsibilities

DEV-AGENT reports engineering-specific progress and final engineering reports back to Command Center.

DEV-AGENT may reference missionId, workflowId, and taskId in metadata.devAgentPayload, but it does not own those records.
