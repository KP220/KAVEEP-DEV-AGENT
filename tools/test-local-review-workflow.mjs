import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { evaluateSandboxPreparationGate } from "../src/gates/execution-gate.mjs";
import { generateReviewedChange } from "../src/review/reviewed-change-generator.mjs";
import { cleanupSecureSandbox, createSecureSandbox } from "../src/sandbox/secure-sandbox-manager.mjs";
import { editSandbox } from "../src/sandbox/sandbox-file-editor.mjs";
import { applyLocalApprovalBundle, createLocalApprovalBundle } from "../src/workflow/local-review-workflow.mjs";

const root = await mkdtemp(path.join(os.tmpdir(), "kaveep-local-workflow-test-")); const source = path.join(root, "source");
const clock = () => new Date("2026-07-11T00:00:00.000Z"); const secret = "local-workflow-test-secret-123456"; let manifestRef;
try {
  await mkdir(path.join(source, "src"), { recursive: true }); await writeFile(path.join(source, "src/index.mjs"), "export const value = 1;\n");
  const evidence = { evidenceId: "evidence_local_workflow_001", evidenceType: "sandbox_request", verificationStatus: "verified", sourceType: "system_observation", createdAt: clock().toISOString(), summary: "Local workflow test." };
  const sandboxRequest = { sandboxRequestId: "sandbox_request_local_workflow_001", schemaVersion: "1.0.0", requestRef: "request_local_workflow_001", planRef: "plan_local_workflow_001", contextRef: "context_local_workflow_001", gateResultRef: "gate_result_sandbox_local_workflow_001", sourceRepositoryRoot: source, requestedWorkspaceMode: "bounded_repository_copy", selectedPaths: [], excludedPaths: [], resourceLimits: { maxFiles: 100, maxDirectories: 50, maxTotalBytes: 1048576, maxSingleFileBytes: 65536, maxDepth: 8, maxPathLength: 512, maxLifetimeSeconds: 3600 }, preserveOriginalState: true, cleanupPolicy: "explicit", evidenceRefs: [evidence], auditRefs: [], status: "proposed", createdAt: clock().toISOString() };
  const plan = { planId: "plan_local_workflow_001", requestId: "request_local_workflow_001", status: "proposed", safety: { planAuthorizesExecution: false, protectedActions: [] } };
  const sandbox = await createSecureSandbox(sandboxRequest, evaluateSandboxPreparationGate(plan, sandboxRequest)); manifestRef = sandbox.result.manifestRef;
  await editSandbox(manifestRef, [{ operation: "overwrite", path: "src/index.mjs", text: "export const value = 2;\n" }], { timestamp: clock().toISOString() });
  const reviewed = await generateReviewedChange({ reviewRequestId: "reviewed_change_request_local_workflow_001", schemaVersion: "1.0.0", sandboxId: sandbox.manifest.sandboxId, manifestRef, proposalRef: "engineering_proposal_local_workflow_001", loopResultRef: "engineering_loop_result_local_workflow_001", protectedPaths: [], limits: { maxChangedFiles: 5, maxFileBytes: 65536, maxPatchBytes: 1048576, maxDiffLines: 1000 }, status: "proposed", createdAt: clock().toISOString() }, { clock });
  assert.throws(() => createLocalApprovalBundle({ reviewedChange: reviewed, reviewerId: "human_001", typedConfirmation: "APPROVE wrong", trustedSecret: secret }, { clock }), /Exact full/);
  const bundle = createLocalApprovalBundle({ reviewedChange: reviewed, reviewerId: "human_001", typedConfirmation: `APPROVE ${reviewed.patchSha256}`, trustedSecret: secret }, { clock, validityMs: 30 * 60 * 1000 });
  assert.equal(bundle.patchSha256, reviewed.patchSha256); assert.equal(bundle.attestation.decision, "approved");
  const sessionResult = { status: "awaiting_approval", sandboxManifestRef: manifestRef, artifacts: { sandboxResult: { manifestRef }, reviewedChange: reviewed } };
  const sessionRequest = { missionLock: { protectedArtifacts: [{ path: "ENGINEERING-CONSTITUTION.md" }] }, brain: { budget: { maxEdits: 5 } }, sandboxLimits: { maxSingleFileBytes: 65536, maxTotalBytes: 1048576 } };
  const input = { sessionResult, sessionRequest, bundle, trustedSecret: secret, approvalLedgerRoot: path.join(root, "approval-ledger"), transactionRoot: path.join(root, "transactions"), writeLedgerRoot: path.join(root, "write-ledger") };
  const applied = await applyLocalApprovalBundle(input, { clock });
  assert.equal(applied.status, "completed"); assert.equal(applied.verification.consumed, true); assert.equal(applied.transaction.journal.state, "completed");
  assert.equal(await readFile(path.join(source, "src/index.mjs"), "utf8"), "export const value = 2;\n");
  const reused = await applyLocalApprovalBundle(input, { clock }); assert.equal(reused.status, "blocked"); assert(reused.verification.errors[0].includes("already consumed"));
  console.log("PASSED local review workflow; exact typed hash; signed one-time approval; journaled apply; post-write hash; reuse blocked");
} finally { if (manifestRef) try { await cleanupSecureSandbox(manifestRef); } catch {} await rm(root, { recursive: true, force: true }); }
