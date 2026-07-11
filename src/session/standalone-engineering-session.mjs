import { createHash } from "node:crypto";
import { lstat, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { runContainerValidation } from "../execution/container-validation-runner.mjs";
import { evaluateSandboxPreparationGate } from "../gates/execution-gate.mjs";
import { runReadOnlyOrchestration } from "../orchestration/dev-orchestrator.mjs";
import { runIterativeEngineeringLoop } from "../orchestration/iterative-engineering-loop.mjs";
import { runDynamicEngineeringLoop } from "../orchestration/dynamic-engineering-loop.mjs";
import { isInsideRoot } from "../repository/repository-intelligence.mjs";
import { buildWorkspaceIndex, searchWorkspaceIndex } from "../repository/workspace-index.mjs";
import { generateReviewedChange } from "../review/reviewed-change-generator.mjs";
import { createSecureSandbox } from "../sandbox/secure-sandbox-manager.mjs";

const digest = (value) => createHash("sha256").update(value).digest("hex");
const timestamp = (clock) => (clock?.() ?? new Date()).toISOString();
function semanticFeedback(container, maxCharacters) {
  return container.operationResults
    .filter((item) => ["failed", "timed_out"].includes(item.status))
    .map((item) => `${item.operation} (${item.status}, exit ${item.exitCode ?? "none"}):\n${item.stderr || item.stdout || "No diagnostic output."}`)
    .join("\n\n")
    .slice(0, maxCharacters);
}

async function collectContextFiles(root, candidates, config) {
  const files = [];
  let characters = 0;
  for (const candidate of candidates) {
    if (files.length >= config.maxContextFiles) break;
    const absolute = path.resolve(root, candidate.path);
    if (!isInsideRoot(root, absolute)) continue;
    try {
      const info = await lstat(absolute);
      if (info.isSymbolicLink() || !info.isFile()) continue;
      const canonical = await realpath(absolute);
      if (!isInsideRoot(root, canonical)) continue;
      const content = await readFile(canonical, "utf8");
      if (characters + content.length > config.budget.maxContextCharacters) break;
      characters += content.length;
      files.push({ path: candidate.path, content, sha256: digest(content) });
    } catch {
      // Repository intelligence is advisory; unreadable candidates are omitted.
    }
  }
  return files;
}

function createResult(request, clock) {
  const suffix = String(request?.sessionRequestId ?? "blocked").replace(/^standalone_session_request_/, "");
  const startedAt = timestamp(clock);
  return {
    suffix,
    value: {
      sessionResultId: `standalone_session_result_${suffix}`,
      schemaVersion: "1.0.0",
      sessionRequestRef: request?.sessionRequestId ?? "standalone_session_request_blocked",
      status: "failed",
      state: "received",
      events: [],
      artifacts: {},
      sandboxManifestRef: null,
      cleanupRequired: false,
      errors: [],
      warnings: [],
      startedAt,
      completedAt: startedAt,
      recommendedNextAction: "investigate_failure"
    }
  };
}

export async function runStandaloneSession(request, registry, options = {}) {
  const { suffix, value: result } = createResult(request, options.clock);
  const record = async (state, message) => {
    result.state = state;
    const event = { sequence: result.events.length + 1, state, message, createdAt: timestamp(options.clock) };
    result.events.push(event);
    await options.eventSink?.({ event: structuredClone(event), result: structuredClone(result) });
  };

  try {
    if (!request || request.status !== "proposed") throw new Error("Standalone Session Request is invalid.");
    await record("analyzing", "เริ่มตรวจ governance และวิเคราะห์ repository");
    const orchestration = await runReadOnlyOrchestration({
      command: request.command,
      repositoryRoot: request.repositoryRoot,
      authoritySnapshot: request.authoritySnapshot,
      missionLock: request.missionLock
    }, { runId: `session_${suffix}`, clock: options.clock });
    result.artifacts.orchestration = orchestration;

    if (orchestration.status === "no_action") {
      result.status = "no_action";
      await record("no_action", "ไม่มีงานวิศวกรรมที่ต้องดำเนินการ");
      result.recommendedNextAction = "no_action";
      return result;
    }
    if (!["completed", "completed_with_warnings"].includes(orchestration.status)) {
      result.status = "blocked";
      await record("blocked", "การวิเคราะห์ถูกบล็อกโดย governance หรือข้อมูลไม่เพียงพอ");
      result.errors.push(...orchestration.errors.map((error) => error.message));
      result.recommendedNextAction = "gather_more_context";
      return result;
    }

    const { engineeringRequest, engineeringPlan, engineeringContext } = orchestration.artifacts;
    const createdAt = timestamp(options.clock);
    const sandboxRequest = {
      sandboxRequestId: `sandbox_request_session_${suffix}`,
      schemaVersion: "1.0.0",
      requestRef: engineeringRequest.requestId,
      planRef: engineeringPlan.planId,
      contextRef: engineeringContext.contextId,
      gateResultRef: `gate_result_sandbox_session_${suffix}`,
      sourceRepositoryRoot: request.repositoryRoot,
      requestedWorkspaceMode: "bounded_repository_copy",
      selectedPaths: [], excludedPaths: [], resourceLimits: request.sandboxLimits,
      preserveOriginalState: true, cleanupPolicy: "explicit",
      evidenceRefs: [{ evidenceId: `evidence_session_${suffix}`, evidenceType: "sandbox_request", verificationStatus: "verified", sourceType: "system_observation", createdAt, summary: "Aligned standalone-session orchestration evidence." }],
      auditRefs: [], status: "proposed", createdAt
    };
    const sandbox = await createSecureSandbox(sandboxRequest, evaluateSandboxPreparationGate(engineeringPlan, sandboxRequest));
    result.artifacts.sandboxResult = sandbox.result;
    if (!sandbox.manifest) throw new Error(sandbox.result.errors[0]?.message ?? "Sandbox preparation failed.");
    result.sandboxManifestRef = sandbox.result.manifestRef;
    result.cleanupRequired = true;
    await record("sandbox_ready", "สร้าง verified sandbox สำเร็จ");

    let contextCandidates = engineeringContext.relevantFiles;
    if (request.workspaceIndex?.enabled) {
      const index = await buildWorkspaceIndex(request.repositoryRoot, request.workspaceIndex.indexRoot, { ...request.workspaceIndex.limits, clock: options.clock });
      const retrieval = await searchWorkspaceIndex(request.workspaceIndex.indexRoot, request.command, request.workspaceIndex.retrieval);
      result.artifacts.workspaceIndex = { indexId: index.indexId, stats: index.stats, retrieval };
      const known = new Set(contextCandidates.map((item) => item.path));
      contextCandidates = [...contextCandidates, ...retrieval.results.filter((item) => !known.has(item.path)).map((item) => ({ path: item.path }))];
    }
    const contextFiles = await collectContextFiles(sandbox.result.sandboxRoot, contextCandidates, request.brain);
    if (!contextFiles.length) throw new Error("No readable context files were selected for Engineering Brain.");
    const brainRequest = {
      brainRequestId: `brain_request_session_${suffix}`, schemaVersion: "1.0.0",
      providerId: request.brain.providerId, model: request.brain.model,
      requestRef: engineeringRequest.requestId, planRef: engineeringPlan.planId, contextRef: engineeringContext.contextId,
      objective: engineeringPlan.objective, contextFiles,
      protectedPaths: request.missionLock.protectedArtifacts.map((item) => item.path),
      budget: request.brain.budget, status: "proposed", createdAt: timestamp(options.clock)
    };

    await record("engineering", "เริ่ม Engineering Brain และ sandbox coding loop");
    let loop = request.brain.mode === "dynamic_tool_loop"
      ? await runDynamicEngineeringLoop({ dynamicLoopRequestId: `dynamic_loop_request_session_${suffix}`, schemaVersion: "1.0.0", sandboxId: sandbox.manifest.sandboxId, manifestRef: sandbox.result.manifestRef, workspaceIndexRoot: request.workspaceIndex?.enabled ? request.workspaceIndex.indexRoot : null, brainRequest, maxTurns: request.brain.maxDynamicTurns, maxToolCalls: request.brain.maxDynamicToolCalls, maxToolResultCharacters: request.brain.maxToolResultCharacters, maxTranscriptCharacters: request.brain.maxTranscriptCharacters, status: "proposed", createdAt: timestamp(options.clock) }, registry, { clock: options.clock, proposalSchema: options.proposalSchema, actionSchema: options.dynamicActionSchema })
      : await runIterativeEngineeringLoop({ loopRequestId: `engineering_loop_request_session_${suffix}`, schemaVersion: "1.0.0", sandboxId: sandbox.manifest.sandboxId, manifestRef: sandbox.result.manifestRef, brainRequest, maxAttempts: request.loop.maxAttempts, status: "proposed", createdAt: timestamp(options.clock) }, registry, { clock: options.clock, proposalSchema: options.proposalSchema });
    result.artifacts.engineeringLoop = loop;
    if (loop.status !== "completed") {
      result.status = "blocked";
      await record("blocked", "coding loop ไม่ผ่าน validation");
      result.errors.push(...loop.errors);
      result.recommendedNextAction = "gather_more_context";
      return result;
    }

    await record("validating", "เริ่ม semantic validation");
    if (request.container.enabled) {
      let container = await runContainerValidation({
        containerRequestId: `container_validation_request_session_${suffix}`, schemaVersion: "1.0.0",
        sandboxId: sandbox.manifest.sandboxId, manifestRef: sandbox.result.manifestRef,
        executionProfile: request.container.executionProfile, image: request.container.image, allowedImages: request.container.allowedImages,
        operations: request.container.operations, limits: request.container.limits,
        status: "proposed", createdAt: timestamp(options.clock)
      }, { clock: options.clock, processAdapter: options.containerProcessAdapter, dockerExecutable: options.dockerExecutable });
      result.artifacts.containerValidationAttempts = [container];
      const semanticMaxAttempts = request.loop.semanticMaxAttempts ?? 0;
      for (let semanticAttempt = 1; container.status === "failed" && semanticAttempt <= semanticMaxAttempts; semanticAttempt++) {
        const feedback = semanticFeedback(container, request.loop.maxSemanticFeedbackCharacters ?? 20000);
        if (!feedback) break;
        await record("engineering", `semantic repair รอบ ${semanticAttempt}/${semanticMaxAttempts}`);
        const repairBrainRequest = { ...brainRequest, brainRequestId: `brain_request_session_${suffix}_semantic_${semanticAttempt}`, objective: `${brainRequest.objective}\n\nSemantic validation failed. Correct the implementation using this untrusted, bounded diagnostic evidence:\n${feedback}` };
        loop = await runIterativeEngineeringLoop({
          loopRequestId: `engineering_loop_request_session_${suffix}_semantic_${semanticAttempt}`,
          schemaVersion: "1.0.0", sandboxId: sandbox.manifest.sandboxId, manifestRef: sandbox.result.manifestRef,
          brainRequest: repairBrainRequest, maxAttempts: request.loop.maxAttempts,
          status: "proposed", createdAt: timestamp(options.clock)
        }, registry, { clock: options.clock, proposalSchema: options.proposalSchema });
        result.artifacts.engineeringLoop = loop;
        if (loop.status !== "completed") break;
        await record("validating", `ตรวจ semantic validation หลัง repair รอบ ${semanticAttempt}`);
        container = await runContainerValidation({
          containerRequestId: `container_validation_request_session_${suffix}_semantic_${semanticAttempt}`,
          schemaVersion: "1.0.0", sandboxId: sandbox.manifest.sandboxId, manifestRef: sandbox.result.manifestRef,
          executionProfile: request.container.executionProfile, image: request.container.image, allowedImages: request.container.allowedImages,
          operations: request.container.operations, limits: request.container.limits,
          status: "proposed", createdAt: timestamp(options.clock)
        }, { clock: options.clock, processAdapter: options.containerProcessAdapter, dockerExecutable: options.dockerExecutable });
        result.artifacts.containerValidationAttempts.push(container);
      }
      result.artifacts.containerValidation = container;
      if (request.container.required && container.status !== "passed") {
        result.status = "blocked";
        await record("blocked", "container validation ไม่พร้อมหรือไม่ผ่าน");
        result.errors.push(...container.errors);
        result.recommendedNextAction = container.status === "runtime_unavailable" ? "start_container_runtime" : "investigate_failure";
        return result;
      }
    }

    await record("reviewing", "สร้าง reviewed change และ patch hash");
    const reviewed = await generateReviewedChange({
      reviewRequestId: `reviewed_change_request_session_${suffix}`, schemaVersion: "1.0.0",
      sandboxId: sandbox.manifest.sandboxId, manifestRef: sandbox.result.manifestRef,
      proposalRef: loop.finalProposal.proposalId, loopResultRef: loop.loopResultId ?? loop.dynamicLoopResultId,
      protectedPaths: request.missionLock.protectedArtifacts.map((item) => item.path),
      limits: { maxChangedFiles: request.brain.budget.maxEdits, maxFileBytes: request.sandboxLimits.maxSingleFileBytes, maxPatchBytes: request.sandboxLimits.maxTotalBytes, maxDiffLines: 200000 },
      status: "proposed", createdAt: timestamp(options.clock)
    }, { clock: options.clock });
    result.artifacts.reviewedChange = reviewed;
    if (reviewed.status !== "ready_for_review") throw new Error(reviewed.errors[0] ?? "Reviewed Change is not ready.");
    result.status = "awaiting_approval";
    await record("awaiting_approval", "การเปลี่ยนแปลงพร้อมให้มนุษย์ตรวจและอนุมัติ");
    result.recommendedNextAction = "review_and_approve";
    return result;
  } catch (error) {
    result.status = "failed";
    await record("failed", "Standalone session ล้มเหลวอย่างปลอดภัย");
    result.errors.push(error.message);
    return result;
  } finally {
    result.completedAt = timestamp(options.clock);
  }
}
