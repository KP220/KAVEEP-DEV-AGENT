# DEV-Orchestrator

Authority: ENGINEERING-CONSTITUTION.md, SPEC-010, and SPEC-011

## Purpose

DEV-Orchestrator coordinates existing DEV-AGENT read-only engineering capabilities as a deterministic state machine. It is not a KAVEEP-COMMAND-CENTER mission or workflow engine and does not own POLICY, approval, KCP, RO, or SIA decisions.

## State sequence

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

`blocked`, `no_action`, and `failed` are terminal states. The runtime does not allow a transition out of a terminal state.

## Governance behavior

The orchestrator receives an existing verified Authority Snapshot and active Mission Lock. It cannot create, refresh, weaken, or reinterpret either artifact. Governance Drift Detection runs before interpretation and again after planning. A blocked or unverified result stops the state machine.

Structured proposed-change declarations are checked during both governance passes. An aligned result allows only continuation of this read-only pipeline and never authorizes tools or implementation.

## Artifact flow

The completed run contains:

- two Governance Drift Results;
- one Engineering Request;
- one Repository Intelligence result;
- one Engineering Context;
- one non-authorizing Engineering Plan;
- ordered append-only transitions;
- one in-memory checkpoint per transition.

## Checkpoint boundary

SPEC-011 checkpoints have `durablyPersisted: false` and `resumable: false`. They define audit-ready stage boundaries without claiming crash recovery. Durable persistence, integrity-protected event storage, replay, and cross-process resume require a later persistence specification.

## Safety boundary

The orchestrator never invokes Tool Orchestrator, Secure Sandbox, File Editor, process execution, network access, Git, source write-back, pull requests, release, or deployment. Repository code discovered during inspection is not imported or executed.

## CLI

```text
npm run orchestrate:readonly -- <repository-root> <authority-snapshot.json> <mission-lock.json> <command>
```

The CLI prints the complete orchestration run and exits unsuccessfully for blocked, failed, or unverified outcomes.

