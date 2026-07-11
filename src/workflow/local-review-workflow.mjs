import { randomBytes } from "node:crypto";
import { signChangeReviewAttestation, verifyChangeApproval } from "../approval/change-approval-verifier.mjs";
import { runJournaledControlledWrite } from "../writeback/durable-write-transaction.mjs";

const safeId = (value) => String(value).replace(/[^A-Za-z0-9_-]/g, "_").replace(/^[^A-Za-z0-9]+/, "") || "local";
function eligible(reviewed) { if (!reviewed || reviewed.status !== "ready_for_review" || reviewed.sourceSnapshotVerified !== true || reviewed.requiresHumanApproval !== true || reviewed.artifactAuthorizesSourceWrite !== false || !/^[a-f0-9]{64}$/.test(reviewed.patchSha256)) throw new Error("Reviewed Change is not eligible for local approval."); }

export function createLocalApprovalBundle({ reviewedChange, reviewerId, typedConfirmation, trustedSecret }, options = {}) {
  eligible(reviewedChange);
  if (typedConfirmation !== `APPROVE ${reviewedChange.patchSha256}`) throw new Error("Exact full patch-hash confirmation is required.");
  if (!reviewerId || String(reviewerId).length < 3) throw new Error("Explicit human reviewer identity is required.");
  const issued = options.clock?.() ?? new Date(); const expires = new Date(issued.getTime() + (options.validityMs ?? 15 * 60 * 1000));
  if (expires <= issued || expires.getTime() - issued.getTime() > 60 * 60 * 1000) throw new Error("Local approval validity must be positive and at most one hour.");
  const suffix = safeId(`${reviewedChange.reviewedChangeId.replace(/^reviewed_change_/, "")}_${randomBytes(8).toString("hex")}`);
  const approvalRequest = { request_id: `approval_${suffix}`, action_name: "apply_reviewed_patch", risk_level: "R3", approval_level: "A3", reason: "Human reviewed the exact patch hash in a local standalone workflow.", expected_impact: `${reviewedChange.changes.length} source path(s) will change.`, evidence_summary: `Reviewed Change ${reviewedChange.reviewedChangeId}; SHA-256 ${reviewedChange.patchSha256}.`, confidence_score: 100, simulation_completed: true, rollback_available: true, user_approval_required: true, approval_status: "approved", notes: "Approval is one-time, exact-hash bound, and does not authorize Git, release, or deployment." };
  const riskAssessment = { action_id: `risk_${suffix}`, action_name: "apply_reviewed_patch", risk_level: "R3", risk_reason: "Controlled local source write changes repository files and therefore requires explicit human approval.", confidence_score: 100, evidence_count: 3, approval_required: true, simulation_required: true, rollback_available: true, execution_allowed: true, notes: "Execution remains subject to immediate revalidation and durable write journaling." };
  const unsigned = { attestationId: `change_review_attestation_${suffix}`, schemaVersion: "1.0.0", approvalRequestRef: approvalRequest.request_id, riskAssessmentRef: riskAssessment.action_id, reviewedChangeRef: reviewedChange.reviewedChangeId, patchSha256: reviewedChange.patchSha256, decision: "approved", reviewerId: String(reviewerId), issuedAt: issued.toISOString(), expiresAt: expires.toISOString(), nonce: randomBytes(18).toString("base64url"), oneTimeUse: true, revoked: false, signatureAlgorithm: "hmac-sha256" };
  return { schemaVersion: "1.0.0", reviewedChangeRef: reviewedChange.reviewedChangeId, patchSha256: reviewedChange.patchSha256, approvalRequest, riskAssessment, attestation: { ...unsigned, signature: signChangeReviewAttestation(unsigned, trustedSecret) }, limitations: ["This bundle authorizes one exact-hash verification attempt only.", "It grants no Git, release, deployment, governance, or protected-path authority."] };
}

export async function applyLocalApprovalBundle({ sessionResult, sessionRequest, bundle, trustedSecret, approvalLedgerRoot, transactionRoot, writeLedgerRoot }, options = {}) {
  const reviewedChange = sessionResult?.artifacts?.reviewedChange; eligible(reviewedChange);
  if (sessionResult.status !== "awaiting_approval" || sessionResult.sandboxManifestRef !== sessionResult.artifacts?.sandboxResult?.manifestRef) throw new Error("Standalone Session Result is not awaiting approval or sandbox correlation failed.");
  if (bundle.reviewedChangeRef !== reviewedChange.reviewedChangeId || bundle.patchSha256 !== reviewedChange.patchSha256) throw new Error("Approval bundle does not correlate to the session patch.");
  const verification = await verifyChangeApproval({ reviewedChange, approvalRequest: bundle.approvalRequest, riskAssessment: bundle.riskAssessment, attestation: bundle.attestation, trustedSecret, ledgerRoot: approvalLedgerRoot }, options);
  if (verification.status !== "verified") return { status: "blocked", verification, transaction: null };
  const request = { writeRequestId: `controlled_write_request_${safeId(bundle.attestation.attestationId.replace(/^change_review_attestation_/, ""))}`, schemaVersion: "1.0.0", sandboxId: reviewedChange.sandboxId, manifestRef: sessionResult.sandboxManifestRef, approvalLedgerRef: approvalLedgerRoot, reviewedChange, approvalVerification: verification, protectedPaths: sessionRequest.missionLock.protectedArtifacts.map((item) => item.path), limits: { maxChangedFiles: sessionRequest.brain.budget.maxEdits, maxFileBytes: sessionRequest.sandboxLimits.maxSingleFileBytes, maxTotalWriteBytes: sessionRequest.sandboxLimits.maxTotalBytes, maxPatchBytes: sessionRequest.sandboxLimits.maxTotalBytes, maxDiffLines: 200000 }, status: "approved_for_single_write_attempt", createdAt: (options.clock?.() ?? new Date()).toISOString() };
  const transaction = await runJournaledControlledWrite(request, { ...options, transactionRoot, writeLedgerRoot });
  return { status: transaction.writeResult?.status === "completed" ? "completed" : "blocked", verification, transaction };
}
