# Ecosystem Integration Baseline

Status: Observed compatibility baseline

KAVEEP-DEV-AGENT is an engineering capability. It does not replace the
authority of KAVEEP-CORE, KAVEEP-POLICY, KAVEEP-SIA, KAVEEP-RO, or
KAVEEP-COMMAND-CENTER.

## Ownership

| Repository | DEV-AGENT integration posture |
| --- | --- |
| KAVEEP-CORE | Consume canonical shared session, evidence, policy, audit, agent, and report contracts when a verified compatible version is available. |
| KAVEEP-POLICY | Consume policy, risk, evidence, and approval decisions; never create their authority locally. |
| KAVEEP-SIA | Treat system intelligence as read-only external evidence. |
| KAVEEP-RO | Treat repository analysis as read-only external evidence. |
| KAVEEP-COMMAND-CENTER | Publish or display only correlated engineering artifacts through its mission/task/agent/evidence/audit model. |

## Required invariants

- Unknown evidence remains `UNVERIFIED`; absent approval remains no action.
- DEV-AGENT must preserve correlation among session, evidence, policy, audit,
  task, and agent references at every cross-repository boundary.
- It must use adapters at schema boundaries. It must not silently equate
  `UNVERIFIED` with `unverified`, or `NO_ACTION` with `no_action`.
- It must not claim live integration with a sibling repository until that
  contract version and a real integration result are recorded as evidence.
- Policy, KCP, repository intelligence, system intelligence, and command-center
  orchestration stay owned by their respective repositories.

## Current contract risks

- POLICY currently references a CORE `report-envelope` path while CORE exposes
  `common-report`; this is unresolved external-contract drift.
- CORE and Command Center publish overlapping schema identifiers. DEV-AGENT
  must select an explicitly versioned owner before serializing shared data.
