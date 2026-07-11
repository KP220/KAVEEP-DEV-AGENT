import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createAuthoritySnapshot } from "../src/governance/authority-governance.mjs";
import { createDurableStore, persistReadOnlyOrchestration, recoverDurableRun, replayDurableRun } from "../src/persistence/durable-orchestration-store.mjs";
import { loadSchema, validateValue } from "./validate-examples.mjs";

const root = await mkdtemp(path.join(os.tmpdir(), "kaveep-durable-test-"));
const repo = path.join(root, "repo"); const store = path.join(root, "store");
const clock = () => new Date("2026-07-10T00:00:00.000Z");
async function validate(value, name) { const schemaPath=path.resolve("schemas",name); const schema=await loadSchema(schemaPath); const errors=[]; await validateValue(value,schema,{schemaPath,rootSchema:schema},"$",errors); assert.deepEqual(errors,[]); }

try {
  const { mkdir } = await import("node:fs/promises"); await mkdir(repo);
  await writeFile(path.join(repo,"ENGINEERING-CONSTITUTION.md"),"# Constitution\nHuman authority.\n");
  await writeFile(path.join(repo,"ENGINEERING-CHARTER.md"),"# Charter\nValidation before trust.\n");
  await writeFile(path.join(repo,"README.md"),"# Fixture\n");
  const snapshot=await createAuthoritySnapshot(repo,[
    {documentId:"constitution",path:"ENGINEERING-CONSTITUTION.md",precedence:1,authorityType:"engineering_constitution",ownerRepository:"KAVEEP-DEV-AGENT"},
    {documentId:"charter",path:"ENGINEERING-CHARTER.md",precedence:2,authorityType:"charter",ownerRepository:"KAVEEP-DEV-AGENT"}
  ],{snapshotId:"durable_001",clock});
  const missionLock={missionLockId:"mission_lock_durable_001",schemaVersion:"1.0.0",authoritySnapshotRef:snapshot.authoritySnapshotId,lockedPrinciples:[{principleId:"principle_human_authority",name:"Human Authority",statement:"Human authority remains above AI autonomy.",sourceDocumentRef:snapshot.authorityDocuments[0].documentId}],protectedArtifacts:snapshot.authorityDocuments.map(x=>({path:x.path,protectionLevel:"governance_locked",reason:"Governance process required."})),prohibitedAutonomousChanges:["mission","governance"],kcpRequiredChanges:["governance"],humanApprovalRequiredChanges:["mission","governance"],limitations:["No authority granted."],status:"active",createdAt:clock().toISOString()};
  const manifest=await createDurableStore(store,{retentionDays:30,maxRuns:50},{clock});
  assert.equal(manifest.retentionPolicy.automaticDeletion,false);
  const input={command:"inspect repository and create engineering plan",repositoryRoot:repo,authoritySnapshot:snapshot,missionLock};
  const persisted=await persistReadOnlyOrchestration(store,input,{runId:"persist_001",clock});
  await validate(persisted.record,"durable-run-record.schema.json");
  assert(["completed","completed_with_warnings"].includes(persisted.record.status));
  const replay=await replayDurableRun(store,persisted.record.durableRunId);
  await validate(replay,"durable-replay-result.schema.json");
  assert.equal(replay.status,"verified"); assert(replay.eventCount>=9);
  const events=(await readFile(path.join(store,"runs",persisted.record.durableRunId,"events.jsonl"),"utf8")).trim().split(/\r?\n/).map(JSON.parse);
  for(const event of events) await validate(event,"durable-audit-event.schema.json");
  const checkpoint=JSON.parse(await readFile(path.join(store,"runs",persisted.record.durableRunId,"checkpoint.json"),"utf8"));
  assert.equal(checkpoint.durablyPersisted,true); assert.equal(checkpoint.resumable,true);

  const recovery=await recoverDurableRun(store,persisted.record.durableRunId,{clock});
  await validate(recovery,"durable-recovery-result.schema.json");
  assert.equal(recovery.status,"restarted_from_received");
  assert.notEqual(recovery.recoveredRunRef,recovery.sourceRunRef);
  const recoveredEvents=(await readFile(path.join(store,"runs",recovery.recoveredRunRef,"events.jsonl"),"utf8")).trim().split(/\r?\n/).map(JSON.parse);
  assert.equal(recoveredEvents[0].eventType,"run_created");
  const recoveredInputPayload=JSON.parse(await readFile(path.join(store,"artifacts",recoveredEvents[0].payloadHash+".json"),"utf8"));
  assert.equal(recoveredInputPayload.parentRunRef,persisted.record.durableRunId);

  await writeFile(path.join(store,".store.lock"),JSON.stringify({pid:2147483647,acquiredAt:"2026-07-10T00:00:00.000Z"}),"utf8");
  const reclaimed=await persistReadOnlyOrchestration(store,input,{runId:"reclaimed_lock",clock});
  assert(["completed","completed_with_warnings"].includes(reclaimed.record.status));
  await assert.rejects(()=>persistReadOnlyOrchestration(store,{...input,apiToken:"sk-abcdefghijklmnop"},{runId:"secret",clock}),/secret-like key|credential-like/);
  const eventsPath=path.join(store,"runs",persisted.record.durableRunId,"events.jsonl");
  const originalEvents=await readFile(eventsPath,"utf8");
  const tampered=originalEvents.replace('"eventType":"run_created"','"eventType":"run_terminal"');
  await writeFile(eventsPath,tampered,"utf8");
  const corrupted=await replayDurableRun(store,persisted.record.durableRunId);
  assert.equal(corrupted.status,"corrupted"); assert.equal(corrupted.recoveryAllowed,false);
  const blockedRecovery=await recoverDurableRun(store,persisted.record.durableRunId,{clock});
  assert.equal(blockedRecovery.status,"blocked");
  console.log("PASSED durable orchestration store tests; hash-chain replay; corruption blocks recovery; governance restart enforced");
} finally { await rm(root,{recursive:true,force:true}); }
