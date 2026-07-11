import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { evaluateSandboxPreparationGate } from "../src/gates/execution-gate.mjs";
import { cleanupSecureSandbox, createSecureSandbox } from "../src/sandbox/secure-sandbox-manager.mjs";
import { detectSandboxChanges } from "../src/sandbox/sandbox-change-detector.mjs";
import { loadSchema, validateValue } from "./validate-examples.mjs";

const fixture = await mkdtemp(path.join(os.tmpdir(), "kaveep-sandbox-source-"));
const arbitrary = await mkdtemp(path.join(os.tmpdir(), "kaveep-arbitrary-"));
const evidence = { evidenceId:"evidence_sandbox_test_001", evidenceType:"sandbox_request", verificationStatus:"verified", sourceType:"system_observation", createdAt:"1970-01-01T00:00:00.000Z", summary:"Test evidence." };
const limits = { maxFiles:100, maxDirectories:50, maxTotalBytes:1048576, maxSingleFileBytes:65536, maxDepth:8, maxPathLength:512, maxLifetimeSeconds:3600 };
const makeRequest = overrides => ({ sandboxRequestId:"sandbox_request_test_001", schemaVersion:"1.0.0", requestRef:"request_sandbox_test_001", planRef:"plan_sandbox_test_001", contextRef:"context_sandbox_test_001", gateResultRef:"gate_result_sandbox_test_001", sourceRepositoryRoot:fixture, requestedWorkspaceMode:"bounded_repository_copy", selectedPaths:[], excludedPaths:[], resourceLimits:limits, preserveOriginalState:true, cleanupPolicy:"explicit", evidenceRefs:[evidence], auditRefs:[], status:"proposed", createdAt:"1970-01-01T00:00:00.000Z", ...overrides });
const plan = { planId:"plan_sandbox_test_001", requestId:"request_sandbox_test_001", status:"proposed", safety:{ planAuthorizesExecution:false, protectedActions:[] } };
const gateFor = request => evaluateSandboxPreparationGate(plan, request);
const validate = async (value, filename) => { const schemaPath=path.resolve("schemas", filename); const schema=await loadSchema(schemaPath); const errors=[]; await validateValue(value,schema,{schemaPath,rootSchema:schema},"$",errors); assert.deepEqual(errors,[]); };
const sourceValues = async () => ({ safe:await readFile(path.join(fixture,"safe.txt"),"utf8"), nested:await readFile(path.join(fixture,"src","nested.txt"),"utf8"), secret:await readFile(path.join(fixture,".env"),"utf8") });
const manifests = [];

try {
  await mkdir(path.join(fixture,"src")); await mkdir(path.join(fixture,"node_modules"));
  await writeFile(path.join(fixture,"safe.txt"),"safe"); await writeFile(path.join(fixture,"src","nested.txt"),"nested"); await writeFile(path.join(fixture,".env"),"SECRET=never-copy"); await writeFile(path.join(fixture,"node_modules","ignored.js"),"ignored");
  try { await symlink(path.join(arbitrary,"outside.txt"), path.join(fixture,"external-link")); } catch {}
  const before = await sourceValues();

  const selectedRequest = makeRequest({ requestedWorkspaceMode:"selected_context_copy", selectedPaths:["safe.txt"] });
  const selected = await createSecureSandbox(selectedRequest, gateFor(selectedRequest)); manifests.push(selected.result.manifestRef);
  assert.equal(selected.result.status,"ready"); assert.deepEqual(selected.manifest.copiedFiles,["safe.txt"]); assert.notEqual(path.resolve(selected.result.sandboxRoot),path.resolve(fixture));
  await validate(selected.manifest,"sandbox-manifest.schema.json"); await validate(selected.result,"sandbox-result.schema.json");
  assert.deepEqual(await sourceValues(),before);

  const boundedRequest = makeRequest({ sandboxRequestId:"sandbox_request_test_002", gateResultRef:"gate_result_sandbox_test_002" });
  const bounded = await createSecureSandbox(boundedRequest, gateFor(boundedRequest)); manifests.push(bounded.result.manifestRef);
  assert.equal(bounded.manifest.ignoredPaths.some(item => item.path === "node_modules"),true);
  assert.equal(bounded.manifest.sensitiveArtifactsExcluded.some(item => item.path === ".env"),true);
  assert.equal(bounded.manifest.copiedFiles.includes(".env"),false);
  if (bounded.manifest.symlinksExcluded.length) assert.equal(bounded.manifest.symlinksExcluded[0].path,"external-link");

  await writeFile(path.join(bounded.result.sandboxRoot,"safe.txt"),"changed only in sandbox");
  await writeFile(path.join(bounded.result.sandboxRoot,"added.txt"),"added");
  await rm(path.join(bounded.result.sandboxRoot,"src","nested.txt"));
  const changes = await detectSandboxChanges(bounded.manifest);
  assert.deepEqual(changes.addedFiles,["added.txt"]); assert.deepEqual(changes.modifiedFiles,["safe.txt"]); assert.deepEqual(changes.deletedFiles,["src/nested.txt"]); assert.deepEqual(await sourceValues(),before);

  const limitedRequest = makeRequest({ sandboxRequestId:"sandbox_request_test_003", gateResultRef:"gate_result_sandbox_test_003", resourceLimits:{ ...limits, maxFiles:1 } });
  const limited = await createSecureSandbox(limitedRequest, gateFor(limitedRequest)); manifests.push(limited.result.manifestRef);
  assert.equal(limited.result.status,"ready_with_warnings"); assert.equal(limited.result.copiedFiles,1); assert.equal(limited.result.warnings.some(item => ["snapshot_limit_reached","copy_limit_reached"].includes(item.code)),true);

  assert.equal((await createSecureSandbox(makeRequest({ sourceRepositoryRoot:"" }), gateFor(makeRequest({ sourceRepositoryRoot:"" })))).result.status,"blocked");
  assert.equal((await createSecureSandbox(makeRequest({ sourceRepositoryRoot:path.join(fixture,"safe.txt") }), gateFor(makeRequest({ sourceRepositoryRoot:path.join(fixture,"safe.txt") })))).result.status,"blocked");
  assert.equal((await createSecureSandbox(makeRequest({ sourceRepositoryRoot:path.parse(fixture).root }), gateFor(makeRequest({ sourceRepositoryRoot:path.parse(fixture).root })))).result.status,"blocked");
  assert.equal((await createSecureSandbox(makeRequest(), undefined)).result.status,"blocked");
  assert.equal((await createSecureSandbox({ ...makeRequest(), status:"approved" }, gateFor(makeRequest()))).result.status,"blocked");

  const fakeManifest = path.join(arbitrary,"sandbox-manifest.json"); await writeFile(fakeManifest,JSON.stringify({ sandboxId:"sandbox_fake",sandboxRoot:arbitrary,sourceRepositoryRoot:fixture }));
  await assert.rejects(cleanupSecureSandbox(fakeManifest));
  await assert.rejects(cleanupSecureSandbox(path.join(fixture,"safe.txt")));

  for (const manifestPath of manifests) { const cleaned=await cleanupSecureSandbox(manifestPath); assert.equal(cleaned.status,"cleaned"); }
  manifests.length=0;
  assert.deepEqual(await sourceValues(),before);
  console.log("PASSED secure sandbox tests; source unchanged; verified sandboxes cleaned");
} finally {
  for (const manifestPath of manifests) { try { await cleanupSecureSandbox(manifestPath); } catch {} }
  await rm(fixture,{recursive:true,force:true}); await rm(arbitrary,{recursive:true,force:true});
}
