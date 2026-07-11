import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createAuthoritySnapshot } from "../src/governance/authority-governance.mjs";
import { runReadOnlyOrchestration } from "../src/orchestration/dev-orchestrator.mjs";
import { loadSchema, validateValue } from "./validate-examples.mjs";

const root = await mkdtemp(path.join(os.tmpdir(), "kaveep-orchestrator-test-"));
const fixedClock = () => new Date("2026-07-10T00:00:00.000Z");

async function validate(value, schemaName) {
  const schemaPath = path.resolve("schemas", schemaName);
  const schema = await loadSchema(schemaPath); const errors = [];
  await validateValue(value, schema, { schemaPath, rootSchema: schema }, "$", errors);
  assert.deepEqual(errors, []);
}

try {
  await writeFile(path.join(root, "ENGINEERING-CONSTITUTION.md"), "# Constitution\nHuman authority over AI autonomy.\n", "utf8");
  await writeFile(path.join(root, "ENGINEERING-CHARTER.md"), "# Charter\nValidation before trust.\n", "utf8");
  await writeFile(path.join(root, "README.md"), "# Test Repository\n", "utf8");
  await writeFile(path.join(root, "package.json"), JSON.stringify({ name: "orchestrator-fixture", scripts: { test: "node test.mjs" } }), "utf8");
  await writeFile(path.join(root, "test.mjs"), "// observed only; never executed\n", "utf8");
  const authorityBefore = await readFile(path.join(root, "ENGINEERING-CONSTITUTION.md"), "utf8");
  const snapshot = await createAuthoritySnapshot(root, [
    { documentId: "constitution", path: "ENGINEERING-CONSTITUTION.md", precedence: 1, authorityType: "engineering_constitution", ownerRepository: "KAVEEP-DEV-AGENT" },
    { documentId: "charter", path: "ENGINEERING-CHARTER.md", precedence: 2, authorityType: "charter", ownerRepository: "KAVEEP-DEV-AGENT" }
  ], { snapshotId: "orchestrator_001", clock: fixedClock });
  const lock = {
    missionLockId: "mission_lock_orchestrator_001", schemaVersion: "1.0.0", authoritySnapshotRef: snapshot.authoritySnapshotId,
    lockedPrinciples: [{ principleId: "principle_human_authority", name: "Human Authority", statement: "Human authority remains above AI autonomy.", sourceDocumentRef: snapshot.authorityDocuments[0].documentId }],
    protectedArtifacts: snapshot.authorityDocuments.map((document) => ({ path: document.path, protectionLevel: "governance_locked", reason: "Governance process required." })),
    prohibitedAutonomousChanges: ["mission", "governance"], kcpRequiredChanges: ["architecture", "governance"], humanApprovalRequiredChanges: ["mission", "governance", "source_write_back"],
    limitations: ["No authority is granted."], status: "active", createdAt: fixedClock().toISOString()
  };

  const completed = await runReadOnlyOrchestration({ command: "inspect repository and create engineering plan", repositoryRoot: root, authoritySnapshot: snapshot, missionLock: lock }, { runId: "completed_001", clock: fixedClock });
  await validate(completed, "dev-orchestration-run.schema.json");
  assert.equal(completed.state, "completed");
  assert.equal(completed.terminal, true);
  assert.deepEqual(completed.transitions.map((item) => item.toState), ["governance_prechecked", "interpreted", "repository_inspected", "context_built", "planned", "governance_postchecked", "completed"]);
  assert.equal(completed.checkpoints.length, completed.transitions.length);
  assert.equal(completed.governanceChecks.length, 2);
  assert.equal(completed.artifacts.engineeringPlan.safety.planAuthorizesExecution, false);
  assert.equal(await readFile(path.join(root, "ENGINEERING-CONSTITUTION.md"), "utf8"), authorityBefore);

  const noAction = await runReadOnlyOrchestration({ command: "", repositoryRoot: root, authoritySnapshot: snapshot, missionLock: lock }, { runId: "no_action_001", clock: fixedClock });
  assert.equal(noAction.status, "no_action");
  assert.deepEqual(noAction.transitions.map((item) => item.toState), ["governance_prechecked", "no_action"]);

  const protectedRun = await runReadOnlyOrchestration({ command: "delete file and push to production", repositoryRoot: root, authoritySnapshot: snapshot, missionLock: lock }, { runId: "protected_001", clock: fixedClock });
  assert.equal(protectedRun.status, "blocked");
  assert.equal(protectedRun.state, "blocked");
  assert.equal(protectedRun.artifacts.repositoryIntelligence, undefined);

  const proposalBlocked = await runReadOnlyOrchestration({
    command: "inspect repository", repositoryRoot: root, authoritySnapshot: snapshot, missionLock: lock,
    proposedChanges: [{ operation: "modify", path: "ENGINEERING-CONSTITUTION.md", changeCategories: ["governance"] }]
  }, { runId: "proposal_001", clock: fixedClock });
  assert.equal(proposalBlocked.status, "blocked");
  assert.deepEqual(proposalBlocked.transitions.map((item) => item.toState), ["blocked"]);
  assert.equal(proposalBlocked.artifacts.engineeringRequest, undefined);

  await writeFile(path.join(root, "ENGINEERING-CONSTITUTION.md"), "# Drifted Constitution\n", "utf8");
  const driftBlocked = await runReadOnlyOrchestration({ command: "inspect repository", repositoryRoot: root, authoritySnapshot: snapshot, missionLock: lock }, { runId: "drift_001", clock: fixedClock });
  assert.equal(driftBlocked.status, "blocked");
  assert.equal(driftBlocked.governanceChecks[0].findings[0].code, "authority_document_modified");
  console.log("PASSED DEV-Orchestrator read-only state machine tests; governance fail-closed; no repository code executed");
} finally {
  await rm(root, { recursive: true, force: true });
}

