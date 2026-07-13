import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { LlmAdapterRegistry } from "../src/brain/engineering-brain.mjs";
import { runEngineeringEvaluationSuite } from "../src/evaluation/engineering-evaluation-runner.mjs";
import { createAuthoritySnapshot } from "../src/governance/authority-governance.mjs";
import { runStandaloneSession } from "../src/session/standalone-engineering-session.mjs";

const clock = () => new Date("2026-07-13T00:00:00.000Z");
const cases = [
  { caseId: "bug_fix_001", taskType: "bug_fix", command: "modify code in src/bug.mjs to handle null input", expectedChangedPaths: ["src/bug.mjs"], maxLatencyMs: 5000, edits: [{ operation: "overwrite", path: "src/bug.mjs", reason: "Handle null input.", text: "export const normalize = value => value ?? '';\n" }] },
  { caseId: "refactor_001", taskType: "refactor", command: "modify code in src/refactor.mjs to normalize strings", expectedChangedPaths: ["src/refactor.mjs"], maxLatencyMs: 5000, edits: [{ operation: "overwrite", path: "src/refactor.mjs", reason: "Extract concise normalization.", text: "export const normalize = value => String(value).trim();\n" }] },
  { caseId: "test_writing_001", taskType: "test_writing", command: "modify code by adding test/feature.test.mjs", expectedChangedPaths: ["test/feature.test.mjs"], maxLatencyMs: 5000, edits: [{ operation: "create", path: "test/feature.test.mjs", reason: "Add boundary coverage.", text: "import assert from 'node:assert/strict';\nassert.equal(1, 1);\n" }] },
  { caseId: "multi_file_001", taskType: "multi_file", command: "modify code in src/api.mjs and src/client.mjs", expectedChangedPaths: ["src/api.mjs", "src/client.mjs"], maxLatencyMs: 5000, edits: [{ operation: "overwrite", path: "src/api.mjs", reason: "Expose versioned API.", text: "export const apiVersion = 'v2';\n" }, { operation: "overwrite", path: "src/client.mjs", reason: "Use versioned API.", text: "export const clientVersion = 'v2';\n" }] }
];

async function executeCase(item) {
  const root = await mkdtemp(path.join(os.tmpdir(), `kaveep-eval-${item.caseId}-`));
  try {
    await mkdir(path.join(root, "src"), { recursive: true });
    await mkdir(path.join(root, "test"), { recursive: true });
    await writeFile(path.join(root, "ENGINEERING-CONSTITUTION.md"), "# Constitution\nHuman authority.\n");
    await writeFile(path.join(root, "ENGINEERING-CHARTER.md"), "# Charter\nValidation first.\n");
    await writeFile(path.join(root, "package.json"), JSON.stringify({ name: "evaluation-fixture", scripts: { lint: "node --check src/bug.mjs", test: "node --test" } }));
    await writeFile(path.join(root, "src", "bug.mjs"), "export const normalize = value => value.trim();\n");
    await writeFile(path.join(root, "src", "refactor.mjs"), "export const normalize = value => String(value);\n");
    await writeFile(path.join(root, "src", "api.mjs"), "export const apiVersion = 'v1';\n");
    await writeFile(path.join(root, "src", "client.mjs"), "export const clientVersion = 'v1';\n");
    const before = await Promise.all(["src/bug.mjs", "src/refactor.mjs", "src/api.mjs", "src/client.mjs"].map(async (file) => [file, await readFile(path.join(root, file), "utf8")]));
    const snapshot = await createAuthoritySnapshot(root, [
      { documentId: "constitution", path: "ENGINEERING-CONSTITUTION.md", precedence: 1, authorityType: "engineering_constitution", ownerRepository: "KAVEEP-DEV-AGENT" },
      { documentId: "charter", path: "ENGINEERING-CHARTER.md", precedence: 2, authorityType: "charter", ownerRepository: "KAVEEP-DEV-AGENT" }
    ], { snapshotId: `evaluation_${item.caseId}`, clock });
    const missionLock = { missionLockId: `mission_lock_${item.caseId}`, schemaVersion: "1.0.0", authoritySnapshotRef: snapshot.authoritySnapshotId, lockedPrinciples: [{ principleId: "human_authority", name: "Human Authority", statement: "Human authority remains above AI autonomy.", sourceDocumentRef: snapshot.authorityDocuments[0].documentId }], protectedArtifacts: snapshot.authorityDocuments.map((document) => ({ path: document.path, protectionLevel: "governance_locked", reason: "Governance required." })), prohibitedAutonomousChanges: ["governance"], kcpRequiredChanges: ["architecture"], humanApprovalRequiredChanges: ["source_write_back"], limitations: ["No authority granted."], status: "active", createdAt: clock().toISOString() };
    const registry = new LlmAdapterRegistry().register("mock", { async generateStructured({ input }) { const parsed = JSON.parse(input); return { value: { proposalId: `proposal_${item.caseId}`, schemaVersion: "1.0.0", ...parsed.refs, objective: parsed.objective, analysis: "Deterministic isolated evaluation proposal.", assumptions: [], proposedEdits: item.edits, validationFiles: item.edits.map((edit) => edit.path), risks: [{ level: "low", description: "Evaluation fixture only.", mitigation: "Human review." }], requiresPolicyEvaluation: false, requiresKcp: false, requiresHumanApproval: true, proposalAuthorizesExecution: false, status: "proposed", recommendedNextAction: "review_proposal" }, usage: { inputTokens: 12, outputTokens: 8 } }; } });
    const started = performance.now();
    const result = await runStandaloneSession({ sessionRequestId: `standalone_session_request_${item.caseId}`, schemaVersion: "1.0.0", command: item.command, repositoryRoot: root, authoritySnapshot: snapshot, missionLock, brain: { providerId: "mock", model: "deterministic-evaluation", maxContextFiles: 20, budget: { maxContextCharacters: 100000, maxOutputTokens: 1000, maxEdits: 5, timeoutMs: 5000 } }, sandboxLimits: { maxFiles: 100, maxDirectories: 50, maxTotalBytes: 1048576, maxSingleFileBytes: 65536, maxDepth: 10, maxPathLength: 512, maxLifetimeSeconds: 3600 }, loop: { maxAttempts: 1 }, container: { enabled: false, required: false, executionProfile: "node", image: "node:test", allowedImages: ["node:test"], operations: [], limits: {} }, status: "proposed", createdAt: clock().toISOString() }, registry, { clock });
    const after = await Promise.all(before.map(async ([file]) => [file, await readFile(path.join(root, file), "utf8")]));
    assert.equal(result.status, "awaiting_approval", JSON.stringify(result));
    return { status: result.status, sourceUnchanged: JSON.stringify(before) === JSON.stringify(after), durationMs: performance.now() - started, usage: result.artifacts.engineeringLoop.attempts[0].brainResult.usage, changedPaths: result.artifacts.reviewedChange.changes.map((change) => change.path) };
  } finally { await rm(root, { recursive: true, force: true }); }
}

const report = await runEngineeringEvaluationSuite(cases, executeCase, { clock, evaluationSuiteId: "isolated_task_baseline_001" });
assert.equal(report.status, "passed", JSON.stringify(report));
assert.equal(report.passedCases, 4);
assert.equal(report.aggregateUsage.inputTokens, 48);
assert.equal(report.aggregateUsage.outputTokens, 32);
console.log("PASSED isolated task evaluation suite; four sandboxed workflows; reviewed artifacts, latency, usage, and source integrity");
