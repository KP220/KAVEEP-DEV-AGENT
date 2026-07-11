import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { LlmAdapterRegistry } from "../src/brain/engineering-brain.mjs";
import { createAuthoritySnapshot } from "../src/governance/authority-governance.mjs";
import { cleanupSecureSandbox } from "../src/sandbox/secure-sandbox-manager.mjs";
import { runStandaloneSession } from "../src/session/standalone-engineering-session.mjs";
import { loadSchema, validateValue } from "./validate-examples.mjs";

const root = await mkdtemp(path.join(os.tmpdir(), "kaveep-session-test-"));
const clock = () => new Date("2026-07-11T00:00:00.000Z");
let manifestRef;

async function validate(value, name) {
  const schemaPath = path.resolve("schemas", name);
  const schema = await loadSchema(schemaPath);
  const errors = [];
  await validateValue(value, schema, { schemaPath, rootSchema: schema }, "$", errors);
  assert.deepEqual(errors, []);
}

try {
  await mkdir(path.join(root, "src"));
  await writeFile(path.join(root, "ENGINEERING-CONSTITUTION.md"), "# Constitution\nHuman authority over AI autonomy.\n");
  await writeFile(path.join(root, "ENGINEERING-CHARTER.md"), "# Charter\nValidation before trust.\n");
  await writeFile(path.join(root, "README.md"), "# Fixture\n");
  await writeFile(path.join(root, "package.json"), JSON.stringify({ name: "fixture", scripts: { test: "node --test", lint: "node --check src/index.mjs" } }));
  await writeFile(path.join(root, "src", "index.mjs"), "export const value = 1;\n");
  const original = await readFile(path.join(root, "src", "index.mjs"), "utf8");
  const snapshot = await createAuthoritySnapshot(root, [
    { documentId: "constitution", path: "ENGINEERING-CONSTITUTION.md", precedence: 1, authorityType: "engineering_constitution", ownerRepository: "KAVEEP-DEV-AGENT" },
    { documentId: "charter", path: "ENGINEERING-CHARTER.md", precedence: 2, authorityType: "charter", ownerRepository: "KAVEEP-DEV-AGENT" }
  ], { snapshotId: "session_001", clock });
  const missionLock = {
    missionLockId: "mission_lock_session_001", schemaVersion: "1.0.0", authoritySnapshotRef: snapshot.authoritySnapshotId,
    lockedPrinciples: [{ principleId: "principle_human_authority", name: "Human Authority", statement: "Human authority remains above AI autonomy.", sourceDocumentRef: snapshot.authorityDocuments[0].documentId }],
    protectedArtifacts: snapshot.authorityDocuments.map((document) => ({ path: document.path, protectionLevel: "governance_locked", reason: "Governance process required." })),
    prohibitedAutonomousChanges: ["mission", "governance"], kcpRequiredChanges: ["architecture", "governance"],
    humanApprovalRequiredChanges: ["mission", "governance", "source_write_back"], limitations: ["No authority is granted."],
    status: "active", createdAt: clock().toISOString()
  };
  const request = {
    sessionRequestId: "standalone_session_request_test_001", schemaVersion: "1.0.0",
    command: "modify code in src/index.mjs to export greeting", repositoryRoot: root,
    authoritySnapshot: snapshot, missionLock,
    brain: { providerId: "mock", model: "mock-model", maxContextFiles: 20, budget: { maxContextCharacters: 100000, maxOutputTokens: 4000, maxEdits: 5, timeoutMs: 5000 } },
    sandboxLimits: { maxFiles: 100, maxDirectories: 50, maxTotalBytes: 1048576, maxSingleFileBytes: 65536, maxDepth: 10, maxPathLength: 512, maxLifetimeSeconds: 3600 },
    loop: { maxAttempts: 2 },
    container: { enabled: true, required: true, executionProfile: "node", image: "node:22-bookworm-slim", allowedImages: ["node:22-bookworm-slim"], operations: ["lint", "test"], limits: { timeoutMsPerOperation: 5000, maxOutputBytes: 65536, memoryMb: 512, cpus: 1, pids: 64 } },
    status: "proposed", createdAt: clock().toISOString()
  };
  const registry = new LlmAdapterRegistry().register("mock", {
    async generateStructured({ input }) {
      const parsed = JSON.parse(input);
      return { value: {
        proposalId: "engineering_proposal_session_001", schemaVersion: "1.0.0", ...parsed.refs,
        objective: parsed.objective, analysis: "A bounded source edit is sufficient.", assumptions: [],
        proposedEdits: [{ operation: "overwrite", path: "src/index.mjs", reason: "Add requested greeting.", text: "export const greeting = 'hello';\n" }],
        validationFiles: ["src/index.mjs"], risks: [{ level: "low", description: "Export changes.", mitigation: "Review patch and tests." }],
        requiresPolicyEvaluation: false, requiresKcp: false, requiresHumanApproval: true,
        proposalAuthorizesExecution: false, status: "proposed", recommendedNextAction: "review_proposal"
      }, usage: { inputTokens: 10, outputTokens: 20 } };
    }
  });
  const adapter = { async run(_file, args) { return args[0] === "info"
    ? { exitCode: 0, timedOut: false, overflow: false, stdout: "29", stderr: "", durationMs: 1 }
    : { exitCode: 0, timedOut: false, overflow: false, stdout: "ok", stderr: "", durationMs: 2 }; } };

  const result = await runStandaloneSession(request, registry, { clock, containerProcessAdapter: adapter, dockerExecutable: "docker-mock" });
  manifestRef = result.sandboxManifestRef;
  assert.equal(result.status, "awaiting_approval");
  assert.deepEqual(result.events.map((event) => event.state), ["analyzing", "sandbox_ready", "engineering", "validating", "reviewing", "awaiting_approval"]);
  assert.equal(result.artifacts.containerValidation.status, "passed");
  assert.equal(result.artifacts.reviewedChange.status, "ready_for_review");
  assert.equal(result.cleanupRequired, true);
  assert.equal(await readFile(path.join(root, "src", "index.mjs"), "utf8"), original);
  await validate(result, "standalone-session-result.schema.json");

  await cleanupSecureSandbox(manifestRef); manifestRef = undefined;
  const unavailable = await runStandaloneSession({ ...request, sessionRequestId: "standalone_session_request_test_002" }, registry, {
    clock, dockerExecutable: "docker-mock", containerProcessAdapter: { run: async () => ({ exitCode: 1, timedOut: false, overflow: false, stdout: "", stderr: "offline", durationMs: 1 }) }
  });
  manifestRef = unavailable.sandboxManifestRef;
  assert.equal(unavailable.status, "blocked");
  assert.equal(unavailable.recommendedNextAction, "start_container_runtime");
  await cleanupSecureSandbox(manifestRef); manifestRef = undefined;

  let brainCalls = 0; let validationRuns = 0; let repairSawBoundedFeedback = false;
  const semanticRegistry = new LlmAdapterRegistry().register("mock", { async generateStructured({ input }) {
    brainCalls += 1; const parsed = JSON.parse(input);
    if (brainCalls === 2) repairSawBoundedFeedback = parsed.objective.includes("lint failed from isolated test");
    return { value: {
      proposalId: `engineering_proposal_semantic_${brainCalls}`, schemaVersion: "1.0.0", ...parsed.refs,
      objective: parsed.objective, analysis: "Apply bounded semantic repair.", assumptions: [],
      proposedEdits: [{ operation: "overwrite", path: "src/index.mjs", reason: "Repair semantic failure.", text: brainCalls === 1 ? "export const greeting = 'bad';\n" : "export const greeting = 'fixed';\n" }],
      validationFiles: ["src/index.mjs"], risks: [{ level: "low", description: "Behavior changes.", mitigation: "Run semantic validation." }],
      requiresPolicyEvaluation: false, requiresKcp: false, requiresHumanApproval: true,
      proposalAuthorizesExecution: false, status: "proposed", recommendedNextAction: "review_proposal"
    } };
  } });
  const semanticAdapter = { async run(_file, args) {
    if (args[0] === "info") return { exitCode: 0, timedOut: false, overflow: false, stdout: "29", stderr: "", durationMs: 1 };
    validationRuns += 1;
    return validationRuns === 1
      ? { exitCode: 1, timedOut: false, overflow: false, stdout: "", stderr: "lint failed from isolated test", durationMs: 2 }
      : { exitCode: 0, timedOut: false, overflow: false, stdout: "ok", stderr: "", durationMs: 2 };
  } };
  const repaired = await runStandaloneSession({ ...request, sessionRequestId: "standalone_session_request_test_003", loop: { maxAttempts: 2, semanticMaxAttempts: 2, maxSemanticFeedbackCharacters: 1000 }, container: { ...request.container, operations: ["lint"] } }, semanticRegistry, { clock, containerProcessAdapter: semanticAdapter, dockerExecutable: "docker-mock" });
  manifestRef = repaired.sandboxManifestRef;
  assert.equal(repaired.status, "awaiting_approval"); assert.equal(brainCalls, 2); assert.equal(repairSawBoundedFeedback, true);
  assert.deepEqual(repaired.artifacts.containerValidationAttempts.map((item) => item.status), ["failed", "passed"]);
  assert.equal(repaired.artifacts.reviewedChange.patch.includes("fixed"), true);
  console.log("PASSED standalone engineering session E2E; governance-to-review; bounded semantic repair; runtime fail-closed; source unchanged");
} finally {
  if (manifestRef) try { await cleanupSecureSandbox(manifestRef); } catch {}
  await rm(root, { recursive: true, force: true });
}
