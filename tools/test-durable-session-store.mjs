import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { LlmAdapterRegistry } from "../src/brain/engineering-brain.mjs";
import { createAuthoritySnapshot } from "../src/governance/authority-governance.mjs";
import { cancelDurableSession, createDurableSessionStore, persistStandaloneSession, recoverDurableSession, replayDurableSession } from "../src/persistence/durable-session-store.mjs";

const root = await mkdtemp(path.join(os.tmpdir(), "kaveep-durable-session-test-"));
const repo = path.join(root, "repo"); const store = path.join(root, "store");
const clock = () => new Date("2026-07-11T00:00:00.000Z");
try {
  await mkdir(path.join(repo, "src"), { recursive: true });
  await writeFile(path.join(repo, "ENGINEERING-CONSTITUTION.md"), "# Constitution\nHuman authority.\n");
  await writeFile(path.join(repo, "ENGINEERING-CHARTER.md"), "# Charter\nValidation before trust.\n");
  await writeFile(path.join(repo, "README.md"), "# Fixture\n");
  await writeFile(path.join(repo, "package.json"), JSON.stringify({ name: "fixture" }));
  await writeFile(path.join(repo, "src/index.mjs"), "export const value = 1;\n");
  const original = await readFile(path.join(repo, "src/index.mjs"), "utf8");
  const snapshot = await createAuthoritySnapshot(repo, [
    { documentId: "constitution", path: "ENGINEERING-CONSTITUTION.md", precedence: 1, authorityType: "engineering_constitution", ownerRepository: "KAVEEP-DEV-AGENT" },
    { documentId: "charter", path: "ENGINEERING-CHARTER.md", precedence: 2, authorityType: "charter", ownerRepository: "KAVEEP-DEV-AGENT" }
  ], { snapshotId: "durable_session_001", clock });
  const missionLock = { missionLockId: "mission_lock_durable_session_001", schemaVersion: "1.0.0", authoritySnapshotRef: snapshot.authoritySnapshotId, lockedPrinciples: [{ principleId: "principle_human_authority", name: "Human Authority", statement: "Human authority remains above AI autonomy.", sourceDocumentRef: snapshot.authorityDocuments[0].documentId }], protectedArtifacts: snapshot.authorityDocuments.map((item) => ({ path: item.path, protectionLevel: "governance_locked", reason: "Governance process required." })), prohibitedAutonomousChanges: ["mission", "governance"], kcpRequiredChanges: ["governance"], humanApprovalRequiredChanges: ["source_write_back"], limitations: ["No authority granted."], status: "active", createdAt: clock().toISOString() };
  const request = { sessionRequestId: "standalone_session_request_durable_001", schemaVersion: "1.0.0", command: "modify code in src/index.mjs", repositoryRoot: repo, authoritySnapshot: snapshot, missionLock, brain: { providerId: "mock", model: "mock-model", maxContextFiles: 20, budget: { maxContextCharacters: 100000, maxOutputTokens: 4000, maxEdits: 5, timeoutMs: 5000 } }, sandboxLimits: { maxFiles: 100, maxDirectories: 50, maxTotalBytes: 1048576, maxSingleFileBytes: 65536, maxDepth: 10, maxPathLength: 512, maxLifetimeSeconds: 3600 }, loop: { maxAttempts: 2 }, container: { enabled: false, required: false, image: "", allowedImages: [], operations: [], limits: {} }, status: "proposed", createdAt: clock().toISOString() };
  const registry = new LlmAdapterRegistry().register("mock", { async generateStructured({ input }) { const parsed = JSON.parse(input); return { value: { proposalId: "engineering_proposal_durable_001", schemaVersion: "1.0.0", ...parsed.refs, objective: parsed.objective, analysis: "Bounded edit.", assumptions: [], proposedEdits: [{ operation: "overwrite", path: "src/index.mjs", reason: "Requested edit.", text: "export const value = 2;\n" }], validationFiles: ["src/index.mjs"], risks: [{ level: "low", description: "Export changes.", mitigation: "Review." }], requiresPolicyEvaluation: false, requiresKcp: false, requiresHumanApproval: true, proposalAuthorizesExecution: false, status: "proposed", recommendedNextAction: "review_proposal" } }; } });
  const manifest = await createDurableSessionStore(store, { retentionDays: 30, maxSessions: 50 }, { clock });
  assert.equal(manifest.retentionPolicy.automaticDeletion, false);
  await assert.rejects(() => persistStandaloneSession(store, { ...request, apiToken: "sk-abcdefghijklmnop" }, registry, { sessionId: "secret", clock }), /secret-like/);
  await assert.rejects(() => persistStandaloneSession(store, request, registry, { sessionId: "crash_001", clock, crashAfterState: "sandbox_ready" }), /Injected crash/);
  const crashedId = "durable_session_crash_001";
  const replay = await replayDurableSession(store, crashedId);
  assert.equal(replay.status, "verified"); assert.equal(replay.record.state, "sandbox_ready"); assert.equal(replay.record.governanceRecheckRequired, true);
  const recovery = await recoverDurableSession(store, crashedId, registry, { clock });
  assert.equal(recovery.status, "restarted_from_received");
  assert.equal(recovery.recovered.result.status, "awaiting_approval");
  assert.equal(recovery.recovered.record.parentSessionRef, crashedId);
  assert.equal(recovery.recovered.result.events[0].state, "analyzing");
  assert.equal(await readFile(path.join(repo, "src/index.mjs"), "utf8"), original);
  const cancelledRecovery = await cancelDurableSession(store, recovery.recoveredSessionRef, { clock });
  assert.equal(cancelledRecovery.status, "cancelled"); assert.equal(cancelledRecovery.cleanupStatus, "cleaned");
  const cancelledCrash = await cancelDurableSession(store, crashedId, { clock });
  assert.equal(cancelledCrash.status, "cancelled"); assert.equal(cancelledCrash.cleanupStatus, "cleaned");
  const completed = await persistStandaloneSession(store, request, registry, { sessionId: "tamper_001", clock });
  const eventsPath = path.join(store, "sessions", completed.record.durableSessionId, "events.jsonl");
  await writeFile(eventsPath, (await readFile(eventsPath, "utf8")).replace('"eventType":"session_created"', '"eventType":"session_cancelled"'));
  const corrupted = await replayDurableSession(store, completed.record.durableSessionId);
  assert.equal(corrupted.status, "corrupted"); assert.equal(corrupted.recoveryAllowed, false);
  assert.equal((await cancelDurableSession(store, completed.record.durableSessionId)).status, "blocked");
  console.log("PASSED durable session store; injected crash replay; governance restart; tamper block; cancel cleanup; source unchanged");
} finally { await rm(root, { recursive: true, force: true }); }
