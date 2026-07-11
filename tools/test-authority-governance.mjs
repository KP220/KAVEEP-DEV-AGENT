import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createAuthoritySnapshot, detectGovernanceDrift } from "../src/governance/authority-governance.mjs";
import { loadSchema, validateValue } from "./validate-examples.mjs";

const tempRoot = await mkdtemp(path.join(os.tmpdir(), "kaveep-authority-test-"));
const fixedClock = () => new Date("2026-07-10T00:00:00.000Z");
const documents = [
  { documentId: "engineering_constitution", path: "ENGINEERING-CONSTITUTION.md", precedence: 1, authorityType: "engineering_constitution", ownerRepository: "KAVEEP-DEV-AGENT" },
  { documentId: "engineering_charter", path: "ENGINEERING-CHARTER.md", precedence: 2, authorityType: "charter", ownerRepository: "KAVEEP-DEV-AGENT" }
];

async function assertSchema(value, schemaFile) {
  const schemaPath = path.resolve("schemas", schemaFile);
  const schema = await loadSchema(schemaPath);
  const errors = [];
  await validateValue(value, schema, { schemaPath, rootSchema: schema }, "$", errors);
  assert.deepEqual(errors, []);
}

try {
  await writeFile(path.join(tempRoot, "ENGINEERING-CONSTITUTION.md"), "# Constitution\nHuman authority over AI autonomy.\n", "utf8");
  await writeFile(path.join(tempRoot, "ENGINEERING-CHARTER.md"), "# Charter\nValidation before trust.\n", "utf8");
  const sourceBefore = await readFile(path.join(tempRoot, "ENGINEERING-CONSTITUTION.md"), "utf8");

  const snapshot = await createAuthoritySnapshot(tempRoot, documents, { snapshotId: "test_001", clock: fixedClock });
  await assertSchema(snapshot, "authority-snapshot.schema.json");
  assert.equal(snapshot.authorityDocuments.length, 2);
  assert.equal(snapshot.authorityChain[0].precedence, 1);

  const missionLock = {
    missionLockId: "mission_lock_test_001", schemaVersion: "1.0.0", authoritySnapshotRef: snapshot.authoritySnapshotId,
    lockedPrinciples: [{ principleId: "principle_human_authority", name: "Human Authority", statement: "Human authority remains above AI autonomy.", sourceDocumentRef: snapshot.authorityDocuments[0].documentId }],
    protectedArtifacts: snapshot.authorityDocuments.map((document) => ({ path: document.path, protectionLevel: "governance_locked", reason: "Authority artifact requires its owning governance process." })),
    prohibitedAutonomousChanges: ["mission", "governance", "human_approval_rules"],
    kcpRequiredChanges: ["architecture", "governance", "agent_conflict"],
    humanApprovalRequiredChanges: ["mission", "governance", "human_approval_rules", "source_write_back"],
    limitations: ["Mission Lock grants no authority."], status: "active", createdAt: fixedClock().toISOString()
  };
  await assertSchema(missionLock, "mission-lock.schema.json");

  const aligned = await detectGovernanceDrift(snapshot, missionLock, { clock: fixedClock });
  await assertSchema(aligned, "governance-drift-result.schema.json");
  assert.equal(aligned.status, "aligned");
  assert.equal(aligned.decision, "continue_read_only_pipeline");
  assert.equal(await readFile(path.join(tempRoot, "ENGINEERING-CONSTITUTION.md"), "utf8"), sourceBefore);

  const protectedProposal = await detectGovernanceDrift(snapshot, missionLock, {
    clock: fixedClock,
    proposedChanges: [{ operation: "modify", path: "ENGINEERING-CONSTITUTION.md", affectedPrincipleRefs: ["principle_human_authority"], changeCategories: ["governance"] }]
  });
  assert.equal(protectedProposal.status, "blocked");
  assert.equal(protectedProposal.recommendedNextAction, "request_governance_process");
  assert(protectedProposal.protectedProposalFindings.length >= 3);
  const escapedProposal = await detectGovernanceDrift(snapshot, missionLock, { clock: fixedClock, proposedChanges: [{ operation: "modify", path: "../ENGINEERING-CONSTITUTION.md" }] });
  assert.equal(escapedProposal.status, "blocked");
  assert.equal(escapedProposal.protectedProposalFindings[0].code, "invalid_proposed_change_path");

  await writeFile(path.join(tempRoot, "ENGINEERING-CONSTITUTION.md"), "# Changed Constitution\n", "utf8");
  const drifted = await detectGovernanceDrift(snapshot, missionLock, { clock: fixedClock });
  assert.equal(drifted.status, "blocked");
  assert.equal(drifted.checkedDocuments[0].status, "modified");
  assert.equal(drifted.findings[0].code, "authority_document_modified");

  await assert.rejects(() => createAuthoritySnapshot(tempRoot, [{ ...documents[0], path: "../outside.md" }]), /outside|escape|approved root/i);
  await assert.rejects(() => createAuthoritySnapshot(tempRoot, [documents[0], { ...documents[1], precedence: 1 }]), /Duplicate authority precedence/);
  await mkdir(path.join(tempRoot, "directory"));
  await assert.rejects(() => createAuthoritySnapshot(tempRoot, [{ ...documents[0], path: "directory" }]), /regular file|directory/i);

  console.log("PASSED authority snapshot, mission lock, and governance drift tests; read-only boundary preserved");
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
