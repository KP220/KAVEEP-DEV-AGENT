import { realpath } from "node:fs/promises";
import path from "node:path";
import { buildEngineeringContext } from "../context/context-builder.mjs";
import { detectGovernanceDrift } from "../governance/authority-governance.mjs";
import { interpretEngineeringCommand } from "../interpreter/thai-command-interpreter.mjs";
import { createEngineeringPlan } from "../planning/planning-engine.mjs";
import { inspectRepository } from "../repository/repository-intelligence.mjs";

const terminalStates = new Set(["completed", "blocked", "no_action", "failed"]);
const limitations = [
  "This read-only orchestrator creates no Command Center mission, workflow, task, POLICY decision, approval, or KCP decision.",
  "No tool, sandbox, editor, process, network, Git, release, deployment, or external write is invoked.",
  "Checkpoints are in-memory audit boundaries; durable persistence and cross-process resume are not implemented."
];

const safeId = (value) => String(value ?? "001").replace(/[^A-Za-z0-9_-]/g, "_").replace(/^_+|_+$/g, "") || "001";
const time = (clock) => (clock ? clock() : new Date()).toISOString();

export async function runReadOnlyOrchestration(input, options = {}) {
  if (!input || typeof input !== "object") throw new Error("Orchestration input is required.");
  if (!String(input.command ?? "").trim() && input.command !== "") throw new Error("Command must be a string.");
  if (!input.repositoryRoot || !input.authoritySnapshot || !input.missionLock) throw new Error("repositoryRoot, authoritySnapshot, and missionLock are required.");

  const canonicalRoot = await realpath(path.resolve(input.repositoryRoot));
  if (canonicalRoot !== input.authoritySnapshot.repositoryRoot) throw new Error("Orchestrator repository root must exactly match Authority Snapshot repositoryRoot.");
  const suffix = safeId(options.runId ?? input.authoritySnapshot.authoritySnapshotId.replace(/^authority_snapshot_/, ""));
  const run = {
    runId: `dev_run_${suffix}`,
    schemaVersion: "1.0.0",
    command: String(input.command),
    repositoryRoot: canonicalRoot,
    authoritySnapshotRef: input.authoritySnapshot.authoritySnapshotId,
    missionLockRef: input.missionLock.missionLockId,
    state: "received",
    terminal: false,
    transitions: [],
    checkpoints: [],
    governanceChecks: [],
    artifacts: {},
    errors: [],
    limitations,
    status: "unverified",
    recommendedNextAction: "gather_more_evidence",
    startedAt: time(options.clock),
    updatedAt: time(options.clock)
  };
  const artifactRefs = [];

  async function transition(toState, stage, outcome, reason, artifactRef) {
    if (terminalStates.has(run.state)) throw new Error(`Terminal orchestration state cannot transition: ${run.state}`);
    const sequence = run.transitions.length + 1;
    const entry = { sequence, fromState: run.state, toState, stage, outcome, reason, createdAt: time(options.clock) };
    if (artifactRef) {
      entry.artifactRef = artifactRef;
      if (!artifactRefs.includes(artifactRef)) artifactRefs.push(artifactRef);
    }
    run.transitions.push(entry);
    run.state = toState;
    run.terminal = terminalStates.has(toState);
    run.updatedAt = entry.createdAt;
    run.checkpoints.push({
      checkpointId: `dev_checkpoint_${suffix}_${String(sequence).padStart(3, "0")}`,
      schemaVersion: "1.0.0",
      runRef: run.runId,
      sequence,
      state: toState,
      artifactRefs: [...artifactRefs],
      governanceResultRefs: run.governanceChecks.map((item) => item.governanceDriftResultId),
      durablyPersisted: false,
      resumable: false,
      createdAt: entry.createdAt
    });
    if (options.transitionSink) await options.transitionSink({ transition: structuredClone(entry), checkpoint: structuredClone(run.checkpoints.at(-1)) });
  }

  function stop(status, nextAction) {
    run.status = status;
    run.recommendedNextAction = nextAction;
    return run;
  }

  try {
    const precheck = await detectGovernanceDrift(input.authoritySnapshot, input.missionLock, {
      repositoryRoot: canonicalRoot,
      proposedChanges: input.proposedChanges ?? [],
      resultId: `${suffix}_pre`,
      clock: options.clock
    });
    run.governanceChecks.push(precheck);
    if (precheck.status !== "aligned") {
      await transition("blocked", "governance_precheck", precheck.status === "unverified" ? "unverified" : "blocked", "Pre-orchestration governance evidence is not aligned.", precheck.governanceDriftResultId);
      return stop(precheck.status === "unverified" ? "unverified" : "blocked", precheck.status === "unverified" ? "gather_more_evidence" : "request_governance_process");
    }
    await transition("governance_prechecked", "governance_precheck", "completed", "Authority evidence and Mission Lock are aligned before orchestration.", precheck.governanceDriftResultId);

    const request = interpretEngineeringCommand(input.command, {
      requestId: `request_${suffix}`,
      createdAt: time(options.clock)
    });
    run.artifacts.engineeringRequest = request;
    if (request.status !== "ready_for_planning") {
      const noAction = request.status === "no_action";
      await transition(noAction ? "no_action" : "blocked", "interpret", noAction ? "no_action" : "blocked", `Interpreter stopped with status ${request.status}.`, request.requestId);
      return stop(noAction ? "no_action" : request.status === "unverified" ? "unverified" : "blocked", noAction ? "no_action" : request.status === "needs_clarification" || request.status === "unsupported" ? "ask_clarifying_question" : "request_governance_process");
    }
    await transition("interpreted", "interpret", "completed", "Engineering command was interpreted without execution authority.", request.requestId);

    const repositoryIntelligence = await inspectRepository(canonicalRoot, options.repositoryInspectionOptions);
    run.artifacts.repositoryIntelligence = repositoryIntelligence;
    if (!new Set(["completed", "completed_with_warnings"]).has(repositoryIntelligence.status)) {
      await transition("blocked", "repository_inspection", repositoryIntelligence.status === "unverified" ? "unverified" : "blocked", `Repository Intelligence stopped with status ${repositoryIntelligence.status}.`, repositoryIntelligence.intelligenceId);
      return stop(repositoryIntelligence.status === "unverified" ? "unverified" : "blocked", "gather_more_evidence");
    }
    await transition("repository_inspected", "repository_inspection", "completed", "Repository was inspected inside the exact approved root.", repositoryIntelligence.intelligenceId);

    const engineeringContext = buildEngineeringContext(request, repositoryIntelligence);
    run.artifacts.engineeringContext = engineeringContext;
    if (!new Set(["completed", "completed_with_warnings"]).has(engineeringContext.status)) {
      await transition("blocked", "context_build", engineeringContext.status === "unverified" ? "unverified" : "blocked", `Context Builder stopped with status ${engineeringContext.status}.`, engineeringContext.contextId);
      return stop(engineeringContext.status === "unverified" ? "unverified" : "blocked", "gather_more_evidence");
    }
    await transition("context_built", "context_build", "completed", "Engineering Context was selected only from observed repository evidence.", engineeringContext.contextId);

    const plan = createEngineeringPlan(request, {
      repositoryIntelligence,
      engineeringContext,
      planId: `plan_${suffix}`,
      createdAt: time(options.clock),
      updatedAt: time(options.clock)
    });
    run.artifacts.engineeringPlan = plan;
    await transition("planned", "planning", "completed", "A non-authorizing Engineering Plan was created.", plan.planId);

    const postcheck = await detectGovernanceDrift(input.authoritySnapshot, input.missionLock, {
      repositoryRoot: canonicalRoot,
      proposedChanges: input.proposedChanges ?? [],
      resultId: `${suffix}_post`,
      clock: options.clock
    });
    run.governanceChecks.push(postcheck);
    if (postcheck.status !== "aligned") {
      await transition("blocked", "governance_postcheck", postcheck.status === "unverified" ? "unverified" : "blocked", "Post-planning governance evidence is not aligned.", postcheck.governanceDriftResultId);
      return stop(postcheck.status === "unverified" ? "unverified" : "blocked", postcheck.status === "unverified" ? "gather_more_evidence" : "request_governance_process");
    }
    await transition("governance_postchecked", "governance_postcheck", "completed", "Authority evidence remained aligned after read-only planning.", postcheck.governanceDriftResultId);
    await transition("completed", "completion", "completed", "Read-only DEV orchestration completed without authorizing execution.", plan.planId);
    const warnings = repositoryIntelligence.status === "completed_with_warnings" || engineeringContext.status === "completed_with_warnings";
    return stop(warnings ? "completed_with_warnings" : "completed", "submit_plan_for_governed_review");
  } catch (error) {
    run.errors.push({ code: "orchestration_stage_failed", message: error.message, stage: run.state });
    if (!terminalStates.has(run.state)) await transition("failed", "failure", "failed", "Read-only orchestration failed safely.");
    return stop("failed", "investigate_failure");
  }
}
